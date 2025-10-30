// Match overlay operations
export {
  createMatchOverlay,
  internalCreateMatchOverlay,
  updateMatchOverlay,
  updatePlayerLife,
  incrementGamesWon,
  resetMatch,
  swapPlayers,
  resetMatchOverlay,
  setOverlayFeatureMatch,
  setMatchOverlaySettings,
} from "./_overlays/match";

// Card overlay operations
export {
  createCardOverlay,
  internalCreateCardOverlay,
  updateCardOverlay,
} from "./_overlays/card";

// Commentary overlay operations
export {
  createCommentaryOverlay,
  internalCreateCommentaryOverlay,
  updateCommentaryOverlay,
  setCommentaryOverlaySettings,
} from "./_overlays/commentary";

// Cross-overlay queries
export {
  getUserOverlays,
  getOverlayById,
  getOverlayByUuid,
} from "./_overlays/queries";

// Shared operations
export { setOverlayTemplate, deleteOverlay } from "./_overlays/shared";
