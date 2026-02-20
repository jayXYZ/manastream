import {
  DeckOverlay as DeckOverlayType,
  FeatureMatchWithPlayers,
} from "@/convex/types";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import * as Scry from "scryfall-sdk";
import { useState, useEffect } from "react";
import DeckDuressCrewOverlay from "./deck-duress-crew-overlay";
import DeckBraunDarkOverlay from "./deck-braun-dark-overlay";
import { DeckPlayerData, ParsedCard, ParsedDecklist } from "./deck-types";

const TEMPLATE_COMPONENTS = {
  "Duress Crew": DeckDuressCrewOverlay,
  "Braun Dark": DeckBraunDarkOverlay,
} as const;

const cardCache: { [key: string]: Scry.Card } = {};

export default function DeckOverlay({ data }: { data: DeckOverlayType }) {
  const searchParams = useSearchParams();
  const playerNumber = searchParams.get("player");
  const tournamentInfo = useQuery(api.tournaments.getTournamentInfo, {
    tournamentId: data.tournamentId,
  });
  const matchInfo = useQuery(api.featurematches.getFeatureMatchPlayersAndDecks, {
    id: data.matchId!,
  });

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
  tournamentInfo: {
    eventName?: string;
    commentatorLeft?: string;
    commentatorRight?: string;
  } | null | undefined;
}) {
  const playerData =
    playerNumber === "1" ? matchInfo.player1Data : matchInfo.player2Data;
  const [parsedDecklist, setParsedDecklist] = useState<ParsedDecklist | null>(
    null,
  );

  useEffect(() => {
    if (!playerData) {
      return;
    }
    const fetchDecklist = async () => {
      const decklist = playerData.deckList;
      const parsed = await parseDecklist(decklist);
      setParsedDecklist(parsed);
    };
    fetchDecklist();
  }, [playerData]);

  if (!parsedDecklist || !playerData) {
    return <div>Loading...</div>;
  }

  const templateName = data.template ?? "Duress Crew";
  const TemplateComponent =
    templateName in TEMPLATE_COMPONENTS
      ? TEMPLATE_COMPONENTS[
          templateName as keyof typeof TEMPLATE_COMPONENTS
        ]
      : DeckDuressCrewOverlay;

  return (
    <TemplateComponent
      parsedDecklist={parsedDecklist}
      playerData={playerData as DeckPlayerData}
      tournamentInfo={tournamentInfo}
    />
  );
}

const parseDecklist = async (decklist: string) => {
  console.log("Parsing decklist:", decklist);
  const [mainboardStr, sideboardStr] = decklist.split("\nSIDEBOARD:\n");
  const mainboard: ParsedCard[] = [];
  const sideboard: ParsedCard[] = [];

  const processSection = async (section: string, array: ParsedCard[]) => {
    const lines = section.trim().split("\n");
    for (const line of lines) {
      const match = line.match(/^(\d+)\s+(.+)$/);
      if (match) {
        const [, count, name] = match;
        let card: Scry.Card;

        try {
          if (cardCache[name]) {
            card = cardCache[name];
          } else {
            if (
              name === "Plains" ||
              name === "Island" ||
              name === "Swamp" ||
              name === "Mountain" ||
              name === "Forest"
            ) {
              card = await Scry.Cards.byName(name, "LEB");
            } else {
              const searchQuery = `!"${name}" not:reprint`;
              const query = await Scry.Cards.search(searchQuery)
                .cancelAfterPage()
                .waitForAll();
              card = query[0];
              cardCache[name] = card;
            }
          }

          array.push({
            count: parseInt(count),
            name,
            imageUrl:
              card.image_uris?.png || card.card_faces?.[0].image_uris?.png,
            type_line: card.type_line,
            legality: card.legalities?.premodern,
          });
        } catch (error) {
          console.error(`Error processing card ${name}:`, error);
        }
      }
    }
  };

  await processSection(mainboardStr, mainboard);
  if (sideboardStr) {
    await processSection(sideboardStr, sideboard);
  }

  return { mainboard: sortList(mainboard), sideboard: sortList(sideboard) };
};

const getTypeOrder = (type_line: string): number => {
  if (type_line.includes("Creature")) return 1;
  if (type_line.includes("Instant")) return 2;
  if (type_line.includes("Sorcery")) return 3;
  if (type_line.includes("Enchantment")) return 4;
  if (type_line.includes("Artifact")) return 5;
  if (type_line.includes("Basic")) return 7;
  if (type_line.includes("Land")) return 6;
  return 8;
};

const sortList = (cards: ParsedCard[]) => {
  const cardsByName = cards.reduce(
    (acc, card) => {
      if (!acc[card.name]) {
        acc[card.name] = card;
      }
      return acc;
    },
    {} as { [key: string]: ParsedCard },
  );

  return Object.values(cardsByName).sort((a, b) => {
    const typeOrderA = getTypeOrder(a.type_line);
    const typeOrderB = getTypeOrder(b.type_line);

    if (typeOrderA !== typeOrderB) {
      return typeOrderA - typeOrderB;
    }
    if (a.count !== b.count) {
      return b.count - a.count;
    }
    return a.name.localeCompare(b.name);
  });
};
