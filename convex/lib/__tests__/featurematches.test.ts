import { describe, expect, it } from "vitest";

import { getFeatureMatchesWithPlayerData } from "../featurematches";

describe("getFeatureMatchesWithPlayerData", () => {
  it("uses the external round id when round numbers repeat", async () => {
    const ctx = makeFeatureMatchesCtx([
      makeFeatureMatch({
        id: "day1",
        externalId: "999-101-AdaVsBen",
        externalRoundId: 101,
        roundNumber: 1,
      }),
      makeFeatureMatch({
        id: "day2",
        externalId: "999-201-CoraVsDrew",
        externalRoundId: 201,
        roundNumber: 1,
      }),
    ]);

    const matches = await getFeatureMatchesWithPlayerData(ctx, {
      externalTournamentId: 999,
      externalRoundId: 201,
      roundNumber: 1,
    });

    expect(matches.map((match) => match._id)).toEqual(["day2"]);
  });

  it("returns all feature matches when no round filter is provided", async () => {
    const ctx = makeFeatureMatchesCtx([
      makeFeatureMatch({
        id: "day1",
        externalId: "999-101-AdaVsBen",
        externalRoundId: 101,
        roundNumber: 1,
      }),
      makeFeatureMatch({
        id: "day2",
        externalId: "999-201-CoraVsDrew",
        externalRoundId: 201,
        roundNumber: 1,
      }),
    ]);

    const matches = await getFeatureMatchesWithPlayerData(ctx, {
      externalTournamentId: 999,
    });

    expect(matches.map((match) => match._id)).toEqual(["day1", "day2"]);
  });
});

function makeFeatureMatchesCtx(featureMatches: Record<string, unknown>[]) {
  return {
    db: {
      query(tableName: string) {
        if (tableName === "featureMatches") {
          return makeQueryable(featureMatches);
        }
        if (tableName === "playerStatuses" || tableName === "playerDecklists") {
          return makeQueryable([]);
        }
        throw new Error(`Unexpected table ${tableName}`);
      },
      get(id: string) {
        return Promise.resolve({ _id: id, name: id });
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
      };
    },
  };
}

function makeFeatureMatch(args: {
  id: string;
  externalId: string;
  externalRoundId?: number;
  roundNumber: number;
}) {
  return {
    _id: args.id,
    _creationTime: 1,
    externalId: args.externalId,
    externalTournamentId: 999,
    externalRoundId: args.externalRoundId,
    roundNumber: args.roundNumber,
    player1: "player1",
    player2: "player2",
    player1TournamentRecord: "0-0",
    player2TournamentRecord: "0-0",
    createdAt: 1,
  };
}
