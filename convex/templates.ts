import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const defaultTemplate = {
  objects: [],
};

export const createTemplate = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const templateId = await ctx.db.insert("templates", {
      userId,
      name: args.name,
      template: defaultTemplate,
      createdAt: Date.now(),
    });
    return templateId;
  },
});

// Save template to overlay
export const setOverlayTemplate = mutation({
  args: {
    templateId: v.id("templates"),
    template: v.any(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const canvasJson = args.template;

    await ctx.db.patch(args.templateId, {
      template: canvasJson,
    });
    return null;
  },
});

// get template by id
export const getTemplateById = query({
  args: {
    templateId: v.id("templates"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.templateId);
  },
});
