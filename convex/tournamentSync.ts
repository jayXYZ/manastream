import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { logIntegrationEvent } from "./lib/logging";
import { POLLING_INTERVAL } from "./lib/constants";
import {
  settingsValidator,
  externalTournamentValidator,
  tournamentValidator,
  roundSnapshotValidator,
} from "./validators";
import { checkForNewRound } from "./lib/rounds";
import {
  MeleeCredentials,
  fetchMeleeCurrentRoundMatches,
  fetchMeleeCurrentStandings,
  fetchMeleeDecklist,
  fetchMeleePlayerList,
  fetchMeleeRoundStandings,
  fetchMeleeTournament,
} from "./lib/melee/api";
import { buildDecklistFromMeleeRecords } from "./lib/melee/decklist";
import {
  RoundSnapshot,
  buildRoundSnapshot,
  getLastSwissRoundId,
  isTournamentComplete,
  parseCompletedRounds,
  parseMeleeRegistrationStatus,
  seedMapFromStandings,
  standingsByPlayerId,
} from "./models/melee";
import {
  MeleePlayerListEntry,
  MeleeStanding,
  MeleeTournamentOverviewResponse,
} from "./types/melee";
import {
  createExternalTournamentHelper,
  updateExternalTournamentHelper,
} from "./lib/externalTournament";
import {
  parseAllowCompletedTournamentPolling,
  shouldStopPollingForCompletedTournament,
} from "./lib/pollingBehavior";
import {
  getMeleeCredentialsFromSettings,
  hasMeleeCredentials,
} from "./lib/settings";

const DECKLIST_FETCH_CONCURRENCY = 8;
const ALLOW_COMPLETED_TOURNAMENT_POLLING = parseAllowCompletedTournamentPolling(
  process.env.SYNC_ALLOW_COMPLETED_POLLING,
);

const completedRoundsValidator = v.array(
  v.object({ roundId: v.number(), roundName: v.string() }),
);

export const updateExternalTournament = internalMutation({
  args: {
    externalTournamentId: v.number(),
    currentRoundId: v.optional(v.number()),
    currentRoundNumber: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const externalTournament = await ctx.db
      .query("externalTournaments")
      .withIndex("by_external_tournament_id", (q) =>
        q.eq("externalTournamentId", args.externalTournamentId),
      )
      .unique();
    if (!externalTournament) {
      throw new Error(
        `External tournament ${args.externalTournamentId} not found`,
      );
    }
    await ctx.db.patch(externalTournament._id, {
      currentRoundId: args.currentRoundId,
      currentRoundNumber: args.currentRoundNumber,
    });
  },
});

/**
 * Internal query to get tournament data needed for polling
 * Returns user and external tournament info along with user settings
 */
export const getTournamentPollingData = internalQuery({
  args: { userId: v.id("users") },
  returns: v.object({
    tournament: tournamentValidator,
    externalTournament: v.optional(externalTournamentValidator),
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

    let externalTournament = undefined;
    if (tournament.externalTournamentId) {
      externalTournament =
        (await ctx.db
          .query("externalTournaments")
          .withIndex("by_external_tournament_id", (q) =>
            q.eq("externalTournamentId", tournament.externalTournamentId!),
          )
          .unique()) || undefined;
    }

    // Get user settings to retrieve Melee credentials
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!settings || !hasMeleeCredentials(settings)) {
      throw new Error(
        `No settings or Melee credentials found for user ${args.userId}`,
      );
    }

    return {
      tournament,
      externalTournament,
      settings,
    };
  },
});

