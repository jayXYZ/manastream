import { Switch } from "@/components/ui/switch";
import { CardOverlay } from "@/convex/types";
import { useState } from "react";
import { useDashboardStore } from "../../store";
import { Button } from "@/components/ui/button";

interface CardSettingsProps {
  overlay: CardOverlay;
}

export default function CardSettings({ overlay }: CardSettingsProps) {
  const showCardOverlayStore = useDashboardStore(
    (state) => state.showCardOverlay,
  );
  const setShowCardOverlayStore = useDashboardStore(
    (state) => state.setShowCardOverlay,
  );
  const [showCardOverlay, setShowCardOverlay] = useState(showCardOverlayStore);

  return (
    <div className="space-y-2 items-center flex flex-row">
      <label className="text-sm font-medium flex-1 w-full">
        Show Card Overlay?
      </label>
      <div className="flex-1">
        <Switch
          checked={showCardOverlay}
          onCheckedChange={(checked) => setShowCardOverlay(checked as boolean)}
        />
      </div>
      <Button onClick={() => setShowCardOverlayStore(showCardOverlay)}>
        Save
      </Button>
    </div>
  );
}
