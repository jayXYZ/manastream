import { internal } from "../_generated/api";
import { MutationCtx } from "../_generated/server";
import { RoundStandings } from "../types";
import { StandingRow } from "../models/melee";
import { Id } from "../_generated/dataModel";
import { getOwnTournament } from "./tournaments";
import {
  getMeleeCredentialsFromSettings,
  getUserSettings,
  hasMeleeCredentials,
} from "./settings";

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
  const settings = await getUserSettings(ctx);
  if (!hasMeleeCredentials(settings) || !tournament.externalTournamentId) {
    throw new Error("No Melee credentials found for user");
  }
  const credentials = getMeleeCredentialsFromSettings(settings);

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

  await ctx.scheduler.runAfter(
    0,
    internal.overlays.fetchAndUpdateRoundStandings,
    {
      tournamentId: tournament._id,
      standingsId: newStandingsId,
      externalRoundId,
      meleeClientId: credentials.clientId,
      meleeClientSecret: credentials.clientSecret,
    },
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
    updatedAt: Date.now(),
  });
}
