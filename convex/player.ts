import { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  query,
  mutation,
} from "./_generated/server";
import { v } from "convex/values";
import { getOwnTournament } from "./lib/tournaments";

export const createPlayer = internalMutation({
  args: {
    spicerackTournamentId: v.number(),
    player: v.object({
      name: v.string(),
      spicerackPlayerId: v.number(),
      deckId: v.number(),
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
        deckName: v.string(),
        deckList: v.string(),
      }),
    ),
  },
  returns: v.array(v.object({ playerId: v.id("players"), deckId: v.number() })),
  handler: async (ctx, args) => {
    const playerIdsAndDeckIds: { playerId: Id<"players">; deckId: number }[] =
      [];
    for (let player of args.players) {
      const playerId = await ctx.db.insert("players", {
        name: player.name,
        spicerackTournamentId: player.spicerackTournamentId,
        spicerackPlayerId: player.spicerackPlayerId,
        deckId: player.deckId,
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
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (let player of args.players) {
      await ctx.db.patch(player.playerId, {
        deckName: player.deckName,
        deckList: player.deckList,
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
      updatedAt: Date.now(),
    });
  },
});
