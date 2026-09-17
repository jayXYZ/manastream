import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { DEFAULT_MATCH } from "./constants";
import { RoundSnapshot } from "../models/melee";
import { snapshotCurrentRoundPairings } from "./pairings";
import { emitAutomationEvent } from "./automations";

type CompletedRound = { roundId: number; roundName: string };

/**
 * Compares the polled round snapshot against the stored current round and
 * handles a round change: patches the external tournament + tournament rows,
 * snapshots pairings, and resets match overlays. The display name and
 * completed rounds are precomputed by the polling action (they require the
 * tournament overview, which mutations can't fetch).
 */
export async function checkForNewRound(
  ctx: MutationCtx,
  tournamentId: Id<"tournaments">,
  snapshot: RoundSnapshot,
  completedRounds: CompletedRound[],
) {
  const tournament = await ctx.db.get(tournamentId);
  if (!tournament || !tournament.externalTournamentId) {
    throw new Error("Tournament not found or missing external tournament ID");
  }
  const externalTournamentId = tournament.externalTournamentId;
  const externalTournament = await ctx.db
    .query("externalTournaments")
    .withIndex("by_external_tournament_id", (q) =>
      q.eq("externalTournamentId", externalTournamentId),
    )
    .unique();
  if (!externalTournament) {
    throw new Error("External tournament not found");
  }

  if (
    snapshot.roundId !== externalTournament.currentRoundId ||
    snapshot.roundNumber !== externalTournament.currentRoundNumber
  ) {
    console.log("New round detected, handling new round");
    await handleNewRound(
      ctx,
      tournamentId,
      externalTournamentId,
      externalTournament._id,
      snapshot,
      completedRounds,
    );
    return;
  }

  if (
    !completedRoundsEqual(
      externalTournament.completedRounds ?? [],
      completedRounds,
    )
  ) {
    await ctx.db.patch(externalTournament._id, {
      completedRounds,
    });
  }

  await snapshotCurrentRoundPairings(ctx, {
    tournamentId,
    externalTournamentId,
    snapshot,
  });
}

function completedRoundsEqual(
  left: CompletedRound[],
  right: CompletedRound[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (round, index) =>
        round.roundId === right[index].roundId &&
        round.roundName === right[index].roundName,
    )
  );
}

export async function handleNewRound(
  ctx: MutationCtx,
  tournamentId: Id<"tournaments">,
  externalTournamentId: number,
  externalTournamentDocId: Id<"externalTournaments">,
  snapshot: RoundSnapshot,
  completedRounds: CompletedRound[],
) {
  console.log("Handling new round", snapshot.roundId, snapshot.roundNumber);
  const tournament = await ctx.db.get(tournamentId);
  const previousRoundNumber = tournament?.currentRound;

  await ctx.db.patch(externalTournamentDocId, {
    currentRoundId: snapshot.roundId,
    currentRoundNumber: snapshot.roundNumber,
    currentRoundName: snapshot.roundDisplayName,
    completedRounds,
  });

  // updates tournament table with round info (used by overlays and dashboard)
  await ctx.db.patch(tournamentId, {
    currentRound: snapshot.roundNumber,
    currentRoundDisplayName: snapshot.roundDisplayName,
  });

  await snapshotCurrentRoundPairings(ctx, {
    tournamentId,
    externalTournamentId,
    snapshot,
  });

  // resets all match overlays for the tournament
  const tournamentOverlays = await ctx.db
    .query("overlays")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .collect();

  const matchOverlays = tournamentOverlays.filter(
    (overlay) => overlay.overlayType === "match",
  );

  for (const matchOverlay of matchOverlays) {
    await ctx.db.patch(matchOverlay._id, DEFAULT_MATCH);
  }

  if (tournament) {
    await emitAutomationEvent(ctx, {
      userId: tournament.userId,
      tournamentId,
      type: "round.started",
      dedupeKey: `round.started:${tournamentId}:${snapshot.roundId}`,
      payload: {
        tournamentId,
        eventName: tournament.eventName,
        roundId: snapshot.roundId,
        roundNumber: snapshot.roundNumber,
        roundDisplayName: snapshot.roundDisplayName,
        previousRoundNumber,
      },
    });
  }
}
