"use client";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Overlay } from "@/convex/types";
import CopyButton from "@/components/copy-button";
import { cn } from "@/lib/utils";
import React, { useEffect, useState } from "react";

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
  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    // Get the current origin (works for localhost, production, and preview branches)
    setOrigin(window.location.origin);
  }, []);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>URL</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {overlays?.map((overlay) =>
          overlay.overlayType !== "deck" ? (
            <TableRow
              key={overlay._id}
              className={cn(
                "group cursor-pointer",
                selectedOverlay?._id === overlay._id && "bg-accent/10",
              )}
              onClick={() => setSelectedOverlay(overlay, undefined)}
            >
              <TableCell>{overlay.name}</TableCell>
              <TableCell>
                <CopyButton
                  displayText={overlay.publicUuid}
                  textToCopy={`${origin}/overlay/${overlay.publicUuid}`}
                />
              </TableCell>
            </TableRow>
          ) : (
            <React.Fragment key={overlay._id}>
              <TableRow
                className={cn(
                  "group cursor-pointer",
                  selectedOverlay?._id === overlay._id &&
                    selectedPlayerNumber === 1 &&
                    "bg-accent/10",
                )}
                onClick={() => setSelectedOverlay(overlay, 1)}
              >
                <TableCell>{overlay.name + " - Player 1"}</TableCell>
                <TableCell>
                  <CopyButton
                    displayText={overlay.publicUuid + "?player=1"}
                    textToCopy={`${origin}/overlay/${overlay.publicUuid}?player=1`}
                  />
                </TableCell>
              </TableRow>
              <TableRow
                className={cn(
                  "group cursor-pointer",
                  selectedOverlay?._id === overlay._id &&
                    selectedPlayerNumber === 2 &&
                    "bg-accent/10",
                )}
                onClick={() => setSelectedOverlay(overlay, 2)}
              >
                <TableCell>{overlay.name + " - Player 2"}</TableCell>
                <TableCell>
                  <CopyButton
                    displayText={overlay.publicUuid + "?player=2"}
                    textToCopy={`${origin}/overlay/${overlay.publicUuid}?player=2`}
                  />
                </TableCell>
              </TableRow>
            </React.Fragment>
          ),
        )}
      </TableBody>
    </Table>
  );
}
