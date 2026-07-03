import { Infer } from "convex/values";
import {
  MeleeMatch,
  MeleePlayerListEntry,
  MeleeStanding,
  MeleeTournamentOverviewResponse,
  MeleeTournamentPhase,
  MeleeTournamentRound,
} from "../types/melee";
import {
  roundSnapshotValidator,
  snapshotCompetitorValidator,
  snapshotMatchValidator,
  standingRowValidator,
} from "../validators";

export type StandingRow = Infer<typeof standingRowValidator>;
export type SnapshotCompetitor = Infer<typeof snapshotCompetitorValidator>;
export type SnapshotMatch = Infer<typeof snapshotMatchValidator>;
export type RoundSnapshot = Infer<typeof roundSnapshotValidator>;

// Sampled StatusDescription for a live event is "In Progress"; the
// completed-event value is unconfirmed, so match a family of likely values.
const COMPLETE_STATUS_PATTERN = /complete|completed|ended|finished/i;

// Melee phases don't expose a structural round_type the way Spicerack did,
// so elimination detection is heuristic on phase/round names until a
// structural signal is confirmed.
const ELIMINATION_NAME_PATTERN =
  /top\s*\d+|playoff|elimination|bracket|quarter\s*-?final|semi\s*-?final|^finals?$/i;

/**
 * Detect if the tournament appears to be complete.
 */
export function isTournamentComplete(
  overview: MeleeTournamentOverviewResponse,
): boolean {
  return COMPLETE_STATUS_PATTERN.test(overview.StatusDescription ?? "");
}

function findPhaseForRound(
  overview: MeleeTournamentOverviewResponse,
  roundId: number,
): MeleeTournamentPhase | undefined {
  return overview.Phases.find((phase) =>
    phase.Rounds.some((round) => round.ID === roundId),
  );
}

function findRound(
  phase: MeleeTournamentPhase | undefined,
  roundId: number,
): MeleeTournamentRound | undefined {
  return phase?.Rounds.find((round) => round.ID === roundId);
}

/**
 * Check if a phase is an elimination phase (Top 8 etc.).
 */
export function isEliminationPhase(
  phase: MeleeTournamentPhase | undefined,
): boolean {
  if (!phase) {
    return false;
  }
  if (ELIMINATION_NAME_PATTERN.test(phase.Name ?? "")) {
    return true;
  }
  return phase.Rounds.some((round) =>
    ELIMINATION_NAME_PATTERN.test(round.Name ?? ""),
  );
}

/**
 * All phases ordered by SortOrder, each with rounds ordered by SortOrder.
 */
function orderedPhases(
  overview: MeleeTournamentOverviewResponse,
): MeleeTournamentPhase[] {
  return [...overview.Phases]
    .sort((a, b) => a.SortOrder - b.SortOrder)
    .map((phase) => ({
      ...phase,
      Rounds: [...phase.Rounds].sort((a, b) => a.SortOrder - b.SortOrder),
    }));
}

/**
 * The highest round SortOrder across all non-elimination phases that come
 * before the target phase — the elimination naming offset (mirrors the old
 * getLastSwissRoundNumberBeforePhase behavior).
 */
function getLastSwissRoundCountBeforePhase(
  overview: MeleeTournamentOverviewResponse,
  targetPhase: MeleeTournamentPhase,
): number {
  let count = 0;
  for (const phase of orderedPhases(overview)) {
    if (phase.ID === targetPhase.ID) {
      break;
    }
    if (!isEliminationPhase(phase)) {
      count += phase.Rounds.length;
    }
  }
  return count;
}

const GENERIC_ROUND_NAME_PATTERN = /^round\s*\d+$/i;

/**
 * Display name for a round (e.g. "Round 3" or "Quarterfinals").
 * Prefers Melee's own round name; falls back to elimination-offset naming
 * when the name is generic and the phase is an elimination phase.
 */
export function getRoundDisplayName(
  overview: MeleeTournamentOverviewResponse,
  roundId: number,
  fallbackRoundNumber?: number,
): string {
  const phase = findPhaseForRound(overview, roundId);
  const round = findRound(phase, roundId);
  const roundName = round?.Name?.trim();

  if (roundName && !GENERIC_ROUND_NAME_PATTERN.test(roundName)) {
    return roundName;
  }

  const roundNumber =
    fallbackRoundNumber ??
    (roundName ? Number(roundName.replace(/\D+/g, "")) : undefined);

  if (phase && isEliminationPhase(phase) && roundNumber !== undefined) {
    const swissLength = getLastSwissRoundCountBeforePhase(overview, phase);
    switch (roundNumber - swissLength) {
      case 1:
        return "Quarterfinals";
      case 2:
        return "Semifinals";
      case 3:
        return "Finals";
    }
  }

  if (roundName) {
    return roundName;
  }
  return roundNumber !== undefined ? `Round ${roundNumber}` : "";
}

/**
 * Rounds that come before the current round in phase/round SortOrder —
 * the rounds with published standings available.
 */
export function parseCompletedRounds(
  overview: MeleeTournamentOverviewResponse,
  currentRoundId: number | undefined,
): { roundId: number; roundName: string }[] {
  const completed: { roundId: number; roundName: string }[] = [];

  for (const phase of orderedPhases(overview)) {
    for (const round of phase.Rounds) {
      if (round.ID === currentRoundId) {
        return completed;
      }
      completed.push({
        roundId: round.ID,
        roundName: getRoundDisplayName(overview, round.ID),
      });
    }
  }

  // Current round not found (e.g. tournament complete): all rounds count.
  return completed;
}

/**
 * The last round of the last non-elimination phase before the phase
 * containing the current round — the round whose standings define the
 * elimination bracket seeds. Returns undefined when the current round is
 * not in an elimination phase.
 */
