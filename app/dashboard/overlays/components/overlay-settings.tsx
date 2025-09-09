"use client";

import {
  Overlay,
  MatchOverlay,
  CardOverlay,
  CommentaryOverlay,
} from "@/convex/types";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import MatchSettings from "./match-settings";
import CardSettings from "./card-settings";
import CommentarySettings from "./commentary-settings";

interface OverlaySettingsProps {
  overlay: Overlay;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

// Type-safe component map with proper typing for each overlay type
// const TYPE_COMPONENTS = {
//   match: MatchSettings,
//   card: null, // Will be implemented later
//   commentary: null, // Will be implemented later
//   deck: null,
//   standings: null,
// } as const;

export default function OverlaySettings({
  overlay,
  isOpen,
  onOpenChange,
}: OverlaySettingsProps) {
  const renderSettingsComponent = () => {
    switch (overlay.overlayType) {
      case "match":
        return (
          <MatchSettings
            overlay={overlay as MatchOverlay}
            onOpenChange={onOpenChange}
          />
        );
      case "card":
        return <CardSettings overlay={overlay as CardOverlay} />;
      case "commentary":
        return (
          <CommentarySettings
            overlay={overlay as CommentaryOverlay}
            onOpenChange={onOpenChange}
          />
        );
      case "deck":
        return (
          <div className="text-gray-500 dark:text-gray-400">
            <p>Deck overlay settings are not yet implemented.</p>
          </div>
        );
      case "standings":
        return (
          <div className="text-gray-500 dark:text-gray-400">
            <p>Standings overlay settings are not yet implemented.</p>
          </div>
        );
      default:
        return (
          <div className="text-gray-500 dark:text-gray-400">
            <p>Unknown overlay type.</p>
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>{renderSettingsComponent()}</DialogContent>
    </Dialog>
  );
}
