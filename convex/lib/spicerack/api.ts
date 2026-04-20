import {
  Decklist,
  SpicerackEventResponse,
  SpicerackRegisteredPlayersResponse,
  SpicerackTournamentPhase,
  SpicerackRoundStandings,
} from "../../types/spicerack";
import { classifyDecknameForFormat } from "./deckClassification";
import { withRetry } from "../utils";

/**
 * Fetch Spicerack event data with retry logic
 * @param spicerackTournamentId - The ID of the Spicerack tournament
 * @param spicerackApiKey - The API key for the Spicerack API
 * @returns The Spicerack event data JSON
 */
export async function fetchSpicerackEventData(
  spicerackTournamentId: number,
  spicerackApiKey: string,
): Promise<SpicerackEventResponse> {
  return withRetry(async () => {
    const response = await fetch(
      `https://api.spicerack.gg/api/v1/magic-events/${spicerackTournamentId}`,
      {
        headers: {
          "X-API-Key": spicerackApiKey,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();

    // Basic validation
    if (!data.id || !data.tournament_phases) {
      throw new Error("Invalid API response structure");
    }
    return data;
  });
}

/**
 * Fetch Spicerack decklist data with retry logic
 * @param spicerackDecklistId - The ID of the Spicerack decklist
 * @param spicerackApiKey - The API key for the Spicerack API
 * @returns deckname
 * @returns decklist
 * @throws Error if the API request fails or the response is invalid
 */
export async function fetchSpicerackDecklistData(
  spicerackDecklistId: number,
  spicerackApiKey: string,
  eventFormat?: string,
): Promise<Decklist> {
  return withRetry(async () => {
    if (spicerackDecklistId === -1) {
      return {
        deckname: "Unknown",
        decklist: "Unknown",
      };
    }
    const response = await fetch(
      `https://api.spicerack.gg/api/v1/decklists/${spicerackDecklistId}`,
      {
        headers: {
          "X-API-Key": spicerackApiKey,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch decklist: ${response.status}`);
    }
    const jsonData = await response.json();

    // Basic validation
    if (!jsonData.archetype || !jsonData.plaintext_list) {
      throw new Error("Invalid API response structure");
    }
    const deckname = classifyDecknameForFormat({
      eventFormat,
      existingArchetype: jsonData.archetype,
      plaintextList: jsonData.plaintext_list,
    });

    return {
      deckname,
      decklist: jsonData.plaintext_list,
    };
  });
}

/**
 *
 * @param spicerackTournamentId - The ID of the Spicerack tournament
 * @param spicerackApiKey - The API key for the Spicerack API
 * @returns The event status
 * @returns The event ID
 * @throws Error if the API request fails or the response is invalid
 */
export async function fetchSpicerackEventOverviewData(
  spicerackTournamentId: number,
  spicerackApiKey: string,
): Promise<{
  id: number;
  event_status: string;
  current_round_id?: number;
  current_round_number?: number;
}> {
  return withRetry(async () => {
    const response = await fetch(
      `https://api.spicerack.gg/api/v1/magic-events/${spicerackTournamentId}/overview`,
      {
        headers: {
          "X-API-Key": spicerackApiKey,
        },
      },
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch tournament overview data: ${response.status}`,
      );
    }
    const jsonData = await response.json();

    // Basic validation
    if (
      !jsonData.id ||
      !jsonData.lifecycle_status ||
      !jsonData.tournament_phases
    ) {
      throw new Error("Invalid API response structure");
    }

    const event_status =
      jsonData.lifecycle_status === "EVENT_FINISHED" ||
      jsonData.tournament_phases.every(
        (phase: SpicerackTournamentPhase) => phase.status === "COMPLETE",
      )
        ? "COMPLETED"
        : "IN_PROGRESS";
    const currentRoundId =
      typeof jsonData.current_round?.id === "number"
        ? jsonData.current_round.id
        : undefined;
    const currentRoundNumber =
      typeof jsonData.current_round?.round_number === "number"
        ? jsonData.current_round.round_number
        : undefined;
    return {
      id: jsonData.id,
      event_status,
      current_round_id: currentRoundId,
      current_round_number: currentRoundNumber,
    };
  });
}

export async function fetchSpicerackRegisteredPlayers(
  spicerackTournamentId: number,
  spicerackApiKey: string,
): Promise<SpicerackRegisteredPlayersResponse[]> {
  return withRetry(async () => {
    const response = await fetch(
      `https://api.spicerack.gg/api/v1/magic-events/${spicerackTournamentId}/registrations`,
      {
        headers: {
          "X-API-Key": spicerackApiKey,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch registered players: ${response.status}`);
    }
    const jsonData = await response.json();
    return jsonData;
  });
}

/**
 * Fetch Spicerack round standings data with retry logic
 * @param spicerackRoundId - The ID of the Spicerack round
 * @param spicerackApiKey - The API key for the Spicerack API
 * @returns The round number
 * @returns The round standings data
 * @throws Error if the API request fails or the response is invalid
 */
export async function fetchSpicerackRoundStandingsData(
  spicerackRoundId: number,
  spicerackApiKey: string,
): Promise<SpicerackRoundStandings> {
  return withRetry(async () => {
    const response = await fetch(
      `https://api.spicerack.gg/api/v1/tournament-rounds/${spicerackRoundId}/standings`,
      {
        headers: {
          "X-API-Key": spicerackApiKey,
        },
      },
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch round standings data: ${response.status}`,
      );
    }
    const jsonData = await response.json();

    if (!jsonData.round_number || !jsonData.standings) {
      throw new Error("Invalid API response structure");
    }
    return {
      round_number: jsonData.round_number,
      standings: jsonData.standings,
    };
  });
}
