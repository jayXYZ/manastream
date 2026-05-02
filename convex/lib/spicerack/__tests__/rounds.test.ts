import { describe, expect, it } from "vitest";

import { checkForNewSpicerackRound } from "../rounds";
import type {
  SpicerackEventResponse,
  SpicerackMatch,
  SpicerackRound,
} from "../../../types/spicerack";

describe("checkForNewSpicerackRound", () => {
  it("snapshots pairings when the current round later gains matches", async () => {
    const ctx = makeRoundCtx({
      tournament: {
        _id: "tournament1",
        userId: "user1",
        spicerackTournamentId: 999,
      },
      spicerackTournament: {
        _id: "spicerackTournament1",
        spicerackTournamentId: 999,
        currentRoundId: 201,
        currentRoundNumber: 2,
      },
      players: [
        { _id: "player1", spicerackPlayerId: 11 },
        { _id: "player2", spicerackPlayerId: 22 },
      ],
    });

    await checkForNewSpicerackRound(
      ctx as never,
      "tournament1" as never,
      makeEvent({
        roundId: 201,
        roundNumber: 2,
        matches: [makeMatch({ id: 501 })],
      }),
    );

    expect(ctx.inserted.pairings).toHaveLength(1);
    expect(ctx.inserted.pairings[0]).toMatchObject({
      externalId: "pairing:999:201:501",
      tournamentId: "tournament1",
      spicerackRoundId: 201,
      roundNumber: 2,
      player1: "player1",
      player2: "player2",
    });
    expect(ctx.patches).toEqual([]);
  });

  it("refreshes stale completed rounds when the current round is unchanged", async () => {
    const ctx = makeRoundCtx({
      tournament: {
        _id: "tournament1",
        userId: "user1",
        spicerackTournamentId: 999,
      },
      spicerackTournament: {
        _id: "spicerackTournament1",
        spicerackTournamentId: 999,
        currentRoundId: 201,
        currentRoundNumber: 1,
        completedRounds: [],
      },
      players: [
        { _id: "player1", spicerackPlayerId: 11 },
        { _id: "player2", spicerackPlayerId: 22 },
      ],
    });

    await checkForNewSpicerackRound(
      ctx as never,
      "tournament1" as never,
      makeMultiPhaseEvent(),
    );

    expect(ctx.patches).toEqual([
      {
        id: "spicerackTournament1",
        value: {
          completedRounds: [{ roundId: 101, roundName: "Round 1" }],
        },
      },
    ]);
  });
});

function makeRoundCtx(args: {
  tournament: Record<string, unknown>;
  spicerackTournament: Record<string, unknown>;
  players: Record<string, unknown>[];
}) {
  const inserted: Record<string, Record<string, unknown>[]> = {
    pairings: [],
    players: [],
  };
  const patches: { id: string; value: Record<string, unknown> }[] = [];

  return {
    inserted,
    patches,
    db: {
      get(id: string) {
        if (id === args.tournament._id) {
          return Promise.resolve(args.tournament);
        }
        return Promise.resolve(null);
      },
      query(tableName: string) {
        if (tableName === "spicerackTournaments") {
          return makeQueryable([args.spicerackTournament]);
        }
        if (tableName === "pairings") {
          return makeQueryable(inserted.pairings);
        }
        if (tableName === "players") {
          return makeQueryable(args.players);
        }
        throw new Error(`Unexpected table ${tableName}`);
      },
      insert(tableName: string, value: Record<string, unknown>) {
        if (!inserted[tableName]) {
          inserted[tableName] = [];
        }
        inserted[tableName].push(value);
        return Promise.resolve(`${tableName}${inserted[tableName].length}`);
      },
      patch(id: string, value: Record<string, unknown>) {
        patches.push({ id, value });
        return Promise.resolve();
      },
    },
  };
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
      const matchingRows = () =>
        rows.filter((row) =>
          Object.entries(clauses).every(([field, value]) => row[field] === value),
        );
      return {
        first: () => Promise.resolve(matchingRows()[0] ?? null),
        unique: () => Promise.resolve(matchingRows()[0] ?? null),
        collect: () => Promise.resolve(matchingRows()),
      };
    },
  };
}

function makeEvent(args: {
  roundId: number;
  roundNumber: number;
  matches: SpicerackMatch[];
}): SpicerackEventResponse {
  return {
    id: 999,
    name: "Test Event",
    event_format: "PREMODERN",
    start_datetime: "2026-04-26T00:00:00.000Z",
    settings: {
      id: 1,
      event_lifecycle_status: "IN_PROGRESS",
    },
    current_round_number: args.roundNumber,
    enrolled_player_count: 2,
    user_statuses: [],
    featured_matches: [],
    tournament_phases: [
      {
        id: 1,
        order_in_phases: 1,
        round_type: "SWISS",
        status: "IN_PROGRESS",
        rounds: [
          {
            id: args.roundId,
            round_number: args.roundNumber,
            status: "IN_PROGRESS",
            matches: args.matches,
          },
        ],
      },
    ],
  };
}

function makeMultiPhaseEvent(): SpicerackEventResponse {
  return {
    ...makeEvent({
      roundId: 201,
      roundNumber: 1,
      matches: [makeMatch({ id: 501 })],
    }),
    current_round_number: 1,
    tournament_phases: [
      {
        id: 1,
        order_in_phases: 0,
        round_type: "SWISS",
        status: "COMPLETE",
        rounds: [
          makeRound({
            id: 100,
            roundNumber: 0,
            status: "COMPLETE",
            matches: [makeMatch({ id: 1000 })],
          }),
          makeRound({
            id: 101,
            roundNumber: 1,
            status: "COMPLETE",
            matches: [makeMatch({ id: 1001 })],
          }),
        ],
      },
      {
        id: 2,
        order_in_phases: 1,
        round_type: "SWISS",
        status: "IN_PROGRESS",
        rounds: [
          makeRound({
            id: 201,
            roundNumber: 1,
            status: "IN_PROGRESS",
            matches: [makeMatch({ id: 501 })],
          }),
        ],
      },
    ],
  };
}

function makeRound(args: {
  id: number;
  roundNumber: number;
  status: string;
  matches: SpicerackMatch[];
}): SpicerackRound {
  return {
    id: args.id,
    round_number: args.roundNumber,
    status: args.status,
    matches: args.matches,
  };
}

function makeMatch(args: { id: number }): SpicerackMatch {
  return {
    id: args.id,
    is_feature_match: false,
    table_number: 3,
    status: "UPCOMING",
    player_match_relationships: [
      makePlayerMatchRelationship({
        id: 1,
        spicerackPlayerId: 11,
        name: "Ada",
        playerOrder: 0,
      }),
      makePlayerMatchRelationship({
        id: 2,
        spicerackPlayerId: 22,
        name: "Ben",
        playerOrder: 1,
      }),
    ],
  };
}

function makePlayerMatchRelationship(args: {
  id: number;
  spicerackPlayerId: number;
  name: string;
  playerOrder: number;
}): SpicerackMatch["player_match_relationships"][number] {
  return {
    id: args.id,
    games_won: -1,
    points_gained: -1,
    player_order: args.playerOrder,
    user_event_status: {
      id: args.spicerackPlayerId,
      user: {
        id: args.spicerackPlayerId,
        username: args.name,
        best_identifier: args.name,
      },
      decklist: -1,
      registration_status: "REGISTERED",
      final_place_in_standings: -1,
      matches_won: 1,
      matches_lost: 0,
      matches_drawn: 0,
      total_match_points: 3,
    },
  };
}
