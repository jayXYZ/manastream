import { MutationCtx, QueryCtx } from "../../_generated/server";
import { Doc } from "../../_generated/dataModel";

export async function doesSpicerackTournamentExist(
  ctx: MutationCtx | QueryCtx,
  spicerackTournamentId: number,
) {
  const tournament = await ctx.db
    .query("spicerackTournaments")
    .withIndex("by_spicerack_tournament_id", (q) =>
      q.eq("spicerackTournamentId", spicerackTournamentId),
    )
    .unique();
  if (!tournament) {
    return null;
  }
  return tournament;
}

export async function getSpicerackTournament(
  ctx: MutationCtx | QueryCtx,
  spicerackTournamentId: number,
) {
  const tournament = await ctx.db
    .query("spicerackTournaments")
    .withIndex("by_spicerack_tournament_id", (q) =>
      q.eq("spicerackTournamentId", spicerackTournamentId),
    )
    .unique();
  return tournament;
}

export async function createSpicerackTournamentHelper(
  ctx: MutationCtx,
  spicerackTournamentId: number,
) {
  // Check again in case another concurrent call created it
  // (this mutation may be called from an action where the existence check was non-atomic)
  const existingTournament = await ctx.db
    .query("spicerackTournaments")
    .withIndex("by_spicerack_tournament_id", (q) =>
      q.eq("spicerackTournamentId", spicerackTournamentId),
    )
    .unique();
  if (existingTournament) {
    return existingTournament;
  }

  const newSpicerackTournamentId = await ctx.db.insert("spicerackTournaments", {
    spicerackTournamentId,
    updatedAt: Date.now(),
  });
  const newSpicerackTournament = await ctx.db.get(newSpicerackTournamentId);
  if (!newSpicerackTournament) {
    throw new Error(`Failed to create new Spicerack tournament`);
  }
  return newSpicerackTournament;
}

export async function updateSpicerackTournamentHelper(
  ctx: MutationCtx,
  spicerackTournamentId: number,
  updates: Partial<
    Omit<
      Doc<"spicerackTournaments">,
      "_id" | "_creationTime" | "spicerackTournamentId" | "updatedAt"
    >
  >,
) {
  const tournament = await getSpicerackTournament(ctx, spicerackTournamentId);
  if (!tournament) {
    throw new Error(`Spicerack tournament ${spicerackTournamentId} not found`);
  }
  await ctx.db.patch(tournament._id, {
    ...updates,
    updatedAt: Date.now(),
  });
}
