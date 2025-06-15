import { mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const createTournament = mutation({
  args: {
    spicerackId: v.optional(v.number()),
  },
  returns: v.id("tournaments"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }
    const tournamentId = ctx.db.insert("tournaments", {
      userId,
      mode: "manual",
      spicerackId: args.spicerackId,
      currentRound: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return tournamentId;
  },
});

export const getUserTournament = query({
  args: {},
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    return ctx.db
      .query("tournaments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const getTournament = query({
  args: { tournamentId: v.id("tournaments") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const tournament = await ctx.db.get(args.tournamentId);

    // Only return if user owns this tournament
    if (!tournament || tournament.userId !== userId) {
      return null;
    }

    return tournament;
  },
});
