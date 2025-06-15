import { v } from "convex/values";

// Base Validators

export const settingsValidator = v.object({
  _id: v.id("settings"),
  userId: v.id("users"),
  spicerackApiKey: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const tournamentValidator = v.object({
  _id: v.id("tournaments"),
  userId: v.id("users"), // Direct user ownership
  mode: v.union(v.literal("manual"), v.literal("auto")),
  spicerackId: v.optional(v.number()),
  spicerackTournamentStatus: v.optional(
    v.union(v.literal("active"), v.literal("completed")),
  ),
  currentRound: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const featureMatchValidator = v.object({
  _id: v.id("featureMatches"),
  externalId: v.string(), // Spicerack Tournament ID + Round Number + Player 1 Name + Player 2 Name
  tournamentId: v.id("tournaments"),
  roundNumber: v.number(),
  player1: v.id("players"),
  player2: v.id("players"),
  tableNumber: v.optional(v.number()),
  timerExpiry: v.optional(v.number()), // Unix timestamp
  timerRunning: v.boolean(),
  createdAt: v.number(),
});

// Overlay Type Validators
export const overlayTypeValidator = v.union(
  v.literal("match"),
  v.literal("card"),
  v.literal("deck"),
  v.literal("standings"),
);

// Different overlay validators
export const matchOverlayValidator = v.object({
  _id: v.id("overlays"),
  name: v.string(),
  overlayType: v.literal("match"),
  tournamentId: v.id("tournaments"),
  publicUuid: v.string(), // Direct UUID string for public access
  player1: v.optional(v.id("players")),
  player2: v.optional(v.id("players")),
  player1Life: v.number(),
  player2Life: v.number(),
  player1GamesWon: v.number(),
  player2GamesWon: v.number(),
  // Manual override fields for display
  player1DisplayName: v.optional(v.string()),
  player2DisplayName: v.optional(v.string()),
  player1DisplayDeck: v.optional(v.string()),
  player2DisplayDeck: v.optional(v.string()),
  player1TournamentRecord: v.optional(v.string()),
  player2TournamentRecord: v.optional(v.string()),
  createdAt: v.number(),
});

export const cardOverlayValidator = v.object({
  _id: v.id("overlays"),
  name: v.string(),
  overlayType: v.literal("card"),
  tournamentId: v.id("tournaments"),
  publicUuid: v.string(), // Direct UUID string for public access
  cardUrl: v.string(),
  createdAt: v.number(),
});

export const deckOverlayValidator = v.object({
  _id: v.id("overlays"),
  name: v.string(),
  overlayType: v.literal("deck"),
  tournamentId: v.id("tournaments"),
  publicUuid: v.string(), // Direct UUID string for public access
  matchId: v.optional(v.id("featureMatches")),
  createdAt: v.number(),
});

export const standingsOverlayValidator = v.object({
  _id: v.id("overlays"),
  name: v.string(),
  overlayType: v.literal("standings"),
  tournamentId: v.id("tournaments"),
  publicUuid: v.string(), // Direct UUID string for public access
  roundNumber: v.number(),
  topPlayers: v.array(
    v.object({
      playerId: v.id("players"),
      rank: v.number(),
      record: v.string(),
      points: v.number(),
    }),
  ),
  createdAt: v.number(),
});

export const overlayValidator = v.union(
  matchOverlayValidator,
  cardOverlayValidator,
  deckOverlayValidator,
  standingsOverlayValidator,
);

export const playerValidator = v.object({
  _id: v.id("players"),
  name: v.string(),
  tournamentId: v.id("tournaments"),
  deckName: v.string(), // Archetype name
  deckList: v.string(), // Plaintext deck list
  record: v.string(), // Tournament record like "2-1"
  createdAt: v.number(),
});

// Expanded Validators
export const matchOverlayWithPlayersValidator = v.object({
  ...matchOverlayValidator.fields,
  player1Data: v.optional(playerValidator),
  player2Data: v.optional(playerValidator),
});

export const featureMatchWithPlayersValidator = v.object({
  ...featureMatchValidator.fields,
  player1Data: playerValidator,
  player2Data: playerValidator,
});

export const deckOverlayWithMatchAndPlayersValidator = v.object({
  ...deckOverlayValidator.fields,
  matchData: featureMatchWithPlayersValidator,
});

// Getters
export const getUserOverlaysValidator = v.array(
  v.object({
    _id: v.id("overlays"),
    type: overlayTypeValidator,
    name: v.string(),
    publicUuid: v.string(),
  }),
);

export const getOverlayByIdValidator = v.union(
  matchOverlayWithPlayersValidator,
  cardOverlayValidator,
  deckOverlayWithMatchAndPlayersValidator,
  standingsOverlayValidator,
);

export const getOverlayByUuidValidator = v.union(
  matchOverlayWithPlayersValidator,
  cardOverlayValidator,
  deckOverlayWithMatchAndPlayersValidator,
  standingsOverlayValidator,
  v.null(),
);
