import { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  query,
  mutation,
} from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getOwnTournament } from "./lib/tournaments";
import {
  decklistStatusValidator,
  playerRefreshRunValidator,
} from "./validators";
import { isPlayerRefreshRunCurrent } from "./lib/playerRefresh";
import {
  composePlayerData,
  getChangedRegistrationStatuses,
  getPlayerDecklistByPlayerId,
  insertPlayerDataRows,
  loadTournamentPlayerData,
  upsertPlayerDecklist,
} from "./lib/playerData";
import {
  CachedPlayerForSync,
  shouldApplyDecklistUpdate,
} from "./lib/playerSync";

const decklistUpdateValidator = v.object({
  playerId: v.id("players"),
  deckName: v.string(),
  deckList: v.string(),
  externalDecklistId: v.optional(v.string()),
  externalDecklistUpdatedAt: v.optional(v.string()),
  decklistStatus: v.union(v.literal("ready"), v.literal("fetch_failed")),
});

/**
 * The player fields the Melee sync planner compares against, composed from
 * the players row and its playerDecklists row the same way everywhere so a
 * decision made at plan time can be re-checked at commit time.
 */
function toCachedPlayerForSync(
  player: Doc<"players">,
  decklist: Doc<"playerDecklists"> | null | undefined,
): CachedPlayerForSync {
  const data = composePlayerData(player, undefined, decklist);
  return {
    playerId: player._id,
    externalPlayerId: player.externalPlayerId,
    name: player.name,
    externalDecklistId: data.externalDecklistId,
    externalDecklistUpdatedAt: decklist?.externalDecklistUpdatedAt,
    decklistStatus: data.decklistStatus,
    deckName: data.deckName,
    deckList: data.deckList,
  };
}

export const createPlayer = internalMutation({
  args: {
    externalTournamentId: v.number(),
    player: v.object({
      name: v.string(),
      externalPlayerId: v.number(),
      registrationStatus: v.optional(v.string()),
      externalDecklistId: v.optional(v.string()),
      decklistStatus: v.optional(decklistStatusValidator),
      deckName: v.string(),
      deckList: v.string(),
    }),
  },
  returns: v.id("players"),
  handler: async (ctx, args) => {
    const playerId = await ctx.db.insert("players", {
      name: args.player.name,
      externalTournamentId: args.externalTournamentId,
      externalPlayerId: args.player.externalPlayerId,
      registrationStatus: args.player.registrationStatus,
      externalDecklistId: args.player.externalDecklistId,
      decklistStatus: args.player.decklistStatus,
      deckName: args.player.deckName,
      deckList: args.player.deckList,
      deckCardsStatus: getInitialDeckCardsStatus(args.player.deckList),
      updatedAt: Date.now(),
    });
    await insertPlayerDataRows(ctx, playerId, {
      ...args.player,
      externalTournamentId: args.externalTournamentId,
    });
    await scheduleDeckCardsResolution(ctx, playerId, args.player.deckList);
    return playerId;
  },
});

export const createPlayers = internalMutation({
  args: {
    players: v.array(
      v.object({
        externalTournamentId: v.number(),
        name: v.string(),
        externalPlayerId: v.number(),
        registrationStatus: v.optional(v.string()),
        externalDecklistId: v.optional(v.string()),
        externalDecklistUpdatedAt: v.optional(v.string()),
        decklistStatus: v.optional(decklistStatusValidator),
        deckName: v.string(),
        deckList: v.string(),
      }),
    ),
    // Set by a "Refresh players" run: nothing is written, and null is
    // returned, when the run is no longer the tournament's current one.
    run: v.optional(playerRefreshRunValidator),
  },
  returns: v.union(
    v.null(),
    v.array(
      v.object({
        playerId: v.id("players"),
        externalPlayerId: v.number(),
        externalDecklistId: v.optional(v.string()),
      }),
    ),
  ),
  handler: async (ctx, args) => {
    if (args.run && !(await isPlayerRefreshRunCurrent(ctx, args.run))) {
      return null;
    }
    const created: {
      playerId: Id<"players">;
      externalPlayerId: number;
      externalDecklistId?: string;
    }[] = [];
    const playerIdsToResolve: Id<"players">[] = [];
    for (const player of args.players) {
      // The poll loop and a manual player refresh can both discover the same
      // new player; the second insert to commit sees the first and skips.
      const existing = await ctx.db
        .query("players")
        .withIndex("by_external_tournament_id_and_external_player_id", (q) =>
          q
            .eq("externalTournamentId", player.externalTournamentId)
            .eq("externalPlayerId", player.externalPlayerId),
        )
        .first();
      if (existing) {
        continue;
      }
      const playerId = await ctx.db.insert("players", {
        name: player.name,
        externalTournamentId: player.externalTournamentId,
        externalPlayerId: player.externalPlayerId,
        registrationStatus: player.registrationStatus,
        externalDecklistId: player.externalDecklistId,
        decklistStatus: player.decklistStatus,
        deckName: player.deckName,
        deckList: player.deckList,
        deckCardsStatus: getInitialDeckCardsStatus(player.deckList),
        updatedAt: Date.now(),
      });
      await insertPlayerDataRows(ctx, playerId, player);
      if (isResolvableDeckList(player.deckList)) {
        playerIdsToResolve.push(playerId);
      }
      created.push({
        playerId,
        externalPlayerId: player.externalPlayerId,
        externalDecklistId: player.externalDecklistId,
      });
    }
    await scheduleDeckCardsResolutionBatch(ctx, playerIdsToResolve);
    return created;
  },
});

