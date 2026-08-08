import type { Handle } from "remix/ui"
import type { Article } from "../../../utils/articles.ts"
import type { Translator } from "../../../utils/i18n.ts"
import type { createToast } from "../../../utils/toast.tsx"

type ListRecord = { id: string; articles: Article[]; dirty: boolean }

let _db: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
	if (_db) return _db
	_db = new Promise((resolve, reject) => {
		const req = indexedDB.open("shopping-list", 2)
		req.onupgradeneeded = () => {
			const db = req.result
			for (const n of Array.from(db.objectStoreNames)) db.deleteObjectStore(n)
			db.createObjectStore("lists", { keyPath: "id" })
		}
		req.onsuccess = () => resolve(req.result)
		req.onerror = () => {
			_db = null
			reject(req.error)
		}
	})
	return _db
}

async function readRecord(listId: string): Promise<ListRecord | null> {
	const db = await openDb()
	return new Promise((resolve, reject) => {
		const req = db.transaction("lists").objectStore("lists").get(listId)
		req.onsuccess = () =>
			resolve((req.result as ListRecord | undefined) ?? null)
		req.onerror = () => reject(req.error)
	})
}

async function writeRecord(
	listId: string,
	articles: Article[],
	dirty: boolean,
): Promise<void> {
	const db = await openDb()
	return new Promise((resolve, reject) => {
		const tx = db.transaction("lists", "readwrite")
		tx.objectStore("lists").put({ id: listId, articles, dirty })
		tx.oncomplete = () => resolve()
		tx.onerror = () => reject(tx.error)
	})
}

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>
}

export interface SyncEngine {
	getArticles(): Article[]
	isDirty(): boolean
	/** True while a blocking freshness check (first load or stale resume, see `init`) is in flight. */
	isChecking(): boolean
	/**
	 * Generic optimistic PATCH primitive. `apply` computes the next optimistic
	 * `articles` array from the current one and the FormData body to PATCH to
	 * the server; the engine applies it immediately (before the network call
	 * resolves) and reconciles once the server responds.
	 */
	patch(
		apply: (current: Article[]) => { articles: Article[]; body: FormData },
	): Promise<void>
	/**
	 * Background reconciliation GET — no-op while dirty. "offline" covers any
	 * failure to reach the server at all (no connection, timeout) — expected
	 * and silent, since IDB stays the source of truth; "error" is a real
	 * response from the server signaling failure, worth telling the user.
	 */
	pullFromServer(): Promise<"ok" | "offline" | "error">
	/** Wires IDB-init, online listener, SW-update toast, install prompt. Call once from handle.queueTask(). */
	init(): void
	getRejigN(): number
	/** Persists to localStorage only — no patch, no dirty. */
	setRejigN(n: number): void
}

