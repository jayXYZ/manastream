# Pairings Page Design

## Goal

Add a read-only Pairings page that helps the stream runner choose a strong Magic: The Gathering feature match. The page captures all pairings for the current Spicerack round once, when the app first detects that round, then ranks those pairings by matchup uniqueness.

## Decisions

- Capture all pairings for the current round, not only Spicerack feature matches.
- Capture the round snapshot once when a new round appears. Do not refresh or rewrite the pairing list on every poll.
- Keep Spicerack as the source of truth for the official feature match. The Pairings page only recommends; users still return to Spicerack to flag a feature match.
- Rank by macro-archetype uniqueness, using the same macro grouping as the existing meta breakdown.

## Data Model

Add a dedicated `pairings` table rather than overloading `featureMatches`.

Each pairing row stores:

- `externalId`: stable id such as `pairing:${spicerackTournamentId}:${roundId}:${spicerackMatchId}`
- `spicerackTournamentId`
- `tournamentId`
- `spicerackRoundId`
- `roundNumber`
- `spicerackMatchId`
- `tableNumber`
- `status`
- `player1`
- `player2`
- `player1TournamentRecord`
- `player2TournamentRecord`
- `createdAt`

Indexes:

- `by_tournament_and_round`: `["tournamentId", "roundNumber"]`
- `by_spicerack_round`: `["spicerackRoundId"]`
- `by_external_id`: `["externalId"]`

## Capture Flow

The existing Spicerack polling loop already detects new rounds through `detectNewRound` and `handleNewSpicerackRound`. The new feature will extend that new-round path:

1. Parse the current round from the Spicerack event payload.
2. For each match in `currentRound.matches`, validate that it has exactly two player relationships.
3. Ensure both players exist in the local `players` table, creating pending player records when needed.
4. Insert one pairing row per match if the `externalId` does not already exist.
5. Leave existing feature-match polling unchanged.

This makes the snapshot idempotent if the same round detection path runs more than once, while still avoiding per-poll ranking data churn.

## Ranking

The Pairings query loads current-round pairing rows with player data, then computes rankings from the tournament player pool:

1. Build macro-archetype counts from all known tournament players.
2. Normalize each pairing player's deck name to its macro archetype.
3. Score known matchups as `player1MacroCount + player2MacroCount`.
4. Sort by known matchup first, then ascending uniqueness score, then table number, then player names.

Lower scores are better because they indicate fewer players in the event are playing those macro archetypes. Pairings with missing, pending, unknown, or failed deck data appear after fully known matchups.

## Page

Add `/dashboard/pairings` and a sidebar item.

The page shows:

- Current round name or round number.
- Captured pairing count.
- A read-only ranked table with rank, table, both players, both decks, records, macro matchup, uniqueness score, and match status.

Empty states:

- No linked Spicerack tournament.
- No current round detected.
- Current round detected but no pairings captured yet.

## Error Handling

- Pairings with malformed player relationships are skipped rather than blocking the full snapshot.
- Missing player deck data does not break the page; those rows rank after known-deck matchups.
- Duplicate snapshots are prevented by `externalId` checks.

## Tests

- Unit test macro normalization and uniqueness sorting.
- Test unknown or pending decks sorting after known matchups.
- Add Convex-level snapshot idempotency coverage if the current test harness makes it practical.
- Run relevant lint, typecheck, and unit tests before completion.
