import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lc26OverlaySource = readFileSync(
  "app/overlay/components/match/match-lc26-overlay.tsx",
  "utf8",
);

const infoPanelSource = lc26OverlaySource.slice(
  lc26OverlaySource.indexOf("{/* -- Commentators & Other Info -- */}"),
  lc26OverlaySource.indexOf("{/* \u2500\u2500 TOP BAR \u2500\u2500 */}"),
);

describe("LC26 match overlay info panel", () => {
  it("uses larger left-aligned typography for event and commentator info", () => {
    expect(lc26OverlaySource).toContain("const INFO_PANEL_FONT_SIZE = 32;");
    expect(infoPanelSource).toContain("fontSize: INFO_PANEL_FONT_SIZE");
    expect(infoPanelSource).toContain('textAlign: "left"');
    expect(infoPanelSource).not.toContain('textAlign: "right"');
  });
});
