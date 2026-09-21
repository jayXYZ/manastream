import { describe, expect, it } from "vitest";
import { Id } from "../../_generated/dataModel";
import {
  MeleeDecklistRecord,
  MeleeDecklistResponse,
  MeleePlayerListEntry,
} from "../../types/melee";
import {
  CachedPlayerForSync,
  DecklistUpdate,
  formatPlayerSyncSummary,
  planPlayerSync,
  playerRefreshDecision,
  selectFetchedDecklistUpdates,
  shouldApplyDecklistUpdate,
  summarizePlayerSync,
} from "../playerSync";

const TOURNAMENT_ID = 999;

function record(q: number, n: string, c = 0): MeleeDecklistRecord {
  return { l: n.toLowerCase(), n, s: null, q, c, t: "Creature" };
}

function makeDecklist(args: {
  guid: string;
  name?: string;
  records?: MeleeDecklistRecord[] | null;
}): MeleeDecklistResponse {
  return {
    Guid: args.guid,
    DecklistName: args.name ?? "Mono Red",
    Name: args.name ?? "Mono Red",
    FormatName: "Standard",
    ...(args.records === null ? {} : { Records: args.records ?? [] }),
  } as unknown as MeleeDecklistResponse;
}

function makeEntry(args: {
  id: number;
  name: string;
  decklist?: MeleeDecklistResponse;
  dropped?: boolean;
}): MeleePlayerListEntry {
  return {
    ID: args.id,
    DisplayName: args.name,
    PlayerName: args.name,
    Username: args.name.toLowerCase(),
    Decklists: args.decklist ? [args.decklist] : [],
    RoundDroppedId: args.dropped ? 3 : null,
    RoundDroppedNumber: args.dropped ? 3 : null,
    StatusDescription: "Registered",
  } as unknown as MeleePlayerListEntry;
}

function cachedPlayer(
  overrides: Partial<CachedPlayerForSync> & { externalPlayerId: number },
): CachedPlayerForSync {
  return {
    playerId: `player_${overrides.externalPlayerId}` as Id<"players">,
    name: `Player ${overrides.externalPlayerId}`,
    deckName: "MISSING_DECKLIST",
    deckList: "MISSING_DECKLIST",
    decklistStatus: "missing",
    ...overrides,
  };
}

const READY_LIST = "4 Lightning Bolt\nSIDEBOARD:\n2 Pyroblast";
const READY_RECORDS = [
  record(4, "Lightning Bolt"),
  record(2, "Pyroblast", 99),
];

