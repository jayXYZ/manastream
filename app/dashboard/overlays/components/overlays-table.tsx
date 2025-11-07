import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Overlay } from "@/convex/types";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import CopyButton from "@/components/copy-button";
import { cn } from "@/lib/utils";

export default function OverlaysTable({
  overlays,
  selectedOverlay,
  setSelectedOverlay,
}: {
  overlays: Overlay[];
  selectedOverlay: Overlay | null;
  setSelectedOverlay: (overlay: Overlay) => void;
}) {
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
              onClick={() => setSelectedOverlay(overlay)}
            >
              <TableCell>{overlay.name}</TableCell>
              <TableCell>
                <CopyButton
                  displayText={overlay.publicUuid}
                  textToCopy={`https://manastream.app/overlay/${overlay.publicUuid}`}
                />
              </TableCell>
            </TableRow>
          ) : (
            <>
              <TableRow
                key={overlay._id + "player1"}
                className={cn(
                  "group cursor-pointer",
                  selectedOverlay?._id === overlay._id && "bg-accent/10",
                )}
                onClick={() => setSelectedOverlay(overlay)}
              >
                <TableCell>{overlay.name + " - Player 1"}</TableCell>
                <TableCell>
                  <a href={`/overlay/${overlay.publicUuid}?player=1`}>
                    {overlay.publicUuid + "?player=1"}
                  </a>
                </TableCell>
              </TableRow>
              <TableRow
                key={overlay._id + "player2"}
                className={cn(
                  "group cursor-pointer",
                  selectedOverlay?._id === overlay._id && "bg-accent/10",
                )}
                onClick={() => setSelectedOverlay(overlay)}
              >
                <TableCell>{overlay.name + " - Player 2"}</TableCell>
                <TableCell>
                  <a href={`/overlay/${overlay.publicUuid}?player=2`}>
                    {overlay.publicUuid + "?player=2"}
                  </a>
                </TableCell>
              </TableRow>
            </>
          ),
        )}
      </TableBody>
    </Table>
  );
}
