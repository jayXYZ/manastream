import { internal } from "../../_generated/api";
import { MutationCtx } from "../../_generated/server";
import { RoundStandings } from "../../types";
import { SpicerackRoundStandings } from "../../types/spicerack";
import { Id } from "../../_generated/dataModel";
import { getOwnTournament } from "../tournaments";
import { getUserSettings } from "../settings";

export async function getSpicerackRoundStandingsHelper(
  ctx: MutationCtx,
  spicerackRoundId: number,
): Promise<Id<"roundStandings">> {
  const standings = await ctx.db
    .query("roundStandings")
    .withIndex("by_spicerackRoundId", (q) =>
      q.eq("spicerackRoundId", spicerackRoundId),
    )
    .first();
  if (standings) {
    return standings._id;
  } else {
    const newStandings = await createSpicerackRoundStandings(
      ctx,
      spicerackRoundId,
    );
    return newStandings._id;
  }
}

async function createSpicerackRoundStandings(
  ctx: MutationCtx,
  spicerackRoundId: number,
): Promise<RoundStandings> {
  const tournament = await getOwnTournament(ctx);
  const settings = await getUserSettings(ctx);
  if (!settings.spicerackApiKey || !tournament.spicerackTournamentId) {
    throw new Error("No Spicerack API key found for user");
  }

  // Check again in case another concurrent call created it
  const existingStandings = await ctx.db
    .query("roundStandings")
    .withIndex("by_spicerackRoundId", (q) =>
      q.eq("spicerackRoundId", spicerackRoundId),
    )
    .first();
  if (existingStandings) {
    return existingStandings;
  }
  // Don't set _creationTime manually - Convex handles it automatically
  const pendingRoundStandings = {
    spicerackRoundId,
    spicerackTournamentId: tournament.spicerackTournamentId,
    roundNumber: "PENDING" as const,
    standings: "PENDING" as const,
    updatedAt: Date.now(),
  };
  const newStandingsId = await ctx.db.insert(
    "roundStandings",
    pendingRoundStandings,
  );

  ctx.scheduler.runAfter(
    0,
    internal.overlays.fetchAndUpdateSpicerackRoundStandings,
    {
      tournamentId: tournament._id,
      standingsId: newStandingsId,
      spicerackRoundId: spicerackRoundId,
      spicerackApiKey: settings.spicerackApiKey,
    },
  );

  const createdStandings = await ctx.db.get(newStandingsId);
  if (!createdStandings) {
    throw new Error("Failed to create round standings");
  }
  return createdStandings;
}

export async function updateSpicerackRoundStandingsHelper(
  ctx: MutationCtx,
  standingsId: Id<"roundStandings">,
  standingsData: SpicerackRoundStandings,
): Promise<void> {
  await ctx.db.patch(standingsId, {
    roundNumber: standingsData.round_number,
    standings: standingsData.standings,
    updatedAt: Date.now(),
  });
}
