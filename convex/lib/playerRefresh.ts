import { Id } from "../_generated/dataModel";
import { QueryCtx } from "../_generated/server";

/** Identifies one "Refresh players" run and the Melee tournament it was requested for. */
export type PlayerRefreshRun = {
  userId: Id<"users">;
  tournamentId: Id<"tournaments">;
  externalTournamentId: number;
  startedAt: number;
};

/**
 * Whether a "Refresh players" run is still the one the tournament is waiting
 * on: the tournament belongs to the user, still points at the Melee tournament
 * the run was requested for, and its playerRefresh is "running" with this
 * run's startedAt (not expired by the watchdog, superseded, or cleared by a
 * tournament switch). Every write the run makes re-checks this in its own
 * transaction, so switching tournaments mid-run stops the writes themselves
 * rather than only the final status update.
 */
export async function isPlayerRefreshRunCurrent(
  ctx: QueryCtx,
  run: PlayerRefreshRun,
): Promise<boolean> {
  const tournament = await ctx.db.get(run.tournamentId);
  return (
    tournament !== null &&
    tournament.userId === run.userId &&
    tournament.externalTournamentId === run.externalTournamentId &&
    tournament.playerRefresh?.status === "running" &&
    tournament.playerRefresh.startedAt === run.startedAt
  );
}

/** Raised by the refresh action when a guarded write reports the run is stale. */
export class PlayerRefreshSupersededError extends Error {
  constructor() {
    super(
      "the Melee tournament changed or the run was superseded before it finished",
    );
    this.name = "PlayerRefreshSupersededError";
  }
}
