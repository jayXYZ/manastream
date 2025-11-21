"use client";

import { MatchPreviewController } from "./components/match-preview-controller";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { CardController } from "@/app/dashboard/controllers/components/card-controller";
import type { Overlay } from "@/convex/types";
import { useDashboardStore } from "../store";
import { TournamentPreviewController } from "./components/tournament-preview-controller";
import { Spinner } from "@/components/ui/spinner";

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
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }
  const matchOverlays = overlays.filter(isMatchOverlay);
  const cardOverlay = overlays.find(isCardOverlay);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-row flex-1 min-h-0">
        <div className="flex grow flex-col">
          <div className="-mt-[1px] -ml-[1px]">
            <TournamentPreviewController />
          </div>
          {matchOverlays.map((matchOverlay: Overlay) => (
            <div key={matchOverlay._id} className="-mt-[1px] -ml-[1px]">
              <MatchPreviewController matchOverlayId={matchOverlay._id} />
            </div>
          ))}

          <div className="pattern-stripes h-full w-full grow"></div>
        </div>

        {cardOverlay && showCardOverlay && (
          <div className="-ml-[1px] -mt-[1px]">
            <CardController
              cardOverlayId={cardOverlay._id}
              title="Card Overlay Controller"
            />
          </div>
        )}
      </div>
    </div>
  );
}
