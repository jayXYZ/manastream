import { describe, expect, it } from "vitest";

import {
  getCurrentRoundPairingsWithPlayerData,
  snapshotCurrentRoundPairings,
} from "../pairings";

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
      spicerackTournamentId: 999,
      jsonData: makeEliminationEvent(),
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

function makePairingsCtx(args: {
  pairings: Record<string, unknown>[];
  players: { _id: string; name: string; spicerackPlayerId?: number }[];
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
  players: { _id: string; name: string; spicerackPlayerId?: number }[];
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

function makePlayer(id: string, name: string, spicerackPlayerId?: number) {
  return {
    _id: id,
    name,
    spicerackPlayerId,
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

function makeEliminationEvent() {
  return {
    id: 999,
    name: "Test Event",
    event_format: "MODERN",
    start_datetime: "2026-05-02T12:00:00Z",
    settings: { id: 1, event_lifecycle_status: "IN_PROGRESS" },
    current_round_number: 8,
    enrolled_player_count: 64,
    user_statuses: [],
    featured_matches: [],
    tournament_phases: [
      {
        id: 1,
        order_in_phases: 1,
        round_type: "RANKED_SINGLE_ELIMINATION",
        status: "IN_PROGRESS",
        rounds: [
          {
            id: 501,
            round_number: 8,
            status: "UPCOMING",
            matches: [
              {
                id: 9001,
                is_feature_match: false,
                table_number: 1,
                status: "UPCOMING",
                player_match_relationships: [
                  makeRelationship(101, "Ada", 1, 0),
                  makeRelationship(108, "Ben", 8, 1),
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

function makeRelationship(
  id: number,
  name: string,
  seed: number,
  playerOrder: number,
) {
  return {
    id: id * 10,
    games_won: -1,
    points_gained: -1,
    player_order: playerOrder,
    user_event_status: {
      id,
      user: {
        id,
        username: name.toLowerCase(),
        best_identifier: name,
      },
      decklist: id + 1000,
      registration_status: "REGISTERED",
      final_place_in_standings: seed,
      matches_won: 7,
      matches_lost: 1,
      matches_drawn: 0,
      total_match_points: 21,
    },
  };
}