describe("planPlayerSync", () => {
  it("creates uncached players, using the embedded decklist when present", () => {
    const plan = planPlayerSync({
      externalTournamentId: TOURNAMENT_ID,
      entries: [
        makeEntry({
          id: 1,
          name: "Ada",
          decklist: makeDecklist({ guid: "g1", records: READY_RECORDS }),
        }),
        makeEntry({ id: 2, name: "Ben", dropped: true }),
      ],
      cached: [],
      mode: "fill_missing",
    });
    expect(plan.newPlayers).toEqual([
      {
        externalTournamentId: TOURNAMENT_ID,
        name: "Ada",
        externalPlayerId: 1,
        registrationStatus: "REGISTERED",
        externalDecklistId: "g1",
        decklistStatus: "ready",
        deckName: "Mono Red",
        deckList: READY_LIST,
      },
      {
        externalTournamentId: TOURNAMENT_ID,
        name: "Ben",
        externalPlayerId: 2,
        registrationStatus: "DROPPED",
        decklistStatus: "missing",
        deckName: "MISSING_DECKLIST",
        deckList: "MISSING_DECKLIST",
      },
    ]);
    expect(plan.decklistUpdates).toEqual([]);
    expect(plan.decklistsToFetch).toEqual([]);
    expect(plan.nameUpdates).toEqual([]);
  });

  it("fill_missing fills a late submission for a player cached without a decklist", () => {
    const plan = planPlayerSync({
      externalTournamentId: TOURNAMENT_ID,
      entries: [
        makeEntry({
          id: 1,
          name: "Ada",
          decklist: makeDecklist({ guid: "g1", records: READY_RECORDS }),
        }),
      ],
      cached: [cachedPlayer({ externalPlayerId: 1 })],
      mode: "fill_missing",
    });
    expect(plan.newPlayers).toEqual([]);
    expect(plan.decklistUpdates).toEqual([
      {
        playerId: "player_1",
        deckName: "Mono Red",
        deckList: READY_LIST,
        externalDecklistId: "g1",
        decklistStatus: "ready",
      },
    ]);
  });

  it("fill_missing leaves players that already have a decklist alone, even when Melee's differs", () => {
    const plan = planPlayerSync({
      externalTournamentId: TOURNAMENT_ID,
      entries: [
        makeEntry({
          id: 1,
          name: "Ada Renamed",
          decklist: makeDecklist({
            guid: "g1",
            name: "Burn",
            records: [record(4, "Fireblast")],
          }),
        }),
      ],
      cached: [
        cachedPlayer({
          externalPlayerId: 1,
          name: "Ada",
          decklistStatus: "ready",
          externalDecklistId: "g1",
          deckName: "Mono Red",
          deckList: READY_LIST,
        }),
      ],
      mode: "fill_missing",
    });
    expect(plan.decklistUpdates).toEqual([]);
    expect(plan.decklistsToFetch).toEqual([]);
    expect(plan.nameUpdates).toEqual([]);
  });

  it("full re-downloads a changed decklist and name for a cached player", () => {
    const plan = planPlayerSync({
      externalTournamentId: TOURNAMENT_ID,
      entries: [
        makeEntry({
          id: 1,
          name: "Ada Renamed",
          decklist: makeDecklist({
            guid: "g1",
            name: "Burn",
            records: [record(4, "Fireblast")],
          }),
        }),
      ],
      cached: [
        cachedPlayer({
          externalPlayerId: 1,
          name: "Ada",
          decklistStatus: "ready",
          externalDecklistId: "g1",
          deckName: "Mono Red",
          deckList: READY_LIST,
        }),
      ],
      mode: "full",
    });
    expect(plan.nameUpdates).toEqual([{ playerId: "player_1", name: "Ada Renamed" }]);
    expect(plan.decklistUpdates).toEqual([
      {
        playerId: "player_1",
        deckName: "Burn",
        deckList: "4 Fireblast",
        externalDecklistId: "g1",
        decklistStatus: "ready",
      },
    ]);
  });

  it("full skips unchanged players so nothing is rewritten", () => {
    const plan = planPlayerSync({
      externalTournamentId: TOURNAMENT_ID,
      entries: [
        makeEntry({
          id: 1,
          name: "Ada",
          decklist: makeDecklist({ guid: "g1", records: READY_RECORDS }),
        }),
        makeEntry({ id: 2, name: "Ben" }),
      ],
      cached: [
        cachedPlayer({
          externalPlayerId: 1,
          name: "Ada",
          decklistStatus: "ready",
          externalDecklistId: "g1",
          deckName: "Mono Red",
          deckList: READY_LIST,
        }),
        cachedPlayer({ externalPlayerId: 2, name: "Ben" }),
      ],
      mode: "full",
    });
    expect(plan).toEqual({
      newPlayers: [],
      decklistUpdates: [],
      decklistsToFetch: [],
      nameUpdates: [],
    });
  });

  it("never touches hand-edited players in either mode", () => {
    const entries = [
      makeEntry({
        id: 1,
        name: "Ada Renamed",
        decklist: makeDecklist({ guid: "g2", records: READY_RECORDS }),
      }),
    ];
    const cached = [
      cachedPlayer({
        externalPlayerId: 1,
        name: "Ada",
        decklistStatus: "manual",
        deckName: "My Deck",
        deckList: "60 Island",
      }),
    ];
    for (const mode of ["fill_missing", "full"] as const) {
      const plan = planPlayerSync({
        externalTournamentId: TOURNAMENT_ID,
        entries,
        cached,
        mode,
      });
      expect(plan).toEqual({
        newPlayers: [],
        decklistUpdates: [],
        decklistsToFetch: [],
        nameUpdates: [],
      });
    }
  });

  it("fetches by id when the list payload names a decklist without cards", () => {
    const entries = [
      makeEntry({
        id: 1,
        name: "Ada",
        decklist: makeDecklist({ guid: "g1", records: null }),
      }),
    ];
    const readyCached = cachedPlayer({
      externalPlayerId: 1,
      name: "Ada",
      decklistStatus: "ready",
      externalDecklistId: "g1",
      deckName: "Mono Red",
      deckList: READY_LIST,
    });
    // Incremental: already have it, nothing to do.
    expect(
      planPlayerSync({
        externalTournamentId: TOURNAMENT_ID,
        entries,
        cached: [readyCached],
        mode: "fill_missing",
      }).decklistsToFetch,
    ).toEqual([]);
    // Full: an edited decklist keeps its id, so re-download it.
    expect(
      planPlayerSync({
        externalTournamentId: TOURNAMENT_ID,
        entries,
        cached: [readyCached],
        mode: "full",
      }).decklistsToFetch,
    ).toEqual([{ playerId: "player_1", externalDecklistId: "g1" }]);
    // Missing decklist: fetch in both modes.
    expect(
      planPlayerSync({
        externalTournamentId: TOURNAMENT_ID,
        entries,
        cached: [cachedPlayer({ externalPlayerId: 1 })],
        mode: "fill_missing",
      }).decklistsToFetch,
    ).toEqual([{ playerId: "player_1", externalDecklistId: "g1" }]);
  });

  it("retries a previously failed fetch using the stored decklist id", () => {
    const plan = planPlayerSync({
      externalTournamentId: TOURNAMENT_ID,
      entries: [makeEntry({ id: 1, name: "Ada" })],
      cached: [
        cachedPlayer({
          externalPlayerId: 1,
          decklistStatus: "fetch_failed",
          externalDecklistId: "g1",
          deckName: "Unknown",
          deckList: "Unknown",
        }),
      ],
      mode: "fill_missing",
    });
    expect(plan.decklistsToFetch).toEqual([
      { playerId: "player_1", externalDecklistId: "g1" },
    ]);
  });
});

