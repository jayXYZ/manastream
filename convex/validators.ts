import { v } from "convex/values";

// Base Validators

export const settingsValidator = v.object({
  _id: v.id("settings"),
  _creationTime: v.number(),
  userId: v.id("users"),
  meleeClientId: v.optional(v.string()),
  meleeClientSecret: v.optional(v.string()),
  // Legacy credential fields kept during the rename migration window.
  meleeUsername: v.optional(v.string()),
  meleePassword: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const tournamentValidator = v.object({
  _id: v.id("tournaments"),
  _creationTime: v.number(),
  eventName: v.optional(v.string()),
  userId: v.id("users"), // Direct user ownership
  mode: v.union(v.literal("manual"), v.literal("auto")),
  externalTournamentId: v.optional(v.number()),
  externalTournamentStatus: v.optional(
    v.union(v.literal("active"), v.literal("completed")),
  ),
  pollingStatus: v.optional(
    v.union(v.literal("active"), v.literal("inactive"), v.literal("error")),
  ),
  pollingErrorMessage: v.optional(v.string()),
  currentRound: v.optional(v.number()),
  currentRoundDisplayName: v.optional(v.string()),
  manualTimerExpiry: v.optional(v.number()),
  manualTimerSecondsRemaining: v.optional(v.number()),
  manualTimerPausedAt: v.optional(v.union(v.number(), v.null())),
  manualTimerRunning: v.boolean(),
  manualTimerCountDirection: v.optional(
    v.union(v.literal("up"), v.literal("down")),
  ),
  // Commentator info (broadcast-level, shared across overlays)
  commentatorLeft: v.optional(v.string()),
  commentatorLeftSubText: v.optional(v.string()),
  commentatorRight: v.optional(v.string()),
  commentatorRightSubText: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const externalTournamentValidator = v.object({
  _id: v.id("externalTournaments"),
  _creationTime: v.number(),
  externalTournamentId: v.number(),
  name: v.optional(v.string()),
  currentRoundId: v.optional(v.number()),
  currentRoundNumber: v.optional(v.number()),
  currentRoundName: v.optional(v.string()),
  completedRounds: v.optional(
    v.array(
      v.object({
        roundId: v.number(),
        roundName: v.string(),
      }),
    ),
  ),
  updatedAt: v.number(),
});

export const featureMatchValidator = v.object({
  _id: v.id("featureMatches"),
  _creationTime: v.number(),
  externalId: v.string(), // feature:{externalTournamentId}:{externalMatchId}
  externalTournamentId: v.optional(v.number()),
  tournamentId: v.optional(v.id("tournaments")),
  externalRoundId: v.optional(v.number()),
  roundNumber: v.number(),
  player1: v.id("players"),
  player2: v.id("players"),
  player1TournamentRecord: v.string(),
  player2TournamentRecord: v.string(),
  tableNumber: v.optional(v.number()),
  createdAt: v.number(),
});

export const pairingValidator = v.object({
  _id: v.id("pairings"),
  _creationTime: v.number(),
  externalId: v.string(),
  externalTournamentId: v.number(),
  tournamentId: v.id("tournaments"),
  externalRoundId: v.number(),
  roundNumber: v.number(),
  externalMatchId: v.string(), // Melee match GUID
  player1: v.id("players"),
  player2: v.id("players"),
  player1TournamentRecord: v.string(),
  player2TournamentRecord: v.string(),
  player1Seed: v.optional(v.number()),
  player2Seed: v.optional(v.number()),
  player1TotalMatchPoints: v.optional(v.number()),
  player2TotalMatchPoints: v.optional(v.number()),
  tableNumber: v.optional(v.number()),
  status: v.string(),
  createdAt: v.number(),
});

export const standingRowValidator = v.object({
  rank: v.number(),
  externalPlayerId: v.number(),
  name: v.string(),
  record: v.string(),
  matchPoints: v.number(),
  wins: v.number(),
  losses: v.number(),
  draws: v.number(),
  gameWinPercentage: v.number(),
  opponentMatchWinPercentage: v.number(),
  opponentGameWinPercentage: v.number(),
});

export const roundStandingsValidator = v.object({
  _id: v.id("roundStandings"),
  _creationTime: v.number(),
  externalRoundId: v.number(),
  externalTournamentId: v.number(),
  roundNumber: v.union(v.number(), v.literal("PENDING")),
  standings: v.union(v.array(standingRowValidator), v.literal("PENDING")),
  updatedAt: v.number(),
});

export const decklistStatusValidator = v.union(
  v.literal("missing"),
  v.literal("pending"),
  v.literal("ready"),
  v.literal("fetch_failed"),
  v.literal("manual"),
);

export const deckCardsStatusValidator = v.union(
  v.literal("pending"),
  v.literal("ready"),
  v.literal("partial"),
  v.literal("failed"),
);

export const resolvedDeckCardValidator = v.object({
  count: v.number(),
  name: v.string(),
  imageUrl: v.optional(v.string()),
  typeLine: v.string(),
  legality: v.optional(v.string()),
  scryfallId: v.optional(v.string()),
  unresolved: v.optional(v.boolean()),
});

export const resolvedDeckCardsValidator = v.object({
  mainboard: v.array(resolvedDeckCardValidator),
  sideboard: v.array(resolvedDeckCardValidator),
  unresolvedNames: v.array(v.string()),
  resolvedAt: v.number(),
});

export const scryfallCardCacheValidator = v.object({
  cacheKey: v.string(),
  normalizedName: v.string(),
  name: v.string(),
  policy: v.string(),
  status: v.union(v.literal("resolved"), v.literal("unresolved")),
  imageUrl: v.optional(v.string()),
  typeLine: v.string(),
  legality: v.optional(v.string()),
  scryfallId: v.optional(v.string()),
  lastError: v.optional(v.string()),
  updatedAt: v.number(),
});

export const roundStandingsDataValidator = v.object({
  roundNumber: v.number(),
  standings: v.array(standingRowValidator),
});

// Overlay Type Validators
export const overlayTypeValidator = v.union(
  v.literal("match"),
  v.literal("card"),
  v.literal("deck"),
  v.literal("standings"),
  v.literal("commentary"),
);

export const lc26BackgroundColorValidator = v.union(
  v.literal("White"),
  v.literal("Blue"),
  v.literal("Black"),
  v.literal("Red"),
  v.literal("Green"),
  v.literal("Gold"),
);

export const braunDarkPaletteValidator = v.union(
  v.literal("Dark"),
  v.literal("Maroon"),
);

// Different overlay validators
export const matchOverlayValidator = v.object({
  _id: v.id("overlays"),
  _creationTime: v.number(),
  name: v.string(),
  overlayType: v.literal("match"),
  template: v.union(
    v.literal("Duress Crew"),
    v.literal("Lobstercon"),
    v.literal("Default"),
    v.literal("Custom"),
    v.literal("Braun Dark"),
    v.literal("LC26"),
  ),
  templateId: v.optional(v.id("templates")),
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
  player1Lc26BackgroundColor: v.optional(lc26BackgroundColorValidator),
  player2Lc26BackgroundColor: v.optional(lc26BackgroundColorValidator),
  braunDarkPalette: v.optional(braunDarkPaletteValidator),
  createdAt: v.number(),
});

export const cardTemplatesValidator = v.union(
  v.literal("Default"),
  v.literal("Braun Dark"),
);

export const deckTemplatesValidator = v.union(
  v.literal("Duress Crew"),
  v.literal("Braun Dark"),
);

export const cardOverlayValidator = v.object({
  _id: v.id("overlays"),
  _creationTime: v.number(),
  name: v.string(),
  overlayType: v.literal("card"),
  template: v.optional(cardTemplatesValidator),
  braunDarkPalette: v.optional(braunDarkPaletteValidator),
  tournamentId: v.id("tournaments"),
  publicUuid: v.string(), // Direct UUID string for public access
  cardUrl: v.string(),
  createdAt: v.number(),
});

export const deckOverlayValidator = v.object({
  _id: v.id("overlays"),
  _creationTime: v.number(),
  name: v.string(),
  overlayType: v.literal("deck"),
  template: v.optional(deckTemplatesValidator),
  braunDarkPalette: v.optional(braunDarkPaletteValidator),
  tournamentId: v.id("tournaments"),
  publicUuid: v.string(), // Direct UUID string for public access
  matchId: v.optional(v.id("featureMatches")),
  createdAt: v.number(),
});

export const standingsOverlayValidator = v.object({
  _id: v.id("overlays"),
  _creationTime: v.number(),
  name: v.string(),
  overlayType: v.literal("standings"),
  tournamentId: v.id("tournaments"),
  braunDarkPalette: v.optional(braunDarkPaletteValidator),

  publicUuid: v.string(), // Direct UUID string for public access
  roundStandingsId: v.optional(v.id("roundStandings")), // Reference to the round standings
  externalRoundId: v.optional(v.number()),
  showCurrentBracket: v.optional(v.boolean()),
  createdAt: v.number(),
});

export const commentaryOverlayValidator = v.object({
  _id: v.id("overlays"),
  _creationTime: v.number(),
  name: v.string(),
  overlayType: v.literal("commentary"),
  tournamentId: v.id("tournaments"),
  publicUuid: v.string(), // Direct UUID string for public access
  template: v.union(
    v.literal("Duress Crew"),
    v.literal("Lobstercon"),
    v.literal("Default"),
    v.literal("Custom"),
    v.literal("Braun Dark"),
    v.literal("Braun Dark Duo"),
  ),
  templateId: v.optional(v.id("templates")),
  braunDarkPalette: v.optional(braunDarkPaletteValidator),
  commentatorLeft: v.string(),
  commentatorLeftSubText: v.optional(v.string()),
  commentatorRight: v.string(),
  commentatorRightSubText: v.optional(v.string()),
  createdAt: v.number(),
});

export const overlayValidator = v.union(
  matchOverlayValidator,
  cardOverlayValidator,
  deckOverlayValidator,
  standingsOverlayValidator,
  commentaryOverlayValidator,
);

export const templateValidator = v.object({
  _id: v.id("templates"),
  _creationTime: v.number(),
  userId: v.id("users"),
  name: v.string(),
  template: v.any(),
  createdAt: v.number(),
});

export const matchTemplatesValidator = v.union(
  v.literal("Duress Crew"),
  v.literal("Lobstercon"),
  v.literal("Default"),
  v.literal("Custom"),
  v.literal("Braun Dark"),
  v.literal("LC26"),
);

export const commentaryTemplatesValidator = v.union(
  v.literal("Duress Crew"),
  v.literal("Lobstercon"),
  v.literal("Default"),
  v.literal("Custom"),
  v.literal("Braun Dark"),
  v.literal("Braun Dark Duo"),
);

export const overlayTemplatesValidator = v.union(
  matchTemplatesValidator,
  commentaryTemplatesValidator,
  cardTemplatesValidator,
  deckTemplatesValidator,
);

export const playerValidator = v.object({
  _id: v.id("players"),
  _creationTime: v.number(),
  name: v.string(),
  externalPlayerId: v.number(),
  // Deprecated during player data split migration. Use playerStatuses.
  registrationStatus: v.optional(v.string()),
  tournamentId: v.optional(v.id("tournaments")),
  externalTournamentId: v.optional(v.number()),
  // Deprecated during player data split migration. Use playerDecklists.
  externalDecklistId: v.optional(v.string()),
  decklistStatus: v.optional(decklistStatusValidator),
  deckName: v.optional(v.string()), // Archetype name
  deckList: v.optional(v.string()), // Plaintext deck list
  deckCardsStatus: v.optional(deckCardsStatusValidator),
  deckCards: v.optional(resolvedDeckCardsValidator),
  updatedAt: v.number(),
});

export const playerStatusValidator = v.object({
  _id: v.id("playerStatuses"),
  _creationTime: v.number(),
  playerId: v.id("players"),
  externalTournamentId: v.number(),
  externalPlayerId: v.number(),
  registrationStatus: v.optional(v.string()),
  updatedAt: v.number(),
});

export const playerDecklistValidator = v.object({
  _id: v.id("playerDecklists"),
  _creationTime: v.number(),
  playerId: v.id("players"),
  externalTournamentId: v.number(),
  externalPlayerId: v.number(),
  externalDecklistId: v.optional(v.string()), // Melee decklist GUID
  decklistStatus: v.optional(decklistStatusValidator),
  deckName: v.string(), // Archetype name
  deckList: v.string(), // Plaintext deck list
  deckCardsStatus: v.optional(deckCardsStatusValidator),
  deckCards: v.optional(resolvedDeckCardsValidator),
  updatedAt: v.number(),
});

export const playerWithDataValidator = v.object({
  ...playerValidator.fields,
  registrationStatus: v.optional(v.string()),
  externalDecklistId: v.optional(v.string()),
  decklistStatus: v.optional(decklistStatusValidator),
  deckName: v.string(),
  deckList: v.string(),
});

export const rankedPairingWithPlayersValidator = v.object({
  ...pairingValidator.fields,
  player1Data: v.optional(playerWithDataValidator),
  player2Data: v.optional(playerWithDataValidator),
  rank: v.number(),
  player1MacroArchetype: v.optional(v.string()),
  player2MacroArchetype: v.optional(v.string()),
  uniquenessScore: v.optional(v.number()),
  hasKnownDecks: v.boolean(),
});

export const currentRoundPairingsResultValidator = v.object({
  status: v.union(
    v.literal("ready"),
    v.literal("no_tournament"),
    v.literal("no_linked_tournament"),
    v.literal("no_current_round"),
    v.literal("no_pairings"),
  ),
  roundNumber: v.optional(v.number()),
  roundName: v.optional(v.string()),
  pairingCount: v.number(),
  pairings: v.array(rankedPairingWithPlayersValidator),
});

export const integrationLogValidator = v.object({
  _id: v.id("integrationLogs"),
  _creationTime: v.number(),
  userId: v.id("users"),
  timestamp: v.number(),
  action: v.string(),
  status: v.union(
    v.literal("success"),
    v.literal("error"),
    v.literal("info"),
    v.literal("warning"),
  ),
  message: v.string(),
  tournamentId: v.optional(v.id("tournaments")),
  metadata: v.optional(v.any()),
});

// Expanded Validators
export const matchOverlayWithPlayersValidator = v.object({
  ...matchOverlayValidator.fields,
  player1Data: v.optional(playerWithDataValidator),
  player2Data: v.optional(playerWithDataValidator),
  manualTimerExpiry: v.optional(v.number()),
  manualTimerRunning: v.optional(v.boolean()),
});

export const featureMatchWithPlayersValidator = v.union(
  v.object({
    ...featureMatchValidator.fields,
    player1Data: v.optional(playerWithDataValidator),
    player2Data: v.optional(playerWithDataValidator),
  }),
  v.null(),
);

export const deckOverlayWithMatchAndPlayersValidator = v.object({
  ...deckOverlayValidator.fields,
  matchData: featureMatchWithPlayersValidator,
});

export const standingsOverlayWithPlayersValidator = v.object({
  ...standingsOverlayValidator.fields,
  roundDisplayName: v.optional(v.string()),
  isEliminationPhase: v.optional(v.boolean()),
  bracketDataWithPlayers: v.optional(
    v.array(
      v.object({
        name: v.string(),
        rank: v.number(),
        seed: v.optional(v.number()),
        playerData: v.optional(playerWithDataValidator),
      }),
    ),
  ),
  standingsDataWithPlayers: v.optional(
    v.array(
      v.object({
        ...standingRowValidator.fields,
        seed: v.optional(v.number()),
        playerData: v.optional(playerWithDataValidator),
      }),
    ),
  ),
});

// Getters
export const getOverlayByIdValidator = v.union(
  matchOverlayWithPlayersValidator,
  cardOverlayValidator,
  deckOverlayWithMatchAndPlayersValidator,
  standingsOverlayWithPlayersValidator,
  commentaryOverlayValidator,
);

export const getOverlayByUuidValidator = v.union(
  matchOverlayWithPlayersValidator,
  cardOverlayValidator,
  deckOverlayWithMatchAndPlayersValidator,
  standingsOverlayWithPlayersValidator,
  commentaryOverlayValidator,
  v.null(),
);

export const getTournamentInfoValidator = v.object({
  eventName: v.optional(v.string()),
  currentRound: v.optional(v.number()),
  currentRoundDisplayName: v.optional(v.string()),
  manualTimerExpiry: v.optional(v.number()),
  manualTimerRunning: v.optional(v.boolean()),
  manualTimerCountDirection: v.optional(
    v.union(v.literal("up"), v.literal("down")),
  ),
  manualTimerPausedAt: v.optional(v.number()),
  // Commentator info for overlays
  commentatorLeft: v.optional(v.string()),
  commentatorLeftSubText: v.optional(v.string()),
  commentatorRight: v.optional(v.string()),
  commentatorRightSubText: v.optional(v.string()),
});

// Validator for updateMatchOverlay arguments
// These fields are picked from matchOverlayValidator and made optional for updates
export const updateMatchOverlayArgsValidator = v.object({
  overlayId: v.id("overlays"),
  // Life totals
  player1Life: v.optional(v.number()),
  player2Life: v.optional(v.number()),
  // Games won
  player1GamesWon: v.optional(v.number()),
  player2GamesWon: v.optional(v.number()),
  // Display overrides
  player1DisplayName: v.optional(v.string()),
  player2DisplayName: v.optional(v.string()),
  player1DisplayDeck: v.optional(v.string()),
  player2DisplayDeck: v.optional(v.string()),
  player1TournamentRecord: v.optional(v.string()),
  player2TournamentRecord: v.optional(v.string()),
  player1Lc26BackgroundColor: v.optional(lc26BackgroundColorValidator),
  player2Lc26BackgroundColor: v.optional(lc26BackgroundColorValidator),
});

// Provider-neutral sync validators
// The polling action composes provider API responses into a compact
// RoundSnapshot so mutations receive validated, minimal data instead of
// raw provider JSON.

export const snapshotCompetitorValidator = v.object({
  externalPlayerId: v.number(),
  name: v.string(),
  externalDecklistId: v.optional(v.string()),
  decklistName: v.optional(v.string()),
  tournamentRecord: v.string(),
  matchPoints: v.optional(v.number()),
  seed: v.optional(v.number()),
});

export const snapshotMatchValidator = v.object({
  externalMatchId: v.string(),
  tableNumber: v.optional(v.number()),
  isFeatureMatch: v.boolean(),
  hasResult: v.boolean(),
  competitors: v.array(snapshotCompetitorValidator),
});

export const roundSnapshotValidator = v.object({
  externalTournamentId: v.number(),
  roundId: v.number(),
  roundNumber: v.number(),
  roundDisplayName: v.string(),
  isEliminationRound: v.boolean(),
  matches: v.array(snapshotMatchValidator),
});
