# Convex backend: the shared-cache tenancy model

The backend has two kinds of tables. Some belong to one account. Others are
a cache of a Melee tournament, keyed by Melee ids, and are shared by every
account that links the same Melee tournament. Several behaviours that look
like bugs follow directly from that split, so this page writes the model
down. Read it before touching anything under `convex/` that reads or writes
`players`, `playerDecklists`, `playerStatuses`, `pairings`, `featureMatches`,
`roundStandings`, or `externalTournaments`.

Schema: `convex/schema.ts`. Validators: `convex/validators.ts`.

## The two kinds of tables

### Per-account tables

Each row carries a `userId` or a `tournamentId`, and every function that
touches one of these rows checks that the caller owns it
(`requireTournamentAccess`, `requireOverlayAccess` and friends in
`convex/lib/auth.ts`).

| Table                   | Owned through           | Holds                                                                                                                                                       |
| ----------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users` and auth tables | -                       | Convex Auth accounts.                                                                                                                                       |
| `settings`              | `userId`                | Melee credentials and per-user options.                                                                                                                     |
| `tournaments`           | `userId` (one per user) | The account's "coverage" row: mode, polling status, timer, commentators, current round display, and `externalTournamentId`, the link to a Melee tournament. |
| `pollingSessions`       | `tournamentId`          | Session and cycle tokens for the account's auto-sync loop.                                                                                                  |
| `overlays`              | `tournamentId`          | Match, deck, card, commentary, and standings overlays with their public UUIDs.                                                                              |
| `templates`             | `userId`                | Saved overlay templates.                                                                                                                                    |
| `connectedLifeTrackers` | `userId`                | Life-tracker presence.                                                                                                                                      |
| `integrationLogs`       | `userId`                | Polling and sync log lines.                                                                                                                                 |

`scryfallCardCache` is a global cache of card data, shared by everyone and
owned by no one.

### Shared cache tables

These tables mirror Melee data. Their natural key is a Melee id, not an
account, and there is exactly one row per Melee entity no matter how many
accounts link the tournament. An account never gets a private copy.

| Table                 | Natural key                                                                         | Written by                                                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `externalTournaments` | `externalTournamentId`                                                              | `createExternalTournamentHelper` on the first `validateAndStartPolling`; `handleNewRound` and `recordCompletedRounds` from any account's poll loop.                      |
| `players`             | `externalTournamentId` + `externalPlayerId`                                         | Player sync (`createPlayers`, `updatePlayerNames`, `updatePlayerDecklists`), pairing capture (`getOrCreatePairingPlayer`), deck-card resolution, and `updatePlayerInfo`. |
| `playerDecklists`     | `playerId` (also indexed by `externalTournamentId` + `externalPlayerId`)            | Same writers as `players`; decklist status, deck name, deck list.                                                                                                        |
| `playerStatuses`      | `playerId` (also indexed by `externalTournamentId` + `externalPlayerId`)            | `updatePlayerRegistrationStatuses` (drops).                                                                                                                              |
| `pairings`            | `externalId` = `pairing:{externalTournamentId}:{externalRoundId}:{externalMatchId}` | `snapshotCurrentRoundPairings` from the poll loop. See "Pairings belong to the account that captured them" below.                                                        |
| `featureMatches`      | `externalId` = `feature:{externalTournamentId}:{externalMatchId}`                   | `setPairingFeatured` (`createFeatureMatchFromPairing` / `removeFeatureMatchForPairing`).                                                                                 |
| `roundStandings`      | `externalRoundId`                                                                   | `getRoundStandingsHelper` creates the row when a standings overlay first selects the round; `fetchAndUpdateRoundStandings` fills it.                                     |

`pairings` and `featureMatches` also carry a `tournamentId`. That is the
account whose action created the row, not an owner in the per-account sense:
the row is still found and read through its Melee id by every account that
links the tournament.

`players` rows created before the player-data split may have no
`externalTournamentId`. Loaders such as `getPlayerDataById` fall back to a
direct `ctx.db.get` for those.

## How an account is scoped to the cache

The only thing that scopes an account to shared data is
`tournaments.externalTournamentId` on the caller's own tournament row. Every
public function that reads or writes the cache derives the Melee tournament
id from there, never from the client:

- `getOwnTournament` / `getOptionalOwnTournament` / `getOwnExternalTournament`
  in `convex/lib/tournaments.ts` resolve the caller's tournament and its
  linked Melee tournament. Queries use the optional variants and return an
  empty result when the caller is signed out, uninitialized, or unlinked;
  mutations use `getOwnTournament` and throw.
- Player reads and writes go through the
  `by_external_tournament_id` or
  `by_external_tournament_id_and_external_player_id` index with that id
  (`loadTournamentPlayerData`, `updatePlayerInfo`,
  `getTournamentPlayersForSync`). A player from another Melee tournament is
  simply not found.
- `requireFeatureMatchForTournament` in `convex/lib/auth.ts` lets an overlay
  reference a feature match when it was created for the caller's tournament
  or when its `externalTournamentId` equals the caller's linked tournament.
  Any other feature match id is "not found or access denied".
- `requireRoundForTournament` in `convex/lib/auth.ts` accepts a Melee round
  id only when it is the linked tournament's current round or one of its
  completed rounds, so a standings overlay cannot point at, or trigger a
  fetch for, another tournament's round.
- `setPairingFeatured` checks `requireTournamentAccess(pairing.tournamentId)`,
  so only the account that captured the pairing row can feature or unfeature
  it.

Known exceptions, all read-only:

- `getFeatureMatchPlayersAndDecks` and `getOverlayByUuid` are deliberately
  unauthenticated because OBS browser sources load them.

## Consequences of sharing

These are the behaviours that are easy to mistake for bugs. They are all by
design under the current model.

### A manual player edit blocks syncs for every account

`updatePlayerInfo` patches the shared `players` and `playerDecklists` rows
and sets `decklistStatus: "manual"`. The sync planner (`planPlayerSync` and
`shouldApplyDecklistUpdate` in `convex/lib/playerSync.ts`) skips any player
whose status is `"manual"` in both `fill_missing` and `full` mode, and
`updatePlayerNames` skips them too. So once any account edits a player by
hand, no account's poll loop or "Refresh players" will overwrite that
player's name, deck name, or decklist again. There is no per-account view of
the player: every linked account sees the edited values.

### Unfeaturing a match clears other accounts' deck overlays

`removeFeatureMatchForPairing` deletes the shared `featureMatches` row and,
in the same transaction, clears `matchId` on every deck overlay that
references it, across all tournaments. If accounts A and B both point a deck
overlay at the same feature match and A unfeatures it, B's deck overlay goes
blank (`getOverlayByUuid` returns `matchData: null` rather than throwing).
`convex/__tests__/featurematch-removal.test.ts` pins this behaviour.

Only the account whose pairing row it is can unfeature it (see below); an
attempt by another account fails with "Tournament not found or access
denied" and leaves everyone's overlays intact.

### Pairings belong to the account that captured them

`snapshotCurrentRoundPairings` builds the pairing `externalId` from Melee ids
only and skips a match whose row already exists. So the first poll loop to
see a round writes its rows with that account's `tournamentId`; a later loop
for the same tournament finds them and writes nothing. Because
`getCurrentRoundPairingsWithPlayerData` filters pairings by the caller's
`tournamentId`, and `setPairingFeatured` requires access to
`pairing.tournamentId`, a second account polling the same tournament:

- sees no pairings for that round on `/dashboard/pairings`, and
- cannot feature or unfeature those matches.

It does still see the resulting feature matches (`getAllFeatureMatches` and
`getCurrentRoundFeatureMatches` read by `externalTournamentId`) and can point
its own match and deck overlays at them.

### Two accounts polling the same tournament run two loops

Polling sessions are per account (`pollingSessions.tournamentId`, claimed by
`claimPollingSession` from the caller's own tournament). Nothing deduplicates
loops by Melee tournament, so two accounts in auto mode each fetch from Melee
with their own credentials and both write the shared rows:

- `externalTournaments.currentRound*` and `completedRounds` are patched by
  whichever loop notices a change first (`checkForNewRound`). The second
  loop sees no change and only tries to capture pairings, which already
  exist.
- Player sync runs from both loops. The mutations re-check the row as it is
  now before writing (`shouldApplyDecklistUpdate`, `isOlderDecklistVersion`,
  the `existing` check in `createPlayers`), so an overlapping sync converges
  rather than flip-flopping, but both accounts spend Melee requests on it.
- Only the loop that detects the round change resets its own account's match
  overlays to `DEFAULT_MATCH` and patches its own `tournaments.currentRound`
  and `currentRoundDisplayName`. Nothing writes those fields on the other
  account's row, and the dashboard (`getUserTournament`) and the timer and
  round overlays (`getTournamentInfo`,
  `getTournamentTimerAndRoundInfo`) read them from the caller's own
  `tournaments` row, not from `externalTournaments`. So the account that
  lost the race keeps showing the previous round (or nothing, if it linked
  after the round started) until its own loop wins a later round change, and
  its match overlays are not reset. Pairings and feature-match queries are
  unaffected because they resolve the round through `externalTournaments`.

### Standings are fetched once per round with one account's credentials

`roundStandings` is keyed by `externalRoundId` alone. The first standings
overlay to select a round creates the row and schedules
`fetchAndUpdateRoundStandings` with that account's `tournamentId`, so that
account's Melee credentials do the fetch. Every other account's standings
overlay for the same round reads the same row. A failed fetch (`"ERROR"`) is
retried the next time any account selects the round.

### Linking a Melee tournament joins the existing cache

`updateTournamentSettings` only writes `externalTournamentId` on the caller's
tournament row. If another account already linked that Melee tournament, the
players, decklists, feature matches, and standings are already there and the
new account sees them immediately, including any manual edits. Changing the
id resets the account's own polling state and current round, and nothing
else: the cache for the previous tournament stays for whoever else links it.

## Decision: manual player edits stay shared

The question the review raised was whether `updatePlayerInfo` should become a
per-tournament override (a private layer on top of the Melee data) instead of
a write to the shared row.

Decision: keep manual edits shared for now.

- The model assumes one coverage team per Melee event, possibly signed in
  with more than one account (a producer plus a commentator seat). For that
  use, one corrected deck name or decklist visible to every seat is the
  desired outcome, and a private override would make seats disagree.
- An override layer would need its own table keyed by
  `tournamentId` + `externalPlayerId`, a merge step in `composePlayerData`
  and `loadTournamentPlayerData`, and a rule for whether sync should keep
  updating the underlying row while an override exists. That is a real
  feature, not a fix, and nothing in the product asks for it yet.
- If two independent productions ever cover one Melee event, revisit this
  page first. The pieces to change are `updatePlayerInfo` and the
  `"manual"` guard in `convex/lib/playerSync.ts`; the rest of the model
  (feature matches, standings, polling) would need the same decision.

Until then, treat a hand edit as an edit for everyone covering the event.
