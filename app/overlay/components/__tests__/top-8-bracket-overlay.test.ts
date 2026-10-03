import { describe, expect, it } from "vitest";

import {
  buildBracketLayout,
  orderQuarterfinals,
} from "../top-8-bracket-overlay";

describe("orderQuarterfinals", () => {
  it("keeps captured matches in their seeded positions and fills the rest", () => {
    const ordered = orderQuarterfinals([
      { seeds: [7, 2], winnerSeed: 2 },
      { seeds: [8, 1] },
    ]);
    expect(ordered).toEqual([
      { seeds: [1, 8] },
      { seeds: [4, 5] },
      { seeds: [2, 7], winnerSeed: 2 },
      { seeds: [3, 6] },
    ]);
  });

  it("keeps game wins with their seeds when a match is reordered", () => {
    const [top] = orderQuarterfinals([
      { seeds: [8, 1], winnerSeed: 1, gameWins: [0, 2] },
    ]);
    expect(top).toEqual({ seeds: [1, 8], winnerSeed: 1, gameWins: [2, 0] });
  });

  it("gives a match with unexpected seeds the first free position", () => {
    expect(orderQuarterfinals([{ seeds: [1, 5] }, { seeds: [4, 8] }])).toEqual([
      { seeds: [1, 5] },
      { seeds: [4, 8] },
      { seeds: [2, 7] },
      { seeds: [3, 6] },
    ]);
  });

  it("is the empty seeded bracket without matches", () => {
    expect(orderQuarterfinals([]).map((match) => match.seeds)).toEqual([
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6],
    ]);
  });
});

describe("buildBracketLayout", () => {
  it("carries winners forward and leaves undecided slots as placeholders", () => {
    const layout = buildBracketLayout({
      quarterfinals: [
        { seeds: [1, 8], winnerSeed: 1 },
        { seeds: [4, 5], winnerSeed: 4 },
        { seeds: [2, 7], winnerSeed: 2 },
        { seeds: [3, 6] },
      ],
      semifinals: [{ seeds: [1, 4] }],
      finals: [],
    });
    expect(layout.quarterfinals[0].slots.map((slot) => slot.eliminated)).toEqual(
      [false, true],
    );
    expect(layout.semifinals[0].slots.map((slot) => slot.seed)).toEqual([1, 4]);
    expect(layout.semifinals[1].slots).toEqual([
      { seed: 2, placeholder: "QF 3 winner", eliminated: false },
      { seed: undefined, placeholder: "QF 4 winner", eliminated: false },
    ]);
    expect(layout.finals[0].slots.map((slot) => slot.placeholder)).toEqual([
      "SF 1 winner",
      "SF 2 winner",
    ]);
    expect(layout.championSeed).toBeUndefined();
  });

  it("shows game wins only on decided matches, matched to each seed", () => {
    const layout = buildBracketLayout({
      quarterfinals: [
        { seeds: [1, 8], winnerSeed: 1, gameWins: [2, 1] },
        { seeds: [4, 5], winnerSeed: 4 },
        { seeds: [2, 7], gameWins: [1, 1] },
        { seeds: [3, 6] },
      ],
      semifinals: [{ seeds: [4, 1], winnerSeed: 1, gameWins: [0, 2] }],
      finals: [],
    });
    expect(layout.quarterfinals[0].slots.map((slot) => slot.gameWins)).toEqual(
      [2, 1],
    );
    expect(layout.quarterfinals[1].slots.map((slot) => slot.gameWins)).toEqual(
      [undefined, undefined],
    );
    expect(layout.quarterfinals[2].slots.map((slot) => slot.gameWins)).toEqual(
      [undefined, undefined],
    );
    expect(layout.semifinals[0].slots).toEqual([
      { seed: 1, placeholder: "QF 1 winner", eliminated: false, gameWins: 2 },
      { seed: 4, placeholder: "QF 2 winner", eliminated: true, gameWins: 0 },
    ]);
  });

  it("shows a partially captured quarterfinal round with its winner", () => {
    const layout = buildBracketLayout({
      quarterfinals: [{ seeds: [3, 6], winnerSeed: 6 }],
      semifinals: [],
      finals: [],
    });
    expect(layout.quarterfinals[3].slots).toEqual([
      { seed: 3, placeholder: "TBD", eliminated: true },
      { seed: 6, placeholder: "TBD", eliminated: false },
    ]);
    expect(layout.semifinals[1].slots[1]).toEqual({
      seed: 6,
      placeholder: "QF 4 winner",
      eliminated: false,
    });
  });
});
