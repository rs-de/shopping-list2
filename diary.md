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

5. Add Biome as linter and formatter
   `(add @biomejs/biome, biome.json with vcs/gitignore integration, lint/format/check scripts)`

6. Add VSCode settings for Biome, fix tsdk path
   `(add .vscode/settings.json, biome.json vcs section, js/ts.tsdk.path)`

7. Add CLAUDE.md with diary workflow, fix AGENTS.md commands
   `(create CLAUDE.md, update AGENTS.md npm → pnpm)`
