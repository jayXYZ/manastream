import { v } from "convex/values";

// Base Validators

export const settingsValidator = v.object({
  _id: v.id("settings"),
  _creationTime: v.number(),
  userId: v.id("users"),
  spicerackApiKey: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const tournamentValidator = v.object({
  _id: v.id("tournaments"),
  _creationTime: v.number(),
  eventName: v.optional(v.string()),
  userId: v.id("users"), // Direct user ownership
  mode: v.union(v.literal("manual"), v.literal("auto")),
  spicerackTournamentId: v.optional(v.number()),
  spicerackTournamentStatus: v.optional(
    v.union(v.literal("active"), v.literal("completed")),
  ),
  spicerackPollingStatus: v.optional(
    v.union(v.literal("active"), v.literal("inactive"), v.literal("error")),
  ),
  spicerackErrorMessage: v.optional(v.string()),
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

export const spicerackTournamentValidator = v.object({
  _id: v.id("spicerackTournaments"),
  _creationTime: v.number(),
  spicerackTournamentId: v.number(),
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
  externalId: v.string(), // Spicerack Tournament ID + Round ID + Player 1 Name + Player 2 Name
  spicerackTournamentId: v.optional(v.number()),
  tournamentId: v.optional(v.id("tournaments")),
  roundNumber: v.number(),
  player1: v.id("players"),
  player2: v.id("players"),
  player1TournamentRecord: v.string(),
  player2TournamentRecord: v.string(),
  tableNumber: v.optional(v.number()),
  spicerackTimerExpiry: v.optional(v.number()), // Unix timestamp
  spicerackTimerRunning: v.optional(v.boolean()),
  createdAt: v.number(),
});

export const playerInStandingsValidator = v.object({
  rank: v.number(),
  player_id: v.number(),
  name: v.string(),
  match_points: v.number(),
  record: v.string(),
  match_win_percentage: v.number(),
  opponent_match_win_percentage: v.number(),
  game_win_percentage: v.number(),
  opponent_game_win_percentage: v.number(),
  opponent_average_match_points: v.number(),
  wins: v.number(),
  losses: v.number(),
  draws: v.number(),
  games_won: v.number(),
  games_lost: v.number(),
  games_drawn: v.number(),
  playoff_wins: v.number(),
  playoff_losses: v.number(),
  user_event_status_ids: v.array(v.number()),
});

export const roundStandingsValidator = v.object({
  _id: v.id("roundStandings"),
  _creationTime: v.number(),
  spicerackRoundId: v.number(),
  spicerackTournamentId: v.number(),
  roundNumber: v.union(v.number(), v.literal("PENDING")),
  standings: v.union(v.array(playerInStandingsValidator), v.literal("PENDING")),
  updatedAt: v.number(),
});

export const decklistStatusValidator = v.union(
  v.literal("missing"),
  v.literal("pending"),
  v.literal("ready"),
  v.literal("fetch_failed"),
  v.literal("manual"),
);

export const spicerackRoundStandingsDataValidator = v.object({
  round_number: v.number(),
  standings: v.array(playerInStandingsValidator),
});

// Overlay Type Validators
export const overlayTypeValidator = v.union(
  v.literal("match"),
  v.literal("card"),
  v.literal("deck"),
  v.literal("standings"),
  v.literal("commentary"),
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

  publicUuid: v.string(), // Direct UUID string for public access
  roundStandingsId: v.optional(v.id("roundStandings")), // Reference to the round standings
  spicerackRoundId: v.optional(v.number()),
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
  spicerackPlayerId: v.number(),
  tournamentId: v.optional(v.id("tournaments")),
  spicerackTournamentId: v.optional(v.number()),
  deckId: v.number(),
  decklistStatus: v.optional(decklistStatusValidator),
  deckName: v.string(), // Archetype name
  deckList: v.string(), // Plaintext deck list
  updatedAt: v.number(),
});

export const spicerackLogValidator = v.object({
  _id: v.id("spicerackLogs"),
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
  player1Data: v.optional(playerValidator),
  player2Data: v.optional(playerValidator),
  manualTimerExpiry: v.optional(v.number()),
  manualTimerRunning: v.optional(v.boolean()),
});

export const featureMatchWithPlayersValidator = v.union(
  v.object({
    ...featureMatchValidator.fields,
    player1Data: v.optional(playerValidator),
    player2Data: v.optional(playerValidator),
  }),
  v.null(),
);

export const deckOverlayWithMatchAndPlayersValidator = v.object({
  ...deckOverlayValidator.fields,
  matchData: featureMatchWithPlayersValidator,
});

export const standingsOverlayWithPlayersValidator = v.object({
  ...standingsOverlayValidator.fields,
  standingsDataWithPlayers: v.optional(
    v.array(
      v.object({
        ...playerInStandingsValidator.fields,
        playerData: v.optional(playerValidator),
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
});

// Spicerack API Validators

export const spicerackUserValidator = v.object({
  id: v.number(),
  username: v.optional(v.string()),
  best_identifier: v.string(),
  email: v.optional(v.string()),
});

export const spicerackUserEventStatusValidator = v.object({
  id: v.number(),
  user: spicerackUserValidator,
  decklist: v.union(v.number(), v.null()),
  registration_status: v.string(),
  final_place_in_standings: v.union(v.number(), v.null()),
  matches_won: v.number(),
  matches_lost: v.number(),
  matches_drawn: v.number(),
  total_match_points: v.number(),
});

export const spicerackPlayerMatchRelationshipValidator = v.object({
  id: v.number(),
  user_event_status: spicerackUserEventStatusValidator,
  games_won: v.number(),
  points_gained: v.number(),
  player_order: v.number(),
});

export const spicerackMatchValidator = v.object({
  id: v.number(),
  is_feature_match: v.boolean(),
  table_number: v.number(),
  status: v.string(),
  player_match_relationships: v.array(
    spicerackPlayerMatchRelationshipValidator,
  ),
});
