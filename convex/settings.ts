import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import { spicerackLogValidator } from "./validators";
import { getUserSettings } from "./lib/settings";

export const getSettings = query({
  args: {},
  returns: v.object({
    spicerackApiKey: v.string(),
  }),
  handler: async (ctx) => {
    const settings = await getUserSettings(ctx);
    return {
      spicerackApiKey: settings.spicerackApiKey ?? "",
    };
  },
});

export const getSpicerackLogs = query({
  args: {},
  returns: v.array(spicerackLogValidator),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const logs = await ctx.db
      .query("spicerackLogs")
      .withIndex("by_user", (q) => q.eq("userId", user))
      .order("desc")
      .take(100); // Limit to most recent 100 logs
    return logs;
  },
});

export const updateSettings = mutation({
  args: {
    spicerackApiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const settings = await getUserSettings(ctx);
    await ctx.db.patch(settings._id, {
      spicerackApiKey: args.spicerackApiKey,
      updatedAt: Date.now(),
    });
  },
});

export const internalCreateSettings = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("settings", {
      userId: args.userId,
      spicerackApiKey: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Internal mutation to clean up spicerack logs older than a week
 * Called by cron job to automatically remove old log entries
 */
export const cleanupOldSpicerackLogs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

    // Query all spicerack logs
    const allLogs = await ctx.db.query("spicerackLogs").collect();

    // Filter logs older than one week
    const logsToDelete = allLogs.filter((log) => log.timestamp < oneWeekAgo);

    // Delete old logs
    for (const log of logsToDelete) {
      await ctx.db.delete(log._id);
    }
  },
});
