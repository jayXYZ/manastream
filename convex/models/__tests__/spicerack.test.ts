import { describe, expect, it } from "vitest";
import {
  getCurrentRoundDisplayName,
  getRoundDisplayName,
  parseCompletedRounds,
  parseCurrentSpicerackRound,
} from "../spicerack";
import {
  SpicerackEventResponse,
  SpicerackMatch,
  SpicerackRound,
} from "../../types/spicerack";

describe("parseCurrentSpicerackRound", () => {
  it("uses the next upcoming round when the in-progress round has all matches complete", () => {
    const event = makeEvent([
      makeRound({
        id: 101,
        roundNumber: 1,
        status: "IN_PROGRESS",
        matches: [
          makeMatch({ id: 1001, status: "COMPLETE" }),
          makeMatch({ id: 1002, status: "COMPLETE" }),
        ],
      }),
      makeRound({
        id: 102,
        roundNumber: 2,
        status: "UPCOMING",
        matches: [makeMatch({ id: 2001, status: "UPCOMING" })],
      }),
    ]);

    expect(parseCurrentSpicerackRound(event)?.id).toBe(102);
  });
});

describe("getCurrentRoundDisplayName", () => {
  it("labels current elimination rounds after multiple Swiss phases", () => {
    const event = makeMultiPhaseEvent();

    expect(getCurrentRoundDisplayName(event)).toBe("Quarterfinals");
  });

  it("falls back to the numeric round name for unknown phase types", () => {
    const event = makeEvent([
      makeRound({
        id: 301,
        roundNumber: 12,
        status: "IN_PROGRESS",
        matches: [makeMatch({ id: 3001, status: "IN_PROGRESS" })],
      }),
    ]);
    event.tournament_phases[0].round_type = "DOUBLE_ELIMINATION";

    expect(getCurrentRoundDisplayName(event)).toBe("Round 12");
  });

  it("keeps round zero player meetings displayable", () => {
    const event = makeEvent([
      makeRound({
        id: 401,
        roundNumber: 0,
        status: "IN_PROGRESS",
        matches: [makeMatch({ id: 4001, status: "IN_PROGRESS" })],
      }),
    ]);

    expect(getCurrentRoundDisplayName(event)).toBe("Round 0");
  });
});

describe("getRoundDisplayName", () => {
  it("labels elimination rounds after multiple Swiss phases", () => {
    const event = makeMultiPhaseEvent();

    expect(getRoundDisplayName(801, event)).toBe("Quarterfinals");
    expect(getRoundDisplayName(802, event)).toBe("Semifinals");
    expect(getRoundDisplayName(803, event)).toBe("Finals");
  });
});

describe("parseCompletedRounds", () => {
  it("lists actual completed standings rounds before the derived current round", () => {
    const event = makeEvent([
      makeRound({
        id: 400,
        roundNumber: 0,
        status: "COMPLETE",
        matches: [makeMatch({ id: 4000, status: "COMPLETE" })],
      }),
      makeRound({
        id: 101,
        roundNumber: 1,
        status: "IN_PROGRESS",
        matches: [
          makeMatch({ id: 1001, status: "COMPLETE" }),
          makeMatch({ id: 1002, status: "COMPLETE" }),
        ],
      }),
      makeRound({
        id: 102,
        roundNumber: 2,
        status: "UPCOMING",
        matches: [makeMatch({ id: 2001, status: "UPCOMING" })],
      }),
    ]);

    expect(parseCompletedRounds(event)).toEqual([
      { roundId: 101, roundName: "Round 1" },
    ]);
  });
});

function makeEvent(rounds: SpicerackRound[]): SpicerackEventResponse {
  return {
    id: 1,
    name: "Test Event",
    event_format: "PREMODERN",
    start_datetime: "2026-04-25T00:00:00Z",
    settings: {
      id: 1,
      event_lifecycle_status: "IN_PROGRESS",
    },
    current_round_number: 1,
    enrolled_player_count: 2,
    user_statuses: [],
    featured_matches: [],
    tournament_phases: [
      {
        id: 10,
        order_in_phases: 0,
        round_type: "SWISS",
        status: "IN_PROGRESS",
        rounds,
      },
    ],
  };
}

function makeMultiPhaseEvent(): SpicerackEventResponse {
  return {
    ...makeEvent([]),
    current_round_number: 8,
    tournament_phases: [
      {
        id: 10,
        order_in_phases: 0,
        round_type: "SWISS",
        status: "COMPLETE",
        rounds: [
          makeRound({
            id: 101,
            roundNumber: 1,
            status: "COMPLETE",
            matches: [makeMatch({ id: 1001, status: "COMPLETE" })],
          }),
          makeRound({
            id: 103,
            roundNumber: 3,
            status: "COMPLETE",
            matches: [makeMatch({ id: 3001, status: "COMPLETE" })],
          }),
        ],
      },
      {
        id: 20,
        order_in_phases: 1,
        round_type: "SWISS",
        status: "COMPLETE",
        rounds: [
          makeRound({
            id: 200,
            roundNumber: 0,
            status: "COMPLETE",
            matches: [makeMatch({ id: 2000, status: "COMPLETE" })],
          }),
          makeRound({
            id: 207,
            roundNumber: 7,
            status: "COMPLETE",
            matches: [makeMatch({ id: 7001, status: "COMPLETE" })],
          }),
        ],
      },
      {
        id: 30,
        order_in_phases: 2,
        round_type: "SINGLE_ELIMINATION",
        status: "IN_PROGRESS",
        rounds: [
          makeRound({
            id: 801,
            roundNumber: 8,
            status: "IN_PROGRESS",
            matches: [makeMatch({ id: 8001, status: "IN_PROGRESS" })],
          }),
          makeRound({
            id: 802,
            roundNumber: 9,
            status: "UPCOMING",
            matches: [makeMatch({ id: 9001, status: "UPCOMING" })],
          }),
          makeRound({
            id: 803,
            roundNumber: 10,
            status: "UPCOMING",
            matches: [makeMatch({ id: 10001, status: "UPCOMING" })],
          }),
        ],
      },
    ],
  };
}

function makeRound(args: {
  id: number;
  roundNumber: number;
  status: string;
  matches: SpicerackMatch[];
}): SpicerackRound {
  return {
    id: args.id,
    round_number: args.roundNumber,
    status: args.status,
    matches: args.matches,
  };
}

function makeMatch(args: { id: number; status: string }): SpicerackMatch {
  return {
    id: args.id,
    status: args.status,
    is_feature_match: false,
    table_number: args.id,
    player_match_relationships: [],
  };
}