/**
 * Apply decklists pulled from Melee. Each update is re-checked against the
 * row as it is now, not the snapshot the sync planned from: a player edited
 * by hand in the meantime is left alone, a usable decklist is never replaced
 * by a failed fetch, and an overlapping sync that already stored a newer
 * LastUpdated is not rolled back. Returns the updates actually written, or
 * null (nothing written) when the refresh run that requested them is stale.
 */
export const updatePlayerDecklists = internalMutation({
  args: {
    players: v.array(decklistUpdateValidator),
    run: v.optional(playerRefreshRunValidator),
  },
  returns: v.union(v.null(), v.array(decklistUpdateValidator)),
  handler: async (ctx, args) => {
    if (args.run && !(await isPlayerRefreshRunCurrent(ctx, args.run))) {
      return null;
    }
    const applied: typeof args.players = [];
    const playerIdsToResolve: Id<"players">[] = [];
    for (const player of args.players) {
      const existingPlayer = await ctx.db.get(player.playerId);
      if (!existingPlayer) {
        throw new Error("Player not found");
      }
      const existingDecklist = await getPlayerDecklistByPlayerId(
        ctx,
        player.playerId,
      );
      const current = toCachedPlayerForSync(existingPlayer, existingDecklist);
      if (!shouldApplyDecklistUpdate(current, player)) {
        continue;
      }
      const externalDecklistId =
        player.externalDecklistId ?? current.externalDecklistId;
      // Only a changed list text invalidates the resolved cards; a write that
      // just records a new decklist id or timestamp keeps them.
      const deckListChanged = current.deckList !== player.deckList;
      // A stored LastUpdated still describes the decklist when neither the
      // decklist id nor the text changed, so a response that carried none
      // does not erase it.
      const externalDecklistUpdatedAt =
        player.externalDecklistUpdatedAt ??
        (externalDecklistId === current.externalDecklistId && !deckListChanged
          ? current.externalDecklistUpdatedAt
          : undefined);
      await ctx.db.patch(player.playerId, {
        deckName: player.deckName,
        deckList: player.deckList,
        ...(deckListChanged && {
          deckCardsStatus: getInitialDeckCardsStatus(player.deckList),
          deckCards: undefined,
        }),
        ...(player.externalDecklistId !== undefined && {
          externalDecklistId: player.externalDecklistId,
        }),
        decklistStatus: player.decklistStatus,
      });
      if (existingPlayer.externalTournamentId !== undefined) {
        await upsertPlayerDecklist(ctx, player.playerId, {
          externalTournamentId: existingPlayer.externalTournamentId,
          externalPlayerId: existingPlayer.externalPlayerId,
          externalDecklistId,
          externalDecklistUpdatedAt,
          decklistStatus: player.decklistStatus,
          deckName: player.deckName,
          deckList: player.deckList,
        });
      }
      if (deckListChanged && isResolvableDeckList(player.deckList)) {
        playerIdsToResolve.push(player.playerId);
      }
      applied.push(player);
    }
    await scheduleDeckCardsResolutionBatch(ctx, playerIdsToResolve);
    return applied;
  },
});

