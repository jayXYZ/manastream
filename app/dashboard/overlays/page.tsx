"use client";

import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useState, useEffect } from "react";
import { Overlay, TemplateType } from "@/convex/types";
import OverlaysTable from "./components/overlays-table";
import OverlayPreview from "./components/overlay-preview";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import {
  getAllTemplateNames,
  getAvailableTemplates,
  isTemplateAvailable,
} from "@/lib/overlay-templates";
import { Id } from "@/convex/_generated/dataModel";

export default function OverlaysPage() {
  const tournament = useQuery(api.tournaments.getUserTournament);
  const overlays = useQuery(api.overlays.getUserOverlays);
  const [selectedOverlay, setSelectedOverlay] = useState<Overlay | null>(null);
  const [selectedPlayerNumber, setSelectedPlayerNumber] = useState<
    1 | 2 | null
  >(null);
  const [selectedOverlayUrl, setSelectedOverlayUrl] = useState<string | null>(
    null,
  );
  const [origin, setOrigin] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<
    TemplateType | undefined
  >(undefined);
  const setMatchOverlaySettings = useMutation(
    api.overlays.setMatchOverlaySettings,
  );
  const setCommentaryOverlaySettings = useMutation(
    api.overlays.setCommentaryOverlaySettings,
  );

  const handleSaveTemplate = () => {
    if (selectedOverlay && selectedTemplate) {
      if (selectedOverlay.overlayType === "match") {
        setMatchOverlaySettings({
          overlayId: selectedOverlay._id as Id<"overlays">,
          template: selectedTemplate,
        });
      } else if (selectedOverlay.overlayType === "commentary") {
        setCommentaryOverlaySettings({
          overlayId: selectedOverlay._id as Id<"overlays">,
          template: selectedTemplate,
        });
      }
    }
  };

  // Initialize selected template when overlay changes
  useEffect(() => {
    if (selectedOverlay) {
      if (
        selectedOverlay.overlayType === "match" ||
        selectedOverlay.overlayType === "commentary"
      ) {
        setSelectedTemplate(selectedOverlay.template as TemplateType);
      } else {
        setSelectedTemplate(undefined);
      }
    } else {
      setSelectedTemplate(undefined);
    }
  }, [selectedOverlay]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Update the overlay URL when selection changes
  useEffect(() => {
    if (selectedOverlay) {
      const baseUrl = `${origin}/overlay/${selectedOverlay.publicUuid}`;
      if (selectedOverlay.overlayType === "deck" && selectedPlayerNumber) {
        setSelectedOverlayUrl(`${baseUrl}?player=${selectedPlayerNumber}`);
      } else {
        setSelectedOverlayUrl(baseUrl);
      }
    } else {
      setSelectedOverlayUrl(null);
    }
  }, [selectedOverlay, selectedPlayerNumber, origin]);

  if (!tournament || !overlays) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      <div className="flex-1 min-w-0 min-h-0">
        <OverlaysTable
          overlays={overlays}
          selectedOverlay={selectedOverlay}
          selectedPlayerNumber={selectedPlayerNumber}
          setSelectedOverlay={(overlay, playerNumber) => {
            setSelectedOverlay(overlay);
            setSelectedPlayerNumber(playerNumber ?? null);
          }}
        />
      </div>

      <div className="flex-shrink-0 flex flex-col gap-2">
        <OverlayPreview
          overlayUrl={selectedOverlayUrl ?? ""}
          overlayType={selectedOverlay?.overlayType ?? null}
        />
        {selectedOverlay &&
          getAvailableTemplates(selectedOverlay.overlayType).length > 0 && (
            <>
              <Select
                value={selectedTemplate ?? ""}
                onValueChange={(value) =>
                  setSelectedTemplate(value as TemplateType)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {getAllTemplateNames().map((template) => {
                    const isAvailable = isTemplateAvailable(
                      selectedOverlay.overlayType,
                      template,
                    );
                    return (
                      <SelectItem
                        key={template}
                        value={template}
                        disabled={!isAvailable}
                      >
                        {template}
                        {!isAvailable && " (Not available)"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSaveTemplate()}
              >
                <Save className="size-4" />
                Change Template
              </Button>
            </>
          )}
      </div>
    </div>
  );
}
