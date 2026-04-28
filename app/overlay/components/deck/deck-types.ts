import { FeatureMatchWithPlayers } from "@/convex/types";

export interface ParsedCard {
  count: number;
  name: string;
  imageUrl?: string;
  type_line: string;
  legality: string;
}

export interface ParsedDecklist {
  mainboard: ParsedCard[];
  sideboard: ParsedCard[];
}

export type DeckPlayerData = NonNullable<
  NonNullable<FeatureMatchWithPlayers>["player1Data"]
>;

export interface DeckTournamentInfo {
  eventName?: string;
  commentatorLeft?: string;
  commentatorRight?: string;
}

export interface DeckTemplateProps {
  parsedDecklist: ParsedDecklist;
  playerData: DeckPlayerData;
  tournamentInfo?: DeckTournamentInfo | null;
  braunDarkPalette?: string | null;
}
