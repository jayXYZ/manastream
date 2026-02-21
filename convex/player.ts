import { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  query,
  mutation,
} from "./_generated/server";
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
    return await ctx.db.insert("players", {
      name: args.player.name,
      spicerackTournamentId: args.spicerackTournamentId,
      spicerackPlayerId: args.player.spicerackPlayerId,
      deckId: args.player.deckId,
      decklistStatus: args.player.decklistStatus,
      deckName: args.player.deckName,
      deckList: args.player.deckList,
      updatedAt: Date.now(),
    });
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
    for (const player of args.players) {
      const playerId = await ctx.db.insert("players", {
        name: player.name,
        spicerackTournamentId: player.spicerackTournamentId,
        spicerackPlayerId: player.spicerackPlayerId,
        deckId: player.deckId,
        decklistStatus: player.decklistStatus,
        deckName: player.deckName,
        deckList: player.deckList,
        updatedAt: Date.now(),
      });
      playerIdsAndDeckIds.push({ playerId, deckId: player.deckId });
    }
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
    for (const player of args.players) {
      await ctx.db.patch(player.playerId, {
        deckName: player.deckName,
        deckList: player.deckList,
        ...(player.deckId !== undefined && { deckId: player.deckId }),
        ...(player.decklistStatus !== undefined && {
          decklistStatus: player.decklistStatus,
        }),
      });
    }
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
      updatedAt: Date.now(),
    });
  },
});
