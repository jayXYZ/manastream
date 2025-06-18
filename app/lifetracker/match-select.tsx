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
  const [playersSwitched, setPlayersSwitched] = useLifeTrackerStore((state) => [
    state.playersSwitched,
    state.setPlayersSwitched,
  ]);
  const tournament = useQuery(api.tournaments.getUserTournament);

  const currentRoundFeatureMatches = useQuery(
    api.featurematches.getCurrentRoundFeatureMatches,
  );

  const setOverlayFeatureMatch = useMutation(
    api.overlays.setOverlayFeatureMatch,
  );

  if (!tournament) {
    return <div>Loading...</div>;
  }

  if (!currentRoundFeatureMatches) {
    return <div>Waiting for feature matches</div>;
  }

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

  if (showPlayerSelect) {
    return (
      <div className="flex flex-col gap-4 justify-between h-full">
        <div className="text-2xl font-bold text-center rotate-180">
          {playersSwitched
            ? selectedMatch?.player1Data.name
            : selectedMatch?.player2Data.name}
        </div>
        <div className="flex gap-4">
          <Button onClick={() => setPlayersSwitched(!playersSwitched)}>
            Switch Players
          </Button>
          <Button onClick={handlePlayerSelect}>Confirm</Button>
        </div>
        <div className="text-2xl font-bold text-center">
          {playersSwitched
            ? selectedMatch?.player2Data.name
            : selectedMatch?.player1Data.name}
        </div>
      </div>
    );
  }

  // TODO add settings menu for returning to admin screen
  return (
    <div className="flex flex-col gap-4">
      {currentRoundFeatureMatches.map((match) => (
        <Button
          key={match._id}
          onClick={() => handleMatchSelect(match)}
          className="w-[80%] mx-auto text-2xl font-bold"
        >
          {match.player1Data.name} vs {match.player2Data.name}
        </Button>
      ))}
    </div>
  );
}
