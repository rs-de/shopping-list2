import { execSync } from "node:child_process"
import { globSync } from "node:fs"

import { createAssetServer } from "remix/assets"
import pkg from "../package.json" with { type: "json" }

const rootDir = process.cwd()

export const appVersion = pkg.version

// Git hash where available (dev); the Docker image has no .git/, so fall
// back to the package version — deploys only run on `v<version>` tags, so it
// changes with every release. The SW's registration URL and cache name are
// derived from this, so it must never be a constant across deploys.
function getBuildStamp(): string {
	try {
		return execSync("git rev-parse --short HEAD", {
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim()
	} catch {
		return pkg.version
	}
}

export const buildStamp = getBuildStamp()

const isDevelopment = process.env.NODE_ENV === "development"

export const assetServer = createAssetServer({
	basePath: "/assets",
	rootDir,
	mounts: { app: "app", node_modules: "node_modules" },
	allowFiles: [
		"app/routes.ts",
		"app/assets/**",
		"app/i18n/**",
		"app/utils/**",
		"node_modules/**",
	],
	denyFiles: ["app/**/*.server.*", "app/**/*.test.*"],
	sourceMaps: isDevelopment ? "external" : undefined,
	minify: !isDevelopment,
	// Production URLs carry a content hash (`entry.@w37eLV.ts`) and are served
	// `immutable`, which is what lets the service worker serve them cache-first
	// (sw.ts). Fingerprinting needs files that don't change on disk, so it's
	// off while watching in development, where URLs stay stable.
	watch: isDevelopment,
	fingerprint: !isDevelopment,
	// Oldest browsers the PWA supports; newer syntax is lowered for them.
	target: { safari: "16", ios: "16", chrome: "109", firefox: "115" },
	scripts: {
		define: {
			// Same flag as the server side: an unset NODE_ENV (e2e) is production
			// here too, so tests run the production service worker.
			"process.env.NODE_ENV": JSON.stringify(
				isDevelopment ? "development" : "production",
			),
			BUILD_STAMP: JSON.stringify(buildStamp),
		},
	},
	onError(error) {
		console.error("Asset compilation failed", error)
	},
})

// Import map, module preloads and URL for the browser entry, rendered by
// <Document>. Bare and stable specifiers in served modules resolve through
// this import map (to fingerprinted URLs in production).
export const scriptEntry = await assetServer.getScriptEntry(
	"app/assets/entry.ts",
)

export const stylesheetHref = await assetServer.getHref("app/assets/main.css")

export const serviceWorkerHref = await assetServer.getHref("app/assets/sw.ts")

// Every module and stylesheet the browser can load (the entry, each client
// entry and all their imports), for the service worker to cache on install —
// so a page from this release never has to fetch one of its files from a
// server that may already run the next release (whose URLs differ).
export const precacheAssets = await assetServer.getPreloads(
	globSync("app/assets/**/*.{ts,tsx,css}", { cwd: rootDir }).filter(
		(file) => !file.endsWith("sw.ts"),
	),
)
