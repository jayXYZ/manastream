# Top 8 Bracket Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a Braun Dark top 8 bracket in the standings overlay whenever the tournament is in a single-elimination phase.

**Architecture:** Keep Spicerack seed logic in `convex/models/spicerack.ts`, enrich standings overlay rows with `seed` plus an `isEliminationPhase` flag in Convex, and let `StandingsOverlay` choose between the existing standings table and a focused bracket component. The bracket component stays frontend-only and consumes the already-enriched standings rows.

**Tech Stack:** Next.js/React 19, Convex validators and query helpers, Vitest source/model tests, Braun Dark palette helpers.

---

### Task 1: Shared Seed Helper

**Files:**
- Modify: `convex/models/spicerack.ts`
- Modify: `convex/lib/__tests__/spicerack.test.ts`

- [ ] **Step 1: Write the failing tests**

Add `parsePlayerSeed` to the import and add these tests to `convex/lib/__tests__/spicerack.test.ts`:

```ts
import { parsePlayerSeed, parsePlayerTournamentRecord } from "../../models/spicerack";

describe("Spicerack seed parsing", () => {
  it("returns the final Swiss standing as a seed", () => {
    expect(
      parsePlayerSeed(buildPlayerStatus({ final_place_in_standings: 5 })),
    ).toBe(5);
  });

  it("ignores missing or invalid final Swiss standings", () => {
    expect(
      parsePlayerSeed(buildPlayerStatus({ final_place_in_standings: -1 })),
    ).toBeUndefined();
    expect(
      parsePlayerSeed(buildPlayerStatus({ final_place_in_standings: 0 })),
    ).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm vitest run convex/lib/__tests__/spicerack.test.ts`

Expected: FAIL because `parsePlayerSeed` is not exported.

- [ ] **Step 3: Implement the helper and reuse it**

In `convex/models/spicerack.ts`, add:

```ts
export function parsePlayerSeed(
  playerStatus: SpicerackUserEventStatus,
): number | undefined {
  const swissFinish = playerStatus.final_place_in_standings;
  if (typeof swissFinish === "number" && swissFinish > 0) {
    return swissFinish;
  }
  return undefined;
}
```

