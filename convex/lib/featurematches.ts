import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { PlayerWithData } from "../types";
import { getPlayersForMatch } from "./players";

type FeatureMatchRoundFilter = {
  externalTournamentId: number;
  externalRoundId?: number;
  roundNumber?: number;
};

export async function getFeatureMatches(
  ctx: QueryCtx,
  filter: FeatureMatchRoundFilter,
): Promise<Doc<"featureMatches">[]> {
  const featureMatches = await ctx.db
    .query("featureMatches")
    .withIndex("by_external_tournament_id", (q) =>
      q.eq("externalTournamentId", filter.externalTournamentId),
    )
    .collect();

  if (filter.externalRoundId != null) {
    return featureMatches.filter(
      (match) => match.externalRoundId === filter.externalRoundId,
    );
  }

  if (filter.roundNumber != null) {
    return featureMatches.filter(
      (match) => match.roundNumber === filter.roundNumber,
    );
  }

  return featureMatches;
}

export async function getFeatureMatchesWithPlayerData(
  ctx: QueryCtx,
  filter: FeatureMatchRoundFilter,
): Promise<
  (Doc<"featureMatches"> & {
    player1Data?: PlayerWithData;
    player2Data?: PlayerWithData;
  })[]
> {
  const featureMatches = await getFeatureMatches(ctx, filter);
  const featureMatchesWithPlayerData = await Promise.all(
    featureMatches.map(async (match) => {
      const { player1Data, player2Data } = await getPlayersForMatch(
        ctx,
        match.player1,
        match.player2,
      );
      return { ...match, player1Data, player2Data };
    }),
  );
  return featureMatchesWithPlayerData;
}

export function generateFeatureMatchExternalId(
  externalTournamentId: number,
  match: { externalMatchId: string },
): string {
  return `feature:${externalTournamentId}:${match.externalMatchId}`;
}

/**
 * The Melee match GUID for a feature match row. Newer rows store it
 * directly; older rows created from Melee's flag only carry it inside the
 * external id.
 */
export function featureMatchExternalMatchId(
  featureMatch: Pick<Doc<"featureMatches">, "externalId" | "externalMatchId">,
): string {
  if (featureMatch.externalMatchId) {
    return featureMatch.externalMatchId;
  }
  return featureMatch.externalId.split(":").slice(2).join(":");
}

/**
 * Create a feature match from a captured pairing. Idempotent: returns the
 * existing row's id when the pairing is already featured.
 */
export async function createFeatureMatchFromPairing(
  ctx: MutationCtx,
  pairing: Doc<"pairings">,
): Promise<Id<"featureMatches">> {
  const externalId = generateFeatureMatchExternalId(
    pairing.externalTournamentId,
    pairing,
  );
  const existing = await ctx.db
    .query("featureMatches")
    .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
    .first();
  if (existing) {
    return existing._id;
  }
  return await ctx.db.insert("featureMatches", {
    externalId,
    externalTournamentId: pairing.externalTournamentId,
    tournamentId: pairing.tournamentId,
    externalRoundId: pairing.externalRoundId,
    roundNumber: pairing.roundNumber,
    player1: pairing.player1,
    player2: pairing.player2,
    player1TournamentRecord: pairing.player1TournamentRecord,
    player2TournamentRecord: pairing.player2TournamentRecord,
    tableNumber: pairing.tableNumber,
    externalMatchId: pairing.externalMatchId,
    createdAt: Date.now(),
  });
}

/**
 * Remove the feature match for a pairing, clearing any deck overlay that
 * still points at it so overlays never reference a missing row.
 */
export async function removeFeatureMatchForPairing(
  ctx: MutationCtx,
  pairing: Doc<"pairings">,
): Promise<void> {
  const externalId = generateFeatureMatchExternalId(
    pairing.externalTournamentId,
    pairing,
  );
  const featureMatch = await ctx.db
    .query("featureMatches")
    .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
    .first();
  if (!featureMatch) {
    return;
  }

  const overlays = await ctx.db
    .query("overlays")
    .withIndex("by_tournament", (q) =>
      q.eq("tournamentId", pairing.tournamentId),
    )
    .collect();
  for (const overlay of overlays) {
    if (
      overlay.overlayType === "deck" &&
      overlay.matchId === featureMatch._id
    ) {
      await ctx.db.patch(overlay._id, { matchId: undefined });
    }
  }
  await ctx.db.delete(featureMatch._id);
}
