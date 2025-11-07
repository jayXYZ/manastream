import { mutation, internalMutation, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { requireDeckOverlayAccess, requireTournamentAccess } from "../lib/auth";
import { generatePublicUuid } from "../lib/utils";

/**
 * Helper function to create a deck overlay.
 * Shared logic for both internal and public mutations.
 */
async function createDeckOverlayHelper(
  ctx: MutationCtx,
  tournamentId: Id<"tournaments">,
  name: string,
): Promise<{ overlayId: Id<"overlays">; publicUuid: string }> {
  const publicUuid = generatePublicUuid();

  const overlayId = await ctx.db.insert("overlays", {
    name,
    overlayType: "deck",
    tournamentId,
    publicUuid,
    matchId: undefined,
    createdAt: Date.now(),
  });

  return { overlayId, publicUuid };
}

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
