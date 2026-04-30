import { describe, expect, it } from "vitest";

import {
  composePlayerData,
  getChangedRegistrationStatuses,
  isMissingDecklistData,
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

  it("falls back to deprecated player fields during the migration window", () => {
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
      registrationStatus: "REGISTERED",
      deckId: 11,
      decklistStatus: "ready",
      deckName: "Legacy Deck",
      deckList: "legacy list",
    });
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

describe("isMissingDecklistData", () => {
  it("treats missing and fetch_failed rows as needing a refetch", () => {
    expect(isMissingDecklistData({ decklistStatus: "missing" })).toBe(true);
    expect(isMissingDecklistData({ decklistStatus: "fetch_failed" })).toBe(true);
    expect(isMissingDecklistData({ decklistStatus: "ready" })).toBe(false);
  });

  it("keeps legacy sentinel fallback behavior", () => {
    expect(
      isMissingDecklistData({
        deckName: "MISSING_DECKLIST",
        deckList: "MISSING_DECKLIST",
      }),
    ).toBe(true);
    expect(
      isMissingDecklistData({ deckName: "Unknown", deckList: "Unknown" }),
    ).toBe(true);
  });
});
