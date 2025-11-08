import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { filterUndefined } from "./lib/utils";
import { requireAuth, requireTournamentAccess } from "./lib/auth";
import { getOwnTournament } from "./lib/tournaments";
import { getUserSettings } from "./lib/settings";

export const createTournament = internalMutation({
  args: {
    spicerackTournamentId: v.optional(v.number()),
  },
  returns: v.id("tournaments"),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const tournamentId = await ctx.db.insert("tournaments", {
      userId: userId,
      mode: "manual",
      spicerackTournamentId: args.spicerackTournamentId,
      spicerackCurrentRoundId: -1,
      spicerackCurrentRoundNumber: -1,
      manualTimerRunning: false,
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
    return await getOwnTournament(ctx);
  },
});

// TODO: this doesn't seem to be used anywhere
export const getTournament = query({
  args: { tournamentId: v.id("tournaments") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await requireTournamentAccess(ctx, args.tournamentId);
  },
});

// unauthenticated for overlays to access timer and round info
// This is a duplicate function to the /lib/tournaments.ts function getTournamentTimerAndRoundInfo
export const getTournamentInfo = query({
  args: { tournamentId: v.id("tournaments") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const tournament = await ctx.db.get(args.tournamentId);
    if (!tournament) {
      return null;
    }

    return {
      currentRound: tournament.spicerackCurrentRoundNumber,
      currentRoundDisplayName: tournament.currentRoundDisplayName,
      manualTimerExpiry: tournament.manualTimerExpiry,
      manualTimerRunning: tournament.manualTimerRunning,
      manualTimerCountDirection: tournament.manualTimerCountDirection,
    };
  },
});

export const setTournamentTimer = mutation({
  args: {
    tournamentId: v.id("tournaments"),
    manualTimerExpiry: v.optional(v.number()),
    manualTimerRunning: v.optional(v.boolean()),
    manualTimerPausedAt: v.optional(v.union(v.number(), v.null())),
    manualTimerCountDirection: v.optional(
      v.union(v.literal("up"), v.literal("down")),
    ),
  },
  handler: async (ctx, args) => {
    const tournament = await requireTournamentAccess(ctx, args.tournamentId);

    const { tournamentId, ...updateFields } = args;
    // Handle manualTimerPausedAt separately to allow clearing (null) or setting (number)
    const updates: Record<string, any> = {};
    if (updateFields.manualTimerExpiry !== undefined) {
      updates.manualTimerExpiry = updateFields.manualTimerExpiry;
    }
    if (updateFields.manualTimerRunning !== undefined) {
      updates.manualTimerRunning = updateFields.manualTimerRunning;
    }
    if (updateFields.manualTimerPausedAt !== undefined) {
      // null means clear the field, number means set it
      updates.manualTimerPausedAt = updateFields.manualTimerPausedAt;
    }
    if (updateFields.manualTimerCountDirection !== undefined) {
      updates.manualTimerCountDirection =
        updateFields.manualTimerCountDirection;
    }
    await ctx.db.patch(tournamentId, updates);
  },
});

export const updateTournamentInfo = mutation({
  args: {
    tournamentId: v.id("tournaments"),
    eventName: v.optional(v.string()),
    currentRoundDisplayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const tournament = await requireTournamentAccess(ctx, args.tournamentId);

    await ctx.db.patch(args.tournamentId, {
      eventName: args.eventName,
      currentRoundDisplayName: args.currentRoundDisplayName,
    });
  },
});

export const getActiveTournaments = internalQuery({
  args: {},
  returns: v.array(v.id("tournaments")),
  handler: async (ctx) => {
    const tournaments = await ctx.db
      .query("tournaments")
      .withIndex("by_mode_and_status", (q) =>
        q.eq("mode", "auto").eq("spicerackTournamentStatus", "active"),
      )
      .collect();
    const tournamentIdArray = tournaments.map((tournament) => tournament._id);
    return tournamentIdArray;
  },
});

// is this function necessary along with updateTournamentSettings?
export const updateTournamentMode = mutation({
  args: {
    tournamentId: v.id("tournaments"),
    mode: v.union(v.literal("manual"), v.literal("auto")),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireTournamentAccess(ctx, args.tournamentId);

    // If switching to auto mode, check if polling is already active
    if (args.mode === "auto") {
      const tournament = await ctx.db.get(args.tournamentId);
      if (!tournament) {
        throw new Error("Tournament not found");
      }

      // Check if polling is already active to prevent duplicate polling sessions
      if (tournament.spicerackPollingStatus === "active") {
        // If already active, just update the mode without scheduling a new polling session
        await ctx.db.patch(args.tournamentId, {
          mode: args.mode,
        });
        return;
      }
    }

    await ctx.db.patch(args.tournamentId, {
      mode: args.mode,
    });

    // If switching to auto mode, start validation and polling
    if (args.mode === "auto") {
      await ctx.scheduler.runAfter(
        0,
        internal.spicerack.validateAndStartPolling,
        { tournamentId: args.tournamentId, userId },
      );
    }
  },
});

export const updateTournamentSettings = mutation({
  args: {
    spicerackTournamentId: v.optional(v.number()),
    mode: v.optional(v.union(v.literal("manual"), v.literal("auto"))),
  },
  handler: async (ctx, args) => {
    const tournament = await getOwnTournament(ctx);
    const updates = filterUndefined(args);

    if (updates.mode === "auto") {
      const settings = await getUserSettings(ctx);
      if (!settings.spicerackApiKey) {
        throw new Error("No Spicerack API key found for user");
      }
      // Check the final value after update: use new value if provided, otherwise use existing value
      const finalSpicerackTournamentId =
        updates.spicerackTournamentId ?? tournament.spicerackTournamentId;
      if (!finalSpicerackTournamentId || finalSpicerackTournamentId === -1) {
        throw new Error("No Spicerack tournament ID found for tournament");
      }

      // Check if polling is already active to prevent duplicate polling sessions
      if (tournament.spicerackPollingStatus === "active") {
        // If already active, just update the settings without scheduling a new polling session
        await ctx.db.patch(tournament._id, updates);
        return;
      }

      await ctx.db.patch(tournament._id, updates);
      await ctx.scheduler.runAfter(
        0,
        internal.spicerack.validateAndStartPolling,
        { tournamentId: tournament._id, userId: tournament.userId },
      );
    } else {
      await ctx.db.patch(tournament._id, updates);
    }
  },
});
