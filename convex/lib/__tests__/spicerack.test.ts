import { describe, expect, it } from "vitest";
import { parsePlayerTournamentRecord } from "../../models/spicerack";
import type {
  SpicerackEventResponse,
  SpicerackUserEventStatus,
} from "../../types/spicerack";

function buildEvent(roundType: string): SpicerackEventResponse {
  return {
    id: 1,
    name: "Test Event",
    event_format: "STANDARD",
    start_datetime: "2026-04-26T12:00:00Z",
    settings: {
      id: 1,
      event_lifecycle_status: "IN_PROGRESS",
    },
    current_round_number: 8,
    enrolled_player_count: 8,
    user_statuses: [],
    featured_matches: [],
    tournament_phases: [
      {
        id: 1,
        order_in_phases: 1,
        round_type: roundType,
        status: "IN_PROGRESS",
        rounds: [],
      },
    ],
  };
}

function buildPlayerStatus(
  overrides: Partial<SpicerackUserEventStatus> = {},
): SpicerackUserEventStatus {
  return {
    id: 10,
    user: {
      id: 20,
      username: "player",
      best_identifier: "Player",
    },
    decklist: 30,
    registration_status: "REGISTERED",
    final_place_in_standings: -1,
    matches_won: 7,
    matches_lost: 1,
    matches_drawn: 0,
    total_match_points: 21,
    ...overrides,
  };
}

describe("Spicerack record formatting", () => {
  it("formats Swiss rounds as match records", () => {
    expect(
      parsePlayerTournamentRecord(buildEvent("SWISS"), buildPlayerStatus()),
    ).toBe("7-1");
  });

  it("formats elimination rounds as Swiss finish seeds", () => {
    expect(
      parsePlayerTournamentRecord(
        buildEvent("SINGLE_ELIMINATION"),
        buildPlayerStatus({ final_place_in_standings: 3 }),
      ),
    ).toBe("#3");
  });
});
