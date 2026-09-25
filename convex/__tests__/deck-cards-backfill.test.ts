/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { defineSchema } from "convex/server";
import { afterEach, expect, it, vi } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import {
  BACKFILL_LEGACY_PLAYER_PAGE_SIZE,
  BACKFILL_TOURNAMENT_PAGE_SIZE,
  BACKFILL_TOURNAMENT_STAGGER_MS,
} from "../deckCards";
import {
  CARD_IMAGE_POLICY,
  getCardCacheKey,
  normalizeCardName,
} from "../lib/deckCards";

const modules = import.meta.glob("../**/*.{js,ts}");
const testSchema = defineSchema(schema.tables, { schemaValidation: false });

function setup() {
  return convexTest(testSchema, modules);
}

async function insertExternalTournaments(
  t: ReturnType<typeof setup>,
  externalTournamentIds: number[],
) {
  await t.run(async (ctx) => {
    for (const externalTournamentId of externalTournamentIds) {
      await ctx.db.insert("externalTournaments", {
        externalTournamentId,
        updatedAt: 1,
      });
    }
  });
}

async function insertPlayer(
  t: ReturnType<typeof setup>,
  args: {
    externalTournamentId: number;
    externalPlayerId: number;
    deckList: string;
    deckCardsStatus?: "pending" | "ready" | "partial" | "failed";
  },
) {
  return await t.run(async (ctx) => {
    const playerId = await ctx.db.insert("players", {
      name: `Player ${args.externalPlayerId}`,
      externalTournamentId: args.externalTournamentId,
      externalPlayerId: args.externalPlayerId,
      deckCardsStatus: args.deckCardsStatus,
      updatedAt: 1,
    });
    await ctx.db.insert("playerDecklists", {
      playerId,
      externalTournamentId: args.externalTournamentId,
      externalPlayerId: args.externalPlayerId,
      decklistStatus: "ready",
      deckName: "Mono Red",
      deckList: args.deckList,
      updatedAt: 1,
    });
    return playerId;
  });
}

/**
 * A player row from before externalTournamentId (and the split
 * playerDecklists table) existed: no tournament id, decklist on the row.
 */
async function insertLegacyPlayer(
  t: ReturnType<typeof setup>,
  args: {
    externalPlayerId: number;
    deckList: string;
    deckCardsStatus?: "pending" | "ready" | "partial" | "failed";
  },
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("players", {
      name: `Legacy ${args.externalPlayerId}`,
      externalPlayerId: args.externalPlayerId,
      deckName: "Mono Red",
      deckList: args.deckList,
      deckCardsStatus: args.deckCardsStatus,
      updatedAt: 1,
    }),
  );
}

async function seedResolvedCard(t: ReturnType<typeof setup>, name: string) {
  await t.run(async (ctx) => {
    await ctx.db.insert("scryfallCardCache", {
      cacheKey: getCardCacheKey(name),
      normalizedName: normalizeCardName(name),
      name,
      policy: CARD_IMAGE_POLICY,
      status: "resolved",
      imageUrl: "https://cards.example.test/bolt.jpg",
      typeLine: "Instant",
      updatedAt: 1,
    });
  });
}

async function scheduledJobs(
  t: ReturnType<typeof setup>,
  functionName: string,
) {
  const jobs = await t.run((ctx) =>
    ctx.db.system.query("_scheduled_functions").collect(),
  );
  return jobs
    .filter((job) => job.name.includes(functionName))
    .map((job) => ({
      scheduledTime: job.scheduledTime,
      args: job.args[0] as Record<string, unknown>,
    }))
    .sort((a, b) => a.scheduledTime - b.scheduledTime);
}

async function scheduledBackfills(t: ReturnType<typeof setup>) {
  return (await scheduledJobs(t, "backfillDeckCards")).map((job) => ({
    scheduledTime: job.scheduledTime,
    externalTournamentId: job.args.externalTournamentId as number,
  }));
}

