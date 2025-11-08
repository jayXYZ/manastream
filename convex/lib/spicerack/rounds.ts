import { MutationCtx, QueryCtx } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { DEFAULT_MATCH } from "../constants";
import { parseCurrentSpicerackRound } from "../../models/spicerack";
import { SpicerackEventResponse } from "../../types/spicerack";
import { logSpicerackEvent } from "../logging";
import { getCurrentRoundDisplayName } from "../../models/spicerack";

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
  if (!tournament) {
    throw new Error("Tournament not found");
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
    currentRound.id !== tournament.spicerackCurrentRoundId ||
    currentRound.round_number !== tournament.spicerackCurrentRoundNumber
  ) {
    console.log("New round detected, handling new round");
    const newRoundDisplayName = getCurrentRoundDisplayName(jsonData);
    await handleNewSpicerackRound(
      ctx,
      tournamentId,
      currentRound.id,
      currentRound.round_number,
      newRoundDisplayName ?? "",
    );
  }
}

/**
 * Handle a new Spicerack round
 * @param ctx - The mutation context
 * @param tournamentId - The ID of the tournament
 * @param spicerackNewRoundId - The ID of the new round
 * @param spicerackNewRoundNumber - The number of the new round
 */
export async function handleNewSpicerackRound(
  ctx: MutationCtx,
  tournamentId: Id<"tournaments">,
  spicerackNewRoundId: number,
  spicerackNewRoundNumber: number,
  newRoundDisplayName: string | undefined,
) {
  console.log(
    "Handling new round",
    spicerackNewRoundId,
    spicerackNewRoundNumber,
  );
  // updates tournament round id and number in database with new values
  await ctx.db.patch(tournamentId, {
    spicerackCurrentRoundId: spicerackNewRoundId,
    spicerackCurrentRoundNumber: spicerackNewRoundNumber,
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

  for (let matchOverlay of matchOverlays) {
    await ctx.db.patch(matchOverlay._id, DEFAULT_MATCH);
  }
}
