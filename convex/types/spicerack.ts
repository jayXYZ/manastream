import { Infer } from "convex/values";
import {
  playerInStandingsValidator,
  spicerackRoundStandingsDataValidator,
} from "../validators";

/**
 * Spicerack API Types
 *
 * Types for the Spicerack Tournament Management API
 * Route: GET /api/v1/magic-events/{id}/
 *
 * Last updated: 2025-10-02
 */

/**
 * Main tournament/event response from Spicerack API
 */
export interface SpicerackEventResponse {
  id: number;
  name: string;
  event_format: string; // e.g., "BOOSTER_DRAFT", "STANDARD", "MODERN"
  start_datetime: string; // ISO 8601 format
  settings: SpicerackEventSettings;
  current_round_number: number; // Round number, not round ID
  enrolled_player_count: number;
  user_statuses: SpicerackUserEventStatus[];
  tournament_phases: SpicerackTournamentPhase[];
  featured_matches: SpicerackMatch[];
}

/**
 * Tournament settings and lifecycle status
 */
export interface SpicerackEventSettings {
  id: number;
  event_lifecycle_status: string; // e.g., "REGISTRATION_OPEN", "IN_PROGRESS", "COMPLETED"
}

/**
 * A player's status within the event
 */
export interface SpicerackUserEventStatus {
  id: number;
  user: SpicerackUser;
  decklist: number; // ID reference to decklist
  // Spicerack occasionally returns null when a registration row exists without a status.
  registration_status: string | null; // e.g., "IN_PROGRESS", "REGISTERED", "DROPPED"
  final_place_in_standings: number; // -1 if not finished
  matches_won: number;
  matches_lost: number;
  matches_drawn: number;
  total_match_points: number;
}

/**
 * User/player information
 * Note: This may be expanded with more fields in actual responses
 */
export interface SpicerackUser {
  id: number;
  username: string;
  best_identifier: string;
  email?: string;
}

/**
 * Player Decklist from Spicerack API
 */
export interface SpicerackDecklist {
  id: number;
  name: string;
  moxfield_deck_json: string;
  plaintext_list: string;
  moxfield_public_id: string;
  deck_image_url: string;
  archetype: string;
}

/**
 * Player decklist
 */
export interface Decklist {
  deckname: string;
  decklist: string;
}

/**
 * A phase of the tournament (e.g., Swiss rounds, Top 8)
 */
export interface SpicerackTournamentPhase {
  id: number;
  order_in_phases: number; // -1 or actual order
  round_type: string; // e.g., "SWISS", "SINGLE_ELIMINATION", "DOUBLE_ELIMINATION"
  status: string; // e.g., "UPCOMING", "IN_PROGRESS", "COMPLETE"
  rounds: SpicerackRound[];
}

/**
 * A single round within a phase
 */
export interface SpicerackRound {
  id: number;
  round_number: number; // -1 or actual round number
  status: string; // e.g., "UPCOMING", "IN_PROGRESS", "COMPLETE"
  matches: SpicerackMatch[];
}

/**
 * A match between players
 */
export interface SpicerackMatch {
  id: number;
  is_feature_match: boolean;
  table_number: number; // -1 if not assigned
  status: string; // e.g., "IN_PROGRESS", "COMPLETE", "UPCOMING"
  player_match_relationships: SpicerackPlayerMatchRelationship[];
}

/**
 * Relationship between a player and a specific match
 * Contains match results and player info
 */
export interface SpicerackPlayerMatchRelationship {
  id: number;
  user_event_status: SpicerackUserEventStatus;
  games_won: number; // -1 if none
  points_gained: number; // -1 if none
  player_order: number; // -1 or order (0 = player 1, 1 = player 2)
}

/**
 * Player in standings
 */
export type PlayerInStandings = Infer<typeof playerInStandingsValidator>;

/**
 * Standings for a round
 */
export type SpicerackRoundStandings = Infer<
  typeof spicerackRoundStandingsDataValidator
>;

/**
 * Helper type for match status checks
 */
export type MatchStatus = "UPCOMING" | "IN_PROGRESS" | "COMPLETE";

/**
 * Helper type for phase status checks
 */
export type PhaseStatus = "UPCOMING" | "IN_PROGRESS" | "COMPLETE";

/**
 * Helper type for round status checks
 */
export type RoundStatus = "UPCOMING" | "IN_PROGRESS" | "COMPLETE";

/**
 * Registered players response from Spicerack API
 */
export interface SpicerackRegisteredPlayersResponse {
  id: number;
  user_identifier: string;
  // Spicerack occasionally returns null when a registration row exists without a status.
  registration_status: string | null;
  decklist: {
    id: number;
    archetype: string;
  };
}
