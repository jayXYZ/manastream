# Commit Review Guide

Use this guide to review each commit group systematically. Each section contains:

- Files to review
- Git commands to view changes
- Suggested review questions

---

## Commit 1: Refactor overlays module into modular structure

**Files:**

- `convex/overlays.ts` (refactored)
- `convex/_overlays/card.ts` (new)
- `convex/_overlays/commentary.ts` (new)
- `convex/_overlays/match.ts` (new)
- `convex/_overlays/queries.ts` (new)
- `convex/_overlays/shared.ts` (new)
- `convex/_overlays_old.ts` (new, backup)
- `convex/_generated/api.d.ts` (auto-generated)

**View changes:**

```bash
git diff HEAD -- convex/overlays.ts convex/_overlays/ convex/_overlays_old.ts
```

**Review questions:**

- Are all overlay operations properly exported?
- Is the modular structure clearer than the monolithic file?
- Are there any missing exports or broken imports?

---

## Commit 2: Enhance Spicerack integration with improved error handling and logging

**Files:**

- `convex/spicerack.ts` (major changes)
- `convex/featurematches.ts` (improvements)
- `convex/lib/spicerack.ts` (new)
- `convex/lib/logging.ts` (new)
- `convex/lib/players.ts` (new)
- `convex/types/spicerack.ts` (new)
- `convex/models/spicerack.ts` (new)

**View changes:**

```bash
git diff HEAD -- convex/spicerack.ts convex/featurematches.ts convex/lib/spicerack.ts convex/lib/logging.ts convex/lib/players.ts convex/types/spicerack.ts convex/models/spicerack.ts
```

**Review questions:**

- Is error handling comprehensive?
- Are logging messages helpful for debugging?
- Are API calls properly structured?
- Are types correctly defined?

---

## Commit 3: Add user settings feature with Spicerack configuration

**Files:**

- `convex/settings.ts` (new)
- `app/dashboard/settings/page.tsx` (major enhancement)
- `convex/schema.ts` (settings table)
- `convex/validators.ts` (settingsValidator, spicerackLogValidator)
- `convex/auth.ts` (initialize settings)

**View changes:**

```bash
git diff HEAD -- convex/settings.ts app/dashboard/settings/page.tsx convex/schema.ts convex/validators.ts convex/auth.ts
```

**Review questions:**

- Is the settings UI intuitive?
- Are settings properly validated?
- Is initialization logic correct?
- Are there any security concerns with API key storage?

---

## Commit 4: Update database schema and validators for Spicerack fields

**Files:**

- `convex/schema.ts` (index updates, new tables)
- `convex/validators.ts` (tournament, featureMatch, player updates)
- `convex/tournaments.ts` (use new schema fields)

**View changes:**

```bash
git diff HEAD -- convex/schema.ts convex/validators.ts convex/tournaments.ts
```

**Review questions:**

- Are all required indexes present?
- Are validators comprehensive?
- Are field renames handled correctly?
- Are there any breaking changes?

---

## Commit 5: Improve dashboard UI components and styling

**Files:**

- `app/globals.css` (major styling updates)
- `app/dashboard/layout.tsx`
- `app/dashboard/page.tsx`
- `app/dashboard/overlays/page.tsx`
- `app/dashboard/overlays/components/overlay-preview.tsx` (new)
- `app/dashboard/overlays/components/overlays-table.tsx` (new)
- `app/dashboard/overlays/components/match-settings.tsx`
- `app/dashboard/controllers/page.tsx`
- `app/dashboard/timer/page.tsx`
- `components/ui/card.tsx`

**View changes:**

```bash
git diff HEAD -- app/globals.css app/dashboard/ components/ui/card.tsx
```

**Review questions:**

- Are styling changes consistent?
- Is the UI responsive?
- Are new components properly integrated?
- Are there any accessibility issues?

---

## Commit 6: Update controller components for new API structure

**Files:**

