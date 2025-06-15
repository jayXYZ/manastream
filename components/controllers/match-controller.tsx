import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Id } from "@/convex/_generated/dataModel";
import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { MatchOverlayWithPlayers } from "@/convex/types";
import { Label } from "../ui/label";
import { AccordionCard } from "../accordion-card";

interface MatchControllerProps {
  matchId: Id<"overlays">;
}

export function MatchController({ matchId }: MatchControllerProps) {
  const [inputs, setInputs] = useState({
    player1Name: "",
    player2Name: "",
    player1DeckName: "",
    player2DeckName: "",
    player1TournamentRecord: "",
    player2TournamentRecord: "",
  });

  const match = useQuery(api.overlays.getOverlayById, { overlayId: matchId });
  const updateMatch = useMutation(api.overlays.updateMatchOverlay);

  useEffect(() => {
    if (match && match.overlayType === "match") {
      const matchWithPlayers = match as MatchOverlayWithPlayers;
      setInputs({
        player1Name:
          matchWithPlayers.player1DisplayName ||
          matchWithPlayers.player1Data?.name ||
          "",
        player2Name:
          matchWithPlayers.player2DisplayName ||
          matchWithPlayers.player2Data?.name ||
          "",
        player1DeckName:
          matchWithPlayers.player1Data?.deckName ||
          matchWithPlayers.player1DisplayDeck ||
          "",
        player2DeckName:
          matchWithPlayers.player2Data?.deckName ||
          matchWithPlayers.player2DisplayDeck ||
          "",
        player1TournamentRecord:
          matchWithPlayers.player1Data?.record ||
          matchWithPlayers.player1TournamentRecord ||
          "",
        player2TournamentRecord:
          matchWithPlayers.player2Data?.record ||
          matchWithPlayers.player2TournamentRecord ||
          "",
      });
    }
  }, [match]);

  if (!match) {
    return <p>Loading...</p>;
  }

  if (match?.overlayType !== "match") {
    throw new Error("Overlay type mismatch");
  }

  return (
    <AccordionCard title="Match Controller">
      <div className="flex flex-col gap-2">
        <div className="flex flex-row gap-2">
          <div className="flex flex-col gap-2">
            <Label>Player 1</Label>
            <Input
              value={inputs.player1Name}
              onChange={(e) =>
                setInputs({ ...inputs, player1Name: e.target.value })
              }
            />
            <Input
              value={inputs.player1DeckName}
              onChange={(e) =>
                setInputs({ ...inputs, player1DeckName: e.target.value })
              }
            />
            <Input
              value={inputs.player1TournamentRecord}
              onChange={(e) =>
                setInputs({
                  ...inputs,
                  player1TournamentRecord: e.target.value,
                })
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Player 2</Label>
            <Input
              value={inputs.player2Name}
              onChange={(e) =>
                setInputs({ ...inputs, player2Name: e.target.value })
              }
            />
            <Input
              value={inputs.player2DeckName}
              onChange={(e) =>
                setInputs({ ...inputs, player2DeckName: e.target.value })
              }
            />
            <Input
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

        <Button
          onClick={() => {
            updateMatch({
              overlayId: match._id,
              player1DisplayName: inputs.player1Name,
              player2DisplayName: inputs.player2Name,
            });
          }}
        >
          Update
        </Button>
      </div>
    </AccordionCard>
  );
}
