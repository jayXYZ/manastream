import { Infer } from "convex/values";
import {
  cardOverlayValidator,
  commentaryOverlayValidator,
  deckOverlayValidator,
  featureMatchWithPlayersValidator,
  getTournamentInfoValidator,
  matchOverlayValidator,
  matchOverlayWithPlayersValidator,
  standingsOverlayValidator,
  standingsOverlayWithPlayersValidator,
} from "./validators";
import { Doc } from "./_generated/dataModel";

export type Overlay = Doc<"overlays">;
export type Player = Doc<"players">;
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
export type TemplateType = "Default" | "Duress Crew" | "Lobstercon" | "Custom" | "Arcade" | "VHS" | "Braun" | "Braun Dark" | "Braun Dark Duo" | "Topographic" | "Brutalist";
export type CardTemplateName = "Default" | "Braun Dark";
export type DeckTemplateName = "Duress Crew" | "Braun Dark";

// Tournament info types from the validators
export type TournamentInfo = Infer<typeof getTournamentInfoValidator>;

/**
 * Type for a new player entry to be created
 */
export type NewPlayerEntry = Pick<
  Player,
  | "name"
  | "spicerackPlayerId"
  | "deckId"
  | "deckName"
  | "deckList"
  | "spicerackTournamentId"
>;
