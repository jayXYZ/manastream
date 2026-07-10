import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

const INTEGRATION_LOG_CLEANUP_BATCH_SIZE = 500;

/**
 * Helper function to log integration events
 * Can be called from within any mutation
 */
export async function logIntegrationEvent(
  ctx: MutationCtx,
  params: {
    userId: Id<"users">;
    action: string;
    status: "success" | "error" | "info" | "warning";
    message: string;
    tournamentId?: Id<"tournaments">;
    metadata?: unknown;
  },
) {
  await ctx.db.insert("integrationLogs", {
    userId: params.userId,
    timestamp: Date.now(),
    action: params.action,
    status: params.status,
    message: params.message,
    tournamentId: params.tournamentId,
    metadata: params.metadata,
  });
}

export async function deleteOldIntegrationLogsBatch(
  ctx: MutationCtx,
  cutoff: number,
): Promise<boolean> {
  const logs = await ctx.db
    .query("integrationLogs")
    .withIndex("by_timestamp", (q) => q.lt("timestamp", cutoff))
    .take(INTEGRATION_LOG_CLEANUP_BATCH_SIZE);

  for (const log of logs) {
    await ctx.db.delete(log._id);
  }

  return logs.length === INTEGRATION_LOG_CLEANUP_BATCH_SIZE;
}
