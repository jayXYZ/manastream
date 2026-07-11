import { describe, expect, it } from "vitest";
import {
  buildRoundSnapshot,
  getRoundDisplayName,
  isEliminationPhase,
  isTournamentComplete,
  parseCompletedRounds,
  parseMeleeRegistrationStatus,
  parsePlayerRecord,
  seedMapFromStandings,
  standingsByPlayerId,
  toStandingRows,
} from "../melee";
import {
  makeCompetitor,
  makeMatch,
  makeOverview,
  makePhase,
  makeRound,
  makeStandardOverview,
  TOP8_PHASE_ID,
  TOURNAMENT_ID,
} from "../../lib/melee/__tests__/fixtures";
import {
  MeleePaginatedResponse,
  MeleePlayerListEntry,
  MeleeStanding,
} from "../../types/melee";
import standingsFixture from "../../lib/melee/__tests__/fixtures/melee-round-standings.json";
import playersFixture from "../../lib/melee/__tests__/fixtures/melee-list-tournament-players.json";

const standings = (
  standingsFixture as unknown as MeleePaginatedResponse<MeleeStanding>
).Content;
const players = (
  playersFixture as unknown as MeleePaginatedResponse<MeleePlayerListEntry>
).Content;

describe("standings parsing", () => {
  it("indexes standings by numeric player ID", () => {
    const byPlayer = standingsByPlayerId(standings);
    expect(byPlayer.get(4104398)?.Rank).toBe(1);
    expect(byPlayer.get(4104415)?.Rank).toBe(2);
    expect(byPlayer.size).toBe(5);
  });

  it("builds a seed map from ranks", () => {
    const seeds = seedMapFromStandings(standings);
    expect(seeds.get(4104398)).toBe(1);
    expect(seeds.get(4104392)).toBe(4);
  });

  it("formats records, hiding zero draws", () => {
    const byPlayer = standingsByPlayerId(standings);
    expect(parsePlayerRecord(byPlayer.get(4104398)!)).toBe("3-0");
    expect(parsePlayerRecord(byPlayer.get(4104384)!)).toBe("2-0-1");
  });

  it("converts standings to internal StandingRow shape", () => {
    const rows = toStandingRows(standings);
    expect(rows[0]).toEqual({
      rank: 1,
      externalPlayerId: 4104398,
      name: "Mickey Mouse",
      record: "3-0",
      matchPoints: 9,
      wins: 3,
      losses: 0,
      draws: 0,
      gameWinPercentage: 1.0,
      opponentMatchWinPercentage: 0.6666667,
      opponentGameWinPercentage: 0.5714286,
    });
    expect(rows).toHaveLength(5);
  });
});

describe("player list parsing", () => {
  it("reports active players' registration status", () => {
    expect(parseMeleeRegistrationStatus(players[0])).toBe("ACTIVE");
  });

  it("reports dropped players as DROPPED", () => {
    const dropped = {
      ...players[0],
      RoundDroppedId: 1529973,
      RoundDroppedNumber: 2,
    };
    expect(parseMeleeRegistrationStatus(dropped)).toBe("DROPPED");
  });

  it("exposes embedded decklists with records", () => {
    expect(players[0].Decklists[0].Guid).toBe(
      "729c1b7b-dbcc-465b-9c66-b45b01445a37",
    );
    expect(players[0].Decklists[0].Records[0].n).toBe("Island");
    expect(players[1].Decklists).toHaveLength(0);
  });
});

describe("tournament overview parsing", () => {
  it("detects completion from StatusDescription", () => {
    expect(isTournamentComplete(makeStandardOverview())).toBe(false);
    expect(
      isTournamentComplete(
        makeOverview({
          phases: [],
          statusDescription: "Complete",
        }),
      ),
    ).toBe(true);
    expect(
      isTournamentComplete(
        makeOverview({ phases: [], statusDescription: "Ended" }),
      ),
    ).toBe(true);
  });

  it("detects elimination phases by name", () => {
    const overview = makeStandardOverview();
    expect(isEliminationPhase(overview.Phases[0])).toBe(false);
    expect(isEliminationPhase(overview.Phases[1])).toBe(true);
  });

  it("uses Melee round names when meaningful", () => {
    const overview = makeOverview({
      phases: [
        makePhase({
          id: TOP8_PHASE_ID,
          name: "Playoffs",
          sortOrder: 1,
          rounds: [makeRound(9001, "Grand Finals", 1)],
        }),
      ],
    });
    expect(getRoundDisplayName(overview, 9001)).toBe("Grand Finals");
  });

  it("maps generic elimination round names to bracket names", () => {
    const overview = makeStandardOverview();
    expect(getRoundDisplayName(overview, 1529974)).toBe("Round 3");
    expect(getRoundDisplayName(overview, 1529975)).toBe("Quarterfinals");
    expect(getRoundDisplayName(overview, 1529976)).toBe("Semifinals");
    expect(getRoundDisplayName(overview, 1529977)).toBe("Finals");
  });

  it("lists completed rounds before the current round", () => {
    const overview = makeStandardOverview();
    expect(parseCompletedRounds(overview, 1529974)).toEqual([
      { roundId: 1529972, roundName: "Round 1" },
      { roundId: 1529973, roundName: "Round 2" },
    ]);
    expect(parseCompletedRounds(overview, 1529975)).toHaveLength(3);
    // Unknown current round (e.g. complete tournament): all rounds count
    expect(parseCompletedRounds(overview, undefined)).toHaveLength(6);
  });
});

