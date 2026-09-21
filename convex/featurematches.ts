import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { featureMatchWithPlayersValidator } from "./validators";
import { requireExternalTournament } from "./lib/tournaments";
import { requireTournamentAccess } from "./lib/auth";
import {
  createFeatureMatchFromPairing,
  featureMatchExternalMatchId,
  getFeatureMatches,
  getFeatureMatchesWithPlayerData,
  removeFeatureMatchForPairing,
} from "./lib/featurematches";
import { getPlayersForMatch } from "./lib/players";

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

/**
 * Melee match GUIDs of the current round's feature matches. Kept separate
 * from the pairings query so toggling a feature match does not re-run the
 * (much heavier) pairings ranking.
 */
export const getCurrentRoundFeaturedMatchIds = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const tournament = await requireExternalTournament(ctx);
    if (!tournament) {
      return [];
    }
    if (
      tournament.currentRoundId == null &&
      tournament.currentRoundNumber == null
    ) {
      return [];
    }
    const featureMatches = await getFeatureMatches(ctx, {
      externalTournamentId: tournament.externalTournamentId,
      externalRoundId: tournament.currentRoundId,
      roundNumber: tournament.currentRoundNumber,
    });
    return featureMatches.map(featureMatchExternalMatchId);
  },
});

/**
 * Mark or unmark a captured pairing as a feature match. This replaces
 * reading Melee's feature-match flag on every poll cycle.
 */
export const setPairingFeatured = mutation({
  args: {
    pairingId: v.id("pairings"),
    featured: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const pairing = await ctx.db.get(args.pairingId);
    if (!pairing) {
      throw new Error("Pairing not found");
    }
    await requireTournamentAccess(ctx, pairing.tournamentId);
    if (args.featured) {
      await createFeatureMatchFromPairing(ctx, pairing);
    } else {
      await removeFeatureMatchForPairing(ctx, pairing);
    }
    return null;
  },
});
