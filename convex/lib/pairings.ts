import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import {
  RoundSnapshot,
  SnapshotCompetitor,
  SnapshotMatch,
} from "../models/melee";
import {
  createPendingPlayerEntry,
  createPlayer,
  getPlayerByExternalPlayerId,
} from "./players";
import { TournamentPlayerData, getPlayerDataById } from "./playerData";

type SnapshotCurrentRoundPairingsArgs = {
  tournamentId: Id<"tournaments">;
  externalTournamentId: number;
  snapshot: RoundSnapshot;
};

type CurrentRoundPairingsFilter = {
  externalRoundId?: number;
  roundNumber?: number;
};

/**
 * The round's pairings with both players' data joined in. Pass `playerData`
 * when the caller already holds the tournament's players (a Swiss round's
 * pairings page loads them all anyway); otherwise each pairing's two players
 * are looked up directly, which keeps a top-8 bracket at a handful of reads
 * instead of a scan of every entrant.
 */
export async function getCurrentRoundPairingsWithPlayerData(
  ctx: QueryCtx,
  tournamentId: Id<"tournaments">,
  filter: CurrentRoundPairingsFilter,
  playerData?: TournamentPlayerData,
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
        getPlayerDataById(ctx, pairing.player1, playerData),
        getPlayerDataById(ctx, pairing.player2, playerData),
      ]);
      return { ...pairing, player1Data, player2Data };
    }),
  );
}

/**
 * The given rounds the bracket cannot draw in full from what is stored: no
 * pairing captured for this tournament, or a pairing with no winner yet.
 * Meant for elimination rounds, which hold at most a handful of pairings.
 */
export async function findRoundsNeedingCapture(
  ctx: QueryCtx,
  tournamentId: Id<"tournaments">,
  externalRoundIds: number[],
): Promise<number[]> {
  const needed: number[] = [];
  for (const externalRoundId of externalRoundIds) {
    const captured = (
      await ctx.db
        .query("pairings")
        .withIndex("by_external_round", (q) =>
          q.eq("externalRoundId", externalRoundId),
        )
        .collect()
    ).filter((pairing) => pairing.tournamentId === tournamentId);
    if (
      captured.length === 0 ||
      captured.some((pairing) => pairing.winnerPlayerId === undefined)
    ) {
      needed.push(externalRoundId);
    }
  }
  return needed;
}

/** Byes and malformed matches are never stored as pairings. */
function isCapturablePairing(match: SnapshotMatch): boolean {
  return match.competitors.length === 2;
}

/**
 * The external match ids snapshotCurrentRoundPairings would store for the
 * snapshot. Standings play no part in which matches those are, so a snapshot
 * built without them gives the same answer.
 */
export function capturablePairingMatchIds(snapshot: RoundSnapshot): string[] {
  return snapshot.matches
    .filter(isCapturablePairing)
    .map((match) => match.externalMatchId);
}

/**
 * Whether any of the round's matches has no pairing row yet. Lets a quiet
 * poll cycle notice pairings Melee posted or re-paired after the round was
 * first captured, reading only the pairings index: nothing is fetched or
 * written unless there is something to capture.
 */
export async function roundHasUncapturedPairings(
  ctx: QueryCtx,
  args: {
    externalTournamentId: number;
    externalRoundId: number;
    externalMatchIds: string[];
  },
): Promise<boolean> {
  for (const externalMatchId of args.externalMatchIds) {
    const externalId = generatePairingExternalId({
      externalTournamentId: args.externalTournamentId,
      externalRoundId: args.externalRoundId,
      externalMatchId,
    });
    const existingPairing = await ctx.db
      .query("pairings")
      .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
      .first();
    if (!existingPairing) {
      return true;
    }
  }
  return false;
}

