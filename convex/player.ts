import { Id } from "./_generated/dataModel";
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
import { decklistStatusValidator } from "./validators";
import {
  getChangedRegistrationStatuses,
  getPlayerData,
  insertPlayerDataRows,
  isMissingDecklistData,
  upsertPlayerDecklist,
} from "./lib/playerData";

export const createPlayer = internalMutation({
  args: {
    spicerackTournamentId: v.number(),
    player: v.object({
      name: v.string(),
      spicerackPlayerId: v.number(),
      registrationStatus: v.optional(v.string()),
      deckId: v.number(),
      decklistStatus: v.optional(decklistStatusValidator),
      deckName: v.string(),
      deckList: v.string(),
    }),
  },
  returns: v.id("players"),
  handler: async (ctx, args) => {
    const playerId = await ctx.db.insert("players", {
      name: args.player.name,
      spicerackTournamentId: args.spicerackTournamentId,
      spicerackPlayerId: args.player.spicerackPlayerId,
      registrationStatus: args.player.registrationStatus,
      deckId: args.player.deckId,
      decklistStatus: args.player.decklistStatus,
      deckName: args.player.deckName,
      deckList: args.player.deckList,
      deckCardsStatus: getInitialDeckCardsStatus(args.player.deckList),
      updatedAt: Date.now(),
    });
    await insertPlayerDataRows(ctx, playerId, {
      ...args.player,
      spicerackTournamentId: args.spicerackTournamentId,
    });
    await scheduleDeckCardsResolution(ctx, playerId, args.player.deckList);
    return playerId;
  },
});

