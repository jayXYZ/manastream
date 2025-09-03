"use client";

import { useState } from "react";
import { api } from "@/convex/_generated/api";
import AdminSettings from "./admin-settings";
import Health from "./health";
import MatchSelect from "./match-select";
import { useLifeTrackerStore } from "./store";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "convex/react";
import { usePresence } from "@/hooks/use-presence";
import { Cog } from "lucide-react";
import LifeTrackerErrorBoundary from "./error-boundary";

function LifeTrackerContent() {
  const userOverlays = useQuery(api.overlays.getUserOverlays);
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
    <div className="flex flex-col h-screen w-full">
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
