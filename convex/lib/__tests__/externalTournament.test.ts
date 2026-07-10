import { describe, expect, it } from "vitest";

import { updateExternalTournamentHelper } from "../externalTournament";

describe("updateExternalTournamentHelper", () => {
  it("persists every round when a tournament completes", async () => {
    const patches: { id: string; value: Record<string, unknown> }[] = [];
    const externalTournament = {
      _id: "external-tournament",
      externalTournamentId: 9001,
    };
    const ctx = {
      db: {
        query() {
          return {
            withIndex() {
              return {
                unique: () => Promise.resolve(externalTournament),
              };
            },
          };
        },
        patch(id: string, value: Record<string, unknown>) {
          patches.push({ id, value });
          return Promise.resolve();
        },
      },
    } as never;

    const completedRounds = [
      { roundId: 101, roundName: "Round 1" },
      { roundId: 102, roundName: "Finals" },
    ];
    await updateExternalTournamentHelper(ctx, 9001, { completedRounds });

    expect(patches).toHaveLength(1);
    expect(patches[0]).toMatchObject({
      id: "external-tournament",
      value: { completedRounds },
    });
  });
});
