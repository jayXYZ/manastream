import { describe, expect, it } from "vitest";
import {
  buildDecklistFromMeleeRecords,
  meleeRecordsToPlaintext,
} from "../decklist";
import { parseDecklist } from "../../deckCards";
import { parseMaindeckFromPlaintext } from "../../deckClassification/deckClassification";
import { MeleeDecklistRecord } from "../../../types/melee";

function record(
  name: string,
  quantity: number,
  category: number,
): MeleeDecklistRecord {
  return {
    l: name.toLowerCase(),
    n: name,
    s: null,
    q: quantity,
    c: category,
    t: "Sorcery",
  };
}

const SAMPLE_RECORDS: MeleeDecklistRecord[] = [
  record("Lightning Bolt", 4, 0),
  record("Mountain", 20, 0),
  record("Pyroblast", 3, 99),
];

describe("meleeRecordsToPlaintext", () => {
  it("renders maindeck and sideboard sections", () => {
    expect(meleeRecordsToPlaintext(SAMPLE_RECORDS)).toBe(
      "4 Lightning Bolt\n20 Mountain\nSIDEBOARD:\n3 Pyroblast",
    );
  });

  it("omits the sideboard header when there is no sideboard", () => {
    expect(meleeRecordsToPlaintext([record("Island", 60, 0)])).toBe(
      "60 Island",
    );
  });

  it("round-trips through the Scryfall decklist parser", () => {
    const parsed = parseDecklist(meleeRecordsToPlaintext(SAMPLE_RECORDS));
    expect(parsed.mainboard).toEqual([
      { count: 4, name: "Lightning Bolt" },
      { count: 20, name: "Mountain" },
    ]);
    expect(parsed.sideboard).toEqual([{ count: 3, name: "Pyroblast" }]);
  });

  it("round-trips through the classifier's maindeck parser", () => {
    const maindeck = parseMaindeckFromPlaintext(
      meleeRecordsToPlaintext(SAMPLE_RECORDS),
    );
    expect(maindeck).toEqual({
      "Lightning Bolt": 4,
      Mountain: 20,
    });
  });
});

describe("buildDecklistFromMeleeRecords", () => {
  it("keeps Melee's decklist name for non-classifiable formats", () => {
    const result = buildDecklistFromMeleeRecords({
      records: SAMPLE_RECORDS,
      formatName: "Modern",
      decklistName: "Burn",
    });
    expect(result.deckname).toBe("Burn");
    expect(result.decklist).toContain("SIDEBOARD:");
  });

  it("runs the card-based classifier for classifiable formats", () => {
    const result = buildDecklistFromMeleeRecords({
      records: SAMPLE_RECORDS,
      formatName: "Premodern",
      decklistName: "Some Custom Name",
    });
    // The sample cards match no archetype definition, so the classifier
    // reports Unknown rather than trusting the provided name.
    expect(result.deckname).toBe("Unknown");
  });

  it("falls back to Unknown when no name and no classification", () => {
    const result = buildDecklistFromMeleeRecords({
      records: [record("Island", 60, 0)],
      formatName: "Modern",
    });
    expect(result.deckname).toBe("Unknown");
  });
});
