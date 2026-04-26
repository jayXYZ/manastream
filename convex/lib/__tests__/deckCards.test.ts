import { describe, expect, it } from "vitest";
import {
  BASIC_LAND_SET_CODE,
  buildResolvedDeckCards,
  buildScryfallRequest,
  createUnresolvedCard,
  getCardCacheKey,
  mapScryfallCard,
  normalizeCardName,
  parseDecklist,
} from "../deckCards";

describe("deck card helpers", () => {
  it("parses mainboard and sideboard sections", () => {
    const parsed = parseDecklist(
      "4 Parallax Wave\n2 Mother of Runes\n\nSIDEBOARD:\n1 Disenchant",
    );

    expect(parsed.mainboard).toEqual([
      { count: 2, name: "Mother of Runes" },
      { count: 4, name: "Parallax Wave" },
    ]);
    expect(parsed.sideboard).toEqual([{ count: 1, name: "Disenchant" }]);
  });

  it("sums duplicate card lines and ignores invalid lines", () => {
    const parsed = parseDecklist(
      "2 Plains\nsideboard soon\n1 Plains\nnot a count\n3 Parallax Wave",
    );

    expect(parsed.mainboard).toEqual([
      { count: 3, name: "Parallax Wave" },
      { count: 3, name: "Plains" },
    ]);
  });

  it("normalizes names into stable cache keys", () => {
    expect(normalizeCardName("  Parallax   Wave  ")).toBe("parallax-wave");
    expect(getCardCacheKey("Parallax Wave")).toBe(
      "oldestNonReprint:v1:parallax-wave",
    );
  });

  it("builds explicit Scryfall requests with recommended headers", () => {
    const request = buildScryfallRequest("Parallax Wave");

    expect(request.url).toContain("https://api.scryfall.com/cards/search?");
    expect(request.url).toContain(
      "q=%21%22Parallax+Wave%22+not%3Areprint",
    );
    expect(request.url).toContain("unique=prints");
    expect(request.url).toContain("order=released");
    expect(request.url).toContain("dir=asc");
    expect(request.headers.Accept).toBe("application/json;q=0.9,*/*;q=0.8");
    expect(request.headers["User-Agent"]).toContain("manastream.app");
  });

  it("uses the configured old-border set code for basic lands", () => {
    const request = buildScryfallRequest("Plains");

    expect(request.url).toContain("https://api.scryfall.com/cards/named?");
    expect(request.url).toContain("exact=Plains");
    expect(request.url).toContain(`set=${BASIC_LAND_SET_CODE}`);
  });

  it("maps missing Scryfall results to unresolved card metadata", () => {
    expect(mapScryfallCard("Definitely Not A Real Card", undefined)).toEqual(
      createUnresolvedCard("Definitely Not A Real Card"),
    );
  });

  it("builds partial resolved deck data without throwing for unresolved cards", () => {
    const parsed = parseDecklist("4 Parallax Wave\n1 Not Real\nSIDEBOARD:\n1 Plains");
    const deckCards = buildResolvedDeckCards(
      parsed,
      new Map([
        [
          "Parallax Wave",
          {
            name: "Parallax Wave",
            imageUrl: "https://cards.scryfall.io/png/parallax-wave.png",
            typeLine: "Enchantment",
            legality: "legal",
          },
        ],
      ]),
      123,
    );

    expect(deckCards.resolvedAt).toBe(123);
    expect(deckCards.unresolvedNames).toEqual(["Not Real", "Plains"]);
    expect(deckCards.mainboard).toContainEqual({
      count: 1,
      name: "Not Real",
      typeLine: "Unknown",
      unresolved: true,
    });
  });
});
