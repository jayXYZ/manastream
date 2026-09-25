import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth } from "./lib/auth";
import { integrationLogValidator } from "./validators";
import {
  getMeleeCredentialsFromSettings,
  getUserSettings,
} from "./lib/settings";
import { deleteOldIntegrationLogsBatch } from "./lib/logging";

export const getSettings = query({
  args: {},
  returns: v.object({
    meleeClientId: v.string(),
    // The secret itself is never sent to the client; only whether one is set.
    hasMeleeClientSecret: v.boolean(),
  }),
  handler: async (ctx) => {
    const settings = await getUserSettings(ctx);
    const credentials = getMeleeCredentialsFromSettings(settings);
    return {
      meleeClientId: credentials.clientId,
      hasMeleeClientSecret: credentials.clientSecret.length > 0,
    };
  },
});

export const getIntegrationLogs = query({
  args: {},
  returns: v.array(integrationLogValidator),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const logs = await ctx.db
      .query("integrationLogs")
      .withIndex("by_user", (q) => q.eq("userId", user))
      .order("desc")
      .take(100); // Limit to most recent 100 logs
    return logs;
  },
});

export const updateSettings = mutation({
  args: {
    meleeClientId: v.string(),
    // Omitted when the user hasn't entered a new secret, so the stored one is kept.
    meleeClientSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const settings = await getUserSettings(ctx);
    await ctx.db.patch(settings._id, {
      meleeClientId: args.meleeClientId,
      ...(args.meleeClientSecret !== undefined
        ? { meleeClientSecret: args.meleeClientSecret }
        : {}),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const internalCreateSettings = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("settings", {
      userId: args.userId,
      meleeClientId: "",
      meleeClientSecret: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Internal mutation to clean up integration logs older than a few days
 * Called by cron job to automatically remove old log entries
 */
export const cleanupOldIntegrationLogs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

    const hasMore = await deleteOldIntegrationLogsBatch(ctx, cutoff);
    if (hasMore) {
      await ctx.scheduler.runAfter(
        0,
        internal.settings.cleanupOldIntegrationLogs,
        {},
      );
    }
  },
});
