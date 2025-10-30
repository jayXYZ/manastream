import { mutation, internalMutation, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { requireCardOverlayAccess, requireTournamentAccess } from "../lib/auth";
import { generatePublicUuid } from "../lib/utils";

/**
 * Helper function to create a card overlay.
 * Shared logic for both internal and public mutations.
 */
async function createCardOverlayHelper(
  ctx: MutationCtx,
  tournamentId: Id<"tournaments">,
  name: string,
): Promise<{ overlayId: Id<"overlays">; publicUuid: string }> {
  const publicUuid = generatePublicUuid();

  const overlayId = await ctx.db.insert("overlays", {
    name,
    overlayType: "card",
    tournamentId,
    publicUuid,
    cardUrl:
      "https://cards.scryfall.io/png/front/c/a/ca367f49-0f4a-4b7f-8104-851893fbcd8a.png?1562937711",
    createdAt: Date.now(),
  });

  return { overlayId, publicUuid };
}

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
  handler: async (ctx, args) => {
    const { overlay } = await requireCardOverlayAccess(ctx, args.overlayId);

    await ctx.db.patch(overlay._id, {
      cardUrl: args.cardUrl,
    });
  },
});
