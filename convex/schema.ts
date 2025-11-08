import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import {
  overlayValidator,
  playerValidator,
  tournamentValidator,
  settingsValidator,
  featureMatchValidator,
  templateValidator,
  spicerackLogValidator,
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
    .index("by_spicerack_id", ["spicerackTournamentId"])
    .index("by_mode_and_status", ["mode", "spicerackTournamentStatus"]),

  // Unified Overlays Table with discriminated union and direct UUID
  overlays: defineTable(overlayValidator)
    .index("by_tournament", ["tournamentId"])
    .index("by_public_uuid", ["publicUuid"])
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
    .index("by_external_id", ["externalId"]),

  // Players table
  players: defineTable(playerValidator)
    .index("by_name", ["name"])
    .index("by_tournament", ["tournamentId"])
    .index("by_external_id", ["externalId"]),

  // Spicerack Debug Logs table
  spicerackLogs: defineTable(spicerackLogValidator)
    .index("by_user", ["userId"])
    .index("by_user_and_timestamp", ["userId", "timestamp"]),
});
