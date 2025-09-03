import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LifeTrackerSettings {
  connectedOverlayId: string | null;
  playersSwitched: boolean;
  currentRound: number;
  player1Life: number | null;
  player2Life: number | null;
  showAdminSettings: boolean;
  setConnectedOverlayId: (id: string | null) => void;
  setPlayersSwitched: (switched: boolean) => void;
  setCurrentRound: (round: number) => void;
  setPlayerLife: (playerIndex: "1" | "2", life: number) => void;
  resetBothPlayers: () => void;
  setShowAdminSettings: (show: boolean) => void;
}

export const useLifeTrackerStore = create<LifeTrackerSettings>()(
  persist(
    (set) => ({
      connectedOverlayId: null,
      playersSwitched: false,
      currentRound: 0,
      player1Life: null,
      player2Life: null,
      showAdminSettings: false,
      setConnectedOverlayId: (id) => set({ connectedOverlayId: id }),
      setPlayersSwitched: (switched) => set({ playersSwitched: switched }),
      setCurrentRound: (round) => set({ currentRound: round }),
      setPlayerLife: (playerIndex, life) =>
        set({ [`player${playerIndex}Life`]: life }),
      resetBothPlayers: () => set({ player1Life: 20, player2Life: 20 }),
      setShowAdminSettings: (show) => set({ showAdminSettings: show }),
    }),
    {
      name: "lifetracker-settings", // unique name in localStorage
      partialize: (state) => ({
        connectedOverlayId: state.connectedOverlayId,
        playersSwitched: state.playersSwitched,
        currentRound: state.currentRound,
        player1Life: state.player1Life,
        player2Life: state.player2Life,
        showAdminSettings: state.showAdminSettings,
      }),
      onRehydrateStorage: () => (state) => {
        // Handle any rehydration errors gracefully
        if (state) {
          // Ensure connectedOverlayId is valid after rehydration
          if (state.connectedOverlayId === undefined) {
            state.connectedOverlayId = null;
          }
        }
      },
    },
  ),
);
