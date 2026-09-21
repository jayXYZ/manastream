import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import {
  overlayValidator,
  playerValidator,
  playerStatusValidator,
  playerDecklistValidator,
  tournamentValidator,
  settingsValidator,
  featureMatchValidator,
  templateValidator,
  integrationLogValidator,
  externalTournamentValidator,
  pollingSessionValidator,
  roundStandingsValidator,
  pairingValidator,
  scryfallCardCacheValidator,
} from "./validators";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
export default defineSchema({
  ...authTables,

  // Settings table
  settings: defineTable(settingsValidator).index("by_user", ["userId"]),

  // Tournaments table - directly owned by users
  tournaments: defineTable(tournamentValidator)
    .index("by_user", ["userId"])
    .index("by_external_tournament_id", ["externalTournamentId"])
    .index("by_mode_and_status", ["mode", "externalTournamentStatus"]),

  // Per-tournament polling session bookkeeping (claim/cycle tokens)
  pollingSessions: defineTable(pollingSessionValidator).index("by_tournament", [
    "tournamentId",
  ]),

  // External (Melee) tournaments table
  externalTournaments: defineTable(externalTournamentValidator).index(
    "by_external_tournament_id",
    ["externalTournamentId"],
  ),
  // Round Standings table
  roundStandings: defineTable(roundStandingsValidator)
    .index("by_external_round_id", ["externalRoundId"])
    .index("by_external_tournament_id", ["externalTournamentId"]),

  // Unified Overlays Table with discriminated union and direct UUID
  overlays: defineTable(overlayValidator)
    .index("by_tournament", ["tournamentId"])
    .index("by_public_uuid", ["publicUuid"])
    .index("by_matchId", ["matchId"])
    .index("by_overlay_type", ["overlayType"]),

  // Templates table
  templates: defineTable(templateValidator).index("by_user", ["userId"]),

  // Connected Lifetrackers table
  connectedLifeTrackers: defineTable({
    userId: v.id("users"),
    overlayId: v.id("overlays"),
    sessionId: v.string(),
    lastSeen: v.number(),
    createdAt: v.number(),
  })
    .index("by_user_and_session", ["userId", "sessionId"])
    .index("by_overlay", ["overlayId"]),

  // Feature Matches table - enhanced for better API/manual integration
  featureMatches: defineTable(featureMatchValidator)
    .index("by_tournament_and_round", ["tournamentId", "roundNumber"])
    .index("by_external_id", ["externalId"])
    .index("by_external_tournament_id", ["externalTournamentId"]),

  pairings: defineTable(pairingValidator)
    .index("by_tournament_and_round", ["tournamentId", "roundNumber"])
    .index("by_external_round", ["externalRoundId"])
    .index("by_external_id", ["externalId"]),

  // Players table
  players: defineTable(playerValidator)
    .index("by_external_tournament_id", ["externalTournamentId"])
    .index("by_tournament", ["tournamentId"])
    .index("by_external_player_id", ["externalPlayerId"])
    .index("by_external_tournament_id_and_external_player_id", [
      "externalTournamentId",
      "externalPlayerId",
    ]),

  playerStatuses: defineTable(playerStatusValidator)
    .index("by_player_id", ["playerId"])
    .index("by_external_tournament_id", ["externalTournamentId"])
    .index("by_external_tournament_id_and_external_player_id", [
      "externalTournamentId",
      "externalPlayerId",
    ]),

  playerDecklists: defineTable(playerDecklistValidator)
    .index("by_player_id", ["playerId"])
    .index("by_external_tournament_id", ["externalTournamentId"])
    .index("by_external_tournament_id_and_external_player_id", [
      "externalTournamentId",
      "externalPlayerId",
    ])
    .index("by_external_tournament_id_and_decklist_status", [
      "externalTournamentId",
      "decklistStatus",
    ]),

  scryfallCardCache: defineTable(scryfallCardCacheValidator)
    .index("by_cache_key", ["cacheKey"])
    .index("by_normalized_name", ["normalizedName"]),

  // Integration Debug Logs table
  integrationLogs: defineTable(integrationLogValidator)
    .index("by_user", ["userId"])
    .index("by_user_and_timestamp", ["userId", "timestamp"])
    .index("by_timestamp", ["timestamp"]),
});
