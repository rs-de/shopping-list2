# Build Diary — shopping-list2

Pre-diary: `npx remix@next new shopping-list2`, pnpm, pnpm install (baseline)
Pre-diary (retroactive): register scaffolded Remix skill for Claude Code
   `ln -s ../../.agents/skills/remix .claude/skills/remix`

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

18. Step 7: shopping list UI — article list, add/edit/delete/clear/share/rejig, animations;
    bg blend-mode exclusion (light) / normal (dark) to match legacy visual
    `(create assets/shopping-list.tsx; edit actions/list/controller.tsx, main.css)`

19. Step 7: clear dialog fade+scale animation (enter 300ms / exit 200ms)
    `(edit assets/shopping-list.tsx, main.css)`

20. Step 8: i18n — thread Accept-Language translations across all routes
    `(add app/i18n.ts; edit controllers, document, footer, home-menu, shopping-list)`

21. Fix preferredLang: use remix/headers/accept-language for correct priority
    `(edit app/i18n.ts: AcceptLanguage.from(header).getPreferred(SUPPORTED))`

22. Step 9a: per-list manifest route + PWA <head> tags (manifest, theme-color, apple-icon)
    `(edit routes.ts, list/controller.tsx, ui/document.tsx)`

23. Step 9b: TS service worker via asset-server proxy at /sw.js
    `(add app/assets/sw.ts; edit routes.ts, controller.tsx, entry.ts)`

24. Step 9c: IndexedDB dirty-flag + replaceArticles sync, backoff retry, concurrent-safe
    `(edit list/controller.tsx + app/assets/shopping-list.tsx)`

25. Step 10a: 404 catch-all + 500 fallback + HTML error pages
    `(edit routes.ts, controller.tsx, list/controller.tsx; edit public/styles/main.css)`

28. Lighthouse quality-gate script test:quality (perf>=80, a11y/bp/seo>=90)
   `(pnpm add -D lighthouse; add scripts/lighthouse.ts; edit package.json)`

29. Step 11: Lighthouse 100/100/100/100 — favicon, meta desc, contrast, cache, SW module
    `(edit document.tsx, main.css, server.ts, entry.ts)`

26. Step 10b: /api/version endpoint + client reload banner on version change
    `(edit routes.ts, controller.tsx, entry.ts, public/styles/main.css)`

27. Step 10c: Playwright e2e tests — home, create list, add article, 404, version
    `(add playwright.config.ts, tests/e2e.spec.ts; edit package.json)`

28. Fix client race: mark dirty on concurrent patches, let drainDirty reconcile
    `(edit app/assets/shopping-list.tsx: inFlight + markDirty on overlap)`

29. Fix SW: use networkFirst for /assets/ JS so code updates are served fresh
    `(edit app/assets/sw.ts: remove /assets/ from isStaticAsset)`

30. Abort superseded patch requests — no point letting stale ones finish
    `(edit app/assets/shopping-list.tsx: patchAbort controller)`

31. Skip drainDirty when last response already matches client state
    `(edit app/assets/shopping-list.tsx: compare articles in patch() dirty path)`

32. Add security response headers: CSP, X-Frame-Options, nosniff, Referrer-Policy
    `(edit server.ts: withSecurityHeaders applied to all responses)`

33. Server-side max-length validation for article text (256 chars)
    `(edit app/actions/list/controller.tsx: validate text in addArticle/changeArticle/replaceArticles)`

34. Switch Biome formatter to no-semicolons and reformat all files
    `(edit biome.json: semicolons asNeeded; pnpm check --write)`

35. Replace inline style props with CSS rules + ref-based DOM positioning
   `(edit shopping-list.tsx + main.css: no style= attrs, rejig via ref)`

36. Replace context-based CSS selectors with dedicated element classes
   `(edit shopping-list.tsx + main.css: sl-add-btn, sl-delete-btn)`

37. SW-driven caching: version-keyed cache, dev networkFirst, no-cache HTTP
   `(edit assets.ts + sw.ts + server.ts + package.json: APP_VERSION define)`

38. Switch to nanoid + extract generateId() util shared across list and articles
   `pnpm add nanoid && (add utils/id.ts; edit shopping-list.tsx+controller.tsx)`

39. Fix rejig optimistic update; add Playwright tests for all list actions
   `(edit shopping-list.tsx + e2e.spec.ts: rejig fix + optimistic tests)`

40. Drop sync row; silent retry skips timer when offline (online event wakes it)
   `(edit shopping-list.tsx + main.css + locales: no UI noise, offline-aware retry)`

41. "Link copied!" toast via reusable createToast helper (auto-dismiss 2 s)
   `(add utils/toast.tsx; edit shopping-list.tsx + main.css + locales)`

42. SW notifies page on update; toast with Refresh action; only on real updates
   `(edit sw.ts + toast.tsx + shopping-list.tsx + main.css + locales)`

