/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { defineSchema } from "convex/server";
import { expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import {
  LIFE_TRACKER_CLEANUP_BATCH_SIZE,
  LIFE_TRACKER_TIMEOUT_MS,
} from "../lib/presence";

const modules = import.meta.glob("../**/*.{js,ts}");
const testSchema = defineSchema(schema.tables, { schemaValidation: false });

async function setup() {
  const t = convexTest(testSchema, modules);
  const ids = await t.run(async (ctx) => {
    const user = await ctx.db.insert("users", {});
    const tournamentId = await ctx.db.insert("tournaments", {
      mode: "manual",
      manualTimerRunning: false,
      createdAt: 1,
      updatedAt: 1,
      userId: user,
    });
    const overlay = await ctx.db.insert("overlays", {
      name: "match",
      overlayType: "match",
      template: "Default",
      tournamentId,
      publicUuid: "match-uuid",
      player1Life: 20,
      player2Life: 20,
      player1GamesWon: 0,
      player2GamesWon: 0,
      createdAt: 1,
    });
    return { user, overlay };
  });
  return { t, ...ids, as: t.withIdentity({ subject: ids.user }) };
}

it("removes trackers older than the timeout without a client disconnect", async () => {
  const { t, user, overlay, as } = await setup();
  const now = Date.now();

  // A live tab that heartbeated recently, and two abandoned tabs.
  await as.mutation(api.presence.setConnectedLifeTracker, {
    overlayId: overlay,
    sessionId: "live",
  });
  await t.run(async (ctx) => {
    for (const sessionId of ["abandoned-1", "abandoned-2"]) {
      await ctx.db.insert("connectedLifeTrackers", {
        userId: user,
        overlayId: overlay,
        sessionId,
        lastSeen: now - LIFE_TRACKER_TIMEOUT_MS - 1000,
        createdAt: now - LIFE_TRACKER_TIMEOUT_MS - 1000,
      });
    }
  });
  expect(
    await as.query(api.presence.getConnectedLifeTrackers, {
      overlayId: overlay,
    }),
  ).toBe(3);

  await t.mutation(internal.presence.cleanUpLifeTrackers, {});

  const remaining = await t.run((ctx) =>
    ctx.db.query("connectedLifeTrackers").collect(),
  );
  expect(remaining.map((row) => row.sessionId)).toEqual(["live"]);
  expect(
    await as.query(api.presence.getConnectedLifeTrackers, {
      overlayId: overlay,
    }),
  ).toBe(1);
});

it("reschedules itself until every stale tracker is gone", async () => {
  vi.useFakeTimers();
  try {
    const { t, user, overlay } = await setup();
    const stale = Date.now() - LIFE_TRACKER_TIMEOUT_MS - 1000;
    const total = LIFE_TRACKER_CLEANUP_BATCH_SIZE * 2 + 5;

    await t.run(async (ctx) => {
      for (let i = 0; i < total; i++) {
        await ctx.db.insert("connectedLifeTrackers", {
          userId: user,
          overlayId: overlay,
          sessionId: `stale-${i}`,
          lastSeen: stale,
          createdAt: stale,
        });
      }
    });

    await t.mutation(internal.presence.cleanUpLifeTrackers, {});
    // The first transaction only deletes one batch and schedules the rest.
    expect(
      await t.run((ctx) => ctx.db.query("connectedLifeTrackers").collect()),
    ).toHaveLength(total - LIFE_TRACKER_CLEANUP_BATCH_SIZE);

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(
      await t.run((ctx) => ctx.db.query("connectedLifeTrackers").collect()),
    ).toHaveLength(0);
  } finally {
    vi.useRealTimers();
  }
});
