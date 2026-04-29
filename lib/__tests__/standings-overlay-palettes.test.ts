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

describe("Standings overlay layout", () => {
  const readNumericConst = (name: string) => {
    const match = standingsOverlaySource.match(
      new RegExp(`const ${name} = (\\d+);`),
    );

    if (!match) {
      throw new Error(`Could not find ${name}`);
    }

    return Number(match[1]);
  };

  it("fits a full page of rows above the footer at 1920x1080", () => {
    const pageSize = readNumericConst("PAGE_SIZE");
    const topBar = readNumericConst("TOP_BAR");
    const bottomBar = readNumericConst("BOTTOM_BAR");
    const rowHeight = readNumericConst("ROW_HEIGHT");
    const tablePaddingTop = readNumericConst("TABLE_PADDING_TOP");
    const tablePaddingBottom = readNumericConst("TABLE_PADDING_BOTTOM");
    const headerHeight = readNumericConst("HEADER_HEIGHT");

    const usableTableHeight =
      1080 - topBar - bottomBar - tablePaddingTop - tablePaddingBottom;
    const requiredTableHeight = headerHeight + pageSize * rowHeight;

    expect(requiredTableHeight).toBeLessThanOrEqual(usableTableHeight);
  });

  it("keeps wider horizontal margins around the standings table", () => {
    expect(readNumericConst("SIDE_MARGIN")).toBeGreaterThanOrEqual(120);
  });
});
