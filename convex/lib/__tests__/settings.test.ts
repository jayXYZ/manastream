import { describe, expect, it } from "vitest";

import { getMeleeCredentialsForTournament } from "../settings";

describe("getMeleeCredentialsForTournament", () => {
  it("loads credentials at action execution time from the tournament owner", async () => {
    const ctx = {
      db: {
        get: () => Promise.resolve({ _id: "tournament", userId: "user-1" }),
        query(tableName: string) {
          expect(tableName).toBe("settings");
          return {
            withIndex() {
              return {
                unique: () =>
                  Promise.resolve({
                    userId: "user-1",
                    meleeClientId: "client-id",
                    meleeClientSecret: "client-secret",
                  }),
              };
            },
          };
        },
      },
    } as never;

    await expect(
      getMeleeCredentialsForTournament(ctx, "tournament" as never),
    ).resolves.toEqual({
      clientId: "client-id",
      clientSecret: "client-secret",
    });
  });
});
