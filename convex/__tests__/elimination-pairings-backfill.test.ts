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

async function setup(options?: { pollingStatus?: "active" | "inactive" }) {
  const t = convexTest(testSchema, modules);
  const ids = await t.run(async (ctx) => {
    const user = await ctx.db.insert("users", {});
    const tournament = await ctx.db.insert("tournaments", {
      userId: user,
      mode: "manual",
      externalTournamentId: 999,
      pollingStatus: options?.pollingStatus,
      manualTimerRunning: false,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("settings", {
      userId: user,
      meleeClientId: "id",
      meleeClientSecret: "secret",
      createdAt: 1,
      updatedAt: 1,
    });
    const externalTournament = await ctx.db.insert("externalTournaments", {
      externalTournamentId: 999,
      currentRoundId: 503,
      currentRoundNumber: 11,
      currentRoundName: "Finals",
      completedRounds: [
        { roundId: 401, roundName: "Round 8" },
        { roundId: 501, roundName: "Quarterfinals" },
        { roundId: 502, roundName: "Semifinals" },
      ],
      updatedAt: 1,
    });
    const ada = await ctx.db.insert("players", {
      name: "Ada",
      externalPlayerId: 101,
      externalTournamentId: 999,
      updatedAt: 1,
    });
    const ben = await ctx.db.insert("players", {
      name: "Ben",
      externalPlayerId: 102,
      externalTournamentId: 999,
      updatedAt: 1,
    });
    // Only the final was captured: the tournament was linked during it.
    await ctx.db.insert("pairings", {
      externalId: "pairing:999:503:final",
      externalTournamentId: 999,
      tournamentId: tournament,
      externalRoundId: 503,
      roundNumber: 11,
      externalMatchId: "final",
      player1: ada,
      player2: ben,
      player1TournamentRecord: "#1",
      player2TournamentRecord: "#2",
      status: "IN_PROGRESS",
      createdAt: 1,
    });
    const overlay = await ctx.db.insert("overlays", {
      name: "Standings",
      overlayType: "standings",
      tournamentId: tournament,
      publicUuid: "standings",
      createdAt: 1,
    });
    return { user, tournament, externalTournament, overlay, ada };
  });
  const owner = t.withIdentity({ subject: ids.user });
  return { t, owner, ids };
}

type Backend = Awaited<ReturnType<typeof setup>>["t"];

async function scheduledBackfills(t: Backend) {
  const jobs = await t.run((ctx) =>
    ctx.db.system.query("_scheduled_functions").collect(),
  );
  return jobs
    .filter((job) => job.name.includes("backfillEliminationPairings"))
    .map((job) => ({
      roundIds: (job.args[0] as { roundIds: number[] }).roundIds,
    }));
}

/** A full round: `count` finished matches, seeds paired top against bottom. */
function snapshotForRound(roundId: number, roundNumber: number, count: number) {
  const seeds = Array.from({ length: count * 2 }, (_, index) => index + 1);
  return {
    externalTournamentId: 999,
    roundId,
    roundNumber,
    roundDisplayName: "Quarterfinals",
    isEliminationRound: true,
    matches: Array.from({ length: count }, (_, index) => {
      const top = seeds[index];
      const bottom = seeds[seeds.length - 1 - index];
      return {
        externalMatchId: `r${roundId}-m${index}`,
        tableNumber: index + 1,
        isFeatureMatch: false,
        hasResult: true,
        winnerExternalPlayerId: 100 + top,
        competitors: [
          {
            externalPlayerId: 100 + top,
            name: `Seed ${top}`,
            tournamentRecord: `#${top}`,
            seed: top,
          },
          {
            externalPlayerId: 100 + bottom,
            name: `Seed ${bottom}`,
            tournamentRecord: `#${bottom}`,
            seed: bottom,
          },
        ],
      };
    }),
  };
}

async function capture(
  t: Backend,
  tournamentId: Id<"tournaments">,
  roundId: number,
  roundNumber: number,
  count: number,
) {
  await t.mutation(internal.tournamentSync.capturePairingsForRound, {
    tournamentId,
    snapshot: snapshotForRound(roundId, roundNumber, count),
  });
}

it("the completed bracket fetches every round that is missing, partial or unresolved", async () => {
  const { t, owner, ids } = await setup();
  await owner.mutation(api.overlays.standings.updateStandingsOverlay, {
    overlayId: ids.overlay,
    showCompletedBracket: true,
  });
  // Quarterfinals and semifinals are missing and the captured final has no
  // result yet; the Swiss round is not part of the bracket.
  expect(await scheduledBackfills(t)).toEqual([{ roundIds: [501, 502, 503] }]);
});

it("a historical bracket view fetches only the rounds through that stage", async () => {
  const { t, owner, ids } = await setup();
  await owner.mutation(api.overlays.standings.updateStandingsOverlay, {
    overlayId: ids.overlay,
    externalRoundId: 502,
    showCurrentBracket: false,
  });
  expect(await scheduledBackfills(t)).toEqual([{ roundIds: [501, 502] }]);
});

it("a Swiss round selection schedules no backfill", async () => {
  const { t, owner, ids } = await setup();
  await owner.mutation(api.overlays.standings.updateStandingsOverlay, {
    overlayId: ids.overlay,
    externalRoundId: 401,
    showCurrentBracket: false,
  });
  expect(await scheduledBackfills(t)).toEqual([]);
});

it("the round being polled is left to the poll", async () => {
  const { t, owner, ids } = await setup({ pollingStatus: "active" });
  await owner.mutation(api.overlays.standings.updateStandingsOverlay, {
    overlayId: ids.overlay,
    showCurrentBracket: true,
  });
  expect(await scheduledBackfills(t)).toEqual([{ roundIds: [501, 502] }]);
});

it("captured rounds are stored with results and leave the current round alone", async () => {
  const { t, owner, ids } = await setup();
  await capture(t, ids.tournament, 501, 9, 4);
  await capture(t, ids.tournament, 502, 10, 2);

  const pairings = await t.run((ctx) => ctx.db.query("pairings").collect());
  const quarterfinals = pairings.filter(
    (pairing) => pairing.externalRoundId === 501,
  );
  expect(quarterfinals).toHaveLength(4);
  expect(quarterfinals.every((pairing) => pairing.status === "COMPLETE")).toBe(
    true,
  );
  expect(quarterfinals[0].winnerPlayerId).toBe(quarterfinals[0].player1);
  // New opponents were created as pending player entries.
  const seed8 = await t.run((ctx) => ctx.db.get(quarterfinals[0].player2));
  expect(seed8?.name).toBe("Seed 8");

  const externalTournament = await t.run((ctx) =>
    ctx.db.get(ids.externalTournament),
  );
  expect(externalTournament?.currentRoundId).toBe(503);
  expect(externalTournament?.currentRoundName).toBe("Finals");

  // With the rounds through the semifinals complete, that view needs nothing.
  await owner.mutation(api.overlays.standings.updateStandingsOverlay, {
    overlayId: ids.overlay,
    externalRoundId: 502,
    showCurrentBracket: false,
  });
  expect(await scheduledBackfills(t)).toEqual([]);
});

it("a round captured only in part is fetched again", async () => {
  const { t, owner, ids } = await setup();
  // One quarterfinal of four, finished.
  await capture(t, ids.tournament, 501, 9, 1);
  await owner.mutation(api.overlays.standings.updateStandingsOverlay, {
    overlayId: ids.overlay,
    externalRoundId: 501,
    showCurrentBracket: false,
  });
  expect(await scheduledBackfills(t)).toEqual([{ roundIds: [501] }]);
});

it("a second account linking the same Melee tournament gets its own pairings", async () => {
  const { t, ids } = await setup();
  const second = await t.run(async (ctx) => {
    const user = await ctx.db.insert("users", {});
    return await ctx.db.insert("tournaments", {
      userId: user,
      mode: "manual",
      externalTournamentId: 999,
      manualTimerRunning: false,
      createdAt: 1,
      updatedAt: 1,
    });
  });
  await capture(t, ids.tournament, 501, 9, 4);
  await capture(t, second, 501, 9, 4);

  const pairings = await t.run((ctx) =>
    ctx.db
      .query("pairings")
      .withIndex("by_external_round", (q) => q.eq("externalRoundId", 501))
      .collect(),
  );
  expect(
    pairings.filter((pairing) => pairing.tournamentId === ids.tournament),
  ).toHaveLength(4);
  expect(
    pairings.filter((pairing) => pairing.tournamentId === second),
  ).toHaveLength(4);
  // A repeat capture for either account changes nothing.
  await capture(t, second, 501, 9, 4);
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("pairings")
        .withIndex("by_external_round", (q) => q.eq("externalRoundId", 501))
        .collect(),
    ),
  ).toHaveLength(8);
});

it("a snapshot for a Melee tournament no longer linked is ignored", async () => {
  const { t, ids } = await setup();
  await t.mutation(internal.tournamentSync.capturePairingsForRound, {
    tournamentId: ids.tournament,
    snapshot: { ...snapshotForRound(601, 9, 1), externalTournamentId: 1000 },
  });
  const pairings = await t.run((ctx) => ctx.db.query("pairings").collect());
  expect(pairings.map((pairing) => pairing.externalRoundId)).toEqual([503]);
});
