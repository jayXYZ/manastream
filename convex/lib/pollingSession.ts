import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * The polling session row for a tournament, or null when no auto-sync
 * session is active. Session and cycle tokens live here rather than on the
 * tournament document so the per-cycle claim/finish writes do not invalidate
 * dashboard and overlay subscriptions on the tournament.
 */
export async function getPollingSession(
  ctx: QueryCtx | MutationCtx,
  tournamentId: Id<"tournaments">,
): Promise<Doc<"pollingSessions"> | null> {
  return await ctx.db
    .query("pollingSessions")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .unique();
}

export async function clearPollingSession(
  ctx: MutationCtx,
  tournamentId: Id<"tournaments">,
): Promise<void> {
  const session = await getPollingSession(ctx, tournamentId);
  if (session) {
    await ctx.db.delete(session._id);
  }
}
