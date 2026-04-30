import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DeckOverlay,
  Overlay,
  Tournament,
  StandingsOverlay,
} from "@/convex/types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

function PreviewRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex flex-row justify-between gap-2 min-w-0">
      <div className="text-sm text-white/60 shrink-0">{label}</div>
      <div
        className="text-sm text-white/60 truncate text-right"
        title={value ?? "N/A"}
      >
        {value || "N/A"}
      </div>
    </div>
  );
}

export function TournamentPreviewController() {
  const [isOpen, setIsOpen] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const tournament = useQuery(api.tournaments.getUserTournament);
  const userOverlays = useQuery(api.overlays.getUserOverlays);

  const deckOverlay = userOverlays?.find(
    (overlay) => overlay.overlayType === "deck",
  ) as DeckOverlay;
  const standingsOverlay = userOverlays?.find(
    (overlay) => overlay.overlayType === "standings",
  ) as StandingsOverlay;

  const deckOverlayMatch = useQuery(
    api.featurematches.getFeatureMatchPlayersAndDecks,
    deckOverlay?.matchId
      ? { id: deckOverlay.matchId as Id<"featureMatches"> }
      : "skip",
  );

  if (!tournament || !userOverlays || !deckOverlay) {
    return null;
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
              <p>Edit tournament</p>
            </TooltipContent>
          </Tooltip>
          <CardTitle>Tournament Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono sunken rounded-lg p-4">
            <div className="flex flex-col gap-2 min-w-0">
              <PreviewRow
                label="Tournament Name"
                value={tournament.eventName}
              />
              <PreviewRow
                label="Current Round"
                value={tournament.currentRoundDisplayName}
              />
              <PreviewRow
                label="Commentator Left"
                value={tournament.commentatorLeft}
              />
              <PreviewRow
                label="Subtext Left"
                value={tournament.commentatorLeftSubText}
              />
            </div>
            <div className="flex flex-col gap-2 min-w-0">
              <PreviewRow
                label="Deck Overlay"
                value={
                  deckOverlayMatch?.player1Data?.name &&
                  deckOverlayMatch?.player2Data?.name
                    ? `${deckOverlayMatch.player1Data.name} vs ${deckOverlayMatch.player2Data.name}`
                    : undefined
                }
              />
              <PreviewRow
                label="Standings Overlay"
                value={standingsOverlay?.name}
              />
              <PreviewRow
                label="Commentator Right"
                value={tournament.commentatorRight}
              />
              <PreviewRow
                label="Subtext Right"
                value={tournament.commentatorRightSubText}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      <TournamentOverlayPreviewDialog
        key={isOpen ? "open" : "closed"}
        tournament={tournament}
        userOverlays={userOverlays}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
      />
    </>
  );
}

