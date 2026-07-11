import { describe, expect, it } from "vitest";

import { deleteOldIntegrationLogsBatch } from "../logging";

describe("deleteOldIntegrationLogsBatch", () => {
  it("uses the timestamp index and reports when another batch is needed", async () => {
    const rows = Array.from({ length: 500 }, (_, index) => ({
      _id: `log-${index}`,
    }));
    const deleted: string[] = [];
    let selectedIndex = "";
    let requestedBatchSize = 0;
    const ctx = {
      db: {
        query(tableName: string) {
          expect(tableName).toBe("integrationLogs");
          return {
            withIndex(
              indexName: string,
              range: (q: { lt: () => null }) => unknown,
            ) {
              selectedIndex = indexName;
              range({ lt: () => null });
              return {
                take(batchSize: number) {
                  requestedBatchSize = batchSize;
                  return Promise.resolve(rows);
                },
              };
            },
          };
        },
        delete(id: string) {
          deleted.push(id);
          return Promise.resolve();
        },
      },
    } as never;

    await expect(deleteOldIntegrationLogsBatch(ctx, 1234)).resolves.toBe(true);
    expect(selectedIndex).toBe("by_timestamp");
    expect(requestedBatchSize).toBe(500);
    expect(deleted).toHaveLength(500);
  });

  it("stops when the final partial batch is deleted", async () => {
    const ctx = {
      db: {
        query() {
          return {
            withIndex() {
              return {
                take: () => Promise.resolve([{ _id: "last-log" }]),
              };
            },
          };
        },
        delete: () => Promise.resolve(),
      },
    } as never;

    await expect(deleteOldIntegrationLogsBatch(ctx, 1234)).resolves.toBe(false);
  });
});
