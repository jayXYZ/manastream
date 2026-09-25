import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import { requireOverlayAccess } from "../lib/auth";
import { getOptionalOwnTournament } from "../lib/tournaments";
import {
  getOverlayByIdValidator,
  getOverlayByUuidValidator,
  overlayValidator,
} from "../validators";
import {
  enrichOverlay,
  getEnrichedOverlayByPublicUuid,
} from "../lib/overlays";

export const getUserOverlays = query({
  args: {},
  returns: v.array(overlayValidator),
  handler: async (ctx) => {
    const tournament = await getOptionalOwnTournament(ctx);
    if (!tournament) {
      // Signed out or not initialized yet: nothing to list, not an error.
      return [];
    }
    // Fetch overlays for that tournament
    const overlays = await ctx.db
      .query("overlays")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournament._id))
      .collect();

    return overlays;
  },
});

export const getOverlayById = query({
  args: {
    overlayId: v.id("overlays"),
  },
  returns: getOverlayByIdValidator,
  handler: async (ctx, args) => {
    const { overlay } = await requireOverlayAccess(ctx, args.overlayId);

    return await enrichOverlay(ctx, overlay);
  },
});

export const getOverlayByUuid = query({
  args: {
    publicUuid: v.string(),
  },
  returns: getOverlayByUuidValidator,
  handler: async (ctx, args) => {
    return await getEnrichedOverlayByPublicUuid(ctx, args.publicUuid);
  },
});

/**
 * Internal twin of `getOverlayByUuid` for the `/api/overlay/:uuid` HTTP route
 * in `convex/http.ts`, so the route is not coupled to the public API surface.
 */
export const getOverlayByUuidInternal = internalQuery({
  args: {
    publicUuid: v.string(),
  },
  returns: getOverlayByUuidValidator,
  handler: async (ctx, args) => {
    return await getEnrichedOverlayByPublicUuid(ctx, args.publicUuid);
  },
});
