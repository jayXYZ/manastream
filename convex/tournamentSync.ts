import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
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
import { emitAutomationEvent } from "./lib/automations";
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
  canClaimPollingCycleExecution,
  canClaimPollingSession,
  isPollingCycleCurrent,
  parseAllowCompletedTournamentPolling,
  pollingCycleFailureUpdates,
  shouldStopPollingForCompletedTournament,
} from "./lib/pollingBehavior";
import {
  getMeleeCredentialsFromSettings,
  hasMeleeCredentials,
} from "./lib/settings";

const DECKLIST_FETCH_CONCURRENCY = 8;
// Convex actions time out after 10 minutes. The extra minute ensures the
// watchdog only expires work that the platform can no longer be running.
const POLLING_CYCLE_WATCHDOG_DELAY = 11 * 60 * 1000;
const ALLOW_COMPLETED_TOURNAMENT_POLLING = parseAllowCompletedTournamentPolling(
  process.env.SYNC_ALLOW_COMPLETED_POLLING,
);

const completedRoundsValidator = v.array(
  v.object({ roundId: v.number(), roundName: v.string() }),
);

async function schedulePollingCycleWatchdog(
  ctx: Pick<MutationCtx, "scheduler">,
  args: {
    userId: Id<"users">;
    pollingSessionId: string;
    pollingCycleId: string;
    delayMs?: number;
  },
): Promise<void> {
  await ctx.scheduler.runAfter(
    (args.delayMs ?? 0) + POLLING_CYCLE_WATCHDOG_DELAY,
    internal.tournamentSync.expirePollingCycle,
    {
      userId: args.userId,
      expectedPollingSessionId: args.pollingSessionId,
      expectedPollingCycleId: args.pollingCycleId,
    },
  );
}

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
    expectedPollingSessionId: v.string(),
    expectedPollingCycleId: v.optional(v.string()),
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
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const {
      tournamentId,
      userId,
      expectedPollingSessionId,
      expectedPollingCycleId,
      logAction,
      logStatus,
      logMessage,
      logMetadata,
      ...updates
    } = args;

    const tournament = await ctx.db.get(tournamentId);
    if (
      tournament?.pollingSessionId !== expectedPollingSessionId ||
      (expectedPollingCycleId !== undefined &&
        tournament.pollingCycleId !== expectedPollingCycleId)
    ) {
      return false;
    }

    const shouldClearPollingSession =
      updates.mode === "manual" ||
      updates.pollingStatus === "inactive" ||
      updates.pollingStatus === "error";

    const previousPollingStatus = tournament.pollingStatus;

    // Update tournament status
    await ctx.db.patch(tournamentId, {
      ...updates,
      ...(shouldClearPollingSession
        ? {
            pollingSessionId: undefined,
            pollingCycleId: undefined,
            pollingCycleStartedAt: undefined,
          }
        : {}),
    });

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

    if (
      updates.pollingStatus !== undefined &&
      updates.pollingStatus !== previousPollingStatus
    ) {
      const pollingTriggers = {
        active: "tournament.polling.started",
        inactive: "tournament.polling.stopped",
        error: "tournament.polling.error",
      } as const;
      await emitAutomationEvent(ctx, {
        userId,
        tournamentId,
        type: pollingTriggers[updates.pollingStatus],
        payload: {
          tournamentId,
          eventName: tournament.eventName,
          status: updates.pollingStatus,
          errorMessage: updates.pollingErrorMessage,
        },
      });
    }
    return true;
  },
});

export const claimPollingSession = internalMutation({
  args: {
    userId: v.id("users"),
    expectedExternalTournamentId: v.number(),
    pollingSessionId: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const tournament = await ctx.db
      .query("tournaments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (
      !tournament ||
      !canClaimPollingSession({
        mode: tournament.mode,
        pollingStatus: tournament.pollingStatus,
        pollingSessionId: tournament.pollingSessionId,
        currentExternalTournamentId: tournament.externalTournamentId,
        expectedExternalTournamentId: args.expectedExternalTournamentId,
      })
    ) {
      return null;
    }

    const pollingCycleId = crypto.randomUUID();
    await ctx.db.patch(tournament._id, {
      pollingStatus: "active",
      pollingErrorMessage: undefined,
      pollingSessionId: args.pollingSessionId,
      pollingCycleId,
      pollingCycleStartedAt: Date.now(),
    });
    await schedulePollingCycleWatchdog(ctx, {
      userId: args.userId,
      pollingSessionId: args.pollingSessionId,
      pollingCycleId,
    });
    return pollingCycleId;
  },
});

