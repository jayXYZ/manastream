import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const standingsOverlaySource = readFileSync(
  "app/overlay/components/standings-overlay.tsx",
  "utf8",
);
const standingsMutationSource = readFileSync(
  "convex/_overlays/standings.ts",
  "utf8",
);
const validatorsSource = readFileSync("convex/validators.ts", "utf8");

describe("Standings overlay Braun Dark palette", () => {
  it("renders with the shared Braun Dark palette instead of a local theme", () => {
    expect(standingsOverlaySource).toContain("getBraunDarkPalette");
    expect(standingsOverlaySource).toContain("data.braunDarkPalette");
    expect(standingsOverlaySource).not.toContain("const THEME =");
  });

  it("persists the palette on standings overlays", () => {
    expect(validatorsSource).toContain(
      "braunDarkPalette: v.optional(braunDarkPaletteValidator)",
    );
    expect(standingsMutationSource).toContain("setStandingsOverlaySettings");
    expect(standingsMutationSource).toContain("braunDarkPaletteValidator");
  });
});
