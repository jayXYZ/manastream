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
import { Id } from "@/convex/_generated/dataModel";
import type { MatchOverlayWithPlayers } from "@/convex/types";
import type { Infer } from "convex/values";
import { getOverlayByIdValidator } from "@/convex/validators";
import { Spinner } from "@/components/ui/spinner";
// Type for the overlay data returned from getOverlayById query
type OverlayData = Infer<typeof getOverlayByIdValidator> | undefined;

// Type guard to narrow the overlay union type to match overlay
function isMatchOverlay(
  overlay: OverlayData,
): overlay is MatchOverlayWithPlayers {
  return overlay?.overlayType === "match";
}

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
  const overlayData = useQuery(
    api.overlays.getOverlayById,
    connectedOverlayId
      ? { overlayId: connectedOverlayId as Id<"overlays"> }
      : "skip",
  );

  // Only call usePresence if we have a valid connectedOverlayId
  usePresence(connectedOverlayId || null);

  // Wake lock to prevent screen from sleeping
  const { requestWakeLock, releaseWakeLock, isSupported } = useWakeLock();

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

  if (!tournament) {
    return (
      <div className="flex flex-col gap-4 items-center justify-center min-h-screen">
        <Spinner />
        <div className="text-2xl font-bold">Loading tournament...</div>
      </div>
    );
  }

  if (!connectedOverlayId || showAdminSettings) {
    return <AdminSettings />;
  }

  // Type guard to ensure overlay is a match overlay
  // After this check, overlayData is narrowed to MatchOverlayWithPlayers type
  if (overlayData && !isMatchOverlay(overlayData)) {
    throw new Error("Overlay is not a match overlay");
  }

  if (
    tournamentMode === "auto" &&
    !overlayData.player1 &&
    !overlayData.player2 &&
    !overlayData.player1DisplayName &&
    !overlayData.player2DisplayName
  ) {
    return (
      <div className="flex flex-col h-screen-dynamic w-full overscroll-none overflow-hidden">
        <div
          className="absolute top-0 right-0"
          onClick={() => setShowAdminSettings(true)}
        >
          <Cog />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <MatchSelect />
        </div>
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
