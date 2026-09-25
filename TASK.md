# Convex backend tasks

Remaining findings from the September 2026 review of `convex/`. Each task
says what to change, why it matters, and how to verify it. Already fixed
and not listed here: the unowned `templates.ts` module, feature-match and
standings-round ownership checks, presence scoping, and the per-player
lookups in the standings, pairings, player-list, and deck-card queries.

Verify every task with `npx tsc --noEmit -p convex/tsconfig.json` and
`npx vitest run`. Tasks are ordered by priority within each section.

## Important

### [DONE] 1. Clean up abandoned life-tracker presence rows

- **Where:** `convex/presence.ts` (`cleanUpLifeTrackers`,
  `getAllConnectedLifeTrackers`, `getConnectedLifeTrackers`), `convex/crons.ts`
- **Why:** Rows are only removed on an explicit disconnect. `cleanUpLifeTrackers`
  is never scheduled and does a full-table `collect`, and the tracker count
  uses `.collect().length`. Closed tabs whose unload handler did not fire
  accumulate forever.
- **Fix:** Either replace the table with the `@convex-dev/presence` component
  (heartbeats, multi-session aggregation, and timeout-to-offline are built in),
  or add an index on `lastSeen`, rewrite the cleanup as a batched delete that
  reschedules itself, and register it in `crons.ts`.
- **Done when:** A tracker row older than the timeout disappears without a
  client disconnect, and no presence function reads the whole table.

### [DONE] 2. Add `returns` validators to every public mutation

- **Where:** All mutations in `convex/_overlays/*.ts`; `setTournamentTimer`,
  `updateTournamentInfo`, `updateTournamentMode`, `updateTournamentSettings` in
  `convex/tournaments.ts`; `updateSettings` in `convex/settings.ts`;
  `updatePlayerInfo` in `convex/player.ts`; `setConnectedLifeTracker` and
  `disconnectLifeTracker` in `convex/presence.ts`.
- **Why:** The project guidelines require args and returns validators on every
  registered function. Without one, an accidental return value is sent to the
  client unvalidated and the generated types are `any`.
- **Fix:** Add `returns: v.null()` and make sure each handler returns `null`.
- **Done when:** `grep -rn "= mutation({" convex | wc -l` equals the number of
  mutations with a `returns:` line.

### [DONE] 3. Replace `v.any()` return validators in `tournaments.ts`

- **Where:** `convex/tournaments.ts` `getUserTournament`, `getTournamentInfo`
- **Why:** `v.union(v.any(), v.null())` gives the client no type and skips
  validation. `getTournamentInfoValidator` already exists in
  `convex/validators.ts` and is unused.
- **Fix:** Use `getTournamentInfoValidator` for `getTournamentInfo` and
  `tournamentValidator` (or `schema.doc("tournaments")`) for
  `getUserTournament`.
- **Done when:** No `v.any()` appears in a `returns:` position under `convex/`.

### [DONE] 4. Delete `createTournament` and `getTournament`

- **Where:** `convex/tournaments.ts:16` and `:44`
- **Why:** `createTournament` is an `internalMutation` that calls `requireAuth`;
  scheduled and `runMutation` calls carry no identity, so it can only succeed
  from the dashboard. `getTournament` is unused and its own comment says so.
  Neither is referenced by the app.
- **Fix:** Remove both exports.
- **Done when:** `grep -rn "createTournament\|api.tournaments.getTournament\b"`
  returns nothing outside `_generated`.

### [DONE] 5. Stop throwing from queries when the user is signed out or uninitialized

- **Where:** `convex/auth.ts` `getUserAvatar`, `getUserEmail`;
  `getOwnTournament` callers such as `getUserOverlays`, `getAllTournamentPlayers`,
  `getCurrentRoundPairings`, `getSettings`
- **Why:** `components/auth/nav-user.tsx` subscribes with `useQuery`. During
  sign-out or a token refresh the query reruns unauthenticated, throws, and
  reaches the React error boundary. Password sign-ups have no tournament until
  they verify (`convex/auth.ts:141` skips initialization), so every
  tournament-scoped query throws for them too.
- **Fix:** Return `null` or an empty result when there is no identity or no
  tournament, and let the client render the signed-out or "verify your email"
  state. Keep throwing for mutations.
- **Done when:** Loading the dashboard as a fresh unverified password user
  shows an empty state instead of an error.

### [DONE] 6. Use `crons.cron` instead of `crons.daily`

- **Where:** `convex/crons.ts:7`
- **Why:** The project guidelines allow only `crons.interval` and `crons.cron`.
- **Fix:** `crons.cron("cleanupOldIntegrationLogs", "0 0 * * *", internal.settings.cleanupOldIntegrationLogs, {})`.
- **Done when:** `npx convex dev --once` pushes and the dashboard shows the job.

### [DONE] 7. Document the shared-cache tenancy model

