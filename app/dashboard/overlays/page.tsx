"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Overlay, TemplateType } from "@/convex/types";

export default function OverlaysPage() {
  const tournament = useQuery(api.tournaments.getUserTournament);
  const overlays = useQuery(api.overlays.getUserOverlays);
  const createMatchOverlay = useMutation(api.overlays.createMatchOverlay);
  const createCardOverlay = useMutation(api.overlays.createCardOverlay);
  const createCommentaryOverlay = useMutation(
    api.overlays.createCommentaryOverlay,
  );
  const setOverlayTemplate = useMutation(api.overlays.setOverlayTemplate);
  // const createDeckOverlay = useMutation(api.overlays.createDeckOverlay);
  // const createStandingsOverlay = useMutation(api.overlays.createStandingsOverlay);
  const [selectedOverlayType, setSelectedOverlayType] =
    useState<Overlay["overlayType"]>("match");
  const [overlayName, setOverlayName] = useState("");
  const [selectedOverlay, setSelectedOverlay] = useState<Overlay | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<TemplateType>("Default");

  const capitalizeFirstLetter = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const generateOverlayName = (type: Overlay["overlayType"]) => {
    const count =
      (overlays?.filter((overlay) => overlay.overlayType === type).length ??
        0) + 1;
    return `${capitalizeFirstLetter(type)} Overlay ${count}`;
  };

  const handleOverlayTypeChange = (type: Overlay["overlayType"]) => {
    setSelectedOverlayType(type);
    setOverlayName(generateOverlayName(type));
  };

  const handleCreateOverlay = () => {
    if (!tournament) {
      return;
    }
    if (selectedOverlayType === "match") {
      createMatchOverlay({
        tournamentId: tournament._id,
        name: overlayName,
      });
    }
    if (selectedOverlayType === "card") {
      createCardOverlay({
        tournamentId: tournament._id,
        name: overlayName,
      });
    }
    if (selectedOverlayType === "commentary") {
      createCommentaryOverlay({
        tournamentId: tournament._id,
        name: overlayName,
      });
    }
  };

  const handleOpenDialog = (overlay: Overlay) => {
    setSelectedOverlay(overlay);
    if (
      overlay.overlayType === "match" ||
      overlay.overlayType === "commentary"
    ) {
      setSelectedTemplate(overlay.template as TemplateType);
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (
      (selectedOverlay?.overlayType === "match" ||
        selectedOverlay?.overlayType === "commentary") &&
      selectedTemplate
    ) {
      setOverlayTemplate({
        overlayId: selectedOverlay._id,
        template: selectedTemplate,
      });
    }
    setIsDialogOpen(false);
  };

  if (!tournament) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Overlays
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          Manage and configure your tournament overlays
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overlay Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 mt-4">
            <p className="text-gray-600 dark:text-gray-300">
              Create a new overlay
            </p>
            <div className="flex gap-2 w-[500px]">
              <Select
                value={selectedOverlayType}
                onValueChange={handleOverlayTypeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select overlay type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="match">Match</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="commentary">Commentary</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={overlayName}
                onChange={(e) => setOverlayName(e.target.value)}
                placeholder="Overlay name"
              />
              <Button
                onClick={handleCreateOverlay}
                disabled={!overlayName.trim()}
              >
                Create Overlay
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Overlays</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Overlay Type</TableHead>
                <TableHead>URL</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overlays?.map((overlay) => (
                <TableRow
                  key={overlay._id}
                  className="group hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <TableCell>{overlay.name}</TableCell>
                  <TableCell>
                    {capitalizeFirstLetter(overlay.overlayType)}
                  </TableCell>
                  <TableCell>
                    <a href={`/overlay/${overlay.publicUuid}`}>
                      {overlay.publicUuid}
                    </a>
                  </TableCell>
                  <TableCell>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(overlay)}
                        className="h-8 w-8 p-0"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {selectedOverlay
                ? `${selectedOverlay.name} Settings`
                : "Overlay Settings"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedOverlay?.overlayType === "match" ||
            selectedOverlay?.overlayType === "commentary" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Template</label>
                <Select
                  value={selectedTemplate}
                  onValueChange={(value: TemplateType) =>
                    setSelectedTemplate(value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Default">Default</SelectItem>
                    <SelectItem value="Duress Crew">Duress Crew</SelectItem>
                    <SelectItem value="Lobstercon">Lobstercon</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="text-gray-500 dark:text-gray-400">
                <p>
                  Settings for {selectedOverlay?.overlayType} overlays are not
                  yet implemented.
                </p>
                <p className="text-sm mt-2">
                  This is placeholder content for future development.
                </p>
              </div>
            )}
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save Changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
