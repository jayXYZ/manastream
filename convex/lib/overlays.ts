import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import type { Infer } from "convex/values";
import type { getOverlayByIdValidator } from "../validators";
import { getPlayerData, loadTournamentPlayerData } from "./playerData";
import { internal } from "../_generated/api";
import {
  findRoundsNeedingCapture,
  getCurrentRoundPairingsWithPlayerData,
} from "./pairings";
import { getPlayersForMatch } from "./players";
import { getTournamentTimerAndRoundInfo } from "./tournaments";
import { generatePublicUuid } from "./utils";
import { ELIMINATION_ROUND_NAMES, isEliminationRoundName } from "./constants";

/**
 * Drops every deck overlay's selected match for a tournament. Used when the
 * tournament is linked to a different Melee tournament: the old match belongs
 * to the previous Melee tournament and would fail the access check on the
 * next deck overlay update.
 */
export async function clearDeckOverlayMatches(
  ctx: MutationCtx,
  tournamentId: Id<"tournaments">,
): Promise<void> {
  const overlays = await ctx.db
    .query("overlays")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .collect();
  for (const overlay of overlays) {
    if (overlay.overlayType === "deck" && overlay.matchId !== undefined) {
      await ctx.db.patch(overlay._id, { matchId: undefined });
    }
  }
}

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
    externalRoundId: undefined,
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
 * Always returns a matchData field: null when matchId is not set, or when the
 * referenced feature match or either of its players no longer exists. This
 * feeds the public OBS browser source, so a dangling reference must render an
 * empty overlay rather than throw and break the source.
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
    return {
      ...overlay,
      matchData: null,
    };
  }
  const [player1, player2] = await Promise.all([
    ctx.db.get(featureMatch.player1),
    ctx.db.get(featureMatch.player2),
  ]);

  if (!player1 || !player2) {
    return {
      ...overlay,
      matchData: null,
    };
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
  const externalTournament = await getExternalTournamentForStandingsOverlay(
    ctx,
    overlay,
  );
  const bracketStage = externalTournament
    ? resolveBracketStage(overlay, externalTournament)
    : undefined;

  if (bracketStage && externalTournament) {
    const bracket = await getEliminationBracket(
      ctx,
      overlay.tournamentId,
      externalTournament,
      bracketStage,
    );
    return {
      ...overlay,
      roundDisplayName: bracketStage.roundDisplayName,
      isEliminationPhase: true,
      bracketDataWithPlayers: bracket.players,
      bracketMatches: bracket.matches,
      standingsDataWithPlayers: undefined,
    };
  }

  // Read the existing standings (created by updateStandingsOverlay mutation)
  const roundStandings = overlay.roundStandingsId
    ? await ctx.db.get(overlay.roundStandingsId)
    : null;
  const standingsRows =
    roundStandings && Array.isArray(roundStandings.standings)
      ? roundStandings.standings
      : null;

  // Standings rows cover every entrant, so one bulk load of the
  // tournament's players serves them all.
  const players =
    roundStandings && standingsRows
      ? await loadTournamentPlayerData(ctx, roundStandings.externalTournamentId)
      : undefined;

  if (!roundStandings || !standingsRows || !players) {
    return {
      ...overlay,
      roundDisplayName: externalTournament?.currentRoundName ?? undefined,
      isEliminationPhase: false,
      bracketDataWithPlayers: undefined,
      bracketMatches: undefined,
      standingsDataWithPlayers: undefined,
    };
  }

  const roundDisplayName =
    externalTournament?.completedRounds?.find(
      (round) => round.roundId === roundStandings.externalRoundId,
    )?.roundName ??
    (typeof roundStandings.roundNumber === "number"
      ? `Round ${roundStandings.roundNumber}`
      : undefined);

  // Enrich standings with player data, matched by Melee player id
  const standingsDataWithPlayers = standingsRows.map((standing) => ({
    ...standing,
    seed: standing.rank > 0 ? standing.rank : undefined,
    playerData: players.byExternalPlayerId.get(standing.externalPlayerId),
  }));

  return {
    ...overlay,
    roundDisplayName,
    isEliminationPhase: false,
    bracketDataWithPlayers: undefined,
    bracketMatches: undefined,
    standingsDataWithPlayers,
  };
}

async function getExternalTournamentForStandingsOverlay(
  ctx: QueryCtx,
  overlay: Doc<"overlays"> & { overlayType: "standings" },
) {
  const tournament = await ctx.db.get(overlay.tournamentId);
  if (!tournament?.externalTournamentId) {
    return null;
  }
  const externalTournamentId = tournament.externalTournamentId;

  return await ctx.db
    .query("externalTournaments")
    .withIndex("by_external_tournament_id", (q) =>
      q.eq("externalTournamentId", externalTournamentId),
    )
    .unique();
}

type EliminationRound = {
  roundId: number;
  roundName: string;
  roundNumber?: number;
};

/**
 * Which bracket a standings overlay shows: the elimination rounds in play
 * order, how far into them to look, and whether the last of those rounds'
 * own results are shown. "Going into" a round means the rounds before it
 * are decided and that round's matches are still open.
 */
