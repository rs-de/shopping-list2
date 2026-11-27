/// <reference lib="WebWorker" />

export type {}

declare let self: ServiceWorkerGlobalScope
declare const BUILD_STAMP: string
declare const process: { env: { NODE_ENV: string } }

const IS_DEV = process.env.NODE_ENV === "development"
const CACHE = `sl-v${BUILD_STAMP}`
const PRECACHE_URLS = ["/", "/about", "/changelog"]

// A page that just told the user "a new version is available" and is about
// to navigate to reload wants that one navigation to actually be fresh —
// staleWhileRevalidate would otherwise happily hand back the copy it already
// has and only pick up the new one on the *following* request. Set right
// before the deliberate reload navigation and consumed (deleted) by it.
const forceFreshUrls = new Set<string>()

self.addEventListener("install", (event) => {
	self.skipWaiting()
	// Best-effort warm-up: the static pages, so the first soft navigation to
	// one feels instant, and every script/stylesheet of this release, so a
	// page never has to fetch one of its files on a bad connection (or from a
	// server that already runs the next release, whose URLs differ). Each URL
	// is caught individually — unlike cache.addAll(), one slow/failed fetch
	// (e.g. a cold origin) can't fail the whole install, which is what
	// previously caused a black screen on iOS cold-start.
	event.waitUntil(
		caches.open(CACHE).then(async (cache) => {
			const assets = IS_DEV ? [] : await fetchPrecacheList()
			await Promise.all(
				[...PRECACHE_URLS, ...assets].map((url) =>
					cache.add(url).catch(() => {}),
				),
			)
		}),
	)
})

async function fetchPrecacheList(): Promise<string[]> {
	try {
		const response = await fetch("/api/precache")
		if (!response.ok) return []
		const { assets } = (await response.json()) as { assets: string[] }
		return assets
	} catch {
		return []
	}
}

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

self.addEventListener("message", (event) => {
	if (event.data?.type !== "SL_FORCE_FRESH") return
	forceFreshUrls.add(event.data.url as string)
})

self.addEventListener("fetch", (event) => {
	const { request } = event
	if (request.method !== "GET") return

	const url = new URL(request.url)

	// Scripts and stylesheets: fingerprinted in production (a URL never
	// changes its content) and precached on install, so they never wait for
	// the network — on a weak connection in a shop, network-first stalled
	// every module request for as long as the connection hung.
	const isAppAsset =
		url.pathname.startsWith("/assets/") &&
		!(request.headers.get("accept")?.includes("application/json") ?? false)

	const isStaticAsset =
		isAppAsset ||
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
	if (forceFreshUrls.delete(request.url)) return fetchPromise
	return cached ?? fetchPromise
}

async function cacheFirst(request: Request): Promise<Response> {
	// This release's cache only: an old one may still exist until activation
	// deletes it, and must never answer for the new release.
	const cache = await caches.open(CACHE)
	const cached = await cache.match(request)
	if (cached) return cached
	const response = await fetch(request)
	if (response.ok) cache.put(request, response.clone())
	return response
}

async function networkFirst(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE)
	try {
		const response = await fetch(request)
		// pullFromServer()'s JSON GET shares its URL with the HTML page at the
		// same path — caching it here would clobber that page's cached HTML
		// with JSON on next load. In development, scripts and styles come
		// through here too (cached so offline testing still works).
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
