# Migration Reference — shopping-list2

Source of truth for migrating from `legacy-app/` (Remix 2 + React) to Remix 3.
Read this at the start of every migration session instead of re-reading legacy code.

---

## Routes

| Legacy (`$_id`)      | New app            | Notes                                 |
|----------------------|--------------------|---------------------------------------|
| `_index`             | `/`                | landing page                          |
| `$_id`              | `/:listId`         | shopping list (main app)              |
| `about`              | `/about`           | static markdown, de + en              |
| `changelog`          | `/changelog`       | single CHANGELOG.md (no i18n)         |
| `api.$_id`           | (inline actions)   | no separate /api routes in Remix 3    |
| `$_id.manifest`      | `/:listId/manifest`| per-list dynamic PWA manifest         |

---

## Data Model

SQLite + Prisma.

```prisma
model ShoppingList {
  id        String   @id @default(cuid())  // 25-char, used as the URL param
  articles  Json     @default("[]")        // [{ id: string, text: string }]; max 200
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## Shopping List Actions (6)

All go through `PATCH /api/:listId` in legacy → Remix 3 controller action on `/:listId`.

| `_action`        | What it does                                          |
|------------------|-------------------------------------------------------|
| `addArticle`     | push `{ id: nanoid(6), text }` to articles            |
| `changeArticle`  | update `articles[id].text` in place (debounced input) |
| `deleteArticles` | remove articles by id (from checkbox selection)       |
| `rejig`          | slot-based reorder (only shown when >5 articles)      |
| `clearList`      | set articles to `[]`                                  |
| (POST `/`)       | create new list (server nanoid → MongoDB ObjectId)    |

**Rejig detail:** user picks slot count (3/5/7 via dropdown), clicks slot button (labeled
early/medium/late for first/middle/last). `moveArticles()` util is pure — can be copied as-is
from `legacy-app/app/utils/moveArticles.ts`.

**Rate limit:** 5 new list creations per 10 seconds (server-side, `rate-limiter-flexible`).

---

## Architecture Decisions (new app)

| Concern         | Legacy                                       | New app                                                 |
|-----------------|----------------------------------------------|---------------------------------------------------------|
| Database        | MongoDB (Atlas) + Mongoose                   | SQLite + Prisma                                         |
| State           | Redux + RTKQ                                 | Remix 3 Handle + closure state                          |
| API layer       | RTKQ → separate /api routes                  | controller actions on route handlers                    |
| Styling         | Tailwind CSS + Radix colors                  | plain CSS + Radix colors CSS vars (`var(--blue-9)` ,,.) |
| Dark/light mode | Radix colors auto via `prefers-color-scheme` | same — Radix CSS ships dark mode vars;                  |
| i18n            | i18next-browser-languagedetector             | header `Accept-Language` → locale in `handle.props`     |
| Offline         | optimistic update + 1s PUT loop              | IndexedDB primary store + SW sync queue                 |
| Service worker  | `@remix-pwa/sw` (Remix 2)                    | TBD — needs Remix 3 SW approach                         |
| Returning user  | list ID in localStorage                      | same: localStorage (read in Handle closure)             |
| Markdown        | direct import as JSX component               | TBD — asset pipeline or server read + render            |
| Version check   | RTKQ query → cache bust + reload             | TBD                                                     |

---

## Page Layout (Navbar + Footer)

**Navbar** (sticky, scroll-aware shadow, backdrop blur):
- Left: logo (`/logo.svg`) + author name → links to `/`
- Right: BuyMeACoffee button

**Footer:**
- Left: copyright
- Right: About (internal) | Privacy (rushsoft.de) | Imprint (rushsoft.de) | GitHub icon | Changelog + version

---

## i18n

- Languages: `en` (fallback), `de`
- Detection: `Accept-Language` request header (server middleware → `handle.props.locale`)
- Translations: `public/locales/{de,en}/common.json` (already in repo)
- About page: two files `about.de.md` / `about.en.md` — serve based on locale
- Changelog: single `CHANGELOG.md`, no i18n needed

---

## Migration Order

Work top-down; each step is independently shippable.

1. **Server foundation** — Prisma setup: install, define schema, `prisma migrate dev`, generate client
2. **Page layout** — Navbar + Footer components wired into Document
3. **About page** — markdown render (de/en), basic i18n middleware
4. **Changelog page** — single markdown render
5. **Landing page** — create-list action (POST, rate limit), show-my-list (localStorage)
6. **Shopping list — data** — GET, PATCH (all 5 actions), DELETE controller actions
7. **Shopping list — UI** — article list, add, edit (debounced), delete, clear, share, rejig
8. **i18n** — full Accept-Language detection across all routes
9. **PWA** — service worker, offline-first (IndexedDB + sync queue), per-list manifest
10. **Polish** — error boundaries, version check, `$.tsx` catch-all (404)

---

## Files to Reuse from Legacy

- `app/utils/moveArticles.ts` — pure function, copy as-is
- `public/locales/` — already copied to new repo
- `public/styles/main.css` — already copied
- `public/icons/`, `public/manifest.webmanifest` — already copied
- `app/routes/about/about.{de,en}.md` — copy to new app when doing About page

## Status

| Step | Feature               | Status  |
|------|-----------------------|---------|
| 1    | Server foundation     | done    |
| 2    | Page layout           | done    |
| 3    | About page            | done    |
| 4    | Changelog page        | done    |
| 5    | Landing page          | done    |
| 6    | Shopping list — data  | done    |
| 7    | Shopping list — UI    | done    |
| 8    | i18n                  | done    |
| 9    | PWA / offline-first   | pending |
| 10   | Polish                | pending |