export async function snapshotCurrentRoundPairings(
  ctx: MutationCtx,
  args: SnapshotCurrentRoundPairingsArgs,
): Promise<void> {
  const { snapshot } = args;

  for (const match of snapshot.matches) {
    if (!isCapturablePairing(match)) {
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
      await applyPairingResult(ctx, existingPairing, match);
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
      featuredInMelee: match.isFeatureMatch,
      winnerPlayerId:
        match.winnerExternalPlayerId === competitor1.externalPlayerId
          ? player1
          : match.winnerExternalPlayerId === competitor2.externalPlayerId
            ? player2
            : undefined,
      createdAt: Date.now(),
    });
  }
}

/**
 * Records a reported result on an already captured pairing. Only writes when
 * the stored status or winner would change, so a re-snapshot of a round
 * whose results are already stored touches nothing.
 */
async function applyPairingResult(
  ctx: MutationCtx,
  pairing: Doc<"pairings">,
  match: Pick<SnapshotMatch, "hasResult" | "winnerExternalPlayerId"> & {
    competitors: Pick<SnapshotCompetitor, "externalPlayerId">[];
  },
): Promise<void> {
  if (!match.hasResult || pairing.status === "COMPLETE") {
    if (!match.hasResult || pairing.winnerPlayerId !== undefined) {
      return;
    }
  }
  const [competitor1, competitor2] = match.competitors;
  const winnerPlayerId =
    match.winnerExternalPlayerId === undefined
      ? undefined
      : match.winnerExternalPlayerId === competitor1?.externalPlayerId
        ? pairing.player1
        : match.winnerExternalPlayerId === competitor2?.externalPlayerId
          ? pairing.player2
          : undefined;
  if (
    pairing.status === "COMPLETE" &&
    (winnerPlayerId === undefined || pairing.winnerPlayerId === winnerPlayerId)
  ) {
    return;
  }
  await ctx.db.patch(pairing._id, {
    status: "COMPLETE",
    ...(winnerPlayerId !== undefined ? { winnerPlayerId } : {}),
  });
}

export type MatchResult = {
  externalMatchId: string;
  winnerExternalPlayerId: number;
};

/**
 * The reported results in a snapshot that name a winner. Built from the
 * current match list alone, so a quiet poll cycle can record them without
 * fetching standings.
 */
export function reportedMatchResults(snapshot: RoundSnapshot): MatchResult[] {
  return snapshot.matches.flatMap((match) =>
    match.hasResult && match.winnerExternalPlayerId !== undefined
      ? [
          {
            externalMatchId: match.externalMatchId,
            winnerExternalPlayerId: match.winnerExternalPlayerId,
          },
        ]
      : [],
  );
}

/**
 * Stores reported results on the round's captured pairings. Pairings not yet
 * captured are skipped; the next full snapshot inserts them with the result.
 * Returns how many pairings changed.
 */
export async function recordPairingResults(
  ctx: MutationCtx,
  args: {
    externalTournamentId: number;
    externalRoundId: number;
    results: MatchResult[];
  },
): Promise<number> {
  let changed = 0;
  for (const result of args.results) {
    const externalId = generatePairingExternalId({
      externalTournamentId: args.externalTournamentId,
      externalRoundId: args.externalRoundId,
      externalMatchId: result.externalMatchId,
    });
    const pairing = await ctx.db
      .query("pairings")
      .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
      .first();
    if (!pairing || pairing.winnerPlayerId !== undefined) {
      continue;
    }
    const [player1, player2] = await Promise.all([
      ctx.db.get(pairing.player1),
      ctx.db.get(pairing.player2),
    ]);
    const winnerPlayerId =
      player1?.externalPlayerId === result.winnerExternalPlayerId
        ? pairing.player1
        : player2?.externalPlayerId === result.winnerExternalPlayerId
          ? pairing.player2
          : undefined;
    if (winnerPlayerId === undefined) {
      continue;
    }
    await ctx.db.patch(pairing._id, { status: "COMPLETE", winnerPlayerId });
    changed += 1;
  }
  return changed;
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
