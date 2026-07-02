/**
 * Melee API Types
 *
 * Types for the melee.gg Tournament Management API.
 *
 * Sampled routes:
 * - Tournament overview
 * - Matches by current round
 * - Decklist
 *
 * Last updated: 2026-07-02
 */

export type MeleeGuid = string;
export type MeleeDateTime = string; // ISO 8601 format

/**
 * Main tournament overview response from Melee API.
 */
export interface MeleeTournamentOverviewResponse {
  ID: number;
  Guid: MeleeGuid;
  Name: string;
  CurrentPhaseId: number;
  Formats: string[];
  OrganizationId: number;
  OrganizationName: string;
  SearchTags: string[];
  BrandImageSource: string;
  TimerState: number; // e.g., 5
  TimerStateDescription: string; // e.g., "Until the Round Ends"
  TimerEnd: MeleeDateTime;
  Game: string; // e.g., "MagicTheGathering"
  TournamentType: number; // e.g., 4
  TournamentTypeDescription: string; // e.g., "Tabletop"
  Status: number; // e.g., 2
  StatusDescription: string; // e.g., "In Progress"
  LastPairDateTime: MeleeDateTime;
  Phases: MeleeTournamentPhase[];
}

/**
 * A tournament phase, such as Swiss or playoffs.
 */
export interface MeleeTournamentPhase {
  ID: number;
  Guid: MeleeGuid;
  Name: string;
  FormatId: MeleeGuid;
  Format: string;
  SortOrder: number;
  Rounds: MeleeTournamentRound[];
}

/**
 * A round listed in the tournament overview.
 */
export interface MeleeTournamentRound {
  ID: number;
  Guid: MeleeGuid;
  Name: string;
  SortOrder: number;
}

/**
 * Paginated response for the current round's matches.
 */
export interface MeleeMatchesByCurrentRoundResponse {
  Content: MeleeMatch[];
  HasMore: boolean;
  IgnoreCache: boolean;
  Page: number;
  PageSize: number;
  RecordsFiltered: number;
  RecordsTotal: number;
  StatusCode: number;
}

/**
 * A match between teams/players in a round.
 */
export interface MeleeMatch {
  Competitors: MeleeMatchCompetitor[];
  ByeReason: number | null;
  LossReason: number | null;
  RoundName: string | null;
  DateCreated: MeleeDateTime;
  Type: number; // e.g., 0
  FeatureMatch: boolean;
  HasResult: boolean;
  TimeExtended: boolean;
  MatchesPublished: boolean;
  RoundNumber: number;
  GameDraws: number | null;
  PodNumber: number | null;
  PhaseSortOrder: number;
  SortOrder: number | null;
  TableNumber: number | null; // null for byes
  TimeExtensionMinutes: number | null;
  PhaseId: number;
  RoundId: number;
  TournamentId: number;
  FormatId: MeleeGuid;
  Format: string;
  Guid: MeleeGuid;
  TableLocation: string | null;
  TableSection: string | null;
  StaffAssigned: boolean;
  StaffWatchers: unknown[];
  ByeReasonDescription: string | null;
  LossReasonDescription: string | null;
  ResultString: string; // e.g., "Not reported"
  AdminResultString: string; // e.g., "Not reported"
  RoundDescription: string; // e.g., "Round 5"
  TableNumberDescription: string | null; // null for byes
  TypeDescription: string; // e.g., "Best of Three"
  FormatDescription: string;
  AcknowledgedDecklists: boolean;
  AcknowledgedPlayers: boolean;
  GhostMatch: boolean;
  MetaValueForName: string;
}

/**
 * A competitor entry in a match. For tabletop Magic this is usually one team
 * with one player, but the shape supports team events.
 */
export interface MeleeMatchCompetitor {
  Team: MeleeTeam;
  ID: number;
  CheckedIn: MeleeDateTime | null; // Timestamp when checked in, null otherwise
  ResultConfirmed: MeleeDateTime | null; // Timestamp when result confirmed, null otherwise
  SortOrder: number;
  GameByes: number | null;
  GameWins: number | null;
  TeamId: number;
  GameWinsAndGameByes: number;
  Decklists: MeleeMatchDecklist[];
}

