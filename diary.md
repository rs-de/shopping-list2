# Build Diary — shopping-list2

Pre-diary: `npx remix@next new shopping-list2`, pnpm, pnpm install (baseline)
Pre-diary (retroactive): register scaffolded Remix skill for Claude Code
   `ln -s ../../.agents/skills/remix .claude/skills/remix`

---

1. Initialize git repository and record build diary
   `git init && git add -A && git commit -m "chore: initial remix3-beta install"`

2. Strip scaffold demo, reduce to hello world page
   `(delete scaffold-home-page.tsx, prompt-button.tsx; simplify controller.tsx)`

3. Add Biome as linter/formatter with VSCode integration
   `(add @biomejs/biome, biome.json, .vscode/settings.json, lint/format/check scripts)`

4. Add CLAUDE.md with diary workflow, fix AGENTS.md commands
   `(create CLAUDE.md, update AGENTS.md npm → pnpm)`

5. Bring in legacy app assets; legacy-app source available locally (gitignored)
   `(add public/icons, locales, styles, manifest; update .gitignore, tsconfig)`

6. Document Remix 3 identity to prevent React/Remix 2 pattern drift during migration
   `(edit CLAUDE.md: add Framework Identity section; edit AGENTS.md: add warning)`

7. Create migration reference from legacy-app interview + code analysis
   `(create migration.md: routes, data model, actions, arch decisions, order)`

8. Pivot data layer to SQLite + Prisma; update migration.md accordingly
   `(edit migration.md: MongoDB → SQLite, Mongoose → Prisma, data model + step 1)`

9. Setup Prisma with SQLite (replacing MongoDB/Mongoose dependency)
   `(pnpm add @prisma/client dotenv, pnpm add -D prisma, prisma init, schema, migrate, app/db.ts)`

10. Step 2: Page layout — Navbar + Footer; CSS synced to live app colors
   `(create navbar.tsx, footer.tsx; edit document.tsx, main.css)`

11. About page: /about route, md render (de/en), Accept-Language detection
   `(pnpm add marked; add route, about action in controller, copy .md files)`

12. Step 4: Changelog page — /changelog route renders CHANGELOG.md via marked
   `(copy CHANGELOG.md; add route; add changelog action; add prose typography CSS)`

13. Landing page: home GET + POST (create list, rate limit), localStorage menu,
   `shared .content-box; (edit controller.tsx, main.css; add home-menu.tsx)`

14. Step 6: shopping list data — GET/PATCH (5 actions)/DELETE at /:listId
   `(edit routes.ts, router.ts; add utils/moveArticles.ts, actions/list/controller.tsx)`

15. Step 7: shopping list UI — article list, add/edit/delete/clear/share/rejig, animations;
   bg blend-mode exclusion (light) / normal (dark) to match legacy visual
   `(create assets/shopping-list.tsx; edit actions/list/controller.tsx, main.css)`

16. Step 8: i18n — thread Accept-Language translations across all routes
   `(add app/i18n.ts; edit controllers, document, footer, home-menu, shopping-list)`

17. Step 9a: per-list manifest route + PWA <head> tags (manifest, theme-color, apple-icon)
   `(edit routes.ts, list/controller.tsx, ui/document.tsx)`

18. Step 9b: TS service worker via asset-server proxy at /sw.js
   `(add app/assets/sw.ts; edit routes.ts, controller.tsx, entry.ts)`

19. Step 9c: IndexedDB dirty-flag + replaceArticles sync, backoff retry, concurrent-safe
   `(edit list/controller.tsx + app/assets/shopping-list.tsx)`

20. Step 10a: 404 catch-all + 500 fallback + HTML error pages
   `(edit routes.ts, controller.tsx, list/controller.tsx; edit public/styles/main.css)`

21. Lighthouse quality-gate script test:quality (perf>=80, a11y/bp/seo>=90)
   `(pnpm add -D lighthouse; add scripts/lighthouse.ts; edit package.json)`

22. Step 11: Lighthouse 100/100/100/100 — favicon, meta desc, contrast, cache, SW module
   `(edit document.tsx, main.css, server.ts, entry.ts)`

23. Step 10b: /api/version endpoint + client reload banner on version change
   `(edit routes.ts, controller.tsx, entry.ts, public/styles/main.css)`

24. Step 10c: Playwright e2e tests — home, create list, add article, 404, version
   `(add playwright.config.ts, tests/e2e.spec.ts; edit package.json)`

25. Fix client race: mark dirty on concurrent patches, let drainDirty reconcile
   `(edit app/assets/shopping-list.tsx: inFlight + markDirty on overlap)`

26. Add security response headers: CSP, X-Frame-Options, nosniff, Referrer-Policy
   `(edit server.ts: withSecurityHeaders applied to all responses)`

27. Server-side max-length validation for article text (256 chars)
   `(edit app/actions/list/controller.tsx: validate text in addArticle/changeArticle/replaceArticles)`

28. SW-driven caching: version-keyed cache, dev networkFirst, no-cache HTTP
   `(edit assets.ts + sw.ts + server.ts + package.json: APP_VERSION define)`

29. Switch to nanoid + extract generateId() util shared across list and articles
   `pnpm add nanoid && (add utils/id.ts; edit shopping-list.tsx+controller.tsx)`

