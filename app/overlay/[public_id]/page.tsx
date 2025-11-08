"use client";

import { api } from "@/convex/_generated/api";
import {
  CardOverlay as CardOverlayType,
  MatchOverlayWithPlayers,
  DeckOverlay as DeckOverlayType,
  StandingsOverlay,
  CommentaryOverlay as CommentaryOverlayType,
  Overlay as OverlayType,
} from "@/convex/types";
import { useQuery } from "convex/react";
import { use } from "react";
import CardOverlay from "../components/card-overlay";
import MatchOverlay from "../components/match/match-overlay";
import CommentaryOverlay from "../components/commentary/commentary-overlay";
import DeckOverlay from "../components/deck/deck-overlay";

// Type guard functions for better type safety
const isMatchOverlay = (
  overlay: OverlayType,
): overlay is MatchOverlayWithPlayers => {
  return overlay.overlayType === "match";
};

const isCardOverlay = (overlay: OverlayType): overlay is CardOverlayType => {
  return overlay.overlayType === "card";
};

const isDeckOverlay = (overlay: OverlayType): overlay is DeckOverlayType => {
  return overlay.overlayType === "deck";
};

const isStandingsOverlay = (
  overlay: OverlayType,
): overlay is StandingsOverlay => {
  return overlay.overlayType === "standings";
};

const isCommentaryOverlay = (
  overlay: OverlayType,
): overlay is CommentaryOverlayType => {
  return overlay.overlayType === "commentary";
};

// Overlay renderer function
const renderOverlay = (overlay: OverlayType) => {
  if (isMatchOverlay(overlay)) {
    return <MatchOverlay data={overlay} />;
  }

  if (isCardOverlay(overlay)) {
    return <CardOverlay data={overlay} />;
  }

  if (isDeckOverlay(overlay)) {
    return <DeckOverlay data={overlay} />;
  }

  if (isStandingsOverlay(overlay)) {
    return <div>Standings overlay not yet implemented</div>;
  }

  if (isCommentaryOverlay(overlay)) {
    return <CommentaryOverlay data={overlay} />;
  }

  return (
    <div>Overlay type &quot;{overlay.overlayType}&quot; not supported</div>
  );
};

export default function OverlayPage({
  params,
}: {
  params: Promise<{ public_id: string }>;
}) {
  const { public_id } = use(params);
  const overlay = useQuery(api.overlays.getOverlayByUuid, {
    publicUuid: public_id,
  });

  if (!overlay) {
    return <div>Overlay not found</div>;
  }

  return renderOverlay(overlay);
}
