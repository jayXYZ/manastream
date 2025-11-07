import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { requireAuth } from "./auth";

export async function getUserTournament(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"tournaments"> | null> {
  return await ctx.db
    .query("tournaments")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

export async function getOwnTournament(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"tournaments">> {
  const userId = await requireAuth(ctx);
  const tournament = await getUserTournament(ctx, userId);
  if (!tournament) {
    throw new Error("No tournament found for this user");
  }
  return tournament;
}

export async function requireUserTournament(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"tournaments">> {
  const tournament = await getUserTournament(ctx, userId);
  if (!tournament) {
    throw new Error("No tournament found for this user");
  }
  return tournament;
}

// unauthorized
export async function getTournamentTimerAndRoundInfo(
  ctx: QueryCtx,
  tournamentId: Id<"tournaments">,
): Promise<{
  manualTimerExpiry: number;
  manualTimerRunning: boolean;
  currentRound: number;
  currentRoundDisplayName: string;
}> {
  const tournament = await ctx.db.get(tournamentId);
  if (!tournament) {
    throw new Error("Tournament not found");
  }
  return {
    manualTimerExpiry: tournament.manualTimerExpiry ?? 0,
    manualTimerRunning: tournament.manualTimerRunning ?? false,
    currentRound: tournament.spicerackCurrentRoundNumber ?? 0,
    currentRoundDisplayName: tournament.currentRoundDisplayName ?? "",
  };
}
