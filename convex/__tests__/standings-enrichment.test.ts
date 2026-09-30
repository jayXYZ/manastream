/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { defineSchema } from "convex/server";
import { expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.{js,ts}");
const testSchema = defineSchema(schema.tables, { schemaValidation: false });

function standing(rank: number, externalPlayerId: number, name: string) {
  return {
    rank,
    externalPlayerId,
    name,
    record: "3-0",
    matchPoints: 9,
    wins: 3,
    losses: 0,
    draws: 0,
    gameWinPercentage: 1,
    opponentMatchWinPercentage: 0.5,
    opponentGameWinPercentage: 0.5,
  };
}

it("joins standings rows to players, statuses and decklists by Melee player id", async () => {
  const t = convexTest(testSchema, modules);
  await t.run(async (ctx) => {
    const user = await ctx.db.insert("users", {});
    const tournamentId = await ctx.db.insert("tournaments", {
      userId: user,
      mode: "manual",
      externalTournamentId: 999,
      manualTimerRunning: false,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("externalTournaments", {
      externalTournamentId: 999,
      currentRoundId: 104,
      currentRoundNumber: 4,
      currentRoundName: "Round 4",
      completedRounds: [{ roundId: 103, roundName: "Round 3" }],
      updatedAt: 1,
    });
    const ada = await ctx.db.insert("players", {
      name: "Ada",
      externalPlayerId: 1,
      externalTournamentId: 999,
      updatedAt: 1,
    });
    await ctx.db.insert("playerDecklists", {
      playerId: ada,
      externalTournamentId: 999,
      externalPlayerId: 1,
      decklistStatus: "ready",
      deckName: "Dimir Tempo",
      deckList: "4 Counterspell",
      updatedAt: 1,
    });
    await ctx.db.insert("playerStatuses", {
      playerId: ada,
      externalTournamentId: 999,
      externalPlayerId: 1,
      registrationStatus: "DROPPED",
      updatedAt: 1,
    });
    // A player from another Melee tournament with the same external id
    // must not be matched.
    await ctx.db.insert("players", {
      name: "Impostor",
      externalPlayerId: 2,
      externalTournamentId: 555,
      updatedAt: 1,
    });
    const roundStandingsId = await ctx.db.insert("roundStandings", {
      externalRoundId: 103,
      externalTournamentId: 999,
      roundNumber: 3,
      standings: [standing(1, 1, "Ada"), standing(2, 2, "Ben")],
      updatedAt: 1,
    });
    await ctx.db.insert("overlays", {
      name: "Standings",
      overlayType: "standings",
      tournamentId,
      publicUuid: "standings-uuid",
      roundStandingsId,
      externalRoundId: 103,
      createdAt: 1,
    });
  });

  const overlay = await t.query(api.overlays.queries.getOverlayByUuid, {
    publicUuid: "standings-uuid",
  });
  expect(overlay).toMatchObject({
    overlayType: "standings",
    roundDisplayName: "Round 3",
    standingsDataWithPlayers: [
      {
        rank: 1,
        seed: 1,
        playerData: {
          name: "Ada",
          deckName: "Dimir Tempo",
          deckList: "4 Counterspell",
          registrationStatus: "DROPPED",
        },
      },
      { rank: 2, seed: 2 },
    ],
  });
  const rows =
    overlay?.overlayType === "standings"
      ? overlay.standingsDataWithPlayers
      : undefined;
  expect(rows?.[1].playerData).toBeUndefined();
});
