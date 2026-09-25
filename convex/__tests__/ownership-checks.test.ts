/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { defineSchema } from "convex/server";
import { expect, it } from "vitest";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import schema from "../schema";

const modules = import.meta.glob("../**/*.{js,ts}");
const testSchema = defineSchema(schema.tables, { schemaValidation: false });

/**
 * Three users: `owner` and `viewer` both link Melee tournament 999 (shared
 * cache), `other` links Melee tournament 555. Each has one match, deck and
 * standings overlay. One feature match exists, captured for owner's
 * tournament on Melee round 101 of tournament 999.
 */
async function setup() {
  const t = convexTest(testSchema, modules);
  const ids = await t.run(async (ctx) => {
    const base = {
      mode: "manual" as const,
      manualTimerRunning: false,
      createdAt: 1,
      updatedAt: 1,
    };
    const users = {} as Record<
      "owner" | "viewer" | "other",
      {
        user: Id<"users">;
        match: Id<"overlays">;
        deck: Id<"overlays">;
        standings: Id<"overlays">;
      }
    >;
    for (const [name, externalTournamentId] of [
      ["owner", 999],
      ["viewer", 999],
      ["other", 555],
    ] as const) {
      const user = await ctx.db.insert("users", {});
      const tournamentId = await ctx.db.insert("tournaments", {
        ...base,
        userId: user,
        externalTournamentId,
      });
      const match = await ctx.db.insert("overlays", {
        name: `${name} match`,
        overlayType: "match",
        template: "Default",
        tournamentId,
        publicUuid: `${name}-match`,
        player1Life: 20,
        player2Life: 20,
        player1GamesWon: 0,
        player2GamesWon: 0,
        createdAt: 1,
      });
      const deck = await ctx.db.insert("overlays", {
        name: `${name} deck`,
        overlayType: "deck",
        tournamentId,
        publicUuid: `${name}-deck`,
        createdAt: 1,
      });
      const standings = await ctx.db.insert("overlays", {
        name: `${name} standings`,
        overlayType: "standings",
        tournamentId,
        publicUuid: `${name}-standings`,
        createdAt: 1,
      });
      users[name] = { user, match, deck, standings };
    }
    await ctx.db.insert("externalTournaments", {
      externalTournamentId: 999,
      currentRoundId: 102,
      currentRoundNumber: 2,
      completedRounds: [{ roundId: 101, roundName: "Round 1" }],
      updatedAt: 1,
    });
    await ctx.db.insert("externalTournaments", {
      externalTournamentId: 555,
      currentRoundId: 501,
      currentRoundNumber: 1,
      completedRounds: [],
      updatedAt: 1,
    });
    const player1 = await ctx.db.insert("players", {
      name: "Ada",
      externalPlayerId: 1,
      externalTournamentId: 999,
      updatedAt: 1,
    });
    const player2 = await ctx.db.insert("players", {
      name: "Ben",
      externalPlayerId: 2,
      externalTournamentId: 999,
      updatedAt: 1,
    });
    const ownerTournament = (await ctx.db.get(users.owner.match))!.tournamentId;
    const featureMatch = await ctx.db.insert("featureMatches", {
      externalId: "feature:999:match1",
      externalTournamentId: 999,
      tournamentId: ownerTournament,
      externalRoundId: 101,
      roundNumber: 1,
      player1,
      player2,
      player1TournamentRecord: "0-0",
      player2TournamentRecord: "0-0",
      externalMatchId: "match1",
      createdAt: 1,
    });
    return { users, featureMatch };
  });
  return {
    t,
    featureMatch: ids.featureMatch,
    owner: {
      ...ids.users.owner,
      as: t.withIdentity({ subject: ids.users.owner.user }),
    },
    viewer: {
      ...ids.users.viewer,
      as: t.withIdentity({ subject: ids.users.viewer.user }),
    },
    other: {
      ...ids.users.other,
      as: t.withIdentity({ subject: ids.users.other.user }),
    },
  };
}

