import * as http from "node:http"
import * as os from "node:os"
import * as path from "node:path"
import { createRequestListener } from "remix/node-fetch-server"

import { db } from "./app/db.ts"
import { router } from "./app/router.ts"

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000
const STALE_THRESHOLD_DAYS = 90

async function runCleanup() {
	const cutoff = new Date(
		Date.now() - STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000,
	)
	const { count } = await db.shoppingList.deleteMany({
		where: { updatedAt: { lt: cutoff } },
	})
	if (count > 0) console.log(`Cleanup: removed ${count} stale list(s)`)
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

function withSecurityHeaders(response: Response): Response {
	const headers = new Headers(response.headers)
	headers.set(
		"Content-Security-Policy",
		"default-src 'self'; frame-ancestors 'none'",
	)
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
			if (!(request.signal.aborted && error === request.signal.reason)) {
				console.error(error)
			}
			return new Response("Internal Server Error", { status: 500 })
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