/**
 * Internal mutation to log sync events
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
    await logIntegrationEvent(ctx, args);
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
    pollingStatus: v.optional(
      v.union(v.literal("active"), v.literal("inactive"), v.literal("error")),
    ),
    pollingErrorMessage: v.optional(v.string()),
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
      await logIntegrationEvent(ctx, {
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

export const createExternalTournament = internalMutation({
  args: {
    externalTournamentId: v.number(),
    name: v.optional(v.string()),
  },
  returns: externalTournamentValidator,
  handler: async (ctx, args) => {
    return await createExternalTournamentHelper(
      ctx,
      args.externalTournamentId,
      args.name,
    );
  },
});

export const recordCompletedRounds = internalMutation({
  args: {
    externalTournamentId: v.number(),
    completedRounds: completedRoundsValidator,
  },
  handler: async (ctx, args) => {
    await updateExternalTournamentHelper(ctx, args.externalTournamentId, {
      completedRounds: args.completedRounds,
    });
  },
});

export const detectNewRound = internalMutation({
  args: {
    tournamentId: v.id("tournaments"),
    snapshot: roundSnapshotValidator,
    completedRounds: completedRoundsValidator,
  },
  handler: async (ctx, args) => {
    await checkForNewRound(
      ctx,
      args.tournamentId,
      args.snapshot,
      args.completedRounds,
    );
  },
});

/**
 * Fetch matches + standings for the current round and compose them into a
 * RoundSnapshot. Returns undefined when Melee reports no current matches.
 */
async function fetchRoundSnapshot(
  externalTournamentId: number,
  overview: MeleeTournamentOverviewResponse,
  credentials: MeleeCredentials,
): Promise<RoundSnapshot | undefined> {
  const [matches, standings] = await Promise.all([
    fetchMeleeCurrentRoundMatches(externalTournamentId, credentials),
    fetchMeleeCurrentStandings(externalTournamentId, credentials),
  ]);

  let lastSwissSeedByPlayerId: Map<number, number> | undefined;
  const currentRoundId = matches[0]?.RoundId;
  if (currentRoundId !== undefined) {
    const lastSwissRoundId = getLastSwissRoundId(overview, currentRoundId);
    if (lastSwissRoundId !== undefined) {
      const lastSwissStandings: MeleeStanding[] =
        await fetchMeleeRoundStandings(lastSwissRoundId, credentials);
      lastSwissSeedByPlayerId = seedMapFromStandings(lastSwissStandings);
    }
  }

  return buildRoundSnapshot({
    overview,
    matches,
    standingsByPlayerId: standingsByPlayerId(standings),
    lastSwissSeedByPlayerId,
  });
}

type NewPlayerArgs = {
  externalTournamentId: number;
  name: string;
  externalPlayerId: number;
  registrationStatus?: string;
  externalDecklistId?: string;
  decklistStatus: "ready" | "missing";
  deckName: string;
  deckList: string;
};

function playerEntryName(entry: MeleePlayerListEntry): string {
  return entry.DisplayName || entry.PlayerName || entry.Username;
}

/**
 * Build a createPlayers row from a player-list entry, using the embedded
 * decklist (with card records) when the player has submitted one.
 */
function buildNewPlayerArgs(
  externalTournamentId: number,
  entry: MeleePlayerListEntry,
): NewPlayerArgs {
  const embedded = entry.Decklists[0];
  if (embedded && Array.isArray(embedded.Records)) {
    const decklist = buildDecklistFromMeleeRecords({
      records: embedded.Records,
      formatName: embedded.FormatName,
      decklistName: embedded.DecklistName || embedded.Name || undefined,
    });
    return {
      externalTournamentId,
      name: playerEntryName(entry),
      externalPlayerId: entry.ID,
      registrationStatus: parseMeleeRegistrationStatus(entry),
      externalDecklistId: embedded.Guid,
      decklistStatus: "ready",
      deckName: decklist.deckname,
      deckList: decklist.decklist,
    };
  }
  return {
    externalTournamentId,
    name: playerEntryName(entry),
    externalPlayerId: entry.ID,
    registrationStatus: parseMeleeRegistrationStatus(entry),
    decklistStatus: "missing",
    deckName: "MISSING_DECKLIST",
    deckList: "MISSING_DECKLIST",
  };
}

