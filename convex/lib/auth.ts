import { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "../_generated/dataModel";
import {
  requireCommentaryOverlay,
  requireCardOverlay,
  requireMatchOverlay,
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
  return { userId, overlay: overlay as any, tournament };
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
  return { userId, overlay: overlay as any, tournament };
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
  return { userId, overlay: overlay as any, tournament };
}
