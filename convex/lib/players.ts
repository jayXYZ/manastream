import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { NewPlayerEntry, PlayerWithData } from "../types";
import { getPlayerData, insertPlayerDataRows } from "./playerData";

/**
 * Helper function to get player data for a given spicerack match
 * @param ctx Query context
 * @param player1Id Player 1 database ID
 * @param player2Id Player 2 database ID
 * @returns Player 1 and Player 2 data if they exist, otherwise undefined
 */
export async function getPlayersForMatch(
  ctx: QueryCtx,
  player1Id?: Id<"players">,
  player2Id?: Id<"players">,
): Promise<{
  player1Data?: PlayerWithData;
  player2Data?: PlayerWithData;
}> {
  const [player1Data, player2Data] = await Promise.all([
    player1Id ? ctx.db.get(player1Id) : Promise.resolve(undefined),
    player2Id ? ctx.db.get(player2Id) : Promise.resolve(undefined),
  ]);

  return {
    player1Data: player1Data
      ? await getPlayerData(ctx, player1Data)
      : undefined,
    player2Data: player2Data
      ? await getPlayerData(ctx, player2Data)
      : undefined,
  };
}

export async function getPlayerBySpicerackPlayerId(
  ctx: QueryCtx,
  spicerackPlayerId: number,
): Promise<Doc<"players"> | undefined> {
  const player = await ctx.db
    .query("players")
    .withIndex("by_spicerack_player_id", (q) =>
      q.eq("spicerackPlayerId", spicerackPlayerId),
    )
    .first();
  return player ?? undefined;
}

export async function getPlayersBySpicerackPlayerIds(
  ctx: QueryCtx,
  player1SpicerackPlayerId: number,
  player2SpicerackPlayerId: number,
): Promise<{
  player1Data?: Doc<"players">;
  player2Data?: Doc<"players">;
}> {
  const [player1Data, player2Data] = await Promise.all([
    getPlayerBySpicerackPlayerId(ctx, player1SpicerackPlayerId),
    getPlayerBySpicerackPlayerId(ctx, player2SpicerackPlayerId),
  ]);
  return {
    player1Data: player1Data ?? undefined,
    player2Data: player2Data ?? undefined,
  };
}

export async function doesPlayerExist(
  ctx: QueryCtx,
  spicerackPlayerId: number,
): Promise<boolean> {
  const player = await ctx.db
    .query("players")
    .withIndex("by_spicerack_player_id", (q) =>
      q.eq("spicerackPlayerId", spicerackPlayerId),
    )
    .first();
  return player !== null;
}

export async function createPlayer(
  ctx: MutationCtx,
  spicerackTournamentId: number,
  player: NewPlayerEntry,
): Promise<Id<"players">> {
  const playerId = await ctx.db.insert("players", {
    ...player,
    spicerackTournamentId,
    updatedAt: Date.now(),
  });
  await insertPlayerDataRows(ctx, playerId, {
    ...player,
    spicerackTournamentId,
  });
  return playerId;
}

const NO_DECK_INFO = "MISSING_DECKLIST" as const;
const PENDING_DECK_INFO = "PENDING" as const;

/**
 * Creates a new player entry with pending deck information
 */
export function createPendingPlayerEntry(
  id: number,
  name: string,
  spicerackTournamentId: number,
  decklistId: number | null,
): NewPlayerEntry {
  if (!decklistId) {
    return {
      name,
      spicerackPlayerId: id,
      spicerackTournamentId,
      deckId: -1,
      decklistStatus: "missing",
      deckName: NO_DECK_INFO,
      deckList: NO_DECK_INFO,
    };
  }
  return {
    name,
    spicerackPlayerId: id,
    spicerackTournamentId,
    deckId: decklistId,
    decklistStatus: "pending",
    deckName: PENDING_DECK_INFO,
    deckList: PENDING_DECK_INFO,
  };
}
