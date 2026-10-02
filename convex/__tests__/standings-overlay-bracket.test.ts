/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { defineSchema } from "convex/server";
import { expect, it } from "vitest";
import { api } from "../_generated/api";
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
    await ctx.db.insert("externalTournaments", {
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
    const overlay = await ctx.db.insert("overlays", {
      name: "Standings",
      overlayType: "standings",
      tournamentId: tournament,
      publicUuid: "standings",
      createdAt: 1,
    });
    return { user, tournament, overlay };
  });
  const owner = t.withIdentity({ subject: ids.user });
  return { t, owner, ids };
}

it("an elimination round is stored as a bracket view with no standings fetch", async () => {
  const { t, owner, ids } = await setup();
  await owner.mutation(api.overlays.standings.updateStandingsOverlay, {
    overlayId: ids.overlay,
    externalRoundId: 501,
    showCurrentBracket: false,
  });
  const overlay = await t.run((ctx) => ctx.db.get(ids.overlay));
  expect(overlay?.overlayType === "standings" && overlay.externalRoundId).toBe(
    501,
  );
  expect(
    overlay?.overlayType === "standings" && overlay.roundStandingsId,
  ).toBeUndefined();
  expect(await t.run((ctx) => ctx.db.query("roundStandings").collect())).toEqual(
    [],
  );
});

it("a Swiss round still creates its standings row", async () => {
  const { t, owner, ids } = await setup();
  await owner.mutation(api.overlays.standings.updateStandingsOverlay, {
    overlayId: ids.overlay,
    externalRoundId: 401,
    showCurrentBracket: false,
  });
  const standings = await t.run((ctx) =>
    ctx.db.query("roundStandings").collect(),
  );
  expect(standings.map((row) => row.externalRoundId)).toEqual([401]);
});

it("the bracket flags are exclusive", async () => {
  const { t, owner, ids } = await setup();
  const read = async () => {
    const overlay = await t.run((ctx) => ctx.db.get(ids.overlay));
    if (overlay?.overlayType !== "standings") {
      throw new Error("not a standings overlay");
    }
    return overlay;
  };

  await owner.mutation(api.overlays.standings.updateStandingsOverlay, {
    overlayId: ids.overlay,
    showCompletedBracket: true,
  });
  expect((await read()).showCompletedBracket).toBe(true);
  expect((await read()).showCurrentBracket).toBe(false);

  await owner.mutation(api.overlays.standings.updateStandingsOverlay, {
    overlayId: ids.overlay,
    showCurrentBracket: true,
  });
  expect((await read()).showCompletedBracket).toBe(false);
  expect((await read()).showCurrentBracket).toBe(true);

  await owner.mutation(api.overlays.standings.updateStandingsOverlay, {
    overlayId: ids.overlay,
    externalRoundId: 502,
    showCurrentBracket: false,
  });
  const selected = await read();
  expect(selected.showCompletedBracket).toBe(false);
  expect(selected.showCurrentBracket).toBe(false);
  expect(selected.externalRoundId).toBe(502);
});
