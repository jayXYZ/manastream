/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { defineSchema } from "convex/server";
import { expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
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

type TestBackend = Awaited<ReturnType<typeof setup>>["t"];

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

it("getPlayerRefreshRun only hands credentials to the tournament's current run", async () => {
  const { t, owner, ids } = await setup({ externalTournamentId: 999 });
  await owner.mutation(api.tournamentSync.requestPlayerRefresh, {});
  const running = await t.run((ctx) => ctx.db.get(ids.tournament));
  const startedAt = running!.playerRefresh!.startedAt;
  const runArgs = {
    userId: ids.user,
    tournamentId: ids.tournament,
    externalTournamentId: 999,
    startedAt,
  };

  const current = await t.query(internal.tournamentSync.getPlayerRefreshRun, runArgs);
  expect(current?.settings.meleeClientId).toBe("id");

  // Superseded run, or the Melee tournament switched since the request.
  expect(
    await t.query(internal.tournamentSync.getPlayerRefreshRun, {
      ...runArgs,
      startedAt: startedAt - 1,
    }),
  ).toBeNull();
  expect(
    await t.query(internal.tournamentSync.getPlayerRefreshRun, {
      ...runArgs,
      externalTournamentId: 1000,
    }),
  ).toBeNull();

  // Expired by the watchdog.
  await t.mutation(internal.tournamentSync.expirePlayerRefresh, {
    userId: ids.user,
    tournamentId: ids.tournament,
    startedAt,
  });
  expect(
    await t.query(internal.tournamentSync.getPlayerRefreshRun, runArgs),
  ).toBeNull();
});

it("changing the Melee tournament clears a pending player refresh", async () => {
  const { t, owner, ids } = await setup({ externalTournamentId: 999 });
  await owner.mutation(api.tournamentSync.requestPlayerRefresh, {});
  const running = await t.run((ctx) => ctx.db.get(ids.tournament));
  const startedAt = running!.playerRefresh!.startedAt;

  await owner.mutation(api.tournaments.updateTournamentSettings, {
    externalTournamentId: 1000,
  });
  const switched = await t.run((ctx) => ctx.db.get(ids.tournament));
  expect(switched?.externalTournamentId).toBe(1000);
  expect(switched?.playerRefresh).toBeUndefined();

  // The old run finds nothing to bind to and its finish is ignored.
  expect(
    await t.query(internal.tournamentSync.getPlayerRefreshRun, {
      userId: ids.user,
      tournamentId: ids.tournament,
      externalTournamentId: 999,
      startedAt,
    }),
  ).toBeNull();
  expect(
    await t.mutation(internal.tournamentSync.finishPlayerRefresh, {
      userId: ids.user,
      tournamentId: ids.tournament,
      startedAt,
      status: "error",
      message: "stale",
    }),
  ).toBe(false);
  // A refresh for the new tournament can start right away.
  expect(
    await owner.mutation(api.tournamentSync.requestPlayerRefresh, {}),
  ).toBe("scheduled");
});

async function insertReadyPlayer(
  t: TestBackend,
  args: {
    externalPlayerId: number;
    name: string;
    decklistStatus?: "ready" | "manual" | "missing";
    externalDecklistUpdatedAt?: string;
  },
) {
  return await t.run(async (ctx) => {
    const playerId = await ctx.db.insert("players", {
      name: args.name,
      externalTournamentId: 999,
      externalPlayerId: args.externalPlayerId,
      deckCardsStatus: "ready",
      updatedAt: 1,
    });
    await ctx.db.insert("playerDecklists", {
      playerId,
      externalTournamentId: 999,
      externalPlayerId: args.externalPlayerId,
      externalDecklistId: "g1",
      externalDecklistUpdatedAt: args.externalDecklistUpdatedAt,
      decklistStatus: args.decklistStatus ?? "ready",
      deckName: "Mono Red",
      deckList: "4 Lightning Bolt",
      updatedAt: 1,
    });
    return playerId;
  });
}

async function readDecklist(
  t: TestBackend,
  playerId: Id<"players">,
) {
  return await t.run((ctx) =>
    ctx.db
      .query("playerDecklists")
      .withIndex("by_player_id", (q) => q.eq("playerId", playerId))
      .unique(),
  );
}

it("updatePlayerDecklists re-checks each row at commit time and returns what it wrote", async () => {
  const { t } = await setup({ externalTournamentId: 999 });
  // Hand-edited after the sync was planned.
  const manualId = await insertReadyPlayer(t, {
    externalPlayerId: 1,
    name: "Ada",
    decklistStatus: "manual",
  });
  // An overlapping sync already stored a newer version.
  const newerId = await insertReadyPlayer(t, {
    externalPlayerId: 2,
    name: "Ben",
    externalDecklistUpdatedAt: "2026-06-01T09:00:00Z",
  });
  // A usable decklist a slower fetch failed to re-download.
  const readyId = await insertReadyPlayer(t, { externalPlayerId: 3, name: "Cy" });
  const missingId = await insertReadyPlayer(t, {
    externalPlayerId: 4,
    name: "Di",
    decklistStatus: "missing",
  });

  const applied = await t.mutation(internal.player.updatePlayerDecklists, {
    players: [
      {
        playerId: manualId,
        deckName: "Burn",
        deckList: "4 Fireblast",
        externalDecklistId: "g1",
        decklistStatus: "ready",
      },
      {
        playerId: newerId,
        deckName: "Burn",
        deckList: "4 Fireblast",
        externalDecklistId: "g1",
        externalDecklistUpdatedAt: "2026-05-31T19:44:27Z",
        decklistStatus: "ready",
      },
      {
        playerId: readyId,
        deckName: "Unknown",
        deckList: "Unknown",
        externalDecklistId: "g1",
        decklistStatus: "fetch_failed",
      },
      {
        playerId: missingId,
        deckName: "Burn",
        deckList: "4 Fireblast",
        externalDecklistId: "g1",
        externalDecklistUpdatedAt: "2026-06-01T09:00:00Z",
        decklistStatus: "ready",
      },
    ],
  });
  expect(applied.map((update) => update.playerId)).toEqual([missingId]);

  expect((await readDecklist(t, manualId))?.decklistStatus).toBe("manual");
  expect((await readDecklist(t, manualId))?.deckList).toBe("4 Lightning Bolt");
  expect((await readDecklist(t, newerId))?.externalDecklistUpdatedAt).toBe(
    "2026-06-01T09:00:00Z",
  );
  expect((await readDecklist(t, readyId))?.decklistStatus).toBe("ready");
  expect(await readDecklist(t, missingId)).toMatchObject({
    decklistStatus: "ready",
    deckList: "4 Fireblast",
    externalDecklistUpdatedAt: "2026-06-01T09:00:00Z",
  });
});

it("updatePlayerDecklists keeps a stored LastUpdated when the response carried none for the same decklist", async () => {
  const { t } = await setup({ externalTournamentId: 999 });
  const playerId = await insertReadyPlayer(t, {
    externalPlayerId: 1,
    name: "Ada",
    externalDecklistUpdatedAt: "2026-05-31T19:44:27Z",
  });
  // Same decklist, only the name differs, no timestamp in the payload.
  await t.mutation(internal.player.updatePlayerDecklists, {
    players: [
      {
        playerId,
        deckName: "Red Deck Wins",
        deckList: "4 Lightning Bolt",
        externalDecklistId: "g1",
        decklistStatus: "ready",
      },
    ],
  });
  expect(await readDecklist(t, playerId)).toMatchObject({
    deckName: "Red Deck Wins",
    externalDecklistUpdatedAt: "2026-05-31T19:44:27Z",
  });

  // A different decklist id without a timestamp: the old one is not its.
  await t.mutation(internal.player.updatePlayerDecklists, {
    players: [
      {
        playerId,
        deckName: "Burn",
        deckList: "4 Fireblast",
        externalDecklistId: "g2",
        decklistStatus: "ready",
      },
    ],
  });
  expect((await readDecklist(t, playerId))?.externalDecklistUpdatedAt).toBeUndefined();
});

it("updatePlayerNames leaves hand-edited players alone and counts what it wrote", async () => {
  const { t } = await setup({ externalTournamentId: 999 });
  const manualId = await insertReadyPlayer(t, {
    externalPlayerId: 1,
    name: "Ada (edited)",
    decklistStatus: "manual",
  });
  const readyId = await insertReadyPlayer(t, { externalPlayerId: 2, name: "Ben" });
  const updated = await t.mutation(internal.player.updatePlayerNames, {
    players: [
      { playerId: manualId, name: "Ada" },
      { playerId: readyId, name: "Benjamin" },
    ],
  });
  expect(updated).toBe(1);
  expect((await t.run((ctx) => ctx.db.get(manualId)))?.name).toBe("Ada (edited)");
  expect((await t.run((ctx) => ctx.db.get(readyId)))?.name).toBe("Benjamin");
});

it("updatePlayerDecklists keeps resolved cards unless the list text changed", async () => {
  const { t } = await setup({ externalTournamentId: 999 });
  const playerId = await t.run(async (ctx) => {
    const playerId = await ctx.db.insert("players", {
      name: "Ada",
      externalTournamentId: 999,
      externalPlayerId: 1,
      deckCardsStatus: "ready",
      updatedAt: 1,
    });
    await ctx.db.insert("playerDecklists", {
      playerId,
      externalTournamentId: 999,
      externalPlayerId: 1,
      externalDecklistId: "g1",
      decklistStatus: "ready",
      deckName: "Mono Red",
      deckList: "4 Lightning Bolt",
      updatedAt: 1,
    });
    return playerId;
  });

  // Same text, newly learned timestamp: recorded without invalidating cards.
  await t.mutation(internal.player.updatePlayerDecklists, {
    players: [
      {
        playerId,
        deckName: "Mono Red",
        deckList: "4 Lightning Bolt",
        externalDecklistId: "g1",
        externalDecklistUpdatedAt: "2026-05-31T19:44:27Z",
        decklistStatus: "ready",
      },
    ],
  });
  let player = await t.run((ctx) => ctx.db.get(playerId));
  let decklist = await t.run((ctx) =>
    ctx.db
      .query("playerDecklists")
      .withIndex("by_player_id", (q) => q.eq("playerId", playerId))
      .unique(),
  );
  expect(player?.deckCardsStatus).toBe("ready");
  expect(decklist?.externalDecklistUpdatedAt).toBe("2026-05-31T19:44:27Z");

  // Changed text: cards go back to pending for re-resolution.
  await t.mutation(internal.player.updatePlayerDecklists, {
    players: [
      {
        playerId,
        deckName: "Burn",
        deckList: "4 Fireblast",
        externalDecklistId: "g1",
        externalDecklistUpdatedAt: "2026-06-01T09:00:00Z",
        decklistStatus: "ready",
      },
    ],
  });
  player = await t.run((ctx) => ctx.db.get(playerId));
  decklist = await t.run((ctx) =>
    ctx.db
      .query("playerDecklists")
      .withIndex("by_player_id", (q) => q.eq("playerId", playerId))
      .unique(),
  );
  expect(player?.deckCardsStatus).toBe("pending");
  expect(decklist?.deckList).toBe("4 Fireblast");
  expect(decklist?.externalDecklistUpdatedAt).toBe("2026-06-01T09:00:00Z");
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
