import { create } from "zustand";
import { persist } from "zustand/middleware";

interface DashboardStore {
  showCardOverlay: boolean;
  setShowCardOverlay: (show: boolean) => void;
}

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set) => ({
      showCardOverlay: true,
      setShowCardOverlay: (show) => set({ showCardOverlay: show }),
    }),
    {
      name: "dashboard-store",
    },
  ),
);
