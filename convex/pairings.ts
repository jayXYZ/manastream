import { internalMutation, query } from "./_generated/server";
import { Infer } from "convex/values";
import { v } from "convex/values";
import { currentRoundPairingsResultValidator } from "./validators";
import { requireAuth } from "./lib/auth";
import { getUserTournament } from "./lib/tournaments";
import {
  getCurrentRoundPairingsWithPlayerData,
  snapshotCurrentRoundPairings,
} from "./lib/pairings";
import { rankPairingsByUniqueness } from "./lib/pairingRankings";

type CurrentRoundPairingsResult = Infer<
  typeof currentRoundPairingsResultValidator
>;

export const snapshotCurrentRoundPairingsForTournament = internalMutation({
  args: {
    tournamentId: v.id("tournaments"),
    spicerackTournamentId: v.number(),
    jsonData: v.any(),
  },
  handler: async (ctx, args) => {
    await snapshotCurrentRoundPairings(ctx, args);
  },
});

export const getCurrentRoundPairings = query({
  args: {},
  returns: currentRoundPairingsResultValidator,
  handler: async (ctx): Promise<CurrentRoundPairingsResult> => {
    const userId = await requireAuth(ctx);
    const tournament = await getUserTournament(ctx, userId);
    if (!tournament) {
      return emptyResult("no_tournament");
    }

    if (!tournament.spicerackTournamentId) {
      return emptyResult("no_spicerack_tournament");
    }

    const spicerackTournament = await ctx.db
      .query("spicerackTournaments")
      .withIndex("by_spicerack_tournament_id", (q) =>
        q.eq("spicerackTournamentId", tournament.spicerackTournamentId!),
      )
      .unique();

    const roundNumber =
      spicerackTournament?.currentRoundNumber ?? tournament.currentRound;
    if (roundNumber == null) {
      return emptyResult("no_current_round");
    }

    const roundName =
      spicerackTournament?.currentRoundName ??
      tournament.currentRoundDisplayName ??
      `Round ${roundNumber}`;

    const [pairings, tournamentPlayers] = await Promise.all([
      getCurrentRoundPairingsWithPlayerData(ctx, tournament._id, {
        spicerackRoundId: spicerackTournament?.currentRoundId,
        roundNumber,
      }),
      ctx.db
        .query("players")
        .withIndex("by_spicerack_tournament_id", (q) =>
          q.eq("spicerackTournamentId", tournament.spicerackTournamentId!),
        )
        .collect(),
    ]);

    const rankedPairings = rankPairingsByUniqueness(
      pairings,
      tournamentPlayers.map((player) => ({
        name: player.name,
        deckName: player.deckName,
      })),
    );

    return {
      status:
        rankedPairings.length > 0
          ? ("ready" as const)
          : ("no_pairings" as const),
      roundNumber,
      roundName,
      pairingCount: rankedPairings.length,
      pairings: rankedPairings,
    };
  },
});

function emptyResult(
  status:
    | "no_tournament"
    | "no_spicerack_tournament"
    | "no_current_round"
    | "no_pairings",
): CurrentRoundPairingsResult {
  return {
    status,
    pairingCount: 0,
    pairings: [],
  };
}
