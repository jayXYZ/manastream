import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { NewPlayerEntry, PlayerWithData } from "../types";

const NO_DECK_INFO = "MISSING_DECKLIST" as const;
const DEPRECATED_PLAYER_DATA_FIELDS = [
  "registrationStatus",
  "deckId",
  "decklistStatus",
  "deckName",
  "deckList",
] as const;

type PlayerDataInput = Pick<
  NewPlayerEntry,
  | "spicerackTournamentId"
  | "spicerackPlayerId"
  | "registrationStatus"
  | "deckId"
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
    registrationStatus: status?.registrationStatus ?? undefined,
    deckId: decklist?.deckId ?? -1,
    decklistStatus: decklist?.decklistStatus ?? undefined,
    deckName: decklist?.deckName ?? NO_DECK_INFO,
    deckList: decklist?.deckList ?? NO_DECK_INFO,
  };
}

export function getDeprecatedPlayerDataFieldCleanupPatch(
  player: Partial<
    Pick<
      Doc<"players">,
      "registrationStatus" | "deckId" | "decklistStatus" | "deckName" | "deckList"
    >
  >,
) {
  const patch: Partial<
    Record<(typeof DEPRECATED_PLAYER_DATA_FIELDS)[number], undefined>
  > = {};
  for (const field of DEPRECATED_PLAYER_DATA_FIELDS) {
    if (player[field] !== undefined) {
      patch[field] = undefined;
    }
  }
  return patch;
}

export function getChangedRegistrationStatuses(
  incomingStatuses: { spicerackPlayerId: number; registrationStatus: string }[],
  targetsBySpicerackPlayerId: Map<number, RegistrationStatusTarget>,
) {
  return incomingStatuses.flatMap((incomingStatus) => {
    const target = targetsBySpicerackPlayerId.get(
      incomingStatus.spicerackPlayerId,
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
  return false;
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

export async function getPlayerStatusBySpicerackTournamentAndPlayerId(
  ctx: QueryCtx | MutationCtx,
  spicerackTournamentId: number,
  spicerackPlayerId: number,
) {
  return await ctx.db
    .query("playerStatuses")
    .withIndex("by_spicerack_tournament_id_and_spicerack_player_id", (q) =>
      q
        .eq("spicerackTournamentId", spicerackTournamentId)
        .eq("spicerackPlayerId", spicerackPlayerId),
    )
    .unique();
}

export async function syncPlayerRegistrationStatuses(
  ctx: MutationCtx,
  args: {
    spicerackTournamentId: number;
    players: { spicerackPlayerId: number; registrationStatus: string }[];
  },
): Promise<void> {
  for (const player of args.players) {
    const existing = await getPlayerStatusBySpicerackTournamentAndPlayerId(
      ctx,
      args.spicerackTournamentId,
      player.spicerackPlayerId,
    );
    if (!existing || existing.registrationStatus === player.registrationStatus) {
      continue;
    }
    await ctx.db.patch(existing._id, {
      registrationStatus: player.registrationStatus,
      updatedAt: Date.now(),
    });
  }
}

export async function getSpicerackPlayerIdsFromStatusRows(
  ctx: QueryCtx | MutationCtx,
  spicerackTournamentId: number,
): Promise<number[]> {
  const statusRows = await ctx.db
    .query("playerStatuses")
    .withIndex("by_spicerack_tournament_id", (q) =>
      q.eq("spicerackTournamentId", spicerackTournamentId),
    )
    .collect();
  return statusRows.map((player) => player.spicerackPlayerId);
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

export async function getMissingDecklistRowsForTournament(
  ctx: QueryCtx | MutationCtx,
  spicerackTournamentId: number,
): Promise<
  {
    playerId: Id<"players">;
    spicerackPlayerId: number;
    deckId: number;
    decklistStatus?: "pending" | "ready" | "missing" | "fetch_failed" | "manual";
  }[]
> {
  const missingDecklists = [];
  for (const status of ["missing", "fetch_failed"] as const) {
    const decklists = await ctx.db
      .query("playerDecklists")
      .withIndex("by_spicerack_tournament_id_and_decklist_status", (q) =>
        q
          .eq("spicerackTournamentId", spicerackTournamentId)
          .eq("decklistStatus", status),
      )
      .collect();
    for (const decklist of decklists) {
      if (!isMissingDecklistData(decklist)) {
        continue;
      }
      missingDecklists.push({
        playerId: decklist.playerId,
        spicerackPlayerId: decklist.spicerackPlayerId,
        deckId: decklist.deckId,
        decklistStatus: decklist.decklistStatus,
      });
    }
  }
  return missingDecklists;
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
      spicerackTournamentId: player.spicerackTournamentId,
      spicerackPlayerId: player.spicerackPlayerId,
      registrationStatus: player.registrationStatus,
      updatedAt: now,
    }),
    ctx.db.insert("playerDecklists", {
      playerId,
      spicerackTournamentId: player.spicerackTournamentId,
      spicerackPlayerId: player.spicerackPlayerId,
      deckId: player.deckId,
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
    spicerackTournamentId: player.spicerackTournamentId,
    spicerackPlayerId: player.spicerackPlayerId,
    deckId: player.deckId,
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
    "spicerackTournamentId" | "spicerackPlayerId" | "registrationStatus"
  > & { playerId: Id<"players"> },
): Promise<void> {
  const existing = await getPlayerStatusByPlayerId(ctx, player.playerId);
  const patch = {
    spicerackTournamentId: player.spicerackTournamentId,
    spicerackPlayerId: player.spicerackPlayerId,
    registrationStatus: player.registrationStatus,
    updatedAt: Date.now(),
  };
  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return;
  }
  await ctx.db.insert("playerStatuses", { playerId: player.playerId, ...patch });
}
