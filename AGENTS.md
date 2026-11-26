# Shopping List2 Agent Guide

This app was scaffolded with `remix new`. Use these conventions when continuing to build it out.

## Commands

```sh
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm check
```

## Building Features

**Important:** This is Remix 3 — NOT React, NOT Remix 2 / React Router. See the "Framework
Identity" section in CLAUDE.md for a contrast table before writing any new code.

Refer to ./.agents/skills/remix/SKILL.md, then the docs installed with the pinned
Remix version (`node_modules/remix/INDEX.md`, `guides/`, `src/*/README.md`).

## Starter Layout

- `app/actions/controller.tsx` owns the top-level route actions
- `app/routes.ts` defines the route contract
- `app/router.ts` wires middleware (csp, formData, i18n, render) and controllers
- `app/actions/list/controller.tsx` owns the list route map
- `app/middleware/i18n.ts` exposes the request's language as `context.i18n`
- `app/ui/` holds the shared document shell, navbar/footer and error pages
- `app/assets.ts` owns the asset server used by the asset route and `render({ assets })`
- `app/assets/` holds browser-reachable modules (client entries, sync, service worker)
- `app/db.ts` + `app/db/migrations/` hold the data-table schema and SQL migrations
- `public/` contains static files served from the app root

## Route Ownership

- Start from `app/routes.ts` and map each route to the narrowest owner on disk.
- Put top-level route actions in `app/actions/controller.tsx`.
- Add `app/actions/<route-key>/controller.tsx` for nested route maps that need their own actions or middleware.
- Keep route-owned page modules next to the route that owns them.
- Move shared UI to `app/ui/`, not `app/actions/`.

## Build-Out Notes

- This starter intentionally begins small; add directories like `app/data/` and `test/` only when you need them.
- Prefer putting code in the narrowest owner before introducing shared modules.
- Avoid generic dumping-ground directories like `app/lib/` or `app/components/`.
