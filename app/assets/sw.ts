/// <reference lib="WebWorker" />

export type {}

declare let self: ServiceWorkerGlobalScope
declare const BUILD_STAMP: string
declare const process: { env: { NODE_ENV: string } }

const IS_DEV = process.env.NODE_ENV === "development"
const CACHE = `sl-v${BUILD_STAMP}`

self.addEventListener("install", () => {
	self.skipWaiting()
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

	const isNavigation = request.mode === "navigate"

	event.respondWith(
		IS_DEV
			? networkFirst(request)
			: isNavigation
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
		const ct = response.headers.get("content-type") ?? ""
		if (response.ok && ct.includes("text/html")) cache.put(request, response.clone())
		return response
	} catch {
		return (
			(await cache.match(request)) ?? new Response("Offline", { status: 503 })
		)
	}
}
