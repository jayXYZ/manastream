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
          standings: [makeStanding(1, 101, "Ada"), makeStanding(8, 108, "Ben")],
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

  it("looks up only the bracket's own players when no standings are selected", async () => {
    const player1 = makePlayer("player1", "Ada", 101, "Dimir Tempo");
    const player2 = makePlayer("player2", "Ben", 108, "Jeskai Control");
    // Entrants who fell short of the top 8: a bracket must not read them.
    const fieldPlayers = Array.from({ length: 30 }, (_, index) =>
      makePlayer(`field${index}`, `Field ${index}`, 200 + index, "Mono Red"),
    );
    const scans: IndexScan[] = [];
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
          player1Seed: 1,
          player2Seed: 8,
          player1TournamentRecord: "#1",
          player2TournamentRecord: "#8",
          status: "UPCOMING",
          createdAt: 1,
        },
      ],
      players: [player1, player2, ...fieldPlayers],
      roundStandings: [],
      scans,
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

    expect(enriched.standingsDataWithPlayers).toBeUndefined();
    expect(
      enriched.bracketDataWithPlayers?.map((player) => player.name),
    ).toEqual(["Ada", "Ben"]);
    // Player data came from per-player lookups, never a tournament-wide
    // scan of players, statuses or decklists.
    const tournamentWideScans = scans.filter(
      (scan) =>
        ["players", "playerStatuses", "playerDecklists"].includes(scan.table) &&
        scan.index === "by_external_tournament_id",
    );
    expect(tournamentWideScans).toEqual([]);
  });
});

