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
  decklistFetchesForCreatedPlayers,
  formatPlayerSyncSummary,
  isOlderDecklistVersion,
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
  lastUpdated?: string;
}): MeleeDecklistResponse {
  return {
    Guid: args.guid,
    DecklistName: args.name ?? "Mono Red",
    Name: args.name ?? "Mono Red",
    FormatName: "Standard",
    LastUpdated: args.lastUpdated,
    ...(args.records === null ? {} : { Records: args.records ?? [] }),
  } as unknown as MeleeDecklistResponse;
}

const T1 = "2026-05-31T19:44:27Z";
const T2 = "2026-06-01T09:00:00Z";

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

  it("keeps the decklist id of an uncached player whose cards are not embedded", () => {
    const plan = planPlayerSync({
      externalTournamentId: TOURNAMENT_ID,
      entries: [
        makeEntry({
          id: 1,
          name: "Ada",
          decklist: makeDecklist({ guid: "g1", records: null, lastUpdated: T1 }),
        }),
      ],
      cached: [],
      mode: "full",
    });
    expect(plan.newPlayers).toEqual([
      {
        externalTournamentId: TOURNAMENT_ID,
        name: "Ada",
        externalPlayerId: 1,
        registrationStatus: "REGISTERED",
        externalDecklistId: "g1",
        decklistStatus: "missing",
        deckName: "MISSING_DECKLIST",
        deckList: "MISSING_DECKLIST",
      },
    ]);
    // The row does not exist yet, so the fetch is planned once it does.
    expect(plan.decklistsToFetch).toEqual([]);
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

  it("fill_missing picks up an edited decklist when its cards are in the payload, but not the name", () => {
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
            lastUpdated: T2,
          }),
        }),
      ],
      cached: [
        cachedPlayer({
          externalPlayerId: 1,
          name: "Ada",
          decklistStatus: "ready",
          externalDecklistId: "g1",
          externalDecklistUpdatedAt: T1,
          deckName: "Mono Red",
          deckList: READY_LIST,
        }),
      ],
      mode: "fill_missing",
    });
    expect(plan.decklistUpdates).toEqual([
      {
        playerId: "player_1",
        deckName: "Burn",
        deckList: "4 Fireblast",
        externalDecklistId: "g1",
        externalDecklistUpdatedAt: T2,
        decklistStatus: "ready",
      },
    ]);
    expect(plan.decklistsToFetch).toEqual([]);
    expect(plan.nameUpdates).toEqual([]);
  });

  it("records a LastUpdated it did not have, without touching anything else", () => {
    const plan = planPlayerSync({
      externalTournamentId: TOURNAMENT_ID,
      entries: [
        makeEntry({
          id: 1,
          name: "Ada",
          decklist: makeDecklist({ guid: "g1", records: READY_RECORDS, lastUpdated: T1 }),
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
    expect(plan.decklistUpdates).toEqual([
      {
        playerId: "player_1",
        deckName: "Mono Red",
        deckList: READY_LIST,
        externalDecklistId: "g1",
        externalDecklistUpdatedAt: T1,
        decklistStatus: "ready",
      },
    ]);
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

  describe("when the list payload names a decklist without cards", () => {
    const fetchG1 = [{ playerId: "player_1", externalDecklistId: "g1" }];
    const entriesWith = (decklist: MeleeDecklistResponse) => [
      makeEntry({ id: 1, name: "Ada", decklist }),
    ];
    const readyCached = (externalDecklistUpdatedAt?: string) =>
      cachedPlayer({
        externalPlayerId: 1,
        name: "Ada",
        decklistStatus: "ready",
        externalDecklistId: "g1",
        externalDecklistUpdatedAt,
        deckName: "Mono Red",
        deckList: READY_LIST,
      });
    const toFetch = (
      entries: MeleePlayerListEntry[],
      cached: CachedPlayerForSync,
      mode: "fill_missing" | "full",
    ) =>
      planPlayerSync({
        externalTournamentId: TOURNAMENT_ID,
        entries,
        cached: [cached],
        mode,
      }).decklistsToFetch;

    it("fetches a missing decklist in both modes", () => {
      const entries = entriesWith(makeDecklist({ guid: "g1", records: null }));
      expect(toFetch(entries, cachedPlayer({ externalPlayerId: 1 }), "fill_missing")).toEqual(fetchG1);
      expect(toFetch(entries, cachedPlayer({ externalPlayerId: 1 }), "full")).toEqual(fetchG1);
    });

    it("skips a cached decklist whose LastUpdated matches, in both modes", () => {
      const entries = entriesWith(
        makeDecklist({ guid: "g1", records: null, lastUpdated: T1 }),
      );
      expect(toFetch(entries, readyCached(T1), "fill_missing")).toEqual([]);
      expect(toFetch(entries, readyCached(T1), "full")).toEqual([]);
    });

    it("re-fetches when LastUpdated moved or the decklist id changed", () => {
      const edited = entriesWith(
        makeDecklist({ guid: "g1", records: null, lastUpdated: T2 }),
      );
      expect(toFetch(edited, readyCached(T1), "fill_missing")).toEqual(fetchG1);
      expect(toFetch(edited, readyCached(T1), "full")).toEqual(fetchG1);

      const replaced = entriesWith(
        makeDecklist({ guid: "g2", records: null, lastUpdated: T1 }),
      );
      const fetchG2 = [{ playerId: "player_1", externalDecklistId: "g2" }];
      expect(toFetch(replaced, readyCached(T1), "fill_missing")).toEqual(fetchG2);
      expect(toFetch(replaced, readyCached(T1), "full")).toEqual(fetchG2);
    });

    it("without a stored LastUpdated, only full mode re-fetches", () => {
      const entries = entriesWith(
        makeDecklist({ guid: "g1", records: null, lastUpdated: T1 }),
      );
      expect(toFetch(entries, readyCached(undefined), "fill_missing")).toEqual([]);
      expect(toFetch(entries, readyCached(undefined), "full")).toEqual(fetchG1);
    });
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

describe("decklistFetchesForCreatedPlayers", () => {
  it("fetches for inserted players planned without a decklist but with an id", () => {
    const entries = [
      makeEntry({
        id: 1,
        name: "Ada",
        decklist: makeDecklist({ guid: "g1", records: null }),
      }),
      makeEntry({
        id: 2,
        name: "Ben",
        decklist: makeDecklist({ guid: "g2", records: READY_RECORDS }),
      }),
      makeEntry({ id: 3, name: "Cy" }),
      makeEntry({
        id: 4,
        name: "Di",
        decklist: makeDecklist({ guid: "g4", records: null }),
      }),
    ];
    const plan = planPlayerSync({
      externalTournamentId: TOURNAMENT_ID,
      entries,
      cached: [],
      mode: "fill_missing",
    });
    // Di was inserted first by an overlapping sync, so createPlayers skipped
    // her; that sync fetches her decklist.
    const created = [
      { playerId: "player_1" as Id<"players">, externalPlayerId: 1 },
      { playerId: "player_2" as Id<"players">, externalPlayerId: 2 },
      { playerId: "player_3" as Id<"players">, externalPlayerId: 3 },
    ];
    expect(decklistFetchesForCreatedPlayers(plan.newPlayers, created)).toEqual([
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

  it("applies a ready decklist whose LastUpdated is new, and skips one already recorded", () => {
    const cached = cachedPlayer({
      externalPlayerId: 1,
      decklistStatus: "ready",
      externalDecklistId: "g1",
      externalDecklistUpdatedAt: T1,
      deckName: "Mono Red",
      deckList: READY_LIST,
    });
    expect(
      shouldApplyDecklistUpdate(cached, { ...readyUpdate, externalDecklistUpdatedAt: T1 }),
    ).toBe(false);
    expect(
      shouldApplyDecklistUpdate(cached, { ...readyUpdate, externalDecklistUpdatedAt: T2 }),
    ).toBe(true);
    // A fetch that reported no timestamp does not count as a change.
    expect(shouldApplyDecklistUpdate(cached, readyUpdate)).toBe(false);
  });

  it("does not roll a decklist back to an older LastUpdated of the same id", () => {
    const cached = cachedPlayer({
      externalPlayerId: 1,
      decklistStatus: "ready",
      externalDecklistId: "g1",
      externalDecklistUpdatedAt: T2,
      deckName: "Burn",
      deckList: "4 Fireblast",
    });
    // A slower overlapping sync carrying the previous version.
    const older = { ...readyUpdate, externalDecklistUpdatedAt: T1 };
    expect(isOlderDecklistVersion(cached, older)).toBe(true);
    expect(shouldApplyDecklistUpdate(cached, older)).toBe(false);
    // A different decklist id is not comparable, so it still applies.
    const otherList = { ...older, externalDecklistId: "g2" };
    expect(isOlderDecklistVersion(cached, otherList)).toBe(false);
    expect(shouldApplyDecklistUpdate(cached, otherList)).toBe(true);
    // Unknown timestamps on either side never block a write.
    expect(isOlderDecklistVersion({ ...cached, externalDecklistUpdatedAt: undefined }, older)).toBe(false);
    expect(isOlderDecklistVersion(cached, readyUpdate)).toBe(false);
    expect(
      isOlderDecklistVersion(cached, { ...older, externalDecklistUpdatedAt: "not a date" }),
    ).toBe(false);
  });

  it("selectFetchedDecklistUpdates keeps results for unknown players", () => {
    expect(selectFetchedDecklistUpdates([readyUpdate], [])).toEqual([readyUpdate]);
  });
});

describe("summaries", () => {
  it("counts applied updates and formats them", () => {
    const summary = summarizePlayerSync({
      playerCount: 3,
      created: 1,
      namesUpdated: 1,
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
