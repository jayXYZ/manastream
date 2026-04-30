import archetypes from "../convex/lib/spicerack/archetypes.json";

export type MetaBreakdownPlayer = {
  deckName: string;
  deckList: string;
};

export type MetaBreakdownRow = {
  archetype: string;
  count: number;
  percentage: number;
};

export type MetaBreakdownResult = {
  totalKnownDecklists: number;
  rows: MetaBreakdownRow[];
};

export type BuildMetaBreakdownOptions = {
  macroByArchetype?: Record<string, string | null | undefined>;
};

export type MetaBreakdownSettings = {
  minMetaPercent?: number;
  maxRows?: number;
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

const defaultMacroByArchetype = buildMacroLookupFromArchetypesJson();

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
  const macroByArchetype = buildMacroLookup(options.macroByArchetype);

  if (totalKnownDecklists === 0) {
    return {
      totalKnownDecklists: 0,
      rows: [],
    };
  }

  const grouped = new Map<string, { archetype: string; count: number }>();

  for (const player of knownDecklistPlayers) {
    const archetypeName = player.deckName.trim();
    const macroArchetype = macroByArchetype.get(archetypeName.toLowerCase());
    const archetype = macroArchetype || archetypeName;
    const key = archetype.toLowerCase();
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    grouped.set(key, { archetype, count: 1 });
  }

  const rows = Array.from(grouped.values())
    .map((entry) => ({
      archetype: entry.archetype,
      count: entry.count,
      percentage: (entry.count / totalKnownDecklists) * 100,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.archetype.localeCompare(b.archetype);
    });

  return {
    totalKnownDecklists,
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
    lookup.set(deckname.toLowerCase(), normalizedMacro ? normalizedMacro : null);
  }
  return lookup;
}

export function applyMetaBreakdownSettings(
  breakdown: MetaBreakdownResult,
  settings: MetaBreakdownSettings,
): MetaBreakdownRow[] {
  const minMetaPercent = Math.max(0, settings.minMetaPercent ?? 0);
  const maxRows = Math.max(0, settings.maxRows ?? breakdown.rows.length);
  const visibleRows = breakdown.rows
    .filter((row) => row.percentage >= minMetaPercent)
    .slice(0, maxRows);

  const hiddenRowsByThreshold = breakdown.rows.filter(
    (row) => row.percentage < minMetaPercent,
  );
  const hiddenRowsByMaxRows = breakdown.rows
    .filter((row) => row.percentage >= minMetaPercent)
    .slice(maxRows);
  const hiddenRows = [...hiddenRowsByMaxRows, ...hiddenRowsByThreshold];

  if (hiddenRows.length === 0) {
    return visibleRows;
  }

  const otherRow = hiddenRows.reduce<MetaBreakdownRow>(
    (aggregate, row) => ({
      archetype: "Other",
      count: aggregate.count + row.count,
      percentage: aggregate.percentage + row.percentage,
    }),
    {
      archetype: "Other",
      count: 0,
      percentage: 0,
    },
  );

  return [...visibleRows, otherRow];
}
