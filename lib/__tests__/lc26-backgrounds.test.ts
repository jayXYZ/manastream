import { describe, expect, it } from "vitest";
import {
  getLc26BackgroundImageForPlayer,
  normalizeLc26BackgroundColor,
} from "../lc26-backgrounds";

describe("normalizeLc26BackgroundColor", () => {
  it("accepts supported colors regardless of case/spacing", () => {
    expect(normalizeLc26BackgroundColor(" blue ")).toBe("Blue");
    expect(normalizeLc26BackgroundColor("GOLD")).toBe("Gold");
  });

  it("returns undefined for unsupported colors", () => {
    expect(normalizeLc26BackgroundColor("Brown")).toBeUndefined();
    expect(normalizeLc26BackgroundColor("")).toBeUndefined();
  });
});

describe("getLc26BackgroundImageForPlayer", () => {
  it("prefers explicit override color over deck detection", () => {
    const result = getLc26BackgroundImageForPlayer({
      overrideColor: "Red",
      displayDeckName: "Landstill",
      fallbackColor: "Blue",
    });

    expect(result.color).toBe("Red");
    expect(result.backgroundImage).toContain("/images/overlays/lc26/red_final.png");
  });

  it("detects color from known archetype deck name", () => {
    const result = getLc26BackgroundImageForPlayer({
      displayDeckName: "Landstill",
      fallbackColor: "Red",
    });

    expect(result.color).toBe("Blue");
    expect(result.backgroundImage).toContain(
      "/images/overlays/lc26/blue_final.png",
    );
  });

  it("falls back when deck is unknown", () => {
    const result = getLc26BackgroundImageForPlayer({
      displayDeckName: "Mystery Brew",
      fallbackColor: "Red",
    });

    expect(result.color).toBe("Red");
    expect(result.backgroundImage).toContain("/images/overlays/lc26/red_final.png");
  });
});
