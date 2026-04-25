import { MutationCtx } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { DEFAULT_MATCH } from "../constants";
import { parseCurrentSpicerackRound } from "../../models/spicerack";
import { SpicerackEventResponse } from "../../types/spicerack";
import { logSpicerackEvent } from "../logging";
import {
  getCurrentRoundDisplayName,
  parseCompletedRounds,
} from "../../models/spicerack";

/**
 * Checks for a new Spicerack round and handles it if found.
 * @param ctx - The mutation context
 * @param tournamentId - The ID of the tournament
 * @param jsonData - The Spicerack event response data
 */
export async function checkForNewSpicerackRound(
  ctx: MutationCtx,
  tournamentId: Id<"tournaments">,
  jsonData: SpicerackEventResponse,
) {
  const tournament = await ctx.db.get(tournamentId);
  if (!tournament || !tournament.spicerackTournamentId) {
    throw new Error("Tournament not found or missing Spicerack tournament ID");
  }
  const spicerackTournamentId = tournament.spicerackTournamentId;
  const spicerackTournament = await ctx.db
    .query("spicerackTournaments")
    .withIndex("by_spicerack_tournament_id", (q) =>
      q.eq("spicerackTournamentId", spicerackTournamentId),
    )
    .unique();
  if (!spicerackTournament) {
    throw new Error("Spicerack tournament not found");
  }
  const currentRound = parseCurrentSpicerackRound(jsonData);
  if (!currentRound) {
    await logSpicerackEvent(ctx, {
      userId: tournament.userId,
      action: "NO_CURRENT_ROUND_FOUND",
      status: "error",
      message: "No current round found in Spicerack data",
      tournamentId: tournamentId,
    });
    return;
  }
  if (
    currentRound.id !== spicerackTournament.currentRoundId ||
    currentRound.round_number !== spicerackTournament.currentRoundNumber
  ) {
    console.log("New round detected, handling new round");
    const newRoundDisplayName = getCurrentRoundDisplayName(jsonData);
    const completedRounds = parseCompletedRounds(jsonData);
    await handleNewSpicerackRound(
      ctx,
      tournamentId,
      spicerackTournament._id,
      currentRound.id,
      currentRound.round_number,
      newRoundDisplayName ?? "",
      completedRounds,
    );
  }
}

/**
 * Handle a new Spicerack round
 * @param ctx - The mutation context
 * @param tournamentId - The ID of the tournament
 * @param spicerackTournamentDocId - The ID of the Spicerack tournament document
 * @param spicerackNewRoundId - The ID of the new round
 * @param spicerackNewRoundNumber - The number of the new round
 * @param newRoundDisplayName - The display name of the new round
 * @param completedRounds - The completed rounds
 * @throws Error if the Spicerack tournament document is not found
 */
export async function handleNewSpicerackRound(
  ctx: MutationCtx,
  tournamentId: Id<"tournaments">,
  spicerackTournamentDocId: Id<"spicerackTournaments">,
  spicerackNewRoundId: number,
  spicerackNewRoundNumber: number,
  newRoundDisplayName: string | undefined,
  completedRounds: { roundId: number; roundName: string }[],
) {
  console.log(
    "Handling new round",
    spicerackNewRoundId,
    spicerackNewRoundNumber,
  );
  // updates spicerack tournament round id and number in database with new values
  await ctx.db.patch(spicerackTournamentDocId, {
    currentRoundId: spicerackNewRoundId,
    currentRoundNumber: spicerackNewRoundNumber,
    currentRoundName: newRoundDisplayName ?? "",
    completedRounds: completedRounds,
  });

  // updates tournament table with round info (used by overlays and dashboard)
  await ctx.db.patch(tournamentId, {
    currentRound: spicerackNewRoundNumber,
    currentRoundDisplayName: newRoundDisplayName ?? "",
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
}
