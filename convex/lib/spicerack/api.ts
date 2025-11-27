import {
  Decklist,
  SpicerackEventResponse,
  SpicerackRegisteredPlayersResponse,
  SpicerackTournamentPhase,
} from "../../types/spicerack";
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
    return {
      deckname: jsonData.archetype,
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
  current_round_id: number;
  current_round_number: number;
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
    return {
      id: jsonData.id,
      event_status,
      current_round_id: jsonData.current_round.id,
      current_round_number: jsonData.current_round.round_number,
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
