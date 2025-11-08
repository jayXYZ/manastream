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
} from "./validators";
import { Doc } from "./_generated/dataModel";

export type Overlay = Doc<"overlays">;
export type Player = Doc<"players">;
export type Tournament = Doc<"tournaments">;
export type Settings = Doc<"settings">;

export type MatchOverlay = Infer<typeof matchOverlayValidator>;
export type CardOverlay = Infer<typeof cardOverlayValidator>;
export type DeckOverlay = Infer<typeof deckOverlayValidator>;
export type StandingsOverlay = Infer<typeof standingsOverlayValidator>;
export type CommentaryOverlay = Infer<typeof commentaryOverlayValidator>;

export type MatchOverlayWithPlayers = Infer<
  typeof matchOverlayWithPlayersValidator
>;
export type FeatureMatchWithPlayers = Infer<
  typeof featureMatchWithPlayersValidator
>;

export type OverlayType = Overlay["overlayType"];

// Template types from the validators
export type TemplateType = "Default" | "Duress Crew" | "Lobstercon" | "Custom";

// Tournament info types from the validators
export type TournamentInfo = Infer<typeof getTournamentInfoValidator>;
