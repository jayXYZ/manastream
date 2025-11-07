import { MutationCtx, QueryCtx } from "../_generated/server";
import { getOwnTournament } from "../lib/tournaments";
import { FeatureMatchWithPlayers } from "../types";
import {
  SpicerackEventResponse,
  SpicerackTournamentPhase,
  SpicerackRound,
  SpicerackMatch,
  SpicerackUserEventStatus,
} from "../types/spicerack";

/**
 * Get the current active phase from tournament data
 */
export function parseCurrentSpicerackPhase(
  jsonData: SpicerackEventResponse,
): SpicerackTournamentPhase | undefined {
  const currentPhase = jsonData.tournament_phases.find(
    (phase) => phase.status === "IN_PROGRESS",
  );
  if (!currentPhase) {
    return undefined;
  }
  return currentPhase;
}

/**
 * Get the current active round from tournament data
 */
export function parseCurrentSpicerackRound(
  jsonData: SpicerackEventResponse,
): SpicerackRound | undefined {
  const currentPhase = parseCurrentSpicerackPhase(jsonData);
  if (!currentPhase) {
    return undefined;
  }

  const currentRound = currentPhase.rounds.find(
    (round) =>
      round.status === "IN_PROGRESS" ||
      (round.status === "UPCOMING" && round.matches.length > 0),
  );
  if (!currentRound) {
    return undefined;
  }
  return currentRound;
}

/**
 * Get display name for current round (e.g., "Round 3" or "Quarterfinals")
 */
export function getCurrentRoundDisplayName(
  jsonData: SpicerackEventResponse,
): string | undefined {
  const currentPhase = parseCurrentSpicerackPhase(jsonData);
  const currentRound = parseCurrentSpicerackRound(jsonData);

  if (!currentPhase || !currentRound) {
    return undefined;
  }

  // Format based on round type
  if (currentPhase.round_type === "SWISS") {
    return `Round ${currentRound.round_number}`;
  } else if (
    currentPhase.round_type === "SINGLE_ELIMINATION" ||
    currentPhase.round_type === "RANKED_SINGLE_ELIMINATION"
  ) {
    // TODO: Make this more adaptable to single elim cuts that aren't just top 8's
    const swissLength =
      jsonData.tournament_phases.find((phase) => phase.round_type === "SWISS")
        ?.rounds.length || 0;
    switch (currentRound.round_number - swissLength) {
      case 1:
        return "Quarterfinals";
      case 2:
        return "Semifinals";
      case 3:
        return "Finals";
      default:
        return "Round " + currentRound.round_number;
    }
  }
}

/**
 * Get all feature matches in the current round
 */
export function parseCurrentRoundFeatureMatches(
  jsonData: SpicerackEventResponse,
): SpicerackMatch[] {
  const currentRound = parseCurrentSpicerackRound(jsonData);
  if (!currentRound || !currentRound.matches) {
    return [];
  }

  return currentRound.matches.filter(
    (match) => match.is_feature_match === true,
  );
}

/**
 * Check if tournament is currently in Top 8 (or other elimination rounds)
 */
export function isEliminationRound(jsonData: SpicerackEventResponse): boolean {
  const currentPhase = parseCurrentSpicerackPhase(jsonData);
  return (
    currentPhase?.round_type === "SINGLE_ELIMINATION" ||
    currentPhase?.round_type === "RANKED_SINGLE_ELIMINATION"
  );
}

/**
 * Get all feature matches across all rounds
 */
export function parseAllFeatureMatches(
  jsonData: SpicerackEventResponse,
): SpicerackMatch[] {
  const allFeatureMatches: SpicerackMatch[] = [];

  for (const phase of jsonData.tournament_phases) {
    for (const round of phase.rounds) {
      for (const match of round.matches) {
        if (match.is_feature_match) {
          allFeatureMatches.push(match);
        }
      }
    }
  }

  return allFeatureMatches;
}

/**
 * Get a player's tournament record (e.g., "3-1-0")
 */
export function parsePlayerRecord(
  playerStatus: SpicerackUserEventStatus,
): string {
  const wins = playerStatus.matches_won >= 0 ? playerStatus.matches_won : 0;
  const losses = playerStatus.matches_lost >= 0 ? playerStatus.matches_lost : 0;
  const draws =
    playerStatus.matches_drawn >= 0 ? playerStatus.matches_drawn : 0;
  if (draws > 0) {
    return `${wins}-${losses}-${draws}`;
  }
  return `${wins}-${losses}`;
}

/**
 * Detect if tournament appears to be complete
 */
export function isTournamentComplete(
  jsonData: SpicerackEventResponse,
): boolean {
  // Check if event lifecycle status indicates completion
  if (jsonData.settings.event_lifecycle_status === "COMPLETED") {
    return true;
  }

  // Check if all phases are complete
  const allPhasesComplete = jsonData.tournament_phases.every(
    (phase) => phase.status === "COMPLETE",
  );

  return allPhasesComplete;
}

/**
 * Get all registered players
 */
export function parseRegisteredPlayers(
  jsonData: SpicerackEventResponse,
): SpicerackEventResponse["user_statuses"] {
  return jsonData.user_statuses.filter(
    (status) => status.registration_status !== "DROPPED",
  );
}

// TODO: Implement these when needed
// - getPlayerDeck()
// - swapPlayers()
// - newRoundDetected()

export function generateFeatureMatchExternalId(
  tournamentId: number,
  roundId: number,
  match: SpicerackMatch,
): string {
  const player1Name =
    match.player_match_relationships[0].user_event_status.user.best_identifier;
  const player2Name =
    match.player_match_relationships[1].user_event_status.user.best_identifier;

  return `${tournamentId}-${roundId}-${player1Name}vs${player2Name}`;
}
