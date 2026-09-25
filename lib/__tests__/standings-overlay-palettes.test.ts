import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const standingsOverlaySource = readFileSync(
  "app/overlay/components/standings-overlay.tsx",
  "utf8",
);
const standingsMutationSource = readFileSync(
  "convex/overlays/standings.ts",
  "utf8",
);
const validatorsSource = readFileSync("convex/validators.ts", "utf8");
const bracketOverlaySource = readFileSync(
  "app/overlay/components/top-8-bracket-overlay.tsx",
  "utf8",
);
const tournamentControllerSource = readFileSync(
  "app/dashboard/controllers/components/tournament-preview-controller.tsx",
  "utf8",
);

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

describe("Standings overlay elimination metadata", () => {
  it("exposes elimination phase state and seeds to the standings overlay", () => {
    expect(validatorsSource).toContain(
      "isEliminationPhase: v.optional(v.boolean())",
    );
    expect(validatorsSource).toContain("seed: v.optional(v.number())");
    expect(validatorsSource).toContain("bracketDataWithPlayers");
    expect(validatorsSource).toContain("player1Seed: v.optional(v.number())");
    expect(validatorsSource).toContain("player2Seed: v.optional(v.number())");
  });
});

describe("Top 8 bracket overlay", () => {
  it("uses the standard top 8 bracket seed order", () => {
    expect(bracketOverlaySource).toContain("[1, 8]");
    expect(bracketOverlaySource).toContain("[4, 5]");
    expect(bracketOverlaySource).toContain("[2, 7]");
    expect(bracketOverlaySource).toContain("[3, 6]");
  });

  it("uses the Braun Dark palette passed from standings", () => {
    expect(bracketOverlaySource).toContain("theme: BraunDarkPalette");
    expect(bracketOverlaySource).toContain("theme.surface");
    expect(bracketOverlaySource).toContain("theme.accent");
  });

  it("is rendered by standings overlays during elimination phases", () => {
    expect(standingsOverlaySource).toContain("Top8BracketOverlay");
    expect(standingsOverlaySource).toContain("data.isEliminationPhase");
  });

  it("can be forced into a static mock bracket preview from the URL", () => {
    expect(standingsOverlaySource).toContain("MOCK_TOP_8_STANDINGS");
    expect(standingsOverlaySource).toContain('searchParams.get("mockTop8")');
    expect(standingsOverlaySource).toContain("isMockTop8Preview");
  });

  it("prefers current elimination bracket pairings over completed standings", () => {
    expect(standingsOverlaySource).toContain("data.bracketDataWithPlayers");
    expect(standingsOverlaySource).toMatch(
      /data\.bracketDataWithPlayers\s*\?\?\s*standings/,
    );
  });

  it("does not auto-switch selected Swiss standings to the current bracket", () => {
    expect(standingsOverlaySource).not.toContain(
      "ELIMINATION_ROUND_NAMES.has(roundName)",
    );
    expect(standingsOverlaySource).toContain("data.isEliminationPhase");
  });

  it("adds current bracket as an explicit standings overlay dropdown option", () => {
    expect(tournamentControllerSource).toContain("CURRENT_BRACKET_VALUE");
    expect(tournamentControllerSource).toContain(
      "api.pairings.getCurrentRoundPairings",
    );
    expect(tournamentControllerSource).toContain("showCurrentBracket");
    expect(tournamentControllerSource).toContain("Current bracket");
  });

  it("does not render a top event header or round name", () => {
    expect(bracketOverlaySource).not.toContain("eventName");
    expect(bracketOverlaySource).not.toContain("roundName");
    expect(bracketOverlaySource).not.toContain("TOP_BAR");
    expect(standingsOverlaySource).not.toContain("eventName={eventName}");
    expect(standingsOverlaySource).not.toContain("roundName={roundName}");
  });
});