Then update `parsePlayerTournamentRecord` to call `parsePlayerSeed(playerStatus)` and return `#${seed}` during elimination.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm vitest run convex/lib/__tests__/spicerack.test.ts`

Expected: PASS.

### Task 2: Standings Enrichment Metadata

**Files:**
- Modify: `convex/validators.ts`
- Modify: `convex/lib/overlays.ts`
- Modify: `lib/__tests__/standings-overlay-palettes.test.ts`

- [ ] **Step 1: Write the failing source-level test**

Add a new `describe` block to `lib/__tests__/standings-overlay-palettes.test.ts`:

```ts
describe("Standings overlay elimination metadata", () => {
  it("exposes elimination phase state and seeds to the standings overlay", () => {
    expect(validatorsSource).toContain("isEliminationPhase: v.optional(v.boolean())");
    expect(validatorsSource).toContain("seed: v.optional(v.number())");
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm vitest run lib/__tests__/standings-overlay-palettes.test.ts`

Expected: FAIL because the validator fields do not exist.

- [ ] **Step 3: Add validator fields**

In `convex/validators.ts`, extend `standingsOverlayWithPlayersValidator`:

```ts
export const standingsOverlayWithPlayersValidator = v.object({
  ...standingsOverlayValidator.fields,
  roundDisplayName: v.optional(v.string()),
  isEliminationPhase: v.optional(v.boolean()),
  standingsDataWithPlayers: v.optional(
    v.array(
      v.object({
        ...playerInStandingsValidator.fields,
        seed: v.optional(v.number()),
        playerData: v.optional(playerWithDataValidator),
      }),
    ),
  ),
});
```

- [ ] **Step 4: Enrich standings rows with seeds and phase state**

In `convex/lib/overlays.ts`, add an `isEliminationPhase` calculation from the Spicerack tournament's current round label:

```ts
const eliminationRoundNames = new Set(["Quarterfinals", "Semifinals", "Finals"]);
const currentRoundName = spicerackTournament?.currentRoundName ?? "";
const isEliminationPhase = eliminationRoundNames.has(currentRoundName);
```

Inside the standings map, expose the standings row rank as `seed`. These standings rows represent the selected standings snapshot, which is the Swiss standings source used by the bracket overlay. The Spicerack API helper from Task 1 remains the shared source for live API player statuses used by match overlays.

```ts
return {
  ...standing,
  seed: standing.rank > 0 ? standing.rank : undefined,
  playerData: player ? await getPlayerData(ctx, player) : undefined,
};
```

Return `isEliminationPhase` with the enriched overlay.

- [ ] **Step 5: Run the focused test to verify it passes**

Run: `pnpm vitest run lib/__tests__/standings-overlay-palettes.test.ts`

Expected: PASS.

### Task 3: Bracket Component And Standings Switch

**Files:**
- Create: `app/overlay/components/top-8-bracket-overlay.tsx`
- Modify: `app/overlay/components/standings-overlay.tsx`
- Modify: `lib/__tests__/standings-overlay-palettes.test.ts`

- [ ] **Step 1: Write the failing source-level tests**

Add tests to `lib/__tests__/standings-overlay-palettes.test.ts` that read the new file and verify the switch:

```ts
const bracketOverlaySource = readFileSync(
  "app/overlay/components/top-8-bracket-overlay.tsx",
  "utf8",
);

describe("Top 8 bracket overlay", () => {
  it("uses the standard top 8 bracket seed order", () => {
    expect(bracketOverlaySource).toContain("[1, 8]");
    expect(bracketOverlaySource).toContain("[4, 5]");
    expect(bracketOverlaySource).toContain("[2, 7]");
    expect(bracketOverlaySource).toContain("[3, 6]");
  });

  it("uses the Braun Dark palette passed from standings", () => {
    expect(bracketOverlaySource).toContain("theme: BraunDarkPalette");
    expect(bracketOverlaySource).toContain("theme.surface");
    expect(bracketOverlaySource).toContain("theme.accent");
  });

  it("is rendered by standings overlays during elimination phases", () => {
    expect(standingsOverlaySource).toContain("Top8BracketOverlay");
    expect(standingsOverlaySource).toContain("data.isEliminationPhase");
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm vitest run lib/__tests__/standings-overlay-palettes.test.ts`

Expected: FAIL because the bracket component file and standings switch do not exist.

- [ ] **Step 3: Implement `Top8BracketOverlay`**

Create `app/overlay/components/top-8-bracket-overlay.tsx` with a 1920x1080 Braun Dark bracket layout. Export a `Top8BracketOverlay` component that accepts `eventName`, `roundName`, `commentators`, `standings`, and `theme`. Build player slots from `seed ?? rank`, sort by seed, and render pairings in the order `[[1, 8], [4, 5], [2, 7], [3, 6]]`.

- [ ] **Step 4: Wire the switch in `StandingsOverlay`**

In `app/overlay/components/standings-overlay.tsx`, import `Top8BracketOverlay`. After calculating `commentators`, `standings`, and `roundName`, add:

```tsx
if (data.isEliminationPhase) {
  return (
    <Top8BracketOverlay
      eventName={tournamentInfo?.eventName ?? ""}
      roundName={roundName}
      commentators={commentators}
      standings={standings}
      theme={theme}
    />
  );
}
```

Use a local `roundName` const so both the bracket and table use the same title fallback.

- [ ] **Step 5: Run the focused test to verify it passes**

Run: `pnpm vitest run lib/__tests__/standings-overlay-palettes.test.ts`

Expected: PASS.

### Task 4: Full Verification

**Files:**
- Verify all touched files.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
pnpm vitest run convex/lib/__tests__/spicerack.test.ts lib/__tests__/standings-overlay-palettes.test.ts lib/__tests__/standings-overlay-round-title.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the project test suite**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 3: Run lint**

Run: `pnpm lint`

Expected: PASS.

- [ ] **Step 4: Review the diff**

Run: `git diff --check`

Expected: no whitespace errors.
