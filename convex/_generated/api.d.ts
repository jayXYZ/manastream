/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as deckCards from "../deckCards.js";
import type * as featurematches from "../featurematches.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_deckCards from "../lib/deckCards.js";
import type * as lib_deckClassification_deckClassification from "../lib/deckClassification/deckClassification.js";
import type * as lib_externalTournament from "../lib/externalTournament.js";
import type * as lib_featurematches from "../lib/featurematches.js";
import type * as lib_logging from "../lib/logging.js";
import type * as lib_melee___tests___fixtures from "../lib/melee/__tests__/fixtures.js";
import type * as lib_melee_api from "../lib/melee/api.js";
import type * as lib_melee_decklist from "../lib/melee/decklist.js";
import type * as lib_overlays from "../lib/overlays.js";
import type * as lib_pairingRankings from "../lib/pairingRankings.js";
import type * as lib_pairings from "../lib/pairings.js";
import type * as lib_playerData from "../lib/playerData.js";
import type * as lib_playerRefresh from "../lib/playerRefresh.js";
import type * as lib_playerSync from "../lib/playerSync.js";
import type * as lib_players from "../lib/players.js";
import type * as lib_pollingBehavior from "../lib/pollingBehavior.js";
import type * as lib_pollingSession from "../lib/pollingSession.js";
import type * as lib_presence from "../lib/presence.js";
import type * as lib_rounds from "../lib/rounds.js";
import type * as lib_settings from "../lib/settings.js";
import type * as lib_standings from "../lib/standings.js";
import type * as lib_tournaments from "../lib/tournaments.js";
import type * as lib_utils from "../lib/utils.js";
import type * as lib_validation from "../lib/validation.js";
import type * as maintenance from "../maintenance.js";
import type * as migrations from "../migrations.js";
import type * as models_melee from "../models/melee.js";
import type * as overlays_card from "../overlays/card.js";
import type * as overlays_commentary from "../overlays/commentary.js";
import type * as overlays_deck from "../overlays/deck.js";
import type * as overlays_match from "../overlays/match.js";
import type * as overlays_queries from "../overlays/queries.js";
import type * as overlays_shared from "../overlays/shared.js";
import type * as overlays_standings from "../overlays/standings.js";
import type * as pairings from "../pairings.js";
import type * as player from "../player.js";
import type * as presence from "../presence.js";
import type * as settings from "../settings.js";
import type * as tournamentSync from "../tournamentSync.js";
import type * as tournaments from "../tournaments.js";
import type * as types from "../types.js";
import type * as types_melee from "../types/melee.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  crons: typeof crons;
  deckCards: typeof deckCards;
  featurematches: typeof featurematches;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/constants": typeof lib_constants;
  "lib/deckCards": typeof lib_deckCards;
  "lib/deckClassification/deckClassification": typeof lib_deckClassification_deckClassification;
  "lib/externalTournament": typeof lib_externalTournament;
  "lib/featurematches": typeof lib_featurematches;
  "lib/logging": typeof lib_logging;
  "lib/melee/__tests__/fixtures": typeof lib_melee___tests___fixtures;
  "lib/melee/api": typeof lib_melee_api;
  "lib/melee/decklist": typeof lib_melee_decklist;
  "lib/overlays": typeof lib_overlays;
  "lib/pairingRankings": typeof lib_pairingRankings;
  "lib/pairings": typeof lib_pairings;
  "lib/playerData": typeof lib_playerData;
  "lib/playerRefresh": typeof lib_playerRefresh;
  "lib/playerSync": typeof lib_playerSync;
  "lib/players": typeof lib_players;
  "lib/pollingBehavior": typeof lib_pollingBehavior;
  "lib/pollingSession": typeof lib_pollingSession;
  "lib/presence": typeof lib_presence;
  "lib/rounds": typeof lib_rounds;
  "lib/settings": typeof lib_settings;
  "lib/standings": typeof lib_standings;
  "lib/tournaments": typeof lib_tournaments;
  "lib/utils": typeof lib_utils;
  "lib/validation": typeof lib_validation;
  maintenance: typeof maintenance;
  migrations: typeof migrations;
  "models/melee": typeof models_melee;
  "overlays/card": typeof overlays_card;
  "overlays/commentary": typeof overlays_commentary;
  "overlays/deck": typeof overlays_deck;
  "overlays/match": typeof overlays_match;
  "overlays/queries": typeof overlays_queries;
  "overlays/shared": typeof overlays_shared;
  "overlays/standings": typeof overlays_standings;
  pairings: typeof pairings;
  player: typeof player;
  presence: typeof presence;
  settings: typeof settings;
  tournamentSync: typeof tournamentSync;
  tournaments: typeof tournaments;
  types: typeof types;
  "types/melee": typeof types_melee;
  validators: typeof validators;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};
