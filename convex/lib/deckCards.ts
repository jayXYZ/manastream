export const CARD_IMAGE_POLICY = "oldestNonReprint:v1" as const;
export const BASIC_LAND_SET_CODE = "LEB" as const;
export const SCRYFALL_ACCEPT_HEADER = "application/json;q=0.9,*/*;q=0.8";
export const SCRYFALL_USER_AGENT = "manastream.app deck overlay/1.0";

const SCRYFALL_API_URL = "https://api.scryfall.com";
const BASIC_LANDS = new Set([
  "Plains",
  "Island",
  "Swamp",
  "Mountain",
  "Forest",
]);

export type DeckSectionName = "mainboard" | "sideboard";

export interface ParsedDeckCard {
  count: number;
  name: string;
}

export interface ParsedDecklist {
  mainboard: ParsedDeckCard[];
  sideboard: ParsedDeckCard[];
}

export interface ResolvedCardMetadata {
  name: string;
  imageUrl?: string;
  typeLine: string;
  legality?: string;
  scryfallId?: string;
  unresolved?: boolean;
}

export interface ResolvedDeckCard extends ResolvedCardMetadata {
  count: number;
}

export interface ResolvedDeckCards {
  mainboard: ResolvedDeckCard[];
  sideboard: ResolvedDeckCard[];
  unresolvedNames: string[];
  resolvedAt: number;
}

interface ScryfallCardFace {
  image_uris?: {
    png?: string;
  };
}

export interface ScryfallCardLike {
  id?: string;
  name?: string;
  image_uris?: {
    png?: string;
  };
  card_faces?: ScryfallCardFace[];
  type_line?: string;
  legalities?: {
    premodern?: string;
  };
}

export interface ScryfallRequest {
  url: string;
  headers: {
    Accept: string;
    "User-Agent": string;
  };
}

export function normalizeCardName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

export function getCardCacheKey(name: string): string {
  return `${CARD_IMAGE_POLICY}:${normalizeCardName(name)}`;
}

export function parseDecklist(decklist: string): ParsedDecklist {
  const [mainboardStr, sideboardStr] = decklist.split(/\nSIDEBOARD:\n/i);

  return {
    mainboard: parseSection(mainboardStr ?? ""),
    sideboard: parseSection(sideboardStr ?? ""),
  };
}

export function buildScryfallRequest(name: string): ScryfallRequest {
  const url = new URL(
    BASIC_LANDS.has(name) ? "/cards/named" : "/cards/search",
    SCRYFALL_API_URL,
  );

  if (BASIC_LANDS.has(name)) {
    url.searchParams.set("exact", name);
    url.searchParams.set("set", BASIC_LAND_SET_CODE);
  } else {
    url.searchParams.set("q", `!"${name}" not:reprint`);
    url.searchParams.set("unique", "prints");
    url.searchParams.set("order", "released");
    url.searchParams.set("dir", "asc");
    url.searchParams.set("page", "1");
  }

  return {
    url: url.toString(),
    headers: {
      Accept: SCRYFALL_ACCEPT_HEADER,
      "User-Agent": SCRYFALL_USER_AGENT,
    },
  };
}

export function mapScryfallCard(
  requestedName: string,
  card: ScryfallCardLike | undefined,
): ResolvedCardMetadata {
  if (!card) {
    return createUnresolvedCard(requestedName);
  }

  const imageUrl = card.image_uris?.png ?? card.card_faces?.[0]?.image_uris?.png;
  if (!imageUrl || !card.type_line) {
    return createUnresolvedCard(requestedName);
  }

  return {
    name: requestedName,
    imageUrl,
    typeLine: card.type_line,
    legality: card.legalities?.premodern,
    scryfallId: card.id,
  };
}

export function createUnresolvedCard(name: string): ResolvedCardMetadata {
  return {
    name,
    typeLine: "Unknown",
    unresolved: true,
  };
}

export function isRetryableCachedFailure(lastError: string | undefined): boolean {
  return (
    !lastError ||
    lastError === "Card could not be resolved" ||
    lastError.startsWith("Transient Scryfall failure")
  );
}

export function isCacheableScryfallFailure(status: number): boolean {
  return status === 404;
}

export function buildResolvedDeckCards(
  parsedDecklist: ParsedDecklist,
  cardMetadataByName: Map<string, ResolvedCardMetadata>,
  resolvedAt = Date.now(),
): ResolvedDeckCards {
  const unresolvedNames = new Set<string>();
  const mapSection = (cards: ParsedDeckCard[]) =>
    sortResolvedCards(
      cards.map((card) => {
        const metadata =
          cardMetadataByName.get(card.name) ?? createUnresolvedCard(card.name);
        if (metadata.unresolved) {
          unresolvedNames.add(card.name);
        }
        return {
          ...metadata,
          name: card.name,
          count: card.count,
        };
      }),
    );

  return {
    mainboard: mapSection(parsedDecklist.mainboard),
    sideboard: mapSection(parsedDecklist.sideboard),
    unresolvedNames: Array.from(unresolvedNames).sort((a, b) =>
      a.localeCompare(b),
    ),
    resolvedAt,
  };
}

function parseSection(section: string): ParsedDeckCard[] {
  const cardsByName = new Map<string, ParsedDeckCard>();

  for (const line of section.trim().split("\n")) {
    const match = line.trim().match(/^(\d+)\s+(.+)$/);
    if (!match) {
      continue;
    }

    const [, count, name] = match;
    const existing = cardsByName.get(name);
    if (existing) {
      existing.count += Number.parseInt(count, 10);
    } else {
      cardsByName.set(name, {
        count: Number.parseInt(count, 10),
        name,
      });
    }
  }

  return Array.from(cardsByName.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

function getTypeOrder(typeLine: string): number {
  if (typeLine.includes("Creature")) return 1;
  if (typeLine.includes("Instant")) return 2;
  if (typeLine.includes("Sorcery")) return 3;
  if (typeLine.includes("Enchantment")) return 4;
  if (typeLine.includes("Artifact")) return 5;
  if (typeLine.includes("Basic")) return 7;
  if (typeLine.includes("Land")) return 6;
  return 8;
}

function sortResolvedCards(cards: ResolvedDeckCard[]): ResolvedDeckCard[] {
  return [...cards].sort((a, b) => {
    const typeOrderA = getTypeOrder(a.typeLine);
    const typeOrderB = getTypeOrder(b.typeLine);
    if (typeOrderA !== typeOrderB) {
      return typeOrderA - typeOrderB;
    }
    if (a.count !== b.count) {
      return b.count - a.count;
    }
    return a.name.localeCompare(b.name);
  });
}
