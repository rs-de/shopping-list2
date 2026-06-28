import { clientEntry, type Handle, on, ref } from "remix/ui"

import type { Translations } from "../i18n.ts"
import { type Article, sortArticles } from "../utils/articles.ts"
import { generateId } from "../utils/id.ts"
import { createToast } from "../utils/toast.tsx"

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

export const ShoppingListApp = clientEntry(
	import.meta.url,
	function ShoppingListApp(
		handle: Handle<{
			listId: string
			articles: Article[]
			t: Translations
			nextId: string
		}>,
	) {
		const listId = handle.props.listId
		let articles: Article[] = [...handle.props.articles]
		const { t } = handle.props
		let selected = new Set<string>()
		let clearDialogEl: HTMLDialogElement | null = null
		let helpOpen = false
		const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
		let addInputEl: HTMLInputElement | null = null
		let nextId = handle.props.nextId
		let rejigN = 3
		let hasShare = false

		// dirty: true when local articles diverge from server state
		// dirtyGen: incremented on every dirty write — lets drainDirty detect
		//           if new changes arrived while its fetch was in flight
		let dirty = false
		let dirtyGen = 0
		let inFlight = 0
		let patchAbort: AbortController | null = null
		let retryDelay = 3_000
		let retryTimer: ReturnType<typeof setTimeout> | null = null

		const toast = createToast(() => handle.update(), handle.signal)

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

		handle.queueTask(() => {
			hasShare = Boolean(navigator.share)
			localStorage.setItem("shoppingListId", listId)
			const savedRejigN = Number(localStorage.getItem("rejigN"))
			if ([3, 5, 7].includes(savedRejigN)) rejigN = savedRejigN

			// IDB init: if dirty, restore local state and start retry; else seed IDB
			void (async () => {
				if (handle.signal.aborted) return
				try {
					const saved = await readRecord(listId)
					if (saved?.dirty && !handle.signal.aborted) {
						markDirty()
						articles = saved.articles
						scheduleRetry()
					} else {
						await writeRecord(listId, articles, false)
					}
				} catch {
					// IDB unavailable — server state is fine
				}
				if (!handle.signal.aborted) handle.update()
			})()

			// Homescreen install prompt
			if (!localStorage.getItem("sl-install-prompted")) {
				const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
				const isStandalone =
					(navigator as Navigator & { standalone?: boolean }).standalone === true ||
					window.matchMedia("(display-mode: standalone)").matches
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
							onClick: () => location.reload(),
						},
					})
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

		function patchChange(articleId: string, text: string) {
			const fd = new FormData()
			fd.set("_action", "changeArticle")
			fd.set("id", articleId)
			fd.set("text", text)
			patch(fd)
		}

		function scheduleChange(articleId: string, text: string) {
			clearTimeout(debounceTimers.get(articleId))
			debounceTimers.set(
				articleId,
				setTimeout(() => {
					debounceTimers.delete(articleId)
					patchChange(articleId, text)
				}, 750),
			)
		}

		async function addArticle() {
			const text = addInputEl?.value.trim() ?? ""
			if (!text) return
			const id = nextId
			nextId = generateId()
			const createdAt = Date.now()
			const fd = new FormData()
			fd.set("_action", "addArticle")
			fd.set("id", id)
			fd.set("new", text)
			fd.set("sortKey", String(rejigN))
			fd.set("createdAt", String(createdAt))
			articles = sortArticles([
				...articles,
				{ id, text, sortKey: rejigN, createdAt },
			])
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
			articles = sortArticles(
				articles.map((a) =>
					ids.includes(a.id) ? { ...a, sortKey: partitionNumber } : a,
				),
			)
			selected = new Set()
			handle.update()
			await patch(fd)
		}

		async function share() {
			const url = location.href
			if (hasShare) {
				try {
					await navigator.share({ url, title: t.ShoppingList })
				} catch {
					/* cancelled */
				}
				return
			}
			let copied = false
			if (navigator.clipboard) {
				try {
					await navigator.clipboard.writeText(url)
					copied = true
				} catch {
					/* fall through */
				}
			}
			if (!copied) {
				// fallback for non-secure contexts (HTTP on local network)
				const el = document.createElement("input")
				el.style.cssText = "position:fixed;opacity:0"
				el.value = url
				document.body.appendChild(el)
				el.select()
				copied = document.execCommand("copy")
				document.body.removeChild(el)
			}
			if (copied) toast.show(t.copied)
		}

		return () => {
			const showDelete = selected.size > 0
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
						type="submit"
						form="articles-form"
						name="partitionNumber"
						value={String(partition)}
					>
						{labelKey ? t[labelKey] : ""}
					</button>
				)
			})

			return (
				<div class="sl-app">
					<h1 class="sl-heading">{t.ShoppingList}</h1>

					<div class="sl-card">
						<form
							id="articles-form"
							method="post"
							mix={on<HTMLFormElement>("submit", async (e) => {
								e.preventDefault()
								const submitter = (e as unknown as SubmitEvent)
									.submitter as HTMLButtonElement | null
								if (submitter?.name === "partitionNumber") {
									await rejig(Number(submitter.value))
								} else if (submitter?.value === "deleteArticles") {
									await deleteSelected()
								}
							})}
						/>

						{articles.length > 0 && (
							<div class="sl-list-outer">
								<ul class="sl-list">
									{articles.map((article) => (
										<li
											key={article.id}
											class={`sl-item${selected.has(article.id) ? " sl-item--checked" : ""}`}
										>
											<form
												method="post"
												mix={on<HTMLFormElement>("submit", (e) => {
													e.preventDefault()
													const text = (
														(e as unknown as SubmitEvent)
															.target as HTMLFormElement
													).elements.namedItem("text") as HTMLInputElement
													clearTimeout(debounceTimers.get(article.id))
													debounceTimers.delete(article.id)
													patchChange(article.id, text.value)
												})}
											>
												<input
													type="hidden"
													name="_action"
													value="changeArticle"
												/>
												<input type="hidden" name="id" value={article.id} />
												<input
													type="text"
													name="text"
													class="sl-item-input"
													defaultValue={article.text}
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
											</form>
											<label class="sl-item-check">
												<input
													type="checkbox"
													aria-label="Select article"
													name="selected"
													value={article.id}
													form="articles-form"
													checked={selected.has(article.id)}
													mix={on("change", (e) => {
														const checked = (
															e.currentTarget as HTMLInputElement
														).checked
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
											</label>
										</li>
									))}
								</ul>
								{articles.length > 5 && (
									<div
										class="sl-rejig-column"
										mix={ref((node) => {
											;(node as HTMLElement).parentElement?.classList.add(
												"sl-list-outer--js",
											)
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
														localStorage.setItem("rejigN", String(rejigN))
														const hasClamped = articles.some(
															(a) => a.sortKey > rejigN,
														)
														if (hasClamped) {
															articles = sortArticles(
																articles.map((a) =>
																	a.sortKey > rejigN
																		? { ...a, sortKey: rejigN }
																		: a,
																),
															)
															markDirty()
															void drainDirty().catch(() => {})
														}
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
							</div>
						)}

						<form
							id="form-add-article"
							method="post"
							mix={on<HTMLFormElement>("submit", async (e) => {
								e.preventDefault()
								await addArticle()
							})}
						>
							<div class="sl-add-form">
								<input type="hidden" name="id" value={nextId} />
								<input type="hidden" name="sortKey" value={rejigN} />
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
									name="new"
									class="sl-add-input"
									placeholder={t.input_article_to_add}
									maxLength={75}
									autoComplete="off"
									enterKeyHint="go"
									aria-label="New article"
									mix={ref((node) => {
										addInputEl = node as HTMLInputElement
									})}
								/>
							</div>
						</form>

						<div class="sl-actions">
							<button
								class="btn btn-primary sl-add-btn"
								type="submit"
								form="form-add-article"
								name="_action"
								value="addArticle"
							>
								{t.Add}
							</button>
							{articles.length > 0 && (
								<form
									method="post"
									mix={on<HTMLFormElement>("submit", (e) => {
										e.preventDefault()
										if (clearDialogEl) clearDialogEl.showModal()
									})}
								>
									<button
										class="btn btn-secondary sl-clear-btn"
										type="submit"
										name="_action"
										value="clearList"
									>
										{t.clearList}
									</button>
								</form>
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
								{hasShare ? t.share : t["copy-link"]}
							</button>
						</div>
					</div>

					<div
						class={`sl-delete-bar${showDelete ? " sl-delete-bar--visible" : ""}`}
					>
						<button
							class="btn btn-primary sl-delete-btn"
							type="submit"
							name="_action"
							value="deleteArticles"
							form="articles-form"
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

					<dialog
						class="sl-dialog"
						mix={ref((node) => {
							clearDialogEl = node as HTMLDialogElement
						})}
					>
						<h2 class="sl-dialog-title">{t.clearList}</h2>
						<p>{t["clearList-confirm"]}</p>
						<div class="sl-dialog-actions">
							<form method="dialog">
								<button class="btn btn-secondary" type="submit">
									{t.cancel}
								</button>
							</form>
							<form
								method="post"
								mix={on<HTMLFormElement>("submit", async (e) => {
									e.preventDefault()
									clearDialogEl?.close()
									await clearList()
								})}
							>
								<button
									class="btn btn-primary"
									type="submit"
									name="_action"
									value="clearList"
								>
									{t.clearList}
								</button>
							</form>
						</div>
					</dialog>

					{toast.render()}
				</div>
			)
		}
	},
)
