import archetypes from "../convex/lib/deckClassification/archetypes.json";

export type MetaBreakdownPlayer = {
  deckName: string;
  deckList: string;
  registrationStatus?: string | null;
};

export type MetaBreakdownRow = {
  archetype: string;
  count: number;
  percentage: number;
  day2Count?: number;
  day2Percentage?: number;
  conversionPercentage?: number;
};

export type MetaBreakdownResult = {
  totalKnownDecklists: number;
  totalDay2KnownDecklists?: number;
  rows: MetaBreakdownRow[];
};

export type BuildMetaBreakdownOptions = {
  macroByArchetype?: Record<string, string | null | undefined>;
  isDay2Player?: (player: MetaBreakdownPlayer) => boolean;
};

export type MetaBreakdownSettings = {
  minMetaPercent?: number;
  maxRows?: number;
  sortBy?: "day1Percentage" | "day2Percentage";
};

type ArchetypeDefinition = {
  deckname?: string;
  macro?: string | null;
  required?: string[];
};

const UNKNOWN_DECK_MARKERS = new Set([
  "",
  "MISSING_DECKLIST",
  "UNKNOWN",
  "PENDING",
]);

const defaultMacroByArchetype = buildMacroLookupFromArchetypesJson();
const defaultKeyCardByArchetype = buildKeyCardLookupFromArchetypesJson();

function isKnownValue(value: string): boolean {
  const normalized = value.trim().toUpperCase();
  return !UNKNOWN_DECK_MARKERS.has(normalized);
}

function hasKnownDecklist(player: MetaBreakdownPlayer): boolean {
  return isKnownValue(player.deckName) && isKnownValue(player.deckList);
}

export function buildMetaBreakdown(
  players: MetaBreakdownPlayer[],
  options: BuildMetaBreakdownOptions = {},
): MetaBreakdownResult {
  const knownDecklistPlayers = players.filter(hasKnownDecklist);
  const totalKnownDecklists = knownDecklistPlayers.length;
  const includeDay2Stats = Boolean(options.isDay2Player);
  const totalDay2KnownDecklists = includeDay2Stats
    ? knownDecklistPlayers.filter((player) => options.isDay2Player?.(player))
        .length
    : undefined;
  const macroByArchetype = buildMacroLookup(options.macroByArchetype);

  if (totalKnownDecklists === 0) {
    return {
      totalKnownDecklists: 0,
      ...(includeDay2Stats ? { totalDay2KnownDecklists: 0 } : {}),
      rows: [],
    };
  }

  const grouped = new Map<
    string,
    { archetype: string; count: number; day2Count: number }
  >();

  for (const player of knownDecklistPlayers) {
    const archetypeName = player.deckName.trim();
    const macroArchetype = macroByArchetype.get(archetypeName.toLowerCase());
    const archetype = macroArchetype || archetypeName;
    const key = archetype.toLowerCase();
    const existing = grouped.get(key);
    const isDay2Player = Boolean(options.isDay2Player?.(player));
    if (existing) {
      existing.count += 1;
      if (isDay2Player) {
        existing.day2Count += 1;
      }
      continue;
    }
    grouped.set(key, { archetype, count: 1, day2Count: isDay2Player ? 1 : 0 });
  }

  const rows = Array.from(grouped.values())
    .map((entry) => {
      const row: MetaBreakdownRow = {
        archetype: entry.archetype,
        count: entry.count,
        percentage: (entry.count / totalKnownDecklists) * 100,
      };

      if (includeDay2Stats) {
        const day2KnownDecklistCount = totalDay2KnownDecklists ?? 0;
        row.day2Count = entry.day2Count;
        row.day2Percentage =
          day2KnownDecklistCount === 0
            ? 0
            : (entry.day2Count / day2KnownDecklistCount) * 100;
        row.conversionPercentage = (entry.day2Count / entry.count) * 100;
      }

      return row;
    })
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.archetype.localeCompare(b.archetype);
    });

  return {
    totalKnownDecklists,
    ...(includeDay2Stats ? { totalDay2KnownDecklists } : {}),
    rows,
  };
}

function buildMacroLookup(
  macroByArchetype?: Record<string, string | null | undefined>,
): Map<string, string | null> {
  if (!macroByArchetype) {
    return defaultMacroByArchetype;
  }

  const lookup = new Map<string, string | null>();
  for (const [archetype, macro] of Object.entries(macroByArchetype)) {
    const archetypeKey = archetype.trim().toLowerCase();
    if (!archetypeKey) {
      continue;
    }
    const normalizedMacro = macro?.trim();
    lookup.set(archetypeKey, normalizedMacro ? normalizedMacro : null);
  }
  return lookup;
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
    lookup.set(
      deckname.toLowerCase(),
      normalizedMacro ? normalizedMacro : null,
    );
  }
  return lookup;
}

