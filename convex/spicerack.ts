// TODO
// create action to:
// - get tournament data from spicerack API
// - is tournament active?
// - find current round, check if round is active/pending/completed
// - get all featured matches in current round
// - upsert featured matches into database
// create helper functions to:
// - is it top 8?
// - get current phase
// - get current round/round name
// - get completed rounds
// - get standings
// - get all featured matches in current round
// - get player deck
// - get player seed

import { v } from "convex/values";
import { internalAction, internalQuery, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

export const toggleSpicerackPolling = mutation({
  args: {},
  handler: async (ctx) => {
    // authenticate user and get their user id
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Find the user's tournament
    const tournament = await ctx.db
      .query("tournaments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!tournament) {
      throw new Error("No tournament found for this user.");
    }

    // Find the user's settings
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!settings) {
      throw new Error("No settings found for this user.");
    }

    if (!settings.spicerackApiKey || !tournament.spicerackId) {
      return;
    }

    // Toggle the mode
    const newMode = tournament.mode === "auto" ? "manual" : "auto";

    await ctx.db.patch(tournament._id, { mode: newMode });

    // then start internal action to poll for tournament data if auto mode is enabled
    if (newMode === "auto") {
      await ctx.scheduler.runAfter(
        0,
        internal.spicerack.pollForTournamentData,
        {
          tournamentId: tournament._id,
        },
      );
    }

    return { newMode };
  },
});

export const pollForTournamentData = internalAction({
  args: { tournamentId: v.id("tournaments") },
  handler: async (ctx, args) => {
    const { tournament, settings, featureMatches } = await ctx.runQuery(
      internal.spicerack.getDataForPolling,
      { tournamentId: args.tournamentId },
    );
    if (tournament.mode === "manual") {
      return;
    }
    if (!tournament.spicerackId || !settings.spicerackApiKey) {
      throw new Error("Tournament or settings not found");
    }

    const url = "placeholder.com";
  },
});

export const getDataForPolling = internalQuery({
  args: { tournamentId: v.id("tournaments") },
  handler: async (ctx, args) => {
    const tournament = await ctx.db.get(args.tournamentId);

    if (!tournament) {
      throw new Error("Tournament not found");
    }

    const settings = await ctx.db
      .query("settings")
      .withIndex("by_user", (q) => q.eq("userId", tournament.userId))
      .unique();

    if (!settings) {
      throw new Error("Settings not found");
    }

    const currentRoundFeatureMatches = await ctx.db
      .query("featureMatches")
      .withIndex("by_tournament_and_round", (q) =>
        q
          .eq("tournamentId", args.tournamentId)
          .eq("roundNumber", tournament.currentRound),
      )
      .collect();

    return {
      tournament: tournament,
      settings: settings,
      featureMatches: currentRoundFeatureMatches,
    };
  },
});
// const url = "placeholder.com";
//     const response = await fetch(url, {
//       headers: {
//         "X-API-Key": args.spicerackApiKey,
//       },
//     });

//     const tournamentData = await response.json();

//     return tournamentData;
