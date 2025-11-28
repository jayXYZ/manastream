import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { SpicerackTournamentPhase } from "./types/spicerack";
import { logSpicerackEvent } from "./lib/logging";
import { DEFAULT_MATCH, POLLING_INTERVAL } from "./lib/constants";
import {
  settingsValidator,
  spicerackTournamentValidator,
  tournamentValidator,
} from "./validators";
import { checkForNewSpicerackRound } from "./lib/spicerack/rounds";
import {
  fetchSpicerackEventData,
  fetchSpicerackEventOverviewData,
  fetchSpicerackDecklistData,
  fetchSpicerackRegisteredPlayers,
} from "./lib/spicerack/api";
import { createSpicerackTournamentHelper } from "./lib/spicerack/tournament";

export const updateNewSpicerackRound = internalMutation({
  args: {
    tournamentId: v.id("tournaments"),
    spicerackTournamentId: v.number(),
    spicerackNewRoundId: v.number(),
    spicerackNewRoundNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const spicerackTournament = await ctx.db
      .query("spicerackTournaments")
      .withIndex("by_spicerack_tournament_id", (q) =>
        q.eq("spicerackTournamentId", args.spicerackTournamentId),
      )
      .unique();
    if (!spicerackTournament) {
      throw new Error(
        `Spicerack tournament ${args.spicerackTournamentId} not found`,
      );
    }
    await ctx.db.patch(spicerackTournament._id, {
      currentRoundId: args.spicerackNewRoundId,
      currentRoundNumber: args.spicerackNewRoundNumber,
    });

    const tournamentOverlays = await ctx.db
      .query("overlays")
      .withIndex("by_tournament", (q) =>
        q.eq("tournamentId", args.tournamentId),
      )
      .collect();

    const matchOverlays = tournamentOverlays.filter(
      (overlay) => overlay.overlayType === "match",
    );

    for (let matchOverlay of matchOverlays) {
      await ctx.db.patch(matchOverlay._id, DEFAULT_MATCH);
    }
  },
});

export const updateSpicerackTournament = internalMutation({
  args: {
    spicerackTournamentId: v.number(),
    currentRoundId: v.optional(v.number()),
    currentRoundNumber: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const spicerackTournament = await ctx.db
      .query("spicerackTournaments")
      .withIndex("by_spicerack_tournament_id", (q) =>
        q.eq("spicerackTournamentId", args.spicerackTournamentId),
      )
      .unique();
    if (!spicerackTournament) {
      throw new Error(
        `Spicerack tournament ${args.spicerackTournamentId} not found`,
      );
    }
    await ctx.db.patch(spicerackTournament._id, {
      currentRoundId: args.currentRoundId,
      currentRoundNumber: args.currentRoundNumber,
    });
  },
});

/**
 * Internal query to get tournament data needed for polling
 * Returns user and spicerack tournament info along with user settings
 */
export const getTournamentPollingData = internalQuery({
  args: { userId: v.id("users") },
  returns: v.object({
    tournament: tournamentValidator,
    spicerackTournament: v.optional(spicerackTournamentValidator),
    settings: settingsValidator,
  }),
  handler: async (ctx, args) => {
    const tournament = await ctx.db
      .query("tournaments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (!tournament) {
      throw new Error(`User ${args.userId} has no user tournament`);
    }

    let spicerackTournament = undefined;
    if (tournament.spicerackTournamentId) {
      spicerackTournament =
        (await ctx.db
          .query("spicerackTournaments")
          .withIndex("by_spicerack_tournament_id", (q) =>
            q.eq("spicerackTournamentId", tournament.spicerackTournamentId!),
          )
          .unique()) || undefined;
    }

    // Get user settings to retrieve API key
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!settings || !settings.spicerackApiKey) {
      throw new Error(`No settings or API key found for user ${args.userId}`);
    }

    return {
      tournament,
      spicerackTournament,
      settings,
    };
  },
});

/**
 * Internal mutation to log spicerack events
 * For standalone logging without updating tournament status
 */
export const logEvent = internalMutation({
  args: {
    userId: v.id("users"),
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
  },
  handler: async (ctx, args) => {
    await logSpicerackEvent(ctx, args);
  },
});

/**
 * Internal mutation to update tournament polling status with logging
 */
