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
      <div className="flex flex-col gap-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Player 1 */}
          <div className="flex flex-col gap-4 p-4 border rounded-lg bg-muted/50">
            <h3 className="font-semibold text-lg mb-2">Player 1</h3>
            <div className="flex flex-col gap-2">
              <Label htmlFor="player1Name">Name</Label>
              <Input
                id="player1Name"
                value={inputs.player1Name}
                onChange={(e) =>
                  setInputs({ ...inputs, player1Name: e.target.value })
                }
                placeholder="Enter player 1 name"
                className=""
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="player1DeckName">Deck Name</Label>
              <Input
                id="player1DeckName"
                value={inputs.player1DeckName}
                onChange={(e) =>
                  setInputs({ ...inputs, player1DeckName: e.target.value })
                }
                placeholder="Enter deck name"
                className=""
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="player1TournamentRecord">Tournament Record</Label>
              <Input
                id="player1TournamentRecord"
                value={inputs.player1TournamentRecord}
                onChange={(e) =>
                  setInputs({
                    ...inputs,
                    player1TournamentRecord: e.target.value,
                  })
                }
                placeholder="e.g. 3-1"
                className=""
              />
            </div>
          </div>
          {/* Player 2 */}
          <div className="flex flex-col gap-4 p-4 border rounded-lg bg-muted/50">
            <h3 className="font-semibold text-lg mb-2">Player 2</h3>
            <div className="flex flex-col gap-2">
              <Label htmlFor="player2Name">Name</Label>
              <Input
                id="player2Name"
                value={inputs.player2Name}
                onChange={(e) =>
                  setInputs({ ...inputs, player2Name: e.target.value })
                }
                placeholder="Enter player 2 name"
                className=""
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="player2DeckName">Deck Name</Label>
              <Input
                id="player2DeckName"
                value={inputs.player2DeckName}
                onChange={(e) =>
                  setInputs({ ...inputs, player2DeckName: e.target.value })
                }
                placeholder="Enter deck name"
                className=""
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="player2TournamentRecord">Tournament Record</Label>
              <Input
                id="player2TournamentRecord"
                value={inputs.player2TournamentRecord}
                onChange={(e) =>
                  setInputs({
                    ...inputs,
                    player2TournamentRecord: e.target.value,
                  })
                }
                placeholder="e.g. 3-1"
                className=""
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            className="px-6 py-2 text-base font-semibold rounded-md shadow bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
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
      </div>
    </AccordionCard>
  );
}
