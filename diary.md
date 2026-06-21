# Build Diary — shopping-list2

Pre-diary: `npx remix@next new shopping-list2`, pnpm, pnpm install (baseline)

---

2026-06-05 Initialize git repository and record build diary
git init && git add -A && git commit -m "chore: initial remix3-beta install"

2026-06-05 Pin devDependency versions, tighten engines field
(edit package.json: typescript ^6.0, @types/node ^25, node >=24)

2026-06-05 Align tsconfig lib to match target
(edit tsconfig.json: lib ES2024 → ESNext to match target ESNext)

2026-06-20 Add Biome as linter and formatter
(add @biomejs/biome, biome.json with vcs/gitignore integration, lint/format/check scripts)

2026-06-05 Strip scaffold demo, reduce to hello world page
(delete scaffold-home-page.tsx, prompt-button.tsx; simplify controller.tsx)