43. Replace APP_VERSION with git hash as SW cache key; auto-busts on each deploy
   `(edit assets.ts + sw.ts: BUILD_STAMP from git rev-parse --short HEAD)`

44. Fix copy-link toast on iPhone: always use clipboard, drop navigator.share
   `(edit shopping-list.tsx: remove navigator.share branch from share())`

45. Copy-link fallback for HTTP: execCommand('copy') when clipboard unavailable
   `(edit shopping-list.tsx: execCommand fallback so toast fires on local network)`

46. Add compression middleware (gzip/brotli) for all text responses
   `(edit router.ts: compression() before staticFiles)`

47. fix: wait for networkidle on list-page navigations in e2e tests so the
   `clientEntry` dynamic import completes before filling the add-input
   `(edit tests/e2e.spec.ts: { waitUntil: "networkidle" } on goto(listUrl))`

48. move all inputs to native HTML forms with POST fallback for pre-JS path
   `(edit shopping-list.tsx + list/controller.tsx + main.css)`

49. consolidate duplicated POST/PATCH mutation logic in list controller
   `(edit list/controller.tsx: extract mutateArticles(), unify POST+PATCH block)`


50. auto-create list on valid-ID miss; 400 for invalid ID format
   `(edit list/controller.tsx: VALID_ID guard → 400, create on miss)`

51. update e2e: rename 404→400 test, add valid-ID auto-create test
   `(edit tests/e2e.spec.ts: 400 assertion + new auto-create test)`

52. fix cancel button size in clear-list dialog
   `(edit main.css: .sl-dialog-actions .btn-secondary → full btn sizing)`

53. no-JS POST fallback for clear list; intercept submit to show dialog
   `(edit shopping-list.tsx + main.css: restructure add form, clear-list form)`

54. show delete bar without JS via CSS :has()
   `(edit main.css: .sl-card:has([name=selected]:checked) shows delete bar)`

55. replace rejig popup with inline grid column (rowspan via grid-row: 1/-1)
   `(edit shopping-list.tsx + main.css + list/controller.tsx)`

56. fix rejig column positioning: absolute within list, JS centers on last checked
   `(edit shopping-list.tsx + main.css: sl-list-outer + position:absolute rejig)`

57. rejig column: overlay (no layout shift), rotateY reveal, no-JS anti-FOUC delay
   `(edit main.css + shopping-list.tsx: absolute pos, keyframe reveal, --js class)`

58. bigger checkbox touch target (44 px) + more clearance to rejig column
   `(edit shopping-list.tsx: wrap checkbox in label.sl-item-check; edit main.css)`

59. tighten vertical spacing to fit more list rows on screen
   `(edit main.css: heading, page padding, item padding, list gap, form spacing)`

60. add no-JS e2e suite: add, rejig reveal, delete bar, delete, clear, rejig POST
   `(edit e2e.spec.ts: no-JS describe + submitAndWait helper; add sl-clear-btn class)`

61. fix no-JS test suite: 4 bugs found while making all 18 tests pass
   `(edit shopping-list.tsx+main.css+e2e.spec.ts: defaultValue, ~ combinator, force click, goto)`

62. type-safe TranslationKey derived from English JSON (getTranslations() reverted: SSR)
   `(edit app/i18n.ts: import type en; TranslationKey = keyof typeof en)`

63. Add startup cleanup: delete ShoppingLists not updated in 90+ days
   `(edit server.ts: runCleanup() on start + setInterval 24h)`

64. Extract global rate limiter to utils/rateLimit.ts; wire into home POST
   `(edit utils/rateLimit.ts+controller.tsx: shared isRateLimited())`

65. Unknown list → redirect /?recreate=id; home recreates with same ID
   `(edit list/controller.tsx+controller.tsx+home-menu.tsx+locales: recreate flow)`

66. Persist rejigN to localStorage so the preferred stop count survives reload
   `(edit app/assets/shopping-list.tsx: read/write rejigN from localStorage)`

67. Add sortKey+createdAt to Article, add sortArticles util, reset dev DB
   `rm dev.db && pnpm dlx prisma db push && (edit utils/moveArticles.ts: type+sort fn)`

68. Server: addArticle stores sortKey+createdAt; rejig sets sortKey; remove moveArticles
   `(edit controller.tsx: addArticle+rejig use sortKey, drop moveArticles)`

69. Client: new articles get sortKey=rejigN+createdAt; display sorted; rejig sets sortKey; rejigN change clamps
   `(edit shopping-list.tsx: sortKey integration throughout)`

70. Remove moveArticles.ts; rename util to articles.ts; fix tests for sortKey model
   `rm utils/moveArticles.ts && (edit utils/articles.ts+shopping-list.tsx+e2e.spec.ts: cleanup)`

71. Show "list cleaned up" as toast instead of static paragraph on recreate
   `(edit home-menu.tsx: replace <p> with createToast on recreateId)`

72. Replace waitForTimeout(500) with toBeVisible() in tests for animation waits
   `(edit tests/e2e.spec.ts: drop fixed sleeps, poll instead)`