export const updateTournamentPollingStatus = internalMutation({
  args: {
    tournamentId: v.id("tournaments"),
    userId: v.id("users"),
    mode: v.optional(v.union(v.literal("manual"), v.literal("auto"))),
    spicerackPollingStatus: v.optional(
      v.union(v.literal("active"), v.literal("inactive"), v.literal("error")),
    ),
    spicerackErrorMessage: v.optional(v.string()),
    // Logging parameters
    logAction: v.optional(v.string()),
    logStatus: v.optional(
      v.union(
        v.literal("success"),
        v.literal("error"),
        v.literal("info"),
        v.literal("warning"),
      ),
    ),
    logMessage: v.optional(v.string()),
    logMetadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const {
      tournamentId,
      userId,
      logAction,
      logStatus,
      logMessage,
      logMetadata,
      ...updates
    } = args;

    // Update tournament status
    await ctx.db.patch(tournamentId, updates);

    // Log if logging parameters provided
    if (logAction && logStatus && logMessage) {
      await logSpicerackEvent(ctx, {
        userId,
        action: logAction,
        status: logStatus,
        message: logMessage,
        tournamentId,
        metadata: logMetadata,
      });
    }
  },
});

export const createNewSpicerackTournament = internalMutation({
  args: {
    spicerackTournamentId: v.number(),
  },
  returns: spicerackTournamentValidator,
  handler: async (ctx, args) => {
    return await createSpicerackTournamentHelper(
      ctx,
      args.spicerackTournamentId,
    );
  },
});

/**
 * Internal action to validate tournament and start polling
 * Called immediately when user enables auto mode
 */
export const validateAndStartPolling = internalAction({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    let { tournament, spicerackTournament, settings } = await ctx.runQuery(
      internal.spicerack.getTournamentPollingData,
      { userId: args.userId },
    );
    if (
      !tournament ||
      !tournament.spicerackTournamentId ||
      !settings ||
      !settings.spicerackApiKey
    ) {
      throw new Error(
        "Missing tournament data or Spicerack API key. Please check your settings.",
      );
    }

    if (!spicerackTournament) {
      spicerackTournament = await ctx.runMutation(
        internal.spicerack.createNewSpicerackTournament,
        {
          spicerackTournamentId: tournament.spicerackTournamentId,
        },
      );
      if (!spicerackTournament) {
        throw new Error(`Failed to create new Spicerack tournament`);
      }
    }

    // Check if polling is already active to prevent duplicate polling sessions
    if (tournament.spicerackPollingStatus === "active") {
      console.log(
        `Polling already active for tournament ${spicerackTournament.spicerackTournamentId}. Skipping validation.`,
      );
      return;
    }

    // Verify tournament is still in auto mode before starting polling
    if (tournament.mode !== "auto") {
      console.log(
        `Tournament ${spicerackTournament.spicerackTournamentId} is not in auto mode. Skipping validation.`,
      );
      return;
    }

    try {
      const overviewData = await fetchSpicerackEventOverviewData(
        spicerackTournament.spicerackTournamentId,
        settings.spicerackApiKey,
      );

      if (!overviewData) {
        // Update status and log failure in one mutation
        await ctx.runMutation(
          internal.spicerack.updateTournamentPollingStatus,
          {
            tournamentId: tournament._id,
            userId: args.userId,
            mode: "manual",
            spicerackPollingStatus: "error",
            spicerackErrorMessage:
              "Failed to fetch tournament overview data from Spicerack.",
            logAction: "FETCH_OVERVIEW_FAILED",
            logStatus: "error",
            logMessage:
              "Failed to fetch tournament overview data from Spicerack",
          },
        );
        return;
      }

      // Check if tournament is already complete
      if (overviewData.event_status === "COMPLETED") {
        // Update status and log in one mutation
        await ctx.runMutation(
          internal.spicerack.updateTournamentPollingStatus,
          {
            tournamentId: tournament._id,
            userId: args.userId,
            mode: "manual",
            spicerackPollingStatus: "inactive",
            spicerackErrorMessage:
              "Tournament is already completed in Spicerack.",
            logAction: "TOURNAMENT_COMPLETED",
            logStatus: "warning",
            logMessage: "Tournament is already completed in Spicerack",
          },
        );
        return;
      }

      await ctx.runMutation(internal.spicerack.updateSpicerackTournament, {
        spicerackTournamentId: spicerackTournament.spicerackTournamentId,
        currentRoundId: overviewData.current_round_id,
        currentRoundNumber: overviewData.current_round_number,
      });

      console.log(
        `Tournament ${spicerackTournament.spicerackTournamentId} validated. Status: ${overviewData.event_status}`,
      );

      const spicerackRegisteredPlayers = await fetchSpicerackRegisteredPlayers(
        spicerackTournament.spicerackTournamentId,
        settings.spicerackApiKey,
      );
      const cachedSpicerackPlayers = await ctx.runQuery(
        internal.player.getAllSpicerackTournamentPlayerSpicerackIds,
        { spicerackTournamentId: spicerackTournament.spicerackTournamentId },
      );
      const newPlayers = spicerackRegisteredPlayers.filter(
        (player) => !cachedSpicerackPlayers.some((id) => id === player.id),
      );

      if (newPlayers.length > 0) {
        const newPlayerAndDeckIds = await ctx.runMutation(
          internal.player.createPlayers,
          {
            players: newPlayers.map((player) => ({
              name: player.user_identifier,
              spicerackPlayerId: player.id,
              spicerackTournamentId: spicerackTournament.spicerackTournamentId,
              deckId: player.decklist?.id ?? -1,
              deckName: player.decklist?.id ? "PENDING" : "MISSING_DECKLIST",
              deckList: player.decklist?.id ? "PENDING" : "MISSING_DECKLIST",
            })),
          },
        );
        // enqueue action batch to fetch decklists
        // Filter for valid deck IDs before enqueueing
        const playersWithDecks = newPlayerAndDeckIds.filter(
          (id) => id.deckId > 0,
        );

        if (playersWithDecks.length > 0) {
          const decklistPromises = playersWithDecks.map((playerWithDeck) => {
            return fetchSpicerackDecklistData(
              playerWithDeck.deckId,
              settings.spicerackApiKey!,
            )
              .then((decklist) => ({
                playerId: playerWithDeck.playerId,
                deckName: decklist.deckname,
                deckList: decklist.decklist,
              }))
              .catch((error) => {
                console.error(
                  `Failed to fetch decklist for player ${playerWithDeck.playerId}:`,
                  error,
                );
                return {
                  playerId: playerWithDeck.playerId,
                  deckName: "Unknown",
                  deckList: "Unknown",
                };
              });
          });

          const results = await Promise.allSettled(decklistPromises);
          const newPlayerDecklists = results
            .filter((result) => result.status === "fulfilled")
            .map((result) => result.value);

          if (newPlayerDecklists.length > 0) {
            await ctx.runMutation(internal.player.updatePlayerDecklists, {
              players: newPlayerDecklists,
            });
          }
        }
      }

      // Log success
      await ctx.runMutation(internal.spicerack.updateTournamentPollingStatus, {
        tournamentId: tournament._id,
        userId: args.userId,
        logAction: "VALIDATION_SUCCESS",
        logStatus: "success",
        logMessage: `Tournament validated successfully. Starting polling.`,
        logMetadata: { eventStatus: overviewData.event_status },
      });

      // Start polling - schedule first poll immediately
      await ctx.scheduler.runAfter(
        0,
        internal.spicerack.pollTournamentAndScheduleNext,
        { ...args },
      );
    } catch (error) {
      // Reset to manual mode and log error in one mutation
      await ctx.runMutation(internal.spicerack.updateTournamentPollingStatus, {
        tournamentId: tournament._id,
        userId: args.userId,
        mode: "manual",
        spicerackPollingStatus: "error",
        spicerackErrorMessage: `Error validating tournament: ${error}`,
        logAction: "VALIDATION_ERROR",
        logStatus: "error",
        logMessage: `Error validating tournament: ${error}`,
        logMetadata: { error: String(error) },
      });
      return;
    }
  },
});

