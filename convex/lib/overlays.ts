import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import type { Infer } from "convex/values";
import type { getOverlayByIdValidator } from "../validators";
import { getPlayerData } from "./playerData";
import { getCurrentRoundPairingsWithPlayerData } from "./pairings";
import { getPlayersForMatch } from "./players";
import { getTournamentTimerAndRoundInfo } from "./tournaments";
import { generatePublicUuid } from "./utils";

const ELIMINATION_ROUND_NAMES = new Set([
  "Quarterfinals",
  "Semifinals",
  "Finals",
]);

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
    braunDarkPalette: "Dark",
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
    braunDarkPalette: "Dark",
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
    template: "Duress Crew",
    braunDarkPalette: "Dark",
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
    braunDarkPalette: "Dark",
    tournamentId,
    publicUuid,
    player1: undefined,
    player2: undefined,
    player1Life: 20,
    player2Life: 20,
    player1GamesWon: 0,
    player2GamesWon: 0,
    player1Lc26BackgroundColor: undefined,
    player2Lc26BackgroundColor: undefined,
    createdAt: Date.now(),
  });

  return { overlayId, publicUuid };
}

export async function createStandingsOverlayHelper(
  ctx: MutationCtx,
  tournamentId: Id<"tournaments">,
  name: string,
): Promise<{ overlayId: Id<"overlays">; publicUuid: string }> {
  const publicUuid = generatePublicUuid();

  const overlayId = await ctx.db.insert("overlays", {
    name,
    overlayType: "standings",
    tournamentId,
    publicUuid,
    braunDarkPalette: "Dark",
    roundStandingsId: undefined,
    spicerackRoundId: undefined,
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
 * Always returns matchData field (null if matchId is not set).
 */
export async function enrichDeckOverlay(
  ctx: QueryCtx,
  overlay: Doc<"overlays"> & { overlayType: "deck" },
) {
  if (!overlay.matchId) {
    // Return overlay with matchData set to null if matchId is not set
    return {
      ...overlay,
      matchData: null,
    };
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
      player1Data: await getPlayerData(ctx, player1),
      player2Data: await getPlayerData(ctx, player2),
    },
  };
}

export async function enrichStandingsOverlay(
  ctx: QueryCtx,
  overlay: Doc<"overlays"> & { overlayType: "standings" },
) {
  const spicerackTournament = await getSpicerackTournamentForStandingsOverlay(
    ctx,
    overlay,
  );
  const isEliminationPhase = ELIMINATION_ROUND_NAMES.has(
    spicerackTournament?.currentRoundName ?? "",
  );
  const showCurrentBracket = overlay.showCurrentBracket === true;
  const shouldShowBracket = showCurrentBracket && isEliminationPhase;
  const bracketDataWithPlayers = shouldShowBracket
    ? await getEliminationBracketDataWithPlayers(ctx, overlay, spicerackTournament)
    : undefined;

  // If no roundStandingsId is set, return overlay without standings data
  if (!overlay.roundStandingsId) {
    return {
      ...overlay,
      roundDisplayName: spicerackTournament?.currentRoundName ?? undefined,
      isEliminationPhase: shouldShowBracket,
      bracketDataWithPlayers,
      standingsDataWithPlayers: undefined,
    };
  }

  // Read the existing standings (created by updateStandingsOverlay mutation)
  const roundStandings = await ctx.db.get(overlay.roundStandingsId);
  if (!roundStandings || roundStandings.standings === "PENDING") {
    return {
      ...overlay,
      roundDisplayName: spicerackTournament?.currentRoundName ?? undefined,
      isEliminationPhase: shouldShowBracket,
      bracketDataWithPlayers,
      standingsDataWithPlayers: undefined,
    };
  }

  const roundDisplayName =
    spicerackTournament?.completedRounds?.find(
      (round) => round.roundId === roundStandings.spicerackRoundId,
    )?.roundName ??
    (typeof roundStandings.roundNumber === "number"
      ? `Round ${roundStandings.roundNumber}`
      : undefined);

  // Enrich standings with player data
  const standingsDataWithPlayers = await Promise.all(
    roundStandings.standings.map(async (standing) => {
      // Try to find matching player by spicerackPlayerId
      const player = await ctx.db
        .query("players")
        .withIndex("by_spicerack_player_id", (q) =>
          q.eq("spicerackPlayerId", standing.user_event_status_ids[0]),
        )
        .first();

      return {
        ...standing,
        seed: standing.rank > 0 ? standing.rank : undefined,
        playerData: player ? await getPlayerData(ctx, player) : undefined,
      };
    }),
  );

  return {
    ...overlay,
    roundDisplayName,
    isEliminationPhase: shouldShowBracket,
    bracketDataWithPlayers,
    standingsDataWithPlayers,
  };
}

async function getSpicerackTournamentForStandingsOverlay(
  ctx: QueryCtx,
  overlay: Doc<"overlays"> & { overlayType: "standings" },
) {
  const tournament = await ctx.db.get(overlay.tournamentId);
  if (!tournament?.spicerackTournamentId) {
    return null;
  }
  const spicerackTournamentId = tournament.spicerackTournamentId;

  return await ctx.db
    .query("spicerackTournaments")
    .withIndex("by_spicerack_tournament_id", (q) =>
      q.eq("spicerackTournamentId", spicerackTournamentId),
    )
    .unique();
}

async function getEliminationBracketDataWithPlayers(
  ctx: QueryCtx,
  overlay: Doc<"overlays"> & { overlayType: "standings" },
  spicerackTournament: Doc<"spicerackTournaments"> | null,
) {
  if (!spicerackTournament?.currentRoundId) {
    return undefined;
  }

  const pairings = await getCurrentRoundPairingsWithPlayerData(
    ctx,
    overlay.tournamentId,
    {
      spicerackRoundId: spicerackTournament.currentRoundId,
      roundNumber: spicerackTournament.currentRoundNumber,
    },
  );
  if (pairings.length === 0) {
    return undefined;
  }

  const seedBySpicerackPlayerId = await getLatestSwissSeedMap(
    ctx,
    spicerackTournament,
  );

  return pairings
    .flatMap((pairing) => {
      const player1Seed = resolvePairingSeed({
        storedSeed: pairing.player1Seed,
        tournamentRecord: pairing.player1TournamentRecord,
        spicerackPlayerId: pairing.player1Data?.spicerackPlayerId,
        seedBySpicerackPlayerId,
      });
      const player2Seed = resolvePairingSeed({
        storedSeed: pairing.player2Seed,
        tournamentRecord: pairing.player2TournamentRecord,
        spicerackPlayerId: pairing.player2Data?.spicerackPlayerId,
        seedBySpicerackPlayerId,
      });

      return [
        player1Seed
          ? {
              name: pairing.player1Data?.name ?? "Player 1",
              rank: player1Seed,
              seed: player1Seed,
              playerData: pairing.player1Data,
            }
          : undefined,
        player2Seed
          ? {
              name: pairing.player2Data?.name ?? "Player 2",
              rank: player2Seed,
              seed: player2Seed,
              playerData: pairing.player2Data,
            }
          : undefined,
      ];
    })
    .filter((player) => player !== undefined)
    .sort((left, right) => left.seed - right.seed);
}

async function getLatestSwissSeedMap(
  ctx: QueryCtx,
  spicerackTournament: Doc<"spicerackTournaments">,
) {
  const latestSwissRound = [...(spicerackTournament.completedRounds ?? [])]
    .reverse()
    .find((round) => !ELIMINATION_ROUND_NAMES.has(round.roundName));

  if (!latestSwissRound) {
    return new Map<number, number>();
  }

  const roundStandings = await ctx.db
    .query("roundStandings")
    .withIndex("by_spicerackRoundId", (q) =>
      q.eq("spicerackRoundId", latestSwissRound.roundId),
    )
    .first();

  if (!roundStandings || roundStandings.standings === "PENDING") {
    return new Map<number, number>();
  }

  return new Map(
    roundStandings.standings.flatMap((standing) =>
      standing.rank > 0
        ? standing.user_event_status_ids.map((spicerackPlayerId) => [
            spicerackPlayerId,
            standing.rank,
          ])
        : [],
    ),
  );
}

function resolvePairingSeed(args: {
  storedSeed?: number;
  tournamentRecord: string;
  spicerackPlayerId?: number;
  seedBySpicerackPlayerId: Map<number, number>;
}) {
  return (
    args.storedSeed ??
    parseSeedRecord(args.tournamentRecord) ??
    (args.spicerackPlayerId !== undefined
      ? args.seedBySpicerackPlayerId.get(args.spicerackPlayerId)
      : undefined)
  );
}

function parseSeedRecord(record: string) {
  const match = record.trim().match(/^#(\d+)$/);
  if (!match) {
    return undefined;
  }
  return Number(match[1]);
}

type EnrichedOverlay = Infer<typeof getOverlayByIdValidator>;

/**
 * Helper function to enrich an overlay based on its type.
 * Returns the enriched overlay if it needs enrichment, otherwise returns the original overlay.
 */
export async function enrichOverlay(
  ctx: QueryCtx,
  overlay: Doc<"overlays">,
): Promise<EnrichedOverlay> {
  if (overlay.overlayType === "match") {
    return await enrichMatchOverlay(ctx, overlay);
  }

  if (overlay.overlayType === "deck") {
    return await enrichDeckOverlay(ctx, overlay);
  }

  if (overlay.overlayType === "standings") {
    return await enrichStandingsOverlay(ctx, overlay);
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

  // Create a standings overlay
  await createStandingsOverlayHelper(ctx, tournamentId, "Standings Overlay");

  // Create default settings for the new user
  await ctx.db.insert("settings", {
    userId,
    spicerackApiKey: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}
