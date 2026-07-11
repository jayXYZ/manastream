import { internalMutation, query } from "./_generated/server";
import { Infer } from "convex/values";
import { v } from "convex/values";
import {
  currentRoundPairingsResultValidator,
  roundSnapshotValidator,
} from "./validators";
import { requireAuth } from "./lib/auth";
import { getUserTournament } from "./lib/tournaments";
import {
  getCurrentRoundPairingsWithPlayerData,
  snapshotCurrentRoundPairings,
} from "./lib/pairings";
import { rankPairingsByUniqueness } from "./lib/pairingRankings";
import { getPlayerData } from "./lib/playerData";

type CurrentRoundPairingsResult = Infer<
  typeof currentRoundPairingsResultValidator
>;

export const snapshotCurrentRoundPairingsForTournament = internalMutation({
  args: {
    tournamentId: v.id("tournaments"),
    externalTournamentId: v.number(),
    snapshot: roundSnapshotValidator,
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

    if (!tournament.externalTournamentId) {
      return emptyResult("no_linked_tournament");
    }

    const externalTournament = await ctx.db
      .query("externalTournaments")
      .withIndex("by_external_tournament_id", (q) =>
        q.eq("externalTournamentId", tournament.externalTournamentId!),
      )
      .unique();

    const roundNumber =
      externalTournament?.currentRoundNumber ?? tournament.currentRound;
    if (roundNumber == null) {
      return emptyResult("no_current_round");
    }

    const roundName =
      externalTournament?.currentRoundName ??
      tournament.currentRoundDisplayName ??
      `Round ${roundNumber}`;

    const [pairings, tournamentPlayers] = await Promise.all([
      getCurrentRoundPairingsWithPlayerData(ctx, tournament._id, {
        externalRoundId: externalTournament?.currentRoundId,
        roundNumber,
      }),
      ctx.db
        .query("players")
        .withIndex("by_external_tournament_id", (q) =>
          q.eq("externalTournamentId", tournament.externalTournamentId!),
        )
        .collect(),
    ]);

    const tournamentPlayersWithData = await Promise.all(
      tournamentPlayers.map((player) => getPlayerData(ctx, player)),
    );

    const rankedPairings = rankPairingsByUniqueness(
      pairings,
      tournamentPlayersWithData.map((player) => ({
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
    | "no_linked_tournament"
    | "no_current_round"
    | "no_pairings",
): CurrentRoundPairingsResult {
  return {
    status,
    pairingCount: 0,
    pairings: [],
  };
}
