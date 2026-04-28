import { Infer } from "convex/values";
import {
  cardOverlayValidator,
  commentaryOverlayValidator,
  deckOverlayValidator,
  featureMatchWithPlayersValidator,
  getTournamentInfoValidator,
  matchOverlayValidator,
  matchOverlayWithPlayersValidator,
  standingsOverlayWithPlayersValidator,
} from "./validators";
import { Doc } from "./_generated/dataModel";

export type Overlay = Doc<"overlays">;
export type Player = Doc<"players">;
export type PlayerWithData = Player & {
  registrationStatus?: string;
  deckId: number;
  decklistStatus?: Player["decklistStatus"];
  deckName: string;
  deckList: string;
};
export type Tournament = Doc<"tournaments">;
export type SpicerackTournament = Doc<"spicerackTournaments">;
export type RoundStandings = Doc<"roundStandings">;
export type Settings = Doc<"settings">;

export type MatchOverlay = Infer<typeof matchOverlayValidator>;
export type CardOverlay = Infer<typeof cardOverlayValidator>;
export type DeckOverlay = Infer<typeof deckOverlayValidator>;
export type CommentaryOverlay = Infer<typeof commentaryOverlayValidator>;
export type StandingsOverlay = Infer<
  typeof standingsOverlayWithPlayersValidator
>;

export type MatchOverlayWithPlayers = Infer<
  typeof matchOverlayWithPlayersValidator
>;
export type FeatureMatchWithPlayers = Infer<
  typeof featureMatchWithPlayersValidator
>;

export type OverlayType = Overlay["overlayType"];

// Template types from the validators
export type TemplateType =
  | "Default"
  | "Duress Crew"
  | "Lobstercon"
  | "Custom"
  | "Braun Dark"
  | "Braun Dark Duo"
  | "LC26";
export type CardTemplateName = "Default" | "Braun Dark";
export type DeckTemplateName = "Duress Crew" | "Braun Dark";
export type BraunDarkPaletteName = "Dark" | "Maroon";

// Tournament info types from the validators
export type TournamentInfo = Infer<typeof getTournamentInfoValidator>;

/**
 * Type for a new player entry to be created
 */
export type NewPlayerEntry = {
  name: string;
  spicerackPlayerId: number;
  spicerackTournamentId: number;
  registrationStatus?: string;
  deckId: number;
  decklistStatus?: Player["decklistStatus"];
  deckName: string;
  deckList: string;
};