export function createSyncEngine(
	handle: Handle<{ listId: string; articles: Article[] }>,
	t: Translator,
	toast: ReturnType<typeof createToast>,
): SyncEngine {
	const listId = handle.props.listId
	// Timestamp (ms) of the last confirmed server round trip (a successful
	// verify, patch, or dirty-drain) — persisted in localStorage so it
	// survives the app being killed and relaunched, not just a tab session.
	// Gates only the first-load blocking check in init() (see isStale()) —
	// resume-from-background (visibilitychange) never blocks, it always
	// reconciles silently, so this only needs to catch "was this app truly
	// closed for a while", not routine backgrounding while in active use.
	const CHECKED_KEY = `sl-checked:${listId}`
	const STALE_MS = 30 * 60 * 1000
	let articles: Article[] = [...handle.props.articles]
	let rejigN = 3
	let checking = false

	// dirty: true when local articles diverge from server state
	// dirtyGen: incremented on every dirty write — lets drainDirty detect
	//           if new changes arrived while its fetch was in flight
	let dirty = false
	let dirtyGen = 0
	let inFlight = 0
	let patchAbort: AbortController | null = null
	let retryDelay = 3_000
	let retryTimer: ReturnType<typeof setTimeout> | null = null

	handle.signal.addEventListener("abort", () => clearRetry())

	function markDirty() {
		dirty = true
		dirtyGen++
	}

	function markChecked() {
		localStorage.setItem(CHECKED_KEY, String(Date.now()))
	}

	function isStale(): boolean {
		const last = Number(localStorage.getItem(CHECKED_KEY))
		return !last || Date.now() - last > STALE_MS
	}

	function notifyVerifyFailed() {
		toast.show(
			t(
				"An error occurred while loading the data. Please try again in a few seconds. If the problem persists, please contact us.",
			),
			"error",
			{ duration: 5000 },
		)
	}

	function scheduleRetry() {
		if (retryTimer !== null || handle.signal.aborted) return
		if (!navigator.onLine) return // online event will trigger drainDirty
		retryTimer = setTimeout(() => {
			retryTimer = null
			void drainDirty().catch(() => {})
		}, retryDelay)
		retryDelay = Math.min(retryDelay * 2, 30_000)
	}

	function clearRetry() {
		if (retryTimer !== null) {
			clearTimeout(retryTimer)
			retryTimer = null
		}
		retryDelay = 3_000
	}

	async function pullFromServer(): Promise<"ok" | "offline" | "error"> {
		if (dirty || handle.signal.aborted) return "ok"
		try {
			const res = await fetch(`/${listId}`, {
				headers: { accept: "application/json" },
				signal: AbortSignal.any([handle.signal, AbortSignal.timeout(8_000)]),
			})
			if (dirty || handle.signal.aborted) return "ok"
			if (!res.ok) return "error"
			const data = (await res.json()) as { articles: Article[] }
			if (dirty || handle.signal.aborted) return "ok"
			if (JSON.stringify(data.articles) !== JSON.stringify(articles)) {
				articles = data.articles
				void writeRecord(listId, articles, false).catch(() => {})
				handle.update()
			}
			markChecked()
			return "ok"
		} catch {
			// no connection or timed out reaching the server — IDB is the source of truth
			return "offline"
		}
	}

	async function drainDirty(): Promise<void> {
		if (!dirty) return
		// Snapshot current state and generation before the async fetch
		const gen = dirtyGen
		const snapshot = [...articles]
		try {
			const fd = new FormData()
			fd.set("_action", "replaceArticles")
			fd.set("articles", JSON.stringify(snapshot))
			const res = await fetch(`/${listId}`, { method: "PATCH", body: fd })
			if (!res.ok) {
				scheduleRetry()
				return
			}
			await res.json() // consume body
			if (dirtyGen !== gen) {
				// New changes arrived during the fetch — retry with latest state
				scheduleRetry()
				return
			}
			dirty = false
			articles = snapshot
			clearRetry()
			markChecked()
			void writeRecord(listId, articles, false).catch(() => {})
		} catch {
			scheduleRetry()
			return
		}
	}

	async function patch(
		apply: (current: Article[]) => { articles: Article[]; body: FormData },
	): Promise<void> {
		const { articles: next, body } = apply(articles)
		articles = next
		handle.update()

		patchAbort?.abort()
		patchAbort = new AbortController()
		const ownSignal = patchAbort.signal
		inFlight++
		// Two requests in flight means responses may arrive out of order.
		// Mark dirty immediately so all responses are discarded and drainDirty
		// reconciles the final state via replaceArticles.
		if (inFlight > 1) markDirty()
		try {
			const res = await fetch(`/${listId}`, {
				method: "PATCH",
				body,
				signal: AbortSignal.any([handle.signal, ownSignal]),
			})
			if (!res.ok) throw new Error("Server error")
			const updated = (await res.json()) as { articles: Article[] }
			inFlight--
			if (inFlight === 0) {
				if (
					!dirty ||
					JSON.stringify(updated.articles) === JSON.stringify(articles)
				) {
					dirty = false
					clearRetry()
					markChecked()
					articles = updated.articles
					void writeRecord(listId, articles, false).catch(() => {})
				} else {
					void writeRecord(listId, articles, true).catch(() => {})
					scheduleRetry()
				}
			}
		} catch {
			inFlight--
			if (ownSignal.aborted) {
				// Superseded — dirty already set above, newer patch handles retry
				handle.update()
				return
			}
			if (!handle.signal.aborted) {
				markDirty()
				void writeRecord(listId, articles, true).catch(() => {})
				scheduleRetry()
			}
		}
		handle.update()
	}

	function init(): void {
		localStorage.setItem("shoppingListId", listId)
		const savedRejigN = Number(localStorage.getItem("rejigN"))
		if ([3, 5, 7].includes(savedRejigN)) rejigN = savedRejigN

		// IDB init: only unsynced (dirty) local edits take priority over fresh
		// SSR props — a non-dirty IDB snapshot can be arbitrarily stale (e.g.
		// another device changed the list since), so it must never replace
		// the server current state. pullFromServer() still corrects for
		// SW-cached stale HTML on navigation.
		void (async () => {
			if (handle.signal.aborted) return
			try {
				const saved = await readRecord(listId)
				if (saved?.dirty && !handle.signal.aborted) {
					articles = saved.articles
					markDirty()
					scheduleRetry()
				} else if (!handle.signal.aborted) {
					await writeRecord(listId, articles, false)
					// Regardless of whether this exact page came from network or a
					// stale SW cache, a first load more than STALE_MS since the last
					// confirmed check means the shown articles are unverified: block
					// on a real check instead of silently reconciling in the
					// background, so the user always sees that a wait is happening
					// (matches the visibilitychange resume check below).
					const mustVerify = isStale()
					if (mustVerify && !handle.signal.aborted) {
						checking = true
						handle.update()
						const result = await pullFromServer()
						checking = false
						if (result === "error" && !handle.signal.aborted)
							notifyVerifyFailed()
					} else {
						void pullFromServer()
					}
				}
			} catch {
				// IDB unavailable — server state is fine
			}
			if (!handle.signal.aborted) handle.update()
			// Test hook: fires once the IDB-init decision (dirty vs. fresh-SSR)
			// has been applied, so tests can wait for this instead of guessing
			// a fixed delay for what is otherwise a fast but async IDB round trip.
			window.dispatchEvent(new Event("sl:sync-ready"))
		})()

		// Homescreen install prompt
		if (!localStorage.getItem("sl-install-prompted")) {
			const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
			const isStandalone =
				(navigator as Navigator & { standalone?: boolean }).standalone ===
					true || window.matchMedia("(display-mode: standalone)").matches
			if (!isStandalone) {
				if (isIOS) {
					localStorage.setItem("sl-install-prompted", "1")
					toast.show(t('Tap Share ⬆ then "Add to Home Screen"'), "success", {
						duration: 8000,
					})
				} else {
					window.addEventListener(
						"beforeinstallprompt",
						(e) => {
							e.preventDefault()
							localStorage.setItem("sl-install-prompted", "1")
							toast.show(
								t("Add to your homescreen for quick access"),
								"success",
								{
									action: {
										label: t("Install"),
										onClick: () => {
											;(e as BeforeInstallPromptEvent).prompt()
											toast.dismiss()
										},
									},
								},
							)
						},
						{ once: true, signal: handle.signal },
					)
				}
			}
		}

		window.addEventListener(
			"online",
			() => {
				clearRetry() // reset backoff on genuine reconnect
				void drainDirty().catch(() => {})
			},
			{ signal: handle.signal },
		)

		// App resumed (e.g. tab un-backgrounded while shopping). Dirty edits
		// are already covered by the online listener/retry loop; otherwise
		// reconcile silently — this fires far too often during normal use
		// (screen lock, app-switch) and often on flaky in-store networks to
		// ever block the list on it. Only a genuine first load (init(), gated
		// on isStale()) is loud enough to show the blocking verify spinner.
		document.addEventListener(
			"visibilitychange",
			() => {
				if (document.visibilityState !== "visible" || dirty) return
				void pullFromServer()
			},
			{ signal: handle.signal },
		)
	}

	return {
		getArticles: () => articles,
		isDirty: () => dirty,
		isChecking: () => checking,
		patch,
		pullFromServer,
		init,
		getRejigN: () => rejigN,
		setRejigN: (n) => {
			rejigN = n
			localStorage.setItem("rejigN", String(n))
		},
	}
}