/**
 * Internal action to validate tournament and start polling
 * Called immediately when user enables auto mode
 */
export const validateAndStartPolling = internalAction({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const pollingData = await ctx.runQuery(
      internal.tournamentSync.getTournamentPollingData,
      { userId: args.userId },
    );
    const { tournament, settings } = pollingData;
    let { externalTournament } = pollingData;
    if (
      !tournament ||
      !tournament.externalTournamentId ||
      !settings ||
      !hasMeleeCredentials(settings)
    ) {
      throw new Error(
        "Missing tournament data or Melee credentials. Please check your settings.",
      );
    }
    const credentials: MeleeCredentials =
      getMeleeCredentialsFromSettings(settings);

    if (!externalTournament) {
      externalTournament = await ctx.runMutation(
        internal.tournamentSync.createExternalTournament,
        {
          externalTournamentId: tournament.externalTournamentId,
        },
      );
      if (!externalTournament) {
        throw new Error(`Failed to create new external tournament`);
      }
    }
    const externalTournamentId = externalTournament.externalTournamentId;

    // Check if polling is already active to prevent duplicate polling sessions
    if (tournament.pollingStatus === "active") {
      console.log(
        `Polling already active for tournament ${externalTournamentId}. Skipping validation.`,
      );
      return;
    }

    // Verify tournament is still in auto mode before starting polling
    if (tournament.mode !== "auto") {
      console.log(
        `Tournament ${externalTournamentId} is not in auto mode. Skipping validation.`,
      );
      return;
    }

    try {
      const overview = await fetchMeleeTournament(
        externalTournamentId,
        credentials,
      );

      // Check if tournament is already complete
      if (
        shouldStopPollingForCompletedTournament({
          isCompleted: isTournamentComplete(overview),
          allowCompletedTournamentPolling: ALLOW_COMPLETED_TOURNAMENT_POLLING,
        })
      ) {
        await ctx.runMutation(
          internal.tournamentSync.recordCompletedRounds,
          {
            externalTournamentId,
            completedRounds: parseCompletedRounds(overview, undefined),
          },
        );
        await ctx.runMutation(
          internal.tournamentSync.updateTournamentPollingStatus,
          {
            tournamentId: tournament._id,
            userId: args.userId,
            mode: "manual",
            pollingStatus: "inactive",
            pollingErrorMessage: "Tournament is already completed in Melee.",
            logAction: "TOURNAMENT_COMPLETED",
            logStatus: "warning",
            logMessage: "Tournament is already completed in Melee",
          },
        );
        return;
      }

      console.log(
        `Tournament ${externalTournamentId} validated. Status: ${overview.StatusDescription}`,
      );

      // Seed registered players (with embedded decklists where available)
      const playerEntries = await fetchMeleePlayerList(
        externalTournamentId,
        credentials,
      );
      await ctx.runMutation(internal.player.updatePlayerRegistrationStatuses, {
        externalTournamentId,
        players: playerEntries.map((entry) => ({
          externalPlayerId: entry.ID,
          registrationStatus: parseMeleeRegistrationStatus(entry),
        })),
      });

      const cachedPlayerIds = await ctx.runQuery(
        internal.player.getAllTournamentPlayerExternalIds,
        { externalTournamentId },
      );
      const newEntries = playerEntries.filter(
        (entry) => !cachedPlayerIds.some((id) => id === entry.ID),
      );
      if (newEntries.length > 0) {
        await ctx.runMutation(internal.player.createPlayers, {
          players: newEntries.map((entry) =>
            buildNewPlayerArgs(externalTournamentId, entry),
          ),
        });
      }

      // Re-check decklists for existing players that were cached without one
      const playersWithMissingDecklists = await ctx.runQuery(
        internal.player.getPlayersWithMissingDecklists,
        { externalTournamentId },
      );
      if (playersWithMissingDecklists.length > 0) {
        const entriesByPlayerId = new Map(
          playerEntries.map((entry) => [entry.ID, entry]),
        );
        const decklistUpdates: {
          playerId: Id<"players">;
          deckName: string;
          deckList: string;
          externalDecklistId?: string;
          decklistStatus: "ready" | "fetch_failed";
        }[] = [];
        const playersToFetch: {
          playerId: Id<"players">;
          externalDecklistId: string;
        }[] = [];

        for (const player of playersWithMissingDecklists) {
          const embedded = entriesByPlayerId.get(player.externalPlayerId)
            ?.Decklists[0];
          if (embedded && Array.isArray(embedded.Records)) {
            const decklist = buildDecklistFromMeleeRecords({
              records: embedded.Records,
              formatName: embedded.FormatName,
              decklistName: embedded.DecklistName || embedded.Name || undefined,
            });
            decklistUpdates.push({
              playerId: player.playerId,
              deckName: decklist.deckname,
              deckList: decklist.decklist,
              externalDecklistId: embedded.Guid,
              decklistStatus: "ready",
            });
          } else if (player.externalDecklistId) {
            playersToFetch.push({
              playerId: player.playerId,
              externalDecklistId: player.externalDecklistId,
            });
          }
        }

        const fetchedUpdates = await fetchDecklistsInBatches(
          playersToFetch,
          credentials,
        );
        const allUpdates = [...decklistUpdates, ...fetchedUpdates];
        if (allUpdates.length > 0) {
          await ctx.runMutation(internal.player.updatePlayerDecklists, {
            players: allUpdates,
          });
        }
      }

      // Snapshot the current round (round info, pairings, feature matches)
      const snapshot = await fetchRoundSnapshot(
        externalTournamentId,
        overview,
        credentials,
      );
      if (snapshot) {
        await ctx.runMutation(internal.tournamentSync.detectNewRound, {
          tournamentId: tournament._id,
          snapshot,
          completedRounds: parseCompletedRounds(overview, snapshot.roundId),
        });
      }

      // Log success
      await ctx.runMutation(
        internal.tournamentSync.updateTournamentPollingStatus,
        {
          tournamentId: tournament._id,
          userId: args.userId,
          logAction: "VALIDATION_SUCCESS",
          logStatus: "success",
          logMessage: `Tournament validated successfully. Starting polling.`,
          logMetadata: { status: overview.StatusDescription },
        },
      );

      // Start polling - schedule first poll immediately
      await ctx.scheduler.runAfter(
        0,
        internal.tournamentSync.pollTournamentAndScheduleNext,
        { ...args },
      );
    } catch (error) {
      // Reset to manual mode and log error in one mutation
      await ctx.runMutation(
        internal.tournamentSync.updateTournamentPollingStatus,
        {
          tournamentId: tournament._id,
          userId: args.userId,
          mode: "manual",
          pollingStatus: "error",
          pollingErrorMessage: `Error validating tournament: ${error}`,
          logAction: "VALIDATION_ERROR",
          logStatus: "error",
          logMessage: `Error validating tournament: ${error}`,
          logMetadata: { error: String(error) },
        },
      );
      return;
    }
  },
});

