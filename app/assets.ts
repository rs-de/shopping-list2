import { execSync } from "node:child_process"

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

const buildStamp = getBuildStamp()

export const assetServer = createAssetServer({
	basePath: "/assets",
	rootDir,
	fileMap: {
		"app/*path": "app/*path",
		"node_modules/*path": "node_modules/*path",
	},
	allow: ["app/assets/**", "app/utils/**", "node_modules/**"],
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
