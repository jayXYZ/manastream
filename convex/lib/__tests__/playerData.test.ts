import { describe, expect, it } from "vitest";

import {
  composePlayerData,
  getDeprecatedPlayerDataFieldCleanupPatch,
  getMissingDecklistRowsForTournament,
  getSpicerackPlayerIdsFromStatusRows,
  getChangedRegistrationStatuses,
  isMissingDecklistData,
  syncPlayerRegistrationStatuses,
} from "../playerData";

describe("composePlayerData", () => {
  it("prefers split status and decklist rows over deprecated player fields", () => {
    const player = {
      _id: "player1",
      _creationTime: 1,
      name: "Ada",
      spicerackPlayerId: 101,
      spicerackTournamentId: 999,
      registrationStatus: "REGISTERED",
      deckId: 11,
      decklistStatus: "pending",
      deckName: "Legacy Deck",
      deckList: "legacy list",
      updatedAt: 1,
    };

    const composed = composePlayerData(
      player as never,
      {
        _id: "status1",
        _creationTime: 1,
        playerId: "player1",
        spicerackTournamentId: 999,
        spicerackPlayerId: 101,
        registrationStatus: "ELIMINATED",
        updatedAt: 2,
      } as never,
      {
        _id: "deck1",
        _creationTime: 1,
        playerId: "player1",
        spicerackTournamentId: 999,
        spicerackPlayerId: 101,
        deckId: 22,
        decklistStatus: "ready",
        deckName: "Split Deck",
        deckList: "4 Lightning Bolt",
        updatedAt: 2,
      } as never,
    );

    expect(composed).toMatchObject({
      name: "Ada",
      spicerackPlayerId: 101,
      registrationStatus: "ELIMINATED",
      deckId: 22,
      decklistStatus: "ready",
      deckName: "Split Deck",
      deckList: "4 Lightning Bolt",
    });
  });

  it("does not fall back to deprecated player fields when split rows are missing", () => {
    const player = {
      _id: "player1",
      _creationTime: 1,
      name: "Ada",
      spicerackPlayerId: 101,
      spicerackTournamentId: 999,
      registrationStatus: "REGISTERED",
      deckId: 11,
      decklistStatus: "ready",
      deckName: "Legacy Deck",
      deckList: "legacy list",
      updatedAt: 1,
    };

    const composed = composePlayerData(player as never);

    expect(composed).toMatchObject({
      registrationStatus: undefined,
      deckId: -1,
      decklistStatus: undefined,
      deckName: "MISSING_DECKLIST",
      deckList: "MISSING_DECKLIST",
    });
  });
});

describe("syncPlayerRegistrationStatuses", () => {
  it("point-looks up status rows and skips unchanged or missing rows", async () => {
    const ctx = makePlayerDataCtx({
      playerStatuses: [
        makeStatusRow("status1", "player1", 999, 101, "REGISTERED"),
        makeStatusRow("status2", "player2", 999, 102, "REGISTERED"),
      ],
    });

    await syncPlayerRegistrationStatuses(ctx as never, {
      spicerackTournamentId: 999,
      players: [
        { spicerackPlayerId: 101, registrationStatus: "REGISTERED" },
        { spicerackPlayerId: 102, registrationStatus: "DROPPED" },
        { spicerackPlayerId: 103, registrationStatus: "REGISTERED" },
      ],
    });

    expect(ctx.queries).toEqual([
      {
        tableName: "playerStatuses",
        indexName: "by_spicerack_tournament_id_and_spicerack_player_id",
        clauses: { spicerackTournamentId: 999, spicerackPlayerId: 101 },
        terminal: "unique",
      },
      {
        tableName: "playerStatuses",
        indexName: "by_spicerack_tournament_id_and_spicerack_player_id",
        clauses: { spicerackTournamentId: 999, spicerackPlayerId: 102 },
        terminal: "unique",
      },
      {
        tableName: "playerStatuses",
        indexName: "by_spicerack_tournament_id_and_spicerack_player_id",
        clauses: { spicerackTournamentId: 999, spicerackPlayerId: 103 },
        terminal: "unique",
      },
    ]);
    expect(ctx.patches).toEqual([
      {
        id: "status2",
        patch: { registrationStatus: "DROPPED", updatedAt: expect.any(Number) },
      },
    ]);
  });
});

describe("getSpicerackPlayerIdsFromStatusRows", () => {
  it("reads only playerStatuses for the tournament", async () => {
    const ctx = makePlayerDataCtx({
      playerStatuses: [
        makeStatusRow("status1", "player1", 999, 101, "REGISTERED"),
        makeStatusRow("status2", "player2", 999, 102, "REGISTERED"),
      ],
      failOnPlayersQuery: true,
    });

    await expect(
      getSpicerackPlayerIdsFromStatusRows(ctx as never, 999),
    ).resolves.toEqual([101, 102]);
    expect(ctx.queries).toEqual([
      {
        tableName: "playerStatuses",
        indexName: "by_spicerack_tournament_id",
        clauses: { spicerackTournamentId: 999 },
        terminal: "collect",
      },
    ]);
  });
});

