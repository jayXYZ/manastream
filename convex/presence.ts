import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const setConnectedLifeTracker = mutation({
  args: {
    overlayId: v.id("overlays"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    if (args.overlayId === "none") {
      return;
    }

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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }
    const connectedLifeTrackers = await ctx.db
      .query("connectedLifeTrackers")
      .withIndex("by_overlay", (q) => q.eq("overlayId", args.overlayId))
      .collect();

    return connectedLifeTrackers.length;
  },
});

export const getAllConnectedLifeTrackers = internalQuery({
  args: {},
  handler: async (ctx) => {
    const connectedLifeTrackers = await ctx.db
      .query("connectedLifeTrackers")
      .collect();
    return connectedLifeTrackers;
  },
});

export const cleanUpLifeTrackers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    // Get all connected life trackers
    const connectedLifeTrackers = await ctx.db
      .query("connectedLifeTrackers")
      .collect();
    // Filter out life trackers that have not been seen in the last 5 minutes
    const activeLifeTrackers = connectedLifeTrackers.filter(
      (tracker) => tracker.lastSeen > fiveMinutesAgo,
    );
    // Clean up stale life trackers
    const staleLifeTrackers = connectedLifeTrackers.filter(
      (tracker) => tracker.lastSeen < fiveMinutesAgo,
    );
    for (const tracker of staleLifeTrackers) {
      await ctx.db.delete(tracker._id);
    }
    return activeLifeTrackers;
  },
});
