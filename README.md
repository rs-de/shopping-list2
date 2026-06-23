# Shopping List

An offline-first PWA shopping list built with Remix 3. No login or account needed — lists are identified by a random ID in the URL.

## Stack

- **[Remix 3](https://remix.run)** (`3.0.0-beta.3`) — server-first framework, not React Router and not Remix 2
- **TypeScript 6** / **Node 24+**
- **Prisma** + **libSQL** — SQLite locally, remote libSQL in production
- **Biome** — linting and formatting (no semicolons)
- **Playwright** — end-to-end tests
- No build step — JIT transpilation via `remix/node-tsx`

## Getting Started

```sh
# Prerequisites: Node >= 24, pnpm

pnpm install

# Copy env and set DATABASE_URL (SQLite default works for local dev)
cp .env.example .env       # if present, otherwise dev.db is used automatically

pnpm dev                   # http://localhost:44100
```

For local dev, the SQLite database is created automatically at `./dev.db`. No migration step needed for first run — Prisma generates the client from the schema.

For a fresh machine or after schema changes:

```sh
pnpm prisma migrate dev    # apply migrations + regenerate client
```

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
server.ts                  # HTTP server entry — security + cache headers
app/
  routes.ts                # Typed URL contract, href() generation
  router.ts                # Middleware wiring
  actions/
    controller.tsx          # Root route handlers (home, about, assets, version)
    list/controller.tsx     # /:listId — GET/PATCH/DELETE shopping list
  middleware/render.tsx     # SSR renderer middleware
  assets/
    entry.ts               # Browser entry — boots Remix runtime, registers SW
    shopping-list.tsx      # Interactive shopping list (clientEntry)
    home-menu.tsx          # Home page client component
    sw.ts                  # Service worker
  ui/                      # Server-rendered components (document shell, nav, footer)
  db.ts                    # Prisma client singleton
  i18n.ts                  # Accept-Language translation loader
public/
  styles/main.css          # Plain CSS — Radix UI color tokens, no Tailwind
  locales/                 # en/de translation JSON
prisma/
  schema.prisma            # ShoppingList model (id, articles JSON, timestamps)
tests/
  e2e.spec.ts             # Playwright tests
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
| `DATABASE_URL` | `file:./dev.db` | libSQL connection string |
| `PORT` | `44100` | HTTP server port |
