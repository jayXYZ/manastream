// Match overlay operations
export {
  createMatchOverlay,
  internalCreateMatchOverlay,
  updateMatchOverlay,
  updateMatchOverlayDisplayInfo,
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
  setCardOverlaySettings,
} from "./_overlays/card";

// Commentary overlay operations
export {
  createCommentaryOverlay,
  internalCreateCommentaryOverlay,
  updateCommentaryOverlay,
  setCommentaryOverlaySettings,
} from "./_overlays/commentary";

// Deck overlay operations
export {
  internalCreateDeckOverlay,
  updateDeckOverlay,
  setDeckOverlaySettings,
} from "./_overlays/deck";

// Cross-overlay queries
export {
  getUserOverlays,
  getOverlayById,
  getOverlayByUuid,
} from "./_overlays/queries";

// Shared operations
export { setOverlayTemplate, deleteOverlay } from "./_overlays/shared";

// Standings overlay operations
export {
  updateSpicerackRoundStandings,
  fetchAndUpdateSpicerackRoundStandings,
  updateStandingsOverlay,
} from "./_overlays/standings";
