import { describe, expect, it } from "vitest";

import { enrichStandingsOverlay } from "../overlays";

describe("enrichStandingsOverlay", () => {
  it("fills the current elimination bracket from paired players when pairing rows do not store seeds", async () => {
    const player1 = makePlayer("player1", "Ada", 101, "Dimir Tempo");
    const player2 = makePlayer("player2", "Ben", 108, "Jeskai Control");
    const ctx = makeOverlayCtx({
      externalTournament: {
        _id: "externalTournament1",
        _creationTime: 1,
        externalTournamentId: 999,
        currentRoundId: 501,
        currentRoundNumber: 9,
        currentRoundName: "Quarterfinals",
        completedRounds: [{ roundId: 401, roundName: "Round 8" }],
      },
      tournaments: [
        {
          _id: "tournament1",
          _creationTime: 1,
          userId: "user1",
          name: "Test Tournament",
          mode: "manual",
          externalTournamentId: 999,
          currentRound: 9,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      pairings: [
        {
          _id: "pairing1",
          _creationTime: 1,
          externalId: "pairing:999:501:9001",
          externalTournamentId: 999,
          tournamentId: "tournament1",
          externalRoundId: 501,
          roundNumber: 9,
          externalMatchId: 9001,
          player1: player1._id,
          player2: player2._id,
          player1TournamentRecord: "7-1",
          player2TournamentRecord: "6-2",
          status: "UPCOMING",
          createdAt: 1,
        },
      ],
      players: [player1, player2],
      roundStandings: [
        {
          _id: "standings1",
          _creationTime: 1,
          externalRoundId: 401,
          externalTournamentId: 999,
          roundNumber: 8,
          standings: [
            makeStanding(1, 101, "Ada"),
            makeStanding(8, 108, "Ben"),
          ],
          updatedAt: 1,
        },
      ],
    });

    const overlay = {
      _id: "overlay1",
      _creationTime: 1,
      name: "Standings",
      overlayType: "standings",
      tournamentId: "tournament1",
      publicUuid: "overlay-public-id",
      showCurrentBracket: true,
      createdAt: 1,
    };

    const enriched = await enrichStandingsOverlay(ctx, overlay as never);

    expect(enriched.bracketDataWithPlayers).toEqual([
      expect.objectContaining({
        name: "Ada",
        rank: 1,
        seed: 1,
        playerData: expect.objectContaining({ deckName: "Dimir Tempo" }),
      }),
      expect.objectContaining({
        name: "Ben",
        rank: 8,
        seed: 8,
        playerData: expect.objectContaining({ deckName: "Jeskai Control" }),
      }),
    ]);
  });
});

function makeOverlayCtx(args: {
  externalTournament: Record<string, unknown>;
  tournaments: Record<string, unknown>[];
  pairings: Record<string, unknown>[];
  players: Record<string, unknown>[];
  roundStandings: Record<string, unknown>[];
}) {
  const rowsByTable = {
    tournaments: args.tournaments,
    externalTournaments: [args.externalTournament],
    pairings: args.pairings,
    players: args.players,
    roundStandings: args.roundStandings,
    playerStatuses: [],
    playerDecklists: [],
  };
  const rowsById = new Map(
    Object.values(rowsByTable)
      .flat()
      .map((row) => [row._id, row]),
  );

  return {
    db: {
      query(tableName: keyof typeof rowsByTable) {
        const rows = rowsByTable[tableName];
        if (!rows) {
          throw new Error(`Unexpected table ${tableName}`);
        }
        return makeQueryable(rows);
      },
      get(id: string) {
        return Promise.resolve(rowsById.get(id) ?? null);
      },
    },
  } as never;
}

function makeQueryable(rows: Record<string, unknown>[]) {
  return {
    withIndex(
      _indexName: string,
      buildQuery: (query: {
        eq: (field: string, value: unknown) => unknown;
      }) => unknown,
    ) {
      const clauses: Record<string, unknown> = {};
      const query = {
        eq(field: string, value: unknown) {
          clauses[field] = value;
          return query;
        },
      };
      buildQuery(query);
      return makeQueryResult(filterRows(rows, clauses));
    },
  };
}

function makeQueryResult(rows: Record<string, unknown>[]) {
  return {
    collect: () => Promise.resolve(rows),
    first: () => Promise.resolve(rows[0] ?? null),
    unique: () => Promise.resolve(rows[0] ?? null),
  };
}

function filterRows(
  rows: Record<string, unknown>[],
  clauses: Record<string, unknown>,
) {
  return rows.filter((row) =>
    Object.entries(clauses).every(([field, value]) => row[field] === value),
  );
}

function makePlayer(
  id: string,
  name: string,
  externalPlayerId: number,
  deckName: string,
) {
  return {
    _id: id,
    _creationTime: 1,
    name,
    externalPlayerId,
    externalTournamentId: 999,
    externalDecklistId: `deck-guid-${externalPlayerId}`,
    deckName,
    deckList: "4 Example Card",
    createdAt: 1,
    updatedAt: 1,
  };
}

function makeStanding(rank: number, externalPlayerId: number, name: string) {
  return {
    rank,
    externalPlayerId,
    name,
    record: "7-1",
    matchPoints: 21,
    wins: 7,
    losses: 1,
    draws: 0,
    gameWinPercentage: 0.7,
    opponentMatchWinPercentage: 0.6,
    opponentGameWinPercentage: 0.55,
  };
}