export function getLastSwissRoundId(
  overview: MeleeTournamentOverviewResponse,
  currentRoundId: number,
): number | undefined {
  const currentPhase = findPhaseForRound(overview, currentRoundId);
  if (!currentPhase || !isEliminationPhase(currentPhase)) {
    return undefined;
  }

  let lastSwissRoundId: number | undefined;
  for (const phase of orderedPhases(overview)) {
    if (phase.ID === currentPhase.ID) {
      break;
    }
    if (!isEliminationPhase(phase) && phase.Rounds.length > 0) {
      lastSwissRoundId = phase.Rounds[phase.Rounds.length - 1].ID;
    }
  }
  return lastSwissRoundId;
}

/**
 * "W-L" or "W-L-D" record string from a standings row (draws shown only
 * when nonzero, matching the previous Spicerack display behavior).
 */
export function parsePlayerRecord(standing: MeleeStanding): string {
  const wins = Math.max(standing.MatchWins, 0);
  const losses = Math.max(standing.MatchLosses, 0);
  const draws = Math.max(standing.MatchDraws, 0);
  if (draws > 0) {
    return `${wins}-${losses}-${draws}`;
  }
  return `${wins}-${losses}`;
}

/**
 * Index standings rows by numeric player ID (via Team.Players[].ID).
 */
export function standingsByPlayerId(
  standings: MeleeStanding[],
): Map<number, MeleeStanding> {
  const byPlayerId = new Map<number, MeleeStanding>();
  for (const standing of standings) {
    for (const player of standing.Team.Players) {
      byPlayerId.set(player.ID, standing);
    }
  }
  return byPlayerId;
}

/**
 * Seed map (player ID → rank) from a standings list, used for elimination
 * bracket seeding from the final swiss round.
 */
export function seedMapFromStandings(
  standings: MeleeStanding[],
): Map<number, number> {
  const seeds = new Map<number, number>();
  for (const standing of standings) {
    for (const player of standing.Team.Players) {
      seeds.set(player.ID, standing.Rank);
    }
  }
  return seeds;
}

/**
 * Convert Melee standings rows to the internal StandingRow shape stored in
 * roundStandings and rendered by the standings overlay.
 */
export function toStandingRows(standings: MeleeStanding[]): StandingRow[] {
  return standings.flatMap((standing) => {
    const player = standing.Team.Players[0];
    if (!player) {
      return [];
    }
    return [
      {
        rank: standing.Rank,
        externalPlayerId: player.ID,
        name: player.DisplayName || player.Name || player.Username,
        record: parsePlayerRecord(standing),
        matchPoints: standing.Points,
        wins: standing.MatchWins,
        losses: standing.MatchLosses,
        draws: standing.MatchDraws,
        gameWinPercentage: standing.TeamGameWinPercentage,
        opponentMatchWinPercentage: standing.OpponentMatchWinPercentage,
        opponentGameWinPercentage: standing.OpponentGameWinPercentage,
      },
    ];
  });
}

/**
 * Registration status string for a player-list entry. Dropped players are
 * reported as "DROPPED" regardless of their StatusDescription.
 */
export function parseMeleeRegistrationStatus(
  entry: MeleePlayerListEntry,
): string {
  if (entry.RoundDroppedId !== null || entry.RoundDroppedNumber !== null) {
    return "DROPPED";
  }
  return (entry.StatusDescription ?? "").toUpperCase() || "UNKNOWN";
}

/**
 * Compose the per-cycle API responses into the provider-neutral
 * RoundSnapshot consumed by round detection, pairings, and feature matches.
 * Returns undefined when there is no current round (no matches).
 */
export function buildRoundSnapshot(args: {
  overview: MeleeTournamentOverviewResponse;
  matches: MeleeMatch[];
  standingsByPlayerId: Map<number, MeleeStanding>;
  lastSwissSeedByPlayerId?: Map<number, number>;
}): RoundSnapshot | undefined {
  const { overview, matches, standingsByPlayerId, lastSwissSeedByPlayerId } =
    args;
  if (matches.length === 0) {
    return undefined;
  }

  // All matches from /api/match/list/current share a round; keep only the
  // first round's matches in case the API ever mixes rounds.
  const roundId = matches[0].RoundId;
  const roundNumber = matches[0].RoundNumber;
  const roundMatches = matches.filter((match) => match.RoundId === roundId);

  const phase = findPhaseForRound(overview, roundId);
  const isElimination = isEliminationPhase(phase);

  const snapshotMatches: SnapshotMatch[] = roundMatches.map((match) => ({
    externalMatchId: match.Guid,
    tableNumber: match.TableNumber ?? undefined,
    isFeatureMatch: match.FeatureMatch,
    hasResult: match.HasResult,
    competitors: match.Competitors.flatMap((competitor) => {
      const player = competitor.Team?.Players?.[0];
      if (!player) {
        return [];
      }
      const standing = standingsByPlayerId.get(player.ID);
      const record = standing ? parsePlayerRecord(standing) : "0-0";
      const seed = lastSwissSeedByPlayerId?.get(player.ID);
      const decklist = competitor.Decklists?.[0];
      return [
        {
          externalPlayerId: player.ID,
          name: player.DisplayName || player.Name || player.Username,
          externalDecklistId: decklist?.DecklistId,
          decklistName: decklist?.DecklistName,
          tournamentRecord: isElimination && seed ? `#${seed}` : record,
          matchPoints: standing?.Points,
          seed,
        },
      ];
    }),
  }));

  return {
    externalTournamentId: overview.ID,
    roundId,
    roundNumber,
    roundDisplayName: getRoundDisplayName(overview, roundId, roundNumber),
    isEliminationRound: isElimination,
    matches: snapshotMatches,
  };
}
