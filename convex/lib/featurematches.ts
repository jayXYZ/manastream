import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import {
  generateFeatureMatchExternalId,
  parseCurrentRoundFeatureMatches,
  parsePlayerTournamentRecord,
} from "../models/spicerack";
import { NewPlayerEntry, PlayerWithData } from "../types";
import { SpicerackEventResponse, SpicerackMatch } from "../types/spicerack";
import {
  createPlayer,
  doesPlayerExist,
  getPlayersBySpicerackPlayerIds,
  getPlayersForMatch,
} from "./players";
import { createPendingPlayerEntry } from "./players";

type FeatureMatchRoundFilter = {
  spicerackTournamentId: number;
  spicerackRoundId?: number;
  roundNumber?: number;
};

export async function getFeatureMatches(
  ctx: QueryCtx,
  filter: FeatureMatchRoundFilter,
): Promise<Doc<"featureMatches">[]> {
  const featureMatches = await ctx.db
    .query("featureMatches")
    .withIndex("by_spicerack_tournament_id", (q) =>
      q.eq("spicerackTournamentId", filter.spicerackTournamentId),
    )
    .collect();

  if (filter.spicerackRoundId != null) {
    const legacyExternalIdPrefix = `${filter.spicerackTournamentId}-${filter.spicerackRoundId}-`;
    return featureMatches.filter(
      (match) =>
        match.spicerackRoundId === filter.spicerackRoundId ||
        (match.spicerackRoundId == null &&
          match.externalId.startsWith(legacyExternalIdPrefix)),
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

/**
 * Compares Spicerack feature matches with the database and returns new feature matches.
 * @param ctx - The query or mutation context
 * @param tournamentId - The tournament ID to compare data for
 * @param jsonData - The Spicerack event response data
 * @returns An array of new feature matches that don't exist in the database
 */
async function compareFeatureMatches(
  ctx: QueryCtx | MutationCtx,
  spicerackTournamentId: number,
  jsonData: SpicerackEventResponse,
): Promise<SpicerackMatch[]> {
  const spicerackTournament = await ctx.db
    .query("spicerackTournaments")
    .withIndex("by_spicerack_tournament_id", (q) =>
      q.eq("spicerackTournamentId", spicerackTournamentId),
    )
    .unique();
  if (!spicerackTournament || spicerackTournament.currentRoundId == null) {
    throw new Error(
      "Spicerack tournament not found or missing current round id",
    );
  }
  const currentRoundSpicerackMatches =
    parseCurrentRoundFeatureMatches(jsonData);
  const newMatches: SpicerackMatch[] = [];
  for (const spicerackMatch of currentRoundSpicerackMatches) {
    const checkId = generateFeatureMatchExternalId(
      spicerackTournament.spicerackTournamentId,
      spicerackTournament.currentRoundId,
      spicerackMatch,
    );
    const dbFeatureMatch = await ctx.db
      .query("featureMatches")
      .withIndex("by_external_id", (q) => q.eq("externalId", checkId))
      .first();
    if (!dbFeatureMatch) {
      newMatches.push(spicerackMatch);
    }
  }
  return newMatches;
}

/**
 * Extracts player information from a Spicerack match relationship
 */
function extractPlayerInfo(
  relationship: SpicerackMatch["player_match_relationships"][number],
): {
  id: number;
  name: string;
  decklistId: number;
} {
  return {
    id: relationship.user_event_status.id,
    name: relationship.user_event_status.user.best_identifier,
    decklistId: relationship.user_event_status.decklist,
  };
}

/**
 * Compares players from Spicerack matches with the database and returns
 * new players that need to be created.
 *
 * @param ctx - The query or mutation context
 * @param newFeatureMatches - The new feature matches that might contain new players
 * @returns An array of new player entries that don't exist in the database
 */
async function comparePlayers(
  ctx: QueryCtx | MutationCtx,
  spicerackTournamentId: number,
  newFeatureMatches: SpicerackMatch[],
): Promise<NewPlayerEntry[]> {
  const newPlayers: NewPlayerEntry[] = [];

  for (const featureMatch of newFeatureMatches) {
    const { player_match_relationships } = featureMatch;

    // Validate that we have exactly 2 players in the match
    if (player_match_relationships.length !== 2) {
      throw new Error(
        `Expected 2 players in match, but found ${player_match_relationships.length}`,
      );
    }

    const [player1Relationship, player2Relationship] =
      player_match_relationships;

    const player1Info = extractPlayerInfo(player1Relationship);
    const player2Info = extractPlayerInfo(player2Relationship);

    // Check if players exist in DB
    const [player1Exists, player2Exists] = await Promise.all([
      doesPlayerExist(ctx, player1Info.id),
      doesPlayerExist(ctx, player2Info.id),
    ]);

    // Add new players that don't exist
    if (!player1Exists) {
      newPlayers.push(
        createPendingPlayerEntry(
          player1Info.id,
          player1Info.name,
          spicerackTournamentId,
          player1Info.decklistId,
        ),
      );
    }

    if (!player2Exists) {
      newPlayers.push(
        createPendingPlayerEntry(
          player2Info.id,
          player2Info.name,
          spicerackTournamentId,
          player2Info.decklistId,
        ),
      );
    }
  }
  return newPlayers;
}

/**
 * Compares Spicerack data with the database and returns new feature matches and players.
 * @param ctx - The query or mutation context
 * @param spicerackTournamentId - The spicerack tournament ID to compare data for
 * @param jsonData - The Spicerack event response data
 * @returns An object containing the new feature matches and players
 */
export async function compareSpicerackToDatabase(
  ctx: QueryCtx | MutationCtx,
  spicerackTournamentId: number,
  jsonData: SpicerackEventResponse,
): Promise<{
  newFeatureMatches: SpicerackMatch[];
  newPlayers: NewPlayerEntry[];
}> {
  const newFeatureMatches = await compareFeatureMatches(
    ctx,
    spicerackTournamentId,
    jsonData,
  );
  const newPlayers = await comparePlayers(
    ctx,
    spicerackTournamentId,
    newFeatureMatches,
  );
  return { newFeatureMatches, newPlayers };
}

/**
 * Creates feature matches and players in the database.
 * @param ctx - The mutation context
 * @param spicerackTournamentId - The spicerack tournament ID to create feature matches for
 * @param newFeatureMatches - The new feature matches to create
 * @param newPlayers - The new players to create
 * @returns void
 */
export async function createFeatureMatches(
  ctx: MutationCtx,
  spicerackTournamentId: number,
  jsonData: SpicerackEventResponse,
  newFeatureMatches: SpicerackMatch[],
  newPlayers: NewPlayerEntry[],
): Promise<{ playerId: Id<"players">; deckId: number }[]> {
  // Track the IDs of the created players to return them to the caller
  // so that we can fetch their decklists from Spicerack
  const playerAndDeckIds: { playerId: Id<"players">; deckId: number }[] = [];
  // First, create all new players
  // Convex will batch these operations efficiently within a single transaction
  for (const newPlayer of newPlayers) {
    const playerId = await createPlayer(ctx, spicerackTournamentId, newPlayer);
    playerAndDeckIds.push({ playerId, deckId: newPlayer.deckId });
  }

  // Get tournament data to generate external IDs
  const spicerackTournament = await ctx.db
    .query("spicerackTournaments")
    .withIndex("by_spicerack_tournament_id", (q) =>
      q.eq("spicerackTournamentId", spicerackTournamentId),
    )
    .unique();
  if (!spicerackTournament || spicerackTournament.currentRoundId == null) {
    throw new Error(
      "Spicerack tournament not found or missing current round id",
    );
  }

  // Now create feature matches, linking them to the players
  for (const featureMatch of newFeatureMatches) {
    const { player_match_relationships } = featureMatch;

    // Validate that we have exactly 2 players in the match
    if (player_match_relationships.length !== 2) {
      throw new Error(
        `Expected 2 players in match, but found ${player_match_relationships.length}`,
      );
    }

    const [player1Relationship, player2Relationship] =
      player_match_relationships;

    // Extract player external IDs
    const player1SpicerackPlayerId = player1Relationship.user_event_status.id;
    const player2SpicerackPlayerId = player2Relationship.user_event_status.id;

    // Look up player database IDs
    const { player1Data: player1Doc, player2Data: player2Doc } =
      await getPlayersBySpicerackPlayerIds(
        ctx,
        player1SpicerackPlayerId,
        player2SpicerackPlayerId,
      );

    if (!player1Doc || !player2Doc) {
      throw new Error(
        `Player not found in database. Player 1: ${player1SpicerackPlayerId}, Player 2: ${player2SpicerackPlayerId}`,
      );
    }

    // Parse tournament records for each player
    const player1TournamentRecord = parsePlayerTournamentRecord(
      jsonData,
      player1Relationship.user_event_status,
    );
    const player2TournamentRecord = parsePlayerTournamentRecord(
      jsonData,
      player2Relationship.user_event_status,
    );

    // Generate external ID for this feature match
    const externalId = generateFeatureMatchExternalId(
      spicerackTournament.spicerackTournamentId,
      spicerackTournament.currentRoundId,
      featureMatch,
    );

    // Insert the feature match
    await ctx.db.insert("featureMatches", {
      externalId,
      spicerackTournamentId: spicerackTournament.spicerackTournamentId,
      spicerackRoundId: spicerackTournament.currentRoundId,
      roundNumber: spicerackTournament.currentRoundNumber ?? 0,
      player1: player1Doc._id,
      player2: player2Doc._id,
      player1TournamentRecord,
      player2TournamentRecord,
      tableNumber:
        featureMatch.table_number > 0 ? featureMatch.table_number : undefined,
      createdAt: Date.now(),
    });
  }
  return playerAndDeckIds;
}
