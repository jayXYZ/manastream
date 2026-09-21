import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildMeleeAuthHeader,
  fetchAllMeleePages,
  fetchMeleeDecklist,
  fetchMeleeTournament,
} from "../api";
import { makeStandardOverview, paginated } from "./fixtures";

const CREDENTIALS = {
  clientId: "user@example.com",
  clientSecret: "hunter2",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("buildMeleeAuthHeader", () => {
  it("encodes basic credentials", () => {
    expect(buildMeleeAuthHeader(CREDENTIALS)).toBe(
      `Basic ${Buffer.from("user@example.com:hunter2", "utf8").toString("base64")}`,
    );
  });

  it("encodes non-Latin1 characters where btoa would throw", () => {
    const credentials = { clientId: "usér", clientSecret: "pässwörd✓" };
    expect(buildMeleeAuthHeader(credentials)).toBe(
      `Basic ${Buffer.from("usér:pässwörd✓", "utf8").toString("base64")}`,
    );
  });
});

describe("fetchAllMeleePages", () => {
  it("concatenates pages until HasMore is false", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => paginated([1, 2], { page: 1, hasMore: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => paginated([3], { page: 2, hasMore: false }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const rows = await fetchAllMeleePages<number>("/api/test/1", CREDENTIALS);

    expect(rows).toEqual([1, 2, 3]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://melee.gg/api/test/1?variables.page=1&variables.pageSize=250",
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://melee.gg/api/test/1?variables.page=2&variables.pageSize=250",
    );
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      buildMeleeAuthHeader(CREDENTIALS),
    );
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("appends pagination params to paths that already have a query", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => paginated([], { hasMore: false }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchAllMeleePages("/api/test/1?formatId=abc", CREDENTIALS);

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://melee.gg/api/test/1?formatId=abc&variables.page=1&variables.pageSize=250",
    );
  });
});

describe("fetchMeleeTournament", () => {
  it("returns the tournament overview", async () => {
    const overview = makeStandardOverview();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => overview,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchMeleeTournament(432771, CREDENTIALS);

    expect(result.ID).toBe(432771);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://melee.gg/api/tournament/432771",
    );
  });
});

describe("fetchMeleeDecklist", () => {
  it("synthesizes plaintext and classifies the deck name", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        Records: [
          { l: "island", n: "Island", s: null, q: 60, c: 0, t: "Land" },
          { l: "pyroblast", n: "Pyroblast", s: null, q: 4, c: 99, t: "Instant" },
        ],
        FormatName: "Modern",
        DecklistName: "Islands",
        Name: "Islands",
        LastUpdated: "2026-05-31T19:44:27Z",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchMeleeDecklist(
      "3f583aea-a7aa-48b7-82be-b45b014324a4",
      CREDENTIALS,
    );

    expect(result).toEqual({
      deckname: "Islands",
      decklist: "60 Island\nSIDEBOARD:\n4 Pyroblast",
      lastUpdated: "2026-05-31T19:44:27Z",
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://melee.gg/api/decklist/3f583aea-a7aa-48b7-82be-b45b014324a4",
    );
  });
});
