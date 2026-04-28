import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const overlaysPageSource = readFileSync(
  "app/dashboard/overlays/page.tsx",
  "utf8",
);

describe("Overlays page Braun Dark palette setting", () => {
  it("shows a palette selector for Braun Dark templates", () => {
    expect(overlaysPageSource).toContain("BRAUN_DARK_PALETTE_OPTIONS");
    expect(overlaysPageSource).toContain("isBraunDarkTemplate");
    expect(overlaysPageSource).toContain("const hasBraunDarkPalette");
    expect(overlaysPageSource).toContain("Palette");
  });

  it("saves the selected palette through each Braun-capable overlay mutation", () => {
    expect(overlaysPageSource).toContain(
      "...(braunDarkPalette ? { braunDarkPalette } : {})",
    );
    expect(
      overlaysPageSource.match(/braunDarkPalette/g)?.length,
    ).toBeGreaterThanOrEqual(8);
  });
});
