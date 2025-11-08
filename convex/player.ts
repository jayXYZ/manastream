import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const createPlayers = internalMutation({
  args: {
    players: v.array(
      v.object({
        tournamentId: v.id("tournaments"),
        name: v.string(),
        externalId: v.number(),
        deckId: v.number(),
        deckName: v.string(),
        deckList: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (let player of args.players) {
      await ctx.db.insert("players", {
        name: player.name,
        tournamentId: player.tournamentId,
        externalId: player.externalId,
        deckId: player.deckId,
        deckName: player.deckName,
        deckList: player.deckList,
        createdAt: Date.now(),
      });
    }
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
