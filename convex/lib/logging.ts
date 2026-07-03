import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

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