export const claimPollingCycleExecution = internalMutation({
  args: {
    userId: v.id("users"),
    expectedPollingSessionId: v.string(),
    expectedPollingCycleId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const tournament = await ctx.db
      .query("tournaments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (
      !tournament ||
      !canClaimPollingCycleExecution({
        mode: tournament.mode,
        pollingStatus: tournament.pollingStatus,
        pollingSessionId: tournament.pollingSessionId,
        pollingCycleId: tournament.pollingCycleId,
        pollingCycleStartedAt: tournament.pollingCycleStartedAt,
        expectedPollingSessionId: args.expectedPollingSessionId,
        expectedPollingCycleId: args.expectedPollingCycleId,
      })
    ) {
      return false;
    }
    await ctx.db.patch(tournament._id, {
      pollingCycleStartedAt: Date.now(),
    });
    return true;
  },
});

export const finishPollingCycleAndScheduleNext = internalMutation({
  args: {
    userId: v.id("users"),
    expectedPollingSessionId: v.string(),
    expectedPollingCycleId: v.string(),
    delayMs: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const tournament = await ctx.db
      .query("tournaments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (
      !tournament ||
      tournament.mode !== "auto" ||
      tournament.pollingStatus !== "active" ||
      !isPollingCycleCurrent({
        pollingSessionId: tournament.pollingSessionId,
        pollingCycleId: tournament.pollingCycleId,
        expectedPollingSessionId: args.expectedPollingSessionId,
        expectedPollingCycleId: args.expectedPollingCycleId,
      })
    ) {
      return false;
    }

    const nextPollingCycleId = crypto.randomUUID();
    await ctx.db.patch(tournament._id, {
      pollingCycleId: nextPollingCycleId,
      pollingCycleStartedAt: undefined,
    });
    await ctx.scheduler.runAfter(
      args.delayMs,
      internal.tournamentSync.pollTournamentAndScheduleNext,
      {
        userId: args.userId,
        pollingSessionId: args.expectedPollingSessionId,
        pollingCycleId: nextPollingCycleId,
      },
    );
    await schedulePollingCycleWatchdog(ctx, {
      userId: args.userId,
      pollingSessionId: args.expectedPollingSessionId,
      pollingCycleId: nextPollingCycleId,
      delayMs: args.delayMs,
    });
    return true;
  },
});

export const expirePollingCycle = internalMutation({
  args: {
    userId: v.id("users"),
    expectedPollingSessionId: v.string(),
    expectedPollingCycleId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const tournament = await ctx.db
      .query("tournaments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (
      !tournament ||
      !isPollingCycleCurrent({
        pollingSessionId: tournament.pollingSessionId,
        pollingCycleId: tournament.pollingCycleId,
        expectedPollingSessionId: args.expectedPollingSessionId,
        expectedPollingCycleId: args.expectedPollingCycleId,
      })
    ) {
      return false;
    }

    const message =
      "Tournament polling timed out before the cycle completed. Restart auto sync to retry.";
    await ctx.db.patch(
      tournament._id,
      pollingCycleFailureUpdates(message),
    );
    await logIntegrationEvent(ctx, {
      userId: args.userId,
      tournamentId: tournament._id,
      action: "POLLING_CYCLE_TIMEOUT",
      status: "error",
      message,
    });
    return true;
  },
});

