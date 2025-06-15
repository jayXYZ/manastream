import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { Button } from "../ui/button";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { MatchOverlayWithPlayers } from "@/convex/types";
import { Label } from "../ui/label";

interface MatchControllerProps {
  matchId: Id<"overlays">;
}

export function MatchController({ matchId }: MatchControllerProps) {
  const match = useQuery(api.overlays.getOverlayById, {
    overlayId: matchId,
  });

  if (!match || match.overlayType !== "match") {
    throw new Error("Match overlay not found");
  }

  const matchWithPlayers = match as MatchOverlayWithPlayers;

  const [inputs, setInputs] = useState<{
    player1Name: string;
    player2Name: string;
    player1DeckName: string;
    player2DeckName: string;
    player1TournamentRecord: string;
    player2TournamentRecord: string;
  }>({
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

  const updateMatch = useMutation(api.overlays.updateMatchOverlay);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{match.name}</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
