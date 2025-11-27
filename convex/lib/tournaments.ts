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

export async function requireSpicerackTournament(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"spicerackTournaments">> {
  const tournament = await getOwnTournament(ctx);
  if (!tournament.spicerackTournamentId) {
    throw new Error(
      "No Spicerack tournament ID found for this user tournament",
    );
  }
  const spicerackTournamentId = tournament.spicerackTournamentId;
  const spicerackTournament = await ctx.db
    .query("spicerackTournaments")
    .withIndex("by_spicerack_tournament_id", (q) =>
      q.eq("spicerackTournamentId", spicerackTournamentId),
    )
    .unique();
  if (!spicerackTournament) {
    throw new Error("No tournament found for this Spicerack tournament ID");
  }
  return spicerackTournament;
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
