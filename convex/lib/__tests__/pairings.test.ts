import { describe, expect, it } from "vitest";

import { getCurrentRoundPairingsWithPlayerData } from "../pairings";

describe("getCurrentRoundPairingsWithPlayerData", () => {
  it("uses the Spicerack round id when round numbers repeat", async () => {
    const player1 = makePlayer("player1", "Ada");
    const player2 = makePlayer("player2", "Ben");
    const player3 = makePlayer("player3", "Cora");
    const player4 = makePlayer("player4", "Drew");
    const ctx = makePairingsCtx({
      pairings: [
        makePairing({
          id: "day1",
          tournamentId: "tournament1",
          spicerackRoundId: 101,
          roundNumber: 1,
          player1: player1._id,
          player2: player2._id,
        }),
        makePairing({
          id: "day2",
          tournamentId: "tournament1",
          spicerackRoundId: 201,
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
      { spicerackRoundId: 201, roundNumber: 1 },
    );

    expect(pairings.map((pairing) => pairing._id)).toEqual(["day2"]);
    expect(pairings[0].player1Data?.name).toBe("Cora");
  });
});

function makePairingsCtx(args: {
  pairings: Record<string, unknown>[];
  players: { _id: string; name: string }[];
}) {
  const playersById = new Map(args.players.map((player) => [player._id, player]));
  return {
    db: {
      query(tableName: string) {
        if (tableName !== "pairings") {
          throw new Error(`Unexpected table ${tableName}`);
        }
        return makeQueryable(args.pairings);
      },
      get(id: string) {
        return Promise.resolve(playersById.get(id));
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
      };
    },
  };
}

function makePlayer(id: string, name: string) {
  return {
    _id: id,
    name,
  };
}

function makePairing(args: {
  id: string;
  tournamentId: string;
  spicerackRoundId: number;
  roundNumber: number;
  player1: string;
  player2: string;
}) {
  return {
    _id: args.id,
    _creationTime: 1,
    externalId: `pairing:999:${args.spicerackRoundId}:${args.id}`,
    spicerackTournamentId: 999,
    tournamentId: args.tournamentId,
    spicerackRoundId: args.spicerackRoundId,
    roundNumber: args.roundNumber,
    spicerackMatchId: args.spicerackRoundId * 10,
    player1: args.player1,
    player2: args.player2,
    player1TournamentRecord: "0-0",
    player2TournamentRecord: "0-0",
    status: "UPCOMING",
    createdAt: 1,
  };
}
