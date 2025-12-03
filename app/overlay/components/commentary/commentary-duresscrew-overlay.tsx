import { api } from "@/convex/_generated/api";
import { CommentaryOverlay as CommentaryOverlayType } from "@/convex/types";
import { useQuery } from "convex/react";

export default function CommentaryDuressCrewOverlay({
  data,
}: {
  data: CommentaryOverlayType;
}) {
  // Fetch commentator info from tournament (source of truth)
  const tournamentInfo = useQuery(api.tournaments.getTournamentInfo, {
    tournamentId: data.tournamentId,
  });

  // Use tournament info for commentator names (source of truth)
  // Fall back to overlay data for backwards compatibility
  const commentatorLeft = tournamentInfo?.commentatorLeft ?? data?.commentatorLeft ?? "N/A";
  const commentatorRight = tournamentInfo?.commentatorRight ?? data?.commentatorRight ?? "N/A";

  return (
    <div>
      Commentary Duress Crew Overlay by {commentatorLeft} and{" "}
      {commentatorRight}
    </div>
  );
}
