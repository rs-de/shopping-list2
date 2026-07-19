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

export const assetServer = createAssetServer({
	basePath: "/assets",
	rootDir,
	fileMap: {
		"app/*path": "app/*path",
		"node_modules/*path": "node_modules/*path",
	},
	allow: ["app/assets/**", "app/i18n/**", "app/utils/**", "node_modules/**"],
	deny: ["app/**/*.server.*"],
	sourceMaps: process.env.NODE_ENV === "development" ? "external" : undefined,
	scripts: {
		define: {
			"process.env.NODE_ENV": JSON.stringify(
				process.env.NODE_ENV ?? "development",
			),
			BUILD_STAMP: JSON.stringify(buildStamp),
		},
	},
})
