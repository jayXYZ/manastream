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
