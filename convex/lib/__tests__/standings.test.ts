import { describe, expect, it } from "vitest";

import {
  markRoundStandingsFetchFailedHelper,
  updateRoundStandingsHelper,
} from "../standings";

describe("round standings fetch state", () => {
  it("records a failed fetch as retryable error state", async () => {
    const patches: Record<string, unknown>[] = [];
    const ctx = makeCtx(patches);

    await markRoundStandingsFetchFailedHelper(
      ctx,
      "standings-id" as never,
      "Melee unavailable",
    );

    expect(patches[0]).toMatchObject({
      standings: "ERROR",
      lastError: "Melee unavailable",
    });
  });

  it("clears the previous error after a successful retry", async () => {
    const patches: Record<string, unknown>[] = [];
    const ctx = makeCtx(patches);

    await updateRoundStandingsHelper(ctx, "standings-id" as never, {
      roundNumber: 4,
      standings: [],
    });

    expect(patches[0]).toMatchObject({
      roundNumber: 4,
      standings: [],
      lastError: undefined,
    });
  });
});

function makeCtx(patches: Record<string, unknown>[]) {
  return {
    db: {
      patch(_id: string, value: Record<string, unknown>) {
        patches.push(value);
        return Promise.resolve();
      },
    },
  } as never;
}
