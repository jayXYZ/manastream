const ALLOW_COMPLETED_POLLING_TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

export function parseAllowCompletedTournamentPolling(
  value: string | undefined,
): boolean {
  if (!value) {
    return false;
  }

  return ALLOW_COMPLETED_POLLING_TRUE_VALUES.has(value.trim().toLowerCase());
}

export function shouldStopPollingForCompletedTournament(args: {
  isCompleted: boolean;
  allowCompletedTournamentPolling: boolean;
}): boolean {
  if (!args.isCompleted) {
    return false;
  }

  return !args.allowCompletedTournamentPolling;
}

export function hasExternalTournamentChanged(args: {
  currentExternalTournamentId?: number;
  requestedExternalTournamentId?: number;
}): boolean {
  return (
    args.requestedExternalTournamentId !== undefined &&
    args.requestedExternalTournamentId !== args.currentExternalTournamentId
  );
}

export function canClaimPollingSession(args: {
  mode: "manual" | "auto";
  pollingStatus?: "active" | "inactive" | "error";
  pollingSessionId?: string;
  currentExternalTournamentId?: number;
  expectedExternalTournamentId: number;
}): boolean {
  return (
    args.mode === "auto" &&
    args.currentExternalTournamentId === args.expectedExternalTournamentId &&
    !(args.pollingStatus === "active" && args.pollingSessionId !== undefined)
  );
}

export function isPollingSessionCurrent(args: {
  mode: "manual" | "auto";
  pollingStatus?: "active" | "inactive" | "error";
  pollingSessionId?: string;
  expectedPollingSessionId: string;
}): boolean {
  return (
    args.mode === "auto" &&
    args.pollingStatus === "active" &&
    args.pollingSessionId === args.expectedPollingSessionId
  );
}

export function isPollingCycleCurrent(args: {
  pollingSessionId?: string;
  pollingCycleId?: string;
  expectedPollingSessionId: string;
  expectedPollingCycleId: string;
}): boolean {
  return (
    args.pollingSessionId === args.expectedPollingSessionId &&
    args.pollingCycleId === args.expectedPollingCycleId
  );
}

export function canClaimPollingCycleExecution(args: {
  mode: "manual" | "auto";
  pollingStatus?: "active" | "inactive" | "error";
  pollingSessionId?: string;
  pollingCycleId?: string;
  pollingCycleStartedAt?: number;
  expectedPollingSessionId: string;
  expectedPollingCycleId: string;
}): boolean {
  return (
    isPollingSessionCurrent(args) &&
    isPollingCycleCurrent(args) &&
    args.pollingCycleStartedAt === undefined
  );
}

export function pollingCycleFailureUpdates(message: string) {
  return {
    mode: "manual" as const,
    pollingStatus: "error" as const,
    pollingErrorMessage: message,
  };
}

export type PollingStatusFields = {
  mode?: "manual" | "auto";
  pollingStatus?: "active" | "inactive" | "error";
  pollingErrorMessage?: string;
};

/**
 * The subset of requested polling status updates that actually differ from
 * the tournament's current values. Skipping a patch when this is empty keeps a
 * quiet poll cycle from rewriting the tournament document and re-running
 * every subscription that reads it.
 */
export function changedPollingStatusFields(
  current: PollingStatusFields,
  updates: PollingStatusFields,
): PollingStatusFields {
  const changed: PollingStatusFields = {};
  for (const key of ["mode", "pollingStatus", "pollingErrorMessage"] as const) {
    if (key in updates && updates[key] !== current[key]) {
      (changed as Record<string, unknown>)[key] = updates[key];
    }
  }
  return changed;
}

/**
 * Whether a polled round differs from the round currently stored for the
 * external tournament. Mirrors the round-change check in checkForNewRound so
 * the polling action can log once per round instead of once per cycle.
 */
export function isRoundChange(args: {
  storedRoundId?: number;
  storedRoundNumber?: number;
  polledRoundId: number;
  polledRoundNumber: number;
}): boolean {
  return (
    args.polledRoundId !== args.storedRoundId ||
    args.polledRoundNumber !== args.storedRoundNumber
  );
}

export type ManualPollDecision =
  | "scheduled"
  | "not_polling"
  | "in_progress"
  | "cooldown";

/**
 * Whether a "refresh now" request may start a poll cycle immediately.
 * Refuses while a cycle is executing, and briefly after one finishes so a
 * double-click cannot hammer Melee.
 */
export function manualPollDecision(args: {
  mode: "manual" | "auto";
  pollingStatus?: "active" | "inactive" | "error";
  hasSession: boolean;
  pollingCycleStartedAt?: number;
  lastCycleFinishedAt?: number;
  now: number;
  cooldownMs: number;
}): ManualPollDecision {
  if (
    args.mode !== "auto" ||
    args.pollingStatus !== "active" ||
    !args.hasSession
  ) {
    return "not_polling";
  }
  if (args.pollingCycleStartedAt !== undefined) {
    return "in_progress";
  }
  if (
    args.lastCycleFinishedAt !== undefined &&
    args.now - args.lastCycleFinishedAt < args.cooldownMs
  ) {
    return "cooldown";
  }
  return "scheduled";
}
