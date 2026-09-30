import { internal } from "../_generated/api";
import { MutationCtx } from "../_generated/server";
import { RoundStandings } from "../types";
import { StandingRow } from "../models/melee";
import { Id } from "../_generated/dataModel";
import { getOwnTournament } from "./tournaments";

export async function getRoundStandingsHelper(
  ctx: MutationCtx,
  externalRoundId: number,
): Promise<Id<"roundStandings">> {
  const standings = await ctx.db
    .query("roundStandings")
    .withIndex("by_external_round_id", (q) =>
      q.eq("externalRoundId", externalRoundId),
    )
    .first();
  if (standings) {
    if (standings.standings === "ERROR") {
      await ctx.db.patch(standings._id, {
        standings: "PENDING",
        lastError: undefined,
        updatedAt: Date.now(),
      });
      await scheduleRoundStandingsFetch(
        ctx,
        standings._id,
        externalRoundId,
      );
    }
    return standings._id;
  }
  const newStandings = await createRoundStandings(ctx, externalRoundId);
  return newStandings._id;
}

async function createRoundStandings(
  ctx: MutationCtx,
  externalRoundId: number,
): Promise<RoundStandings> {
  const tournament = await getOwnTournament(ctx);
  if (!tournament.externalTournamentId) {
    throw new Error("No Melee tournament found for user");
  }

  // Check again in case another concurrent call created it
  const existingStandings = await ctx.db
    .query("roundStandings")
    .withIndex("by_external_round_id", (q) =>
      q.eq("externalRoundId", externalRoundId),
    )
    .first();
  if (existingStandings) {
    return existingStandings;
  }
  const pendingRoundStandings = {
    externalRoundId,
    externalTournamentId: tournament.externalTournamentId,
    roundNumber: "PENDING" as const,
    standings: "PENDING" as const,
    updatedAt: Date.now(),
  };
  const newStandingsId = await ctx.db.insert(
    "roundStandings",
    pendingRoundStandings,
  );

  await scheduleRoundStandingsFetch(
    ctx,
    newStandingsId,
    externalRoundId,
  );

  const createdStandings = await ctx.db.get(newStandingsId);
  if (!createdStandings) {
    throw new Error("Failed to create round standings");
  }
  return createdStandings;
}

export async function updateRoundStandingsHelper(
  ctx: MutationCtx,
  standingsId: Id<"roundStandings">,
  standingsData: { roundNumber: number; standings: StandingRow[] },
): Promise<void> {
  await ctx.db.patch(standingsId, {
    roundNumber: standingsData.roundNumber,
    standings: standingsData.standings,
    lastError: undefined,
    updatedAt: Date.now(),
  });
}

export async function markRoundStandingsFetchFailedHelper(
  ctx: MutationCtx,
  standingsId: Id<"roundStandings">,
  error: string,
): Promise<void> {
  await ctx.db.patch(standingsId, {
    standings: "ERROR",
    lastError: error,
    updatedAt: Date.now(),
  });
}

async function scheduleRoundStandingsFetch(
  ctx: MutationCtx,
  standingsId: Id<"roundStandings">,
  externalRoundId: number,
) {
  const tournament = await getOwnTournament(ctx);

  await ctx.scheduler.runAfter(
    0,
    internal.overlays.standings.fetchAndUpdateRoundStandings,
    {
      tournamentId: tournament._id,
      standingsId,
      externalRoundId,
    },
  );
}
