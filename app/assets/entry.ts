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

// Whether the SW has told us a new version activated behind the scenes.
// In-memory only: a real reload picks up the new version directly via the
// SW's own precache, and a bfcache restore (the case this exists for)
// keeps JS state intact, so nothing needs to survive a fresh script load.
let updatePending = false

if ("serviceWorker" in navigator) {
	// iOS Safari can serve a stale cached copy of /sw.js for its own update
	// comparison fetch, silently never detecting a new worker. A per-deploy
	// query string forces that fetch to be a genuinely new URL each time.
	navigator.serviceWorker.register(`/sw.js?v=${BUILD_STAMP}`, {
		type: "module",
	})
	navigator.serviceWorker.addEventListener("message", (event) => {
		if (event.data?.type === "SW_UPDATED") updatePending = true
	})
}

// Apply a pending update only once the user comes back to the app — never
// mid-session, so it never interrupts an active edit or navigation. Users
// are wary of an explicit "Refresh" prompt; this makes the update invisible.
document.addEventListener("visibilitychange", () => {
	if (document.visibilityState !== "visible" || !updatePending) return
	updatePending = false
	navigator.serviceWorker?.controller?.postMessage({
		type: "SL_FORCE_FRESH",
		url: window.location.href,
	})
	window.location.reload()
})
