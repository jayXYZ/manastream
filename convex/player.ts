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
        decklistStatus: v.optional(decklistStatusValidator),
        deckName: v.string(),
        deckList: v.string(),
      }),
    ),
  },
  returns: v.array(v.object({ playerId: v.id("players"), externalDecklistId: v.optional(v.string()) })),
  handler: async (ctx, args) => {
    const playerIdsAndDeckIds: { playerId: Id<"players">; externalDecklistId?: string }[] =
      [];
    const playerIdsToResolve: Id<"players">[] = [];
    for (const player of args.players) {
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
      playerIdsAndDeckIds.push({ playerId, externalDecklistId: player.externalDecklistId });
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
        externalDecklistId: v.optional(v.string()),
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
      const externalDecklistId =
        player.externalDecklistId ?? existingPlayer.externalDecklistId;
      const decklistStatus =
        player.decklistStatus ?? existingPlayer.decklistStatus ?? "ready";
      await ctx.db.patch(player.playerId, {
        deckName: player.deckName,
        deckList: player.deckList,
        deckCardsStatus: getInitialDeckCardsStatus(player.deckList),
        deckCards: undefined,
        ...(player.externalDecklistId !== undefined && { externalDecklistId: player.externalDecklistId }),
        ...(player.decklistStatus !== undefined && {
          decklistStatus: player.decklistStatus,
        }),
      });
      if (existingPlayer.externalTournamentId !== undefined) {
        await upsertPlayerDecklist(ctx, player.playerId, {
          externalTournamentId: existingPlayer.externalTournamentId,
          externalPlayerId: existingPlayer.externalPlayerId,
          externalDecklistId,
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
    const players = await ctx.db
      .query("players")
      .withIndex("by_external_tournament_id", (q) =>
        q.eq("externalTournamentId", tournament.externalTournamentId!),
      )
      .collect();
    const playersWithData = await Promise.all(
      players.map((player) => getPlayerData(ctx, player)),
    );
    return playersWithData.map((player) => ({
      externalPlayerId: player.externalPlayerId,
      name: player.name,
      registrationStatus: player.registrationStatus,
      deckName: player.deckName,
      deckList: player.deckList,
    }));
  },
});

export const updatePlayerRegistrationStatuses = internalMutation({
  args: {
    externalTournamentId: v.number(),
    players: v.array(
      v.object({
        externalPlayerId: v.number(),
        registrationStatus: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
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
      return;
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
  },
});

export const getPlayersWithMissingDecklists = internalQuery({
  args: {
    externalTournamentId: v.number(),
  },
  returns: v.array(
    v.object({
      playerId: v.id("players"),
      externalPlayerId: v.number(),
      externalDecklistId: v.optional(v.string()),
      decklistStatus: v.optional(decklistStatusValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const missingDecklists = new Map<
      Id<"players">,
      {
        playerId: Id<"players">;
        externalPlayerId: number;
        externalDecklistId?: string;
        decklistStatus?: "pending" | "ready" | "missing" | "fetch_failed" | "manual";
      }
    >();
    for (const status of ["missing", "fetch_failed"] as const) {
      const decklists = await ctx.db
        .query("playerDecklists")
        .withIndex("by_external_tournament_id_and_decklist_status", (q) =>
          q
            .eq("externalTournamentId", args.externalTournamentId)
            .eq("decklistStatus", status),
        )
        .collect();
      for (const decklist of decklists) {
        missingDecklists.set(decklist.playerId, {
          playerId: decklist.playerId,
          externalPlayerId: decklist.externalPlayerId,
          externalDecklistId: decklist.externalDecklistId,
          decklistStatus: decklist.decklistStatus,
        });
      }
    }

    const legacyPlayers = await ctx.db
      .query("players")
      .withIndex("by_external_tournament_id", (q) =>
        q.eq("externalTournamentId", args.externalTournamentId),
      )
      .collect();
    for (const player of legacyPlayers) {
      if (missingDecklists.has(player._id) || !isMissingDecklistData(player)) {
        continue;
      }
      missingDecklists.set(player._id, {
        playerId: player._id,
        externalPlayerId: player.externalPlayerId,
        externalDecklistId: player.externalDecklistId,
        decklistStatus: player.decklistStatus,
      });
    }
    return [...missingDecklists.values()];
  },
});

export const getAllTournamentPlayerExternalIds = internalQuery({
  args: {
    externalTournamentId: v.number(),
  },
  returns: v.array(v.number()),
  handler: async (ctx, args) => {
    const statusRows = await ctx.db
      .query("playerStatuses")
      .withIndex("by_external_tournament_id", (q) =>
        q.eq("externalTournamentId", args.externalTournamentId),
      )
      .collect();
    const externalPlayerIds = new Set(
      statusRows.map((player) => player.externalPlayerId),
    );

    const legacyPlayers = await ctx.db
      .query("players")
      .withIndex("by_external_tournament_id", (q) =>
        q.eq("externalTournamentId", args.externalTournamentId),
      )
      .collect();
    for (const player of legacyPlayers) {
      externalPlayerIds.add(player.externalPlayerId);
    }
    return [...externalPlayerIds];
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
