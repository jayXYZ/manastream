import { Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { RoundSnapshot, SnapshotCompetitor } from "../models/melee";
import {
  createPendingPlayerEntry,
  createPlayer,
  getPlayerByExternalPlayerId,
} from "./players";
import { getPlayerData } from "./playerData";

type SnapshotCurrentRoundPairingsArgs = {
  tournamentId: Id<"tournaments">;
  externalTournamentId: number;
  snapshot: RoundSnapshot;
};

type CurrentRoundPairingsFilter = {
  externalRoundId?: number;
  roundNumber?: number;
};

export async function getCurrentRoundPairingsWithPlayerData(
  ctx: QueryCtx,
  tournamentId: Id<"tournaments">,
  filter: CurrentRoundPairingsFilter,
) {
  const pairings =
    filter.externalRoundId != null
      ? (
          await ctx.db
            .query("pairings")
            .withIndex("by_external_round", (q) =>
              q.eq("externalRoundId", filter.externalRoundId!),
            )
            .collect()
        ).filter((pairing) => pairing.tournamentId === tournamentId)
      : filter.roundNumber != null
        ? await ctx.db
            .query("pairings")
            .withIndex("by_tournament_and_round", (q) =>
              q
                .eq("tournamentId", tournamentId)
                .eq("roundNumber", filter.roundNumber!),
            )
            .collect()
        : [];

  return await Promise.all(
    pairings.map(async (pairing) => {
      const [player1Data, player2Data] = await Promise.all([
        ctx.db.get(pairing.player1),
        ctx.db.get(pairing.player2),
      ]);
      return {
        ...pairing,
        player1Data: player1Data
          ? await getPlayerData(ctx, player1Data)
          : undefined,
        player2Data: player2Data
          ? await getPlayerData(ctx, player2Data)
          : undefined,
      };
    }),
  );
}

export async function snapshotCurrentRoundPairings(
  ctx: MutationCtx,
  args: SnapshotCurrentRoundPairingsArgs,
): Promise<void> {
  const { snapshot } = args;

  for (const match of snapshot.matches) {
    // Skip byes and malformed matches
    if (match.competitors.length !== 2) {
      continue;
    }

    const externalId = generatePairingExternalId({
      externalTournamentId: args.externalTournamentId,
      externalRoundId: snapshot.roundId,
      externalMatchId: match.externalMatchId,
    });
    const existingPairing = await ctx.db
      .query("pairings")
      .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
      .first();
    if (existingPairing) {
      continue;
    }

    const [competitor1, competitor2] = match.competitors;
    const [player1, player2] = await Promise.all([
      getOrCreatePairingPlayer(ctx, {
        externalTournamentId: args.externalTournamentId,
        competitor: competitor1,
      }),
      getOrCreatePairingPlayer(ctx, {
        externalTournamentId: args.externalTournamentId,
        competitor: competitor2,
      }),
    ]);

    await ctx.db.insert("pairings", {
      externalId,
      externalTournamentId: args.externalTournamentId,
      tournamentId: args.tournamentId,
      externalRoundId: snapshot.roundId,
      roundNumber: snapshot.roundNumber,
      externalMatchId: match.externalMatchId,
      player1,
      player2,
      player1TournamentRecord: competitor1.tournamentRecord,
      player2TournamentRecord: competitor2.tournamentRecord,
      player1Seed: competitor1.seed,
      player2Seed: competitor2.seed,
      player1TotalMatchPoints: competitor1.matchPoints,
      player2TotalMatchPoints: competitor2.matchPoints,
      tableNumber: match.tableNumber,
      status: match.hasResult ? "COMPLETE" : "IN_PROGRESS",
      createdAt: Date.now(),
    });
  }
}

function generatePairingExternalId(args: {
  externalTournamentId: number;
  externalRoundId: number;
  externalMatchId: string;
}): string {
  return `pairing:${args.externalTournamentId}:${args.externalRoundId}:${args.externalMatchId}`;
}

async function getOrCreatePairingPlayer(
  ctx: MutationCtx,
  args: {
    externalTournamentId: number;
    competitor: SnapshotCompetitor;
  },
): Promise<Id<"players">> {
  const externalPlayerId = args.competitor.externalPlayerId;
  const existingPlayer = await getPlayerByExternalPlayerId(
    ctx,
    args.externalTournamentId,
    externalPlayerId,
  );

  if (existingPlayer) {
    return existingPlayer._id;
  }

  return await createPlayer(
    ctx,
    args.externalTournamentId,
    createPendingPlayerEntry(
      externalPlayerId,
      args.competitor.name,
      args.externalTournamentId,
      args.competitor.externalDecklistId,
    ),
  );
}
