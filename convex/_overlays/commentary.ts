import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import {
  requireCommentaryOverlayAccess,
  requireTournamentAccess,
} from "../lib/auth";
import { availableTemplatesValidator } from "../validators";
import { filterUndefined } from "../lib/utils";
import { createCommentaryOverlayHelper } from "../lib/overlays";

/**
 * Internal mutation to create a commentary overlay.
 * Used by other mutations and initialization logic.
 */
export const internalCreateCommentaryOverlay = internalMutation({
  args: {
    tournamentId: v.id("tournaments"),
    name: v.string(),
  },
  returns: v.object({
    overlayId: v.id("overlays"),
    publicUuid: v.string(),
  }),
  handler: async (ctx, args) => {
    return await createCommentaryOverlayHelper(
      ctx,
      args.tournamentId,
      args.name,
    );
  },
});

/**
 * Public mutation to create a commentary overlay.
 * Requires authentication and tournament access.
 */
export const createCommentaryOverlay = mutation({
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

    return await createCommentaryOverlayHelper(ctx, tournament._id, args.name);
  },
});

export const updateCommentaryOverlay = mutation({
  args: {
    overlayId: v.id("overlays"),
    commentatorLeft: v.optional(v.string()),
    commentatorLeftSubText: v.optional(v.string()),
    commentatorRight: v.optional(v.string()),
    commentatorRightSubText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireCommentaryOverlayAccess(ctx, args.overlayId);
    const { overlayId, ...updateFields } = args;
    const updates = filterUndefined(updateFields);

    await ctx.db.patch(args.overlayId, updates);
  },
});

export const setCommentaryOverlaySettings = mutation({
  args: {
    overlayId: v.id("overlays"),
    name: v.optional(v.string()),
    template: v.optional(availableTemplatesValidator),
  },
  handler: async (ctx, args) => {
    await requireCommentaryOverlayAccess(ctx, args.overlayId);

    const { overlayId, ...updateFields } = args;
    const updates = filterUndefined(updateFields);

    await ctx.db.patch(overlayId, updates);
  },
});
