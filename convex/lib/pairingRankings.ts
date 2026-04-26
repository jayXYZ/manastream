import archetypes from "./spicerack/archetypes.json";

export type PairingRankingPlayer = {
  name: string;
  deckName: string;
};

export type PairingRankingInput = {
  tableNumber?: number;
  player1Data?: PairingRankingPlayer;
  player2Data?: PairingRankingPlayer;
};

export type RankedPairing<TPairing extends PairingRankingInput> = TPairing & {
  rank: number;
  player1MacroArchetype?: string;
  player2MacroArchetype?: string;
  uniquenessScore?: number;
  hasKnownDecks: boolean;
};

export type MatchPointsPairingInput = {
  player1TotalMatchPoints?: number;
  player2TotalMatchPoints?: number;
};

type ArchetypeDefinition = {
  deckname?: string;
  macro?: string | null;
};

const UNKNOWN_DECK_MARKERS = new Set([
  "",
  "MISSING_DECKLIST",
  "UNKNOWN",
  "PENDING",
]);

const macroByArchetype = buildMacroLookupFromArchetypesJson();

export function rankPairingsByUniqueness<
  TPairing extends PairingRankingInput,
>(
  pairings: TPairing[],
  tournamentPlayers: PairingRankingPlayer[],
): RankedPairing<TPairing>[] {
  const macroCounts = buildMacroCounts(tournamentPlayers);

  return pairings
    .map((pairing) => {
      const player1MacroArchetype = getMacroArchetype(
        pairing.player1Data?.deckName,
      );
      const player2MacroArchetype = getMacroArchetype(
        pairing.player2Data?.deckName,
      );
      const hasKnownDecks = Boolean(
        player1MacroArchetype && player2MacroArchetype,
      );
      const uniquenessScore = hasKnownDecks
        ? (macroCounts.get(player1MacroArchetype!.toLowerCase()) ?? 0) +
          (macroCounts.get(player2MacroArchetype!.toLowerCase()) ?? 0)
        : undefined;

      return {
        ...pairing,
        rank: 0,
        player1MacroArchetype,
        player2MacroArchetype,
        uniquenessScore,
        hasKnownDecks,
      };
    })
    .sort(compareRankedPairings)
    .map((pairing, index) => ({
      ...pairing,
      rank: index + 1,
    }));
}

export function filterPairingsByMinimumMatchPoints<
  TPairing extends MatchPointsPairingInput,
>(pairings: TPairing[], minimumPoints: number | undefined): TPairing[] {
  if (!minimumPoints || minimumPoints <= 0) {
    return pairings;
  }

  return pairings.filter(
    (pairing) =>
      (pairing.player1TotalMatchPoints ?? 0) >= minimumPoints ||
      (pairing.player2TotalMatchPoints ?? 0) >= minimumPoints,
  );
}

function buildMacroCounts(players: PairingRankingPlayer[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const player of players) {
    const macroArchetype = getMacroArchetype(player.deckName);
    if (!macroArchetype) {
      continue;
    }

    const key = macroArchetype.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function getMacroArchetype(deckName: string | undefined): string | undefined {
  if (!deckName || !isKnownDeckName(deckName)) {
    return undefined;
  }

  const archetypeName = deckName.trim();
  return macroByArchetype.get(archetypeName.toLowerCase()) || archetypeName;
}

function isKnownDeckName(deckName: string): boolean {
  const normalized = deckName.trim().toUpperCase();
  return !UNKNOWN_DECK_MARKERS.has(normalized);
}

function buildMacroLookupFromArchetypesJson(): Map<string, string | null> {
  const lookup = new Map<string, string | null>();
  for (const archetypeData of Object.values(
    archetypes as Record<string, ArchetypeDefinition>,
  )) {
    const deckname = archetypeData.deckname?.trim();
    if (!deckname) {
      continue;
    }
    const normalizedMacro = archetypeData.macro?.trim();
    lookup.set(deckname.toLowerCase(), normalizedMacro ? normalizedMacro : null);
  }
  return lookup;
}

function compareRankedPairings<TPairing extends PairingRankingInput>(
  a: RankedPairing<TPairing>,
  b: RankedPairing<TPairing>,
): number {
  if (a.hasKnownDecks !== b.hasKnownDecks) {
    return a.hasKnownDecks ? -1 : 1;
  }

  if (a.uniquenessScore !== b.uniquenessScore) {
    return (
      (a.uniquenessScore ?? Number.MAX_SAFE_INTEGER) -
      (b.uniquenessScore ?? Number.MAX_SAFE_INTEGER)
    );
  }

  const tableComparison =
    (a.tableNumber ?? Number.MAX_SAFE_INTEGER) -
    (b.tableNumber ?? Number.MAX_SAFE_INTEGER);
  if (tableComparison !== 0) {
    return tableComparison;
  }

  const playerA = `${a.player1Data?.name ?? ""} ${a.player2Data?.name ?? ""}`;
  const playerB = `${b.player1Data?.name ?? ""} ${b.player2Data?.name ?? ""}`;
  return playerA.localeCompare(playerB);
}
