"use client";

import { MatchController } from "@/components/controllers/match-controller";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Doc } from "@/convex/_generated/dataModel";

export default function ControllersPage() {
  const overlays = useQuery(api.overlays.getUserOverlays);
  type OverlayListItem = {
    _id: string;
    type: string;
    name: string;
    publicUuid: string;
  };
  function isMatchOverlay(
    overlay: OverlayListItem,
  ): overlay is OverlayListItem {
    return overlay.type === "match";
  }
  const match = overlays?.find(isMatchOverlay);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Controllers
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          Control your live overlays in real-time
        </p>
      </div>
      {match && <MatchController matchId={match._id} />}
    </div>
  );
}