it("lets the owner and a user sharing the Melee tournament attach a feature match", async () => {
  const { t, owner, viewer, featureMatch } = await setup();

  await owner.as.mutation(api.overlays.match.setOverlayFeatureMatch, {
    overlayId: owner.match,
    featureMatchId: featureMatch,
    playersSwapped: false,
  });
  await viewer.as.mutation(api.overlays.match.setOverlayFeatureMatch, {
    overlayId: viewer.match,
    featureMatchId: featureMatch,
    playersSwapped: true,
  });
  await viewer.as.mutation(api.overlays.deck.updateDeckOverlay, {
    overlayId: viewer.deck,
    matchId: featureMatch,
  });

  await t.run(async (ctx) => {
    const ownerMatch = await ctx.db.get(owner.match);
    const viewerMatch = await ctx.db.get(viewer.match);
    const viewerDeck = await ctx.db.get(viewer.deck);
    expect(
      ownerMatch?.overlayType === "match" && ownerMatch.player1,
    ).toBeTruthy();
    expect(
      viewerMatch?.overlayType === "match" &&
        viewerMatch.player1 ===
          (ownerMatch?.overlayType === "match"
            ? ownerMatch.player2
            : undefined),
    ).toBe(true);
    expect(viewerDeck?.overlayType === "deck" && viewerDeck.matchId).toBe(
      featureMatch,
    );
  });
});

it("refuses a feature match from a Melee tournament the user has not linked", async () => {
  const { t, other, featureMatch } = await setup();

  await expect(
    other.as.mutation(api.overlays.match.setOverlayFeatureMatch, {
      overlayId: other.match,
      featureMatchId: featureMatch,
      playersSwapped: false,
    }),
  ).rejects.toThrow("Feature match not found or access denied");
  await expect(
    other.as.mutation(api.overlays.deck.updateDeckOverlay, {
      overlayId: other.deck,
      matchId: featureMatch,
    }),
  ).rejects.toThrow("Feature match not found or access denied");

  await t.run(async (ctx) => {
    const match = await ctx.db.get(other.match);
    const deck = await ctx.db.get(other.deck);
    expect(match?.overlayType === "match" && match.player1).toBeUndefined();
    expect(deck?.overlayType === "deck" && deck.matchId).toBeUndefined();
  });
});

it("only accepts standings rounds from the user's linked Melee tournament", async () => {
  const { t, owner, other } = await setup();

  // Completed round and current round of the linked tournament are both fine.
  await owner.as.mutation(api.overlays.standings.updateStandingsOverlay, {
    overlayId: owner.standings,
    externalRoundId: 101,
  });
  await owner.as.mutation(api.overlays.standings.updateStandingsOverlay, {
    overlayId: owner.standings,
    externalRoundId: 102,
  });
  // A round from another Melee tournament is refused and creates no row.
  await expect(
    other.as.mutation(api.overlays.standings.updateStandingsOverlay, {
      overlayId: other.standings,
      externalRoundId: 101,
    }),
  ).rejects.toThrow("Round not found in the linked Melee tournament");

  await t.run(async (ctx) => {
    const rows = await ctx.db.query("roundStandings").collect();
    expect(rows.map((row) => row.externalRoundId).sort()).toEqual([101, 102]);
    expect(rows.every((row) => row.externalTournamentId === 999)).toBe(true);
    const overlay = await ctx.db.get(other.standings);
    expect(
      overlay?.overlayType === "standings" && overlay.roundStandingsId,
    ).toBeUndefined();
  });
});

it("only records and counts life trackers for overlays the user owns", async () => {
  const { owner, viewer } = await setup();

  await owner.as.mutation(api.presence.setConnectedLifeTracker, {
    overlayId: owner.match,
    sessionId: "s1",
  });
  expect(
    await owner.as.query(api.presence.getConnectedLifeTrackers, {
      overlayId: owner.match,
    }),
  ).toBe(1);

  await expect(
    viewer.as.mutation(api.presence.setConnectedLifeTracker, {
      overlayId: owner.match,
      sessionId: "s2",
    }),
  ).rejects.toThrow("Tournament not found or access denied");
  await expect(
    viewer.as.query(api.presence.getConnectedLifeTrackers, {
      overlayId: owner.match,
    }),
  ).rejects.toThrow("Tournament not found or access denied");
});

it("only returns completed rounds of the caller's own linked Melee tournament", async () => {
  const { t, owner, other } = await setup();

  // owner links 999, which has one completed round.
  expect(
    await owner.as.query(api.tournamentSync.getCompletedRounds, {}),
  ).toEqual([{ roundId: 101, roundName: "Round 1" }]);
  // other links 555, which has none; there is no argument to reach 999's rounds.
  expect(
    await other.as.query(api.tournamentSync.getCompletedRounds, {}),
  ).toEqual([]);
  // Signed out: empty, not an error.
  expect(await t.query(api.tournamentSync.getCompletedRounds, {})).toEqual([]);
});
