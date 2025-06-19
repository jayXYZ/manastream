"use client";

import { MatchController } from "@/components/controllers/match-controller";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Doc } from "@/convex/_generated/dataModel";
import { CardController } from "@/components/controllers/card-controller";

type OverlayListItem = {
  _id: string;
  type: string;
  name: string;
  publicUuid: string;
};

export default function ControllersPage() {
  const overlays = useQuery(api.overlays.getUserOverlays);
  function isMatchOverlay(
    overlay: OverlayListItem,
  ): overlay is OverlayListItem {
    return overlay.type === "match";
  }

  function isCardOverlay(overlay: OverlayListItem): overlay is OverlayListItem {
    return overlay.type === "card";
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
            <MatchController matchOverlayId={matchOverlay._id} />
          ))}
        </div>
        {cardOverlay && (
          <div className="h-full">
            <CardController cardOverlayId={cardOverlay._id} />
          </div>
        )}
      </div>
    </div>
  );
}
