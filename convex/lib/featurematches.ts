import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import {
  generateFeatureMatchExternalId,
  parseCurrentRoundFeatureMatches,
  parsePlayerRecord,
} from "../models/spicerack";
import { Player } from "../types";
import { SpicerackEventResponse, SpicerackMatch } from "../types/spicerack";
import {
  createPlayer,
  doesPlayerExist,
  getPlayersByExternalIds,
  getPlayersForMatch,
} from "./players";

export async function getFeatureMatches(
  ctx: QueryCtx,
  tournamentId: Id<"tournaments">,
  roundNumber?: number,
): Promise<Doc<"featureMatches">[]> {
  if (!roundNumber) {
    const featureMatches = await ctx.db
      .query("featureMatches")
      .withIndex("by_tournament_and_round", (q) =>
        q.eq("tournamentId", tournamentId),
      )
      .collect();
    return featureMatches;
  } else {
    const featureMatches = await ctx.db
      .query("featureMatches")
      .withIndex(
        "by_tournament_and_round",
        (q) =>
          q.eq("tournamentId", tournamentId).eq("roundNumber", roundNumber), // round number is NOT the spicerack round ID
      )
      .collect();
    return featureMatches;
  }
}

export async function getFeatureMatchesWithPlayerData(
  ctx: QueryCtx,
  tournamentId: Id<"tournaments">,
  roundNumber?: number,
): Promise<
  (Doc<"featureMatches"> & {
    player1Data?: Doc<"players">;
    player2Data?: Doc<"players">;
  })[]
> {
  const featureMatches = await getFeatureMatches(
    ctx,
    tournamentId,
    roundNumber,
  );
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
  tournamentId: Id<"tournaments">,
  jsonData: SpicerackEventResponse,
): Promise<SpicerackMatch[]> {
  const tournament = await ctx.db.get(tournamentId);
  if (!tournament || !tournament.spicerackTournamentId) {
    throw new Error("Tournament not found");
  }
  const currentRoundSpicerackMatches =
    parseCurrentRoundFeatureMatches(jsonData);
  const newMatches: SpicerackMatch[] = [];
  for (let spicerackMatch of currentRoundSpicerackMatches) {
    const checkId = generateFeatureMatchExternalId(
      tournament.spicerackTournamentId,
      tournament.spicerackCurrentRoundId,
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
 * Constant for pending deck information before it's fetched from Spicerack
 */
const PENDING_DECK_INFO = "PENDING" as const;
const NO_DECK_INFO = "NO_DECKLIST_FOUND" as const;

/**
 * Type for a new player entry to be created
 */
type NewPlayerEntry = Pick<
  Player,
  "name" | "externalId" | "deckId" | "deckName" | "deckList"
>;

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
 * Creates a new player entry with pending deck information
 */
function createPendingPlayerEntry(
  id: number,
  name: string,
  decklistId: number | null,
): NewPlayerEntry {
  if (!decklistId) {
    return {
      name,
      externalId: id,
      deckId: -1,
      deckName: NO_DECK_INFO,
      deckList: NO_DECK_INFO,
    };
  }
  return {
    name,
    externalId: id,
    deckId: decklistId,
    deckName: PENDING_DECK_INFO,
    deckList: PENDING_DECK_INFO,
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
          player1Info.decklistId,
        ),
      );
    }

    if (!player2Exists) {
      newPlayers.push(
        createPendingPlayerEntry(
          player2Info.id,
          player2Info.name,
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
 * @param tournamentId - The tournament ID to compare data for
 * @param jsonData - The Spicerack event response data
 * @returns An object containing the new feature matches and players
 */
export async function compareSpicerackToDatabase(
  ctx: QueryCtx | MutationCtx,
  tournamentId: Id<"tournaments">,
  jsonData: SpicerackEventResponse,
): Promise<{
  newFeatureMatches: SpicerackMatch[];
  newPlayers: NewPlayerEntry[];
}> {
  const newFeatureMatches = await compareFeatureMatches(
    ctx,
    tournamentId,
    jsonData,
  );
  const newPlayers = await comparePlayers(ctx, newFeatureMatches);
  return { newFeatureMatches, newPlayers };
}

/**
 * Creates feature matches and players in the database.
 * @param ctx - The mutation context
 * @param tournamentId - The tournament ID to create feature matches for
 * @param newFeatureMatches - The new feature matches to create
 * @param newPlayers - The new players to create
 * @returns void
 */
export async function createFeatureMatches(
  ctx: MutationCtx,
  tournamentId: Id<"tournaments">,
  newFeatureMatches: SpicerackMatch[],
  newPlayers: NewPlayerEntry[],
): Promise<{ playerId: Id<"players">; deckId: number }[]> {
  // Track the IDs of the created players to return them to the caller
  // so that we can fetch their decklists from Spicerack
  const playerAndDeckIds: { playerId: Id<"players">; deckId: number }[] = [];
  // First, create all new players
  // Convex will batch these operations efficiently within a single transaction
  for (const newPlayer of newPlayers) {
    const playerId = await createPlayer(ctx, tournamentId, newPlayer);
    playerAndDeckIds.push({ playerId, deckId: newPlayer.deckId });
  }

  // Get tournament data to generate external IDs
  const tournament = await ctx.db.get(tournamentId);
  if (!tournament || !tournament.spicerackTournamentId) {
    throw new Error("Tournament not found or missing Spicerack ID");
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
    const player1ExternalId = player1Relationship.user_event_status.id;
    const player2ExternalId = player2Relationship.user_event_status.id;

    // Look up player database IDs
    const { player1Data: player1Doc, player2Data: player2Doc } =
      await getPlayersByExternalIds(ctx, player1ExternalId, player2ExternalId);

    if (!player1Doc || !player2Doc) {
      throw new Error(
        `Player not found in database. Player 1: ${player1ExternalId}, Player 2: ${player2ExternalId}`,
      );
    }

    // Parse tournament records for each player
    const player1TournamentRecord = parsePlayerRecord(
      player1Relationship.user_event_status,
    );
    const player2TournamentRecord = parsePlayerRecord(
      player2Relationship.user_event_status,
    );

    // Generate external ID for this feature match
    const externalId = generateFeatureMatchExternalId(
      tournament.spicerackTournamentId,
      tournament.spicerackCurrentRoundId,
      featureMatch,
    );

    // Insert the feature match
    await ctx.db.insert("featureMatches", {
      externalId,
      tournamentId,
      roundNumber: tournament.spicerackCurrentRoundNumber,
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
