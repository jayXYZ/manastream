import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LifeTrackerSettings {
  connectedOverlayId: string | null;
  playersSwitched: boolean;
  currentRound: number;
  setConnectedOverlayId: (id: string | null) => void;
  setPlayersSwitched: (switched: boolean) => void;
  setCurrentRound: (round: number) => void;
}

export const useLifeTrackerStore = create<LifeTrackerSettings>()(
  persist(
    (set) => ({
      connectedOverlayId: null,
      playersSwitched: false,
      currentRound: 0,
      setConnectedOverlayId: (id) => set({ connectedOverlayId: id }),
      setPlayersSwitched: (switched) => set({ playersSwitched: switched }),
      setCurrentRound: (round) => set({ currentRound: round }),
    }),
    {
      name: "lifetracker-settings", // unique name in localStorage
      partialize: (state) => ({
        connectedOverlayId: state.connectedOverlayId,
        playersSwitched: state.playersSwitched,
        currentRound: state.currentRound,
      }),
    },
  ),
);
