import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchSpicerackDecklistData,
  fetchSpicerackRegisteredPlayers,
} from "../api";

describe("fetchSpicerackDecklistData", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps plaintext decklist when archetype is null", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        archetype: null,
        plaintext_list: "4 Lightning Bolt\n4 Chain Lightning",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSpicerackDecklistData(123, "test-key", "LEGACY");

    expect(result).toEqual({
      deckname: "Unknown",
      decklist: "4 Lightning Bolt\n4 Chain Lightning",
    });
  });

  it("keeps plaintext decklist when archetype is blank", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        archetype: "   ",
        plaintext_list: "4 Duress\n4 Dark Ritual",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSpicerackDecklistData(456, "test-key", "LEGACY");

    expect(result).toEqual({
      deckname: "Unknown",
      decklist: "4 Duress\n4 Dark Ritual",
    });
  });
});

describe("fetchSpicerackRegisteredPlayers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("filters out canceled and waitlisted registrations", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 1,
          user_identifier: "Active Player",
          registration_status: "REGISTERED",
          decklist: { id: 100, archetype: "Burn" },
        },
        {
          id: 2,
          user_identifier: "Canceled Player",
          registration_status: "CANCELED",
          decklist: { id: 101, archetype: "Control" },
        },
        {
          id: 3,
          user_identifier: "Waitlisted Player",
          registration_status: "ON_WAITLIST",
          decklist: { id: 102, archetype: "Aggro" },
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSpicerackRegisteredPlayers(789, "test-key");

    expect(result).toEqual([
      {
        id: 1,
        user_identifier: "Active Player",
        registration_status: "REGISTERED",
        decklist: { id: 100, archetype: "Burn" },
      },
    ]);
  });
});
