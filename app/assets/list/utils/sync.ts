import type { Handle } from "remix/ui"

import type { Translations } from "../../../i18n.ts"
import type { Article } from "../../../utils/articles.ts"
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
	/**
	 * Generic optimistic PATCH primitive. `apply` computes the next optimistic
	 * `articles` array from the current one and the FormData body to PATCH to
	 * the server; the engine applies it immediately (before the network call
	 * resolves) and reconciles once the server responds.
	 */
	patch(
		apply: (current: Article[]) => { articles: Article[]; body: FormData },
	): Promise<void>
	/** Background reconciliation GET — no-op while dirty. */
	pullFromServer(): Promise<void>
	/** Wires IDB-init, online listener, SW-update toast, install prompt. Call once from handle.queueTask(). */
	init(): void
	getRejigN(): number
	/** Persists to localStorage only — no patch, no dirty. */
	setRejigN(n: number): void
}

export function createSyncEngine(
	handle: Handle<{ listId: string; articles: Article[] }>,
	t: Translations,
	toast: ReturnType<typeof createToast>,
): SyncEngine {
	const listId = handle.props.listId
	let articles: Article[] = [...handle.props.articles]
	let rejigN = 3

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

	async function pullFromServer(): Promise<void> {
		if (dirty || handle.signal.aborted) return
		try {
			const res = await fetch(`/${listId}`, {
				headers: { accept: "application/json" },
				signal: AbortSignal.any([handle.signal, AbortSignal.timeout(8_000)]),
			})
			if (!res.ok || dirty || handle.signal.aborted) return
			const data = (await res.json()) as { articles: Article[] }
			if (dirty || handle.signal.aborted) return
			if (JSON.stringify(data.articles) !== JSON.stringify(articles)) {
				articles = data.articles
				void writeRecord(listId, articles, false).catch(() => {})
				handle.update()
			}
		} catch {
			// network unavailable — IDB is the source of truth
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
					void pullFromServer()
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
					toast.show(t.install_ios, "success", { duration: 8000 })
				} else {
					window.addEventListener(
						"beforeinstallprompt",
						(e) => {
							e.preventDefault()
							localStorage.setItem("sl-install-prompted", "1")
							toast.show(t.install_prompt, "success", {
								action: {
									label: t.install_action,
									onClick: () => {
										;(e as BeforeInstallPromptEvent).prompt()
										toast.dismiss()
									},
								},
							})
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

		navigator.serviceWorker?.addEventListener(
			"message",
			(event: MessageEvent) => {
				if (event.data?.type !== "SW_UPDATED") return
				toast.show(t.sw_updated, "success", {
					action: {
						label: t.sw_reload,
						onClick: () => {
							toast.dismiss()
							window.location.assign(window.location.href)
						},
					},
				})
			},
			{ signal: handle.signal },
		)
	}

	return {
		getArticles: () => articles,
		isDirty: () => dirty,
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
