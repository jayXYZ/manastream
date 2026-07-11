import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";

export async function getExternalTournament(
  ctx: MutationCtx | QueryCtx,
  externalTournamentId: number,
) {
  return await ctx.db
    .query("externalTournaments")
    .withIndex("by_external_tournament_id", (q) =>
      q.eq("externalTournamentId", externalTournamentId),
    )
    .unique();
}

export async function createExternalTournamentHelper(
  ctx: MutationCtx,
  externalTournamentId: number,
  name?: string,
) {
  // Check again in case another concurrent call created it
  // (this mutation may be called from an action where the existence check was non-atomic)
  const existingTournament = await getExternalTournament(
    ctx,
    externalTournamentId,
  );
  if (existingTournament) {
    return existingTournament;
  }

  const newDocId = await ctx.db.insert("externalTournaments", {
    externalTournamentId,
    name,
    updatedAt: Date.now(),
  });
  const newExternalTournament = await ctx.db.get(newDocId);
  if (!newExternalTournament) {
    throw new Error(`Failed to create new external tournament`);
  }
  return newExternalTournament;
}

export async function updateExternalTournamentHelper(
  ctx: MutationCtx,
  externalTournamentId: number,
  updates: Partial<
    Omit<
      Doc<"externalTournaments">,
      "_id" | "_creationTime" | "externalTournamentId" | "updatedAt"
    >
  >,
) {
  const tournament = await getExternalTournament(ctx, externalTournamentId);
  if (!tournament) {
    throw new Error(`External tournament ${externalTournamentId} not found`);
  }
  await ctx.db.patch(tournament._id, {
    ...updates,
    updatedAt: Date.now(),
  });
}
