import { describe, expect, it } from "vitest";
import {
  canClaimPollingCycleExecution,
  canClaimPollingSession,
  hasExternalTournamentChanged,
  isPollingCycleCurrent,
  isPollingSessionCurrent,
  parseAllowCompletedTournamentPolling,
  pollingCycleFailureUpdates,
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

describe("hasExternalTournamentChanged", () => {
  it("detects a replacement tournament while auto sync is active", () => {
    expect(
      hasExternalTournamentChanged({
        currentExternalTournamentId: 101,
        requestedExternalTournamentId: 202,
      }),
    ).toBe(true);
  });

  it("does not restart for an omitted or unchanged tournament id", () => {
    expect(
      hasExternalTournamentChanged({
        currentExternalTournamentId: 101,
      }),
    ).toBe(false);
    expect(
      hasExternalTournamentChanged({
        currentExternalTournamentId: 101,
        requestedExternalTournamentId: 101,
      }),
    ).toBe(false);
  });
});

describe("polling session ownership", () => {
  it("allows exactly one active session to claim a tournament", () => {
    expect(
      canClaimPollingSession({
        mode: "auto",
        pollingStatus: "inactive",
        currentExternalTournamentId: 101,
        expectedExternalTournamentId: 101,
      }),
    ).toBe(true);
    expect(
      canClaimPollingSession({
        mode: "auto",
        pollingStatus: "active",
        pollingSessionId: "existing-session",
        currentExternalTournamentId: 101,
        expectedExternalTournamentId: 101,
      }),
    ).toBe(false);
  });

  it("rejects stale validation work after the tournament changes", () => {
    expect(
      canClaimPollingSession({
        mode: "auto",
        pollingStatus: "inactive",
        currentExternalTournamentId: 202,
        expectedExternalTournamentId: 101,
      }),
    ).toBe(false);
  });

  it("accepts only the current active polling token", () => {
    expect(
      isPollingSessionCurrent({
        mode: "auto",
        pollingStatus: "active",
        pollingSessionId: "current-session",
        expectedPollingSessionId: "current-session",
      }),
    ).toBe(true);
    expect(
      isPollingSessionCurrent({
        mode: "auto",
        pollingStatus: "active",
        pollingSessionId: "new-session",
        expectedPollingSessionId: "stale-session",
      }),
    ).toBe(false);
  });

  it("accepts only the current polling cycle", () => {
    expect(
      isPollingCycleCurrent({
        pollingSessionId: "session-1",
        pollingCycleId: "cycle-1",
        expectedPollingSessionId: "session-1",
        expectedPollingCycleId: "cycle-1",
      }),
    ).toBe(true);
    expect(
      isPollingCycleCurrent({
        pollingSessionId: "session-1",
        pollingCycleId: "new-cycle",
        expectedPollingSessionId: "session-1",
        expectedPollingCycleId: "stale-cycle",
      }),
    ).toBe(false);
  });

  it("allows only one execution to claim a scheduled cycle", () => {
    const scheduledCycle = {
      mode: "auto" as const,
      pollingStatus: "active" as const,
      pollingSessionId: "session-1",
      pollingCycleId: "cycle-1",
      expectedPollingSessionId: "session-1",
      expectedPollingCycleId: "cycle-1",
    };

    expect(canClaimPollingCycleExecution(scheduledCycle)).toBe(true);
    expect(
      canClaimPollingCycleExecution({
        ...scheduledCycle,
        pollingCycleStartedAt: Date.now(),
      }),
    ).toBe(false);
  });

  it("clears an orphaned active session when a cycle fails", () => {
    expect(pollingCycleFailureUpdates("Polling timed out")).toEqual({
      mode: "manual",
      pollingStatus: "error",
      pollingErrorMessage: "Polling timed out",
      pollingSessionId: undefined,
      pollingCycleId: undefined,
      pollingCycleStartedAt: undefined,
    });
  });
});