/**
 * Team information attached to a match competitor.
 */
export interface MeleeTeam {
  Players: MeleePlayer[];
  ID: number;
  Name: string | null;
  StatusDescription: string; // e.g., "Active"
  IsActive: boolean;
}

/**
 * Player profile information returned inside a match competitor.
 */
export interface MeleePlayer {
  TeamId: number;
  ID: number;
  ScreenName: string;
  MetadataDictionary: Record<string, unknown>;
  ProfileImageVersion: number;
  DisplayName: string;
  DisplayNameLastFirst: string;
  Username: string;
  ArenaScreenName: string;
  DciNumber: string | null;
  DiscordUsername: string | null;
  FirstName: string;
  GemPlayerId: string | null;
  LastName: string;
  MtgoScreenName: string | null;
  Name: string;
  NameLastFirst: string;
  AsmoConnectId: string | null;
  LanguageDescription: string;
  PronounsDescription: string | null;
}

/**
 * Decklist reference attached to a match competitor.
 */
export interface MeleeMatchDecklist {
  DecklistId: MeleeGuid;
  PlayerId: number;
  DecklistName: string;
  Format: string;
  FormatId: MeleeGuid;
}

/**
 * Player decklist response from Melee API.
 */
export interface MeleeDecklistResponse {
  DateCreated: MeleeDateTime;
  LastUpdated: MeleeDateTime;
  TournamentDecklistSubmissionEndDate: MeleeDateTime | null;
  TournamentStartDate: MeleeDateTime;
  Attributes: MeleeDecklistAttribute[];
  ValidationErrors: unknown[];
  Records: MeleeDecklistRecord[];
  TeamStatus: number; // e.g., 2
  TournamentStatus: number; // e.g., 2
  ScreenshotGuid: MeleeGuid;
  ScreenshotVersion: number;
  SortDate: MeleeDateTime;
  TeamId: number;
  PlayerId: number;
  TournamentId: number;
  AdminGivenName: string | null;
  DiscordUsername: string | null;
  FormatId: MeleeGuid;
  FormatName: string;
  Game: string; // e.g., "MagicTheGathering"
  Guid: MeleeGuid;
  Name: string;
  OrganizationId: number;
  OrganizationName: string;
  AiGeneratedName: string | null;
  OwnerDisplayName: string;
  TournamentName: string;
  TournamentPublicDecklists: boolean;
  TwitchChannel: string | null;
  OwnerFirstName: string;
  OwnerLastName: string;
  OwnerNameFirstLast: string;
  OwnerNameLastFirst: string;
  OwnerUsername: string;
  OwnerPronouns: string | null;
  IsValid: boolean;
  DecklistName: string;
  OwnerName: string;
  IsPublic: boolean;
  TeamRank: number | null;
  TeamMatchWins: number | null;
  TeamMatchLosses: number | null;
  TeamMatchDraws: number | null;
  LastDeckUpdateByOwner: MeleeDateTime | null;
  IsSubmissionOpen: boolean;
  TeamStatusDescription: string; // e.g., "Active"
  TournamentStatusDescription: string; // e.g., "In Progress"
  OwnerPronounsDescription: string | null;
  GameDescription: string; // e.g., "Magic: The Gathering"
  FormatDescription: string;
  TournamentScreenshotGuid: MeleeGuid | null;
}

/**
 * Attribute entry attached to a Melee decklist.
 */
export interface MeleeDecklistAttribute {
  k: string;
  v: string;
  p: string | null;
}

/**
 * Individual card row in a Melee decklist.
 */
export interface MeleeDecklistRecord {
  l: string; // Normalized card name / lookup key
  n: string; // Display card name
  s: string | null; // Unknown purpose; null in all sampled data
  q: number; // Quantity
  c: number; // Category/section, e.g. 0 main deck and 99 sideboard
  t: string; // Card type
}

