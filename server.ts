import * as http from "node:http"
import * as os from "node:os"
import * as path from "node:path"
import { lt } from "remix/data-table"
import {
	MaxFileSizeExceededError,
	MaxFilesExceededError,
	MaxHeaderSizeExceededError,
	MaxPartsExceededError,
	MaxTotalSizeExceededError,
} from "remix/form-data-parser"
import { createRequestListener } from "remix/node-fetch-server"

import { db, migrate, shoppingLists } from "./app/db.ts"
import { router } from "./app/router.ts"

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000
const STALE_THRESHOLD_DAYS = 90

async function runCleanup() {
	const cutoff = new Date(
		Date.now() - STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000,
	)
	const { affectedRows } = await db.deleteMany(shoppingLists, {
		where: lt("updatedAt", cutoff),
	})
	if (affectedRows > 0) {
		console.log(`Cleanup: removed ${affectedRows} stale list(s)`)
	}
}

const STATIC_EXTS = new Set([
	"css",
	"js",
	"webp",
	"png",
	"jpg",
	"ico",
	"svg",
	"woff",
	"woff2",
	"ttf",
	"gif",
])

function isFormLimitError(error: unknown): boolean {
	return (
		error instanceof MaxTotalSizeExceededError ||
		error instanceof MaxPartsExceededError ||
		error instanceof MaxFilesExceededError ||
		error instanceof MaxFileSizeExceededError ||
		error instanceof MaxHeaderSizeExceededError
	)
}

function withSecurityHeaders(response: Response): Response {
	const headers = new Headers(response.headers)
	// Content-Security-Policy (with its per-request nonce) is set by the
	// `csp()` router middleware, not here — it needs the same nonce value
	// used on the <ImportMap> script tag, which this outer wrapper has no
	// access to.
	headers.set("X-Frame-Options", "DENY")
	headers.set("X-Content-Type-Options", "nosniff")
	headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	})
}

function withCacheHeaders(response: Response, url: URL): Response {
	const ext = path.extname(url.pathname).slice(1).toLowerCase()
	if (!response.ok || !STATIC_EXTS.has(ext)) return response
	const headers = new Headers(response.headers)
	// main.css is content-hash-versioned (cssVersion in assets.ts): the same
	// URL can never later resolve to different bytes, so it's safe to cache
	// forever and skip revalidation. sw.js also carries a ?v= query, but its
	// registration/update-check path has a fragile iOS history (see
	// c01dc35) — left on no-cache deliberately rather than folded into this
	// same rule. Everything else still defers to the SW, which owns the
	// cache and revalidates instead of storing forever.
	const isVersionedCss =
		url.pathname === "/styles/main.css" && url.searchParams.has("v")
	headers.set(
		"Cache-Control",
		isVersionedCss ? "public, max-age=31536000, immutable" : "no-cache",
	)
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	})
}

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100

const server = http.createServer(
	createRequestListener(async (request) => {
		const url = new URL(request.url)
		try {
			return withSecurityHeaders(
				withCacheHeaders(await router.fetch(request), url),
			)
		} catch (error) {
			// formData()'s size limits are never suppressed; they're the client's
			// fault, not ours, so answer 413 without logging a stack trace. The
			// rest of the body is left unread, so the connection can't be reused.
			if (isFormLimitError(error)) {
				return withSecurityHeaders(
					new Response("Payload Too Large", {
						status: 413,
						headers: { connection: "close" },
					}),
				)
			}
			if (!(request.signal.aborted && error === request.signal.reason)) {
				console.error(error)
			}
			return withSecurityHeaders(
				new Response("Internal Server Error", { status: 500 }),
			)
		}
	}),
)

function getLanAddress(): string | undefined {
	for (const ifaces of Object.values(os.networkInterfaces())) {
		for (const iface of ifaces ?? []) {
			if (iface.family === "IPv4" && !iface.internal) return iface.address
		}
	}
}

// Runs here rather than as a Fly release_command: release machines don't
// mount the /data volume, so they can't reach the SQLite file.
await migrate()

// No auto-kill of whatever holds the port (it may be another app's server):
// fail loudly instead.
server.on("error", (error: NodeJS.ErrnoException) => {
	if (error.code !== "EADDRINUSE") throw error
	console.error(`Port ${port} is already in use; stop that server or set PORT.`)
	process.exit(1)
})

server.listen(port, () => {
	console.log(`  Local:   http://localhost:${port}`)
	const lan = getLanAddress()
	if (lan) console.log(`  Network: http://${lan}:${port}`)
	runCleanup().catch(console.error)
	setInterval(() => runCleanup().catch(console.error), CLEANUP_INTERVAL_MS)
})

let shuttingDown = false

function shutdown() {
	if (shuttingDown) {
		return
	}

	shuttingDown = true
	server.close(() => process.exit(0))
	server.closeAllConnections()
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
