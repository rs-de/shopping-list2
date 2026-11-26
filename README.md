# Shopping List

An offline-first PWA shopping list built with Remix 3. No login or account needed — lists are identified by a random ID in the URL.

## Stack

- **[Remix 3](https://remix.run)** (`3.3.0`) — server-first framework, not React Router and not Remix 2
- **TypeScript 6** / **Node 26+**
- **`remix/data-table`** — SQLite via Node's built-in `node:sqlite` (no ORM, no native deps)
- **Biome** — linting and formatting (no semicolons)
- **Playwright** — end-to-end tests
- No build step — JIT transpilation via `remix/node-tsx`

## Getting Started

```sh
# Prerequisites: Node >= 26, pnpm

pnpm install

pnpm dev                   # http://localhost:44100
```

The SQLite database is created automatically at `./dev.db`. Pending migrations in `app/db/migrations/` are applied on every server start — add a new `<NNNN>_<slug>/up.sql` directory for schema changes.

## Commands

| Command | Description |
|---|---|
| `pnpm dev` | Dev server with `--watch` on port 44100 |
| `pnpm start` | Production server |
| `pnpm test:e2e` | Playwright end-to-end tests |
| `pnpm typecheck` | TypeScript type check (`tsc --noEmit`) |
| `pnpm check` | Biome lint + format with auto-fix |
| `pnpm lighthouse` | Lighthouse audit via Playwright Chromium |

## Project Layout

```
server.ts                  # HTTP entry — migrations, security + cache headers
app/
  routes.ts                # Typed URL contract, href() generation
  router.ts                # Middleware wiring (csp, formData, i18n, render)
  actions/
    controller.tsx         # Root routes (home, about, changelog, assets, sw, manifest)
    about/                 # About page markdown (en/de)
    list/controller.tsx    # /:listId routes — list pages, writes, JSON pull
  middleware/i18n.ts       # Request language + translator on context.i18n
  assets/                  # Browser-reachable modules
    entry.ts               # Browser entry — boots Remix runtime, registers SW
    home-menu.tsx          # Home page client component
    list/                  # Articles / Plan / Shopping client entries, sync engine
    sw.ts                  # Service worker
  ui/                      # Server-rendered components (document, nav, footer, error pages)
  utils/                   # Shared server/browser logic (ids, articles, i18n, rate limit)
  i18n/de.ts               # German translations (pnpm i18n:sync)
  db.ts                    # data-table schema + SQLite connection + migrate()
  db/migrations/           # SQL migrations, applied on server start
public/
  styles/main.css          # Plain CSS — Radix UI color tokens, no Tailwind
tests/
  e2e.spec.ts              # Playwright tests
```

## Remix 3 — Key Differences

This is **not** React or Remix 2. The patterns are different:

| Remix 2 / React | Remix 3 (this app) |
|---|---|
| `useState` / hooks | Closure state + `handle.update()` |
| `useLoaderData()` | `handle.props` |
| `action()` / `loader()` | `createController()` with keyed actions |
| File-based routing | `route()` builders in `app/routes.ts` |
| `<Form>` / `useNavigate()` | `form()` + `navigate()` / `link()` mixin |

Interactive components use `clientEntry()` and run entirely in the browser. Server state is pushed as props; client state lives in closure variables.

See `.agents/skills/remix/SKILL.md` for the full Remix 3 pattern reference.

## Offline / PWA

- Service worker caches static assets (`cacheFirst`) and pages (`networkFirst`)
- JS assets at `/assets/` use `networkFirst` so code updates are always served fresh
- Article state is mirrored to IndexedDB with a dirty flag
- Failed saves are retried via `drainDirty` (exponential backoff) using `replaceArticles`
- Concurrent saves mark dirty immediately and reconcile via a single `replaceArticles` after all in-flight requests settle

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | SQLite file (`file:<path>`) |
| `PORT` | `44100` | HTTP server port |
