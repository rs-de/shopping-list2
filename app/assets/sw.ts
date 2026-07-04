/// <reference lib="WebWorker" />

export type {}

declare let self: ServiceWorkerGlobalScope
declare const BUILD_STAMP: string
declare const process: { env: { NODE_ENV: string } }

const IS_DEV = process.env.NODE_ENV === "development"
const CACHE = `sl-v${BUILD_STAMP}`
const PRECACHE_URLS = ["/", "/about", "/changelog"]

self.addEventListener("install", (event) => {
	self.skipWaiting()
	// Best-effort warm-up so the first soft-navigation to a static page feels
	// instant. Each URL is caught individually — unlike cache.addAll(), one
	// slow/failed fetch (e.g. a cold origin) can't fail the whole install,
	// which is what previously caused a black screen on iOS cold-start.
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) =>
				Promise.all(PRECACHE_URLS.map((url) => cache.add(url).catch(() => {}))),
			),
	)
})

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys().then(async (keys) => {
			const oldKeys = keys.filter((k) => k !== CACHE)
			const isUpdate = oldKeys.length > 0
			await Promise.all(oldKeys.map((k) => caches.delete(k)))
			await self.clients.claim()
			if (isUpdate) {
				const clients = await self.clients.matchAll({ type: "window" })
				for (const client of clients) client.postMessage({ type: "SW_UPDATED" })
			}
		}),
	)
})

self.addEventListener("fetch", (event) => {
	const { request } = event
	if (request.method !== "GET") return

	const url = new URL(request.url)

	const isStaticAsset =
		url.pathname.startsWith("/styles/") ||
		url.pathname.startsWith("/icons/") ||
		url.pathname === "/logo.svg" ||
		url.pathname === "/favicon.ico" ||
		url.pathname === "/favicon.svg" ||
		url.pathname === "/bg1.webp" ||
		url.pathname === "/manifest.webmanifest"

	// True browser navigations AND the client router's resolveFrame() fetch
	// (soft page transitions, requested with "accept: text/html") both want
	// cached HTML instantly while revalidating in the background — a link
	// click shouldn't have to wait on the network to feel like it worked.
	const wantsHtml =
		request.mode === "navigate" ||
		(request.headers.get("accept")?.includes("text/html") ?? false)

	event.respondWith(
		IS_DEV
			? networkFirst(request)
			: wantsHtml
				? staleWhileRevalidate(request)
				: isStaticAsset
					? cacheFirst(request)
					: networkFirst(request),
	)
})

async function staleWhileRevalidate(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE)
	const cached = await cache.match(request)
	const fetchPromise = fetch(request)
		.then((response) => {
			if (response.ok) cache.put(request, response.clone())
			return response
		})
		.catch(() => cached ?? new Response("Offline", { status: 503 }))
	return cached ?? fetchPromise
}

async function cacheFirst(request: Request): Promise<Response> {
	const cached = await caches.match(request)
	if (cached) return cached
	const response = await fetch(request)
	if (response.ok) {
		const cache = await caches.open(CACHE)
		cache.put(request, response.clone())
	}
	return response
}

async function networkFirst(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE)
	try {
		const response = await fetch(request)
		// pullFromServer()'s JSON GET shares its URL with the HTML page at the
		// same path — caching it here would clobber that page's cached HTML
		// with JSON on next load. Static assets (JS/CSS modules under
		// /assets/) never share a URL with an HTML page, so they're safe and
		// need to be cached here too — this is what keeps the app usable
		// offline at all, since the JS that hydrates it lives under /assets/.
		const wantsJson = request.headers
			.get("accept")
			?.includes("application/json")
		if (response.ok && !wantsJson) cache.put(request, response.clone())
		return response
	} catch {
		return (
			(await cache.match(request)) ?? new Response("Offline", { status: 503 })
		)
	}
}
