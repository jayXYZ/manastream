import { describe, expect, it } from "vitest";

import {
  deleteStaleLifeTrackersBatch,
  LIFE_TRACKER_CLEANUP_BATCH_SIZE,
} from "../presence";

describe("deleteStaleLifeTrackersBatch", () => {
  it("uses the lastSeen index and reports when another batch is needed", async () => {
    const rows = Array.from(
      { length: LIFE_TRACKER_CLEANUP_BATCH_SIZE },
      (_, index) => ({ _id: `tracker-${index}` }),
    );
    const deleted: string[] = [];
    let selectedTable = "";
    let selectedIndex = "";
    let cutoffUsed: unknown = null;
    let requestedBatchSize = 0;
    const ctx = {
      db: {
        query(tableName: string) {
          selectedTable = tableName;
          return {
            withIndex(
              indexName: string,
              range: (q: {
                lt: (field: string, value: unknown) => null;
              }) => unknown,
            ) {
              selectedIndex = indexName;
              range({
                lt: (field, value) => {
                  expect(field).toBe("lastSeen");
                  cutoffUsed = value;
                  return null;
                },
              });
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

    await expect(deleteStaleLifeTrackersBatch(ctx, 1234)).resolves.toBe(true);
    expect(selectedTable).toBe("connectedLifeTrackers");
    expect(selectedIndex).toBe("by_last_seen");
    expect(cutoffUsed).toBe(1234);
    expect(requestedBatchSize).toBe(LIFE_TRACKER_CLEANUP_BATCH_SIZE);
    expect(deleted).toHaveLength(LIFE_TRACKER_CLEANUP_BATCH_SIZE);
  });

  it("stops when the final partial batch is deleted", async () => {
    const ctx = {
      db: {
        query() {
          return {
            withIndex() {
              return {
                take: () => Promise.resolve([{ _id: "last-tracker" }]),
              };
            },
          };
        },
        delete: () => Promise.resolve(),
      },
    } as never;

    await expect(deleteStaleLifeTrackersBatch(ctx, 1234)).resolves.toBe(false);
  });
});
