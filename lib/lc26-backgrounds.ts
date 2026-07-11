import archetypes from "../convex/lib/deckClassification/archetypes.json";

export const LC26_BACKGROUND_COLORS = [
  "White",
  "Blue",
  "Black",
  "Red",
  "Green",
  "Gold",
] as const;

export type Lc26BackgroundColor = (typeof LC26_BACKGROUND_COLORS)[number];

type RawArchetype = {
  deckname?: string;
  color?: string;
};

const COLOR_TO_IMAGE_PATH: Record<Lc26BackgroundColor, string> = {
  White: "/images/overlays/lc26/white_final.png",
  Blue: "/images/overlays/lc26/blue_final.png",
  Black: "/images/overlays/lc26/black_final.png",
  Red: "/images/overlays/lc26/red_final.png",
  Green: "/images/overlays/lc26/green_final.png",
  Gold: "/images/overlays/lc26/gold_final.png",
};

const COLOR_NORMALIZATION_MAP: Record<string, Lc26BackgroundColor> = {
  white: "White",
  blue: "Blue",
  black: "Black",
  red: "Red",
  green: "Green",
  gold: "Gold",
};

function normalizeDeckLookupValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ");
}

export function normalizeLc26BackgroundColor(
  value: string | undefined,
): Lc26BackgroundColor | undefined {
  if (!value) return undefined;
  return COLOR_NORMALIZATION_MAP[value.trim().toLowerCase()];
}

const deckNameToColorMap = new Map<string, Lc26BackgroundColor>();
const rawArchetypes = archetypes as Record<string, RawArchetype>;

for (const [archetypeKey, archetypeData] of Object.entries(rawArchetypes)) {
  const color = normalizeLc26BackgroundColor(archetypeData.color);
  if (!color) continue;

  const normalizedKey = normalizeDeckLookupValue(archetypeKey);
  const normalizedDeckName = normalizeDeckLookupValue(archetypeData.deckname);

  if (normalizedKey) {
    deckNameToColorMap.set(normalizedKey, color);
  }
  if (normalizedDeckName) {
    deckNameToColorMap.set(normalizedDeckName, color);
  }
}

export function getLc26BackgroundColorFromDeckName(
  deckName: string | undefined,
): Lc26BackgroundColor | undefined {
  const normalizedDeckName = normalizeDeckLookupValue(deckName);
  if (!normalizedDeckName) return undefined;
  return deckNameToColorMap.get(normalizedDeckName);
}

export function getLc26BackgroundImageForColor(
  color: Lc26BackgroundColor,
): string {
  return COLOR_TO_IMAGE_PATH[color];
}

export function getLc26BackgroundImageForPlayer({
  overrideColor,
  displayDeckName,
  playerDeckName,
  fallbackColor,
}: {
  overrideColor?: string;
  displayDeckName?: string;
  playerDeckName?: string;
  fallbackColor: Lc26BackgroundColor;
}): {
  color: Lc26BackgroundColor;
  backgroundImage: string;
} {
  const normalizedOverrideColor = normalizeLc26BackgroundColor(overrideColor);
  if (normalizedOverrideColor) {
    return {
      color: normalizedOverrideColor,
      backgroundImage: getLc26BackgroundImageForColor(normalizedOverrideColor),
    };
  }

  const detectedColor =
    getLc26BackgroundColorFromDeckName(displayDeckName) ??
    getLc26BackgroundColorFromDeckName(playerDeckName);
  if (detectedColor) {
    return {
      color: detectedColor,
      backgroundImage: getLc26BackgroundImageForColor(detectedColor),
    };
  }

  return {
    color: fallbackColor,
    backgroundImage: getLc26BackgroundImageForColor(fallbackColor),
  };
}
