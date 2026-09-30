# ManaStream

ManaStream is a web app for running TCG stream overlays. It combines a
Next.js frontend with a Convex backend so stream operators can manage feature
matches, player data, decklists, timers, pairings, standings, and public
overlay URLs from one dashboard.

The app is currently focused on Magic: The Gathering event coverage, with
Spicerack tournament sync, Scryfall card imagery, OBS-friendly overlay pages,
and lifetracker/controller workflows for live matches.

## Features

- **Dashboard controllers** for updating match overlays, tournament previews,
  selected deck overlays, and standings views during coverage.
- **Overlay management** for match, commentary, deck, card, and standings
  overlays, including reusable public URLs for browser sources.
- **Lifetracker** for selecting a current feature match and pushing life total
  updates into match overlays.
- **Timer controls** for stream-facing countdown or count-up timers.
- **Player and decklist tools** for editing tournament player data, deck names,
  decklists, and meta breakdown exports.
- **Feature match recommendations** for Spicerack round pairings, including
  matchup ranking by archetype uniqueness.
- **Standings and top 8 overlays** for Swiss standings and elimination bracket
  presentation.
- **Spicerack integration** for tournament metadata, rounds, feature matches,
  player records, standings, and decklists.
- **Scryfall integration** for card search and card imagery in controller and
  player workflows.
- **Decklist PDF tooling** for generating DCI decklist PDFs from exported
  Convex player data.

## Tech Stack

- [Next.js](https://nextjs.org/) 16 and [React](https://react.dev/) 19
- [Convex](https://convex.dev/) for backend functions, database, cron jobs, and
  real-time client data
- [Convex Auth](https://labs.convex.dev/auth) with Google, password auth, and
  Resend-backed email flows
- [Tailwind CSS](https://tailwindcss.com/) 4
- [Radix UI](https://www.radix-ui.com/) primitives and local UI components
- [Vitest](https://vitest.dev/) for tests
- [Playwright](https://playwright.dev/) as browser automation tooling
- [Resend](https://resend.com/) for email verification and password reset mail
- [Scryfall SDK](https://github.com/NandaScott/Scryfall-SDK) and Scryfall image
  URLs for card data

## Local Setup

Install dependencies:

```bash
npm install
```

Create or connect a Convex deployment:

```bash
npx convex dev
```

Add the required environment variables to `.env.local`:

```bash
NEXT_PUBLIC_CONVEX_URL=
CONVEX_DEPLOYMENT=
CONVEX_SITE_URL=
AUTH_RESEND_KEY=
```

Optional local behavior:

```bash
SPICERACK_ALLOW_COMPLETED_POLLING=
```

Start the frontend and Convex backend together:

```bash
npm run dev
```

The Next.js app runs on the local port selected by `next dev`, usually
`http://localhost:3000`. Convex runs alongside it through `convex dev`.

## Environment Variables

| Variable | Required | Used by | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | Yes | Next.js client | Public Convex deployment URL used by `ConvexReactClient`. |
| `CONVEX_DEPLOYMENT` | Yes | Convex CLI | Deployment identifier created and managed by Convex. |
| `CONVEX_SITE_URL` | Yes | Convex auth config | Issuer URL used by Convex Auth JWT validation. |
| `AUTH_RESEND_KEY` | Yes | Convex auth | Resend API key for verification and password reset emails. |
| `SPICERACK_ALLOW_COMPLETED_POLLING` | No | Spicerack polling | Enables continued polling for completed tournaments when configured. |

User-specific Spicerack credentials are entered in the app under
`/dashboard/settings`, not stored in `.env.local`.

## Development Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Runs Next.js and Convex in parallel. |
| `npm run dev:frontend` | Runs only the Next.js dev server. |
| `npm run dev:backend` | Runs only `convex dev`. |
| `npm run build` | Builds the Next.js app. |
| `npm run start` | Starts the production Next.js server after a build. |
| `npm run lint` | Runs ESLint across the repository. |
| `npm run test` | Runs the Vitest suite. |
| `npm run decklists:pdf` | Generates decklist PDFs with `scripts/generate-decklist-pdfs.mjs`. |

## Project Map

- `app/` contains Next.js routes, layouts, dashboards, overlay pages, login
  flows, lifetracker screens, and popout controllers.
- `components/` contains shared React components, auth UI, and the local UI
  primitives used throughout the app.
- `convex/` contains schema definitions, auth setup, public and internal
  Convex functions, Spicerack polling, overlay data access, migrations, crons,
  and backend tests. [`convex/README.md`](convex/README.md) documents the
  shared-cache tenancy model: which tables are per-account, which are shared
  by every account that links the same Melee tournament, and what follows
  from that.
- `lib/` contains frontend and shared helpers for time, overlay templates,
  palette data, pairings, meta breakdowns, and related tests.
- `scripts/` contains command-line tooling for decklist PDF generation.
- `public/` contains fonts, PWA files, logos, card/overlay imagery, and static
  assets served by the app.
- `docs/superpowers/` contains design specs and implementation plans produced
  during larger feature work.

## Main App Surfaces

- `/` is the landing page and authenticated entry point.
- `/login` and nested login routes handle sign-in, email verification, and
  password reset flows.
- `/dashboard/controllers` is the primary live-control surface for stream
  operators.
- `/dashboard/overlays` manages overlay URLs and settings.
- `/dashboard/timer` controls stream timer state.
- `/dashboard/players` manages player, decklist, and meta breakdown data.
- `/dashboard/pairings` shows Spicerack pairings recommendations.
- `/dashboard/settings` stores Spicerack settings and shows polling logs.
- `/lifetracker` provides the match lifetracker workflow.
- `/overlay/[public_id]` renders public browser-source overlays.
- `/popout/card-controller` opens a separate card controller window.

## Development Workflow

1. Pull the latest `main` and create a focused branch or worktree.
2. Read the relevant files before editing. For Convex changes, read
   `convex/_generated/ai/guidelines.md` first.
3. Keep changes scoped to the workflow being touched.
4. Add or update focused tests when behavior changes.
5. Run the smallest useful verification first, then run broader checks before
   handing off work.
6. Do not commit secrets, local `.env*` files, generated build output, or local
   worktree directories.

Recommended verification before opening a PR:

```bash
npm run lint
npm run test
npm run build
```

For docs-only changes, at minimum review the Markdown diff and confirm any
documented commands, routes, and environment variables still match the code.

## Useful Links

- [ManaStream docs](https://docs.manastream.app/docs)
- [Convex documentation](https://docs.convex.dev/)
- [Next.js documentation](https://nextjs.org/docs)
- [Scryfall API documentation](https://scryfall.com/docs/api)
