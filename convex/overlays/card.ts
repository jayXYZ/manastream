import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { requireCardOverlayAccess, requireTournamentAccess } from "../lib/auth";
import { createCardOverlayHelper } from "../lib/overlays";
import { filterUndefined } from "../lib/utils";
import {
  braunDarkPaletteValidator,
  cardTemplatesValidator,
} from "../validators";

/**
 * Internal mutation to create a card overlay.
 * Used by other mutations and initialization logic.
 */
export const internalCreateCardOverlay = internalMutation({
  args: {
    tournamentId: v.id("tournaments"),
    name: v.string(),
  },
  returns: v.object({
    overlayId: v.id("overlays"),
    publicUuid: v.string(),
  }),
  handler: async (ctx, args) => {
    return await createCardOverlayHelper(ctx, args.tournamentId, args.name);
  },
});

/**
 * Public mutation to create a card overlay.
 * Requires authentication and tournament access.
 */
export const createCardOverlay = mutation({
  args: {
    tournamentId: v.id("tournaments"),
    name: v.string(),
  },
  returns: v.object({
    overlayId: v.id("overlays"),
    publicUuid: v.string(),
  }),
  handler: async (ctx, args) => {
    const { tournament } = await requireTournamentAccess(
      ctx,
      args.tournamentId,
    );

    return await createCardOverlayHelper(ctx, tournament._id, args.name);
  },
});

export const updateCardOverlay = mutation({
  args: {
    overlayId: v.id("overlays"),
    cardUrl: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { overlay } = await requireCardOverlayAccess(ctx, args.overlayId);

    await ctx.db.patch(overlay._id, {
      cardUrl: args.cardUrl,
    });
    return null;
  },
});

export const setCardOverlaySettings = mutation({
  args: {
    overlayId: v.id("overlays"),
    name: v.optional(v.string()),
    template: v.optional(cardTemplatesValidator),
    braunDarkPalette: v.optional(braunDarkPaletteValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireCardOverlayAccess(ctx, args.overlayId);
    const { overlayId, ...updateFields } = args;
    const updates = filterUndefined(updateFields);

    await ctx.db.patch(overlayId, updates);
    return null;
  },
});
