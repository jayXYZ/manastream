/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as _overlays_card from "../_overlays/card.js";
import type * as _overlays_commentary from "../_overlays/commentary.js";
import type * as _overlays_deck from "../_overlays/deck.js";
import type * as _overlays_match from "../_overlays/match.js";
import type * as _overlays_queries from "../_overlays/queries.js";
import type * as _overlays_shared from "../_overlays/shared.js";
import type * as _overlays_standings from "../_overlays/standings.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as featurematches from "../featurematches.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_featurematches from "../lib/featurematches.js";
import type * as lib_logging from "../lib/logging.js";
import type * as lib_overlays from "../lib/overlays.js";
import type * as lib_pairingRankings from "../lib/pairingRankings.js";
import type * as lib_pairings from "../lib/pairings.js";
import type * as lib_players from "../lib/players.js";
import type * as lib_settings from "../lib/settings.js";
import type * as lib_spicerack_api from "../lib/spicerack/api.js";
import type * as lib_spicerack_deckClassification from "../lib/spicerack/deckClassification.js";
import type * as lib_spicerack_pollingBehavior from "../lib/spicerack/pollingBehavior.js";
import type * as lib_spicerack_rounds from "../lib/spicerack/rounds.js";
import type * as lib_spicerack_standings from "../lib/spicerack/standings.js";
import type * as lib_spicerack_tournament from "../lib/spicerack/tournament.js";
import type * as lib_tournaments from "../lib/tournaments.js";
import type * as lib_utils from "../lib/utils.js";
import type * as lib_validation from "../lib/validation.js";
import type * as models_spicerack from "../models/spicerack.js";
import type * as overlays from "../overlays.js";
import type * as pairings from "../pairings.js";
import type * as player from "../player.js";
import type * as presence from "../presence.js";
import type * as settings from "../settings.js";
import type * as spicerack from "../spicerack.js";
import type * as templates from "../templates.js";
import type * as tournaments from "../tournaments.js";
import type * as types_spicerack from "../types/spicerack.js";
import type * as types from "../types.js";
import type * as validators from "../validators.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "_overlays/card": typeof _overlays_card;
  "_overlays/commentary": typeof _overlays_commentary;
  "_overlays/deck": typeof _overlays_deck;
  "_overlays/match": typeof _overlays_match;
  "_overlays/queries": typeof _overlays_queries;
  "_overlays/shared": typeof _overlays_shared;
  "_overlays/standings": typeof _overlays_standings;
  auth: typeof auth;
  crons: typeof crons;
  featurematches: typeof featurematches;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/constants": typeof lib_constants;
  "lib/featurematches": typeof lib_featurematches;
  "lib/logging": typeof lib_logging;
  "lib/overlays": typeof lib_overlays;
  "lib/pairingRankings": typeof lib_pairingRankings;
  "lib/pairings": typeof lib_pairings;
  "lib/players": typeof lib_players;
  "lib/settings": typeof lib_settings;
  "lib/spicerack/api": typeof lib_spicerack_api;
  "lib/spicerack/deckClassification": typeof lib_spicerack_deckClassification;
  "lib/spicerack/pollingBehavior": typeof lib_spicerack_pollingBehavior;
  "lib/spicerack/rounds": typeof lib_spicerack_rounds;
  "lib/spicerack/standings": typeof lib_spicerack_standings;
  "lib/spicerack/tournament": typeof lib_spicerack_tournament;
  "lib/tournaments": typeof lib_tournaments;
  "lib/utils": typeof lib_utils;
  "lib/validation": typeof lib_validation;
  "models/spicerack": typeof models_spicerack;
  overlays: typeof overlays;
  pairings: typeof pairings;
  player: typeof player;
  presence: typeof presence;
  settings: typeof settings;
  spicerack: typeof spicerack;
  templates: typeof templates;
  tournaments: typeof tournaments;
  "types/spicerack": typeof types_spicerack;
  types: typeof types;
  validators: typeof validators;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
