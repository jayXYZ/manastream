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
import { MoreHorizontal } from "lucide-react";
import { Overlay } from "@/convex/types";
import OverlaySettings from "./components/overlay-settings";
import OverlaysTable from "./components/overlays-table";
import OverlayPreview from "./components/overlay-preview";

export default function OverlaysPage() {
  const tournament = useQuery(api.tournaments.getUserTournament);
  const overlays = useQuery(api.overlays.getUserOverlays);
  const [selectedOverlayType, setSelectedOverlayType] =
    useState<Overlay["overlayType"]>("match");
  const [overlayName, setOverlayName] = useState("");
  const [selectedOverlay, setSelectedOverlay] = useState<Overlay | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (!tournament || !overlays) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      <div className="flex-1 min-w-0 min-h-0">
        <OverlaysTable
          overlays={overlays}
          selectedOverlay={selectedOverlay}
          setSelectedOverlay={setSelectedOverlay}
        />
      </div>

      <div className="flex-shrink-0">
        <OverlayPreview overlay={selectedOverlay} />
      </div>

      {selectedOverlay && (
        <OverlaySettings
          overlay={selectedOverlay}
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
        />
      )}
    </div>
  );
}