describe("buildRoundSnapshot", () => {
  const byPlayer = standingsByPlayerId(standings);

  it("returns undefined when there are no matches", () => {
    expect(
      buildRoundSnapshot({
        overview: makeStandardOverview(),
        matches: [],
        standingsByPlayerId: byPlayer,
      }),
    ).toBeUndefined();
  });

  it("builds a swiss round snapshot with records from standings", () => {
    const matches = [
      makeMatch({
        guid: "match-guid-1",
        roundId: 1529974,
        roundNumber: 3,
        tableNumber: 1,
        featureMatch: true,
        competitors: [
          makeCompetitor({ playerId: 4104398, name: "Mickey Mouse" }),
          makeCompetitor({
            playerId: 4104392,
            name: "Sandy Beech",
            decklist: {
              DecklistId: "3f583aea-a7aa-48b7-82be-b45b014324a4",
              DecklistName: "Mono-Red",
            },
          }),
        ],
      }),
      makeMatch({
        guid: "match-guid-bye",
        roundId: 1529974,
        roundNumber: 3,
        tableNumber: null,
        competitors: [
          makeCompetitor({ playerId: 4104403, name: "Minnie Mouse" }),
        ],
      }),
    ];

    const snapshot = buildRoundSnapshot({
      overview: makeStandardOverview(),
      matches,
      standingsByPlayerId: byPlayer,
    });

    expect(snapshot).toBeDefined();
    expect(snapshot!.externalTournamentId).toBe(TOURNAMENT_ID);
    expect(snapshot!.roundId).toBe(1529974);
    expect(snapshot!.roundNumber).toBe(3);
    expect(snapshot!.roundDisplayName).toBe("Round 3");
    expect(snapshot!.isEliminationRound).toBe(false);

    const [featureMatch, byeMatch] = snapshot!.matches;
    expect(featureMatch.externalMatchId).toBe("match-guid-1");
    expect(featureMatch.isFeatureMatch).toBe(true);
    expect(featureMatch.tableNumber).toBe(1);
    expect(featureMatch.competitors[0]).toMatchObject({
      externalPlayerId: 4104398,
      name: "Mickey Mouse",
      tournamentRecord: "3-0",
      matchPoints: 9,
    });
    expect(featureMatch.competitors[1]).toMatchObject({
      externalPlayerId: 4104392,
      tournamentRecord: "2-0-1",
      externalDecklistId: "3f583aea-a7aa-48b7-82be-b45b014324a4",
      decklistName: "Mono-Red",
    });

    expect(byeMatch.tableNumber).toBeUndefined();
    expect(byeMatch.competitors).toHaveLength(1);
  });

  it("shows seeds as the record during elimination rounds", () => {
    const matches = [
      makeMatch({
        guid: "qf-match",
        roundId: 1529975,
        roundNumber: 4,
        phaseId: TOP8_PHASE_ID,
        competitors: [
          makeCompetitor({ playerId: 4104398, name: "Mickey Mouse" }),
          makeCompetitor({ playerId: 4104392, name: "Sandy Beech" }),
        ],
      }),
    ];

    const snapshot = buildRoundSnapshot({
      overview: makeStandardOverview(),
      matches,
      standingsByPlayerId: byPlayer,
      lastSwissSeedByPlayerId: seedMapFromStandings(standings),
    });

    expect(snapshot!.isEliminationRound).toBe(true);
    expect(snapshot!.roundDisplayName).toBe("Quarterfinals");
    expect(snapshot!.matches[0].competitors[0]).toMatchObject({
      tournamentRecord: "#1",
      seed: 1,
    });
    expect(snapshot!.matches[0].competitors[1]).toMatchObject({
      tournamentRecord: "#4",
      seed: 4,
    });
  });

  it("keeps only matches from the first round when rounds are mixed", () => {
    const matches = [
      makeMatch({
        guid: "current",
        roundId: 1529974,
        roundNumber: 3,
        competitors: [
          makeCompetitor({ playerId: 4104398, name: "Mickey Mouse" }),
          makeCompetitor({ playerId: 4104392, name: "Sandy Beech" }),
        ],
      }),
      makeMatch({
        guid: "stale",
        roundId: 1529973,
        roundNumber: 2,
        competitors: [
          makeCompetitor({ playerId: 4104415, name: "Ross Geller" }),
          makeCompetitor({ playerId: 4104384, name: "Robin Banks" }),
        ],
      }),
    ];

    const snapshot = buildRoundSnapshot({
      overview: makeStandardOverview(),
      matches,
      standingsByPlayerId: byPlayer,
    });

    expect(snapshot!.matches).toHaveLength(1);
    expect(snapshot!.matches[0].externalMatchId).toBe("current");
  });
});