export const failPollingCycle = internalMutation({
  args: {
    userId: v.id("users"),
    expectedPollingSessionId: v.string(),
    expectedPollingCycleId: v.string(),
    pollingErrorMessage: v.string(),
    logAction: v.string(),
    logMessage: v.string(),
    logMetadata: v.optional(v.any()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const tournament = await ctx.db
      .query("tournaments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (
      !tournament ||
      !isPollingCycleCurrent({
        pollingSessionId: tournament.pollingSessionId,
        pollingCycleId: tournament.pollingCycleId,
        expectedPollingSessionId: args.expectedPollingSessionId,
        expectedPollingCycleId: args.expectedPollingCycleId,
      })
    ) {
      return false;
    }

    await ctx.db.patch(
      tournament._id,
      pollingCycleFailureUpdates(args.pollingErrorMessage),
    );
    await logIntegrationEvent(ctx, {
      userId: args.userId,
      tournamentId: tournament._id,
      action: args.logAction,
      status: "error",
      message: args.logMessage,
      metadata: args.logMetadata,
    });
    return true;
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

    const pollingSessionId = crypto.randomUUID();
    const pollingCycleId: string | null = await ctx.runMutation(
      internal.tournamentSync.claimPollingSession,
      {
        userId: args.userId,
        expectedExternalTournamentId: externalTournamentId,
        pollingSessionId,
      },
    );
    if (!pollingCycleId) {
      console.log(
        `Tournament ${externalTournamentId} already has a polling session or is no longer eligible. Skipping validation.`,
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
            expectedPollingSessionId: pollingSessionId,
            expectedPollingCycleId: pollingCycleId,
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
      const validationStatusUpdated: boolean = await ctx.runMutation(
        internal.tournamentSync.updateTournamentPollingStatus,
        {
          tournamentId: tournament._id,
          userId: args.userId,
          expectedPollingSessionId: pollingSessionId,
          expectedPollingCycleId: pollingCycleId,
          logAction: "VALIDATION_SUCCESS",
          logStatus: "success",
          logMessage: `Tournament validated successfully. Starting polling.`,
          logMetadata: { status: overview.StatusDescription },
        },
      );
      if (!validationStatusUpdated) {
        return;
      }

      // Finish validation and atomically hand the session to the first poll.
      await ctx.runMutation(
        internal.tournamentSync.finishPollingCycleAndScheduleNext,
        {
          userId: args.userId,
          expectedPollingSessionId: pollingSessionId,
          expectedPollingCycleId: pollingCycleId,
          delayMs: 0,
        },
      );
    } catch (error) {
      // Reset to manual mode and log error in one mutation
      await ctx.runMutation(
        internal.tournamentSync.updateTournamentPollingStatus,
        {
          tournamentId: tournament._id,
          userId: args.userId,
          expectedPollingSessionId: pollingSessionId,
          expectedPollingCycleId: pollingCycleId,
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
    pollingSessionId: v.string(),
    pollingCycleId: v.string(),
  },
  handler: async (ctx, args) => {
    const pollingCycleClaimed: boolean = await ctx.runMutation(
      internal.tournamentSync.claimPollingCycleExecution,
      {
        userId: args.userId,
        expectedPollingSessionId: args.pollingSessionId,
        expectedPollingCycleId: args.pollingCycleId,
      },
    );
    if (!pollingCycleClaimed) {
      return;
    }

    try {
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
            expectedPollingSessionId: args.pollingSessionId,
            expectedPollingCycleId: args.pollingCycleId,
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
        const pollingStatusUpdated: boolean = await ctx.runMutation(
          internal.tournamentSync.updateTournamentPollingStatus,
          {
            tournamentId: tournament._id,
            userId: args.userId,
            expectedPollingSessionId: args.pollingSessionId,
            expectedPollingCycleId: args.pollingCycleId,
            pollingStatus: "active",
            logAction: "NO_CURRENT_ROUND_FOUND",
            logStatus: "warning",
            logMessage: "No current round matches found in Melee data",
          },
        );
        if (!pollingStatusUpdated) {
          return;
        }
        await ctx.runMutation(
          internal.tournamentSync.finishPollingCycleAndScheduleNext,
          {
            userId: args.userId,
            expectedPollingSessionId: args.pollingSessionId,
            expectedPollingCycleId: args.pollingCycleId,
            delayMs: POLLING_INTERVAL,
          },
        );
        return;
      }

      // Update tournament status and log successful fetch in one mutation
      const pollingStatusUpdated: boolean = await ctx.runMutation(
        internal.tournamentSync.updateTournamentPollingStatus,
        {
          tournamentId: tournament._id,
          userId: args.userId,
          expectedPollingSessionId: args.pollingSessionId,
          expectedPollingCycleId: args.pollingCycleId,
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
      if (!pollingStatusUpdated) {
        return;
      }

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

      // Atomically invalidate this cycle's watchdog and hand off to the next
      // scheduled execution.
      await ctx.runMutation(
        internal.tournamentSync.finishPollingCycleAndScheduleNext,
        {
          userId: args.userId,
          expectedPollingSessionId: args.pollingSessionId,
          expectedPollingCycleId: args.pollingCycleId,
          delayMs: POLLING_INTERVAL,
        },
      );
    } catch (error) {
      console.error(`Error polling tournament for ${args.userId}:`, error);
      await ctx.runMutation(
        internal.tournamentSync.failPollingCycle,
        {
          userId: args.userId,
          expectedPollingSessionId: args.pollingSessionId,
          expectedPollingCycleId: args.pollingCycleId,
          pollingErrorMessage: `Error polling tournament: ${error}`,
          logAction: "POLL_ERROR",
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