describe("shouldApplyDecklistUpdate", () => {
  const readyUpdate: DecklistUpdate = {
    playerId: "player_1" as Id<"players">,
    deckName: "Mono Red",
    deckList: READY_LIST,
    externalDecklistId: "g1",
    decklistStatus: "ready",
  };
  const failedUpdate: DecklistUpdate = {
    ...readyUpdate,
    deckName: "Unknown",
    deckList: "Unknown",
    decklistStatus: "fetch_failed",
  };

  it("does not replace a usable decklist with a failed fetch", () => {
    const cached = cachedPlayer({
      externalPlayerId: 1,
      decklistStatus: "ready",
      externalDecklistId: "g1",
      deckName: "Mono Red",
      deckList: READY_LIST,
    });
    expect(shouldApplyDecklistUpdate(cached, failedUpdate)).toBe(false);
  });

  it("records a failed fetch for a player with no decklist, once", () => {
    expect(
      shouldApplyDecklistUpdate(cachedPlayer({ externalPlayerId: 1 }), failedUpdate),
    ).toBe(true);
    expect(
      shouldApplyDecklistUpdate(
        cachedPlayer({
          externalPlayerId: 1,
          decklistStatus: "fetch_failed",
          externalDecklistId: "g1",
          deckName: "Unknown",
          deckList: "Unknown",
        }),
        failedUpdate,
      ),
    ).toBe(false);
  });

  it("applies a ready decklist when anything about it changed", () => {
    const cached = cachedPlayer({
      externalPlayerId: 1,
      decklistStatus: "ready",
      externalDecklistId: "g1",
      deckName: "Mono Red",
      deckList: READY_LIST,
    });
    expect(shouldApplyDecklistUpdate(cached, readyUpdate)).toBe(false);
    expect(
      shouldApplyDecklistUpdate(cached, { ...readyUpdate, deckList: "4 Shock" }),
    ).toBe(true);
    expect(
      shouldApplyDecklistUpdate(cached, { ...readyUpdate, externalDecklistId: "g2" }),
    ).toBe(true);
    expect(
      shouldApplyDecklistUpdate({ ...cached, decklistStatus: "fetch_failed" }, readyUpdate),
    ).toBe(true);
  });

  it("selectFetchedDecklistUpdates keeps results for unknown players", () => {
    expect(selectFetchedDecklistUpdates([readyUpdate], [])).toEqual([readyUpdate]);
  });
});

