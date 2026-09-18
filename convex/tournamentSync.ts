import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { logIntegrationEvent } from "./lib/logging";
import { MANUAL_POLL_COOLDOWN, POLLING_INTERVAL } from "./lib/constants";
import {
  settingsValidator,
  externalTournamentValidator,
  tournamentValidator,
  roundSnapshotValidator,
  manualPollResultValidator,
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
  MeleeMatch,
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
  changedPollingStatusFields,
  isPollingCycleCurrent,
  isRoundChange,
  manualPollDecision,
  parseAllowCompletedTournamentPolling,
  pollingCycleFailureUpdates,
  shouldStopPollingForCompletedTournament,
} from "./lib/pollingBehavior";
import { getPollingSession } from "./lib/pollingSession";
import { requireAuth } from "./lib/auth";
import { getOwnTournament } from "./lib/tournaments";
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
 * Internal mutation to update tournament polling status with logging.
 *
 * Only patches the tournament when a requested field actually differs, so a
 * quiet poll cycle leaves the document untouched and does not re-run the
 * dashboard and overlay subscriptions that read it.
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
    if (!tournament) {
      return false;
    }
    const session = await getPollingSession(ctx, tournamentId);
    if (
      session?.pollingSessionId !== expectedPollingSessionId ||
      (expectedPollingCycleId !== undefined &&
        session.pollingCycleId !== expectedPollingCycleId)
    ) {
      return false;
    }

    const shouldClearPollingSession =
      updates.mode === "manual" ||
      updates.pollingStatus === "inactive" ||
      updates.pollingStatus === "error";

    const changes = changedPollingStatusFields(tournament, updates);
    if (Object.keys(changes).length > 0) {
      await ctx.db.patch(tournamentId, changes);
    }
    if (shouldClearPollingSession) {
      await ctx.db.delete(session._id);
    }

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
    if (!tournament) {
      return null;
    }
    const existingSession = await getPollingSession(ctx, tournament._id);
    if (
      !canClaimPollingSession({
        mode: tournament.mode,
        pollingStatus: tournament.pollingStatus,
        pollingSessionId: existingSession?.pollingSessionId,
        currentExternalTournamentId: tournament.externalTournamentId,
        expectedExternalTournamentId: args.expectedExternalTournamentId,
      })
    ) {
      return null;
    }

    const pollingCycleId = crypto.randomUUID();
    // A leftover row from a session that is no longer active is replaced.
    if (existingSession) {
      await ctx.db.delete(existingSession._id);
    }
    await ctx.db.insert("pollingSessions", {
      tournamentId: tournament._id,
      pollingSessionId: args.pollingSessionId,
      pollingCycleId,
      pollingCycleStartedAt: Date.now(),
    });

    const changes = changedPollingStatusFields(tournament, {
      pollingStatus: "active",
      pollingErrorMessage: undefined,
    });
    if (Object.keys(changes).length > 0) {
      await ctx.db.patch(tournament._id, changes);
    }
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
    if (!tournament) {
      return false;
    }
    const session = await getPollingSession(ctx, tournament._id);
    if (
      !session ||
      !canClaimPollingCycleExecution({
        mode: tournament.mode,
        pollingStatus: tournament.pollingStatus,
        pollingSessionId: session.pollingSessionId,
        pollingCycleId: session.pollingCycleId,
        pollingCycleStartedAt: session.pollingCycleStartedAt,
        expectedPollingSessionId: args.expectedPollingSessionId,
        expectedPollingCycleId: args.expectedPollingCycleId,
      })
    ) {
      return false;
    }
    await ctx.db.patch(session._id, {
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
      tournament.pollingStatus !== "active"
    ) {
      return false;
    }
    const session = await getPollingSession(ctx, tournament._id);
    if (
      !session ||
      !isPollingCycleCurrent({
        pollingSessionId: session.pollingSessionId,
        pollingCycleId: session.pollingCycleId,
        expectedPollingSessionId: args.expectedPollingSessionId,
        expectedPollingCycleId: args.expectedPollingCycleId,
      })
    ) {
      return false;
    }

    const nextPollingCycleId = crypto.randomUUID();
    await ctx.db.patch(session._id, {
      pollingCycleId: nextPollingCycleId,
      pollingCycleStartedAt: undefined,
      lastCycleFinishedAt: Date.now(),
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

/**
 * "Refresh now": run a poll cycle immediately instead of waiting for the
 * scheduled one. Rotates the cycle id so the already-scheduled run (and its
 * watchdog) fail their cycle check and exit, then schedules a fresh cycle at
 * delay 0. Refuses while a cycle is executing or shortly after one finished.
 */
export const requestImmediatePoll = mutation({
  args: {},
  returns: manualPollResultValidator,
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const tournament = await getOwnTournament(ctx);
    const session = await getPollingSession(ctx, tournament._id);
    const decision = manualPollDecision({
      mode: tournament.mode,
      pollingStatus: tournament.pollingStatus,
      hasSession: session !== null,
      pollingCycleStartedAt: session?.pollingCycleStartedAt,
      lastCycleFinishedAt: session?.lastCycleFinishedAt,
      now: Date.now(),
      cooldownMs: MANUAL_POLL_COOLDOWN,
    });
    if (decision !== "scheduled" || !session) {
      return decision;
    }

    const nextPollingCycleId = crypto.randomUUID();
    await ctx.db.patch(session._id, {
      pollingCycleId: nextPollingCycleId,
      pollingCycleStartedAt: undefined,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.tournamentSync.pollTournamentAndScheduleNext,
      {
        userId,
        pollingSessionId: session.pollingSessionId,
        pollingCycleId: nextPollingCycleId,
        forceFullFetch: true,
      },
    );
    await schedulePollingCycleWatchdog(ctx, {
      userId,
      pollingSessionId: session.pollingSessionId,
      pollingCycleId: nextPollingCycleId,
    });
    await logIntegrationEvent(ctx, {
      userId,
      tournamentId: tournament._id,
      action: "MANUAL_POLL_REQUESTED",
      status: "info",
      message: "Refresh requested. Polling Melee now.",
    });
    return decision;
  },
});

/**
 * Shared body for the watchdog timeout and explicit cycle failure: drops the
 * tournament back to manual with an error and removes the session row so the
 * orphaned loop can no longer claim cycles. Returns false when the cycle is
 * no longer current.
 */
async function failCurrentPollingCycle(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    expectedPollingSessionId: string;
    expectedPollingCycleId: string;
    pollingErrorMessage: string;
    logAction: string;
    logMessage: string;
    logMetadata?: unknown;
  },
): Promise<boolean> {
  const tournament = await ctx.db
    .query("tournaments")
    .withIndex("by_user", (q) => q.eq("userId", args.userId))
    .unique();
  if (!tournament) {
    return false;
  }
  const session = await getPollingSession(ctx, tournament._id);
  if (
    !session ||
    !isPollingCycleCurrent({
      pollingSessionId: session.pollingSessionId,
      pollingCycleId: session.pollingCycleId,
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
  await ctx.db.delete(session._id);
  await logIntegrationEvent(ctx, {
    userId: args.userId,
    tournamentId: tournament._id,
    action: args.logAction,
    status: "error",
    message: args.logMessage,
    metadata: args.logMetadata,
  });
  return true;
}

export const expirePollingCycle = internalMutation({
  args: {
    userId: v.id("users"),
    expectedPollingSessionId: v.string(),
    expectedPollingCycleId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const message =
      "Tournament polling timed out before the cycle completed. Restart auto sync to retry.";
    return await failCurrentPollingCycle(ctx, {
      ...args,
      pollingErrorMessage: message,
      logAction: "POLLING_CYCLE_TIMEOUT",
      logMessage: message,
    });
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
    return await failCurrentPollingCycle(ctx, args);
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
 * Fetch standings for the already-fetched current-round matches and compose
 * them into a RoundSnapshot. Returns undefined when there are no matches.
 * Only called when the round changed or a full fetch was requested, so the
 * standings requests are per round rather than per cycle.
 */
async function fetchRoundSnapshot(
  externalTournamentId: number,
  overview: MeleeTournamentOverviewResponse,
  matches: MeleeMatch[],
  credentials: MeleeCredentials,
): Promise<RoundSnapshot | undefined> {
  if (matches.length === 0) {
    return undefined;
  }
  const standings = await fetchMeleeCurrentStandings(
    externalTournamentId,
    credentials,
  );

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
 * Pull the Melee player list once and reconcile it: registration statuses
 * (drops), players not yet cached, and decklists for players cached without
 * one (late submissions). The player list is the largest Melee payload, so
 * this runs at validation, on round change, and on manual refresh only.
 */
async function syncPlayersFromMelee(
  ctx: ActionCtx,
  externalTournamentId: number,
  credentials: MeleeCredentials,
): Promise<void> {
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
  const cachedPlayerIdSet = new Set(cachedPlayerIds);
  const newEntries = playerEntries.filter(
    (entry) => !cachedPlayerIdSet.has(entry.ID),
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
  if (playersWithMissingDecklists.length === 0) {
    return;
  }
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
        await ctx.runMutation(internal.tournamentSync.recordCompletedRounds, {
          externalTournamentId,
          completedRounds: parseCompletedRounds(overview, undefined),
        });
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
      await syncPlayersFromMelee(ctx, externalTournamentId, credentials);

      // Snapshot the current round (round info and pairings)
      const matches = await fetchMeleeCurrentRoundMatches(
        externalTournamentId,
        credentials,
      );
      const snapshot = await fetchRoundSnapshot(
        externalTournamentId,
        overview,
        matches,
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
    // Re-fetch standings and the player list even when the round is
    // unchanged (manual "refresh now").
    forceFullFetch: v.optional(v.boolean()),
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
        await ctx.runMutation(internal.tournamentSync.recordCompletedRounds, {
          externalTournamentId,
          completedRounds: parseCompletedRounds(overview, undefined),
        });
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

      // The current match list is the only per-cycle fetch besides the
      // overview: it tells us the round id, which is all a quiet cycle needs.
      const matches = await fetchMeleeCurrentRoundMatches(
        externalTournamentId,
        credentials,
      );
      const currentMatch = matches[0];

      if (!currentMatch) {
        // Between rounds or before pairings post: keep polling without
        // touching stored round state. Not logged per cycle; the next
        // FETCH_EVENT_SUCCESS entry marks when a round is found.
        console.log(
          `Tournament ${externalTournamentId}: no current round matches found`,
        );
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

      const roundChanged = isRoundChange({
        storedRoundId: externalTournament.currentRoundId,
        storedRoundNumber: externalTournament.currentRoundNumber,
        polledRoundId: currentMatch.RoundId,
        polledRoundNumber: currentMatch.RoundNumber,
      });

      if (!roundChanged && !args.forceFullFetch) {
        // Quiet cycle: the round's pairings are already captured and feature
        // matches are chosen in Manastream, so there is nothing to sync.
        console.log(
          `Tournament ${externalTournamentId}: round ${currentMatch.RoundNumber} unchanged, skipping full fetch`,
        );
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

      const snapshot = await fetchRoundSnapshot(
        externalTournamentId,
        overview,
        matches,
        credentials,
      );
      if (!snapshot) {
        throw new Error("Failed to build round snapshot from current matches");
      }

      // Confirm the session is still current before writing round state.
      // The status is already "active", so this only writes when logging a
      // newly detected round.
      const pollingStatusUpdated: boolean = await ctx.runMutation(
        internal.tournamentSync.updateTournamentPollingStatus,
        {
          tournamentId: tournament._id,
          userId: args.userId,
          expectedPollingSessionId: args.pollingSessionId,
          expectedPollingCycleId: args.pollingCycleId,
          pollingStatus: "active",
          ...(roundChanged
            ? {
                logAction: "FETCH_EVENT_SUCCESS",
                logStatus: "success" as const,
                logMessage: `Successfully fetched event data. Status: ${overview.StatusDescription}, Round: ${snapshot.roundNumber}`,
                logMetadata: {
                  status: overview.StatusDescription,
                  round: snapshot.roundNumber,
                },
              }
            : {}),
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

      // Drops and late decklists: once per round instead of every cycle
      await syncPlayersFromMelee(ctx, externalTournamentId, credentials);

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
      await ctx.runMutation(internal.tournamentSync.failPollingCycle, {
        userId: args.userId,
        expectedPollingSessionId: args.pollingSessionId,
        expectedPollingCycleId: args.pollingCycleId,
        pollingErrorMessage: `Error polling tournament: ${error}`,
        logAction: "POLL_ERROR",
        logMessage: `Error during poll cycle: ${error}`,
        logMetadata: { error: String(error) },
      });
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
