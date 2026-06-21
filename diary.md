# Build Diary — shopping-list2

Pre-diary: `npx remix@next new shopping-list2`, pnpm, pnpm install (baseline)

---

1. Initialize git repository and record build diary
   `git init && git add -A && git commit -m "chore: initial remix3-beta install"`

2. Pin devDependency versions, tighten engines field
   `(edit package.json: typescript ^6.0, @types/node ^25, node >=24)`

3. Align tsconfig lib to match target
   `(edit tsconfig.json: lib ES2024 → ESNext to match target ESNext)`

4. Strip scaffold demo, reduce to hello world page
   `(delete scaffold-home-page.tsx, prompt-button.tsx; simplify controller.tsx)`

5. Add Biome as linter/formatter with VSCode integration
   `(add @biomejs/biome, biome.json, .vscode/settings.json, lint/format/check scripts)`

6. Add CLAUDE.md with diary workflow, fix AGENTS.md commands
   `(create CLAUDE.md, update AGENTS.md npm → pnpm)`

7. Bring in legacy app assets; legacy-app source available locally (gitignored)
   `(add public/icons, locales, styles, manifest; update .gitignore, tsconfig)`

8. Prefer `git restore` over Edit to revert tracked file changes
   `(edit CLAUDE.md: add git restore preference under diary workflow)`

9. Document Remix 3 identity to prevent React/Remix 2 pattern drift during migration
   `(edit CLAUDE.md: add Framework Identity section; edit AGENTS.md: add warning)`

10. Create migration reference from legacy-app interview + code analysis
    `(create migration.md: routes, data model, actions, arch decisions, order)`

11. Pivot data layer to SQLite + Prisma; update migration.md accordingly
    `(edit migration.md: MongoDB → SQLite, Mongoose → Prisma, data model + step 1)`

12. Setup Prisma with SQLite (replacing MongoDB/Mongoose dependency)
    `(pnpm add @prisma/client dotenv, pnpm add -D prisma, prisma init, schema, migrate, app/db.ts)`

13. Step 2: Page layout — Navbar + Footer; CSS synced to live app colors
    `(create navbar.tsx, footer.tsx; edit document.tsx, main.css)`

14. About page: /about route, md render (de/en), Accept-Language detection
    `(pnpm add marked; add route, about action in controller, copy .md files)`

15. Step 4: Changelog page — /changelog route renders CHANGELOG.md via marked
    `(copy CHANGELOG.md; add route; add changelog action; add prose typography CSS)`

16. Landing page: home GET + POST (create list, rate limit), localStorage menu,
    `shared .content-box; (edit controller.tsx, main.css; add home-menu.tsx)`

17. Step 6: shopping list data — GET/PATCH (5 actions)/DELETE at /:listId
    `(edit routes.ts, router.ts; add utils/moveArticles.ts, actions/list/controller.tsx)`
