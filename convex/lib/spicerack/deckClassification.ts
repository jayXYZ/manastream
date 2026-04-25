import archetypes from "./archetypes.json";

export type ArchetypeDefinition = {
  deckname?: string;
  required?: string[];
  conflicts?: string[];
};

export type ArchetypeDefinitions = Record<string, ArchetypeDefinition>;

const MAINDECK_CARD_LINE_PATTERN = /^(\d+)\s*x?\s+(.+)$/i;
const SIDEBOARD_HEADER_PATTERN = /^(sideboard|sb)\b[:\s-]*/i;
const SIDEBOARD_CARD_LINE_PATTERN = /^sb[:\s-]+/i;
const PREMODERN_FORMAT = "PREMODERN";

const defaultArchetypes = archetypes as ArchetypeDefinitions;

function normalizeCardNameForComparison(cardName: string): string {
  return cardName.trim().toLowerCase();
}

function normalizeCardName(rawCardName: string): string {
  return rawCardName
    .trim()
    .replace(/\s+#.*$/, "")
    .replace(/\s+\([^)]+\)\s+\d+[A-Za-z]*$/, "")
    .replace(/\s+\([^)]+\)$/, "")
    .trim();
}

export function parseMaindeckFromPlaintext(
  plaintextList: string,
): Record<string, number> {
  const maindeck: Record<string, number> = {};
  let inSideboardSection = false;

  for (const rawLine of plaintextList.split(/\r?\n/)) {
    const trimmedLine = rawLine.trim();
    if (!trimmedLine) {
      continue;
    }

    if (SIDEBOARD_HEADER_PATTERN.test(trimmedLine)) {
      inSideboardSection = true;
      continue;
    }

    if (SIDEBOARD_CARD_LINE_PATTERN.test(trimmedLine) || inSideboardSection) {
      continue;
    }

    const cardMatch = trimmedLine.match(MAINDECK_CARD_LINE_PATTERN);
    if (!cardMatch) {
      continue;
    }

    const quantity = Number(cardMatch[1]);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }

    const cardName = normalizeCardName(cardMatch[2]);
    if (!cardName) {
      continue;
    }

    maindeck[cardName] = (maindeck[cardName] ?? 0) + quantity;
  }

  return maindeck;
}

export function determineArchetype(
  maindeck: Record<string, number>,
  archetypeDefinitions: ArchetypeDefinitions = defaultArchetypes,
  existingArchetype?: string,
): string {
  if (
    Object.keys(maindeck).length === 0 &&
    existingArchetype &&
    existingArchetype !== "Unknown"
  ) {
    return existingArchetype;
  }

  const maindeckCards = new Set(
    Object.keys(maindeck).map(normalizeCardNameForComparison),
  );
  const matchedArchetypes: string[] = [];

  for (const [archetypeKey, archetypeData] of Object.entries(
    archetypeDefinitions,
  )) {
    const requiredCards = archetypeData.required ?? [];
    const conflicts = archetypeData.conflicts ?? [];
    const hasRequiredCards = requiredCards.every((card) =>
      maindeckCards.has(normalizeCardNameForComparison(card)),
    );
    const hasConflictCards = conflicts.some((card) =>
      maindeckCards.has(normalizeCardNameForComparison(card)),
    );

    if (hasRequiredCards && !hasConflictCards) {
      matchedArchetypes.push(archetypeData.deckname ?? archetypeKey);
    }
  }

  if (matchedArchetypes.length === 1) {
    return matchedArchetypes[0];
  }

  if (matchedArchetypes.length > 1) {
    return `CONFLICT (${matchedArchetypes.join(" / ")})`;
  }

  return "Unknown";
}

export function classifyDecknameForFormat(args: {
  eventFormat?: string;
  existingArchetype?: string;
  plaintextList: string;
  archetypes?: ArchetypeDefinitions;
}): string {
  if ((args.eventFormat ?? "").toUpperCase() !== PREMODERN_FORMAT) {
    return args.existingArchetype ?? "Unknown";
  }

  const maindeck = parseMaindeckFromPlaintext(args.plaintextList);
  return determineArchetype(
    maindeck,
    args.archetypes ?? defaultArchetypes,
    args.existingArchetype,
  );
}
