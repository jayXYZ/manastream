import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireOverlayAccess } from "../lib/auth";
import { overlayTemplatesValidator } from "../validators";

const MATCH_TEMPLATES = new Set([
  "Duress Crew",
  "Lobstercon",
  "Default",
  "Custom",
  "Arcade",
  "VHS",
  "Braun",
  "Braun Dark",
  "Topographic",
  "Brutalist",
]);

const COMMENTARY_TEMPLATES = new Set([
  "Duress Crew",
  "Lobstercon",
  "Default",
  "Custom",
  "Braun Dark",
  "Braun Dark Duo",
]);

const CARD_TEMPLATES = new Set(["Default", "Braun Dark"]);

export const setOverlayTemplate = mutation({
  args: {
    overlayId: v.id("overlays"),
    template: overlayTemplatesValidator,
  },
  handler: async (ctx, args) => {
    const { overlay } = await requireOverlayAccess(ctx, args.overlayId);

    if (overlay.overlayType === "match" && !MATCH_TEMPLATES.has(args.template)) {
      throw new Error("Template is not available for match overlays");
    }
    if (
      overlay.overlayType === "commentary" &&
      !COMMENTARY_TEMPLATES.has(args.template)
    ) {
      throw new Error("Template is not available for commentary overlays");
    }
    if (overlay.overlayType === "card" && !CARD_TEMPLATES.has(args.template)) {
      throw new Error("Template is not available for card overlays");
    }
    if (overlay.overlayType === "deck" || overlay.overlayType === "standings") {
      throw new Error(
        `Template updates are not supported for ${overlay.overlayType} overlays`,
      );
    }

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
