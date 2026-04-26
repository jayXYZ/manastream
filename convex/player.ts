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

export const createPlayer = internalMutation({
  args: {
    spicerackTournamentId: v.number(),
    player: v.object({
      name: v.string(),
      spicerackPlayerId: v.number(),
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
      deckId: args.player.deckId,
      decklistStatus: args.player.decklistStatus,
      deckName: args.player.deckName,
      deckList: args.player.deckList,
      deckCardsStatus: getInitialDeckCardsStatus(args.player.deckList),
      updatedAt: Date.now(),
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
        deckId: player.deckId,
        decklistStatus: player.decklistStatus,
        deckName: player.deckName,
        deckList: player.deckList,
        deckCardsStatus: getInitialDeckCardsStatus(player.deckList),
        updatedAt: Date.now(),
      });
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
    return players.map((player) => ({
      spicerackPlayerId: player.spicerackPlayerId,
      name: player.name,
      deckName: player.deckName,
      deckList: player.deckList,
    }));
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
    const players = await ctx.db
      .query("players")
      .withIndex("by_spicerack_tournament_id", (q) =>
        q.eq("spicerackTournamentId", args.spicerackTournamentId),
      )
      .collect();
    return players
      .filter((player) => {
        if (
          player.decklistStatus === "missing" ||
          player.decklistStatus === "fetch_failed"
        ) {
          return true;
        }
        if (
          player.decklistStatus === "manual" ||
          player.decklistStatus === "ready" ||
          player.decklistStatus === "pending"
        ) {
          return false;
        }
        // Fallback for older records that do not have decklistStatus yet.
        return (
          (player.deckName === "MISSING_DECKLIST" &&
            player.deckList === "MISSING_DECKLIST") ||
          (player.deckName === "Unknown" && player.deckList === "Unknown")
        );
      })
      .map((player) => ({
        playerId: player._id,
        spicerackPlayerId: player.spicerackPlayerId,
        deckId: player.deckId,
        decklistStatus: player.decklistStatus,
      }));
  },
});

export const getAllSpicerackTournamentPlayerSpicerackIds = internalQuery({
  args: {
    spicerackTournamentId: v.number(),
  },
  returns: v.array(v.number()),
  handler: async (ctx, args) => {
    const players = await ctx.db
      .query("players")
      .withIndex("by_spicerack_tournament_id", (q) =>
        q.eq("spicerackTournamentId", args.spicerackTournamentId),
      )
      .collect();
    return players.map((player) => player.spicerackPlayerId);
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
      .withIndex("by_spicerack_tournament_id", (q) =>
        q.eq("spicerackTournamentId", tournament.spicerackTournamentId!),
      )
      .filter((q) => q.eq(q.field("spicerackPlayerId"), args.spicerackPlayerId))
      .first();

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