- `components/controllers/card-controller.tsx`
- `components/controllers/match-controller.tsx`
- `components/controllers/tournament-controller.tsx`
- `components/controllers/match-preview-controller.tsx` (new)
- `components/controllers/tournament-preview-controller.tsx` (new)
- `components/controllers/right-sidebar.tsx` (new)

**View changes:**

```bash
git diff HEAD -- components/controllers/
```

**Review questions:**

- Are API calls updated correctly?
- Is the component structure logical?
- Are props properly typed?
- Are there any UI bugs?

---

## Commit 7: Add new UI components and utilities

**Files:**

- `components/ui/sonner.tsx` (new)
- `components/ui/spinner.tsx` (new)
- `components/copy-button.tsx` (new)

**View changes:**

```bash
git diff HEAD -- components/ui/sonner.tsx components/ui/spinner.tsx components/copy-button.tsx
```

**Review questions:**

- Are components reusable?
- Is styling consistent?
- Are components properly exported?

---

## Commit 8: Update overlay display components

**Files:**

- `app/overlay/[public_id]/page.tsx`
- `app/overlay/components/match/match-overlay.tsx`
- `app/overlay/components/match/match-duresscrew-overlay.tsx`
- `app/overlay/components/match/match-lobstercon-overlay.tsx`
- `app/overlay/components/match/match-default-overlay.tsx` (new)
- `app/overlay/components/deck/` (new directory)

**View changes:**

```bash
git diff HEAD -- app/overlay/
```

**Review questions:**

- Are overlays rendering correctly?
- Are template variations working?
- Are there any performance issues?

---

## Commit 9: Update authentication routes and middleware

**Files:**

- `middleware.ts` (route path updates)
- `app/login/verify-email/page.tsx`
- `app/lifetracker/page.tsx`
- `app/page.tsx`
- `app/layout.tsx`

**View changes:**

```bash
git diff HEAD -- middleware.ts app/login/verify-email/page.tsx app/lifetracker/page.tsx app/page.tsx app/layout.tsx
```

**Review questions:**

- Are route changes correct?
- Is authentication flow working?
- Are protected routes properly secured?

---

## Commit 10: Add new dependencies and update package files

**Files:**

- `package.json` (add: sonner, convex-helpers, @oslojs/crypto)
- `pnpm-lock.yaml` (lockfile updates)

**View changes:**

```bash
git diff HEAD -- package.json pnpm-lock.yaml
```

**Review questions:**

- Are all dependencies necessary?
- Are versions compatible?
- Are there any security concerns?

---

## Commit 11: Update README and documentation

**Files:**

- `README.md`

**View changes:**

```bash
git diff HEAD -- README.md
```

**Review questions:**

- Is documentation accurate?
- Are instructions clear?
- Are examples up to date?

---

## Commit 12: Add supporting library modules

**Files:**

- `convex/lib/auth.ts` (new)
- `convex/lib/tournaments.ts` (new)
- `convex/lib/validation.ts` (new)
- `convex/crons.ts` (new)
- `convex/player.ts` (new)

**View changes:**

```bash
git diff HEAD -- convex/lib/auth.ts convex/lib/tournaments.ts convex/lib/validation.ts convex/crons.ts convex/player.ts
```

**Review questions:**

- Are utilities properly abstracted?
- Is code reusable?
- Are there any circular dependencies?

---

## Review Workflow

1. **Start a new Cursor conversation** for each commit group
2. **Copy the file list** from the relevant section above
3. **Ask the agent to review** those specific files:

   ```
   Please review the following files for commit group X:
   [paste file list]

   Focus on:
   - Code quality and correctness
   - Potential bugs or issues
   - Consistency with codebase patterns
   - Any breaking changes
   ```

4. **Use the git diff command** to see actual changes if needed
5. **Move to the next commit group** in a new conversation

This approach keeps context manageable and allows focused review of each logical group.
