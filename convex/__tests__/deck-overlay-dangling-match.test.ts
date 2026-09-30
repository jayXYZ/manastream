/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { defineSchema } from "convex/server";
import { expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.{js,ts}");
// See featurematch-removal.test.ts for why schema validation is disabled.
const testSchema = defineSchema(schema.tables, { schemaValidation: false });

async function setup() {
  const t = convexTest(testSchema, modules);
  const ids = await t.run(async (ctx) => {
    const owner = await ctx.db.insert("users", {});
    const tournament = await ctx.db.insert("tournaments", {
      userId: owner,
      mode: "manual" as const,
      externalTournamentId: 999,
      manualTimerRunning: false,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("externalTournaments", {
      externalTournamentId: 999,
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
    const pairing = await ctx.db.insert("pairings", {
      externalId: "pairing:999:101:match1",
      externalTournamentId: 999,
      tournamentId: tournament,
      externalRoundId: 101,
      roundNumber: 1,
      externalMatchId: "match1",
      player1,
      player2,
      player1TournamentRecord: "0-0",
      player2TournamentRecord: "0-0",
      status: "IN_PROGRESS",
      createdAt: 1,
    });
    const overlay = await ctx.db.insert("overlays", {
      name: "Deck",
      overlayType: "deck",
      tournamentId: tournament,
      publicUuid: "deck-public",
      createdAt: 1,
    });
    return { owner, pairing, overlay, player1 };
  });
  const owner = t.withIdentity({ subject: ids.owner });
  await owner.mutation(api.featurematches.setPairingFeatured, {
    pairingId: ids.pairing,
    featured: true,
  });
  const [match] = await owner.query(
    api.featurematches.getAllFeatureMatches,
    {},
  );
  const matchId = match!._id;
  await owner.mutation(api.overlays.deck.updateDeckOverlay, {
    overlayId: ids.overlay,
    matchId,
  });
  return { t, ids, matchId };
}

it("returns matchData for a deck overlay whose feature match is intact", async () => {
  const { t } = await setup();
  const overlay = await t.query(api.overlays.queries.getOverlayByUuid, {
    publicUuid: "deck-public",
  });
  expect(overlay).toMatchObject({
    overlayType: "deck",
    matchData: expect.objectContaining({
      player1Data: expect.objectContaining({ name: "Ada" }),
      player2Data: expect.objectContaining({ name: "Ben" }),
    }),
  });
});

it("returns matchData: null instead of throwing when the feature match row is gone", async () => {
  const { t, ids, matchId } = await setup();
  // Delete the row directly so the overlay's matchId is left dangling.
  await t.run((ctx) => ctx.db.delete(matchId));
  expect(await t.run((ctx) => ctx.db.get(ids.overlay))).toMatchObject({
    matchId,
  });

  const overlay = await t.query(api.overlays.queries.getOverlayByUuid, {
    publicUuid: "deck-public",
  });
  expect(overlay).toMatchObject({ overlayType: "deck", matchData: null });
});

it("returns matchData: null instead of throwing when a player row is gone", async () => {
  const { t, ids, matchId } = await setup();
  await t.run((ctx) => ctx.db.delete(ids.player1));
  expect(await t.run((ctx) => ctx.db.get(matchId))).not.toBeNull();

  const overlay = await t.query(api.overlays.queries.getOverlayByUuid, {
    publicUuid: "deck-public",
  });
  expect(overlay).toMatchObject({ overlayType: "deck", matchData: null });
});
