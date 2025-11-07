import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { AccordionCard } from "../accordion-card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { Button } from "../ui/button";

export default function TournamentController() {
  const [inputs, setInputs] = useState({
    name: "",
    currentRoundDisplayName: "",
    commentatorLeft: "",
    commentatorLeftSubText: "",
    commentatorRight: "",
    commentatorRightSubText: "",
  });
  const tournament = useQuery(api.tournaments.getUserTournament);
  const userOverlays = useQuery(api.overlays.getUserOverlays);
  // TODO: Add overlay limits
  // currently only first commentary overlay will ever be updated
  const commentaryOverlay = userOverlays?.find(
    (overlay) => overlay.overlayType === "commentary",
  );
  const updateTournament = useMutation(api.tournaments.updateTournamentInfo);
  const updateCommentaryOverlay = useMutation(
    api.overlays.updateCommentaryOverlay,
  );

  useEffect(() => {
    if (tournament) {
      setInputs({
        name: tournament?.eventName || "",
        currentRoundDisplayName: tournament?.currentRoundDisplayName || "",
        commentatorLeft: commentaryOverlay?.commentatorLeft || "",
        commentatorLeftSubText: commentaryOverlay?.commentatorLeftSubText || "",
        commentatorRight: commentaryOverlay?.commentatorRight || "",
        commentatorRightSubText:
          commentaryOverlay?.commentatorRightSubText || "",
      });
    }
  }, [tournament, commentaryOverlay]);

  if (!tournament || !updateTournament || !updateCommentaryOverlay) {
    return;
  }

  const handleUpdate = () => {
    updateTournament({
      tournamentId: tournament._id,
      eventName: inputs.name,
      currentRoundDisplayName: inputs.currentRoundDisplayName,
    });

    if (commentaryOverlay) {
      updateCommentaryOverlay({
        overlayId: commentaryOverlay._id,
        commentatorLeft: inputs.commentatorLeft,
        commentatorLeftSubText: inputs.commentatorLeftSubText,
        commentatorRight: inputs.commentatorRight,
        commentatorRightSubText: inputs.commentatorRightSubText,
      });
    }
  };

  return (
    <AccordionCard title="Tournament Controller">
      <div className="flex flex-col gap-8 flex-grow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="eventName">Event Name</Label>
            <Input
              id="eventName"
              value={inputs.name}
              onChange={(e) => setInputs({ ...inputs, name: e.target.value })}
            />
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
        </div>
        {commentaryOverlay && (
          <>
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="commentatorLeft">Commentator Left</Label>
                  <Input
                    id="commentatorLeft"
                    value={inputs.commentatorLeft}
                    onChange={(e) =>
                      setInputs({ ...inputs, commentatorLeft: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="commentatorLeftSubText">
                    Commentator Left Sub Text
                  </Label>
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
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="commentatorRight">Commentator Right</Label>
                  <Input
                    id="commentatorRight"
                    value={inputs.commentatorRight}
                    onChange={(e) =>
                      setInputs({ ...inputs, commentatorRight: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="commentatorRightSubText">
                    Commentator Right Sub Text
                  </Label>
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
          </>
        )}
        <div className="flex justify-end">
          <Button
            className="px-6 py-2 text-base font-semibold rounded-md shadow bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            onClick={() => handleUpdate()}
          >
            Update
          </Button>
        </div>
      </div>
    </AccordionCard>
  );
}
