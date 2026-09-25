import { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "../_generated/dataModel";
import {
  requireCommentaryOverlay,
  requireCardOverlay,
  requireMatchOverlay,
  requireDeckOverlay,
  requireStandingsOverlay,
} from "./validation";

export async function requireAuth(
  ctx: QueryCtx | MutationCtx | ActionCtx,
): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("User not authenticated");
  }
  return userId;
}

export async function requireTournamentAccess(
  ctx: QueryCtx | MutationCtx,
  tournamentId: Id<"tournaments">,
): Promise<{ userId: Id<"users">; tournament: Doc<"tournaments"> }> {
  const userId = await requireAuth(ctx);
  const tournament = await ctx.db.get(tournamentId);

  if (!tournament || tournament.userId !== userId) {
    throw new Error("Tournament not found or access denied");
  }

  return { userId, tournament };
}

export async function requireOverlayAccess(
  ctx: QueryCtx | MutationCtx,
  overlayId: Id<"overlays">,
): Promise<{
  userId: Id<"users">;
  overlay: Doc<"overlays">;
  tournament: Doc<"tournaments">;
}> {
  const overlay = await ctx.db.get(overlayId);

  if (!overlay) {
    throw new Error("Overlay not found");
  }

  const { userId, tournament } = await requireTournamentAccess(
    ctx,
    overlay.tournamentId,
  );

  return { userId, overlay, tournament };
}

export async function requireMatchOverlayAccess(
  ctx: QueryCtx | MutationCtx,
  overlayId: Id<"overlays">,
): Promise<{
  userId: Id<"users">;
  overlay: Doc<"overlays"> & { overlayType: "match" };
  tournament: Doc<"tournaments">;
}> {
  const { userId, overlay, tournament } = await requireOverlayAccess(
    ctx,
    overlayId,
  );
  requireMatchOverlay(overlay);
  return { userId, overlay, tournament };
}

export async function requireCardOverlayAccess(
  ctx: QueryCtx | MutationCtx,
  overlayId: Id<"overlays">,
): Promise<{
  userId: Id<"users">;
  overlay: Doc<"overlays"> & { overlayType: "card" };
  tournament: Doc<"tournaments">;
}> {
  const { userId, overlay, tournament } = await requireOverlayAccess(
    ctx,
    overlayId,
  );
  requireCardOverlay(overlay);
  return { userId, overlay, tournament };
}

export async function requireCommentaryOverlayAccess(
  ctx: QueryCtx | MutationCtx,
  overlayId: Id<"overlays">,
): Promise<{
  userId: Id<"users">;
  overlay: Doc<"overlays"> & { overlayType: "commentary" };
  tournament: Doc<"tournaments">;
}> {
  const { userId, overlay, tournament } = await requireOverlayAccess(
    ctx,
    overlayId,
  );
  requireCommentaryOverlay(overlay);
  return { userId, overlay, tournament };
}

export async function requireDeckOverlayAccess(
  ctx: QueryCtx | MutationCtx,
  overlayId: Id<"overlays">,
): Promise<{
  userId: Id<"users">;
  overlay: Doc<"overlays"> & { overlayType: "deck" };
  tournament: Doc<"tournaments">;
}> {
  const { userId, overlay, tournament } = await requireOverlayAccess(
    ctx,
    overlayId,
  );
  requireDeckOverlay(overlay);
  return { userId, overlay, tournament };
}

export async function requireStandingsOverlayAccess(
  ctx: QueryCtx | MutationCtx,
  overlayId: Id<"overlays">,
): Promise<{
  userId: Id<"users">;
  overlay: Doc<"overlays"> & { overlayType: "standings" };
  tournament: Doc<"tournaments">;
}> {
  const { userId, overlay, tournament } = await requireOverlayAccess(
    ctx,
    overlayId,
  );
  requireStandingsOverlay(overlay);
  return { userId, overlay, tournament };
}

/**
 * A feature match the tournament may display: one captured for this
 * tournament, or one shared through the same linked Melee tournament.
 * Feature match rows are keyed by Melee ids and shared across every user
 * who links that Melee tournament, so the external id is the scope.
 */
export async function requireFeatureMatchForTournament(
  ctx: QueryCtx | MutationCtx,
  featureMatchId: Id<"featureMatches">,
  tournament: Doc<"tournaments">,
): Promise<Doc<"featureMatches">> {
  const featureMatch = await ctx.db.get(featureMatchId);
  if (!featureMatch) {
    // A stale selection: the match was unfeatured after the list was loaded.
    throw new Error("Feature match no longer exists. Select another match.");
  }
  const sameTournament = featureMatch.tournamentId === tournament._id;
  const sameExternalTournament =
    featureMatch.externalTournamentId !== undefined &&
    featureMatch.externalTournamentId === tournament.externalTournamentId;
  if (!sameTournament && !sameExternalTournament) {
    throw new Error("Feature match not found or access denied");
  }
  return featureMatch;
}

/**
 * Confirms a Melee round id belongs to the tournament's linked Melee
 * tournament (its current round or one of its completed rounds), so a
 * standings overlay cannot be pointed at, or trigger a fetch for, a round
 * from a tournament the user has not linked.
 */
export async function requireRoundForTournament(
  ctx: QueryCtx | MutationCtx,
  tournament: Doc<"tournaments">,
  externalRoundId: number,
): Promise<void> {
  const externalTournamentId = tournament.externalTournamentId;
  if (externalTournamentId === undefined) {
    throw new Error("No Melee tournament linked");
  }
  const externalTournament = await ctx.db
    .query("externalTournaments")
    .withIndex("by_external_tournament_id", (q) =>
      q.eq("externalTournamentId", externalTournamentId),
    )
    .unique();
  const isKnownRound =
    externalTournament !== null &&
    (externalTournament.currentRoundId === externalRoundId ||
      (externalTournament.completedRounds ?? []).some(
        (round) => round.roundId === externalRoundId,
      ));
  if (!isKnownRound) {
    throw new Error("Round not found in the linked Melee tournament");
  }
}
