import { MutationCtx } from "../_generated/server";

/**
 * A life tracker heartbeats every minute (`hooks/use-presence.ts`). A row
 * whose `lastSeen` is older than this is treated as abandoned.
 */
export const LIFE_TRACKER_TIMEOUT_MS = 5 * 60 * 1000;

/** Rows deleted per cleanup transaction before rescheduling. */
export const LIFE_TRACKER_CLEANUP_BATCH_SIZE = 100;

/**
 * Upper bound on life trackers counted for one overlay. Only the owner's
 * open tabs register against an overlay, and the UI just distinguishes
 * none / one / several, so the count never needs to read past this.
 */
export const MAX_COUNTED_LIFE_TRACKERS = 50;

/**
 * Delete one batch of life-tracker rows last seen before `cutoff`, using the
 * `by_last_seen` index so only stale rows are read. Returns `true` when the
 * batch was full and another pass may be needed.
 */
export async function deleteStaleLifeTrackersBatch(
  ctx: MutationCtx,
  cutoff: number,
): Promise<boolean> {
  const stale = await ctx.db
    .query("connectedLifeTrackers")
    .withIndex("by_last_seen", (q) => q.lt("lastSeen", cutoff))
    .take(LIFE_TRACKER_CLEANUP_BATCH_SIZE);

  for (const tracker of stale) {
    await ctx.db.delete(tracker._id);
  }

  return stale.length === LIFE_TRACKER_CLEANUP_BATCH_SIZE;
}
