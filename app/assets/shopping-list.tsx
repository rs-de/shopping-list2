import { clientEntry, type Handle, on, ref } from "remix/ui"

import type { Translations } from "../i18n.ts"
import { generateId } from "../utils/id.ts"
import { moveArticles } from "../utils/moveArticles.ts"

type Article = { id: string; text: string }
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

export const ShoppingListApp = clientEntry(
	import.meta.url,
	function ShoppingListApp(
		handle: Handle<{ listId: string; articles: Article[]; t: Translations }>,
	) {
		const listId = handle.props.listId
		let articles: Article[] = [...handle.props.articles]
		const { t } = handle.props
		let selected = new Set<string>()
		let syncError = false
		let clearOpen = false
		let helpOpen = false
		const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
		let addInputEl: HTMLInputElement | null = null
		let rejigN = 3
		let rejigAnchorEl: HTMLElement | null = null

		// dirty: true when local articles diverge from server state
		// dirtyGen: incremented on every dirty write — lets drainDirty detect
		//           if new changes arrived while its fetch was in flight
		let dirty = false
		let dirtyGen = 0
		let inFlight = 0
		let patchAbort: AbortController | null = null
		let retryDelay = 3_000
		let retryTimer: ReturnType<typeof setTimeout> | null = null

		handle.signal.addEventListener("abort", () => {
			for (const t of debounceTimers.values()) clearTimeout(t)
			clearRetry()
		})

		function markDirty() {
			dirty = true
			dirtyGen++
		}

		function scheduleRetry() {
			if (retryTimer !== null || handle.signal.aborted) return
			retryTimer = setTimeout(() => {
				retryTimer = null
				void drainDirty().catch(() => {})
			}, retryDelay)
			retryDelay = Math.min(retryDelay * 2, 30_000)
			if (retryDelay >= 12_000 && navigator.onLine && !syncError) {
				syncError = true
				handle.update()
			}
		}

		function clearRetry() {
			if (retryTimer !== null) {
				clearTimeout(retryTimer)
				retryTimer = null
			}
			retryDelay = 3_000
			if (syncError) {
				syncError = false
				handle.update()
			}
		}

		handle.queueTask(() => {
			localStorage.setItem("shoppingListId", listId)

			// IDB init: if dirty, restore local state and start retry; else seed IDB
			void (async () => {
				if (handle.signal.aborted) return
				try {
					const saved = await readRecord(listId)
					if (saved?.dirty && !handle.signal.aborted) {
						markDirty()
						articles = saved.articles
						handle.update()
						scheduleRetry()
					} else {
						await writeRecord(listId, articles, false)
					}
				} catch {
					// IDB unavailable — server state is fine
				}
			})()

			window.addEventListener(
				"online",
				() => {
					clearRetry() // reset backoff on genuine reconnect
					void drainDirty().catch(() => {})
				},
				{ signal: handle.signal },
			)

			window.addEventListener(
				"offline",
				() => {
					if (syncError) {
						syncError = false
						handle.update()
					}
				},
				{ signal: handle.signal },
			)
		})

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
			// nothing to re-render on drain success — clearRetry() handles syncError
		}

		async function patch(body: FormData): Promise<void> {
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

		function scheduleChange(articleId: string, text: string) {
			clearTimeout(debounceTimers.get(articleId))
			debounceTimers.set(
				articleId,
				setTimeout(() => {
					const fd = new FormData()
					fd.set("_action", "changeArticle")
					fd.set("id", articleId)
					fd.set("text", text)
					patch(fd)
				}, 750),
			)
		}

		async function addArticle() {
			const text = addInputEl?.value.trim() ?? ""
			if (!text) return
			const id = generateId()
			const fd = new FormData()
			fd.set("_action", "addArticle")
			fd.set("id", id)
			fd.set("new", text)
			articles = [...articles, { id, text }]
			if (addInputEl) addInputEl.value = ""
			await handle.update()
			addInputEl?.focus()
			await patch(fd)
		}

		async function deleteSelected() {
			const ids = [...selected]
			if (!ids.length) return
			const fd = new FormData()
			fd.set("_action", "deleteArticles")
			for (const id of ids) fd.append("selected", id)
			articles = articles.filter((a) => !selected.has(a.id))
			selected = new Set()
			handle.update()
			await patch(fd)
		}

		async function clearList() {
			const fd = new FormData()
			fd.set("_action", "clearList")
			articles = []
			selected = new Set()
			clearOpen = false
			handle.update()
			await patch(fd)
		}

		async function rejig(partitionNumber: number) {
			const ids = [...selected]
			if (!ids.length) return
			const fd = new FormData()
			fd.set("_action", "rejig")
			for (const id of ids) fd.append("selected", id)
			fd.set("partitionNumber", String(partitionNumber))
			fd.set("partitionCount", String(rejigN))
			articles = moveArticles({
				idsToRejig: ids,
				partitionNumber,
				partitionCount: rejigN,
				articles,
			})
			selected = new Set()
			handle.update()
			await patch(fd)
		}

		async function share() {
			const url = location.href
			try {
				if (navigator.share) {
					await navigator.share({ url, title: t.ShoppingList })
				} else {
					await navigator.clipboard.writeText(url)
				}
			} catch {
				// user cancelled or API unavailable
			}
		}

		return () => {
			const showDelete = selected.size > 0
			const showRejig = selected.size > 0 && articles.length > 5
			const rejigMid = Math.ceil(rejigN / 2)
			const rejigButtons = Array.from({ length: rejigN }, (_, i) => {
				const partition = i + 1
				const labelKey =
					partition === 1
						? "pickupTime_early"
						: partition === rejigMid
							? "pickupTime_medium"
							: partition === rejigN
								? "pickupTime_late"
								: null
				return (
					<button
						key={String(partition)}
						class={`btn btn-secondary sl-rejig-btn${labelKey ? "" : " sl-rejig-btn--dot"}`}
						type="button"
						mix={on("click", () => rejig(partition))}
					>
						{labelKey ? t[labelKey] : ""}
					</button>
				)
			})

			return (
				<div class="sl-app">
					<h1 class="sl-heading">{t.ShoppingList}</h1>

					<div class="sl-card">
						{articles.length > 0 && (
							<ul
								class="sl-list"
								mix={ref((node) => {
									rejigAnchorEl = (node as HTMLElement).querySelector("li")
								})}
							>
								{articles.map((article) => (
									<li
										key={article.id}
										class={`sl-item${selected.has(article.id) ? " sl-item--checked" : ""}`}
									>
										<input
											type="text"
											class="sl-item-input"
											maxLength={75}
											autoComplete="off"
											enterKeyHint="done"
											aria-label="Article text"
											mix={[
												ref((node) => {
													;(node as HTMLInputElement).value = article.text
												}),
												on("input", (e) => {
													scheduleChange(
														article.id,
														(e.currentTarget as HTMLInputElement).value,
													)
												}),
											]}
										/>
										<input
											type="checkbox"
											aria-label="Select article"
											checked={selected.has(article.id)}
											mix={on("change", (e) => {
												const checked = (e.currentTarget as HTMLInputElement)
													.checked
												if (checked) {
													selected = new Set([...selected, article.id])
												} else {
													selected = new Set(
														[...selected].filter((id) => id !== article.id),
													)
												}
												handle.update()
											})}
										/>
									</li>
								))}
							</ul>
						)}

						<div class="sl-add-form">
							<span class="sl-add-icon" aria-hidden="true">
								<svg
									viewBox="0 0 20 20"
									fill="currentColor"
									width="24"
									height="24"
									aria-hidden="true"
								>
									<path
										fill-rule="evenodd"
										d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
										clip-rule="evenodd"
									/>
								</svg>
							</span>
							<input
								type="text"
								class="sl-add-input"
								placeholder={t.input_article_to_add}
								maxLength={75}
								autoComplete="off"
								enterKeyHint="go"
								aria-label="New article"
								mix={[
									ref((node) => {
										addInputEl = node as HTMLInputElement
									}),
									on("keydown", async (e) => {
										if (e.key === "Enter") {
											e.preventDefault()
											await addArticle()
										}
									}),
								]}
							/>
						</div>

						<div class="sl-actions">
							<button
								class="btn btn-primary sl-add-btn"
								type="button"
								mix={on("click", addArticle)}
							>
								{t.Add}
							</button>
							{articles.length > 0 && (
								<button
									class="btn btn-secondary"
									type="button"
									mix={on("click", () => {
										clearOpen = true
										handle.update()
									})}
								>
									{t.clearList}
								</button>
							)}
							<button
								class="btn btn-secondary"
								type="button"
								mix={on("click", share)}
							>
								<svg
									width="20"
									height="20"
									viewBox="0 0 50 50"
									xmlns="http://www.w3.org/2000/svg"
									fill="currentColor"
									aria-hidden="true"
								>
									<path d="M30.3 13.7L25 8.4l-5.3 5.3-1.4-1.4L25 5.6l6.7 6.7z" />
									<path d="M24 7h2v21h-2z" />
									<path d="M35 40H15c-1.7 0-3-1.3-3-3V19c0-1.7 1.3-3 3-3h7v2h-7c-.6 0-1 .4-1 1v18c0 .6.4 1 1 1h20c.6 0 1-.4 1-1V19c0-.6-.4-1-1-1h-7v-2h7c1.7 0 3 1.3 3 3v18c0 1.7-1.3 3-3 3z" />
								</svg>
								{t["copy-link"]}
							</button>
						</div>

					</div>

					{showRejig && (
						<div
							class="sl-rejig"
							key="rejig"
							mix={ref((node) => {
								if (!node) return
								const r = rejigAnchorEl?.getBoundingClientRect()
								if (r) {
									;(node as HTMLElement).style.left = `${r.right - 170}px`
									;(node as HTMLElement).style.top = `${r.top - 35}px`
								}
							})}
						>
							<button
								class="sl-rejig-help"
								type="button"
								aria-label="What is rejig?"
								mix={on("click", () => {
									helpOpen = !helpOpen
									handle.update()
								})}
							>
								?
							</button>
							{helpOpen && (
								<div class="sl-rejig-help-panel" key="help-panel">
									{t.rejig_description}
								</div>
							)}
							<select
								class="sl-rejig-select"
								mix={ref((node) => {
									;(node as HTMLSelectElement).addEventListener(
										"change",
										(e) => {
											rejigN = Number(
												(e.currentTarget as HTMLSelectElement).value,
											)
											handle.update()
										},
										{ signal: handle.signal },
									)
								})}
							>
								<option value="3" selected={rejigN === 3}>
									3
								</option>
								<option value="5" selected={rejigN === 5}>
									5
								</option>
								<option value="7" selected={rejigN === 7}>
									7
								</option>
							</select>
							{rejigButtons}
						</div>
					)}

					<div
						class={`sl-delete-bar${showDelete ? " sl-delete-bar--visible" : ""}`}
					>
						<button
							class="btn btn-primary sl-delete-btn"
							type="button"
							mix={on("click", deleteSelected)}
						>
							<svg
								viewBox="0 0 20 20"
								fill="currentColor"
								width="20"
								height="20"
								aria-hidden="true"
							>
								<path
									fill-rule="evenodd"
									d="M6.707 4.879A3 3 0 018.828 4H15a3 3 0 013 3v6a3 3 0 01-3 3H8.828a3 3 0 01-2.12-.879l-4.415-4.414a1 1 0 010-1.414l4.414-4.414zm4 2.414a1 1 0 00-1.414 1.414L10.586 10l-1.293 1.293a1 1 0 101.414 1.414L12 11.414l1.293 1.293a1 1 0 001.414-1.414L13.414 10l1.293-1.293a1 1 0 00-1.414-1.414L12 8.586l-1.293-1.293z"
									clip-rule="evenodd"
								/>
							</svg>
							{t.delete_selected_articles} ({selected.size})
						</button>
					</div>

					<div
						class={`sl-dialog-overlay${clearOpen ? " sl-dialog-overlay--visible" : ""}`}
					>
						<div class="sl-dialog">
							<h2 class="sl-dialog-title">{t.clearList}</h2>
							<p>{t["clearList-confirm"]}</p>
							<div class="sl-dialog-actions">
								<button
									class="btn btn-secondary"
									type="button"
									mix={on("click", () => {
										clearOpen = false
										handle.update()
									})}
								>
									{t.cancel}
								</button>
								<button
									class="btn btn-primary"
									type="button"
									mix={on("click", clearList)}
								>
									{t.clearList}
								</button>
							</div>
						</div>
					</div>

					{syncError && (
						<div class="sl-toast sl-toast--error" role="alert">
							{t.sync_error}
						</div>
					)}
				</div>
			)
		}
	},
)
