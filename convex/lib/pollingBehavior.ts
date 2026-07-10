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
