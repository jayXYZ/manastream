import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { NewPlayerEntry, PlayerWithData } from "../types";

const NO_DECK_INFO = "MISSING_DECKLIST" as const;

type PlayerDataInput = Pick<
  NewPlayerEntry,
  | "externalTournamentId"
  | "externalPlayerId"
  | "registrationStatus"
  | "externalDecklistId"
  | "externalDecklistUpdatedAt"
  | "decklistStatus"
  | "deckName"
  | "deckList"
>;

export type RegistrationStatusTarget = {
  targetId: Id<"playerStatuses"> | Id<"players"> | string;
  currentStatus?: string;
};

export function composePlayerData(
  player: Doc<"players">,
  status?: Doc<"playerStatuses"> | null,
  decklist?: Doc<"playerDecklists"> | null,
): PlayerWithData {
  return {
    ...player,
    registrationStatus:
      status?.registrationStatus ?? player.registrationStatus ?? undefined,
    externalDecklistId:
      decklist?.externalDecklistId ?? player.externalDecklistId ?? undefined,
    decklistStatus: decklist?.decklistStatus ?? player.decklistStatus ?? undefined,
    deckName: decklist?.deckName ?? player.deckName ?? NO_DECK_INFO,
    deckList: decklist?.deckList ?? player.deckList ?? NO_DECK_INFO,
  };
}

export function getChangedRegistrationStatuses(
  incomingStatuses: { externalPlayerId: number; registrationStatus: string }[],
  targetsByExternalPlayerId: Map<number, RegistrationStatusTarget>,
) {
  return incomingStatuses.flatMap((incomingStatus) => {
    const target = targetsByExternalPlayerId.get(
      incomingStatus.externalPlayerId,
    );
    if (
      !target ||
      target.currentStatus === incomingStatus.registrationStatus
    ) {
      return [];
    }
    return [{ ...incomingStatus, targetId: target.targetId }];
  });
}

export function isMissingDecklistData(
  decklist: Pick<
    Partial<Doc<"playerDecklists"> & Doc<"players">>,
    "decklistStatus" | "deckName" | "deckList"
  >,
): boolean {
  if (
    decklist.decklistStatus === "missing" ||
    decklist.decklistStatus === "fetch_failed"
  ) {
    return true;
  }
  if (
    decklist.decklistStatus === "manual" ||
    decklist.decklistStatus === "ready" ||
    decklist.decklistStatus === "pending"
  ) {
    return false;
  }
  return (
    (decklist.deckName === "MISSING_DECKLIST" &&
      decklist.deckList === "MISSING_DECKLIST") ||
    (decklist.deckName === "Unknown" && decklist.deckList === "Unknown")
  );
}

export async function getPlayerStatusByPlayerId(
  ctx: QueryCtx | MutationCtx,
  playerId: Id<"players">,
) {
  return await ctx.db
    .query("playerStatuses")
    .withIndex("by_player_id", (q) => q.eq("playerId", playerId))
    .unique();
}

export async function getPlayerDecklistByPlayerId(
  ctx: QueryCtx | MutationCtx,
  playerId: Id<"players">,
) {
  return await ctx.db
    .query("playerDecklists")
    .withIndex("by_player_id", (q) => q.eq("playerId", playerId))
    .unique();
}

export async function getPlayerData(
  ctx: QueryCtx | MutationCtx,
  player: Doc<"players">,
): Promise<PlayerWithData> {
  const [status, decklist] = await Promise.all([
    getPlayerStatusByPlayerId(ctx, player._id),
    getPlayerDecklistByPlayerId(ctx, player._id),
  ]);
  return composePlayerData(player, status, decklist);
}

export async function insertPlayerDataRows(
  ctx: MutationCtx,
  playerId: Id<"players">,
  player: PlayerDataInput,
): Promise<void> {
  const now = Date.now();
  await Promise.all([
    ctx.db.insert("playerStatuses", {
      playerId,
      externalTournamentId: player.externalTournamentId,
      externalPlayerId: player.externalPlayerId,
      registrationStatus: player.registrationStatus,
      updatedAt: now,
    }),
    ctx.db.insert("playerDecklists", {
      playerId,
      externalTournamentId: player.externalTournamentId,
      externalPlayerId: player.externalPlayerId,
      externalDecklistId: player.externalDecklistId,
      externalDecklistUpdatedAt: player.externalDecklistUpdatedAt,
      decklistStatus: player.decklistStatus,
      deckName: player.deckName,
      deckList: player.deckList,
      updatedAt: now,
    }),
  ]);
}

export async function upsertPlayerDecklist(
  ctx: MutationCtx,
  playerId: Id<"players">,
  player: Omit<PlayerDataInput, "registrationStatus">,
): Promise<void> {
  const existing = await getPlayerDecklistByPlayerId(ctx, playerId);
  const patch = {
    externalTournamentId: player.externalTournamentId,
    externalPlayerId: player.externalPlayerId,
    externalDecklistId: player.externalDecklistId,
    externalDecklistUpdatedAt: player.externalDecklistUpdatedAt,
    decklistStatus: player.decklistStatus,
    deckName: player.deckName,
    deckList: player.deckList,
    updatedAt: Date.now(),
  };
  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return;
  }
  await ctx.db.insert("playerDecklists", { playerId, ...patch });
}

export async function upsertPlayerStatus(
  ctx: MutationCtx,
  player: Pick<
    PlayerDataInput,
    "externalTournamentId" | "externalPlayerId" | "registrationStatus"
  > & { playerId: Id<"players"> },
): Promise<void> {
  const existing = await getPlayerStatusByPlayerId(ctx, player.playerId);
  const patch = {
    externalTournamentId: player.externalTournamentId,
    externalPlayerId: player.externalPlayerId,
    registrationStatus: player.registrationStatus,
    updatedAt: Date.now(),
  };
  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return;
  }
  await ctx.db.insert("playerStatuses", { playerId: player.playerId, ...patch });
}
