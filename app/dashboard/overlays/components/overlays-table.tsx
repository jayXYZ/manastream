"use client";

import { Overlay } from "@/convex/types";
import { cn } from "@/lib/utils";
import React from "react";
import {
  MessageSquare,
  ListOrdered,
  Swords,
  RectangleVertical,
  GalleryVerticalEnd,
} from "lucide-react";

// Icon mapping for overlay types
const overlayTypeIcons: Record<Overlay["overlayType"], React.ElementType> = {
  match: Swords,
  commentary: MessageSquare,
  card: RectangleVertical,
  deck: GalleryVerticalEnd,
  standings: ListOrdered,
};

export default function OverlaysTable({
  overlays,
  selectedOverlay,
  selectedPlayerNumber,
  setSelectedOverlay,
}: {
  overlays: Overlay[];
  selectedOverlay: Overlay | null;
  selectedPlayerNumber: 1 | 2 | null;
  setSelectedOverlay: (overlay: Overlay, playerNumber?: 1 | 2) => void;
}) {
  return (
    <div className="divide-y divide-border">
      {overlays?.map((overlay) =>
        overlay.overlayType !== "deck" ? (
          <OverlayListItem
            key={overlay._id}
            overlay={overlay}
            isSelected={selectedOverlay?._id === overlay._id}
            onClick={() => setSelectedOverlay(overlay, undefined)}
          />
        ) : (
          <React.Fragment key={overlay._id}>
            <OverlayListItem
              overlay={overlay}
              label="Player 1"
              isSelected={
                selectedOverlay?._id === overlay._id &&
                selectedPlayerNumber === 1
              }
              onClick={() => setSelectedOverlay(overlay, 1)}
            />
            <OverlayListItem
              overlay={overlay}
              label="Player 2"
              isSelected={
                selectedOverlay?._id === overlay._id &&
                selectedPlayerNumber === 2
              }
              onClick={() => setSelectedOverlay(overlay, 2)}
            />
          </React.Fragment>
        ),
      )}
    </div>
  );
}

function OverlayListItem({
  overlay,
  label,
  isSelected,
  onClick,
}: {
  overlay: Overlay;
  label?: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const Icon = overlayTypeIcons[overlay.overlayType];
  const displayName = label ? `${overlay.name} — ${label}` : overlay.name;

  return (
    <button
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
        "hover:bg-accent/5",
        isSelected && "bg-primary/10 border-l-2 border-l-primary",
      )}
      onClick={onClick}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          isSelected ? "text-primary" : "text-muted-foreground",
        )}
      />
      <span className={cn("truncate text-sm", isSelected && "font-medium")}>
        {displayName}
      </span>
    </button>
  );
}
