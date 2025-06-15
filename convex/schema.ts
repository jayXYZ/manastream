import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import {
  overlayValidator,
  playerValidator,
  tournamentValidator,
  settingsValidator,
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
    .index("by_spicerack_id", ["spicerackId"]),

  // Unified Overlays Table with discriminated union and direct UUID
  overlays: defineTable(overlayValidator)
    .index("by_tournament", ["tournamentId"])
    .index("by_public_uuid", ["publicUuid"])
    .index("by_overlay_type", ["overlayType"]),

  // Connected Lifetrackers table
  connectedLifeTrackers: defineTable({
    userId: v.id("users"),
    overlayId: v.id("overlays"),
    sessionId: v.string(),
    lastSeen: v.number(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_overlay", ["overlayId"])
    .index("by_session", ["sessionId"]),

  // Feature Matches table - enhanced for better API/manual integration
  featureMatches: defineTable({
    externalId: v.string(), // Spicerack Tournament ID + Round Number + Player 1 Name + Player 2 Name
    tournamentId: v.id("tournaments"),
    roundNumber: v.number(),
    player1: v.id("players"),
    player2: v.id("players"),
    tableNumber: v.optional(v.number()),
    timerExpiry: v.optional(v.number()), // Unix timestamp
    timerRunning: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_tournament", ["tournamentId"])
    .index("by_tournament_and_round", ["tournamentId", "roundNumber"])
    .index("by_external_id", ["externalId"]),

  // Players table
  players: defineTable(playerValidator)
    .index("by_name", ["name"])
    .index("by_tournament", ["tournamentId"]),
});
