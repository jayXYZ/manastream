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
import { settingsValidator, tournamentValidator } from "./validators";
import { checkForNewSpicerackRound } from "./lib/spicerack/rounds";
import {
  fetchSpicerackEventData,
  fetchSpicerackEventOverviewData,
  fetchSpicerackDecklistData,
} from "./lib/spicerack/api";

export const updateNewSpicerackRound = internalMutation({
  args: {
    tournamentId: v.id("tournaments"),
    spicerackNewRoundId: v.number(),
    spicerackNewRoundNumber: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.tournamentId, {
      spicerackCurrentRoundId: args.spicerackNewRoundId,
      spicerackCurrentRoundNumber: args.spicerackNewRoundNumber,
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

/**
 * Internal query to get tournament data needed for polling
 * Returns tournament info with userId for fetching settings
 */
export const getTournamentPollingData = internalQuery({
  args: { tournamentId: v.id("tournaments") },
  returns: v.object({
    tournament: tournamentValidator,
    settings: settingsValidator,
  }),
  handler: async (ctx, args) => {
    const tournament = await ctx.db.get(args.tournamentId);

    if (!tournament) {
      throw new Error(`Tournament ${args.tournamentId} not found`);
    }
    if (!tournament.spicerackTournamentId) {
      throw new Error(
        `Tournament ${args.tournamentId} has no spicerackTournamentId`,
      );
    }

    // Get user settings to retrieve API key
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_user", (q) => q.eq("userId", tournament.userId))
      .unique();

    if (!settings || !settings.spicerackApiKey) {
      throw new Error(
        `No settings or API key found for user ${tournament.userId}`,
      );
    }

    return {
      tournament,
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
    spicerackLastPolledAt: v.optional(v.number()),
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

/**
 * Internal action to validate tournament and start polling
 * Called immediately when user enables auto mode
 */
export const validateAndStartPolling = internalAction({
  args: {
    userId: v.id("users"),
    tournamentId: v.id("tournaments"),
  },
  handler: async (ctx, args) => {
    const { tournament, settings } = await ctx.runQuery(
      internal.spicerack.getTournamentPollingData,
      { tournamentId: args.tournamentId },
    );
    if (
      !tournament ||
      !settings ||
      !tournament.spicerackTournamentId ||
      !settings.spicerackApiKey
    ) {
      throw new Error(
        "Missing tournament data or Spicerack API key. Please check your settings.",
      );
    }

    // Check if polling is already active to prevent duplicate polling sessions
    if (tournament.spicerackPollingStatus === "active") {
      console.log(
        `Polling already active for tournament ${args.tournamentId}. Skipping validation.`,
      );
      return;
    }

    // Verify tournament is still in auto mode before starting polling
    if (tournament.mode !== "auto") {
      console.log(
        `Tournament ${args.tournamentId} is not in auto mode. Skipping validation.`,
      );
      return;
    }

    try {
      const overviewData = await fetchSpicerackEventOverviewData(
        tournament.spicerackTournamentId,
        settings.spicerackApiKey,
      );

      if (!overviewData) {
        // Update status and log failure in one mutation
        await ctx.runMutation(
          internal.spicerack.updateTournamentPollingStatus,
          {
            tournamentId: args.tournamentId,
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
            tournamentId: args.tournamentId,
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

      console.log(
        `Tournament ${args.tournamentId} validated. Status: ${overviewData.event_status}`,
      );

      // Log success
      await ctx.runMutation(internal.spicerack.updateTournamentPollingStatus, {
        tournamentId: args.tournamentId,
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
        tournamentId: args.tournamentId,
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
    tournamentId: v.id("tournaments"),
  },
  handler: async (ctx, args) => {
    const { tournament, settings } = await ctx.runQuery(
      internal.spicerack.getTournamentPollingData,
      { tournamentId: args.tournamentId },
    );
    if (
      !tournament ||
      !settings ||
      !tournament.spicerackTournamentId ||
      !settings.spicerackApiKey
    ) {
      throw new Error(`Tournament ${args.tournamentId} not found`);
    }
    // Extract API key to ensure TypeScript knows it's defined
    const spicerackApiKey = settings.spicerackApiKey;
    // Stop polling if tournament not found or not in auto mode
    if (tournament.mode !== "auto") {
      await ctx.runMutation(internal.spicerack.updateTournamentPollingStatus, {
        tournamentId: args.tournamentId,
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
        tournament.spicerackTournamentId,
        spicerackApiKey,
      );

      console.log(
        `Polled tournament ${args.tournamentId} - Status: ${spicerackData.settings.event_lifecycle_status}, Round: ${spicerackData.current_round_number}`,
      );

      // Update tournament status and log successful fetch in one mutation
      await ctx.runMutation(internal.spicerack.updateTournamentPollingStatus, {
        tournamentId: args.tournamentId,
        userId: args.userId,
        spicerackPollingStatus: "active",
        spicerackLastPolledAt: Date.now(),
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
        tournamentId: args.tournamentId,
        jsonData: spicerackData,
      });

      // Find new players and matches
      const newPlayerAndDeckIds = await ctx.runMutation(
        internal.featurematches.createNewFeatureMatches,
        {
          tournamentId: args.tournamentId,
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
          `Tournament ${args.tournamentId} is complete. Stopping polling.`,
        );
        // Update status and log completion in one mutation
        await ctx.runMutation(
          internal.spicerack.updateTournamentPollingStatus,
          {
            tournamentId: args.tournamentId,
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
      console.error(`Error polling tournament ${args.tournamentId}:`, error);
      // Update status and log error in one mutation
      await ctx.runMutation(internal.spicerack.updateTournamentPollingStatus, {
        tournamentId: args.tournamentId,
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
