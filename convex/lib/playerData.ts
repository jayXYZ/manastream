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
    decklistStatus:
      decklist?.decklistStatus ?? player.decklistStatus ?? undefined,
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
    if (!target || target.currentStatus === incomingStatus.registrationStatus) {
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

/**
 * Every player of a Melee tournament with status and decklist joined in,
 * loaded with one index scan per table instead of two lookups per player.
 * Queries that render a whole tournament (standings, pairings) use this so
 * a 300-player event costs three reads rather than ~900.
 */
export type TournamentPlayerData = {
  players: PlayerWithData[];
  byPlayerId: Map<Id<"players">, PlayerWithData>;
  byExternalPlayerId: Map<number, PlayerWithData>;
};

export async function loadTournamentPlayerData(
  ctx: QueryCtx | MutationCtx,
  externalTournamentId: number,
): Promise<TournamentPlayerData> {
  const [players, statuses, decklists] = await Promise.all([
    ctx.db
      .query("players")
      .withIndex("by_external_tournament_id", (q) =>
        q.eq("externalTournamentId", externalTournamentId),
      )
      .collect(),
    ctx.db
      .query("playerStatuses")
      .withIndex("by_external_tournament_id", (q) =>
        q.eq("externalTournamentId", externalTournamentId),
      )
      .collect(),
    ctx.db
      .query("playerDecklists")
      .withIndex("by_external_tournament_id", (q) =>
        q.eq("externalTournamentId", externalTournamentId),
      )
      .collect(),
  ]);
  const statusByPlayerId = new Map(
    statuses.map((status) => [status.playerId, status]),
  );
  const decklistByPlayerId = new Map(
    decklists.map((decklist) => [decklist.playerId, decklist]),
  );
  const composed = players.map((player) =>
    composePlayerData(
      player,
      statusByPlayerId.get(player._id),
      decklistByPlayerId.get(player._id),
    ),
  );
  const byExternalPlayerId = new Map<number, PlayerWithData>();
  for (const player of composed) {
    // Index order is creation order, so the first row wins for a duplicate
    // external id, matching what a `.first()` lookup returned before.
    if (!byExternalPlayerId.has(player.externalPlayerId)) {
      byExternalPlayerId.set(player.externalPlayerId, player);
    }
  }
  return {
    players: composed,
    byPlayerId: new Map(composed.map((player) => [player._id, player])),
    byExternalPlayerId,
  };
}

/**
 * Memoizes loadTournamentPlayerData per Melee tournament id for the life of
 * one query, so enrichment steps that need the same players share one load.
 */
export function createTournamentPlayerDataLoader(ctx: QueryCtx | MutationCtx) {
  const cache = new Map<number, Promise<TournamentPlayerData>>();
  return (externalTournamentId: number): Promise<TournamentPlayerData> => {
    let loading = cache.get(externalTournamentId);
    if (!loading) {
      loading = loadTournamentPlayerData(ctx, externalTournamentId);
      cache.set(externalTournamentId, loading);
    }
    return loading;
  };
}

/**
 * Player data by players-table id, from the preloaded tournament set when
 * the player is in it, otherwise from a direct lookup. The fallback covers
 * rows that predate externalTournamentId being stored on players.
 */
export async function getPlayerDataById(
  ctx: QueryCtx | MutationCtx,
  playerId: Id<"players">,
  preloaded?: TournamentPlayerData,
): Promise<PlayerWithData | undefined> {
  const cached = preloaded?.byPlayerId.get(playerId);
  if (cached) {
    return cached;
  }
  const player = await ctx.db.get(playerId);
  return player ? await getPlayerData(ctx, player) : undefined;
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
  await ctx.db.insert("playerStatuses", {
    playerId: player.playerId,
    ...patch,
  });
}
