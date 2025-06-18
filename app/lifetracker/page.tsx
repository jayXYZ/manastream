"use client";

import { api } from "@/convex/_generated/api";
import AdminSettings from "./admin-settings";
import Health from "./health";
import MatchSelect from "./match-select";
import { useLifeTrackerStore } from "./store";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "convex/react";

export default function LifeTracker() {
  const connectedOverlayId = useLifeTrackerStore(
    (state) => state.connectedOverlayId,
  );
  const currentRound = useLifeTrackerStore((state) => state.currentRound);
  const tournament = useQuery(api.tournaments.getUserTournament);
  const tournamentMode = tournament?.mode;
  const tournamentCurrentRound = tournament?.currentRound;

  if (!connectedOverlayId) {
    return <AdminSettings />;
  }

  if (
    tournamentMode === "auto" &&
    tournamentCurrentRound &&
    tournamentCurrentRound > currentRound
  ) {
    return <MatchSelect />;
  }

  return (
    <div className="flex flex-col h-screen w-full">
      <Health index="2" />
      <Separator />
      <Health index="1" />
    </div>
  );
}