30. Drop sync row; silent retry skips timer when offline (online event wakes it)
   `(edit shopping-list.tsx + main.css + locales: no UI noise, offline-aware retry)`

31. SW notifies page on update; toast with Refresh action; only on real updates
   `(edit sw.ts + toast.tsx + shopping-list.tsx + main.css + locales)`

32. move all inputs to native HTML forms with POST fallback for pre-JS path
   `(edit shopping-list.tsx + list/controller.tsx + main.css)`

33. auto-create list on valid-ID miss; 400 for invalid ID format
   `(edit list/controller.tsx: VALID_ID guard → 400, create on miss)`

34. replace rejig popup with inline grid column (rowspan via grid-row: 1/-1)
   `(edit shopping-list.tsx + main.css + list/controller.tsx)`

35. add no-JS e2e suite: add, rejig reveal, delete bar, delete, clear, rejig POST
   `(edit e2e.spec.ts: no-JS describe + submitAndWait helper; add sl-clear-btn class)`

36. Add startup cleanup: delete ShoppingLists not updated in 90+ days
   `(edit server.ts: runCleanup() on start + setInterval 24h)`

37. Extract global rate limiter to utils/rateLimit.ts; wire into home POST
   `(edit utils/rateLimit.ts+controller.tsx: shared isRateLimited())`

38. Unknown list → redirect /?recreate=id; home recreates with same ID
   `(edit list/controller.tsx+controller.tsx+home-menu.tsx+locales: recreate flow)`

39. Add sortKey+createdAt to Article, add sortArticles util, reset dev DB
   `rm dev.db && pnpm dlx prisma db push && (edit utils/moveArticles.ts: type+sort fn)`

40. Add Dockerfile, .dockerignore, and fly.toml for fly.io deployment
   `(create Dockerfile+.dockerignore+fly.toml: LiteFS-ready path at /litefs)`

41. Wire up LiteFS: binary, config, updated Dockerfile and fly.toml
   `(create litefs.yml; edit Dockerfile+fly.toml: litefs mount as entrypoint)`

42. Remove LiteFS — revert to simple volume mount and direct app start
   `(edit Dockerfile+fly.toml: drop litefs; rm litefs.yml)`

43. SW: drop PRECACHE_URLS; stale-while-revalidate for navigation (fix iOS black screen)
   `(edit app/assets/sw.ts: remove precache list; add staleWhileRevalidate for navigate)`

44. Local-first: IDB as source of truth; background server pull for remote changes
   `(edit shopping-list.tsx + list/controller.tsx: IDB primary; JSON GET; pullFromServer)`

45. Fix + test: non-dirty IDB snapshot must never override fresher server data
   `(edit shopping-list.tsx+e2e.spec.ts: trust IDB only when dirty; add regression test)`

46. Precache static pages non-blockingly; soft-nav fetches use stale-while-revalidate
   `(edit sw.ts+e2e.spec.ts: precache /, /about, /changelog; add regression test)`

47. Split shopping list into articles/plan/shopping modes (fix rejig bug)
   `(add app/assets/list/*; edit routes.ts+controller; rm shopping-list.tsx)`

48. Content-hash main.css URL; cache it immutable, forever (dev+prod alike)
   `(edit assets.ts+document.tsx+server.ts: cssVersion sha1, immutable Cache-Control)`

49. Show spinner overlay on slow soft-navigation (Fly.io cold-start feedback)
   `(edit entry.ts+document.tsx+main.css: delayed sl-nav-overlay around resolveFrame)`

50. Block+spinner on first-load freshness check when SW served from cache
   `(edit sw.ts+sync.ts+articles/plan/shopping.tsx+main.css: SL_WAS_CACHE_HIT)`

51. Force network-fresh HTML on manual reload; SWR was serving stale cache
   `(edit sw.ts+entry.ts+sync.ts: SL_FORCE_FRESH message bypasses cache once)`

52. Analyze diary+git history+code to catalog realized good-web-app paradigms
   `(create paradigms.md: 12 categories, offline-first through diary-as-process)`

53. Add unit tests for pure utils (articles, id, rateLimit) via node:test
   `(add app/utils/*.test.ts; add test:unit script, wire into pnpm test)`

54. Harden against DB abuse: article cap + global/per-list rate limits
   `(edit rateLimit.ts+controller.tsx+list/controller.tsx: 500 cap, counter limiter)`

55. Gate tagged deploys on typecheck+lint+unit (no DB-dependent e2e in CI)
   `(edit deploy.yml: add test job, needs: test on deploy; verified on clean clone)`

56. Stale-timestamp verify (8h): blocking on stale resume/first load
   `(edit sync.ts+sw.ts: CHECKED_KEY+isStale(8h), drop cache-hit gate)`

57. Hide stale list during blocking verify — spinner only, no old rows
   `(edit articles.tsx+shopping.tsx+plan.tsx: gate list render on !isChecking())`

58. Silent update-apply on resume; drop dead /api/version banner
   `(edit entry.ts+sync.ts+main.css: rm banner+toast, reload on next visible if pending; pnpm i18n:sync)`

59. Resume never blocks; only first load verifies, 8h→30min threshold
   `(edit sync.ts: visibilitychange always silent; STALE_MS = 30 * 60 * 1000)`

60. Add quickAdd action for external triggers (e.g. Siri Shortcuts)
   `(edit app/actions/list/controller.tsx: server-generated id/sortKey)`
