import {
  MeleeMatch,
  MeleePaginatedResponse,
  MeleePlayerListEntry,
  MeleeStanding,
  MeleeTournamentOverviewResponse,
  MeleeDecklistResponse,
} from "../../types/melee";
import { withRetry } from "../utils";
import { buildDecklistFromMeleeRecords, MeleeDecklist } from "./decklist";

const MELEE_BASE_URL = "https://melee.gg";
const DEFAULT_PAGE_SIZE = 250;
const REQUEST_TIMEOUT_MS = 20_000;
// Safety valve so a misbehaving HasMore flag can't loop forever
const MAX_PAGES = 100;

export interface MeleeCredentials {
  clientId: string;
  clientSecret: string;
}

/**
 * Build an HTTP Basic auth header. Encodes the UTF-8 bytes of
 * "clientId:clientSecret" manually rather than with btoa, which throws on
 * non-Latin1 characters (e.g. in client secrets).
 */
export function buildMeleeAuthHeader(credentials: MeleeCredentials): string {
  const BASE64_ALPHABET =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const bytes = new TextEncoder().encode(
    `${credentials.clientId}:${credentials.clientSecret}`,
  );

  let encoded = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const byte1 = bytes[i];
    const byte2 = bytes[i + 1];
    const byte3 = bytes[i + 2];

    encoded += BASE64_ALPHABET[byte1 >> 2];
    encoded += BASE64_ALPHABET[((byte1 & 0x03) << 4) | ((byte2 ?? 0) >> 4)];
    encoded +=
      byte2 === undefined
        ? "="
        : BASE64_ALPHABET[((byte2 & 0x0f) << 2) | ((byte3 ?? 0) >> 6)];
    encoded += byte3 === undefined ? "=" : BASE64_ALPHABET[byte3 & 0x3f];
  }

  return `Basic ${encoded}`;
}

async function meleeGet<T>(
  path: string,
  credentials: MeleeCredentials,
): Promise<T> {
  return withRetry(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${MELEE_BASE_URL}${path}`, {
        signal: controller.signal,
        headers: {
          Authorization: buildMeleeAuthHeader(credentials),
        },
      });
      if (!response.ok) {
        throw new Error(`Melee API request failed: ${response.status} ${path}`);
      }
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  });
}

/**
 * Page through a Melee list endpoint ({ Content[], HasMore, Page, ... })
 * and return the concatenated Content rows.
 */
export async function fetchAllMeleePages<T>(
  path: string,
  credentials: MeleeCredentials,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const separator = path.includes("?") ? "&" : "?";
    const data = await meleeGet<MeleePaginatedResponse<T>>(
      `${path}${separator}variables.page=${page}&variables.pageSize=${pageSize}`,
      credentials,
    );
    if (!Array.isArray(data.Content)) {
      throw new Error(`Invalid Melee API response structure for ${path}`);
    }
    rows.push(...data.Content);
    if (!data.HasMore) {
      return rows;
    }
  }

  throw new Error(`Exceeded ${MAX_PAGES} pages fetching ${path}`);
}

/**
 * Fetch the tournament overview (phases, rounds, status, timer).
 */
export async function fetchMeleeTournament(
  tournamentId: number,
  credentials: MeleeCredentials,
): Promise<MeleeTournamentOverviewResponse> {
  const data = await meleeGet<MeleeTournamentOverviewResponse>(
    `/api/tournament/${tournamentId}`,
    credentials,
  );
  if (!data.ID || !Array.isArray(data.Phases)) {
    throw new Error("Invalid Melee API response structure for tournament");
  }
  return data;
}

/**
 * Fetch all matches in the tournament's current round.
 */
export async function fetchMeleeCurrentRoundMatches(
  tournamentId: number,
  credentials: MeleeCredentials,
): Promise<MeleeMatch[]> {
  return fetchAllMeleePages<MeleeMatch>(
    `/api/match/list/current/${tournamentId}`,
    credentials,
  );
}

/**
 * Fetch all matches for a specific round.
 */
export async function fetchMeleeRoundMatches(
  roundId: number,
  credentials: MeleeCredentials,
): Promise<MeleeMatch[]> {
  return fetchAllMeleePages<MeleeMatch>(
    `/api/match/list/round/${roundId}`,
    credentials,
  );
}

/**
 * Fetch the most current standings for the tournament.
 */
export async function fetchMeleeCurrentStandings(
  tournamentId: number,
  credentials: MeleeCredentials,
): Promise<MeleeStanding[]> {
  return fetchAllMeleePages<MeleeStanding>(
    `/api/standing/list/current/${tournamentId}`,
    credentials,
  );
}

/**
 * Fetch standings as of a specific round.
 */
export async function fetchMeleeRoundStandings(
  roundId: number,
  credentials: MeleeCredentials,
): Promise<MeleeStanding[]> {
  return fetchAllMeleePages<MeleeStanding>(
    `/api/standing/list/round/${roundId}`,
    credentials,
  );
}

/**
 * Fetch all players registered in the tournament, including embedded
 * decklists (with card records) where submitted.
 */
export async function fetchMeleePlayerList(
  tournamentId: number,
  credentials: MeleeCredentials,
): Promise<MeleePlayerListEntry[]> {
  return fetchAllMeleePages<MeleePlayerListEntry>(
    `/api/player/list/${tournamentId}`,
    credentials,
  );
}

/**
 * Fetch a decklist by GUID and convert it to the internal
 * { deckname, decklist } plaintext shape.
 */
export async function fetchMeleeDecklist(
  decklistId: string,
  credentials: MeleeCredentials,
  eventFormat?: string,
): Promise<MeleeDecklist> {
  const data = await meleeGet<MeleeDecklistResponse>(
    `/api/decklist/${decklistId}`,
    credentials,
  );
  if (!Array.isArray(data.Records)) {
    throw new Error("Invalid Melee API response structure for decklist");
  }
  return {
    ...buildDecklistFromMeleeRecords({
      records: data.Records,
      formatName: eventFormat ?? data.FormatName,
      decklistName: data.DecklistName || data.Name || undefined,
    }),
    lastUpdated: data.LastUpdated ?? undefined,
  };
}
