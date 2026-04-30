import { describe, expect, it } from "vitest";

import {
  filterPairingsByMinimumMatchPoints,
  rankPairingsByUniqueness,
} from "../../convex/lib/pairingRankings";

describe("rankPairingsByUniqueness", () => {
  const tournamentPlayers = [
    { name: "Ada", deckName: "Esper Psychatog" },
    { name: "Ben", deckName: "Blue/Black Psychatog" },
    { name: "Cora", deckName: "Gro-a-tog" },
    { name: "Drew", deckName: "Deadguy Ale" },
    { name: "Eli", deckName: "Burn" },
    { name: "Finn", deckName: "Burn" },
    { name: "Gia", deckName: "Stiflenought" },
  ];

  it("ranks pairings by ascending macro-archetype uniqueness score", () => {
    const ranked = rankPairingsByUniqueness(
      [
        {
          tableNumber: 3,
          player1Data: { name: "Ada", deckName: "Esper Psychatog" },
          player2Data: { name: "Eli", deckName: "Burn" },
        },
        {
          tableNumber: 1,
          player1Data: { name: "Drew", deckName: "Deadguy Ale" },
          player2Data: { name: "Gia", deckName: "Stiflenought" },
        },
        {
          tableNumber: 2,
          player1Data: { name: "Ben", deckName: "Blue/Black Psychatog" },
          player2Data: { name: "Finn", deckName: "Burn" },
        },
      ],
      tournamentPlayers,
    );

    expect(
      ranked.map((pairing) => ({
        rank: pairing.rank,
        tableNumber: pairing.tableNumber,
        score: pairing.uniquenessScore,
        macro: [
          pairing.player1MacroArchetype,
          pairing.player2MacroArchetype,
        ],
      })),
    ).toEqual([
      {
        rank: 1,
        tableNumber: 1,
        score: 2,
        macro: ["Deadguy Ale", "Stiflenought"],
      },
      {
        rank: 2,
        tableNumber: 2,
        score: 4,
        macro: ["Psychatog", "Burn"],
      },
      {
        rank: 3,
        tableNumber: 3,
        score: 4,
        macro: ["Psychatog", "Burn"],
      },
    ]);
  });

  it("sorts unknown deck pairings after fully known matchups", () => {
    const ranked = rankPairingsByUniqueness(
      [
        {
          tableNumber: 1,
          player1Data: { name: "Mystery", deckName: "PENDING" },
          player2Data: { name: "Eli", deckName: "Burn" },
        },
        {
          tableNumber: 2,
          player1Data: { name: "Drew", deckName: "Deadguy Ale" },
          player2Data: { name: "Gia", deckName: "Stiflenought" },
        },
      ],
      tournamentPlayers,
    );

    expect(
      ranked.map((pairing) => ({
        rank: pairing.rank,
        tableNumber: pairing.tableNumber,
        score: pairing.uniquenessScore,
        hasKnownDecks: pairing.hasKnownDecks,
      })),
    ).toEqual([
      {
        rank: 1,
        tableNumber: 2,
        score: 2,
        hasKnownDecks: true,
      },
      {
        rank: 2,
        tableNumber: 1,
        score: undefined,
        hasKnownDecks: false,
      },
    ]);
  });
});

describe("filterPairingsByMinimumMatchPoints", () => {
  it("keeps pairings when either player meets the minimum points threshold", () => {
    const pairings = [
      {
        tableNumber: 1,
        player1TotalMatchPoints: 12,
        player2TotalMatchPoints: 3,
      },
      {
        tableNumber: 2,
        player1TotalMatchPoints: 6,
        player2TotalMatchPoints: 9,
      },
      {
        tableNumber: 3,
        player1TotalMatchPoints: 6,
        player2TotalMatchPoints: 3,
      },
    ];

    expect(
      filterPairingsByMinimumMatchPoints(pairings, 9).map(
        (pairing) => pairing.tableNumber,
      ),
    ).toEqual([1, 2]);
  });

  it("returns all pairings when the threshold is empty or zero", () => {
    const pairings = [
      {
        tableNumber: 1,
        player1TotalMatchPoints: 0,
        player2TotalMatchPoints: 0,
      },
      {
        tableNumber: 2,
        player1TotalMatchPoints: 3,
        player2TotalMatchPoints: 0,
      },
    ];

    expect(filterPairingsByMinimumMatchPoints(pairings, undefined)).toEqual(
      pairings,
    );
    expect(filterPairingsByMinimumMatchPoints(pairings, 0)).toEqual(pairings);
  });
});
