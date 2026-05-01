import { describe, expect, it } from "vitest";

import {
  applyMetaBreakdownSettings,
  buildMetaBreakdown,
  getMetaBreakdownKeyCardName,
} from "../meta-breakdown";

describe("buildMetaBreakdown", () => {
  it("groups known decklists by archetype and computes percentages from known decklists only", () => {
    const result = buildMetaBreakdown([
      { deckName: "Boros Synth", deckList: "4 Lightning Bolt" },
      { deckName: "Boros Synth", deckList: "4 Galvanic Blast" },
      { deckName: "Dimir Terror", deckList: "4 Brainstorm" },
      { deckName: "MISSING_DECKLIST", deckList: "MISSING_DECKLIST" },
      { deckName: "Unknown", deckList: "Unknown" },
      { deckName: "PENDING", deckList: "PENDING" },
      { deckName: "", deckList: "4 Counterspell" },
      { deckName: "Grixis Affinity", deckList: "" },
    ]);

    expect(result.totalKnownDecklists).toBe(3);
    expect(result.rows).toEqual([
      {
        archetype: "Boros Synth",
        count: 2,
        percentage: 66.66666666666666,
      },
      {
        archetype: "Dimir Terror",
        count: 1,
        percentage: 33.33333333333333,
      },
    ]);
  });

  it("groups case-insensitively and sorts by count descending then name ascending", () => {
    const result = buildMetaBreakdown([
      { deckName: "Affinity", deckList: "a" },
      { deckName: "faeries", deckList: "b" },
      { deckName: "FAERIES", deckList: "c" },
      { deckName: "Burn", deckList: "d" },
      { deckName: "burn", deckList: "e" },
      { deckName: "Affinity", deckList: "f" },
    ]);

    expect(result.totalKnownDecklists).toBe(6);
    expect(result.rows.map((row) => row.archetype)).toEqual([
      "Affinity",
      "Burn",
      "faeries",
    ]);
    expect(result.rows.map((row) => row.count)).toEqual([2, 2, 2]);
  });

  it("collapses archetypes into macro archetypes and falls back to deck name when macro is null", () => {
    const result = buildMetaBreakdown(
      [
        { deckName: "Esper Psychatog", deckList: "a" },
        { deckName: "Psychatog", deckList: "b" },
        { deckName: "Gro-a-tog", deckList: "c" },
        { deckName: "Deadguy Ale", deckList: "d" },
      ],
      {
        macroByArchetype: {
          "Esper Psychatog": "Psychatog",
          Psychatog: "Psychatog",
          "Gro-a-tog": "Psychatog",
          "Deadguy Ale": null,
        },
      },
    );

    expect(result.totalKnownDecklists).toBe(4);
    expect(result.rows).toEqual([
      {
        archetype: "Psychatog",
        count: 3,
        percentage: 75,
      },
      {
        archetype: "Deadguy Ale",
        count: 1,
        percentage: 25,
      },
    ]);
  });

  it("applies minimum meta percentage and row limit settings", () => {
    const breakdown = buildMetaBreakdown([
      { deckName: "A", deckList: "a" },
      { deckName: "A", deckList: "b" },
      { deckName: "A", deckList: "c" },
      { deckName: "B", deckList: "d" },
      { deckName: "B", deckList: "e" },
      { deckName: "C", deckList: "f" },
    ]);

    const rows = applyMetaBreakdownSettings(breakdown, {
      minMetaPercent: 20,
      maxRows: 2,
    });

    expect(rows).toEqual([
      {
        archetype: "A",
        count: 3,
        percentage: 50,
      },
      {
        archetype: "B",
        count: 2,
        percentage: 33.33333333333333,
      },
      {
        archetype: "Other",
        count: 1,
        percentage: 16.666666666666664,
      },
    ]);
  });

  it("adds an Other row when rows are hidden by max archetype limit", () => {
    const breakdown = buildMetaBreakdown([
      { deckName: "A", deckList: "a" },
      { deckName: "A", deckList: "b" },
      { deckName: "B", deckList: "c" },
      { deckName: "C", deckList: "d" },
      { deckName: "D", deckList: "e" },
    ]);

    const rows = applyMetaBreakdownSettings(breakdown, {
      minMetaPercent: 0,
      maxRows: 2,
    });

    expect(rows).toEqual([
      {
        archetype: "A",
        count: 2,
        percentage: 40,
      },
      {
        archetype: "B",
        count: 1,
        percentage: 20,
      },
      {
        archetype: "Other",
        count: 2,
        percentage: 40,
      },
    ]);
  });
});

describe("getMetaBreakdownKeyCardName", () => {
  it("returns the first required card for a direct archetype match", () => {
    expect(getMetaBreakdownKeyCardName("Aluren")).toBe("Aluren");
    expect(getMetaBreakdownKeyCardName("  Angry Hermit  ")).toBe(
      "Sutured Ghoul",
    );
  });

  it("uses the first matching macro archetype when the row is a macro name", () => {
    expect(getMetaBreakdownKeyCardName("Storm Combo")).toBe("Ill-Gotten Gains");
  });

  it("returns null when no key card can be resolved", () => {
    expect(getMetaBreakdownKeyCardName("Other")).toBeNull();
    expect(getMetaBreakdownKeyCardName("Not A Real Archetype")).toBeNull();
  });
});
