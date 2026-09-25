import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireOverlayAccess } from "./lib/auth";
import {
  deleteStaleLifeTrackersBatch,
  LIFE_TRACKER_TIMEOUT_MS,
  MAX_COUNTED_LIFE_TRACKERS,
} from "./lib/presence";

export const setConnectedLifeTracker = mutation({
  args: {
    overlayId: v.id("overlays"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    // Only the overlay's owner may register a life tracker against it.
    const { userId } = await requireOverlayAccess(ctx, args.overlayId);

    const existing = await ctx.db
      .query("connectedLifeTrackers")
      .withIndex("by_user_and_session", (q) =>
        q.eq("userId", userId).eq("sessionId", args.sessionId),
      )
      .first();

    if (existing && existing.overlayId === args.overlayId) {
      await ctx.db.patch(existing._id, {
        lastSeen: Date.now(),
      });
      return;
    } else if (existing) {
      await ctx.db.patch(existing._id, {
        overlayId: args.overlayId,
        lastSeen: Date.now(),
      });
      return;
    }

    // Only insert if no existing entry was found
    await ctx.db.insert("connectedLifeTrackers", {
      userId: userId,
      overlayId: args.overlayId,
      sessionId: args.sessionId,
      lastSeen: Date.now(),
      createdAt: Date.now(),
    });
  },
});

export const disconnectLifeTracker = mutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }
    const existing = await ctx.db
      .query("connectedLifeTrackers")
      .withIndex("by_user_and_session", (q) =>
        q.eq("userId", userId).eq("sessionId", args.sessionId),
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const getConnectedLifeTrackers = query({
  args: { overlayId: v.id("overlays") },
  returns: v.number(),
  handler: async (ctx, args) => {
    await requireOverlayAccess(ctx, args.overlayId);
    // Abandoned rows are removed by the `cleanUpLifeTrackers` cron (within
    // one timeout plus one cron interval), so rows under this overlay are
    // tabs that heartbeated recently. The read is bounded because the UI
    // only distinguishes none / one / several.
    const connectedLifeTrackers = await ctx.db
      .query("connectedLifeTrackers")
      .withIndex("by_overlay", (q) => q.eq("overlayId", args.overlayId))
      .take(MAX_COUNTED_LIFE_TRACKERS);

    return connectedLifeTrackers.length;
  },
});

/**
 * Delete life-tracker rows whose heartbeat stopped more than
 * `LIFE_TRACKER_TIMEOUT_MS` ago (closed tabs whose unload handler never
 * fired). Registered in `crons.ts`; deletes one indexed batch per
 * transaction and reschedules itself while more stale rows remain.
 */
export const cleanUpLifeTrackers = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - LIFE_TRACKER_TIMEOUT_MS;

    const hasMore = await deleteStaleLifeTrackersBatch(ctx, cutoff);
    if (hasMore) {
      await ctx.scheduler.runAfter(
        0,
        internal.presence.cleanUpLifeTrackers,
        {},
      );
    }
    return null;
  },
});
