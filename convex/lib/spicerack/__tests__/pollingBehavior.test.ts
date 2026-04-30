import { describe, expect, it } from "vitest";
import {
  parseAllowCompletedTournamentPolling,
  shouldStopPollingForCompletedTournament,
} from "../pollingBehavior";

describe("parseAllowCompletedTournamentPolling", () => {
  it("returns false when the flag is undefined", () => {
    expect(parseAllowCompletedTournamentPolling(undefined)).toBe(false);
  });

  it("returns true for common truthy values", () => {
    expect(parseAllowCompletedTournamentPolling("true")).toBe(true);
    expect(parseAllowCompletedTournamentPolling("TRUE")).toBe(true);
    expect(parseAllowCompletedTournamentPolling(" 1 ")).toBe(true);
    expect(parseAllowCompletedTournamentPolling("yes")).toBe(true);
    expect(parseAllowCompletedTournamentPolling("on")).toBe(true);
  });

  it("returns false for falsey values", () => {
    expect(parseAllowCompletedTournamentPolling("false")).toBe(false);
    expect(parseAllowCompletedTournamentPolling("0")).toBe(false);
    expect(parseAllowCompletedTournamentPolling("no")).toBe(false);
  });
});

describe("shouldStopPollingForCompletedTournament", () => {
  it("does not stop polling when the tournament is not completed", () => {
    expect(
      shouldStopPollingForCompletedTournament({
        isCompleted: false,
        allowCompletedTournamentPolling: false,
      }),
    ).toBe(false);
  });

  it("stops polling when completed and override is disabled", () => {
    expect(
      shouldStopPollingForCompletedTournament({
        isCompleted: true,
        allowCompletedTournamentPolling: false,
      }),
    ).toBe(true);
  });

  it("keeps polling when completed and override is enabled", () => {
    expect(
      shouldStopPollingForCompletedTournament({
        isCompleted: true,
        allowCompletedTournamentPolling: true,
      }),
    ).toBe(false);
  });
});
