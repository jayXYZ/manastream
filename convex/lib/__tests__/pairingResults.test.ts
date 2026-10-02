import { describe, expect, it } from "vitest";

import {
  recordPairingResults,
  reportedMatchResults,
  snapshotCurrentRoundPairings,
} from "../pairings";

describe("reportedMatchResults", () => {
  it("lists only matches with a reported winner", () => {
    expect(
      reportedMatchResults({
        externalTournamentId: 999,
        roundId: 503,
        roundNumber: 10,
        roundDisplayName: "Finals",
        isEliminationRound: true,
        matches: [
          makeMatch("final", { hasResult: true, winnerExternalPlayerId: 101 }),
          makeMatch("open", { hasResult: false }),
          makeMatch("unnamed", { hasResult: true }),
        ],
      }),
    ).toEqual([{ externalMatchId: "final", winnerExternalPlayerId: 101 }]);
  });
});

describe("snapshotCurrentRoundPairings", () => {
  it("stores the winner on a newly captured pairing", async () => {
    const inserted: Record<string, unknown>[] = [];
    const ctx = makeCtx({ pairings: [], inserted });
    await snapshotCurrentRoundPairings(ctx, {
      tournamentId: "tournament1" as never,
      externalTournamentId: 999,
      snapshot: {
        externalTournamentId: 999,
        roundId: 503,
        roundNumber: 10,
        roundDisplayName: "Finals",
        isEliminationRound: true,
        matches: [
          makeMatch("final", { hasResult: true, winnerExternalPlayerId: 108 }),
        ],
      },
    });
    expect(inserted).toHaveLength(1);
    expect(inserted[0].status).toBe("COMPLETE");
    expect(inserted[0].winnerPlayerId).toBe("player2");
  });

  it("records a result reported after the pairing was captured", async () => {
    const patches: { id: string; value: Record<string, unknown> }[] = [];
    const ctx = makeCtx({
      pairings: [makePairing("pairing1", "final", { status: "IN_PROGRESS" })],
      inserted: [],
      patches,
    });
    const snapshot = {
      externalTournamentId: 999,
      roundId: 503,
      roundNumber: 10,
      roundDisplayName: "Finals",
      isEliminationRound: true,
      matches: [
        makeMatch("final", { hasResult: true, winnerExternalPlayerId: 101 }),
      ],
    };
    await snapshotCurrentRoundPairings(ctx, {
      tournamentId: "tournament1" as never,
      externalTournamentId: 999,
      snapshot,
    });
    expect(patches).toEqual([
      { id: "pairing1", value: { status: "COMPLETE", winnerPlayerId: "player1" } },
    ]);

    // A second snapshot of the same result writes nothing.
    const settled = makeCtx({
      pairings: [
        makePairing("pairing1", "final", {
          status: "COMPLETE",
          winnerPlayerId: "player1",
        }),
      ],
      inserted: [],
      patches,
    });
    patches.length = 0;
    await snapshotCurrentRoundPairings(settled, {
      tournamentId: "tournament1" as never,
      externalTournamentId: 999,
      snapshot,
    });
    expect(patches).toEqual([]);
  });
});

describe("recordPairingResults", () => {
  it("patches captured pairings by Melee player id and skips the rest", async () => {
    const patches: { id: string; value: Record<string, unknown> }[] = [];
    const ctx = makeCtx({
      pairings: [
        makePairing("pairing1", "final", { status: "IN_PROGRESS" }),
        makePairing("pairing2", "done", {
          status: "COMPLETE",
          winnerPlayerId: "player2",
        }),
      ],
      inserted: [],
      patches,
    });
    const changed = await recordPairingResults(ctx, {
      externalTournamentId: 999,
      externalRoundId: 503,
      results: [
        { externalMatchId: "final", winnerExternalPlayerId: 108 },
        { externalMatchId: "done", winnerExternalPlayerId: 101 },
        { externalMatchId: "uncaptured", winnerExternalPlayerId: 101 },
        { externalMatchId: "stranger", winnerExternalPlayerId: 555 },
      ],
    });
    expect(changed).toBe(1);
    expect(patches).toEqual([
      { id: "pairing1", value: { status: "COMPLETE", winnerPlayerId: "player2" } },
    ]);
  });
});

const players = [
  { _id: "player1", name: "Ada", externalPlayerId: 101, externalTournamentId: 999 },
  { _id: "player2", name: "Ben", externalPlayerId: 108, externalTournamentId: 999 },
];

function makeMatch(
  externalMatchId: string,
  args: { hasResult: boolean; winnerExternalPlayerId?: number },
) {
  return {
    externalMatchId,
    tableNumber: 1 as number | undefined,
    isFeatureMatch: false,
    hasResult: args.hasResult,
    winnerExternalPlayerId: args.winnerExternalPlayerId,
    competitors: [
      {
        externalPlayerId: 101,
        name: "Ada",
        tournamentRecord: "#1",
        seed: 1,
      },
      {
        externalPlayerId: 108,
        name: "Ben",
        tournamentRecord: "#8",
        seed: 8,
      },
    ],
  };
}

function makePairing(
  id: string,
  externalMatchId: string,
  args: { status: string; winnerPlayerId?: string },
) {
  return {
    _id: id,
    _creationTime: 1,
    externalId: `pairing:999:503:${externalMatchId}`,
    externalTournamentId: 999,
    tournamentId: "tournament1",
    externalRoundId: 503,
    roundNumber: 10,
    externalMatchId,
    player1: "player1",
    player2: "player2",
    player1TournamentRecord: "#1",
    player2TournamentRecord: "#8",
    status: args.status,
    winnerPlayerId: args.winnerPlayerId,
    createdAt: 1,
  };
}

function makeCtx(args: {
  pairings: Record<string, unknown>[];
  inserted: Record<string, unknown>[];
  patches?: { id: string; value: Record<string, unknown> }[];
}) {
  const rowsById = new Map<string, Record<string, unknown>>(
    [...args.pairings, ...players].map((row) => [row._id as string, row]),
  );
  return {
    db: {
      query(tableName: string) {
        const rows =
          tableName === "pairings"
            ? args.pairings
            : tableName === "players"
              ? players
              : tableName === "playerStatuses" || tableName === "playerDecklists"
                ? []
                : undefined;
        if (!rows) {
          throw new Error(`Unexpected table ${tableName}`);
        }
        return makeQueryable(rows as Record<string, unknown>[]);
      },
      get(id: string) {
        return Promise.resolve(rowsById.get(id) ?? null);
      },
      insert(tableName: string, value: Record<string, unknown>) {
        if (tableName !== "pairings") {
          throw new Error(`Unexpected insert into ${tableName}`);
        }
        args.inserted.push(value);
        return Promise.resolve("inserted");
      },
      patch(id: string, value: Record<string, unknown>) {
        args.patches?.push({ id, value });
        return Promise.resolve();
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
      const matching = rows.filter((row) =>
        Object.entries(clauses).every(([field, value]) => row[field] === value),
      );
      return {
        collect: () => Promise.resolve(matching),
        first: () => Promise.resolve(matching[0] ?? null),
        unique: () => Promise.resolve(matching[0] ?? null),
      };
    },
  };
}
