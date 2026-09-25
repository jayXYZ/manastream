import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import {
  CARD_IMAGE_POLICY,
  buildResolvedDeckCards,
  buildScryfallRequest,
  createUnresolvedCard,
  getCardCacheKey,
  isCacheableScryfallFailure,
  isResolvableDeckList,
  isRetryableCachedFailure,
  mapScryfallCard,
  normalizeCardName,
  parseDecklist,
  ResolvedCardMetadata,
  ScryfallCardLike,
} from "./lib/deckCards";
import {
  deckCardsStatusValidator,
  resolvedDeckCardsValidator,
  scryfallCardCacheValidator,
} from "./validators";
import { getPlayerData, loadTournamentPlayerData } from "./lib/playerData";

const SCRYFALL_REQUEST_DELAY_MS = 250;
const SCRYFALL_MAX_ATTEMPTS = 3;
// Cap how many players a single resolvePlayersDeckCards invocation processes
// before scheduling itself to continue. Each deck takes up to ~15s of Scryfall
// time on a cold cache, so ~25 fits comfortably inside the 600s action budget.
const RESOLVE_PLAYERS_BATCH_SIZE = 25;
// How many externalTournaments rows backfillAllDeckCards reads per page while
// fanning out one backfillDeckCards per tournament.
export const BACKFILL_TOURNAMENT_PAGE_SIZE = 100;
// Spread the per-tournament backfills out so a whole-database run does not
// start every tournament's Scryfall traffic at the same instant.
export const BACKFILL_TOURNAMENT_STAGGER_MS = 5_000;
// How many legacy player rows (no externalTournamentId) one
// backfillLegacyDeckCards invocation reads before scheduling the next page.
export const BACKFILL_LEGACY_PLAYER_PAGE_SIZE = 100;

export const getCachedCards = internalQuery({
  args: {
    cacheKeys: v.array(v.string()),
  },
  returns: v.array(scryfallCardCacheValidator),
  handler: async (ctx, args) => {
    const cards = await Promise.all(
      args.cacheKeys.map((cacheKey) =>
        ctx.db
          .query("scryfallCardCache")
          .withIndex("by_cache_key", (q) => q.eq("cacheKey", cacheKey))
          .unique(),
      ),
    );

    return cards
      .filter((card) => card !== null)
      .map((card) => ({
        cacheKey: card.cacheKey,
        normalizedName: card.normalizedName,
        name: card.name,
        policy: card.policy,
        status: card.status,
        imageUrl: card.imageUrl,
        typeLine: card.typeLine,
        legality: card.legality,
        scryfallId: card.scryfallId,
        lastError: card.lastError,
        updatedAt: card.updatedAt,
      }));
  },
});

export const upsertCachedCards = internalMutation({
  args: {
    cards: v.array(scryfallCardCacheValidator),
  },
  handler: async (ctx, args) => {
    for (const card of args.cards) {
      const existing = await ctx.db
        .query("scryfallCardCache")
        .withIndex("by_cache_key", (q) => q.eq("cacheKey", card.cacheKey))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, card);
      } else {
        await ctx.db.insert("scryfallCardCache", card);
      }
    }
  },
});

export const getPlayerDecklistForResolution = internalQuery({
  args: {
    playerId: v.id("players"),
  },
  returns: v.union(
    v.null(),
    v.object({
      playerId: v.id("players"),
      deckList: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) {
      return null;
    }
    const playerData = await getPlayerData(ctx, player);

    return {
      playerId: player._id,
      deckList: playerData.deckList,
    };
  },
});

export const getPlayersMissingDeckCards = internalQuery({
  args: {
    externalTournamentId: v.number(),
  },
  returns: v.array(v.id("players")),
  handler: async (ctx, args) => {
    const { players } = await loadTournamentPlayerData(
      ctx,
      args.externalTournamentId,
    );

    return players
      .filter(
        (player) =>
          player.deckCardsStatus !== "ready" &&
          isResolvableDeckList(player.deckList),
      )
      .map((player) => player._id);
  },
});

/**
 * One page of cached Melee tournament ids, for the whole-database backfill
 * to fan out over without ever reading the players table unbounded.
 */
export const listExternalTournamentIds = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(v.number()),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("externalTournaments")
      .withIndex("by_external_tournament_id")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map((tournament) => tournament.externalTournamentId),
    };
  },
});

/**
 * One page of players that predate externalTournamentId being stored and
 * still need deck cards. The by_external_tournament_id index sorts rows
 * missing the field first, so eq(undefined) reads only legacy rows rather
 * than the whole players table. Their decklists live on the player row
 * itself, which getPlayerData falls back to.
 */
