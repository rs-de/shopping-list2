# Claude Code Guide — shopping-list2

## Diary Workflow

Every change to this project follows a discuss-then-commit loop:

1. **Propose** — suggest the next step with a two-line diary entry (description + command/action, max 80 chars per line). Explain the motivation briefly.
2. **Discuss** — wait for the user to approve, tweak, or reject the step.
3. **Execute** — once approved, apply the change.
4. **Log** — append the two-line entry to `diary.md` (unless the user says "without diary").
5. **Commit** — stage only the relevant files and commit. Always ask the user before committing unless they explicitly said "do it" or "yes" to the full step.

### diary.md format

Entries are numbered. Each step is two lines, indented command in a code span:

```
N. <short description or motivation, max 80 chars>
   `<command or (edit <file>: description), max 80 chars>`
```

Multi-command steps: join with `&&` into a single line. File-edit-only steps: use `(edit <file>: what changed)`.

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