type BracketStage = {
  rounds: EliminationRound[];
  upToIndex: number;
  revealLastRoundResults: boolean;
  roundDisplayName: string;
};

export const COMPLETED_BRACKET_DISPLAY_NAME = "Final Results";

/**
 * The tournament's elimination rounds in order: the completed ones, then the
 * current round when it is part of the cut. A finished tournament lists its
 * finals as completed and as current; it is counted once.
 */
export function listEliminationRounds(
  externalTournament: Doc<"externalTournaments">,
): EliminationRound[] {
  const rounds: EliminationRound[] = (externalTournament.completedRounds ?? [])
    .filter((round) => isEliminationRoundName(round.roundName))
    .map((round) => ({ roundId: round.roundId, roundName: round.roundName }));
  const currentRoundId = externalTournament.currentRoundId;
  if (
    currentRoundId !== undefined &&
    isEliminationRoundName(externalTournament.currentRoundName) &&
    !rounds.some((round) => round.roundId === currentRoundId)
  ) {
    rounds.push({
      roundId: currentRoundId,
      roundName: externalTournament.currentRoundName ?? "",
      roundNumber: externalTournament.currentRoundNumber,
    });
  }
  return rounds;
}

/**
 * Fetches any elimination round the bracket cannot draw in full: one no poll
 * captured (the cut of a tournament linked after it finished, or a round
 * missed while polling was down) or one whose pairings have no result yet.
 * Without these rows the bracket shows only the current round's players.
 * Nothing is scheduled when every round is captured with its results.
 */
export async function scheduleEliminationPairingsBackfill(
  ctx: MutationCtx,
  tournament: Doc<"tournaments">,
): Promise<number[]> {
  const externalTournamentId = tournament.externalTournamentId;
  if (externalTournamentId === undefined) {
    return [];
  }
  const externalTournament = await ctx.db
    .query("externalTournaments")
    .withIndex("by_external_tournament_id", (q) =>
      q.eq("externalTournamentId", externalTournamentId),
    )
    .unique();
  if (!externalTournament) {
    return [];
  }
  const roundIds = await findRoundsNeedingCapture(
    ctx,
    tournament._id,
    listEliminationRounds(externalTournament).map((round) => round.roundId),
  );
  if (roundIds.length === 0) {
    return [];
  }
  await ctx.scheduler.runAfter(
    0,
    internal.tournamentSync.backfillEliminationPairings,
    { tournamentId: tournament._id, externalTournamentId, roundIds },
  );
  return roundIds;
}

function resolveBracketStage(
  overlay: Doc<"overlays"> & { overlayType: "standings" },
  externalTournament: Doc<"externalTournaments">,
): BracketStage | undefined {
  const rounds = listEliminationRounds(externalTournament);
  if (rounds.length === 0) {
    return undefined;
  }
  if (overlay.showCompletedBracket) {
    return {
      rounds,
      upToIndex: rounds.length - 1,
      revealLastRoundResults: true,
      roundDisplayName: COMPLETED_BRACKET_DISPLAY_NAME,
    };
  }
  const selectedRoundId = overlay.showCurrentBracket
    ? externalTournament.currentRoundId
    : overlay.externalRoundId;
  const index = rounds.findIndex((round) => round.roundId === selectedRoundId);
  if (index === -1) {
    // A Swiss round, or the current bracket before the cut: standings table.
    return undefined;
  }
  return {
    rounds,
    upToIndex: index,
    revealLastRoundResults: false,
    roundDisplayName: rounds[index].roundName,
  };
}

type BracketPlayerEntry = {
  name: string;
  rank: number;
  seed: number;
  playerData: PlayerWithDataResult;
};

type PlayerWithDataResult = Awaited<
  ReturnType<typeof getCurrentRoundPairingsWithPlayerData>
>[number]["player1Data"];

type BracketMatch = { seeds: number[]; winnerSeed?: number };

/**
 * Builds the bracket from the captured pairings of the elimination rounds up
 * to the stage's round. Seeds come from the pairing rows (or the last Swiss
 * standings for rows captured without them). A match's winner is whichever
 * of its players appears in the next round; for the last round shown it is
 * the result Melee reported, and only when the stage reveals it.
 */
