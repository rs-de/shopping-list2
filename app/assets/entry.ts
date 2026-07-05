import { run } from "remix/ui"

declare const BUILD_STAMP: string

// A soft navigation suppresses the browser's own loading UI, so on a slow
// network (e.g. a Fly.io cold start) a click can look completely frozen for
// several seconds with zero feedback. Show a spinner overlay, but only after
// a short delay, so fast navigations on a warm connection don't flicker.
const NAV_OVERLAY_DELAY_MS = 200

function showNavOverlay(): void {
	document
		.getElementById("sl-nav-overlay")
		?.classList.add("sl-nav-overlay--visible")
}

function hideNavOverlay(): void {
	document
		.getElementById("sl-nav-overlay")
		?.classList.remove("sl-nav-overlay--visible")
}

run({
	async loadModule(moduleUrl, exportName) {
		const mod = await import(moduleUrl)
		return mod[exportName]
	},
	async resolveFrame(src, signal, target) {
		const overlayTimer = setTimeout(showNavOverlay, NAV_OVERLAY_DELAY_MS)
		try {
			const headers = new Headers({ accept: "text/html" })
			const lang = document.documentElement.lang
			if (lang) headers.set("accept-language", lang)
			if (target) headers.set("x-remix-target", target)
			const response = await fetch(src, { headers, signal })
			return response.body ?? (await response.text())
		} finally {
			clearTimeout(overlayTimer)
			hideNavOverlay()
		}
	},
})

if ("serviceWorker" in navigator) {
	// iOS Safari can serve a stale cached copy of /sw.js for its own update
	// comparison fetch, silently never detecting a new worker. A per-deploy
	// query string forces that fetch to be a genuinely new URL each time.
	navigator.serviceWorker.register(`/sw.js?v=${BUILD_STAMP}`, {
		type: "module",
	})
}

// Version check: show reload banner when a new deployment is detected
const VERSION_KEY = "sl-version"
let _knownVersion: string | null = localStorage.getItem(VERSION_KEY)

async function checkVersion(): Promise<void> {
	try {
		const res = await fetch("/api/version")
		if (!res.ok) return
		const { version } = (await res.json()) as { version: string }
		if (_knownVersion === null) {
			_knownVersion = version
			localStorage.setItem(VERSION_KEY, version)
		} else if (_knownVersion !== version) {
			showUpdateBanner(version)
		}
	} catch {
		// network unavailable — ignore
	}
}

function showUpdateBanner(newVersion: string): void {
	if (document.getElementById("sl-update-banner")) return
	localStorage.setItem(VERSION_KEY, newVersion)
	const el = document.createElement("div")
	el.id = "sl-update-banner"
	el.className = "sl-update-banner"
	const span = document.createElement("span")
	span.textContent = "A new version is available."
	const btn = document.createElement("button")
	btn.textContent = "Reload"
	btn.addEventListener("click", () =>
		window.location.assign(window.location.href),
	)
	el.append(span, btn)
	document.body.prepend(el)
}

void checkVersion()
document.addEventListener("visibilitychange", () => {
	if (document.visibilityState === "visible") void checkVersion()
})
