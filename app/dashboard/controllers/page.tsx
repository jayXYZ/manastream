"use client";

import { MatchController } from "@/components/controllers/match-controller";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { CardController } from "@/components/controllers/card-controller";
import type { Overlay } from "@/convex/types";
import { useDashboardStore } from "../store";

export default function ControllersPage() {
  const overlays = useQuery(api.overlays.getUserOverlays);
  const showCardOverlay = useDashboardStore((state) => state.showCardOverlay);

  function isMatchOverlay(overlay: Overlay): overlay is Overlay {
    return overlay.overlayType === "match";
  }

  function isCardOverlay(overlay: Overlay): overlay is Overlay {
    return overlay.overlayType === "card";
  }

  if (overlays === undefined) {
    return <p>Loading...</p>;
  }
  const matchOverlays = overlays.filter(isMatchOverlay);
  const cardOverlay = overlays.find(isCardOverlay);

  if (!matchOverlays) {
    return <p>Please create a match overlay.</p>;
  }

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
      <div className="flex flex-row gap-4 h-[calc(100vh-16rem)]">
        <div className="flex-grow">
          {matchOverlays.map((matchOverlay) => (
            <MatchController
              key={matchOverlay._id}
              matchOverlayId={matchOverlay._id}
            />
          ))}
        </div>
        {cardOverlay && showCardOverlay && (
          <div className="h-full">
            <CardController cardOverlayId={cardOverlay._id} />
          </div>
        )}
      </div>
    </div>
  );
}