async function fetchDecklistsInBatches(
  players: { playerId: Id<"players">; externalDecklistId: string }[],
  credentials: MeleeCredentials,
): Promise<
  {
    playerId: Id<"players">;
    deckName: string;
    deckList: string;
    externalDecklistId?: string;
    decklistStatus: "ready" | "fetch_failed";
  }[]
> {
  const results: {
    playerId: Id<"players">;
    deckName: string;
    deckList: string;
    externalDecklistId?: string;
    decklistStatus: "ready" | "fetch_failed";
  }[] = [];

  for (
    let index = 0;
    index < players.length;
    index += DECKLIST_FETCH_CONCURRENCY
  ) {
    const batch = players.slice(index, index + DECKLIST_FETCH_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (player) => {
        try {
          const decklist = await fetchMeleeDecklist(
            player.externalDecklistId,
            credentials,
          );
          return {
            playerId: player.playerId,
            deckName: decklist.deckname,
            deckList: decklist.decklist,
            externalDecklistId: player.externalDecklistId,
            decklistStatus: "ready" as const,
          };
        } catch (error) {
          console.error(
            `Failed to fetch decklist for player ${player.playerId}:`,
            error,
          );
          return {
            playerId: player.playerId,
            deckName: "Unknown",
            deckList: "Unknown",
            externalDecklistId: player.externalDecklistId,
            decklistStatus: "fetch_failed" as const,
          };
        }
      }),
    );
    results.push(...batchResults);
  }
  return results;
}