73. Add Dockerfile, .dockerignore, and fly.toml for fly.io deployment
   `(create Dockerfile+.dockerignore+fly.toml: LiteFS-ready path at /litefs)`

74. Wire up LiteFS: binary, config, updated Dockerfile and fly.toml
   `(create litefs.yml; edit Dockerfile+fly.toml: litefs mount as entrypoint)`

75. Rename fly.io app from shopping-list2 to shopping-list
   `(edit fly.toml: app = 'shopping-list')`

76. Add migrate script and rename package name to shopping-list
   `(edit package.json: name field + migrate script)`

77. Remove LiteFS — revert to simple volume mount and direct app start
   `(edit Dockerfile+fly.toml: drop litefs; rm litefs.yml)`

78. Fix Docker build: pin pnpm@10.6.2, restore onlyBuiltDependencies, rename app
   `(edit package.json+fly.toml+Dockerfile: pnpm pin + build script approval)`

79. fix SW_UPDATED toast reload on iOS: dismiss toast + use location.assign
   `(edit app/assets/shopping-list.tsx: onClick dismisses toast and uses window.location.assign)`

80. SW: drop PRECACHE_URLS; stale-while-revalidate for navigation (fix iOS black screen)
   `(edit app/assets/sw.ts: remove precache list; add staleWhileRevalidate for navigate)`

81. Local-first: IDB as source of truth; background server pull for remote changes
   `(edit shopping-list.tsx + list/controller.tsx: IDB primary; JSON GET; pullFromServer)`

82. Fix SW cache pollution: networkFirst only caches text/html (JSON must not overwrite nav cache)
   `(edit app/assets/sw.ts: guard cache.put with content-type check)`

83. Fix list manifest short_name: "List" → "Shopping List" for homescreen label
   `(edit app/actions/list/controller.tsx: short_name "List" → "Shopping List")`

84. Fix + test: non-dirty IDB snapshot must never override fresher server data
   `(edit shopping-list.tsx+e2e.spec.ts: trust IDB only when dirty; add regression test)`

85. Rejig dot buttons match labeled buttons — drop opacity-only modifier
   `(edit main.css+shopping-list.tsx: remove sl-rejig-btn--dot opacity + class)`

86. Fix iOS: force persistent compositing layer so fixed rejig column doesn't
   drift to document position `(edit main.css: will-change: transform on .sl-rejig-column)`

87. Fix iOS: SW update check compared against a stale cached sw.js copy
   `(edit entry.ts+e2e.spec.ts: register /sw.js?v=BUILD_STAMP; add regression test)`

88. Precache static pages non-blockingly; soft-nav fetches use stale-while-revalidate
   `(edit sw.ts+e2e.spec.ts: precache /, /about, /changelog; add regression test)`

89. Split shopping list into articles/plan/shopping modes (fix rejig bug)
   `(add app/assets/list/*; edit routes.ts+controller; rm shopping-list.tsx)`

90. Keep header title centered across mode pages regardless of link widths
   `(edit main.css: .sl-heading-row flex -> grid, justify-self on mode links)`

91. Content-hash main.css URL; cache it immutable, forever (dev+prod alike)
   `(edit assets.ts+document.tsx+server.ts: cssVersion sha1, immutable Cache-Control)`

92. Show spinner overlay on slow soft-navigation (Fly.io cold-start feedback)
   `(edit entry.ts+document.tsx+main.css: delayed sl-nav-overlay around resolveFrame)`

93. Bump remix 3.0.0-beta.3 → beta.5; no breaking APIs used, tests pass
   `pnpm add remix@3.0.0-beta.5 && pnpm typecheck && pnpm check && pnpm test:e2e`

94. Block+spinner on first-load freshness check when SW served from cache
   `(edit sw.ts+sync.ts+articles/plan/shopping.tsx+main.css: SL_WAS_CACHE_HIT)`

95. Force network-fresh HTML on manual reload; SWR was serving stale cache
   `(edit sw.ts+entry.ts+sync.ts: SL_FORCE_FRESH message bypasses cache once)`

96. Replace layout-shifting verify indicator with overlay on .sl-card
   `(edit main.css+articles.tsx+plan.tsx+shopping.tsx: sl-verify-overlay)`

97. Articles page shows original add order, ignoring Plan's sortKey grouping
   `(edit utils/articles.ts+articles.tsx: sortByCreatedAt for Articles-page render)`

98. HomeMenu: never show "create list" before localStorage check resolves
   `(edit home-menu.tsx+main.css: tri-state loading spinner; add e2e.spec.ts regression test)`

99. Auto-scroll Add button into view after adding an article (keyboard covers it)
   `(edit articles.tsx+main.css: scrollIntoView({block:"nearest"}) + scroll-margin-bottom)`

100. Wire up unused legacy apple-touch-startup-image assets (fix iOS launch black screen)
   `(edit document.tsx: add 15 splash links (light+dark) + apple-mobile-web-app-capable)`
