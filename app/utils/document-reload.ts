// Remix's runtime intercepts same-origin navigations through the Navigation
// API — including `location.reload()` — and turns them into in-place frame
// reloads that keep the current JavaScript running. Applying a new app
// version needs a real document load, or the old code keeps running. Remix
// documents opting out by stopping the `navigate` event before its own
// listener sees it; this does that only for navigations marked with this
// info value.
const DOCUMENT_RELOAD = "shopping-list-document-reload"

/** Must run before Remix's `run()` registers its own `navigate` listener. */
export function keepDocumentReloads(): void {
	window.navigation?.addEventListener("navigate", (event) => {
		if (event.info === DOCUMENT_RELOAD) event.stopImmediatePropagation()
	})
}

/** A full page reload that Remix's frame navigation leaves to the browser. */
export function reloadDocument(): void {
	// Without the Navigation API, Remix doesn't intercept anything.
	if (window.navigation) window.navigation.reload({ info: DOCUMENT_RELOAD })
	else window.location.reload()
}

/** Whether the focused field holds text the user typed but hasn't saved. */
export function hasUnsavedInput(): boolean {
	const active = document.activeElement
	return (
		(active instanceof HTMLInputElement ||
			active instanceof HTMLTextAreaElement) &&
		active.value !== active.defaultValue
	)
}
