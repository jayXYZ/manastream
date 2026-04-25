"use client";

import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import {
  CommentaryOverlay,
  DeckOverlay,
  MatchOverlay,
  Overlay,
  TemplateType,
} from "@/convex/types";
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
import { Save, ExternalLink, Copy, Check, Proportions } from "lucide-react";
import { getAvailableTemplates } from "@/lib/overlay-templates";
import { Id } from "@/convex/_generated/dataModel";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function getInitialTemplate(overlay: Overlay | null): TemplateType | undefined {
  if (!overlay) return undefined;

  if (overlay.overlayType === "match" || overlay.overlayType === "commentary") {
    return overlay.template as TemplateType;
  }

  if (overlay.overlayType === "card") {
    return ((overlay as { template?: string }).template ??
      "Default") as TemplateType;
  }

  if (overlay.overlayType === "deck") {
    return ((overlay as { template?: string }).template ??
      "Duress Crew") as TemplateType;
  }

  return undefined;
}

export default function OverlaysPage() {
  const tournament = useQuery(api.tournaments.getUserTournament);
  const overlays = useQuery(api.overlays.getUserOverlays);
  const [selectedOverlay, setSelectedOverlay] = useState<Overlay | null>(null);
  const [selectedPlayerNumber, setSelectedPlayerNumber] = useState<
    1 | 2 | null
  >(null);
  const [selectedTemplate, setSelectedTemplate] = useState<
    TemplateType | undefined
  >(undefined);
  const [origin] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin,
  );
  const setMatchOverlaySettings = useMutation(
    api.overlays.setMatchOverlaySettings,
  );
  const setCommentaryOverlaySettings = useMutation(
    api.overlays.setCommentaryOverlaySettings,
  );
  const setCardOverlaySettings = useMutation(
    api.overlays.setCardOverlaySettings,
  );
  const setDeckOverlaySettings = useMutation(
    api.overlays.setDeckOverlaySettings,
  );

  const handleSaveTemplate = () => {
    if (selectedOverlay && selectedTemplate) {
      if (selectedOverlay.overlayType === "match") {
        setMatchOverlaySettings({
          overlayId: selectedOverlay._id as Id<"overlays">,
          template: selectedTemplate as MatchOverlay["template"],
        });
      } else if (selectedOverlay.overlayType === "commentary") {
        setCommentaryOverlaySettings({
          overlayId: selectedOverlay._id as Id<"overlays">,
          template: selectedTemplate as CommentaryOverlay["template"],
        });
      } else if (selectedOverlay.overlayType === "card") {
        setCardOverlaySettings({
          overlayId: selectedOverlay._id as Id<"overlays">,
          template: selectedTemplate as "Default" | "Braun Dark",
        });
      } else if (selectedOverlay.overlayType === "deck") {
        setDeckOverlaySettings({
          overlayId: selectedOverlay._id as Id<"overlays">,
          template: selectedTemplate as DeckOverlay["template"],
        });
      }
    }
  };

  const selectedOverlayUrl = selectedOverlay
    ? `${origin}/overlay/${selectedOverlay.publicUuid}${
        selectedOverlay.overlayType === "deck" && selectedPlayerNumber
          ? `?player=${selectedPlayerNumber}`
          : ""
      }`
    : null;

  if (!tournament || !overlays) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* Left Panel - Overlay List */}
      <div className="lg:w-72 xl:w-80 flex-shrink-0 flex flex-col border-r">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h2 className="text-sm font-semibold text-foreground">Overlays</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {overlays.length} overlay{overlays.length !== 1 ? "s" : ""}{" "}
            available
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <OverlaysTable
            overlays={overlays}
            selectedOverlay={selectedOverlay}
            selectedPlayerNumber={selectedPlayerNumber}
            setSelectedOverlay={(overlay, playerNumber) => {
              setSelectedOverlay(overlay);
              setSelectedPlayerNumber(playerNumber ?? null);
              setSelectedTemplate(getInitialTemplate(overlay));
            }}
          />
        </div>
      </div>

      {/* Right Panel - Preview & Details */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-muted/20 p-4 gap-4 overflow-auto">
        {/* Preview Area - sized by content with max constraints */}
        <div className="flex-shrink-0 w-full max-w-4xl mx-auto">
          <OverlayPreview
            overlayUrl={selectedOverlayUrl ?? ""}
            overlayType={selectedOverlay?.overlayType ?? null}
            className="w-full"
          />
        </div>

        {/* Details Panel */}
        <div className="flex-shrink-0 w-full max-w-4xl mx-auto">
          <OverlayDetailsPanel
            selectedOverlay={selectedOverlay}
            selectedOverlayUrl={selectedOverlayUrl}
            selectedTemplate={selectedTemplate}
            setSelectedTemplate={setSelectedTemplate}
            handleSaveTemplate={handleSaveTemplate}
          />
        </div>
      </div>
    </div>
  );
}

