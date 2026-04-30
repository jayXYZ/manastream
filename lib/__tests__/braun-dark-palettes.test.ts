import { describe, expect, it } from "vitest";
import {
  BRAUN_DARK_PALETTE_OPTIONS,
  BRAUN_DARK_PALETTES,
  getBraunDarkPalette,
} from "../braun-dark-palettes";
import type { BraunDarkPaletteName } from "../braun-dark-palettes";

describe("Braun Dark palettes", () => {
  it("keeps every palette on the same theme shape", () => {
    const [baseName, ...remainingNames] = Object.keys(
      BRAUN_DARK_PALETTES,
    ) as BraunDarkPaletteName[];
    const baseKeys = Object.keys(BRAUN_DARK_PALETTES[baseName]).sort();

    expect(baseKeys).toEqual([
      "accent",
      "counterBg",
      "frameBorder",
      "muted",
      "placeholderBg",
      "placeholderBgCard",
      "placeholderCrosshair",
      "placeholderDim",
      "placeholderLabel",
      "rowAlt",
      "rule",
      "surface",
      "surfaceRaised",
      "text",
      "watermark",
    ]);

    for (const name of remainingNames) {
      expect(Object.keys(BRAUN_DARK_PALETTES[name]).sort()).toEqual(baseKeys);
    }
  });

  it("uses the shared dark palette by default", () => {
    expect(getBraunDarkPalette()).toBe(BRAUN_DARK_PALETTES.Dark);
    expect(getBraunDarkPalette("Unknown")).toBe(BRAUN_DARK_PALETTES.Dark);
  });

  it("exposes dark and maroon options for the overlays page setting", () => {
    expect(BRAUN_DARK_PALETTE_OPTIONS).toEqual([
      { value: "Dark", label: "Dark" },
      { value: "Maroon", label: "Maroon" },
    ]);
    expect(BRAUN_DARK_PALETTES.Maroon).toMatchObject({
      surface: "#2A1416",
      surfaceRaised: "#341A1D",
      text: "#ECDDD2",
      muted: "#A89189",
      accent: "#D9A64A",
      rule: "rgba(236,221,210,0.18)",
      frameBorder: "#8C6B68",
    });
  });
});
