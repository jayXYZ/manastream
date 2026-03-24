import { describe, it, expect } from "vitest";
import { generatePublicUuid } from "../utils";

describe("generatePublicUuid", () => {
  it("should generate a string of at least 16 characters", () => {
    const uuid = generatePublicUuid();
    expect(uuid.length).toBeGreaterThanOrEqual(16);
  });

  it("should only contain URL-safe characters (alphanumeric, hyphen, underscore)", () => {
    for (let i = 0; i < 100; i++) {
      const uuid = generatePublicUuid();
      expect(uuid).toMatch(/^[a-zA-Z0-9_-]+$/);
    }
  });

  it("should generate unique IDs across 10,000 invocations", () => {
    const ids = new Set<string>();
    const count = 10_000;
    for (let i = 0; i < count; i++) {
      ids.add(generatePublicUuid());
    }
    expect(ids.size).toBe(count);
  });

  it("should have sufficient entropy (high character diversity)", () => {
    // Generate many UUIDs and check that the character distribution
    // across all positions is reasonably uniform, indicating good randomness
    const uuids = Array.from({ length: 1000 }, () => generatePublicUuid());
    const charCounts = new Map<string, number>();

    for (const uuid of uuids) {
      for (const ch of uuid) {
        charCounts.set(ch, (charCounts.get(ch) ?? 0) + 1);
      }
    }

    // With a good source of randomness and base62/64 encoding,
    // we should see a wide variety of distinct characters
    expect(charCounts.size).toBeGreaterThanOrEqual(30);
  });

  it("should not use Math.random (source code check)", async () => {
    // Read the source to confirm Math.random is not used
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("../utils.ts", import.meta.url),
      "utf-8",
    );
    expect(source).not.toContain("Math.random");
  });
});