// Overlay Details Panel Component
function OverlayDetailsPanel({
  selectedOverlay,
  selectedOverlayUrl,
  selectedTemplate,
  setSelectedTemplate,
  handleSaveTemplate,
}: {
  selectedOverlay: Overlay | null;
  selectedOverlayUrl: string | null;
  selectedTemplate: TemplateType | undefined;
  setSelectedTemplate: (template: TemplateType) => void;
  handleSaveTemplate: () => void;
}) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const copied = copiedUrl === selectedOverlayUrl;

  const handleCopyUrl = async () => {
    if (!selectedOverlayUrl || copied) return;
    try {
      await navigator.clipboard.writeText(selectedOverlayUrl);
      setCopiedUrl(selectedOverlayUrl);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (!selectedOverlay) {
    return (
      <div className="sunken-subtle rounded-lg px-3 py-4 text-center">
        <p className="text-muted-foreground text-sm">
          Select an overlay to view details
        </p>
      </div>
    );
  }

  const hasTemplates =
    getAvailableTemplates(selectedOverlay.overlayType).length > 0;
  const resolution =
    selectedOverlay.overlayType === "card" ? "745×1040" : "1920×1080";

  return (
    <div className="sunken-subtle rounded-lg overflow-hidden">
      {/* Header with overlay name */}
      <div className="bg-primary/10 border-b border-primary/20 px-3 py-2">
        <h3 className="font-semibold text-sm truncate">
          {selectedOverlay.name}
        </h3>
      </div>

      <div className="p-3 space-y-3">
        {/* Info Grid */}
        <div className="space-y-1.5 text-sm">
          {/* Resolution */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Proportions className="size-3.5" />
            <span>Resolution</span>
          </div>
          <div className="font-mono text-xs bg-muted/50 px-1.5 py-0.5 rounded w-fit">
            {resolution}
          </div>
        </div>

        {/* URL Copy Section */}
        {selectedOverlayUrl && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Overlay URL
            </span>
            <div className="flex items-center gap-1.5">
              <div className="flex-1 min-w-0 bg-background border rounded px-2 py-1">
                <p className="text-xs font-mono text-muted-foreground truncate">
                  {selectedOverlayUrl}
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-7 w-7 p-0"
                    onClick={handleCopyUrl}
                  >
                    {copied ? (
                      <Check className="size-3 text-green-500" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {copied ? "Copied!" : "Copy URL"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-7 w-7 p-0"
                    asChild
                  >
                    <a
                      href={selectedOverlayUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-3" />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Open in new tab</TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}

        {/* Template Selection */}
        {hasTemplates && (
          <div className="space-y-1.5 pt-2.5 border-t border-border/50">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Template
            </span>
            <div className="flex items-center gap-1.5">
              <Select
                value={selectedTemplate ?? ""}
                onValueChange={(value) =>
                  setSelectedTemplate(value as TemplateType)
                }
              >
                <SelectTrigger className="flex-1 h-8 text-sm">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableTemplates(selectedOverlay.overlayType).map(
                    (template) => (
                      <SelectItem key={template} value={template}>
                        {template}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="shrink-0 h-8"
                onClick={handleSaveTemplate}
              >
                <Save className="size-3 mr-1" />
                Save
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
