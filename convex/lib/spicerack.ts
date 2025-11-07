import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { parseCurrentSpicerackRound } from "../models/spicerack";
import { SpicerackEventResponse } from "../types/spicerack";
import { logSpicerackEvent } from "./logging";
import { DEFAULT_MATCH } from "./constants";

export async function checkSpicerackRound(
  ctx: MutationCtx,
  jsonData: SpicerackEventResponse,
  tournamentId: Id<"tournaments">,
  userId: Id<"users">,
) {
  const tournament = await ctx.db.get(tournamentId);

  if (!tournament) {
    throw new Error(`Tournament ${tournamentId} not found`);
  }

  const currentRound = parseCurrentSpicerackRound(jsonData);

  if (!currentRound) {
    return;
  }

  const roundNumber = currentRound.round_number ?? 0;

  if (roundNumber > (tournament.spicerackCurrentRoundNumber || 0)) {
    // Log round change using helper function
    await logSpicerackEvent(ctx, {
      userId,
      action: "ROUND_CHANGE_DETECTED",
      status: "info",
      message: `Round changed from ${tournament.spicerackCurrentRoundNumber} to ${roundNumber}. Resetting match overlays.`,
      tournamentId: tournament._id,
      metadata: {
        oldRound: tournament.spicerackCurrentRoundNumber,
        newRound: roundNumber,
      },
    });

    await ctx.db.patch(tournament._id, {
      spicerackCurrentRoundId: currentRound.id,
      spicerackCurrentRoundNumber: roundNumber,
    });

    const tournamentOverlays = await ctx.db
      .query("overlays")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournament._id))
      .collect();

    const matchOverlays = tournamentOverlays.filter(
      (overlay) => overlay.overlayType === "match",
    );

    for (let matchOverlay of matchOverlays) {
      await ctx.db.patch(matchOverlay._id, DEFAULT_MATCH);
    }
  }
}
