# Top 8 Bracket Standings Overlay Design

## Goal

Add a Braun Dark top 8 bracket overlay for standings overlays. When a tournament is in a single-elimination phase, the public standings overlay should show a bracket view instead of the Swiss standings table.

## Existing Context

The standings overlay already renders with the shared Braun Dark palette and receives enriched standings rows with player deck data. Spicerack player statuses include `final_place_in_standings`, and `parsePlayerTournamentRecord` already uses that field as the displayed seed during `SINGLE_ELIMINATION` and `RANKED_SINGLE_ELIMINATION` rounds.

## Design

Add an explicit helper in the Spicerack model layer for player seed extraction. The helper should return the positive numeric `final_place_in_standings` value, or `undefined` when Spicerack has not provided a valid Swiss finish. Existing match overlay record formatting should use this helper so the seed source remains shared.

Extend standings overlay enrichment to include enough phase context for the frontend to know whether the selected/current standings data belongs to a single-elimination tournament phase. The frontend should render normal standings for Swiss phases and the bracket component for elimination phases.

Create a Braun Dark bracket component under the standings overlay components. It should render a fixed top 8 bracket at 1920x1080 using the existing Braun Dark palette values. Each player entry displays:

- Seed number
- Player name
- Deck name

Bracket entries should sort by seed and use a standard top 8 pairing order: 1 vs 8, 4 vs 5, 2 vs 7, and 3 vs 6. Missing players should render as quiet placeholders so the overlay remains stable while data is incomplete.

## Data Flow

1. Spicerack sync stores round standings as it does today.
2. Standings overlay enrichment reads the selected round standings and player/deck data.
3. Enrichment annotates each standings row with a seed derived from the player status source when available.
4. Enrichment also returns whether the active/current Spicerack phase is single elimination.
5. The standings overlay chooses between the existing standings table and the new bracket component based on that elimination flag.

## Fallbacks

If explicit seed data is unavailable for a row, the bracket component may fall back to the row's `rank`. If deck data is missing, display an em dash, matching the current standings overlay behavior. If fewer than eight players are present, preserve the bracket layout and show placeholders.

## Testing

Add focused tests for the seed helper and for the standings overlay switching behavior. Keep existing layout tests green, and add source-level or component-level checks that the bracket uses the Braun Dark palette and the standard top 8 pairing order.
