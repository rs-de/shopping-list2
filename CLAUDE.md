# Claude Code Guide — shopping-list2

## Diary Workflow

Every change to this project follows a discuss-then-commit loop:

1. **Propose** — suggest the next step with a two-line diary entry (description + command/action, max 80 chars per line). Explain the motivation briefly.
2. **Discuss** — wait for the user to approve, tweak, or reject the step.
3. **Execute** — once approved, apply the change.
4. **Log** — append the two-line entry to `diary.md` (unless the user says "without diary").
5. **Commit** — stage only the relevant files and commit. Always ask the user before committing unless they explicitly said "do it" or "yes" to the full step. Never add `Co-Authored-By` lines to commit messages.

### diary.md format

Entries are numbered. Each step is two lines, indented command in a code span:

```
N. <short description or motivation, max 80 chars>
   `<command or (edit <file>: description), max 80 chars>`
```

Multi-command steps: join with `&&` into a single line. File-edit-only steps: use `(edit <file>: what changed)`.

### Reverting files

Prefer `git restore <file>` over the Edit tool when reverting a tracked file to its last committed state.

## Project Commands

```sh
pnpm install        # install dependencies
pnpm dev            # start dev server (port 44100)
pnpm start          # production server
pnpm test           # run tests (Node built-in runner)
pnpm typecheck      # tsc --noEmit
pnpm check          # Biome lint + format (auto-fix)
```

## Stack

- Remix 3 beta (`remix@3.0.0-beta.3`) — server framework
- TypeScript 6, Node 24+
- Biome — linting and formatting (see `biome.json`)
- No build step yet — server uses JIT transpilation via `remix/node-tsx`

## Framework Identity — Remix 3 ≠ React ≠ Remix 2

The legacy app was Remix 2 (React Router). This app is Remix 3 — a different model.
Never apply React or Remix 2 patterns here.

| React / Remix 2                       | Remix 3 (this app)                         |
|---------------------------------------|--------------------------------------------|
| `import from 'react' / '@remix-run/*'`| `import from 'remix/routes', 'remix/ui'`   |
| `useState / useEffect / hooks`        | closure state + `handle.update()`          |
| `export default function Page() {}`  | `export function Page(handle: Handle<P>)`  |
| `useLoaderData() / useActionData()`   | `handle.props` (typed, server-pushed)      |
| File-based routing                    | `route()` builders in `app/routes.ts`      |
| `action() / loader()` exports         | `createController()` with keyed actions    |
| `<Form> / useNavigate()`              | `form()` route + controller action + render|

See `.agents/skills/remix/SKILL.md` for the full Remix 3 pattern reference.

## Layout

- `server.ts` — HTTP server entry point
- `app/router.ts` — middleware wiring
- `app/routes.ts` — route definitions
- `app/actions/controller.tsx` — top-level route handlers
- `app/middleware/render.tsx` — SSR renderer
- `app/ui/document.tsx` — base HTML shell
- `app/assets.ts` + `app/assets/entry.ts` — asset pipeline
- `public/` — static files

Refer to `.agents/skills/remix/SKILL.md` for Remix 3 patterns.

## Code Principles

- **No logic duplication** — shared logic lives in `app/utils/`. If the same concept (a formula, a constant, a transformation) appears in more than one place, extract it before adding a second copy. This applies across the server/client boundary: nanoid-based ID generation is a good example — one `generateId()` in `utils/id.ts`, imported by both sides.

## Design Decisions

- **CSS** — plain `public/styles/main.css`; Radix UI blue/slate colors as CSS custom properties; no Tailwind, no CSS-in-JS
- **No extra UI deps** — no component libraries; web standards only
- **Live reference** — `https://shopping-list-eta.vercel.app` is the legacy Remix 2 app; use it as the visual reference during migration

## Remix 3 Routing Rules (learned)

- `createController` requires a **RouteMap**, not a leaf `Route`
- Top-level leaf routes (e.g. `about: get('/about')`) must be handled in the **root controller's actions**, not in a separate controller file
- Separate `app/actions/<key>/` directories are only warranted for **nested route maps**

## Verifying Migrated Pages

Use Playwright (devDependency) to compare DOM and computed styles between local and live after each migration step:

```js
// run from project root so Playwright resolves from node_modules
import { chromium } from 'playwright'
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
