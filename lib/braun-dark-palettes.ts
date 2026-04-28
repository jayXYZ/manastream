export type BraunDarkPaletteName = "Dark" | "Maroon";

export type BraunDarkPalette = {
  surface: string;
  surfaceRaised: string;
  text: string;
  muted: string;
  accent: string;
  rule: string;
  frameBorder: string;
  counterBg: string;
  placeholderBg: string;
  placeholderBgCard: string;
  placeholderCrosshair: string;
  placeholderLabel: string;
  placeholderDim: string;
  watermark: string;
};

export const BRAUN_DARK_PALETTES: Record<
  BraunDarkPaletteName,
  BraunDarkPalette
> = {
  Dark: {
    surface: "#1C1B19",
    surfaceRaised: "#222120",
    text: "#D4CFC5",
    muted: "#918A84",
    accent: "#E8642C",
    rule: "rgba(210,200,185,0.18)",
    frameBorder: "#8A8378",
    counterBg: "rgba(0,0,0,0.72)",
    placeholderBg: "rgba(0,0,0,0.55)",
    placeholderBgCard: "rgba(0,0,0,0.40)",
    placeholderCrosshair: "rgba(255,255,255,0.04)",
    placeholderLabel: "rgba(255,255,255,0.18)",
    placeholderDim: "rgba(255,255,255,0.08)",
    watermark: "rgba(210,200,185,0.10)",
  },
  Maroon: {
    surface: "#2A1416",
    surfaceRaised: "#341A1D",
    text: "#ECDDD2",
    muted: "#A89189",
    accent: "#D9A64A",
    rule: "rgba(236,221,210,0.18)",
    frameBorder: "#8C6B68",
    counterBg: "rgba(0,0,0,0.72)",
    placeholderBg: "rgba(0,0,0,0.55)",
    placeholderBgCard: "rgba(0,0,0,0.40)",
    placeholderCrosshair: "rgba(236,221,210,0.04)",
    placeholderLabel: "rgba(236,221,210,0.18)",
    placeholderDim: "rgba(236,221,210,0.08)",
    watermark: "rgba(236,221,210,0.10)",
  },
};

export const DEFAULT_BRAUN_DARK_PALETTE: BraunDarkPaletteName = "Dark";

export const BRAUN_DARK_PALETTE_OPTIONS = [
  { value: "Dark", label: "Dark" },
  { value: "Maroon", label: "Maroon" },
] as const satisfies readonly {
  value: BraunDarkPaletteName;
  label: string;
}[];

export function isBraunDarkPaletteName(
  value: string | null | undefined,
): value is BraunDarkPaletteName {
  return value === "Dark" || value === "Maroon";
}

export function getBraunDarkPalette(
  paletteName?: string | null,
): BraunDarkPalette {
  if (isBraunDarkPaletteName(paletteName)) {
    return BRAUN_DARK_PALETTES[paletteName];
  }

  return BRAUN_DARK_PALETTES[DEFAULT_BRAUN_DARK_PALETTE];
}
