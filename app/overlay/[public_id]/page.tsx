"use client";

import { api } from "@/convex/_generated/api";
import { MatchOverlayWithPlayers } from "@/convex/types";
import { useQuery } from "convex/react";
import { use } from "react";

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
  if (overlay.overlayType === "match") {
    return <MatchOverlay data={overlay as MatchOverlayWithPlayers} />;
  }
  // if (overlay.overlayType === "card") {
  //   return <CardOverlay data={overlay} />;
  // }
  // if (overlay.overlayType === "deck") {
  //   return <DeckOverlay data={overlay} />;
  // }
  return <div>Overlay type not supported</div>;
}

function MatchOverlay({ data }: { data: MatchOverlayWithPlayers }) {
  return (
    <div>
      <h1>Match Overlay</h1>
      <div>
        <p>{data.player1Data?.name || data.player1DisplayName || "Player 1"}</p>
        <p>
          {data.player1Data?.deckName || data.player1DisplayDeck || "Deck 1"}
        </p>
        <p>{data.player1Data?.record || data.player1TournamentRecord || ""}</p>
        <p>{data.player1Life || 20}</p>
        <p>{data.player1GamesWon || 0}</p>
      </div>
      <div>
        <p>{data.player2Data?.name || data.player2DisplayName || "Player 2"}</p>
        <p>
          {data.player2Data?.deckName || data.player2DisplayDeck || "Deck 2"}
        </p>
        <p>{data.player2Data?.record || data.player2TournamentRecord || ""}</p>
        <p>{data.player2Life || 20}</p>
        <p>{data.player2GamesWon || 0}</p>
      </div>
    </div>
  );
}