afterEach(() => {
  vi.useRealTimers();
});

it("schedules one staggered per-tournament backfill for every cached tournament", async () => {
  // runAfter stamps each job with Date.now() + delay at call time, so freeze
  // the clock (Date only, leaving convex-test's real setTimeout scheduler
  // alone) to make the stagger offsets exact instead of wall-clock dependent.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  const t = setup();
  await insertExternalTournaments(t, [101, 102, 103]);

  const scheduled = await t.action(internal.deckCards.backfillAllDeckCards, {});
  expect(scheduled).toBe(3);

  const jobs = await scheduledBackfills(t);
  expect(jobs.map((job) => job.externalTournamentId)).toEqual([101, 102, 103]);
  expect(jobs[1].scheduledTime - jobs[0].scheduledTime).toBe(
    BACKFILL_TOURNAMENT_STAGGER_MS,
  );
  expect(jobs[2].scheduledTime - jobs[0].scheduledTime).toBe(
    2 * BACKFILL_TOURNAMENT_STAGGER_MS,
  );
  // One page covers everything, so no continuation is queued.
  expect(await scheduledJobs(t, "backfillAllDeckCards")).toEqual([]);
});

it("handles one page per invocation and schedules itself for the next page", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  const t = setup();
  const count = BACKFILL_TOURNAMENT_PAGE_SIZE + 3;
  await insertExternalTournaments(
    t,
    Array.from({ length: count }, (_, index) => 1000 + index),
  );

  const firstPage = await t.action(internal.deckCards.backfillAllDeckCards, {});
  expect(firstPage).toBe(BACKFILL_TOURNAMENT_PAGE_SIZE);
  expect((await scheduledBackfills(t)).length).toBe(
    BACKFILL_TOURNAMENT_PAGE_SIZE,
  );

  // The action stops after one page and leaves a continuation carrying the
  // cursor and the running count, instead of looping in one invocation.
  const continuations = await scheduledJobs(t, "backfillAllDeckCards");
  expect(continuations.length).toBe(1);
  expect(continuations[0].args).toEqual({
    cursor: expect.any(String),
    scheduledSoFar: BACKFILL_TOURNAMENT_PAGE_SIZE,
  });

  const secondPage = await t.action(
    internal.deckCards.backfillAllDeckCards,
    continuations[0].args as { cursor: string; scheduledSoFar: number },
  );
  expect(secondPage).toBe(3);

  const jobs = await scheduledBackfills(t);
  expect(jobs.length).toBe(count);
  expect(new Set(jobs.map((job) => job.externalTournamentId)).size).toBe(count);
  // The stagger keeps growing across pages rather than restarting at zero.
  expect(jobs[count - 1].scheduledTime - jobs[0].scheduledTime).toBe(
    (count - 1) * BACKFILL_TOURNAMENT_STAGGER_MS,
  );
  // The final page queues no further continuation, and the legacy sweep is
  // only kicked off by the first invocation.
  expect((await scheduledJobs(t, "backfillAllDeckCards")).length).toBe(1);
  expect((await scheduledJobs(t, "backfillLegacyDeckCards")).length).toBe(1);
});

it("schedules nothing per tournament when no tournament is cached", async () => {
  const t = setup();
  expect(await t.action(internal.deckCards.backfillAllDeckCards, {})).toBe(0);
  expect(await scheduledBackfills(t)).toEqual([]);
  expect(await scheduledJobs(t, "backfillAllDeckCards")).toEqual([]);
  // Legacy rows are swept regardless of whether any tournament is cached.
  expect((await scheduledJobs(t, "backfillLegacyDeckCards")).length).toBe(1);
});

