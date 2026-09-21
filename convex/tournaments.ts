import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { filterUndefined } from "./lib/utils";
import { requireAuth, requireTournamentAccess } from "./lib/auth";
import { getOwnTournament } from "./lib/tournaments";
import { getUserSettings, hasMeleeCredentials } from "./lib/settings";
import { hasExternalTournamentChanged } from "./lib/pollingBehavior";
import { clearPollingSession } from "./lib/pollingSession";

export const createTournament = internalMutation({
  args: {
    externalTournamentId: v.optional(v.number()),
  },
  returns: v.id("tournaments"),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const tournamentId = await ctx.db.insert("tournaments", {
      userId: userId,
      mode: "manual",
      externalTournamentId: args.externalTournamentId,
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
  handler: async (ctx) => {
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

// unauthenticated for overlays to access timer, round, and commentator info
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
      eventName: tournament.eventName,
      currentRound: tournament.currentRound,
      currentRoundDisplayName: tournament.currentRoundDisplayName,
      manualTimerExpiry: tournament.manualTimerExpiry,
      manualTimerRunning: tournament.manualTimerRunning,
      manualTimerCountDirection: tournament.manualTimerCountDirection,
      // Commentator info for overlays
      commentatorLeft: tournament.commentatorLeft,
      commentatorLeftSubText: tournament.commentatorLeftSubText,
      commentatorRight: tournament.commentatorRight,
      commentatorRightSubText: tournament.commentatorRightSubText,
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
    await requireTournamentAccess(ctx, args.tournamentId);

    const { tournamentId, ...updateFields } = args;
    // Handle manualTimerPausedAt separately to allow clearing (null) or setting (number)
    const updates: {
      manualTimerExpiry?: number;
      manualTimerRunning?: boolean;
      manualTimerPausedAt?: number | null;
      manualTimerCountDirection?: "up" | "down";
    } = {};
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
    // Commentator info
    commentatorLeft: v.optional(v.string()),
    commentatorLeftSubText: v.optional(v.string()),
    commentatorRight: v.optional(v.string()),
    commentatorRightSubText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireTournamentAccess(ctx, args.tournamentId);

    const updates = filterUndefined({
      eventName: args.eventName,
      currentRoundDisplayName: args.currentRoundDisplayName,
      commentatorLeft: args.commentatorLeft,
      commentatorLeftSubText: args.commentatorLeftSubText,
      commentatorRight: args.commentatorRight,
      commentatorRightSubText: args.commentatorRightSubText,
    });

    await ctx.db.patch(args.tournamentId, updates);
  },
});

export const getActiveTournaments = internalQuery({
  args: {},
  returns: v.array(v.id("tournaments")),
  handler: async (ctx) => {
    const tournaments = await ctx.db
      .query("tournaments")
      .withIndex("by_mode_and_status", (q) =>
        q.eq("mode", "auto").eq("externalTournamentStatus", "active"),
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

    if (args.mode === "manual") {
      await ctx.db.patch(args.tournamentId, {
        mode: "manual",
        pollingStatus: "inactive",
      });
      await clearPollingSession(ctx, args.tournamentId);
      return;
    }

    // If switching to auto mode, check if polling is already active
    if (args.mode === "auto") {
      const tournament = await ctx.db.get(args.tournamentId);
      if (!tournament) {
        throw new Error("Tournament not found");
      }

      // Check if polling is already active to prevent duplicate polling sessions
      if (tournament.pollingStatus === "active") {
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
        internal.tournamentSync.validateAndStartPolling,
        { userId: userId },
      );
    }
  },
});

export const updateTournamentSettings = mutation({
  args: {
    externalTournamentId: v.optional(v.number()),
    mode: v.optional(v.union(v.literal("manual"), v.literal("auto"))),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const tournament = await getOwnTournament(ctx);
    const updates = filterUndefined(args);
    const externalTournamentChanged = hasExternalTournamentChanged({
      currentExternalTournamentId: tournament.externalTournamentId,
      requestedExternalTournamentId: updates.externalTournamentId,
    });
    const updatesWithSyncReset = externalTournamentChanged
      ? {
          ...updates,
          pollingStatus: "inactive" as const,
          pollingErrorMessage: undefined,
          currentRound: undefined,
          currentRoundDisplayName: undefined,
          // A player refresh in flight was for the previous Melee
          // tournament; its action sees the cleared state and does nothing.
          playerRefresh: undefined,
        }
      : updates;

    if (updates.mode === "auto") {
      const settings = await getUserSettings(ctx);
      if (!hasMeleeCredentials(settings)) {
        throw new Error("No Melee credentials found for user");
      }
      // Check the final value after update: use new value if provided, otherwise use existing value
      const finalExternalTournamentId =
        updates.externalTournamentId ?? tournament.externalTournamentId;
      if (!finalExternalTournamentId || finalExternalTournamentId === -1) {
        throw new Error("No Melee tournament ID found for tournament");
      }

      // Check if polling is already active to prevent duplicate polling sessions
      if (tournament.pollingStatus === "active" && !externalTournamentChanged) {
        // If already active, just update the settings without scheduling a new polling session
        await ctx.db.patch(tournament._id, updates);
        return;
      }

      await ctx.db.patch(tournament._id, updatesWithSyncReset);
      await clearPollingSession(ctx, tournament._id);
      await ctx.scheduler.runAfter(
        0,
        internal.tournamentSync.validateAndStartPolling,
        { userId: userId },
      );
    } else {
      await ctx.db.patch(tournament._id, {
        ...updatesWithSyncReset,
        ...(updates.mode === "manual"
          ? { pollingStatus: "inactive" as const }
          : {}),
      });
      if (externalTournamentChanged || updates.mode === "manual") {
        await clearPollingSession(ctx, tournament._id);
      }
    }
  },
});