function TournamentOverlayPreviewDialog({
  tournament,
  userOverlays,
  isOpen,
  setIsOpen,
}: {
  tournament: Tournament;
  userOverlays: Overlay[];
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}) {
  const deckOverlay = userOverlays.find(
    (overlay) => overlay.overlayType === "deck",
  ) as DeckOverlay;
  const standingsOverlay = userOverlays.find(
    (overlay) => overlay.overlayType === "standings",
  ) as StandingsOverlay;
  const allFeatureMatches = useQuery(api.featurematches.getAllFeatureMatches);
  const completedRounds = useQuery(api.spicerack.getSpicerackCompletedRounds, {
    spicerackTournamentId: tournament.spicerackTournamentId ?? -1,
  });
  const [inputs, setInputs] = useState({
    eventName: tournament.eventName ?? "",
    currentRoundDisplayName: tournament.currentRoundDisplayName ?? "",
    // Commentator info now comes from tournament
    commentatorLeft: tournament.commentatorLeft ?? "",
    commentatorLeftSubText: tournament.commentatorLeftSubText ?? "",
    commentatorRight: tournament.commentatorRight ?? "",
    commentatorRightSubText: tournament.commentatorRightSubText ?? "",
    deckOverlayMatchId: deckOverlay?.matchId,
    standingsOverlayRoundId: standingsOverlay?.spicerackRoundId ?? -1,
  });

  const updateDeckOverlay = useMutation(api.overlays.updateDeckOverlay);
  const updateTournament = useMutation(api.tournaments.updateTournamentInfo);
  const updateStandingsOverlay = useMutation(
    api.overlays.updateStandingsOverlay,
  );
  const handleUpdate = () => {
    if (deckOverlay) {
      updateDeckOverlay({
        overlayId: deckOverlay._id,
        matchId: inputs.deckOverlayMatchId,
      });
    }
    // Update tournament with event info AND commentator info
    updateTournament({
      tournamentId: tournament._id,
      eventName: inputs.eventName,
      currentRoundDisplayName: inputs.currentRoundDisplayName,
      commentatorLeft: inputs.commentatorLeft,
      commentatorLeftSubText: inputs.commentatorLeftSubText,
      commentatorRight: inputs.commentatorRight,
      commentatorRightSubText: inputs.commentatorRightSubText,
    });
    if (standingsOverlay && inputs.standingsOverlayRoundId !== -1) {
      updateStandingsOverlay({
        overlayId: standingsOverlay._id,
        spicerackRoundId: inputs.standingsOverlayRoundId,
      });
    }
  };
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Tournament</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {/* First 2x2 grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="eventName">Event Name</Label>
              <Input
                id="eventName"
                value={inputs.eventName}
                onChange={(e) =>
                  setInputs({ ...inputs, eventName: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Deck Overlay Match</Label>
              <Select
                value={inputs.deckOverlayMatchId ?? ""}
                onValueChange={(value) =>
                  setInputs({
                    ...inputs,
                    deckOverlayMatchId: value
                      ? (value as Id<"featureMatches">)
                      : undefined,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a match" />
                </SelectTrigger>
                <SelectContent>
                  {allFeatureMatches?.map((featureMatch) => (
                    <SelectItem key={featureMatch._id} value={featureMatch._id}>
                      Round {featureMatch.roundNumber} -{" "}
                      {featureMatch.player1Data?.name} vs{" "}
                      {featureMatch.player2Data?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="currentRoundDisplayName">Current Round</Label>
              <Input
                id="currentRoundDisplayName"
                value={inputs.currentRoundDisplayName}
                onChange={(e) =>
                  setInputs({
                    ...inputs,
                    currentRoundDisplayName: e.target.value,
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Standings Overlay Round</Label>
              <Select
                value={inputs.standingsOverlayRoundId.toString()}
                onValueChange={(value) =>
                  setInputs({
                    ...inputs,
                    standingsOverlayRoundId: Number(value),
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a round" />
                </SelectTrigger>
                <SelectContent>
                  {completedRounds && completedRounds.length > 0 ? (
                    completedRounds.map((round) => (
                      <SelectItem
                        key={round.roundId}
                        value={round.roundId.toString()}
                      >
                        {round.roundName}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="-1">N/A</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Second 2x2 grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="commentatorLeft">Commentator Left</Label>
              <Input
                id="commentatorLeft"
                value={inputs.commentatorLeft}
                onChange={(e) =>
                  setInputs({
                    ...inputs,
                    commentatorLeft: e.target.value,
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="commentatorRight">Commentator Right</Label>
              <Input
                id="commentatorRight"
                value={inputs.commentatorRight}
                onChange={(e) =>
                  setInputs({
                    ...inputs,
                    commentatorRight: e.target.value,
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="commentatorLeftSubText">Subtext Left</Label>
              <Input
                id="commentatorLeftSubText"
                value={inputs.commentatorLeftSubText}
                onChange={(e) =>
                  setInputs({
                    ...inputs,
                    commentatorLeftSubText: e.target.value,
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="commentatorRightSubText">Subtext Right</Label>
              <Input
                id="commentatorRightSubText"
                value={inputs.commentatorRightSubText}
                onChange={(e) =>
                  setInputs({
                    ...inputs,
                    commentatorRightSubText: e.target.value,
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
