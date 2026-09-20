/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { defineSchema } from "convex/server";
import { expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.{js,ts}");
// The app reuses document validators containing system fields in its schema.
// convex-test validates inserts before assigning those fields; retain the real
// indexes but disable that check. Function argument/return validation stays on.
const testSchema = defineSchema(schema.tables, { schemaValidation: false });

async function setup() {
  const t = convexTest(testSchema, modules);
  const ids = await t.run(async (ctx) => {
    const owner = await ctx.db.insert("users", {});
    const viewer = await ctx.db.insert("users", {});
    const tournament = {
      mode: "manual" as const,
      externalTournamentId: 999,
      manualTimerRunning: false,
      createdAt: 1,
      updatedAt: 1,
    };
    const ownerTournament = await ctx.db.insert("tournaments", {
      ...tournament,
      userId: owner,
    });
    const viewerTournament = await ctx.db.insert("tournaments", {
      ...tournament,
      userId: viewer,
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
      tournamentId: ownerTournament,
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
    const ownerOverlay = await ctx.db.insert("overlays", {
      name: "Owner deck",
      overlayType: "deck",
      tournamentId: ownerTournament,
      publicUuid: "owner-deck",
      createdAt: 1,
    });
    const viewerOverlay = await ctx.db.insert("overlays", {
      name: "Viewer deck",
      overlayType: "deck",
      tournamentId: viewerTournament,
      publicUuid: "viewer-deck",
      createdAt: 1,
    });
    return { owner, viewer, pairing, ownerOverlay, viewerOverlay };
  });
  const owner = t.withIdentity({ subject: ids.owner });
  const viewer = t.withIdentity({ subject: ids.viewer });
  await owner.mutation(api.featurematches.setPairingFeatured, {
    pairingId: ids.pairing,
    featured: true,
  });
  const [match] = await viewer.query(
    api.featurematches.getAllFeatureMatches,
    {},
  );
  const matchId = match!._id;
  await owner.mutation(api.overlays.updateDeckOverlay, {
    overlayId: ids.ownerOverlay,
    matchId,
  });
  await viewer.mutation(api.overlays.updateDeckOverlay, {
    overlayId: ids.viewerOverlay,
    matchId,
  });
  return { t, owner, viewer, ids, matchId };
}

it("unfeaturing clears references across accounts and leaves public overlays readable", async () => {
  const { t, owner, ids, matchId } = await setup();
  await owner.mutation(api.featurematches.setPairingFeatured, {
    pairingId: ids.pairing,
    featured: false,
  });
  expect(await t.run((ctx) => ctx.db.get(matchId))).toBeNull();
  for (const publicUuid of ["owner-deck", "viewer-deck"]) {
    const overlay = await t.query(api.overlays.getOverlayByUuid, {
      publicUuid,
    });
    expect(overlay).toMatchObject({ overlayType: "deck", matchData: null });
    expect(overlay).not.toHaveProperty("matchId");
  }
  // Repeated removal is safe.
  await owner.mutation(api.featurematches.setPairingFeatured, {
    pairingId: ids.pairing,
    featured: false,
  });
});

it("rejects a stale selection of a deleted feature match", async () => {
  const { t, owner, viewer, ids, matchId } = await setup();
  await owner.mutation(api.featurematches.setPairingFeatured, {
    pairingId: ids.pairing,
    featured: false,
  });
  await expect(
    viewer.mutation(api.overlays.updateDeckOverlay, {
      overlayId: ids.viewerOverlay,
      matchId,
    }),
  ).rejects.toThrow("Feature match no longer exists");
  expect(
    await t.run((ctx) => ctx.db.get(ids.viewerOverlay)),
  ).not.toHaveProperty("matchId");
});

it("rejects removal by another account without clearing its overlay", async () => {
  const { t, viewer, ids, matchId } = await setup();
  await expect(
    viewer.mutation(api.featurematches.setPairingFeatured, {
      pairingId: ids.pairing,
      featured: false,
    }),
  ).rejects.toThrow("Tournament not found or access denied");
  expect(await t.run((ctx) => ctx.db.get(matchId))).not.toBeNull();
  expect(await t.run((ctx) => ctx.db.get(ids.viewerOverlay))).toMatchObject({
    matchId,
  });
});
