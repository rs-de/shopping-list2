# Claude Code Guide — shopping-list2

## Diary Workflow

This project follows the discuss-then-commit diary loop and `diary.md` conventions documented in the `webapp-paradigms` skill's `reference/diary-workflow.md` (global, shared across apps — load it if the rule details are unclear, or before changing them).

`diary.md` lives at the repo root. Prefer `git restore <file>` over the Edit tool when reverting a tracked file to its last committed state.

## Project Commands

```sh
pnpm install        # install dependencies
pnpm dev            # start dev server (port 44100)
pnpm start          # production server
pnpm test           # run tests (Node built-in runner)
pnpm typecheck      # tsc --noEmit
pnpm check          # Biome lint + format (auto-fix)
```

## Ports

Each rushsoft app owns a block of ports so dev servers, tests and agents running in parallel never hit another app's server: shopping-list2 uses 44100 (dev), 44101 (e2e), 44102 (Lighthouse server), 44103 (Lighthouse Chrome debugging); clockout uses 442xx. Tests always start their own server (`reuseExistingServer: false`). When an ad-hoc server is needed, pick a free port outside these blocks and stop only processes you started — never `kill` whatever listens on a port.

## Stack

- Remix 3 (`remix@3.3.0`) — server framework
- TypeScript 7 (native `tsc`), Node 26+
- Biome — linting and formatting (see `biome.json`)
- No build step yet — server uses JIT transpilation via `remix/node-tsx`

## Framework Identity — Remix 3 ≠ React ≠ Remix 2

The legacy app was Remix 2 (React Router). This app is Remix 3 — a different model.
Never apply React or Remix 2 patterns here.

| React / Remix 2                       | Remix 3 (this app)                         |
|---------------------------------------|--------------------------------------------|
| `import from 'react' / '@remix-run/*'`| `import from 'remix/routes', 'remix/component'`|
| `useState / useEffect / hooks`        | closure state + `handle.update()`          |
| `export default function Page() {}`  | `export function Page(handle: Handle<P>)`  |
| `useLoaderData() / useActionData()`   | `handle.props` (typed, server-pushed)      |
| File-based routing                    | `route()` builders in `app/routes.ts`      |
| `action() / loader()` exports         | `createController()` with keyed actions    |
| `<Form> / useNavigate()`              | `form()` route + controller action + render|

See `.agents/skills/remix/SKILL.md` (from the Remix 3.3 starter) for the mental model. The
canonical API docs are the ones installed with the pinned version: search
`node_modules/remix/INDEX.md`, then `node_modules/remix/guides/` and
`node_modules/remix/src/<subpath>/README.md`. Re-copy the skill from
`@remix-run/cli`'s `template/.agents/skills/remix/` when upgrading Remix.

## Layout

- `server.ts` — HTTP server entry point
- `app/router.ts` — middleware wiring
- `app/routes.ts` — route definitions
- `app/actions/controller.tsx` — top-level route handlers; `app/actions/list/` — list routes
- `app/middleware/i18n.ts` — per-request `lang`/`t` on `context.i18n`
- `app/db.ts` + `app/db/migrations/` — `remix/data-table` on `node:sqlite`; migrations run at boot
- `app/ui/document.tsx` — base HTML shell; `app/ui/error-page.tsx` — shared error pages
- `app/assets.ts` + `app/assets/entry.ts` — asset server and browser entry
- `public/` — static files

Run `npx remix doctor` after structural or configuration changes.

## Code Principles

- **No logic duplication** — shared logic lives in `app/utils/`. If the same concept (a formula, a constant, a transformation) appears in more than one place, extract it before adding a second copy. This applies across the server/client boundary: ID generation is a good example — one `generateId()` in `utils/id.ts`, imported by both sides.

## Design Decisions

- **CSS** — plain `app/assets/main.css`, served by the asset server (minified, prefixed for the browser target — write unprefixed properties only); Radix UI blue/slate colors as CSS custom properties; no Tailwind, no CSS-in-JS
- **Assets** — production script/style URLs are content-fingerprinted and `immutable`; reference them only through `assets.ts` (`scriptEntry`, `stylesheetHref`, `getHref`), never as hand-written `/assets/...` paths
- **No extra UI deps** — no component libraries; web standards only
- **Live reference** — `https://shopping-list-eta.vercel.app` is the legacy Remix 2 app; use it as the visual reference during migration

## Remix 3 Routing Rules (learned)

- `createController` requires a **RouteMap**, not a leaf `Route`
- Top-level leaf routes (e.g. `about: get('/about')`) must be handled in the **root controller's actions**, not in a separate controller file
- Separate `app/actions/<key>/` directories are only warranted for **nested route maps**

## Verifying Migrated Pages

Use Playwright (devDependency) to compare DOM and computed styles between local and live after each migration step:

```js
// run from project root so @playwright/test resolves from node_modules
import { chromium } from '@playwright/test'
const browser = await chromium.launch()
async function inspect(url) {
  const page = await browser.newPage()
  await page.goto(url, { waitUntil: 'networkidle' })
  return page.evaluate(() => ({
    h1: getComputedStyle(document.querySelector('h1')),
    // add other elements / properties as needed
  }))
}
```

Always capture **computed styles** (fontSize, fontWeight, textShadow, …) alongside DOM structure — class names alone miss visual differences (e.g. text-shadow repetition counts).
