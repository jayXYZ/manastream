import { describe, expect, it } from "vitest";

import {
  capturablePairingMatchIds,
  getCurrentRoundPairingsWithPlayerData,
  roundHasUncapturedPairings,
  snapshotCurrentRoundPairings,
} from "../pairings";

describe("getCurrentRoundPairingsWithPlayerData", () => {
  it("uses the external round id when round numbers repeat", async () => {
    const player1 = makePlayer("player1", "Ada");
    const player2 = makePlayer("player2", "Ben");
    const player3 = makePlayer("player3", "Cora");
    const player4 = makePlayer("player4", "Drew");
    const ctx = makePairingsCtx({
      pairings: [
        makePairing({
          id: "day1",
          tournamentId: "tournament1",
          externalRoundId: 101,
          roundNumber: 1,
          player1: player1._id,
          player2: player2._id,
        }),
        makePairing({
          id: "day2",
          tournamentId: "tournament1",
          externalRoundId: 201,
          roundNumber: 1,
          player1: player3._id,
          player2: player4._id,
        }),
      ],
      players: [player1, player2, player3, player4],
    });

    const pairings = await getCurrentRoundPairingsWithPlayerData(
      ctx,
      "tournament1" as never,
      { externalRoundId: 201, roundNumber: 1 },
    );

    expect(pairings.map((pairing) => pairing._id)).toEqual(["day2"]);
    expect(pairings[0].player1Data?.name).toBe("Cora");
  });
});

describe("snapshotCurrentRoundPairings", () => {
  it("stores seeds and seed records for newly paired elimination rounds", async () => {
    const player1 = makePlayer("player1", "Ada", 101);
    const player2 = makePlayer("player2", "Ben", 108);
    const insertedPairings: Record<string, unknown>[] = [];
    const ctx = makeSnapshotCtx({
      insertedPairings,
      players: [player1, player2],
    });

    await snapshotCurrentRoundPairings(ctx, {
      tournamentId: "tournament1" as never,
      externalTournamentId: 999,
      snapshot: makeEliminationSnapshot(),
    });

    expect(insertedPairings).toHaveLength(1);
    expect(insertedPairings[0]).toMatchObject({
      player1: "player1",
      player2: "player2",
      player1Seed: 1,
      player2Seed: 8,
      player1TournamentRecord: "#1",
      player2TournamentRecord: "#8",
    });
  });
});

describe("capturablePairingMatchIds", () => {
  it("lists the matches a snapshot would store, skipping byes", () => {
    const snapshot = makeEliminationSnapshot();
    snapshot.matches.push({
      externalMatchId: "bye-guid",
      tableNumber: undefined,
      isFeatureMatch: false,
      hasResult: true,
      competitors: [makeCompetitor(103, "Cora", 3)],
    });
    expect(capturablePairingMatchIds(snapshot)).toEqual(["match-guid-9001"]);
  });
});

describe("roundHasUncapturedPairings", () => {
  const stored = [
    makePairing({
      id: "day1",
      tournamentId: "tournament1",
      externalRoundId: 101,
      roundNumber: 1,
      player1: "player1",
      player2: "player2",
    }),
  ];

  it("is false while every match of the round has a pairing row", async () => {
    const ctx = makePairingsCtx({ pairings: stored, players: [] });
    expect(
      await roundHasUncapturedPairings(ctx, {
        externalTournamentId: 999,
        externalRoundId: 101,
        externalMatchIds: ["day1"],
      }),
    ).toBe(false);
    expect(
      await roundHasUncapturedPairings(ctx, {
        externalTournamentId: 999,
        externalRoundId: 101,
        externalMatchIds: [],
      }),
    ).toBe(false);
  });

  it("is true once Melee posts a match the round snapshot did not have", async () => {
    const ctx = makePairingsCtx({ pairings: stored, players: [] });
    expect(
      await roundHasUncapturedPairings(ctx, {
        externalTournamentId: 999,
        externalRoundId: 101,
        externalMatchIds: ["day1", "late-table"],
      }),
    ).toBe(true);
  });
});

