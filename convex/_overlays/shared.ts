import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireOverlayAccess } from "../lib/auth";
import { availableTemplatesValidator } from "../validators";

// This will need to be broken up as soon as the available templates
// for different overlay types are not the same
export const setOverlayTemplate = mutation({
  args: {
    overlayId: v.id("overlays"),
    template: availableTemplatesValidator,
  },
  handler: async (ctx, args) => {
    await requireOverlayAccess(ctx, args.overlayId);

    await ctx.db.patch(args.overlayId, {
      template: args.template,
    });
  },
});

export const deleteOverlay = mutation({
  args: {
    overlayId: v.id("overlays"),
  },
  handler: async (ctx, args) => {
    await requireOverlayAccess(ctx, args.overlayId);

    await ctx.db.delete(args.overlayId);
  },
});
