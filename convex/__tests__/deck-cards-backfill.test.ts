/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { defineSchema } from "convex/server";
import { afterEach, expect, it, vi } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import {
  BACKFILL_TOURNAMENT_PAGE_SIZE,
  BACKFILL_TOURNAMENT_STAGGER_MS,
} from "../deckCards";

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

async function scheduledBackfills(t: ReturnType<typeof setup>) {
  const jobs = await t.run((ctx) =>
    ctx.db.system.query("_scheduled_functions").collect(),
  );
  return jobs
    .filter((job) => job.name.includes("backfillDeckCards"))
    .map((job) => ({
      scheduledTime: job.scheduledTime,
      externalTournamentId: (job.args[0] as { externalTournamentId: number })
        .externalTournamentId,
    }))
    .sort((a, b) => a.scheduledTime - b.scheduledTime);
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
});

it("keeps fanning out past the first page of tournaments", async () => {
  const t = setup();
  const count = BACKFILL_TOURNAMENT_PAGE_SIZE + 3;
  await insertExternalTournaments(
    t,
    Array.from({ length: count }, (_, index) => 1000 + index),
  );

  const scheduled = await t.action(internal.deckCards.backfillAllDeckCards, {});
  expect(scheduled).toBe(count);
  expect((await scheduledBackfills(t)).length).toBe(count);
});

it("schedules nothing when no tournament is cached", async () => {
  const t = setup();
  expect(await t.action(internal.deckCards.backfillAllDeckCards, {})).toBe(0);
  expect(await scheduledBackfills(t)).toEqual([]);
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
