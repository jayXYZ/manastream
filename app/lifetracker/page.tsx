"use client";

import { api } from "@/convex/_generated/api";
import AdminSettings from "./admin-settings";
import Health from "./health";
import MatchSelect from "./match-select";
import { useLifeTrackerStore } from "./store";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "convex/react";
import { usePresence } from "@/hooks/use-presence";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { Cog } from "lucide-react";
import LifeTrackerErrorBoundary from "./error-boundary";
import { useEffect } from "react";

function LifeTrackerContent() {
  const connectedOverlayId = useLifeTrackerStore(
    (state) => state.connectedOverlayId,
  );
  const showAdminSettings = useLifeTrackerStore(
    (state) => state.showAdminSettings,
  );
  const setShowAdminSettings = useLifeTrackerStore(
    (state) => state.setShowAdminSettings,
  );
  const currentRound = useLifeTrackerStore((state) => state.currentRound);
  const tournament = useQuery(api.tournaments.getUserTournament);
  const tournamentMode = tournament?.mode;
  const tournamentCurrentRound = tournament?.currentRound;

  // Only call usePresence if we have a valid connectedOverlayId
  usePresence(connectedOverlayId || null);

  // Wake lock to prevent screen from sleeping
  const { requestWakeLock, releaseWakeLock, isSupported, isActive, error } =
    useWakeLock();

  // Request wake lock when component mounts and we're not in admin settings
  useEffect(() => {
    if (!showAdminSettings && connectedOverlayId && isSupported) {
      requestWakeLock();
    } else if (showAdminSettings) {
      releaseWakeLock();
    }
  }, [
    showAdminSettings,
    connectedOverlayId,
    isSupported,
    requestWakeLock,
    releaseWakeLock,
  ]);

  // Cleanup wake lock when component unmounts
  useEffect(() => {
    return () => {
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  if (!connectedOverlayId || showAdminSettings) {
    return <AdminSettings />;
  }
  if (
    tournamentMode === "auto" &&
    tournamentCurrentRound &&
    tournamentCurrentRound > currentRound
  ) {
    return (
      <div>
        <div
          className="absolute top-0 right-0"
          onClick={() => setShowAdminSettings(true)}
        >
          <Cog />
        </div>
        <MatchSelect />;
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen-dynamic w-full overscroll-none overflow-hidden">
      <Health index="2" />
      <Separator />
      <Health index="1" />
    </div>
  );
}

export default function LifeTracker() {
  return (
    <LifeTrackerErrorBoundary>
      <LifeTrackerContent />
    </LifeTrackerErrorBoundary>
  );
}
