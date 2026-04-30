import {
  DeckOverlay as DeckOverlayType,
  FeatureMatchWithPlayers,
} from "@/convex/types";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import DeckDuressCrewOverlay from "./deck-duress-crew-overlay";
import DeckBraunDarkOverlay from "./deck-braun-dark-overlay";
import { DeckPlayerData } from "./deck-types";

const TEMPLATE_COMPONENTS = {
  "Duress Crew": DeckDuressCrewOverlay,
  "Braun Dark": DeckBraunDarkOverlay,
} as const;

export default function DeckOverlay({ data }: { data: DeckOverlayType }) {
  const searchParams = useSearchParams();
  const playerNumber = searchParams.get("player");
  const tournamentInfo = useQuery(api.tournaments.getTournamentInfo, {
    tournamentId: data.tournamentId,
  });
  const matchInfo = useQuery(
    api.featurematches.getFeatureMatchPlayersAndDecks,
    {
      id: data.matchId!,
    },
  );

  if (!data.matchId) {
    return <div>No match ID found</div>;
  }
  if (!playerNumber || (playerNumber !== "1" && playerNumber !== "2")) {
    return <div>Please select a player to view their deck</div>;
  }
  if (!matchInfo) {
    return <div>Loading...</div>;
  }

  return (
    <DeckTemplateRenderer
      data={data}
      matchInfo={matchInfo}
      playerNumber={playerNumber}
      tournamentInfo={tournamentInfo}
    />
  );
}

function DeckTemplateRenderer({
  data,
  matchInfo,
  playerNumber,
  tournamentInfo,
}: {
  data: DeckOverlayType;
  matchInfo: NonNullable<FeatureMatchWithPlayers>;
  playerNumber: "1" | "2";
  tournamentInfo:
    | {
        eventName?: string;
        commentatorLeft?: string;
        commentatorRight?: string;
      }
    | null
    | undefined;
}) {
  const playerData =
    playerNumber === "1" ? matchInfo.player1Data : matchInfo.player2Data;

  if (!playerData) {
    return <div>Loading...</div>;
  }
  if (!playerData.deckCards) {
    if (playerData.deckCardsStatus === "failed") {
      return <div>Deck card images unavailable</div>;
    }
    return <div>Loading deck card images...</div>;
  }

  const templateName = data.template ?? "Duress Crew";
  const TemplateComponent =
    templateName in TEMPLATE_COMPONENTS
      ? TEMPLATE_COMPONENTS[templateName as keyof typeof TEMPLATE_COMPONENTS]
      : DeckDuressCrewOverlay;

  return (
    <TemplateComponent
      parsedDecklist={playerData.deckCards}
      playerData={playerData as DeckPlayerData}
      tournamentInfo={tournamentInfo}
      braunDarkPalette={data.braunDarkPalette}
    />
  );
}
