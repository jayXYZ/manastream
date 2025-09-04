import { CommentaryOverlay as CommentaryOverlayType } from "@/convex/types";

export default function CommentaryDuressCrewOverlay({
  data,
}: {
  data: CommentaryOverlayType;
}) {
  return (
    <div>
      Commentary Duress Crew Overlay by {data.commentatorLeft} and{" "}
      {data.commentatorRight}
    </div>
  );
}
