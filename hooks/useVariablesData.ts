import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const useVariablesData = (overlayId: Id<"overlays">) => {
  const overlay = useQuery(api.overlays.getOverlayById, {
    overlayId,
  });

  if (!overlay) return null;

  if (overlay.overlayType === "match") {
    const variablesData = {
      player1Name:
        overlay.player1DisplayName || overlay.player1Data?.name || "Player 1",
      player2Name:
        overlay.player2DisplayName || overlay.player2Data?.name || "Player 2",
      player1Deck:
        overlay.player1DisplayDeck ||
        overlay.player1Data?.deckName ||
        "Player 1 Deck",
      player2Deck:
        overlay.player2DisplayDeck ||
        overlay.player2Data?.deckName ||
        "Player 2 Deck",
      player1Life: overlay.player1Life,
      player2Life: overlay.player2Life,
      player1Record:
        overlay.player1TournamentRecord || "0-0",
      player2Record:
        overlay.player2TournamentRecord || "0-0",
      player1GamesWon: overlay.player1GamesWon,
      player2GamesWon: overlay.player2GamesWon,
    };
    return variablesData;
  } else return null;
};

export default useVariablesData;
