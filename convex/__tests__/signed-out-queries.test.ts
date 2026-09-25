/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { defineSchema } from "convex/server";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.{js,ts}");
const testSchema = defineSchema(schema.tables, { schemaValidation: false });

/**
 * Dashboard queries subscribe with `useQuery`, so they rerun without an
 * identity during sign-out or a token refresh, and a password sign-up has
 * no tournament or settings until the email is verified. None of these
 * queries may throw in either state; the client renders the empty result.
 */
async function setup() {
  const t = convexTest(testSchema, modules);
  const ids = await t.run(async (ctx) => {
    // A password sign-up that has not verified its email: no tournament,
    // no settings, no overlays.
    const unverified = await ctx.db.insert("users", {
      email: "unverified@example.com",
    });
    // A fully initialized user, to show the same queries still return data.
    const verified = await ctx.db.insert("users", {
      email: "verified@example.com",
      image: "https://example.com/avatar.png",
    });
    const tournamentId = await ctx.db.insert("tournaments", {
      userId: verified,
      mode: "manual",
      manualTimerRunning: false,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("overlays", {
      name: "match",
      overlayType: "match",
      template: "Default",
      tournamentId,
      publicUuid: "verified-match",
      player1Life: 20,
      player2Life: 20,
      player1GamesWon: 0,
      player2GamesWon: 0,
      createdAt: 1,
    });
    await ctx.db.insert("settings", {
      userId: verified,
      meleeClientId: "client",
      meleeClientSecret: "secret",
      createdAt: 1,
      updatedAt: 1,
    });
    return { unverified, verified, tournamentId };
  });
  return {
    signedOut: t,
    unverified: t.withIdentity({ subject: ids.unverified }),
    verified: t.withIdentity({ subject: ids.verified }),
    tournamentId: ids.tournamentId,
  };
}

describe("signed-out caller", () => {
  it("gets null from the user queries", async () => {
    const { signedOut } = await setup();
    expect(await signedOut.query(api.auth.getUserEmail, {})).toBeNull();
    expect(await signedOut.query(api.auth.getUserAvatar, {})).toBeNull();
    expect(
      await signedOut.query(api.tournaments.getUserTournament, {}),
    ).toBeNull();
    expect(await signedOut.query(api.settings.getSettings, {})).toBeNull();
  });

  it("gets empty results from the tournament-scoped queries", async () => {
    const { signedOut } = await setup();
    expect(
      await signedOut.query(api.overlays.queries.getUserOverlays, {}),
    ).toEqual([]);
    expect(
      await signedOut.query(api.player.getAllTournamentPlayers, {}),
    ).toEqual([]);
    expect(await signedOut.query(api.settings.getIntegrationLogs, {})).toEqual(
      [],
    );
    expect(
      await signedOut.query(
        api.featurematches.getCurrentRoundFeatureMatches,
        {},
      ),
    ).toEqual([]);
    expect(
      await signedOut.query(api.featurematches.getAllFeatureMatches, {}),
    ).toEqual([]);
    expect(
      await signedOut.query(
        api.featurematches.getCurrentRoundFeaturedMatchIds,
        {},
      ),
    ).toEqual([]);
    const pairings = await signedOut.query(
      api.pairings.getCurrentRoundPairings,
      {},
    );
    expect(pairings.pairings).toEqual([]);
    expect(pairings.status).toBe("no_tournament");
  });
});

describe("signed-in user with no tournament yet", () => {
  it("gets its email but null for the tournament and settings", async () => {
    const { unverified } = await setup();
    expect(await unverified.query(api.auth.getUserEmail, {})).toBe(
      "unverified@example.com",
    );
    // No image set: null, never undefined.
    expect(await unverified.query(api.auth.getUserAvatar, {})).toBeNull();
    expect(
      await unverified.query(api.tournaments.getUserTournament, {}),
    ).toBeNull();
    expect(await unverified.query(api.settings.getSettings, {})).toBeNull();
  });

  it("gets empty results from the tournament-scoped queries", async () => {
    const { unverified } = await setup();
    expect(
      await unverified.query(api.overlays.queries.getUserOverlays, {}),
    ).toEqual([]);
    expect(
      await unverified.query(api.player.getAllTournamentPlayers, {}),
    ).toEqual([]);
    expect(
      await unverified.query(api.featurematches.getAllFeatureMatches, {}),
    ).toEqual([]);
    const pairings = await unverified.query(
      api.pairings.getCurrentRoundPairings,
      {},
    );
    expect(pairings.status).toBe("no_tournament");
  });
});

describe("initialized user", () => {
  it("still gets its own data", async () => {
    const { verified, tournamentId } = await setup();
    expect(await verified.query(api.auth.getUserEmail, {})).toBe(
      "verified@example.com",
    );
    expect(await verified.query(api.auth.getUserAvatar, {})).toBe(
      "https://example.com/avatar.png",
    );
    expect(
      (await verified.query(api.tournaments.getUserTournament, {}))?._id,
    ).toBe(tournamentId);
    expect(await verified.query(api.settings.getSettings, {})).toEqual({
      meleeClientId: "client",
      hasMeleeClientSecret: true,
    });
    expect(
      (await verified.query(api.overlays.queries.getUserOverlays, {})).map(
        (overlay) => overlay.publicUuid,
      ),
    ).toEqual(["verified-match"]);
  });
});

describe("mutations", () => {
  it("still reject a signed-out caller", async () => {
    const { signedOut } = await setup();
    await expect(
      signedOut.mutation(api.tournaments.updateTournamentSettings, {
        mode: "manual",
      }),
    ).rejects.toThrow("User not authenticated");
    await expect(
      signedOut.mutation(api.settings.updateSettings, { meleeClientId: "x" }),
    ).rejects.toThrow("User not authenticated");
  });

  it("still reject a user with no tournament", async () => {
    const { unverified } = await setup();
    await expect(
      unverified.mutation(api.tournaments.updateTournamentSettings, {
        mode: "manual",
      }),
    ).rejects.toThrow("No tournament found for this user");
  });
});
