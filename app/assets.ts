import * as fs from "node:fs"
import * as path from "node:path"
import { createAssetServer } from "remix/assets"

const rootDir = process.cwd()
const pkg = JSON.parse(
	fs.readFileSync(path.join(rootDir, "package.json"), "utf-8"),
) as { version: string }

export const appVersion = pkg.version

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
			APP_VERSION: JSON.stringify(pkg.version),
		},
	},
})
