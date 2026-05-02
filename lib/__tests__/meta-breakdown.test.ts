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

  it("computes day 2 percentages and conversion rates from non-eliminated players", () => {
    const result = buildMetaBreakdown(
      [
        { deckName: "A", deckList: "a", registrationStatus: "ELIMINATED" },
        { deckName: "A", deckList: "b", registrationStatus: "ELIMINATED" },
        { deckName: "A", deckList: "c", registrationStatus: "REGISTERED" },
        { deckName: "A", deckList: "d", registrationStatus: "ACTIVE" },
        { deckName: "B", deckList: "e", registrationStatus: "ELIMINATED" },
        { deckName: "B", deckList: "f", registrationStatus: "ACTIVE" },
        {
          deckName: "Unknown",
          deckList: "Unknown",
          registrationStatus: "ACTIVE",
        },
      ],
      {
        isDay2Player: (player) => player.registrationStatus !== "ELIMINATED",
      },
    );

    expect(result.totalKnownDecklists).toBe(6);
    expect(result.totalDay2KnownDecklists).toBe(3);
    expect(result.rows).toEqual([
      {
        archetype: "A",
        count: 4,
        percentage: 66.66666666666666,
        day2Count: 2,
        day2Percentage: 66.66666666666666,
        conversionPercentage: 50,
      },
      {
        archetype: "B",
        count: 2,
        percentage: 33.33333333333333,
        day2Count: 1,
        day2Percentage: 33.33333333333333,
        conversionPercentage: 50,
      },
    ]);
  });

  it("sets day 2 percentages to zero when no known decklists converted", () => {
    const result = buildMetaBreakdown(
      [{ deckName: "A", deckList: "a", registrationStatus: "ELIMINATED" }],
      {
        isDay2Player: () => false,
      },
    );

    expect(result.totalDay2KnownDecklists).toBe(0);
    expect(result.rows).toEqual([
      {
        archetype: "A",
        count: 1,
        percentage: 100,
        day2Count: 0,
        day2Percentage: 0,
        conversionPercentage: 0,
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

  it("aggregates day 2 fields into the Other row", () => {
    const breakdown = buildMetaBreakdown(
      [
        { deckName: "A", deckList: "a", registrationStatus: "ACTIVE" },
        { deckName: "A", deckList: "b", registrationStatus: "ACTIVE" },
        { deckName: "A", deckList: "c", registrationStatus: "ELIMINATED" },
        { deckName: "B", deckList: "d", registrationStatus: "ACTIVE" },
        { deckName: "B", deckList: "e", registrationStatus: "ELIMINATED" },
        { deckName: "C", deckList: "f", registrationStatus: "ELIMINATED" },
      ],
      {
        isDay2Player: (player) => player.registrationStatus !== "ELIMINATED",
      },
    );

    const rows = applyMetaBreakdownSettings(breakdown, {
      minMetaPercent: 0,
      maxRows: 1,
    });

    expect(rows).toEqual([
      {
        archetype: "A",
        count: 3,
        percentage: 50,
        day2Count: 2,
        day2Percentage: 66.66666666666666,
        conversionPercentage: 66.66666666666666,
      },
      {
        archetype: "Other",
        count: 3,
        percentage: 50,
        day2Count: 1,
        day2Percentage: 33.33333333333333,
        conversionPercentage: 33.33333333333333,
      },
    ]);
  });

  it("sorts visible rows by day 2 percentage when requested", () => {
    const breakdown = buildMetaBreakdown(
      [
        { deckName: "A", deckList: "a", registrationStatus: "ACTIVE" },
        { deckName: "A", deckList: "b", registrationStatus: "ELIMINATED" },
        { deckName: "A", deckList: "c", registrationStatus: "ELIMINATED" },
        { deckName: "B", deckList: "d", registrationStatus: "ACTIVE" },
        { deckName: "B", deckList: "e", registrationStatus: "ACTIVE" },
        { deckName: "C", deckList: "f", registrationStatus: "ELIMINATED" },
      ],
      {
        isDay2Player: (player) => player.registrationStatus !== "ELIMINATED",
      },
    );

    const rows = applyMetaBreakdownSettings(breakdown, {
      minMetaPercent: 0,
      maxRows: 2,
      sortBy: "day2Percentage",
    });

    expect(rows.map((row) => row.archetype)).toEqual(["B", "A", "Other"]);
    expect(rows[0]).toMatchObject({
      archetype: "B",
      day2Percentage: 66.66666666666666,
    });
    expect(rows[1]).toMatchObject({
      archetype: "A",
      day2Percentage: 33.33333333333333,
    });
  });

  it("applies the minimum meta percentage to day 2 share when sorting by day 2 percentage", () => {
    const breakdown = buildMetaBreakdown(
      [
        { deckName: "A", deckList: "a", registrationStatus: "ACTIVE" },
        { deckName: "A", deckList: "b", registrationStatus: "ACTIVE" },
        { deckName: "B", deckList: "c", registrationStatus: "ACTIVE" },
        { deckName: "B", deckList: "d", registrationStatus: "ELIMINATED" },
        { deckName: "C", deckList: "e", registrationStatus: "ELIMINATED" },
        { deckName: "C", deckList: "f", registrationStatus: "ELIMINATED" },
      ],
      {
        isDay2Player: (player) => player.registrationStatus !== "ELIMINATED",
      },
    );

    const rows = applyMetaBreakdownSettings(breakdown, {
      minMetaPercent: 1.5,
      maxRows: 10,
      sortBy: "day2Percentage",
    });

    expect(rows.map((row) => row.archetype)).toEqual(["A", "B", "Other"]);
    expect(rows.find((row) => row.archetype === "C")).toBeUndefined();
    expect(rows.at(-1)).toMatchObject({
      archetype: "Other",
      day2Count: 0,
      day2Percentage: 0,
    });
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