function buildKeyCardLookupFromArchetypesJson(): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const archetypeData of Object.values(
    archetypes as Record<string, ArchetypeDefinition>,
  )) {
    const keyCardName = archetypeData.required?.[0]?.trim();
    if (!keyCardName) {
      continue;
    }

    const deckname = archetypeData.deckname?.trim();
    if (deckname) {
      lookup.set(deckname.toLowerCase(), keyCardName);
    }

    const macro = archetypeData.macro?.trim();
    if (macro && !lookup.has(macro.toLowerCase())) {
      lookup.set(macro.toLowerCase(), keyCardName);
    }
  }
  return lookup;
}

export function getMetaBreakdownKeyCardName(archetype: string): string | null {
  const archetypeKey = archetype.trim().toLowerCase();
  if (!archetypeKey || archetypeKey === "other") {
    return null;
  }
  return defaultKeyCardByArchetype.get(archetypeKey) ?? null;
}

export function applyMetaBreakdownSettings(
  breakdown: MetaBreakdownResult,
  settings: MetaBreakdownSettings,
): MetaBreakdownRow[] {
  const minMetaPercent = Math.max(0, settings.minMetaPercent ?? 0);
  const maxRows = Math.max(0, settings.maxRows ?? breakdown.rows.length);
  const sortedRows = sortMetaBreakdownRows(breakdown.rows, settings.sortBy);
  const rowMeetsMinimumMetaPercent = (row: MetaBreakdownRow) =>
    getMetaPercentageForSettings(row, settings.sortBy) >= minMetaPercent;
  const visibleRows = sortedRows
    .filter(rowMeetsMinimumMetaPercent)
    .slice(0, maxRows);

  const hiddenRowsByThreshold = sortedRows.filter(
    (row) => !rowMeetsMinimumMetaPercent(row),
  );
  const hiddenRowsByMaxRows = sortedRows
    .filter(rowMeetsMinimumMetaPercent)
    .slice(maxRows);
  const hiddenRows = [...hiddenRowsByMaxRows, ...hiddenRowsByThreshold];

  if (hiddenRows.length === 0) {
    return visibleRows;
  }

  const hiddenCount = hiddenRows.reduce((sum, row) => sum + row.count, 0);
  const hiddenDay2Count = hiddenRows.reduce(
    (sum, row) => sum + (row.day2Count ?? 0),
    0,
  );
  const includeDay2Stats =
    breakdown.totalDay2KnownDecklists !== undefined ||
    breakdown.rows.some((row) => row.day2Count !== undefined);

  const otherRow: MetaBreakdownRow = {
    archetype: "Other",
    count: hiddenCount,
    percentage:
      breakdown.totalKnownDecklists === 0
        ? 0
        : (hiddenCount / breakdown.totalKnownDecklists) * 100,
  };

  if (includeDay2Stats) {
    const totalDay2KnownDecklists = breakdown.totalDay2KnownDecklists ?? 0;
    otherRow.day2Count = hiddenDay2Count;
    otherRow.day2Percentage =
      totalDay2KnownDecklists === 0
        ? 0
        : (hiddenDay2Count / totalDay2KnownDecklists) * 100;
    otherRow.conversionPercentage =
      hiddenCount === 0 ? 0 : (hiddenDay2Count / hiddenCount) * 100;
  }

  return [...visibleRows, otherRow];
}

function getMetaPercentageForSettings(
  row: MetaBreakdownRow,
  sortBy: MetaBreakdownSettings["sortBy"] = "day1Percentage",
): number {
  if (sortBy === "day2Percentage") {
    return row.day2Percentage ?? 0;
  }
  return row.percentage;
}

function sortMetaBreakdownRows(
  rows: MetaBreakdownRow[],
  sortBy: MetaBreakdownSettings["sortBy"] = "day1Percentage",
): MetaBreakdownRow[] {
  return [...rows].sort((a, b) => {
    if (sortBy === "day2Percentage") {
      const day2Difference = (b.day2Percentage ?? 0) - (a.day2Percentage ?? 0);
      if (day2Difference !== 0) {
        return day2Difference;
      }
    }

    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.archetype.localeCompare(b.archetype);
  });
}