describe("getMissingDecklistRowsForTournament", () => {
  it("reads only missing and fetch_failed playerDecklists", async () => {
    const ctx = makePlayerDataCtx({
      playerDecklists: [
        makeDecklistRow("deck1", "player1", 999, 101, 11, "missing"),
        makeDecklistRow("deck2", "player2", 999, 102, 12, "ready"),
        makeDecklistRow("deck3", "player3", 999, 103, 13, "fetch_failed"),
      ],
      failOnPlayersQuery: true,
    });

    await expect(
      getMissingDecklistRowsForTournament(ctx as never, 999),
    ).resolves.toEqual([
      {
        playerId: "player1",
        spicerackPlayerId: 101,
        deckId: 11,
        decklistStatus: "missing",
      },
      {
        playerId: "player3",
        spicerackPlayerId: 103,
        deckId: 13,
        decklistStatus: "fetch_failed",
      },
    ]);
    expect(ctx.queries).toEqual([
      {
        tableName: "playerDecklists",
        indexName: "by_spicerack_tournament_id_and_decklist_status",
        clauses: { spicerackTournamentId: 999, decklistStatus: "missing" },
        terminal: "collect",
      },
      {
        tableName: "playerDecklists",
        indexName: "by_spicerack_tournament_id_and_decklist_status",
        clauses: { spicerackTournamentId: 999, decklistStatus: "fetch_failed" },
        terminal: "collect",
      },
    ]);
  });
});

describe("getChangedRegistrationStatuses", () => {
  it("returns only statuses that changed", () => {
    const changed = getChangedRegistrationStatuses(
      [
        { spicerackPlayerId: 101, registrationStatus: "REGISTERED" },
        { spicerackPlayerId: 102, registrationStatus: "ELIMINATED" },
        { spicerackPlayerId: 103, registrationStatus: "DROPPED" },
      ],
      new Map([
        [101, { currentStatus: "REGISTERED", targetId: "status1" }],
        [102, { currentStatus: "REGISTERED", targetId: "status2" }],
      ]),
    );

    expect(changed).toEqual([
      {
        spicerackPlayerId: 102,
        registrationStatus: "ELIMINATED",
        targetId: "status2",
      },
    ]);
  });
});

describe("getDeprecatedPlayerDataFieldCleanupPatch", () => {
  it("clears only deprecated split-data fields that are present", () => {
    expect(
      getDeprecatedPlayerDataFieldCleanupPatch({
        registrationStatus: "REGISTERED",
        deckId: 11,
        deckName: "Legacy Deck",
        deckList: undefined,
      }),
    ).toEqual({
      registrationStatus: undefined,
      deckId: undefined,
      deckName: undefined,
    });
  });

  it("returns an empty patch when no deprecated split-data fields are present", () => {
    expect(
      getDeprecatedPlayerDataFieldCleanupPatch({
        registrationStatus: undefined,
        deckId: undefined,
        decklistStatus: undefined,
        deckName: undefined,
        deckList: undefined,
      }),
    ).toEqual({});
  });
});

describe("isMissingDecklistData", () => {
  it("treats missing and fetch_failed rows as needing a refetch", () => {
    expect(isMissingDecklistData({ decklistStatus: "missing" })).toBe(true);
    expect(isMissingDecklistData({ decklistStatus: "fetch_failed" })).toBe(true);
    expect(isMissingDecklistData({ decklistStatus: "ready" })).toBe(false);
  });

  it("does not treat legacy deck sentinels as missing without a split-row status", () => {
    expect(
      isMissingDecklistData({
        deckName: "MISSING_DECKLIST",
        deckList: "MISSING_DECKLIST",
      }),
    ).toBe(false);
    expect(
      isMissingDecklistData({ deckName: "Unknown", deckList: "Unknown" }),
    ).toBe(false);
  });
});

function makePlayerDataCtx(args: {
  playerStatuses?: Record<string, unknown>[];
  playerDecklists?: Record<string, unknown>[];
  failOnPlayersQuery?: boolean;
}) {
  const queries: {
    tableName: string;
    indexName: string;
    clauses: Record<string, unknown>;
    terminal: string;
  }[] = [];
  const patches: { id: string; patch: Record<string, unknown> }[] = [];
  return {
    queries,
    patches,
    db: {
      query(tableName: string) {
        if (args.failOnPlayersQuery && tableName === "players") {
          throw new Error("players table should not be queried");
        }
        if (tableName === "playerStatuses") {
          return makeQueryable(tableName, args.playerStatuses ?? [], queries);
        }
        if (tableName === "playerDecklists") {
          return makeQueryable(tableName, args.playerDecklists ?? [], queries);
        }
        throw new Error(`Unexpected table ${tableName}`);
      },
      patch(id: string, patch: Record<string, unknown>) {
        patches.push({ id, patch });
        return Promise.resolve();
      },
    },
  };
}

function makeQueryable(
  tableName: string,
  rows: Record<string, unknown>[],
  queries: {
    tableName: string;
    indexName: string;
    clauses: Record<string, unknown>;
    terminal: string;
  }[],
) {
  return {
    withIndex(
      indexName: string,
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
      const matches = () =>
        rows.filter((row) =>
          Object.entries(clauses).every(([field, value]) => row[field] === value),
        );
      return {
        collect: () => {
          queries.push({ tableName, indexName, clauses, terminal: "collect" });
          return Promise.resolve(matches());
        },
        unique: () => {
          queries.push({ tableName, indexName, clauses, terminal: "unique" });
          return Promise.resolve(matches()[0] ?? null);
        },
      };
    },
  };
}

function makeStatusRow(
  id: string,
  playerId: string,
  spicerackTournamentId: number,
  spicerackPlayerId: number,
  registrationStatus: string,
) {
  return {
    _id: id,
    _creationTime: 1,
    playerId,
    spicerackTournamentId,
    spicerackPlayerId,
    registrationStatus,
    updatedAt: 1,
  };
}

function makeDecklistRow(
  id: string,
  playerId: string,
  spicerackTournamentId: number,
  spicerackPlayerId: number,
  deckId: number,
  decklistStatus: string,
) {
  return {
    _id: id,
    _creationTime: 1,
    playerId,
    spicerackTournamentId,
    spicerackPlayerId,
    deckId,
    decklistStatus,
    deckName: "Deck",
    deckList: "4 Lightning Bolt",
    updatedAt: 1,
  };
}
