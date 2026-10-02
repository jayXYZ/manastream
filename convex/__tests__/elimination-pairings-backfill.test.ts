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

async function setup() {
  const t = convexTest(testSchema, modules);
  const ids = await t.run(async (ctx) => {
    const user = await ctx.db.insert("users", {});
    const tournament = await ctx.db.insert("tournaments", {
      userId: user,
      mode: "manual",
      externalTournamentId: 999,
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
    return { user, tournament, externalTournament, overlay };
  });
  const owner = t.withIdentity({ subject: ids.user });
  return { t, owner, ids };
}

async function scheduledBackfills(t: Awaited<ReturnType<typeof setup>>["t"]) {
  const jobs = await t.run((ctx) =>
    ctx.db.system.query("_scheduled_functions").collect(),
  );
  return jobs
    .filter((job) => job.name.includes("backfillEliminationPairings"))
    .map((job) => ({
      roundIds: (job.args[0] as { roundIds: number[] }).roundIds,
    }));
}

function snapshotForRound(roundId: number, roundNumber: number) {
  return {
    externalTournamentId: 999,
    roundId,
    roundNumber,
    roundDisplayName: "Quarterfinals",
    isEliminationRound: true,
    matches: [
      {
        externalMatchId: `qf-${roundId}`,
        tableNumber: 1,
        isFeatureMatch: false,
        hasResult: true,
        winnerExternalPlayerId: 101,
        competitors: [
          { externalPlayerId: 101, name: "Ada", tournamentRecord: "#1", seed: 1 },
          { externalPlayerId: 108, name: "Hal", tournamentRecord: "#8", seed: 8 },
        ],
      },
    ],
  };
}

it("selecting a bracket view schedules a fetch of the uncaptured elimination rounds", async () => {
  const { t, owner, ids } = await setup();
  await owner.mutation(api.overlays.standings.updateStandingsOverlay, {
    overlayId: ids.overlay,
    showCompletedBracket: true,
  });
  // The quarterfinals and semifinals are missing and the captured final has
  // no result yet; the Swiss round is not part of the bracket.
  expect(await scheduledBackfills(t)).toEqual([{ roundIds: [501, 502, 503] }]);
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

it("captured rounds are stored with results and leave the current round alone", async () => {
  const { t, owner, ids } = await setup();
  await t.mutation(internal.tournamentSync.capturePairingsForRound, {
    tournamentId: ids.tournament,
    snapshot: snapshotForRound(501, 9),
  });
  await t.mutation(internal.tournamentSync.capturePairingsForRound, {
    tournamentId: ids.tournament,
    snapshot: snapshotForRound(502, 10),
  });

  const pairings = await t.run((ctx) => ctx.db.query("pairings").collect());
  const quarterfinal = pairings.find((pairing) => pairing.externalRoundId === 501);
  expect(quarterfinal?.status).toBe("COMPLETE");
  expect(quarterfinal?.winnerPlayerId).toBe(quarterfinal?.player1);
  // The new opponent was created as a pending player entry.
  const hal = await t.run((ctx) => ctx.db.get(quarterfinal!.player2));
  expect(hal?.name).toBe("Hal");

  const externalTournament = await t.run((ctx) =>
    ctx.db.get(ids.externalTournament),
  );
  expect(externalTournament?.currentRoundId).toBe(503);
  expect(externalTournament?.currentRoundName).toBe("Finals");

  // Only the final, which still has no result, is fetched again.
  await owner.mutation(api.overlays.standings.updateStandingsOverlay, {
    overlayId: ids.overlay,
    externalRoundId: 502,
    showCurrentBracket: false,
  });
  expect(await scheduledBackfills(t)).toEqual([{ roundIds: [503] }]);
});

it("a snapshot for a Melee tournament no longer linked is ignored", async () => {
  const { t, ids } = await setup();
  await t.mutation(internal.tournamentSync.capturePairingsForRound, {
    tournamentId: ids.tournament,
    snapshot: { ...snapshotForRound(601, 9), externalTournamentId: 1000 },
  });
  const pairings = await t.run((ctx) => ctx.db.query("pairings").collect());
  expect(pairings.map((pairing) => pairing.externalRoundId)).toEqual([503]);
});