describe("summaries", () => {
  it("counts applied updates and formats them", () => {
    const summary = summarizePlayerSync({
      playerCount: 3,
      plan: {
        newPlayers: [
          {
            externalTournamentId: TOURNAMENT_ID,
            name: "Ada",
            externalPlayerId: 1,
            decklistStatus: "missing",
            deckName: "MISSING_DECKLIST",
            deckList: "MISSING_DECKLIST",
          },
        ],
        decklistUpdates: [],
        decklistsToFetch: [],
        nameUpdates: [{ playerId: "player_2" as Id<"players">, name: "Ben" }],
      },
      appliedDecklistUpdates: [
        {
          playerId: "player_2" as Id<"players">,
          deckName: "Burn",
          deckList: "4 Fireblast",
          decklistStatus: "ready",
        },
        {
          playerId: "player_3" as Id<"players">,
          deckName: "Unknown",
          deckList: "Unknown",
          decklistStatus: "fetch_failed",
        },
      ],
    });
    expect(summary).toEqual({
      playerCount: 3,
      created: 1,
      decklistsUpdated: 1,
      decklistFetchesFailed: 1,
      namesUpdated: 1,
    });
    expect(formatPlayerSyncSummary(summary)).toBe(
      "Refreshed 3 players from Melee: 1 added, 1 decklist updated, 1 name updated, 1 decklist fetch failed.",
    );
    expect(
      formatPlayerSyncSummary({
        playerCount: 1,
        created: 0,
        decklistsUpdated: 0,
        decklistFetchesFailed: 0,
        namesUpdated: 0,
      }),
    ).toBe("Refreshed 1 player from Melee: 0 added, 0 decklists updated.");
  });
});

describe("playerRefreshDecision", () => {
  it("requires a tournament id and credentials, then one run at a time", () => {
    expect(
      playerRefreshDecision({ externalTournamentId: undefined, hasCredentials: true }),
    ).toBe("no_tournament");
    expect(
      playerRefreshDecision({ externalTournamentId: -1, hasCredentials: true }),
    ).toBe("no_tournament");
    expect(
      playerRefreshDecision({ externalTournamentId: 999, hasCredentials: false }),
    ).toBe("no_credentials");
    expect(
      playerRefreshDecision({
        externalTournamentId: 999,
        hasCredentials: true,
        refresh: { status: "running", startedAt: 1 },
      }),
    ).toBe("in_progress");
    expect(
      playerRefreshDecision({
        externalTournamentId: 999,
        hasCredentials: true,
        refresh: { status: "error", startedAt: 1, finishedAt: 2 },
      }),
    ).toBe("scheduled");
    expect(
      playerRefreshDecision({ externalTournamentId: 999, hasCredentials: true }),
    ).toBe("scheduled");
  });
});