describe("enrichStandingsOverlay bracket stages", () => {
  // Seeds 1-8 by player id; the cut plays out 1-8, 4-5, 2-7, 3-6, then
  // 1 beats 4 and 2 beats 3, and 2 wins the final.
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
  const players = seeds.map((seed) =>
    makePlayer(`p${seed}`, `Seed ${seed}`, 100 + seed, `Deck ${seed}`),
  );
  const pairing = (
    id: string,
    externalRoundId: number,
    roundNumber: number,
    top: number,
    bottom: number,
    winner?: number,
    gameWins?: [number, number],
  ) => ({
    _id: id,
    _creationTime: 1,
    externalId: `pairing:999:${externalRoundId}:${id}`,
    externalTournamentId: 999,
    tournamentId: "tournament1",
    externalRoundId,
    roundNumber,
    externalMatchId: id,
    player1: `p${top}`,
    player2: `p${bottom}`,
    player1Seed: top,
    player2Seed: bottom,
    player1TournamentRecord: `#${top}`,
    player2TournamentRecord: `#${bottom}`,
    status: winner ? "COMPLETE" : "IN_PROGRESS",
    winnerPlayerId: winner ? `p${winner}` : undefined,
    player1GameWins: gameWins?.[0],
    player2GameWins: gameWins?.[1],
    createdAt: 1,
  });
  const pairings = [
    pairing("qf1", 501, 9, 1, 8, 1, [2, 1]),
    pairing("qf2", 501, 9, 4, 5, 4),
    pairing("qf3", 501, 9, 2, 7, 2),
    pairing("qf4", 501, 9, 3, 6, 3),
    pairing("sf1", 502, 10, 1, 4, 1),
    pairing("sf2", 502, 10, 2, 3, 2),
    pairing("f1", 503, 11, 1, 2, 2, [0, 2]),
  ];
  const tournaments = [
    {
      _id: "tournament1",
      _creationTime: 1,
      userId: "user1",
      mode: "manual",
      externalTournamentId: 999,
      createdAt: 1,
      updatedAt: 1,
    },
  ];
  const finishedTournament = {
    _id: "externalTournament1",
    _creationTime: 1,
    externalTournamentId: 999,
    currentRoundId: 503,
    currentRoundNumber: 11,
    currentRoundName: "Finals",
    completedRounds: [
      { roundId: 401, roundName: "Round 8" },
      { roundId: 501, roundName: "Quarterfinals" },
      { roundId: 502, roundName: "Semifinals" },
      { roundId: 503, roundName: "Finals" },
    ],
  };
  const overlay = (fields: Record<string, unknown>) =>
    ({
      _id: "overlay1",
      _creationTime: 1,
      name: "Standings",
      overlayType: "standings",
      tournamentId: "tournament1",
      publicUuid: "overlay-public-id",
      createdAt: 1,
      ...fields,
    }) as never;
  const ctx = () =>
    makeOverlayCtx({
      externalTournament: finishedTournament,
      tournaments,
      pairings,
      players,
      roundStandings: [],
    });

  it("shows the bracket going into a completed elimination round", async () => {
    const enriched = await enrichStandingsOverlay(
      ctx(),
      overlay({ externalRoundId: 502 }),
    );
    expect(enriched.isEliminationPhase).toBe(true);
    expect(enriched.roundDisplayName).toBe("Semifinals");
    expect(enriched.bracketDataWithPlayers?.map((p) => p.seed)).toEqual(seeds);
    expect(enriched.bracketMatches).toEqual({
      quarterfinals: [
        { seeds: [1, 8], winnerSeed: 1, gameWins: [2, 1] },
        { seeds: [4, 5], winnerSeed: 4 },
        { seeds: [2, 7], winnerSeed: 2 },
        { seeds: [3, 6], winnerSeed: 3 },
      ],
      semifinals: [
        { seeds: [1, 4], winnerSeed: undefined },
        { seeds: [2, 3], winnerSeed: undefined },
      ],
      finals: [],
      championSeed: undefined,
    });
    expect(enriched.standingsDataWithPlayers).toBeUndefined();
  });

  it("the finals selection shows the finalists but not the result", async () => {
    const enriched = await enrichStandingsOverlay(
      ctx(),
      overlay({ externalRoundId: 503 }),
    );
    expect(enriched.roundDisplayName).toBe("Finals");
    expect(enriched.bracketMatches?.semifinals).toEqual([
      { seeds: [1, 4], winnerSeed: 1 },
      { seeds: [2, 3], winnerSeed: 2 },
    ]);
    expect(enriched.bracketMatches?.finals).toEqual([
      { seeds: [1, 2], winnerSeed: undefined },
    ]);
    expect(enriched.bracketMatches?.finals[0].gameWins).toBeUndefined();
    expect(enriched.bracketMatches?.championSeed).toBeUndefined();
  });

  it("the completed bracket names the champion from the reported result", async () => {
    const enriched = await enrichStandingsOverlay(
      ctx(),
      overlay({ showCompletedBracket: true, externalRoundId: 401 }),
    );
    expect(enriched.roundDisplayName).toBe("Final Results");
    expect(enriched.bracketMatches?.finals).toEqual([
      { seeds: [1, 2], winnerSeed: 2, gameWins: [0, 2] },
    ]);
    expect(enriched.bracketMatches?.championSeed).toBe(2);
  });

  it("the current bracket during the finals matches the finals selection", async () => {
    const enriched = await enrichStandingsOverlay(
      ctx(),
      overlay({ showCurrentBracket: true }),
    );
    expect(enriched.roundDisplayName).toBe("Finals");
    expect(enriched.bracketMatches?.championSeed).toBeUndefined();
    expect(enriched.bracketMatches?.finals).toEqual([
      { seeds: [1, 2], winnerSeed: undefined },
    ]);
  });

  it("a Swiss round selection still resolves to the standings table", async () => {
    const enriched = await enrichStandingsOverlay(
      ctx(),
      overlay({ externalRoundId: 401 }),
    );
    expect(enriched.isEliminationPhase).toBe(false);
    expect(enriched.bracketMatches).toBeUndefined();
  });

  it("reads stored round-name variants and seeds from the final Swiss round", async () => {
    const enriched = await enrichStandingsOverlay(
      makeOverlayCtx({
        externalTournament: {
          ...finishedTournament,
          currentRoundName: "Final",
          completedRounds: [
            { roundId: 401, roundName: "Round 8" },
            { roundId: 501, roundName: "Quarter Finals" },
            { roundId: 502, roundName: "Semi-Finals" },
            { roundId: 503, roundName: "Final" },
          ],
        },
        tournaments,
        pairings: pairings.map((pair) => ({
          ...pair,
          player1Seed: undefined,
          player2Seed: undefined,
          player1TournamentRecord: "7-1",
          player2TournamentRecord: "6-2",
        })),
        players,
        roundStandings: [
          {
            _id: "swiss",
            externalRoundId: 401,
            externalTournamentId: 999,
            standings: seeds.map((seed) =>
              makeStanding(seed, 100 + seed, `Seed ${seed}`),
            ),
          },
        ],
      }),
      overlay({ showCompletedBracket: true }),
    );
    expect(enriched.isEliminationPhase).toBe(true);
    expect(enriched.bracketDataWithPlayers?.map((p) => p.seed)).toEqual(seeds);
    expect(enriched.bracketMatches?.quarterfinals).toHaveLength(4);
    expect(enriched.bracketMatches?.semifinals).toHaveLength(2);
    expect(enriched.bracketMatches?.finals).toEqual([
      { seeds: [1, 2], winnerSeed: 2, gameWins: [0, 2] },
    ]);
    expect(enriched.bracketMatches?.championSeed).toBe(2);
  });

  it("does not classify a partially captured quarterfinal as a later round", async () => {
    const enriched = await enrichStandingsOverlay(
      makeOverlayCtx({
        externalTournament: {
          ...finishedTournament,
          currentRoundId: 501,
          currentRoundName: "Quarter Finals",
          completedRounds: [{ roundId: 401, roundName: "Round 8" }],
        },
        tournaments,
        pairings: [pairings[0]],
        players,
        roundStandings: [],
      }),
      overlay({ showCurrentBracket: true }),
    );
    expect(enriched.isEliminationPhase).toBe(true);
    expect(enriched.bracketMatches?.quarterfinals).toHaveLength(1);
    expect(enriched.bracketMatches?.semifinals).toEqual([]);
    expect(enriched.bracketMatches?.finals).toEqual([]);
  });
});

type IndexScan = { table: string; index: string };

function makeOverlayCtx(args: {
  externalTournament: Record<string, unknown>;
  tournaments: Record<string, unknown>[];
  pairings: Record<string, unknown>[];
  players: Record<string, unknown>[];
  roundStandings: Record<string, unknown>[];
  scans?: IndexScan[];
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
        return makeQueryable(rows, (index) =>
          args.scans?.push({ table: tableName, index }),
        );
      },
      get(id: string) {
        return Promise.resolve(rowsById.get(id) ?? null);
      },
    },
  } as never;
}

function makeQueryable(
  rows: Record<string, unknown>[],
  onScan: (indexName: string) => void,
) {
  return {
    withIndex(
      indexName: string,
      buildQuery: (query: {
        eq: (field: string, value: unknown) => unknown;
      }) => unknown,
    ) {
      onScan(indexName);
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
