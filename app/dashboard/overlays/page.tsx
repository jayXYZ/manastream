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
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

type OverlayType = "match" | "card" | "deck" | "standings";

export default function OverlaysPage() {
  const tournament = useQuery(api.tournaments.getUserTournament);
  const overlays = useQuery(api.overlays.getUserOverlays);
  const createMatchOverlay = useMutation(api.overlays.createMatchOverlay);
  const createCardOverlay = useMutation(api.overlays.createCardOverlay);
  // const createDeckOverlay = useMutation(api.overlays.createDeckOverlay);
  // const createStandingsOverlay = useMutation(api.overlays.createStandingsOverlay);
  const [selectedOverlayType, setSelectedOverlayType] =
    useState<OverlayType>("match");
  const [overlayName, setOverlayName] = useState("");

  const capitalizeFirstLetter = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const generateOverlayName = (type: OverlayType) => {
    const count =
      (overlays?.filter((overlay) => overlay.type === type).length ?? 0) + 1;
    return `${capitalizeFirstLetter(type)} Overlay ${count}`;
  };

  const handleOverlayTypeChange = (type: OverlayType) => {
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
                </SelectContent>
              </Select>
              <Input
                value={overlayName}
                onChange={(e) => setOverlayName(e.target.value)}
                placeholder="Overlay name"
              />
              <Button onClick={handleCreateOverlay}>Create Overlay</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Overlays</CardTitle>
        </CardHeader>
        <CardContent>
          {/* TODO: Add a table here */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Overlay Type</TableHead>
                <TableHead>URL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overlays?.map((overlay) => (
                <TableRow key={overlay._id}>
                  <TableCell>{overlay.name}</TableCell>
                  <TableCell>{capitalizeFirstLetter(overlay.type)}</TableCell>
                  <TableCell>
                    <a href={`/overlay/${overlay.publicUuid}`}>
                      {overlay.publicUuid}
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
