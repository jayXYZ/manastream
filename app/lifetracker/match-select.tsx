import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useLifeTrackerStore } from "./store";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { FeatureMatchWithPlayers } from "@/convex/types";
import { Id } from "@/convex/_generated/dataModel";

export default function MatchSelect() {
  const [showPlayerSelect, setShowPlayerSelect] = useState(false);
  const [selectedMatch, setSelectedMatch] =
    useState<FeatureMatchWithPlayers | null>(null);
  const connectedOverlayId = useLifeTrackerStore(
    (state) => state.connectedOverlayId,
  );
  const playersSwitched = useLifeTrackerStore((state) => state.playersSwitched);
  const setPlayersSwitched = useLifeTrackerStore(
    (state) => state.setPlayersSwitched,
  );
  const tournament = useQuery(api.tournaments.getUserTournament);

  const currentRoundFeatureMatches = useQuery(
    api.featurematches.getCurrentRoundFeatureMatches,
  );
  const setOverlayFeatureMatch = useMutation(
    api.overlays.setOverlayFeatureMatch,
  );

  const handleMatchSelect = (match: FeatureMatchWithPlayers) => {
    setSelectedMatch(match);
    setShowPlayerSelect(true);
  };

  const handlePlayerSelect = () => {
    setShowPlayerSelect(false);
    setOverlayFeatureMatch({
      overlayId: connectedOverlayId as Id<"overlays">,
      featureMatchId: selectedMatch?._id as Id<"featureMatches">,
      playersSwapped: playersSwitched,
    });
  };

  if (!tournament) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-2xl font-bold">Loading tournament...</div>
      </div>
    );
  }

  if (currentRoundFeatureMatches === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-2xl font-bold">Loading feature matches...</div>
      </div>
    );
  }

  if (currentRoundFeatureMatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-2xl font-bold text-center">
          No feature matches available
        </div>
        <div className="text-lg text-muted-foreground text-center">
          Waiting for feature matches to be selected for the current round.
        </div>
      </div>
    );
  }

  if (showPlayerSelect) {
    if (
      !selectedMatch ||
      !selectedMatch.player1Data ||
      !selectedMatch.player2Data
    ) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-xl font-bold text-center">
            No match selected or player data not found
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-4 justify-between h-full p-4">
        <div className="text-2xl font-bold text-center rotate-180">
          {playersSwitched
            ? selectedMatch.player1Data.name
            : selectedMatch.player2Data.name}
        </div>
        <div className="flex gap-4">
          <Button
            onClick={() => setPlayersSwitched(!playersSwitched)}
            className="w-full h-20 text-xl font-bold px-6 whitespace-normal break-words"
          >
            Switch Players
          </Button>
          <Button
            onClick={handlePlayerSelect}
            className="h-20 text-xl font-bold px-8 whitespace-normal"
          >
            Confirm
          </Button>
        </div>
        <div className="text-2xl font-bold text-center">
          {playersSwitched
            ? selectedMatch.player2Data.name
            : selectedMatch.player1Data.name}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 justify-center h-full overflow-y-auto px-4 py-8 w-full">
      {currentRoundFeatureMatches.map((match) => (
        <Button
          key={match._id}
          onClick={() => handleMatchSelect(match)}
          className="w-[80%] h-24 text-xl font-bold px-6 py-4 whitespace-normal break-words mx-auto"
        >
          {match.player1Data?.name || "Player 1"} vs{" "}
          {match.player2Data?.name || "Player 2"}
        </Button>
      ))}
    </div>
  );
}
