import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { featureMatchWithPlayersValidator } from "./validators";
import { getOwnTournament } from "./lib/tournaments";
import {
  createFeatureMatches,
  getFeatureMatchesWithPlayerData,
} from "./lib/featurematches";
import { getPlayersForMatch } from "./lib/players";
import { compareSpicerackToDatabase } from "./lib/featurematches";

// unauthenticated query for use in deck overlays
export const getFeatureMatchPlayersAndDecks = query({
  args: {
    id: v.id("featureMatches"),
  },
  returns: featureMatchWithPlayersValidator,

  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.id);
    if (!match) {
      throw new Error("Feature match not found");
    }
    const { player1Data, player2Data } = await getPlayersForMatch(
      ctx,
      match.player1,
      match.player2,
    );
    return {
      ...match,
      player1Data: player1Data ?? undefined,
      player2Data: player2Data ?? undefined,
    };
  },
});

export const getCurrentRoundFeatureMatches = query({
  args: {},
  returns: v.array(featureMatchWithPlayersValidator),
  handler: async (ctx) => {
    const tournament = await getOwnTournament(ctx);
    const currentRoundNumber = tournament.spicerackCurrentRoundNumber;
    if (!currentRoundNumber) {
      return [];
    }
    const featureMatchesWithPlayerData = await getFeatureMatchesWithPlayerData(
      ctx,
      tournament._id,
      currentRoundNumber,
    );
    return featureMatchesWithPlayerData;
  },
});

export const getAllFeatureMatches = query({
  args: {},
  returns: v.array(featureMatchWithPlayersValidator),
  handler: async (ctx) => {
    const tournament = await getOwnTournament(ctx);
    const featureMatchesWithPlayerData = await getFeatureMatchesWithPlayerData(
      ctx,
      tournament._id,
    );
    return featureMatchesWithPlayerData;
  },
});

export const createNewFeatureMatches = internalMutation({
  args: {
    jsonData: v.any(),
    tournamentId: v.id("tournaments"),
  },
  returns: v.array(v.object({ playerId: v.id("players"), deckId: v.number() })),
  handler: async (ctx, args) => {
    const { newFeatureMatches, newPlayers } = await compareSpicerackToDatabase(
      ctx,
      args.tournamentId,
      args.jsonData,
    );
    const playerAndDeckIds = await createFeatureMatches(
      ctx,
      args.tournamentId,
      newFeatureMatches,
      newPlayers,
    );
    return playerAndDeckIds;
  },
});