export const detectNewRound = internalMutation({
  args: {
    tournamentId: v.id("tournaments"),
    jsonData: v.any(),
  },
  handler: async (ctx, args) => {
    await checkForNewSpicerackRound(ctx, args.tournamentId, args.jsonData);
  },
});

/**
 * Internal action that polls tournament data and schedules itself again
 * This creates a self-scheduling polling loop
 */
export const pollTournamentAndScheduleNext = internalAction({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { tournament, spicerackTournament, settings } = await ctx.runQuery(
      internal.spicerack.getTournamentPollingData,
      { userId: args.userId },
    );
    if (
      !tournament ||
      !spicerackTournament ||
      !settings ||
      !settings.spicerackApiKey
    ) {
      throw new Error(`Tournament ${args.userId} not found`);
    }
    // Extract API key to ensure TypeScript knows it's defined
    const spicerackApiKey = settings.spicerackApiKey;
    // Stop polling if tournament not found or not in auto mode
    if (tournament.mode !== "auto") {
      await ctx.runMutation(internal.spicerack.updateTournamentPollingStatus, {
        tournamentId: tournament._id,
        userId: args.userId,
        mode: "manual",
        spicerackPollingStatus: "inactive",
        spicerackErrorMessage:
          "Tournament is not in auto mode. Stopping polling.",
        logAction: "TOURNAMENT_NOT_IN_AUTO_MODE",
        logStatus: "warning",
        logMessage: "Tournament is not in auto mode. Stopping polling.",
      });
      return;
    }

    try {
      // Poll the Spicerack API
      const spicerackData = await fetchSpicerackEventData(
        spicerackTournament.spicerackTournamentId,
        spicerackApiKey,
      );

      console.log(
        `Polled tournament ${spicerackTournament.spicerackTournamentId} - Status: ${spicerackData.settings.event_lifecycle_status}, Round: ${spicerackData.current_round_number}`,
      );

      // Update tournament status and log successful fetch in one mutation
      await ctx.runMutation(internal.spicerack.updateTournamentPollingStatus, {
        tournamentId: tournament._id,
        userId: args.userId,
        spicerackPollingStatus: "active",
        logAction: "FETCH_EVENT_SUCCESS",
        logStatus: "success",
        logMessage: `Successfully fetched event data. Status: ${spicerackData.settings.event_lifecycle_status}, Round: ${spicerackData.current_round_number}`,
        logMetadata: {
          status: spicerackData.settings.event_lifecycle_status,
          round: spicerackData.current_round_number,
        },
      });

      // Check if current round has changed
      await ctx.runMutation(internal.spicerack.detectNewRound, {
        tournamentId: tournament._id,
        jsonData: spicerackData,
      });

      // Find new players and matches
      const newPlayerAndDeckIds = await ctx.runMutation(
        internal.featurematches.createNewFeatureMatches,
        {
          spicerackTournamentId: spicerackTournament.spicerackTournamentId,
          jsonData: spicerackData,
        },
      );
      console.log(`New player and deck ids: ${newPlayerAndDeckIds}`);

      if (newPlayerAndDeckIds.length > 0) {
        const decklistPromises = newPlayerAndDeckIds.map((playerAndDeckId) => {
          return fetchSpicerackDecklistData(
            playerAndDeckId.deckId,
            spicerackApiKey,
          )
            .then((decklist) => ({
              playerId: playerAndDeckId.playerId,
              deckName: decklist.deckname,
              deckList: decklist.decklist,
            }))
            .catch((error) => {
              console.error(
                `Failed to fetch decklist for player ${playerAndDeckId.playerId}:`,
                error,
              );
              return {
                playerId: playerAndDeckId.playerId,
                deckName: "Unknown",
                deckList: "Unknown",
              };
            });
        });

        const results = await Promise.allSettled(decklistPromises);
        const newPlayerDecklists = results
          .filter((result) => result.status === "fulfilled")
          .map((result) => result.value);

        // 6. write everything to db
        if (newPlayerDecklists.length > 0) {
          await ctx.runMutation(internal.player.updatePlayerDecklists, {
            players: newPlayerDecklists,
          });
        }
      }
      // Check if tournament is complete
      if (
        spicerackData.settings.event_lifecycle_status === "EVENT_FINISHED" ||
        spicerackData.tournament_phases.every(
          (phase: SpicerackTournamentPhase) => phase.status === "COMPLETE",
        )
      ) {
        console.log(
          `Tournament ${spicerackTournament.spicerackTournamentId} is complete. Stopping polling.`,
        );
        // Update status and log completion in one mutation
        await ctx.runMutation(
          internal.spicerack.updateTournamentPollingStatus,
          {
            tournamentId: tournament._id,
            userId: args.userId,
            mode: "manual",
            spicerackPollingStatus: "inactive",
            spicerackErrorMessage: "Tournament is complete in Spicerack.",
            logAction: "TOURNAMENT_COMPLETED",
            logStatus: "info",
            logMessage: "Tournament is complete. Stopping polling.",
          },
        );
        return;
      }

      // Schedule next poll in 30 seconds
      await ctx.scheduler.runAfter(
        POLLING_INTERVAL,
        internal.spicerack.pollTournamentAndScheduleNext,
        { ...args },
      );
    } catch (error) {
      console.error(
        `Error polling tournament ${spicerackTournament.spicerackTournamentId}:`,
        error,
      );
      // Update status and log error in one mutation
      await ctx.runMutation(internal.spicerack.updateTournamentPollingStatus, {
        tournamentId: tournament._id,
        userId: args.userId,
        mode: "manual",
        spicerackPollingStatus: "error",
        spicerackErrorMessage: `Error polling tournament: ${error}`,
        logAction: "POLL_ERROR",
        logStatus: "error",
        logMessage: `Error during poll cycle: ${error}`,
        logMetadata: { error: String(error) },
      });
    }
  },
});
