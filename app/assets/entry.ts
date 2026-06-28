import { run } from "remix/ui"

run({
	async loadModule(moduleUrl, exportName) {
		const mod = await import(moduleUrl)
		return mod[exportName]
	},
	async resolveFrame(src, signal, target) {
		const headers = new Headers({ accept: "text/html" })
		const lang = document.documentElement.lang
		if (lang) headers.set("accept-language", lang)
		if (target) headers.set("x-remix-target", target)
		const response = await fetch(src, { headers, signal })
		return response.body ?? (await response.text())
	},
})

if ("serviceWorker" in navigator) {
	navigator.serviceWorker.register("/sw.js", { type: "module" })
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
	btn.addEventListener("click", () => window.location.assign(window.location.href))
	el.append(span, btn)
	document.body.prepend(el)
}

void checkVersion()
document.addEventListener("visibilitychange", () => {
	if (document.visibilityState === "visible") void checkVersion()
})