async function getEliminationBracket(
  ctx: QueryCtx,
  tournamentId: Id<"tournaments">,
  externalTournament: Doc<"externalTournaments">,
  stage: BracketStage,
): Promise<{
  players: BracketPlayerEntry[];
  matches: {
    quarterfinals: BracketMatch[];
    semifinals: BracketMatch[];
    finals: BracketMatch[];
    championSeed?: number;
  };
}> {
  const rounds = stage.rounds.slice(0, stage.upToIndex + 1);
  const pairingsByRound = await Promise.all(
    rounds.map((round) =>
      getCurrentRoundPairingsWithPlayerData(ctx, tournamentId, {
        externalRoundId: round.roundId,
        roundNumber: round.roundNumber,
      }),
    ),
  );
  const seedByExternalPlayerId = await getLatestSwissSeedMap(
    ctx,
    externalTournament,
  );

  const seedByPlayerId = new Map<Id<"players">, number>();
  const playersBySeed = new Map<number, BracketPlayerEntry>();
  const resolveSeed = (
    playerId: Id<"players">,
    storedSeed: number | undefined,
    tournamentRecord: string,
    data: PlayerWithDataResult,
  ) => {
    const seed =
      resolvePairingSeed({
        storedSeed,
        tournamentRecord,
        externalPlayerId: data?.externalPlayerId,
        seedByExternalPlayerId,
      }) ?? seedByPlayerId.get(playerId);
    if (seed === undefined) {
      return undefined;
    }
    seedByPlayerId.set(playerId, seed);
    if (!playersBySeed.has(seed)) {
      playersBySeed.set(seed, {
        name: data?.name ?? "Player",
        rank: seed,
        seed,
        playerData: data,
      });
    }
    return seed;
  };

  const matchesByRound = pairingsByRound.map((pairings, roundIndex) => {
    const nextRoundPlayerIds = new Set(
      (pairingsByRound[roundIndex + 1] ?? []).flatMap((pairing) => [
        pairing.player1,
        pairing.player2,
      ]),
    );
    const isLastRound = roundIndex === rounds.length - 1;
    return pairings.map((pairing): BracketMatch => {
      const seed1 = resolveSeed(
        pairing.player1,
        pairing.player1Seed,
        pairing.player1TournamentRecord,
        pairing.player1Data,
      );
      const seed2 = resolveSeed(
        pairing.player2,
        pairing.player2Seed,
        pairing.player2TournamentRecord,
        pairing.player2Data,
      );
      const seeds = [seed1, seed2].filter(
        (seed): seed is number => seed !== undefined,
      );
      const winnerPlayerId = isLastRound
        ? stage.revealLastRoundResults
          ? pairing.winnerPlayerId
          : undefined
        : nextRoundPlayerIds.has(pairing.player1)
          ? pairing.player1
          : nextRoundPlayerIds.has(pairing.player2)
            ? pairing.player2
            : pairing.winnerPlayerId;
      const winnerSeed =
        winnerPlayerId === undefined
          ? undefined
          : seedByPlayerId.get(winnerPlayerId);
      return { seeds, winnerSeed };
    });
  });

  const byName = (name: string) =>
    matchesByRound[rounds.findIndex((round) => round.roundName === name)] ??
    undefined;
  const byCount = (count: number) =>
    matchesByRound.find((matches) => matches.length === count);
  const quarterfinals = byName("Quarterfinals") ?? byCount(4) ?? [];
  const semifinals = byName("Semifinals") ?? byCount(2) ?? [];
  const finals = byName("Finals") ?? byCount(1) ?? [];
  const championSeed = stage.revealLastRoundResults
    ? finals[0]?.winnerSeed
    : undefined;

  return {
    players: [...playersBySeed.values()].sort(
      (left, right) => left.seed - right.seed,
    ),
    matches: { quarterfinals, semifinals, finals, championSeed },
  };
}

async function getLatestSwissSeedMap(
  ctx: QueryCtx,
  externalTournament: Doc<"externalTournaments">,
) {
  const latestSwissRound = [...(externalTournament.completedRounds ?? [])]
    .reverse()
    .find((round) => !ELIMINATION_ROUND_NAMES.has(round.roundName));

  if (!latestSwissRound) {
    return new Map<number, number>();
  }

  const roundStandings = await ctx.db
    .query("roundStandings")
    .withIndex("by_external_round_id", (q) =>
      q.eq("externalRoundId", latestSwissRound.roundId),
    )
    .first();

  if (!roundStandings || !Array.isArray(roundStandings.standings)) {
    return new Map<number, number>();
  }

  return new Map(
    roundStandings.standings.flatMap((standing) =>
      standing.rank > 0
        ? [[standing.externalPlayerId, standing.rank] as [number, number]]
        : [],
    ),
  );
}

function resolvePairingSeed(args: {
  storedSeed?: number;
  tournamentRecord: string;
  externalPlayerId?: number;
  seedByExternalPlayerId: Map<number, number>;
}) {
  return (
    args.storedSeed ??
    parseSeedRecord(args.tournamentRecord) ??
    (args.externalPlayerId !== undefined
      ? args.seedByExternalPlayerId.get(args.externalPlayerId)
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
 * Look up an overlay by its public UUID and enrich it. Shared by the public
 * `getOverlayByUuid` query (used by the overlay page) and the internal query
 * behind the `/api/overlay/:uuid` HTTP route, so the route does not depend on
 * the public API surface.
 */
export async function getEnrichedOverlayByPublicUuid(
  ctx: QueryCtx,
  publicUuid: string,
): Promise<EnrichedOverlay | null> {
  const overlay = await ctx.db
    .query("overlays")
    .withIndex("by_public_uuid", (q) => q.eq("publicUuid", publicUuid))
    .unique();

  if (!overlay) {
    return null;
  }

  return await enrichOverlay(ctx, overlay);
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
    meleeClientId: "",
    meleeClientSecret: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}
