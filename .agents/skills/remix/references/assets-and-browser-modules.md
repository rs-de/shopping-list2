# Assets and Browser Modules

## What This Covers

How to serve browser scripts and styles from source. Read this when the task involves:

- Configuring `createAssetServer` (`basePath`, `mounts`, `allowFiles`, `denyFiles`, fingerprinting, compiler options)
- Choosing between `staticFiles()` for already-built files and `createAssetServer()` for source assets that need import rewriting, preloads, or fingerprinted URLs
- Generating script URLs, import maps, or `<link rel="modulepreload">` tags for a client entry
- Keeping server-only files out of the browser via `denyFiles` rules

For routing the URL namespace itself, see `routing-and-controllers.md`. For client entry hydration, see `hydration-frames-navigation.md`.

## When To Reach For It

Use `remix/assets` when the app serves browser JavaScript, TypeScript, or CSS from source files. This is the right tool for client entrypoints, browser-only helpers, styles under `app/assets/`, and monorepo code that should be compiled and served under a public URL namespace.

Use `staticFiles()` for files that already exist on disk exactly as they should be served. Use `createAssetServer()` for source scripts or styles that need rewriting, dependency scanning, preloads, sourcemaps, or fingerprinted URLs.

## Default Pattern

```typescript
import { createAssetServer } from 'remix/assets'
import { createController } from 'remix/router'
import { get, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
})

let assetServer = createAssetServer({
  basePath: '/assets',
  rootDir: process.cwd(),
  mounts: { app: 'app', node_modules: 'node_modules' },
  allowFiles: ['app/assets/**', 'node_modules/**'],
  denyFiles: ['app/**/*.server.*'],
  target: { es: '2020', chrome: '109', safari: '16.4' },
  sourceMaps: process.env.NODE_ENV === 'development' ? 'external' : undefined,
  minify: process.env.NODE_ENV === 'production',
  scripts: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
    },
  },
})

export default createController(routes, {
  actions: {
    async assets({ request }) {
      return (await assetServer.fetch(request)) ?? new Response('Not Found', { status: 404 })
    },
  },
})
```

## Rules

- Treat `allowFiles` and `denyFiles` as the security boundary for browser-reachable source files. `allowFiles` is required.
- Add a `denyFiles` list for server-only modules such as `*.server.*`, private config, or other files that should never be exposed.
- Set `rootDir` explicitly in monorepos so relative paths resolve from the intended project root.
- `basePath` is the public URL namespace handled by the asset server.
- `mounts` maps public URL path segments to root-relative directories (default `{ app: 'app', npm: 'node_modules' }`). Set it explicitly if the app already has URLs baked in that assume different mount names (e.g. serving `node_modules` under `/assets/node_modules/...` instead of the default `/assets/npm/...`).
- CSS files are compiled and served alongside scripts. Local CSS `@import` rules are rewritten and fingerprinted with the same asset server routing rules.

## Rendering HTML

Use `getScriptEntry()` to resolve a client entry module: it returns `{ href, preloads, importMap }` together, since compiled browser scripts resolve their imports through an import map rather than fully rewritten URLs. `getHref()` (single URL) and `getPreloads()` (preload URLs only) still exist individually when you don't need the full entry.

```typescript
let { href, preloads, importMap } = await assetServer.getScriptEntry('app/assets/entry.ts')
```

For the import map to actually reach the browser, render exactly one `<ImportMap value={...} nonce={...} />` (from `remix/ui/server`) inside the document `<head>` — the renderer merges each resolved client entry's import map into it during streaming. Omitting it silently drops the import map, and any bare-specifier import inside a hydrated client entry then fails at runtime with "Failed to resolve module specifier". If the app sets a `script-src` CSP without `'unsafe-inline'`, this inline `<script type="importmap">` also needs a per-request nonce reflected in both the CSP header and the `nonce` prop.

Use this when rendering documents or layouts that boot browser behavior with a known client entry.

When resolving hydrated client entries during server rendering, pass the source entry ID from `clientEntry(import.meta.url, ...)` to `getScriptEntry()` inside `resolveClientEntry`, and merge in `exportName` yourself (`getScriptEntry()` doesn't know it). Keep export-name resolution in that render helper, and avoid hard-coding public asset URLs in source-owned component modules.

## Development vs Deployment

In development:

- Keep `watch` enabled so source changes are picked up without restarting the server
- Prefer stable URLs with normal revalidation
- Enable source maps when debugging browser code

In deployment:

- Set `watch: false`
- Use `fingerprint: true` for long-lived immutable caching (content-hash-based, not build-id-based)
- For leaf files under `files`, set a `cacheKey` if a build identifier still needs to bust the cache independent of content

Fingerprinting assumes files on disk are stable and requires `watch: false`.

## Useful Compiler Options

- `minify` for production minification of scripts and styles
- `sourceMaps` for `'external'` or `'inline'` source maps for scripts and styles
- `sourceMapSourcePaths` for `'url'` or `'absolute'` source map paths
- `target` as an object for shared browser targets and script-only ECMAScript output, such as `{ es: '2020', chrome: '109', safari: '16.4' }`
- `scripts.define` to replace globals such as `process.env.NODE_ENV`
- `scripts.external` to leave specific script imports untouched

Do not nest shared compiler options under `scripts`. Use top-level `minify`, `sourceMaps`, `sourceMapSourcePaths`, and `target` so they apply to styles as well as scripts.

## Lifecycle

If the asset server is long-lived and watching the file system, call `await assetServer.close()` when shutting down dev servers or disposing tests.
