import { Doc } from "../_generated/dataModel";

export function requireMatchOverlay(
  overlay: Doc<"overlays">,
): asserts overlay is Doc<"overlays"> & { overlayType: "match" } {
  if (overlay.overlayType !== "match") {
    throw new Error("Match overlay not found");
  }
}

export function requireCardOverlay(
  overlay: Doc<"overlays">,
): asserts overlay is Doc<"overlays"> & { overlayType: "card" } {
  if (overlay.overlayType !== "card") {
    throw new Error("Card overlay not found");
  }
}

export function requireCommentaryOverlay(
  overlay: Doc<"overlays">,
): asserts overlay is Doc<"overlays"> & { overlayType: "commentary" } {
  if (overlay.overlayType !== "commentary") {
    throw new Error("Commentary overlay not found");
  }
}

export function requireDeckOverlay(
  overlay: Doc<"overlays">,
): asserts overlay is Doc<"overlays"> & { overlayType: "deck" } {
  if (overlay.overlayType !== "deck") {
    throw new Error("Deck overlay not found");
  }
}