/**
 * Internal action that polls tournament data and schedules itself again
 * This creates a self-scheduling polling loop
 */
export const pollTournamentAndScheduleNext = internalAction({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { tournament, externalTournament, settings } = await ctx.runQuery(
      internal.tournamentSync.getTournamentPollingData,
      { userId: args.userId },
    );
    if (
      !tournament ||
      !externalTournament ||
      !settings ||
      !hasMeleeCredentials(settings)
    ) {
      throw new Error(`Tournament ${args.userId} not found`);
    }
    const credentials: MeleeCredentials =
      getMeleeCredentialsFromSettings(settings);
    const externalTournamentId = externalTournament.externalTournamentId;

    // Stop polling if tournament not found or not in auto mode
    if (tournament.mode !== "auto") {
      await ctx.runMutation(
        internal.tournamentSync.updateTournamentPollingStatus,
        {
          tournamentId: tournament._id,
          userId: args.userId,
          mode: "manual",
          pollingStatus: "inactive",
          pollingErrorMessage:
            "Tournament is not in auto mode. Stopping polling.",
          logAction: "TOURNAMENT_NOT_IN_AUTO_MODE",
          logStatus: "warning",
          logMessage: "Tournament is not in auto mode. Stopping polling.",
        },
      );
      return;
    }

    try {
      const overview = await fetchMeleeTournament(
        externalTournamentId,
        credentials,
      );

      console.log(
        `Polled tournament ${externalTournamentId} - Status: ${overview.StatusDescription}`,
      );

      // Check if tournament is complete
      if (
        shouldStopPollingForCompletedTournament({
          isCompleted: isTournamentComplete(overview),
          allowCompletedTournamentPolling: ALLOW_COMPLETED_TOURNAMENT_POLLING,
        })
      ) {
        console.log(
          `Tournament ${externalTournamentId} is complete. Stopping polling.`,
        );
        await ctx.runMutation(
          internal.tournamentSync.recordCompletedRounds,
          {
            externalTournamentId,
            completedRounds: parseCompletedRounds(overview, undefined),
          },
        );
        await ctx.runMutation(
          internal.tournamentSync.updateTournamentPollingStatus,
          {
            tournamentId: tournament._id,
            userId: args.userId,
            mode: "manual",
            pollingStatus: "inactive",
            pollingErrorMessage: "Tournament is complete in Melee.",
            logAction: "TOURNAMENT_COMPLETED",
            logStatus: "info",
            logMessage: "Tournament is complete. Stopping polling.",
          },
        );
        return;
      }

      const snapshot = await fetchRoundSnapshot(
        externalTournamentId,
        overview,
        credentials,
      );

      if (!snapshot) {
        // Between rounds or before pairings post: keep polling without
        // touching stored round state
        await ctx.runMutation(
          internal.tournamentSync.updateTournamentPollingStatus,
          {
            tournamentId: tournament._id,
            userId: args.userId,
            pollingStatus: "active",
            logAction: "NO_CURRENT_ROUND_FOUND",
            logStatus: "warning",
            logMessage: "No current round matches found in Melee data",
          },
        );
        await ctx.scheduler.runAfter(
          POLLING_INTERVAL,
          internal.tournamentSync.pollTournamentAndScheduleNext,
          { ...args },
        );
        return;
      }

      // Update tournament status and log successful fetch in one mutation
      await ctx.runMutation(
        internal.tournamentSync.updateTournamentPollingStatus,
        {
          tournamentId: tournament._id,
          userId: args.userId,
          pollingStatus: "active",
          logAction: "FETCH_EVENT_SUCCESS",
          logStatus: "success",
          logMessage: `Successfully fetched event data. Status: ${overview.StatusDescription}, Round: ${snapshot.roundNumber}`,
          logMetadata: {
            status: overview.StatusDescription,
            round: snapshot.roundNumber,
          },
        },
      );

      // Check if current round has changed (also snapshots pairings)
      await ctx.runMutation(internal.tournamentSync.detectNewRound, {
        tournamentId: tournament._id,
        snapshot,
        completedRounds: parseCompletedRounds(overview, snapshot.roundId),
      });

      // Find new feature matches and players
      const newPlayerAndDecklistIds: {
        playerId: Id<"players">;
        externalDecklistId?: string;
      }[] = await ctx.runMutation(
        internal.featurematches.createNewFeatureMatches,
        {
          externalTournamentId,
          snapshot,
        },
      );

      // Update registration statuses from the player list
      const playerEntries = await fetchMeleePlayerList(
        externalTournamentId,
        credentials,
      );
      await ctx.runMutation(internal.player.updatePlayerRegistrationStatuses, {
        externalTournamentId,
        players: playerEntries.map((entry) => ({
          externalPlayerId: entry.ID,
          registrationStatus: parseMeleeRegistrationStatus(entry),
        })),
      });

      // Fetch decklists for players discovered via feature matches
      const playersWithDecks = newPlayerAndDecklistIds.flatMap((player) =>
        player.externalDecklistId
          ? [
              {
                playerId: player.playerId,
                externalDecklistId: player.externalDecklistId,
              },
            ]
          : [],
      );
      if (playersWithDecks.length > 0) {
        const newPlayerDecklists = await fetchDecklistsInBatches(
          playersWithDecks,
          credentials,
        );
        if (newPlayerDecklists.length > 0) {
          await ctx.runMutation(internal.player.updatePlayerDecklists, {
            players: newPlayerDecklists,
          });
        }
      }

      // Schedule next poll
      await ctx.scheduler.runAfter(
        POLLING_INTERVAL,
        internal.tournamentSync.pollTournamentAndScheduleNext,
        { ...args },
      );
    } catch (error) {
      console.error(
        `Error polling tournament ${externalTournamentId}:`,
        error,
      );
      // Update status and log error in one mutation
      await ctx.runMutation(
        internal.tournamentSync.updateTournamentPollingStatus,
        {
          tournamentId: tournament._id,
          userId: args.userId,
          mode: "manual",
          pollingStatus: "error",
          pollingErrorMessage: `Error polling tournament: ${error}`,
          logAction: "POLL_ERROR",
          logStatus: "error",
          logMessage: `Error during poll cycle: ${error}`,
          logMetadata: { error: String(error) },
        },
      );
    }
  },
});

export const getCompletedRounds = query({
  args: {
    externalTournamentId: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      roundId: v.number(),
      roundName: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    if (!args.externalTournamentId || args.externalTournamentId === -1) {
      return [];
    }
    const externalTournament = await ctx.db
      .query("externalTournaments")
      .withIndex("by_external_tournament_id", (q) =>
        q.eq("externalTournamentId", args.externalTournamentId!),
      )
      .unique();
    // Return empty array if the externalTournaments record doesn't exist yet
    // (e.g., when a user sets the tournament ID in manual mode before enabling auto mode)
    if (!externalTournament) {
      return [];
    }
    return externalTournament.completedRounds ?? [];
  },
});
