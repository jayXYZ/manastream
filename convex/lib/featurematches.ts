import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { RoundSnapshot, SnapshotMatch } from "../models/melee";
import { NewPlayerEntry, PlayerWithData } from "../types";
import {
  createPlayer,
  doesPlayerExist,
  getPlayersByExternalPlayerIds,
  getPlayersForMatch,
} from "./players";
import { createPendingPlayerEntry } from "./players";

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
  match: SnapshotMatch,
): string {
  return `feature:${externalTournamentId}:${match.externalMatchId}`;
}

/**
 * Compares the round snapshot's feature matches with the database and
 * returns matches that don't exist yet.
 */
async function compareFeatureMatches(
  ctx: QueryCtx | MutationCtx,
  externalTournamentId: number,
  snapshot: RoundSnapshot,
): Promise<SnapshotMatch[]> {
  const featureMatchCandidates = snapshot.matches.filter(
    (match) => match.isFeatureMatch && match.competitors.length === 2,
  );

  const newMatches: SnapshotMatch[] = [];
  for (const match of featureMatchCandidates) {
    const checkId = generateFeatureMatchExternalId(externalTournamentId, match);
    const dbFeatureMatch = await ctx.db
      .query("featureMatches")
      .withIndex("by_external_id", (q) => q.eq("externalId", checkId))
      .first();
    if (!dbFeatureMatch) {
      newMatches.push(match);
    }
  }
  return newMatches;
}

/**
 * Compares players from new feature matches with the database and returns
 * new players that need to be created.
 */
async function comparePlayers(
  ctx: QueryCtx | MutationCtx,
  externalTournamentId: number,
  newFeatureMatches: SnapshotMatch[],
): Promise<NewPlayerEntry[]> {
  const newPlayers: NewPlayerEntry[] = [];

  for (const featureMatch of newFeatureMatches) {
    for (const competitor of featureMatch.competitors) {
      const exists = await doesPlayerExist(
        ctx,
        externalTournamentId,
        competitor.externalPlayerId,
      );
      if (!exists) {
        newPlayers.push(
          createPendingPlayerEntry(
            competitor.externalPlayerId,
            competitor.name,
            externalTournamentId,
            competitor.externalDecklistId,
          ),
        );
      }
    }
  }
  return newPlayers;
}

/**
 * Compares the round snapshot with the database and returns new feature
 * matches and players.
 */
export async function compareRoundToDatabase(
  ctx: QueryCtx | MutationCtx,
  externalTournamentId: number,
  snapshot: RoundSnapshot,
): Promise<{
  newFeatureMatches: SnapshotMatch[];
  newPlayers: NewPlayerEntry[];
}> {
  const newFeatureMatches = await compareFeatureMatches(
    ctx,
    externalTournamentId,
    snapshot,
  );
  const newPlayers = await comparePlayers(
    ctx,
    externalTournamentId,
    newFeatureMatches,
  );
  return { newFeatureMatches, newPlayers };
}

/**
 * Creates feature matches and players in the database.
 * Returns the created players' IDs with their decklist GUIDs so the caller
 * can fetch decklists from the Melee API.
 */
export async function createFeatureMatches(
  ctx: MutationCtx,
  externalTournamentId: number,
  snapshot: RoundSnapshot,
  newFeatureMatches: SnapshotMatch[],
  newPlayers: NewPlayerEntry[],
): Promise<{ playerId: Id<"players">; externalDecklistId?: string }[]> {
  const playerAndDecklistIds: {
    playerId: Id<"players">;
    externalDecklistId?: string;
  }[] = [];
  for (const newPlayer of newPlayers) {
    const playerId = await createPlayer(ctx, externalTournamentId, newPlayer);
    playerAndDecklistIds.push({
      playerId,
      externalDecklistId: newPlayer.externalDecklistId,
    });
  }

  for (const featureMatch of newFeatureMatches) {
    if (featureMatch.competitors.length !== 2) {
      throw new Error(
        `Expected 2 players in match, but found ${featureMatch.competitors.length}`,
      );
    }

    const [competitor1, competitor2] = featureMatch.competitors;

    const { player1Data: player1Doc, player2Data: player2Doc } =
      await getPlayersByExternalPlayerIds(
        ctx,
        externalTournamentId,
        competitor1.externalPlayerId,
        competitor2.externalPlayerId,
      );

    if (!player1Doc || !player2Doc) {
      throw new Error(
        `Player not found in database. Player 1: ${competitor1.externalPlayerId}, Player 2: ${competitor2.externalPlayerId}`,
      );
    }

    const externalId = generateFeatureMatchExternalId(
      externalTournamentId,
      featureMatch,
    );

    await ctx.db.insert("featureMatches", {
      externalId,
      externalTournamentId,
      externalRoundId: snapshot.roundId,
      roundNumber: snapshot.roundNumber,
      player1: player1Doc._id,
      player2: player2Doc._id,
      player1TournamentRecord: competitor1.tournamentRecord,
      player2TournamentRecord: competitor2.tournamentRecord,
      tableNumber: featureMatch.tableNumber,
      createdAt: Date.now(),
    });
  }
  return playerAndDecklistIds;
}
