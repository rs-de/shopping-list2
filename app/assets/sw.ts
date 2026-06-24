/// <reference lib="WebWorker" />

export type {}

declare let self: ServiceWorkerGlobalScope
declare const APP_VERSION: string
declare const process: { env: { NODE_ENV: string } }

const IS_DEV = process.env.NODE_ENV === "development"
const CACHE = `sl-v${APP_VERSION}`

const PRECACHE_URLS = [
	"/styles/main.css",
	"/logo.svg",
	"/favicon.ico",
	"/bg1.webp",
	"/manifest.webmanifest",
	"/icons/apple-icon-180.png",
	"/icons/manifest-icon-192.maskable.png",
	"/icons/manifest-icon-512.maskable.png",
]

self.addEventListener("install", (event) => {
	self.skipWaiting()
	event.waitUntil(
		caches.open(CACHE).then((cache) => cache.addAll(PRECACHE_URLS)),
	)
})

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
				),
			),
	)
	self.clients.claim()
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

	event.respondWith(
		IS_DEV || !isStaticAsset ? networkFirst(request) : cacheFirst(request),
	)
})

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
		if (response.ok) cache.put(request, response.clone())
		return response
	} catch {
		return (
			(await cache.match(request)) ?? new Response("Offline", { status: 503 })
		)
	}
}
