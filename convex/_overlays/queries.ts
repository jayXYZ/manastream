import { QueryCtx } from "../_generated/server";
import { query } from "../_generated/server";
import { v } from "convex/values";
import { Doc } from "../_generated/dataModel";
import { requireOverlayAccess } from "../lib/auth";
import { getOwnTournament } from "../lib/tournaments";
import {
  getOverlayByIdValidator,
  getOverlayByUuidValidator,
  overlayValidator,
} from "../validators";
import {
  getTournamentTimerAndRoundInfo,
  requireUserTournament,
} from "../lib/tournaments";
import { getPlayersForMatch } from "../lib/players";

/**
 * Helper function to enrich a match overlay with player data and tournament timer info.
 */
async function enrichMatchOverlay(
  ctx: QueryCtx,
  overlay: Doc<"overlays"> & { overlayType: "match" },
) {
  const { manualTimerExpiry, manualTimerRunning } =
    await getTournamentTimerAndRoundInfo(ctx, overlay.tournamentId);

  const { player1Data, player2Data } = await getPlayersForMatch(
    ctx,
    overlay.player1,
    overlay.player2,
  );

  return {
    ...overlay,
    player1Data,
    player2Data,
    manualTimerExpiry,
    manualTimerRunning,
  };
}

/**
 * Helper function to enrich a deck overlay with feature match data.
 */
async function enrichDeckOverlay(
  ctx: QueryCtx,
  overlay: Doc<"overlays"> & { overlayType: "deck" },
) {
  if (!overlay.matchId) {
    throw new Error("Match ID not found for deck overlay");
  }
  const featureMatch = await ctx.db.get(overlay.matchId);
  if (!featureMatch) {
    throw new Error("Feature match not found for deck overlay");
  }
  const [player1, player2] = await Promise.all([
    ctx.db.get(featureMatch.player1),
    ctx.db.get(featureMatch.player2),
  ]);

  if (!player1 || !player2) {
    throw new Error("Player not found for feature match in deck overlay");
  }
  return {
    ...overlay,
    matchData: {
      ...featureMatch,
      player1Data: player1,
      player2Data: player2,
    },
  };
}

/**
 * Helper function to enrich an overlay based on its type.
 * Returns the enriched overlay if it needs enrichment, otherwise returns the original overlay.
 */
async function enrichOverlay(
  ctx: QueryCtx,
  overlay: Doc<"overlays">,
): Promise<any> {
  if (overlay.overlayType === "match") {
    return await enrichMatchOverlay(ctx, overlay);
  }

  if (overlay.overlayType === "deck") {
    return await enrichDeckOverlay(ctx, overlay);
  }

  return overlay;
}

export const getUserOverlays = query({
  args: {},
  returns: v.array(overlayValidator),
  handler: async (ctx) => {
    const tournament = await getOwnTournament(ctx);
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
    const overlay = await ctx.db
      .query("overlays")
      .withIndex("by_public_uuid", (q) => q.eq("publicUuid", args.publicUuid))
      .unique();

    if (!overlay) {
      return null;
    }

    return await enrichOverlay(ctx, overlay);
  },
});