- **Where:** `convex/README.md` or `docs/`
- **Why:** `players`, `playerDecklists`, `playerStatuses`, `featureMatches`,
  `roundStandings`, and `externalTournaments` are keyed by Melee ids and shared
  by every account that links the same Melee tournament. Consequences that are
  easy to mistake for bugs: `updatePlayerInfo` by one user sets
  `decklistStatus: "manual"` and blocks syncs for every user;
  `setPairingFeatured(false)` clears other accounts' deck overlays; two accounts
  polling the same tournament run two loops writing the same rows.
- **Fix:** Write down the model, which writes are shared, and the
  `externalTournamentId` scope check that guards cross-tournament access. Decide
  whether manual player edits should become per-tournament overrides.
- **Done when:** The doc exists and links from the top-level README.

## Suggestions

### [DONE] 8. Stop exposing overlay functions at two paths

- **Where:** `convex/_overlays/` and the barrel `convex/overlays.ts`
- **Why:** Convex registers every module under `convex/`, so each overlay
  function is public as both `api.overlays.X` and `api._overlays.match.X`. The
  underscore implies privacy it does not provide, and `createStandingsOverlay`
  is reachable only at the underscore path because the barrel never re-exports
  it.
- **Fix:** Rename `_overlays/` to `overlays/`, delete `convex/overlays.ts`, and
  update the app's `api.overlays.X` references to `api.overlays.<module>.X`
  (including `internal.overlays.fetchAndUpdateRoundStandings` in
  `convex/lib/standings.ts`).
- **Done when:** `convex/_generated/api.d.ts` lists each overlay function once.

### [DONE] 9. Derive template allowlists from the validators

- **Where:** `convex/_overlays/shared.ts:6`
- **Why:** `MATCH_TEMPLATES` omits `LC26`, so `setOverlayTemplate` rejects a
  template that `setMatchOverlaySettings` accepts.
- **Fix:** Build the sets from `matchTemplatesValidator.members` and friends,
  or drop `setOverlayTemplate` in favor of the per-type settings mutations.

### 10. [DONE] Do not throw from the public overlay query on a dangling feature match

- **Where:** `convex/lib/overlays.ts` `enrichDeckOverlay`
- **Why:** A missing feature match or player row makes `getOverlayByUuid` throw,
  which breaks the OBS browser source until the user re-selects a match.
- **Fix:** Return `matchData: null` when the referenced rows are gone.

### [DONE] 11. Call a helper instead of `ctx.runAction` per player

- **Where:** `convex/deckCards.ts` `resolvePlayersDeckCards`, `backfillDeckCards`
- **Why:** Action-to-action calls in the same runtime add a scheduled
  invocation per player, several hundred per tournament, for no isolation
  benefit. The guidelines say to extract shared code into a function.
- **Fix:** Move the body of `resolvePlayerDeckCards` into a helper that takes
  `ActionCtx`, and call it inside the existing per-player try/catch.

### 12. Consolidate duplicated deck-list helpers

- **Where:** `getInitialDeckCardsStatus` and `isResolvableDeckList` in
  `convex/player.ts`, `convex/lib/players.ts`, `convex/deckCards.ts`;
  `scheduleDeckCardsResolution` in `convex/player.ts` and `convex/lib/players.ts`
- **Fix:** Keep one copy in `convex/lib/deckCards.ts` and import it.

### 13. Scope `getCompletedRounds` to the caller's tournament

- **Where:** `convex/tournamentSync.ts` `getCompletedRounds`
- **Why:** It takes `externalTournamentId` from the client with no auth, so
  anyone can list round names for any cached Melee tournament. Low sensitivity,
  but the argument is unnecessary.
- **Fix:** Drop the argument and read the id from `getOwnTournament`.

### 14. Point the HTTP overlay route at an internal query

- **Where:** `convex/http.ts:24`
- **Why:** The route calls `api.overlays.getOverlayByUuid`, so it depends on the
  public API surface and will break under task 8.
- **Fix:** Add an `internalQuery` wrapper around `enrichOverlay` by UUID and
  call it with `internal.*`.

### 15. Bound the whole-database deck-card backfill

- **Where:** `convex/deckCards.ts` `loadAllPlayersWithData`
- **Why:** With no tournament id, the backfill still collects the entire
  `players` table in one query and will hit the read limits as tournaments
  accumulate.
- **Fix:** Require `externalTournamentId`, or iterate `externalTournaments` and
  schedule one `backfillDeckCards` per tournament.

### 16. Unify the two match display-info mutations

- **Where:** `convex/_overlays/match.ts` `updateMatchOverlay` and
  `updateMatchOverlayDisplayInfo`
- **Why:** They accept overlapping fields with opposite semantics: one drops
  `undefined` fields, the other writes them to clear values. Easy to call the
  wrong one.
- **Fix:** Keep one mutation and use explicit `null` to clear, as
  `setTournamentTimer` already does for `manualTimerPausedAt`.
