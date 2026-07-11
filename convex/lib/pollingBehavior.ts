const ALLOW_COMPLETED_POLLING_TRUE_VALUES = new Set([
  "1",
  "true",
  "yes",
  "on",
]);

export function parseAllowCompletedTournamentPolling(
  value: string | undefined,
): boolean {
  if (!value) {
    return false;
  }

  return ALLOW_COMPLETED_POLLING_TRUE_VALUES.has(
    value.trim().toLowerCase(),
  );
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
    !(
      args.pollingStatus === "active" &&
      args.pollingSessionId !== undefined
    )
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
    pollingSessionId: undefined,
    pollingCycleId: undefined,
    pollingCycleStartedAt: undefined,
  };
}
