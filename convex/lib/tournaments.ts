import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
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

/**
 * The caller's tournament, or null when there is no signed-in user or the
 * user has no tournament yet (password sign-ups are not initialized until
 * they verify their email). For queries: a query reruns unauthenticated
 * during sign-out or a token refresh, and throwing there reaches the React
 * error boundary. Mutations should use `getOwnTournament` and throw.
 */
export async function getOptionalOwnTournament(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"tournaments"> | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    return null;
  }
  return await getUserTournament(ctx, userId);
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

/**
 * The Melee tournament linked to the caller's tournament, or null when the
 * caller is signed out, has no tournament, or has not linked one. Used by
 * queries, so it never throws for a missing identity.
 */
export async function getOwnExternalTournament(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"externalTournaments"> | null> {
  const tournament = await getOptionalOwnTournament(ctx);
  if (!tournament?.externalTournamentId) {
    return null;
  }
  const externalTournamentId = tournament.externalTournamentId;
  const externalTournament = await ctx.db
    .query("externalTournaments")
    .withIndex("by_external_tournament_id", (q) =>
      q.eq("externalTournamentId", externalTournamentId),
    )
    .unique();
  return externalTournament;
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
    currentRound: tournament.currentRound ?? 0,
    currentRoundDisplayName: tournament.currentRoundDisplayName ?? "",
  };
}