export const createPlayers = internalMutation({
  args: {
    players: v.array(
      v.object({
        spicerackTournamentId: v.number(),
        name: v.string(),
        spicerackPlayerId: v.number(),
        registrationStatus: v.optional(v.string()),
        deckId: v.number(),
        decklistStatus: v.optional(decklistStatusValidator),
        deckName: v.string(),
        deckList: v.string(),
      }),
    ),
  },
  returns: v.array(v.object({ playerId: v.id("players"), deckId: v.number() })),
  handler: async (ctx, args) => {
    const playerIdsAndDeckIds: { playerId: Id<"players">; deckId: number }[] =
      [];
    const playerIdsToResolve: Id<"players">[] = [];
    for (const player of args.players) {
      const playerId = await ctx.db.insert("players", {
        name: player.name,
        spicerackTournamentId: player.spicerackTournamentId,
        spicerackPlayerId: player.spicerackPlayerId,
        registrationStatus: player.registrationStatus,
        deckId: player.deckId,
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
      playerIdsAndDeckIds.push({ playerId, deckId: player.deckId });
    }
    await scheduleDeckCardsResolutionBatch(ctx, playerIdsToResolve);
    return playerIdsAndDeckIds;
  },
});

export const updatePlayerDecklists = internalMutation({
  args: {
    players: v.array(
      v.object({
        playerId: v.id("players"),
        deckName: v.string(),
        deckList: v.string(),
        deckId: v.optional(v.number()),
        decklistStatus: v.optional(decklistStatusValidator),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const playerIdsToResolve: Id<"players">[] = [];
    for (const player of args.players) {
      const existingPlayer = await ctx.db.get(player.playerId);
      if (!existingPlayer) {
        throw new Error("Player not found");
      }
      const deckId = player.deckId ?? existingPlayer.deckId ?? -1;
      const decklistStatus =
        player.decklistStatus ?? existingPlayer.decklistStatus ?? "ready";
      await ctx.db.patch(player.playerId, {
        deckName: player.deckName,
        deckList: player.deckList,
        deckCardsStatus: getInitialDeckCardsStatus(player.deckList),
        deckCards: undefined,
        ...(player.deckId !== undefined && { deckId: player.deckId }),
        ...(player.decklistStatus !== undefined && {
          decklistStatus: player.decklistStatus,
        }),
      });
      if (existingPlayer.spicerackTournamentId !== undefined) {
        await upsertPlayerDecklist(ctx, player.playerId, {
          spicerackTournamentId: existingPlayer.spicerackTournamentId,
          spicerackPlayerId: existingPlayer.spicerackPlayerId,
          deckId,
          decklistStatus,
          deckName: player.deckName,
          deckList: player.deckList,
        });
      }
      if (isResolvableDeckList(player.deckList)) {
        playerIdsToResolve.push(player.playerId);
      }
    }
    await scheduleDeckCardsResolutionBatch(ctx, playerIdsToResolve);
  },
});

export const getAllSpicerackTournamentPlayers = query({
  args: {},
  returns: v.array(
    v.object({
      spicerackPlayerId: v.number(),
      name: v.string(),
      registrationStatus: v.optional(v.string()),
      deckName: v.string(),
      deckList: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const tournament = await getOwnTournament(ctx);
    if (!tournament.spicerackTournamentId) {
      return [];
    }
    const players = await ctx.db
      .query("players")
      .withIndex("by_spicerack_tournament_id", (q) =>
        q.eq("spicerackTournamentId", tournament.spicerackTournamentId!),
      )
      .collect();
    const playersWithData = await Promise.all(
      players.map((player) => getPlayerData(ctx, player)),
    );
    return playersWithData.map((player) => ({
      spicerackPlayerId: player.spicerackPlayerId,
      name: player.name,
      registrationStatus: player.registrationStatus,
      deckName: player.deckName,
      deckList: player.deckList,
    }));
  },
});

export const updatePlayerRegistrationStatuses = internalMutation({
  args: {
    spicerackTournamentId: v.number(),
    players: v.array(
      v.object({
        spicerackPlayerId: v.number(),
        registrationStatus: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const statusRows = await ctx.db
      .query("playerStatuses")
      .withIndex("by_spicerack_tournament_id", (q) =>
        q.eq("spicerackTournamentId", args.spicerackTournamentId),
      )
      .collect();

    const statusTargetsBySpicerackPlayerId = new Map(
      statusRows.map((player) => [
        player.spicerackPlayerId,
        {
          currentStatus: player.registrationStatus,
          targetId: player._id,
          playerId: player.playerId,
        },
      ]),
    );

    for (const changedStatus of getChangedRegistrationStatuses(
      args.players,
      statusTargetsBySpicerackPlayerId,
    )) {
      const target = statusTargetsBySpicerackPlayerId.get(
        changedStatus.spicerackPlayerId,
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
      (player) => !statusTargetsBySpicerackPlayerId.has(player.spicerackPlayerId),
    );
    if (missingStatusPlayerIds.length === 0) {
      return;
    }

    const missingStatusBySpicerackPlayerId = new Map(
      missingStatusPlayerIds.map((player) => [
        player.spicerackPlayerId,
        player.registrationStatus,
      ]),
    );
    const legacyPlayers = await ctx.db
      .query("players")
      .withIndex("by_spicerack_tournament_id", (q) =>
        q.eq("spicerackTournamentId", args.spicerackTournamentId),
      )
      .collect();

    for (const player of legacyPlayers) {
      if (!missingStatusBySpicerackPlayerId.has(player.spicerackPlayerId)) {
        continue;
      }
      const registrationStatus = missingStatusBySpicerackPlayerId.get(
        player.spicerackPlayerId,
      )!;
      if (player.registrationStatus !== registrationStatus) {
        await ctx.db.patch(player._id, { registrationStatus });
      }
      await ctx.db.insert("playerStatuses", {
        playerId: player._id,
        spicerackTournamentId: args.spicerackTournamentId,
        spicerackPlayerId: player.spicerackPlayerId,
        registrationStatus,
        updatedAt: Date.now(),
      });
    }
  },
});

export const getPlayersWithMissingDecklists = internalQuery({
  args: {
    spicerackTournamentId: v.number(),
  },
  returns: v.array(
    v.object({
      playerId: v.id("players"),
      spicerackPlayerId: v.number(),
      deckId: v.number(),
      decklistStatus: v.optional(decklistStatusValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const missingDecklists = new Map<
      Id<"players">,
      {
        playerId: Id<"players">;
        spicerackPlayerId: number;
        deckId: number;
        decklistStatus?: "pending" | "ready" | "missing" | "fetch_failed" | "manual";
      }
    >();
    for (const status of ["missing", "fetch_failed"] as const) {
      const decklists = await ctx.db
        .query("playerDecklists")
        .withIndex("by_spicerack_tournament_id_and_decklist_status", (q) =>
          q
            .eq("spicerackTournamentId", args.spicerackTournamentId)
            .eq("decklistStatus", status),
        )
        .collect();
      for (const decklist of decklists) {
        missingDecklists.set(decklist.playerId, {
          playerId: decklist.playerId,
          spicerackPlayerId: decklist.spicerackPlayerId,
          deckId: decklist.deckId,
          decklistStatus: decklist.decklistStatus,
        });
      }
    }

    const legacyPlayers = await ctx.db
      .query("players")
      .withIndex("by_spicerack_tournament_id", (q) =>
        q.eq("spicerackTournamentId", args.spicerackTournamentId),
      )
      .collect();
    for (const player of legacyPlayers) {
      if (missingDecklists.has(player._id) || !isMissingDecklistData(player)) {
        continue;
      }
      missingDecklists.set(player._id, {
        playerId: player._id,
        spicerackPlayerId: player.spicerackPlayerId,
        deckId: player.deckId ?? -1,
        decklistStatus: player.decklistStatus,
      });
    }
    return [...missingDecklists.values()];
  },
});

export const getAllSpicerackTournamentPlayerSpicerackIds = internalQuery({
  args: {
    spicerackTournamentId: v.number(),
  },
  returns: v.array(v.number()),
  handler: async (ctx, args) => {
    const statusRows = await ctx.db
      .query("playerStatuses")
      .withIndex("by_spicerack_tournament_id", (q) =>
        q.eq("spicerackTournamentId", args.spicerackTournamentId),
      )
      .collect();
    const spicerackPlayerIds = new Set(
      statusRows.map((player) => player.spicerackPlayerId),
    );

    const legacyPlayers = await ctx.db
      .query("players")
      .withIndex("by_spicerack_tournament_id", (q) =>
        q.eq("spicerackTournamentId", args.spicerackTournamentId),
      )
      .collect();
    for (const player of legacyPlayers) {
      spicerackPlayerIds.add(player.spicerackPlayerId);
    }
    return [...spicerackPlayerIds];
  },
});

export const updatePlayerInfo = mutation({
  args: {
    spicerackPlayerId: v.number(),
    name: v.string(),
    deckName: v.string(),
    deckList: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the authenticated user's tournament to verify authorization
    const tournament = await getOwnTournament(ctx);
    if (!tournament.spicerackTournamentId) {
      throw new Error("No Spicerack tournament linked");
    }

    // Query for the player, ensuring they belong to the user's tournament
    const player = await ctx.db
      .query("players")
      .withIndex("by_spicerack_tournament_id_and_spicerack_player_id", (q) =>
        q
          .eq("spicerackTournamentId", tournament.spicerackTournamentId!)
          .eq("spicerackPlayerId", args.spicerackPlayerId),
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
      spicerackTournamentId: tournament.spicerackTournamentId,
      spicerackPlayerId: args.spicerackPlayerId,
      deckId: player.deckId ?? -1,
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
