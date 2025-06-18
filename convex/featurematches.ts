import { query } from "./_generated/server";
import { v } from "convex/values";
import {
  featureMatchValidator,
  featureMatchWithPlayersValidator,
} from "./validators";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getFeatureMatches = query({
  args: {},
  returns: v.array(featureMatchValidator),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("User not authenticated");
    }
    // Find the user's tournament (assuming 1 tournament per user)
    const tournament = await ctx.db
      .query("tournaments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!tournament) {
      return [];
    }
    const featureMatches = await ctx.db
      .query("featureMatches")
      .withIndex("by_tournament_and_round", (q) =>
        q.eq("tournamentId", tournament._id),
      )
      .collect();
    return featureMatches;
  },
});

export const getCurrentRoundFeatureMatches = query({
  args: {},
  returns: v.array(featureMatchWithPlayersValidator),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }
    const tournament = await ctx.db
      .query("tournaments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!tournament) {
      return [];
    }
    const currentRound = tournament.currentRound;

    const featureMatches = await ctx.db
      .query("featureMatches")
      .withIndex("by_tournament_and_round", (q) =>
        q.eq("tournamentId", tournament._id).eq("roundNumber", currentRound),
      )
      .collect();

    const featureMatchesWithPlayerData = await Promise.all(
      featureMatches.map(async (match) => {
        const player1 = await ctx.db
          .query("players")
          .withIndex("by_id", (q) => q.eq("_id", match.player1))
          .unique();
        const player2 = await ctx.db
          .query("players")
          .withIndex("by_id", (q) => q.eq("_id", match.player2))
          .unique();

        if (!player1 || !player2) {
          return null;
        }

        return { ...match, player1Data: player1, player2Data: player2 };
      }),
    );

    return featureMatchesWithPlayerData.filter((match) => match !== null);
  },
});