export const getAllTournamentPlayers = query({
  args: {},
  returns: v.array(
    v.object({
      externalPlayerId: v.number(),
      name: v.string(),
      registrationStatus: v.optional(v.string()),
      deckName: v.string(),
      deckList: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const tournament = await getOwnTournament(ctx);
    if (!tournament.externalTournamentId) {
      return [];
    }
    const { players } = await loadTournamentPlayerData(
      ctx,
      tournament.externalTournamentId,
    );
    return players.map((player) => ({
      externalPlayerId: player.externalPlayerId,
      name: player.name,
      registrationStatus: player.registrationStatus,
      deckName: player.deckName,
      deckList: player.deckList,
    }));
  },
});

/**
 * Apply registration statuses (drops) from the Melee player list. Returns
 * false, having written nothing, when the refresh run that requested them
 * is stale.
 */
export const updatePlayerRegistrationStatuses = internalMutation({
  args: {
    externalTournamentId: v.number(),
    players: v.array(
      v.object({
        externalPlayerId: v.number(),
        registrationStatus: v.string(),
      }),
    ),
    run: v.optional(playerRefreshRunValidator),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (args.run && !(await isPlayerRefreshRunCurrent(ctx, args.run))) {
      return false;
    }
    const statusRows = await ctx.db
      .query("playerStatuses")
      .withIndex("by_external_tournament_id", (q) =>
        q.eq("externalTournamentId", args.externalTournamentId),
      )
      .collect();

    const statusTargetsByExternalPlayerId = new Map(
      statusRows.map((player) => [
        player.externalPlayerId,
        {
          currentStatus: player.registrationStatus,
          targetId: player._id,
          playerId: player.playerId,
        },
      ]),
    );

    for (const changedStatus of getChangedRegistrationStatuses(
      args.players,
      statusTargetsByExternalPlayerId,
    )) {
      const target = statusTargetsByExternalPlayerId.get(
        changedStatus.externalPlayerId,
      );
      await ctx.db.patch(changedStatus.targetId as Id<"playerStatuses">, {
        registrationStatus: changedStatus.registrationStatus,
        updatedAt: Date.now(),
      });
      await ctx.db.patch(target!.playerId, {
        registrationStatus: changedStatus.registrationStatus,
      });
    }

    const missingStatusPlayerIds = args.players.filter(
      (player) => !statusTargetsByExternalPlayerId.has(player.externalPlayerId),
    );
    if (missingStatusPlayerIds.length === 0) {
      return true;
    }

    const missingStatusByExternalPlayerId = new Map(
      missingStatusPlayerIds.map((player) => [
        player.externalPlayerId,
        player.registrationStatus,
      ]),
    );
    const legacyPlayers = await ctx.db
      .query("players")
      .withIndex("by_external_tournament_id", (q) =>
        q.eq("externalTournamentId", args.externalTournamentId),
      )
      .collect();

    for (const player of legacyPlayers) {
      if (!missingStatusByExternalPlayerId.has(player.externalPlayerId)) {
        continue;
      }
      const registrationStatus = missingStatusByExternalPlayerId.get(
        player.externalPlayerId,
      )!;
      if (player.registrationStatus !== registrationStatus) {
        await ctx.db.patch(player._id, { registrationStatus });
      }
      await ctx.db.insert("playerStatuses", {
        playerId: player._id,
        externalTournamentId: args.externalTournamentId,
        externalPlayerId: player.externalPlayerId,
        registrationStatus,
        updatedAt: Date.now(),
      });
    }
    return true;
  },
});

/**
 * Every cached player for the tournament with the decklist fields the Melee
 * player sync compares against. Reads the players and playerDecklists tables
 * once each rather than one lookup per player.
 */
export const getTournamentPlayersForSync = internalQuery({
  args: {
    externalTournamentId: v.number(),
  },
  returns: v.array(
    v.object({
      playerId: v.id("players"),
      externalPlayerId: v.number(),
      name: v.string(),
      externalDecklistId: v.optional(v.string()),
      externalDecklistUpdatedAt: v.optional(v.string()),
      decklistStatus: v.optional(decklistStatusValidator),
      deckName: v.string(),
      deckList: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const [players, decklists] = await Promise.all([
      ctx.db
        .query("players")
        .withIndex("by_external_tournament_id", (q) =>
          q.eq("externalTournamentId", args.externalTournamentId),
        )
        .collect(),
      ctx.db
        .query("playerDecklists")
        .withIndex("by_external_tournament_id", (q) =>
          q.eq("externalTournamentId", args.externalTournamentId),
        )
        .collect(),
    ]);
    const decklistsByPlayerId = new Map(
      decklists.map((decklist) => [decklist.playerId, decklist]),
    );
    return players.map((player) =>
      toCachedPlayerForSync(player, decklistsByPlayerId.get(player._id)),
    );
  },
});

/**
 * Apply names from Melee. A player edited by hand since the sync was planned
 * keeps the edited name. Returns the number of names written, or null
 * (nothing written) when the refresh run that requested them is stale.
 */
export const updatePlayerNames = internalMutation({
  args: {
    players: v.array(
      v.object({
        playerId: v.id("players"),
        name: v.string(),
      }),
    ),
    run: v.optional(playerRefreshRunValidator),
  },
  returns: v.union(v.null(), v.number()),
  handler: async (ctx, args) => {
    if (args.run && !(await isPlayerRefreshRunCurrent(ctx, args.run))) {
      return null;
    }
    let updated = 0;
    for (const player of args.players) {
      const existingPlayer = await ctx.db.get(player.playerId);
      if (!existingPlayer) {
        continue;
      }
      const existingDecklist = await getPlayerDecklistByPlayerId(
        ctx,
        player.playerId,
      );
      const current = toCachedPlayerForSync(existingPlayer, existingDecklist);
      if (current.decklistStatus === "manual" || current.name === player.name) {
        continue;
      }
      await ctx.db.patch(player.playerId, {
        name: player.name,
        updatedAt: Date.now(),
      });
      updated += 1;
    }
    return updated;
  },
});

export const updatePlayerInfo = mutation({
  args: {
    externalPlayerId: v.number(),
    name: v.string(),
    deckName: v.string(),
    deckList: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the authenticated user's tournament to verify authorization
    const tournament = await getOwnTournament(ctx);
    if (!tournament.externalTournamentId) {
      throw new Error("No Melee tournament linked");
    }

    // Query for the player, ensuring they belong to the user's tournament
    const player = await ctx.db
      .query("players")
      .withIndex("by_external_tournament_id_and_external_player_id", (q) =>
        q
          .eq("externalTournamentId", tournament.externalTournamentId!)
          .eq("externalPlayerId", args.externalPlayerId),
      )
      .unique();

    if (!player) {
      throw new Error("Player not found in your tournament");
    }

    await ctx.db.patch(player._id, {
      name: args.name,
      deckName: args.deckName,
      deckList: args.deckList,
      decklistStatus: "manual",
      deckCardsStatus: getInitialDeckCardsStatus(args.deckList),
      deckCards: undefined,
      updatedAt: Date.now(),
    });
    await upsertPlayerDecklist(ctx, player._id, {
      externalTournamentId: tournament.externalTournamentId,
      externalPlayerId: args.externalPlayerId,
      externalDecklistId: player.externalDecklistId,
      decklistStatus: "manual",
      deckName: args.deckName,
      deckList: args.deckList,
    });
    await scheduleDeckCardsResolution(ctx, player._id, args.deckList);
  },
});

function getInitialDeckCardsStatus(deckList: string) {
  if (isResolvableDeckList(deckList)) {
    return "pending" as const;
  }
  if (deckList === "PENDING") {
    return "pending" as const;
  }
  return "failed" as const;
}

function isResolvableDeckList(deckList: string) {
  const trimmed = deckList.trim();
  return (
    trimmed.length > 0 &&
    trimmed !== "PENDING" &&
    trimmed !== "MISSING_DECKLIST" &&
    trimmed !== "Unknown"
  );
}

async function scheduleDeckCardsResolution(
  ctx: Pick<MutationCtx, "scheduler">,
  playerId: Id<"players">,
  deckList: string,
) {
  if (!isResolvableDeckList(deckList)) {
    return;
  }
  await ctx.scheduler.runAfter(0, internal.deckCards.resolvePlayerDeckCards, {
    playerId,
  });
}

async function scheduleDeckCardsResolutionBatch(
  ctx: Pick<MutationCtx, "scheduler">,
  playerIds: Id<"players">[],
) {
  if (playerIds.length === 0) {
    return;
  }
  await ctx.scheduler.runAfter(0, internal.deckCards.resolvePlayersDeckCards, {
    playerIds,
  });
}
