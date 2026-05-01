import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const standingsOverlaySource = readFileSync(
  "app/overlay/components/standings-overlay.tsx",
  "utf8",
);

describe("Standings overlay round title", () => {
  it("prioritizes the selected standings round label over the current round", () => {
    expect(standingsOverlaySource).toMatch(
      /data\.roundDisplayName\s*\?\?\s*tournamentInfo\?\.currentRoundDisplayName/,
    );
  });
});
