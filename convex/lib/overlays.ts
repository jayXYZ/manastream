import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { getPlayersForMatch } from "./players";
import { getTournamentTimerAndRoundInfo } from "./tournaments";
import { generatePublicUuid } from "./utils";

// Creation functions

/**
 * Helper function to create a card overlay.
 * Shared logic for both internal and public mutations.
 */
export async function createCardOverlayHelper(
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
 * Helper function to create a commentary overlay.
 * Shared logic for both internal and public mutations.
 */
export async function createCommentaryOverlayHelper(
  ctx: MutationCtx,
  tournamentId: Id<"tournaments">,
  name: string,
): Promise<{ overlayId: Id<"overlays">; publicUuid: string }> {
  const publicUuid = generatePublicUuid();

  const overlayId = await ctx.db.insert("overlays", {
    name,
    overlayType: "commentary",
    tournamentId,
    publicUuid,
    template: "Default",
    templateId: undefined,
    commentatorLeft: "Commentator Left",
    commentatorLeftSubText: undefined,
    commentatorRight: "Commentator Right",
    commentatorRightSubText: undefined,
    createdAt: Date.now(),
  });

  return { overlayId, publicUuid };
}

/**
 * Helper function to create a deck overlay.
 * Shared logic for both internal and public mutations.
 */
export async function createDeckOverlayHelper(
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
 * Helper function to create a match overlay.
 * Shared logic for both internal and public mutations.
 */
export async function createMatchOverlayHelper(
  ctx: MutationCtx,
  tournamentId: Id<"tournaments">,
  name: string,
): Promise<{ overlayId: Id<"overlays">; publicUuid: string }> {
  const publicUuid = generatePublicUuid();

  const overlayId = await ctx.db.insert("overlays", {
    name,
    overlayType: "match",
    template: "Default",
    templateId: undefined,
    tournamentId,
    publicUuid,
    player1: undefined,
    player2: undefined,
    player1Life: 20,
    player2Life: 20,
    player1GamesWon: 0,
    player2GamesWon: 0,
    createdAt: Date.now(),
  });

  return { overlayId, publicUuid };
}

// Enrichment functions

/**
 * Helper function to enrich a match overlay with player data and tournament timer info.
 */
export async function enrichMatchOverlay(
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
 * Returns the overlay unchanged if matchId is not set.
 */
export async function enrichDeckOverlay(
  ctx: QueryCtx,
  overlay: Doc<"overlays"> & { overlayType: "deck" },
) {
  if (!overlay.matchId) {
    // Return overlay without enrichment if matchId is not set
    return overlay;
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
export async function enrichOverlay(
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

/**
 * Helper function to initialize default overlays and settings for a new user.
 * Creates 3 match overlays, 1 card overlay, 1 commentary overlay, 1 deck overlay, and default settings.
 */
export async function initializeNewUserOverlays(
  ctx: MutationCtx,
  tournamentId: Id<"tournaments">,
  userId: Id<"users">,
): Promise<void> {
  // Create 3 match overlays
  await createMatchOverlayHelper(ctx, tournamentId, "Match Overlay 1");
  await createMatchOverlayHelper(ctx, tournamentId, "Match Overlay 2");
  await createMatchOverlayHelper(ctx, tournamentId, "Match Overlay 3");

  // Create a card overlay
  await createCardOverlayHelper(ctx, tournamentId, "Card Overlay");

  // Create a commentary overlay
  await createCommentaryOverlayHelper(ctx, tournamentId, "Commentary Overlay");

  // Create a deck overlay
  await createDeckOverlayHelper(ctx, tournamentId, "Deck Overlay");

  // Create default settings for the new user
  await ctx.db.insert("settings", {
    userId,
    spicerackApiKey: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}
