import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { Player } from "../types";

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
  player1Data?: Doc<"players">;
  player2Data?: Doc<"players">;
}> {
  const [player1Data, player2Data] = await Promise.all([
    player1Id ? ctx.db.get(player1Id) : Promise.resolve(undefined),
    player2Id ? ctx.db.get(player2Id) : Promise.resolve(undefined),
  ]);

  return {
    player1Data: player1Data ?? undefined,
    player2Data: player2Data ?? undefined,
  };
}

export async function getPlayerByExternalId(
  ctx: QueryCtx,
  externalId: number,
): Promise<Doc<"players"> | undefined> {
  const player = await ctx.db
    .query("players")
    .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
    .first();
  return player ?? undefined;
}

export async function getPlayersByExternalIds(
  ctx: QueryCtx,
  player1ExternalId: number,
  player2ExternalId: number,
): Promise<{
  player1Data?: Doc<"players">;
  player2Data?: Doc<"players">;
}> {
  const [player1Data, player2Data] = await Promise.all([
    getPlayerByExternalId(ctx, player1ExternalId),
    getPlayerByExternalId(ctx, player2ExternalId),
  ]);
  return {
    player1Data: player1Data ?? undefined,
    player2Data: player2Data ?? undefined,
  };
}

export async function doesPlayerExist(
  ctx: QueryCtx,
  externalId: number,
): Promise<boolean> {
  const player = await ctx.db
    .query("players")
    .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
    .first();
  return player !== null;
}

export async function createPlayer(
  ctx: MutationCtx,
  tournamentId: Id<"tournaments">,
  player: Pick<
    Player,
    "name" | "externalId" | "deckId" | "deckName" | "deckList"
  >,
): Promise<Id<"players">> {
  const playerId = await ctx.db.insert("players", {
    ...player,
    tournamentId,
    createdAt: Date.now(),
  });
  return playerId;
}