function makePairingsCtx(args: {
  pairings: Record<string, unknown>[];
  players: { _id: string; name: string; externalPlayerId?: number }[];
}) {
  const playersById = new Map(args.players.map((player) => [player._id, player]));
  return {
    db: {
      query(tableName: string) {
        if (tableName === "pairings") {
          return makeQueryable(args.pairings);
        }
        if (tableName === "playerStatuses" || tableName === "playerDecklists") {
          return makeQueryable([]);
        }
        throw new Error(`Unexpected table ${tableName}`);
      },
      get(id: string) {
        return Promise.resolve(playersById.get(id));
      },
    },
  } as never;
}

function makeSnapshotCtx(args: {
  insertedPairings: Record<string, unknown>[];
  players: { _id: string; name: string; externalPlayerId?: number }[];
}) {
  return {
    db: {
      query(tableName: string) {
        if (tableName === "pairings") {
          return makeQueryable([]);
        }
        if (tableName === "players") {
          return makeQueryable(args.players);
        }
        if (tableName === "playerStatuses" || tableName === "playerDecklists") {
          return makeQueryable([]);
        }
        throw new Error(`Unexpected table ${tableName}`);
      },
      insert(tableName: string, value: Record<string, unknown>) {
        if (tableName !== "pairings") {
          throw new Error(`Unexpected insert into ${tableName}`);
        }
        args.insertedPairings.push(value);
        return Promise.resolve("pairing1");
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
      return {
        collect: () =>
          Promise.resolve(
            rows.filter((row) =>
              Object.entries(clauses).every(
                ([field, value]) => row[field] === value,
              ),
            ),
          ),
        unique: () =>
          Promise.resolve(
            rows.filter((row) =>
              Object.entries(clauses).every(
                ([field, value]) => row[field] === value,
              ),
            )[0] ?? null,
          ),
        first: () =>
          Promise.resolve(
            rows.filter((row) =>
              Object.entries(clauses).every(
                ([field, value]) => row[field] === value,
              ),
            )[0] ?? null,
          ),
      };
    },
  };
}

function makePlayer(id: string, name: string, externalPlayerId?: number) {
  return {
    _id: id,
    name,
    externalPlayerId,
    externalTournamentId: 999,
  };
}

function makePairing(args: {
  id: string;
  tournamentId: string;
  externalRoundId: number;
  roundNumber: number;
  player1: string;
  player2: string;
}) {
  return {
    _id: args.id,
    _creationTime: 1,
    externalId: `pairing:999:${args.externalRoundId}:${args.id}`,
    externalTournamentId: 999,
    tournamentId: args.tournamentId,
    externalRoundId: args.externalRoundId,
    roundNumber: args.roundNumber,
    externalMatchId: args.externalRoundId * 10,
    player1: args.player1,
    player2: args.player2,
    player1TournamentRecord: "0-0",
    player2TournamentRecord: "0-0",
    status: "UPCOMING",
    createdAt: 1,
  };
}

function makeEliminationSnapshot() {
  return {
    externalTournamentId: 999,
    roundId: 501,
    roundNumber: 8,
    roundDisplayName: "Quarterfinals",
    isEliminationRound: true,
    matches: [
      {
        externalMatchId: "match-guid-9001",
        tableNumber: 1 as number | undefined,
        isFeatureMatch: false,
        hasResult: false,
        competitors: [
          makeCompetitor(101, "Ada", 1),
          makeCompetitor(108, "Ben", 8),
        ],
      },
    ],
  };
}

function makeCompetitor(id: number, name: string, seed: number) {
  return {
    externalPlayerId: id,
    name,
    externalDecklistId: `decklist-guid-${id}`,
    tournamentRecord: `#${seed}`,
    matchPoints: 21,
    seed,
  };
}