/** Shared by articles + plan mode (not shopping — no text editing there). */
export function createTextEditHandler(sync: SyncEngine, signal: AbortSignal) {
	const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
	signal.addEventListener("abort", () => {
		for (const timer of debounceTimers.values()) clearTimeout(timer)
	})

	function patchChange(articleId: string, text: string): void {
		const fd = new FormData()
		fd.set("_action", "changeArticle")
		fd.set("id", articleId)
		fd.set("text", text)
		void sync.patch((current) => ({
			articles: current.map((a) => (a.id === articleId ? { ...a, text } : a)),
			body: fd,
		}))
	}

	function scheduleChange(articleId: string, text: string): void {
		clearTimeout(debounceTimers.get(articleId))
		debounceTimers.set(
			articleId,
			setTimeout(() => {
				debounceTimers.delete(articleId)
				patchChange(articleId, text)
			}, 750),
		)
	}

	function flushChange(articleId: string, text: string): void {
		clearTimeout(debounceTimers.get(articleId))
		debounceTimers.delete(articleId)
		patchChange(articleId, text)
	}

	return { scheduleChange, flushChange }
}

/** Shared by all three modes. */
export function createDeleteHandler(sync: SyncEngine) {
	async function deleteSelected(ids: string[]): Promise<void> {
		if (!ids.length) return
		const fd = new FormData()
		fd.set("_action", "deleteArticles")
		for (const id of ids) fd.append("selected", id)
		await sync.patch((current) => ({
			articles: current.filter((a) => !ids.includes(a.id)),
			body: fd,
		}))
	}

	return { deleteSelected }
}
