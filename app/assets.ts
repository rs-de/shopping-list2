import { execSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"

import { createAssetServer } from "remix/assets"
import pkg from "../package.json" with { type: "json" }

const rootDir = process.cwd()

export const appVersion = pkg.version

function getBuildStamp(): string {
	try {
		return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim()
	} catch {
		return "unknown"
	}
}

export const buildStamp = getBuildStamp()

// Content hash, not buildStamp: a Docker rebuild or uncommitted local edit
// both need to bust the cache the moment the bytes actually change, in dev
// and prod alike, independent of git commits or file mtimes (which Docker's
// `COPY . .` resets on every build regardless of real content changes).
function hashFile(relPath: string): string {
	const bytes = readFileSync(path.join(rootDir, relPath))
	return createHash("sha1").update(bytes).digest("hex").slice(0, 8)
}

export const cssVersion = hashFile("public/styles/main.css")

const isDevelopment = process.env.NODE_ENV === "development"

export const assetServer = createAssetServer({
	basePath: "/assets",
	rootDir,
	mounts: { app: "app", node_modules: "node_modules" },
	allowFiles: [
		"app/assets/**",
		"app/i18n/**",
		"app/utils/**",
		"node_modules/**",
	],
	denyFiles: ["app/**/*.server.*", "app/**/*.test.*"],
	sourceMaps: isDevelopment ? "external" : undefined,
	minify: !isDevelopment,
	// Oldest browsers the PWA supports; newer syntax is lowered for them.
	target: { safari: "16", ios: "16", chrome: "109", firefox: "115" },
	scripts: {
		define: {
			"process.env.NODE_ENV": JSON.stringify(
				process.env.NODE_ENV ?? "development",
			),
			BUILD_STAMP: JSON.stringify(buildStamp),
		},
	},
	onError(error) {
		console.error("Asset compilation failed", error)
	},
})
