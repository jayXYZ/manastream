/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { defineSchema } from "convex/server";
import { expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.{js,ts}");
// See featurematch-removal.test.ts: document validators carry system fields,
// so insert validation is disabled while argument/return validation stays on.
const testSchema = defineSchema(schema.tables, { schemaValidation: false });

async function setup(options?: {
  externalTournamentId?: number;
  withCredentials?: boolean;
}) {
  const t = convexTest(testSchema, modules);
  const ids = await t.run(async (ctx) => {
    const user = await ctx.db.insert("users", {});
    const tournament = await ctx.db.insert("tournaments", {
      userId: user,
      mode: "manual",
      externalTournamentId: options?.externalTournamentId,
      manualTimerRunning: false,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("settings", {
      userId: user,
      ...(options?.withCredentials === false
        ? {}
        : { meleeClientId: "id", meleeClientSecret: "secret" }),
      createdAt: 1,
      updatedAt: 1,
    });
    return { user, tournament };
  });
  const owner = t.withIdentity({ subject: ids.user });
  return { t, owner, ids };
}

it("refuses without a Melee tournament id or credentials", async () => {
  const noTournament = await setup();
  expect(
    await noTournament.owner.mutation(api.tournamentSync.requestPlayerRefresh, {}),
  ).toBe("no_tournament");

  const noCredentials = await setup({
    externalTournamentId: 999,
    withCredentials: false,
  });
  expect(
    await noCredentials.owner.mutation(api.tournamentSync.requestPlayerRefresh, {}),
  ).toBe("no_credentials");
});

it("marks the refresh running, logs it, and refuses a second one until it finishes", async () => {
  const { t, owner, ids } = await setup({ externalTournamentId: 999 });
  expect(
    await owner.mutation(api.tournamentSync.requestPlayerRefresh, {}),
  ).toBe("scheduled");

  const running = await t.run((ctx) => ctx.db.get(ids.tournament));
  expect(running?.playerRefresh?.status).toBe("running");
  const startedAt = running!.playerRefresh!.startedAt;

  expect(
    await owner.mutation(api.tournamentSync.requestPlayerRefresh, {}),
  ).toBe("in_progress");

  // A stale finish (wrong run) is ignored; the current run's finish lands.
  expect(
    await t.mutation(internal.tournamentSync.finishPlayerRefresh, {
      userId: ids.user,
      tournamentId: ids.tournament,
      startedAt: startedAt - 1,
      status: "success",
      message: "stale",
    }),
  ).toBe(false);
  expect(
    await t.mutation(internal.tournamentSync.finishPlayerRefresh, {
      userId: ids.user,
      tournamentId: ids.tournament,
      startedAt,
      status: "success",
      message: "Refreshed 2 players from Melee: 0 added, 1 decklist updated.",
    }),
  ).toBe(true);

  const finished = await t.run((ctx) => ctx.db.get(ids.tournament));
  expect(finished?.playerRefresh).toMatchObject({
    status: "success",
    startedAt,
    message: "Refreshed 2 players from Melee: 0 added, 1 decklist updated.",
  });
  expect(finished?.playerRefresh?.finishedAt).toBeTypeOf("number");

  // The watchdog for the finished run does nothing.
  expect(
    await t.mutation(internal.tournamentSync.expirePlayerRefresh, {
      userId: ids.user,
      tournamentId: ids.tournament,
      startedAt,
    }),
  ).toBe(false);

  const logs = await t.run((ctx) =>
    ctx.db
      .query("integrationLogs")
      .withIndex("by_user", (q) => q.eq("userId", ids.user))
      .collect(),
  );
  expect(logs.map((log) => [log.action, log.status])).toEqual([
    ["PLAYER_REFRESH_REQUESTED", "info"],
    ["PLAYER_REFRESH_SUCCESS", "success"],
  ]);

  // Finished, so a new refresh may start.
  expect(
    await owner.mutation(api.tournamentSync.requestPlayerRefresh, {}),
  ).toBe("scheduled");
});

it("the watchdog fails a run that never finished", async () => {
  const { t, owner, ids } = await setup({ externalTournamentId: 999 });
  await owner.mutation(api.tournamentSync.requestPlayerRefresh, {});
  const running = await t.run((ctx) => ctx.db.get(ids.tournament));
  const startedAt = running!.playerRefresh!.startedAt;

  expect(
    await t.mutation(internal.tournamentSync.expirePlayerRefresh, {
      userId: ids.user,
      tournamentId: ids.tournament,
      startedAt,
    }),
  ).toBe(true);
  const expired = await t.run((ctx) => ctx.db.get(ids.tournament));
  expect(expired?.playerRefresh?.status).toBe("error");
  expect(
    await owner.mutation(api.tournamentSync.requestPlayerRefresh, {}),
  ).toBe("scheduled");
});

it("createPlayers skips players that already exist for the tournament", async () => {
  const { t } = await setup({ externalTournamentId: 999 });
  const player = {
    externalTournamentId: 999,
    name: "Ada",
    externalPlayerId: 1,
    decklistStatus: "missing" as const,
    deckName: "MISSING_DECKLIST",
    deckList: "MISSING_DECKLIST",
  };
  const first = await t.mutation(internal.player.createPlayers, {
    players: [player],
  });
  expect(first).toHaveLength(1);
  const second = await t.mutation(internal.player.createPlayers, {
    players: [player, { ...player, externalPlayerId: 2, name: "Ben" }],
  });
  expect(second).toHaveLength(1);
  const players = await t.run((ctx) =>
    ctx.db
      .query("players")
      .withIndex("by_external_tournament_id", (q) =>
        q.eq("externalTournamentId", 999),
      )
      .collect(),
  );
  expect(players.map((p) => p.externalPlayerId).sort()).toEqual([1, 2]);
});
