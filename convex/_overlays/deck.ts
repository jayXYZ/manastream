import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { requireDeckOverlayAccess } from "../lib/auth";
import { createDeckOverlayHelper } from "../lib/overlays";
import { filterUndefined } from "../lib/utils";
import {
  braunDarkPaletteValidator,
  deckTemplatesValidator,
} from "../validators";

/**
 * Internal mutation to create a deck overlay.
 * Used by other mutations and initialization logic.
 */
export const internalCreateDeckOverlay = internalMutation({
  args: {
    tournamentId: v.id("tournaments"),
    name: v.string(),
  },
  returns: v.object({
    overlayId: v.id("overlays"),
    publicUuid: v.string(),
  }),
  handler: async (ctx, args) => {
    return await createDeckOverlayHelper(ctx, args.tournamentId, args.name);
  },
});

/**
 * Public mutation to update a deck overlay.
 * Requires authentication and tournament access.
 */
export const updateDeckOverlay = mutation({
  args: {
    overlayId: v.id("overlays"),
    matchId: v.optional(v.id("featureMatches")),
  },
  handler: async (ctx, args) => {
    const { overlay } = await requireDeckOverlayAccess(ctx, args.overlayId);

    await ctx.db.patch(overlay._id, {
      matchId: args.matchId,
    });
  },
});

export const setDeckOverlaySettings = mutation({
  args: {
    overlayId: v.id("overlays"),
    name: v.optional(v.string()),
    template: v.optional(deckTemplatesValidator),
    braunDarkPalette: v.optional(braunDarkPaletteValidator),
  },
  handler: async (ctx, args) => {
    await requireDeckOverlayAccess(ctx, args.overlayId);
    const { overlayId, ...updateFields } = args;
    const updates = filterUndefined(updateFields);

    await ctx.db.patch(overlayId, updates);
  },
});
