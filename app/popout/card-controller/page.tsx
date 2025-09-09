"use client";

import { CardController } from "@/components/controllers/card-controller";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import type { Overlay } from "@/convex/types";

export default function CardControllerPopout() {
  const overlays = useQuery(api.overlays.getUserOverlays);

  function isCardOverlay(overlay: Overlay): overlay is Overlay {
    return overlay.overlayType === "card";
  }

  if (overlays === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  const cardOverlay = overlays.find(isCardOverlay);

  if (!cardOverlay) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>No card overlay found. Please create a card overlay first.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-background">
      <div className="max-w-md mx-auto h-[calc(100vh-2rem)]">
        <CardController cardOverlayId={cardOverlay._id} />
      </div>
    </div>
  );
}
