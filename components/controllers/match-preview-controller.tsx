import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { MatchOverlayWithPlayers } from "@/convex/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Pencil } from "lucide-react";
import { Spinner } from "../ui/spinner";
import { Button } from "../ui/button";
import { updateMatchOverlayDisplayInfo } from "@/convex/_overlays/match";

interface MatchPreviewControllerProps {
  matchOverlayId: Id<"overlays">;
}

export function MatchPreviewController({
  matchOverlayId,
}: MatchPreviewControllerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const matchOverlay = useQuery(api.overlays.getOverlayById, {
    overlayId: matchOverlayId,
  });
  const updateMatchOverlayDisplayInfo = useMutation(
    api.overlays.updateMatchOverlayDisplayInfo,
  );
  if (!matchOverlay || !updateMatchOverlayDisplayInfo) {
    return;
  }

  return (
    <>
      <Card className={cn("group relative")}>
        <CardHeader>
          <Tooltip open={tooltipOpen} onOpenChange={setTooltipOpen}>
            <TooltipTrigger asChild>
              <button
                onClick={() => setIsOpen(true)}
                className={cn(
                  "ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                  tooltipOpen
                    ? "opacity-70"
                    : "group-hover:opacity-70 opacity-0",
                )}
              >
                <Pencil />
                <span className="sr-only">Edit</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Edit overlay</p>
            </TooltipContent>
          </Tooltip>
          <CardTitle>{matchOverlay.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <MatchOverlayPreview
            matchOverlay={matchOverlay as MatchOverlayWithPlayers}
          />
        </CardContent>
      </Card>
      <MatchOverlayPreviewDialog
        matchOverlay={matchOverlay as MatchOverlayWithPlayers}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        updateMatchOverlayDisplayInfo={updateMatchOverlayDisplayInfo}
      />
    </>
  );
}

function MatchOverlayPreview({
  matchOverlay,
}: {
  matchOverlay: MatchOverlayWithPlayers;
}) {
  return (
    <div className="w-full h-full flex flex-row">
      {/* player 1 */}
      <div className="w-[45%] flex flex-row">
        {/* player 1 life */}
        <div className="text-6xl font-bold flex items-center justify-center w-[25%] min-w-[2ch] text-right font-mono">
          {matchOverlay.player1Life}
        </div>

        {/* player 1 info */}
        <div className="flex flex-col gap-1 py-2 grow text-left pl-2">
          <div className="text-2xl font-bold whitespace-nowrap">
            {matchOverlay.player1DisplayName ||
              matchOverlay.player1Data?.name ||
              "Player 1"}
          </div>
          <div className="text-xl">
            <span>
              {matchOverlay.player1DisplayDeck ||
                matchOverlay.player1Data?.deckName ||
                "Deck 1"}
            </span>
            <span className="text-white/60 ml-2">
              {matchOverlay.player1TournamentRecord || "N/A"}
            </span>
          </div>
        </div>
      </div>

      <div className="w-[10%] flex flex-row items-center justify-center text-xl font-bold font-mono whitespace-nowrap">
        {matchOverlay.player1GamesWon} : {matchOverlay.player2GamesWon}
      </div>

      {/* player 2 */}
      <div className="w-[45%] flex flex-row">
        {/* player 2 info */}
        <div className="flex flex-col gap-1 py-2 grow text-right pr-2">
          <div className="text-3xl font-bold whitespace-nowrap">
            {matchOverlay.player2DisplayName ||
              matchOverlay.player2Data?.name ||
              "Player 2"}
          </div>
          <div className="text-xl">
            <span className="text-white/60 mr-2">
              {matchOverlay.player2TournamentRecord || "N/A"}
            </span>
            <span>
              {matchOverlay.player2DisplayDeck ||
                matchOverlay.player2Data?.deckName ||
                "Deck 2"}
            </span>
          </div>
        </div>
        {/* player 2 life */}
        <div className="text-6xl font-bold flex items-center justify-center text-right w-[25%] min-w-[2ch] font-mono">
          {matchOverlay.player2Life}
        </div>
      </div>
    </div>
  );
}

function MatchOverlayPreviewDialog({
  matchOverlay,
  isOpen,
  setIsOpen,
  updateMatchOverlayDisplayInfo,
}: {
  matchOverlay: MatchOverlayWithPlayers;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  updateMatchOverlayDisplayInfo: (args: {
    overlayId: Id<"overlays">;
    player1DisplayName?: string;
    player2DisplayName?: string;
    player1DisplayDeck?: string;
    player2DisplayDeck?: string;
    player1TournamentRecord?: string;
    player2TournamentRecord?: string;
  }) => Promise<null>;
}) {
  // Helper function to compute display values from matchOverlay
  const getDisplayValues = (overlay: MatchOverlayWithPlayers) => ({
    player1Name:
      overlay.player1DisplayName || overlay.player1Data?.name || "Player 1",
    player2Name:
      overlay.player2DisplayName || overlay.player2Data?.name || "Player 2",
    player1DeckName:
      overlay.player1DisplayDeck || overlay.player1Data?.deckName || "Deck 1",
    player2DeckName:
      overlay.player2DisplayDeck || overlay.player2Data?.deckName || "Deck 2",
    player1TournamentRecord: overlay.player1TournamentRecord || "N/A",
    player2TournamentRecord: overlay.player2TournamentRecord || "N/A",
  });

  const [inputs, setInputs] = useState(() => getDisplayValues(matchOverlay));

  // Sync inputs when dialog opens or when matchOverlay changes while dialog is open
  // This ensures inputs show API values after overrides are cleared
  useEffect(() => {
    if (isOpen) {
      setInputs(getDisplayValues(matchOverlay));
    }
  }, [matchOverlay, isOpen]);

  const handleUpdate = async () => {
    // Convert empty strings to undefined to clear overrides
    const updateData = {
      overlayId: matchOverlay._id,
      player1DisplayName: inputs.player1Name || undefined,
      player2DisplayName: inputs.player2Name || undefined,
      player1DisplayDeck: inputs.player1DeckName || undefined,
      player2DisplayDeck: inputs.player2DeckName || undefined,
      player1TournamentRecord: inputs.player1TournamentRecord || undefined,
      player2TournamentRecord: inputs.player2TournamentRecord || undefined,
    };

    await updateMatchOverlayDisplayInfo(updateData);

    // Update inputs to reflect cleared overrides (show API values)
    // This happens before the query updates, so we compute what the values should be
    setInputs({
      player1Name:
        updateData.player1DisplayName ||
        matchOverlay.player1Data?.name ||
        "Player 1",
      player2Name:
        updateData.player2DisplayName ||
        matchOverlay.player2Data?.name ||
        "Player 2",
      player1DeckName:
        updateData.player1DisplayDeck ||
        matchOverlay.player1Data?.deckName ||
        "Deck 1",
      player2DeckName:
        updateData.player2DisplayDeck ||
        matchOverlay.player2Data?.deckName ||
        "Deck 2",
      player1TournamentRecord: updateData.player1TournamentRecord || "N/A",
      player2TournamentRecord: updateData.player2TournamentRecord || "N/A",
    });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {matchOverlay.name}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-4">
            {/* Player 1 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="player1Name">Player 1 Name</Label>
              <Input
                id="player1Name"
                value={inputs.player1Name}
                onChange={(e) =>
                  setInputs({ ...inputs, player1Name: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="player1DeckName">Player 1 Deck Name</Label>
              <Input
                id="player1DeckName"
                value={inputs.player1DeckName}
                onChange={(e) =>
                  setInputs({ ...inputs, player1DeckName: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="player1TournamentRecord">
                Player 1 Tournament Record
              </Label>
              <Input
                id="player1TournamentRecord"
                value={inputs.player1TournamentRecord}
                onChange={(e) =>
                  setInputs({
                    ...inputs,
                    player1TournamentRecord: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <div className="flex flex-col gap-4">
            {/* Player 2 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="player2Name">Player 2 Name</Label>
              <Input
                id="player2Name"
                value={inputs.player2Name}
                onChange={(e) =>
                  setInputs({ ...inputs, player2Name: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="player2DeckName">Player 2 Deck Name</Label>
              <Input
                id="player2DeckName"
                value={inputs.player2DeckName}
                onChange={(e) =>
                  setInputs({ ...inputs, player2DeckName: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="player2TournamentRecord">
                Player 2 Tournament Record
              </Label>
              <Input
                id="player2TournamentRecord"
                value={inputs.player2TournamentRecord}
                onChange={(e) =>
                  setInputs({
                    ...inputs,
                    player2TournamentRecord: e.target.value,
                  })
                }
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => handleUpdate()}>Update</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