export const listLegacyPlayersMissingDeckCards = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(v.id("players")),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("players")
      .withIndex("by_external_tournament_id", (q) =>
        q.eq("externalTournamentId", undefined),
      )
      .paginate(args.paginationOpts);
    const playerIds: Id<"players">[] = [];
    for (const player of result.page) {
      if (player.deckCardsStatus === "ready") {
        continue;
      }
      const playerData = await getPlayerData(ctx, player);
      if (isResolvableDeckList(playerData.deckList)) {
        playerIds.push(player._id);
      }
    }
    return { ...result, page: playerIds };
  },
});

export const patchPlayerDeckCards = internalMutation({
  args: {
    playerId: v.id("players"),
    deckCardsStatus: deckCardsStatusValidator,
    deckCards: v.optional(resolvedDeckCardsValidator),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.playerId, {
      deckCardsStatus: args.deckCardsStatus,
      ...(args.deckCards ? { deckCards: args.deckCards } : {}),
      updatedAt: Date.now(),
    });
  },
});

export const markPlayerDeckCardsPending = internalMutation({
  args: {
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.playerId, {
      deckCardsStatus: "pending",
      deckCards: undefined,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.deckCards.resolvePlayerDeckCards, {
      playerId: args.playerId,
    });
  },
});

export const resolvePlayerDeckCards = internalAction({
  args: {
    playerId: v.id("players"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await resolvePlayerDeckCardsForPlayer(ctx, args.playerId);
    return null;
  },
});

/**
 * Resolves one player's decklist against the Scryfall cache and API and
 * patches the player's deckCards / deckCardsStatus. Shared by the
 * single-player action and the batched resolver so the batch loops over
 * players in-process instead of paying for a scheduled action per player.
 */
async function resolvePlayerDeckCardsForPlayer(
  ctx: ActionCtx,
  playerId: Id<"players">,
): Promise<void> {
  const player = await ctx.runQuery(
    internal.deckCards.getPlayerDecklistForResolution,
    { playerId },
  );
  if (!player) {
    return;
  }

  const parsedDecklist = parseDecklist(player.deckList);
  const cardNames = getUniqueCardNames(parsedDecklist);
  if (cardNames.length === 0) {
    await ctx.runMutation(internal.deckCards.patchPlayerDeckCards, {
      playerId,
      deckCardsStatus: "ready",
      deckCards: buildResolvedDeckCards(parsedDecklist, new Map()),
    });
    return;
  }

  const cachedCards = await ctx.runQuery(internal.deckCards.getCachedCards, {
    cacheKeys: cardNames.map(getCardCacheKey),
  });
  const cachedByKey = new Map(cachedCards.map((card) => [card.cacheKey, card]));
  const cachedByName = new Map<string, ResolvedCardMetadata>();
  for (const name of cardNames) {
    const cachedCard = cachedByKey.get(getCardCacheKey(name));
    if (!cachedCard) {
      continue;
    }
    if (
      cachedCard.status === "unresolved" &&
      isRetryableCachedFailure(cachedCard.lastError)
    ) {
      continue;
    }
    cachedByName.set(
      name,
      cacheEntryToMetadata(name, {
        imageUrl: cachedCard.imageUrl,
        typeLine: cachedCard.typeLine,
        legality: cachedCard.legality,
        scryfallId: cachedCard.scryfallId,
        status: cachedCard.status,
      }),
    );
  }

  const missingNames = cardNames.filter((name) => !cachedByName.has(name));
  const fetchedCacheEntries = [];
  const transientFailureNames = [];
  for (const [index, name] of missingNames.entries()) {
    if (index > 0) {
      await sleep(SCRYFALL_REQUEST_DELAY_MS);
    }
    const fetched = await fetchScryfallCard(name);
    cachedByName.set(name, fetched.metadata);
    if (fetched.cacheable) {
      fetchedCacheEntries.push(
        metadataToCacheEntry(name, fetched.metadata, fetched.lastError),
      );
    } else {
      transientFailureNames.push(name);
    }
  }

  if (fetchedCacheEntries.length > 0) {
    await ctx.runMutation(internal.deckCards.upsertCachedCards, {
      cards: fetchedCacheEntries,
    });
  }

  const deckCards = buildResolvedDeckCards(parsedDecklist, cachedByName);
  await ctx.runMutation(internal.deckCards.patchPlayerDeckCards, {
    playerId,
    deckCardsStatus: getDeckCardsStatus(
      deckCards.unresolvedNames.length,
      cardNames.length,
      transientFailureNames.length,
    ),
    deckCards,
  });
}

export const resolvePlayersDeckCards = internalAction({
  args: {
    playerIds: v.array(v.id("players")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await resolvePlayersDeckCardsBatch(ctx, args.playerIds);
    return null;
  },
});

/**
 * Resolves the first RESOLVE_PLAYERS_BATCH_SIZE players in-process and
 * schedules the remainder as a fresh resolvePlayersDeckCards invocation.
 */
async function resolvePlayersDeckCardsBatch(
  ctx: ActionCtx,
  playerIds: Id<"players">[],
): Promise<void> {
  const chunk = playerIds.slice(0, RESOLVE_PLAYERS_BATCH_SIZE);
  const remaining = playerIds.slice(RESOLVE_PLAYERS_BATCH_SIZE);

  // If a single player resolution throws we don't want the rest of the
  // batch (or the queued continuations) to be lost, so catch and log
  // per-player errors. The player will be picked up again the next time
  // backfillDeckCards or updatePlayerDecklists runs.
  for (const playerId of chunk) {
    try {
      await resolvePlayerDeckCardsForPlayer(ctx, playerId);
    } catch (error) {
      console.error(
        `Failed to resolve deck cards for player ${playerId}:`,
        error,
      );
    }
  }

  // Schedule the remainder as a separate scheduled function so each chunk
  // gets a fresh action time budget. Without this, large tournaments
  // (~300 players) blow past the 600s action timeout and leave the
  // unprocessed players stuck in deckCardsStatus: "pending".
  if (remaining.length > 0) {
    await ctx.scheduler.runAfter(
      0,
      internal.deckCards.resolvePlayersDeckCards,
      { playerIds: remaining },
    );
  }
}

/**
 * Resolves deck cards for every player of one Melee tournament whose cards
 * are not yet ready. Reads are bounded by the tournament's player count.
 */
export const backfillDeckCards = internalAction({
  args: {
    externalTournamentId: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const playerIds = await ctx.runQuery(
      internal.deckCards.getPlayersMissingDeckCards,
      { externalTournamentId: args.externalTournamentId },
    );

    for (const playerId of playerIds) {
      await ctx.runMutation(internal.deckCards.patchPlayerDeckCards, {
        playerId,
        deckCardsStatus: "pending",
      });
    }
    await resolvePlayersDeckCardsBatch(ctx, playerIds);
    return null;
  },
});

/**
 * Resolves deck cards for players that predate externalTournamentId being
 * stored, which the per-tournament fan-out cannot reach. Processes one page
 * of legacy rows per invocation and schedules itself for the next page, so a
 * single action never reads the whole table or outlives its time budget.
 * Returns the number of players this invocation queued for resolution.
 */
export const backfillLegacyDeckCards = internalAction({
  args: {
    // Set by the action itself when it schedules the next page.
    cursor: v.optional(v.string()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const result: {
      page: Id<"players">[];
      isDone: boolean;
      continueCursor: string;
    } = await ctx.runQuery(
      internal.deckCards.listLegacyPlayersMissingDeckCards,
      {
        paginationOpts: {
          numItems: BACKFILL_LEGACY_PLAYER_PAGE_SIZE,
          cursor: args.cursor ?? null,
        },
      },
    );
    for (const playerId of result.page) {
      await ctx.runMutation(internal.deckCards.patchPlayerDeckCards, {
        playerId,
        deckCardsStatus: "pending",
      });
    }
    if (!result.isDone) {
      await ctx.scheduler.runAfter(
        BACKFILL_TOURNAMENT_STAGGER_MS,
        internal.deckCards.backfillLegacyDeckCards,
        { cursor: result.continueCursor },
      );
    }
    await resolvePlayersDeckCardsBatch(ctx, result.page);
    return result.page.length;
  },
});

/**
 * Whole-database backfill: pages through externalTournaments and schedules
 * one backfillDeckCards per tournament, so no single function ever reads the
 * entire players table. Each invocation handles one page and schedules
 * itself with the next cursor, so a large tournament table cannot run one
 * action past its time limit. The first invocation also kicks off
 * backfillLegacyDeckCards for players that predate externalTournamentId.
 * Returns the number of tournaments this invocation scheduled.
 */
export const backfillAllDeckCards = internalAction({
  args: {
    // Both are set by the action itself when it schedules the next page:
    // where to resume, and how many tournaments earlier pages already
    // scheduled so the stagger keeps growing across pages.
    cursor: v.optional(v.string()),
    scheduledSoFar: v.optional(v.number()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const scheduledSoFar = args.scheduledSoFar ?? 0;
    if (args.cursor === undefined) {
      await ctx.scheduler.runAfter(
        0,
        internal.deckCards.backfillLegacyDeckCards,
        {},
      );
    }
    const result: {
      page: number[];
      isDone: boolean;
      continueCursor: string;
    } = await ctx.runQuery(internal.deckCards.listExternalTournamentIds, {
      paginationOpts: {
        numItems: BACKFILL_TOURNAMENT_PAGE_SIZE,
        cursor: args.cursor ?? null,
      },
    });
    let scheduled = 0;
    for (const externalTournamentId of result.page) {
      await ctx.scheduler.runAfter(
        (scheduledSoFar + scheduled) * BACKFILL_TOURNAMENT_STAGGER_MS,
        internal.deckCards.backfillDeckCards,
        { externalTournamentId },
      );
      scheduled += 1;
    }
    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.deckCards.backfillAllDeckCards, {
        cursor: result.continueCursor,
        scheduledSoFar: scheduledSoFar + scheduled,
      });
    }
    return scheduled;
  },
});

async function fetchScryfallCard(name: string): Promise<{
  metadata: ResolvedCardMetadata;
  cacheable: boolean;
  lastError?: string;
}> {
  const request = buildScryfallRequest(name);
  let lastError = "Transient Scryfall failure";

  for (let attempt = 1; attempt <= SCRYFALL_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(request.url, {
        headers: request.headers,
        method: "GET",
      });

      if (!response.ok) {
        const details = await readScryfallErrorDetails(response);
        lastError = `Scryfall ${response.status}: ${details}`;
        if (isCacheableScryfallFailure(response.status)) {
          return {
            metadata: createUnresolvedCard(name),
            cacheable: true,
            lastError,
          };
        }
        await waitBeforeRetry(response, attempt);
        continue;
      }

      const json = await response.json();
      const card: ScryfallCardLike | undefined =
        json.object === "list" ? json.data?.[0] : json;
      const metadata = mapScryfallCard(name, card);

      return {
        metadata,
        cacheable: true,
        lastError: metadata.unresolved
          ? "Scryfall returned no usable card image"
          : undefined,
      };
    } catch (error) {
      lastError = `Transient Scryfall failure: ${String(error)}`;
      await sleep(SCRYFALL_REQUEST_DELAY_MS * attempt);
    }
  }

  return {
    metadata: createUnresolvedCard(name),
    cacheable: false,
    lastError,
  };
}

function metadataToCacheEntry(
  name: string,
  metadata: ResolvedCardMetadata,
  lastError?: string,
) {
  return {
    cacheKey: getCardCacheKey(name),
    normalizedName: normalizeCardName(name),
    name,
    policy: CARD_IMAGE_POLICY,
    status: metadata.unresolved
      ? ("unresolved" as const)
      : ("resolved" as const),
    imageUrl: metadata.imageUrl,
    typeLine: metadata.typeLine,
    legality: metadata.legality,
    scryfallId: metadata.scryfallId,
    lastError: metadata.unresolved ? lastError : undefined,
    updatedAt: Date.now(),
  };
}

function cacheEntryToMetadata(
  name: string,
  card: {
    imageUrl?: string;
    typeLine: string;
    legality?: string;
    scryfallId?: string;
    status: "resolved" | "unresolved";
  },
): ResolvedCardMetadata {
  if (card.status === "unresolved") {
    return createUnresolvedCard(name);
  }
  return {
    name,
    imageUrl: card.imageUrl,
    typeLine: card.typeLine,
    legality: card.legality,
    scryfallId: card.scryfallId,
  };
}

function getDeckCardsStatus(
  unresolvedCount: number,
  totalCount: number,
  transientFailureCount: number,
) {
  if (transientFailureCount > 0 && unresolvedCount === totalCount) {
    return "pending" as const;
  }
  if (unresolvedCount === 0) {
    return "ready" as const;
  }
  if (unresolvedCount === totalCount) {
    return "failed" as const;
  }
  return "partial" as const;
}

function getUniqueCardNames(decklist: {
  mainboard: { name: string }[];
  sideboard: { name: string }[];
}): string[] {
  return Array.from(
    new Set([
      ...decklist.mainboard.map((card) => card.name),
      ...decklist.sideboard.map((card) => card.name),
    ]),
  ).sort((a, b) => a.localeCompare(b));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readScryfallErrorDetails(response: Response) {
  try {
    const json = await response.clone().json();
    return json.details ?? json.code ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

async function waitBeforeRetry(response: Response, attempt: number) {
  const retryAfter = response.headers.get("Retry-After");
  const retryAfterSeconds = retryAfter ? Number.parseInt(retryAfter, 10) : NaN;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    await sleep(retryAfterSeconds * 1000);
    return;
  }

  await sleep(SCRYFALL_REQUEST_DELAY_MS * attempt);
}
