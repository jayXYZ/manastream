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
    const player1 = await ctx.db.insert("players", {
      name: "Ada",
      externalPlayerId: 1,
      updatedAt: 1,
    });
    const player2 = await ctx.db.insert("players", {
      name: "Ben",
      externalPlayerId: 2,
      updatedAt: 1,
    });
    const featureMatch = await ctx.db.insert("featureMatches", {
      externalId: "feature:999:match1",
      externalTournamentId: 999,
      tournamentId: tournament,
      externalRoundId: 101,
      roundNumber: 1,
      player1,
      player2,
      player1TournamentRecord: "0-0",
      player2TournamentRecord: "0-0",
      createdAt: 1,
    });
    const deckOverlay = await ctx.db.insert("overlays", {
      name: "Deck",
      overlayType: "deck",
      tournamentId: tournament,
      publicUuid: "deck",
      matchId: featureMatch,
      createdAt: 1,
    });
    const standingsOverlay = await ctx.db.insert("overlays", {
      name: "Standings",
      overlayType: "standings",
      tournamentId: tournament,
      publicUuid: "standings",
      externalRoundId: 101,
      createdAt: 1,
    });
    return { user, tournament, featureMatch, deckOverlay, standingsOverlay };
  });
  const owner = t.withIdentity({ subject: ids.user });
  return { t, owner, ids };
}

it("linking a different Melee tournament clears the deck overlay's match", async () => {
  const { t, owner, ids } = await setup();

  await owner.mutation(api.tournaments.updateTournamentSettings, {
    externalTournamentId: 1000,
  });

  const deck = await t.run((ctx) => ctx.db.get(ids.deckOverlay));
  expect(deck?.overlayType === "deck" && deck.matchId).toBeUndefined();
  // Other overlay types are left alone.
  const standings = await t.run((ctx) => ctx.db.get(ids.standingsOverlay));
  expect(
    standings?.overlayType === "standings" && standings.externalRoundId,
  ).toBe(101);

  // Saving the dialog with no deck selection no longer trips the access check.
  await owner.mutation(api.overlays.deck.updateDeckOverlay, {
    overlayId: ids.deckOverlay,
    matchId: undefined,
  });
});

it("keeping the same Melee tournament leaves the deck overlay's match alone", async () => {
  const { t, owner, ids } = await setup();

  await owner.mutation(api.tournaments.updateTournamentSettings, {
    externalTournamentId: 999,
  });

  const deck = await t.run((ctx) => ctx.db.get(ids.deckOverlay));
  expect(deck?.overlayType === "deck" && deck.matchId).toBe(ids.featureMatch);
});
