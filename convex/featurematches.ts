import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  featureMatchWithPlayersValidator,
  roundSnapshotValidator,
} from "./validators";
import { requireExternalTournament } from "./lib/tournaments";
import {
  createFeatureMatches,
  getFeatureMatchesWithPlayerData,
} from "./lib/featurematches";
import { getPlayersForMatch } from "./lib/players";
import { compareRoundToDatabase } from "./lib/featurematches";

// unauthenticated query for use in deck overlays
export const getFeatureMatchPlayersAndDecks = query({
  args: {
    id: v.optional(v.id("featureMatches")),
  },
  returns: featureMatchWithPlayersValidator,

  handler: async (ctx, args) => {
    if (!args.id) {
      return null;
    }
    const match = await ctx.db.get(args.id);
    if (!match) {
      return null;
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
    const tournament = await requireExternalTournament(ctx);
    if (!tournament) {
      return [];
    }
    const currentRoundId = tournament.currentRoundId;
    const currentRoundNumber = tournament.currentRoundNumber;
    if (currentRoundId == null && currentRoundNumber == null) {
      return [];
    }
    const featureMatchesWithPlayerData = await getFeatureMatchesWithPlayerData(
      ctx,
      {
        externalTournamentId: tournament.externalTournamentId,
        externalRoundId: currentRoundId,
        roundNumber: currentRoundNumber,
      },
    );
    return featureMatchesWithPlayerData;
  },
});

export const getAllFeatureMatches = query({
  args: {},
  returns: v.array(featureMatchWithPlayersValidator),
  handler: async (ctx) => {
    const tournament = await requireExternalTournament(ctx);
    if (!tournament) {
      return [];
    }
    const featureMatchesWithPlayerData = await getFeatureMatchesWithPlayerData(
      ctx,
      { externalTournamentId: tournament.externalTournamentId },
    );
    return featureMatchesWithPlayerData;
  },
});

export const createNewFeatureMatches = internalMutation({
  args: {
    externalTournamentId: v.number(),
    snapshot: roundSnapshotValidator,
  },
  returns: v.array(
    v.object({
      playerId: v.id("players"),
      externalDecklistId: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const { newFeatureMatches, newPlayers } = await compareRoundToDatabase(
      ctx,
      args.externalTournamentId,
      args.snapshot,
    );
    const playerAndDecklistIds = await createFeatureMatches(
      ctx,
      args.externalTournamentId,
      args.snapshot,
      newFeatureMatches,
      newPlayers,
    );
    return playerAndDecklistIds;
  },
});
