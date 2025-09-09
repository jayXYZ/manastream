import { Switch } from "@/components/ui/switch";
import { CardOverlay } from "@/convex/types";
import { useState } from "react";
import { useDashboardStore } from "../../store";
import { Button } from "@/components/ui/button";
import {
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExternalLink } from "lucide-react";

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

  const openCardControllerPopout = () => {
    const popoutUrl = `${window.location.origin}/popout/card-controller`;
    window.open(
      popoutUrl,
      "CardControllerPopout",
      "width=400,height=700,resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,directories=no,status=no",
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{overlay.name}</DialogTitle>
      </DialogHeader>
      <div className="space-y-2 flex flex-col">
        <div className="flex items-center justify-start gap-2">
          <label className="text-sm font-medium">Show Card Overlay?</label>
          <Switch
            checked={showCardOverlay}
            onCheckedChange={(checked) =>
              setShowCardOverlay(checked as boolean)
            }
          />
        </div>
        <br />
        <div className="flex justify-between items-center mb-2">
          <Button
            onClick={openCardControllerPopout}
            size="sm"
            variant="outline"
            className="flex items-center gap-1"
            title="Open card controller in a separate window"
          >
            <ExternalLink className="h-3 w-3" />
            Pop Out
          </Button>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => setShowCardOverlayStore(showCardOverlay)}>
          Save
        </Button>
      </DialogFooter>
    </>
  );
}