it("lists only the requested tournament's players that still need deck cards", async () => {
  const t = setup();
  const wanted = await insertPlayer(t, {
    externalTournamentId: 7,
    externalPlayerId: 1,
    deckList: "4 Lightning Bolt",
  });
  const alsoWanted = await insertPlayer(t, {
    externalTournamentId: 7,
    externalPlayerId: 2,
    deckList: "4 Opt",
    deckCardsStatus: "partial",
  });
  await insertPlayer(t, {
    externalTournamentId: 7,
    externalPlayerId: 3,
    deckList: "4 Lightning Bolt",
    deckCardsStatus: "ready",
  });
  await insertPlayer(t, {
    externalTournamentId: 7,
    externalPlayerId: 4,
    deckList: "MISSING_DECKLIST",
  });
  await insertPlayer(t, {
    externalTournamentId: 8,
    externalPlayerId: 5,
    deckList: "4 Lightning Bolt",
  });

  const playerIds = await t.query(
    internal.deckCards.getPlayersMissingDeckCards,
    { externalTournamentId: 7 },
  );
  expect([...playerIds].sort()).toEqual([wanted, alsoWanted].sort());
});

it("lists legacy players without externalTournamentId that still need deck cards", async () => {
  const t = setup();
  const legacy = await insertLegacyPlayer(t, {
    externalPlayerId: 1,
    deckList: "4 Lightning Bolt",
  });
  const legacyPartial = await insertLegacyPlayer(t, {
    externalPlayerId: 2,
    deckList: "4 Opt",
    deckCardsStatus: "partial",
  });
  await insertLegacyPlayer(t, {
    externalPlayerId: 3,
    deckList: "4 Lightning Bolt",
    deckCardsStatus: "ready",
  });
  await insertLegacyPlayer(t, {
    externalPlayerId: 4,
    deckList: "MISSING_DECKLIST",
  });
  // A modern row belongs to its tournament's backfill, not the legacy pass.
  await insertPlayer(t, {
    externalTournamentId: 7,
    externalPlayerId: 5,
    deckList: "4 Lightning Bolt",
  });

  const result = await t.query(
    internal.deckCards.listLegacyPlayersMissingDeckCards,
    { paginationOpts: { numItems: 10, cursor: null } },
  );
  expect(result.isDone).toBe(true);
  expect([...result.page].sort()).toEqual([legacy, legacyPartial].sort());
});

it("resolves a legacy player's deck cards through the legacy backfill", async () => {
  const t = setup();
  await seedResolvedCard(t, "Lightning Bolt");
  const legacy = await insertLegacyPlayer(t, {
    externalPlayerId: 1,
    deckList: "4 Lightning Bolt",
  });

  const queued = await t.action(internal.deckCards.backfillLegacyDeckCards, {});
  expect(queued).toBe(1);

  const player = await t.run((ctx) => ctx.db.get(legacy));
  expect(player?.deckCardsStatus).toBe("ready");
  expect(player?.deckCards?.mainboard.map((card) => card.name)).toEqual([
    "Lightning Bolt",
  ]);
  expect(await scheduledJobs(t, "backfillLegacyDeckCards")).toEqual([]);
});

it("pages through legacy players one invocation at a time", async () => {
  const t = setup();
  const count = BACKFILL_LEGACY_PLAYER_PAGE_SIZE + 1;
  for (let index = 0; index < count; index += 1) {
    await insertLegacyPlayer(t, {
      externalPlayerId: index,
      deckList: "MISSING_DECKLIST",
    });
  }

  expect(await t.action(internal.deckCards.backfillLegacyDeckCards, {})).toBe(
    0,
  );
  const continuations = await scheduledJobs(t, "backfillLegacyDeckCards");
  expect(continuations.length).toBe(1);
  expect(continuations[0].args).toEqual({ cursor: expect.any(String) });

  expect(
    await t.action(
      internal.deckCards.backfillLegacyDeckCards,
      continuations[0].args as { cursor: string },
    ),
  ).toBe(0);
  expect((await scheduledJobs(t, "backfillLegacyDeckCards")).length).toBe(1);
});
