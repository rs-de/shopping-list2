import { clientEntry, type Handle, on, ref } from "remix/ui"

import type { Lang } from "../../i18n.ts"
import {
	type Article,
	sortArticles,
	sortByCreatedAt,
} from "../../utils/articles.ts"
import { generateId } from "../../utils/id.ts"
import { createToast } from "../../utils/toast.tsx"
import { createT } from "../../utils/translate.ts"
import { ModeSwitcher } from "./ui/mode-switcher.tsx"
import { EditableArticleRow } from "./ui/rows.tsx"
import {
	createDeleteHandler,
	createSyncEngine,
	createTextEditHandler,
} from "./utils/sync.ts"

export const Articles = clientEntry(
	import.meta.url,
	function Articles(
		handle: Handle<{
			listId: string
			articles: Article[]
			lang: Lang
			nextId: string
		}>,
	) {
		const { listId, lang } = handle.props
		const t = createT(lang)
		let selected = new Set<string>()
		let clearDialogEl: HTMLDialogElement | null = null
		let addInputEl: HTMLInputElement | null = null
		let addBtnEl: Element | null = null
		let nextId = handle.props.nextId
		const hasShare = Boolean(navigator.share)

		const toast = createToast(() => handle.update(), handle.signal)
		const sync = createSyncEngine(handle, t, toast)
		const textEdit = createTextEditHandler(sync, handle.signal)
		const deleteHandler = createDeleteHandler(sync)

		handle.queueTask(() => sync.init())

		async function addArticle() {
			const text = addInputEl?.value.trim() ?? ""
			if (!text) return
			const id = nextId
			nextId = generateId()
			const createdAt = Date.now()
			const rejigN = sync.getRejigN()
			const fd = new FormData()
			fd.set("_action", "addArticle")
			fd.set("id", id)
			fd.set("new", text)
			fd.set("sortKey", String(rejigN))
			fd.set("createdAt", String(createdAt))
			if (addInputEl) addInputEl.value = ""
			const patched = sync.patch((current) => ({
				articles: sortArticles([
					...current,
					{ id, text, sortKey: rejigN, createdAt },
				]),
				body: fd,
			}))
			addInputEl?.focus()
			// .focus() is a no-op here (element never lost focus), so it won't
			// trigger the browser's native scroll-into-view — the newly added
			// row above pushes the input and the Add button down, potentially
			// under the on-screen keyboard. Wait a frame for handle.update()'s
			// re-render to land, then scroll explicitly. Target the Add button
			// (not the input): it sits just below the input, so bringing it
			// into view keeps both visible without a second scroll target.
			requestAnimationFrame(() => {
				addBtnEl?.scrollIntoView({ block: "nearest", behavior: "smooth" })
			})
			await patched
		}

		async function deleteSelected() {
			const ids = [...selected]
			if (!ids.length) return
			selected = new Set()
			handle.update()
			await deleteHandler.deleteSelected(ids)
		}

		async function clearList() {
			selected = new Set()
			handle.update()
			const fd = new FormData()
			fd.set("_action", "clearList")
			await sync.patch(() => ({ articles: [], body: fd }))
		}

		async function share() {
			const url = location.href
			if (hasShare) {
				try {
					await navigator.share({ url, title: t("Shopping List") })
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
			if (copied) toast.show(t("Link copied!"))
		}

		return () => {
			const articles = sortByCreatedAt(sync.getArticles())
			const rejigN = sync.getRejigN()
			const showDelete = selected.size > 0

			return (
				<div class="sl-app">
					<ModeSwitcher listId={listId} active="articles" t={t} />

					<div class="sl-card">
						{sync.isChecking() && (
							<div
								class="sl-verify-overlay"
								role="status"
								aria-label={t("Verifying")}
							>
								<div class="spinner" />
							</div>
						)}
						<form
							id="articles-form"
							method="post"
							mix={on<HTMLFormElement>("submit", async (e) => {
								e.preventDefault()
								const submitter = (e as unknown as SubmitEvent)
									.submitter as HTMLButtonElement | null
								if (submitter?.value === "deleteArticles") {
									await deleteSelected()
								}
							})}
						/>

						{articles.length > 0 && (
							<div class="sl-list-outer">
								<ul class="sl-list">
									{articles.map((article) => (
										<EditableArticleRow
											key={article.id}
											article={article}
											checked={selected.has(article.id)}
											t={t}
											onToggle={(id, checked) => {
												if (checked) {
													selected = new Set([...selected, id])
												} else {
													selected = new Set(
														[...selected].filter((sid) => sid !== id),
													)
												}
												handle.update()
											}}
											onTextInput={(id, text) =>
												textEdit.scheduleChange(id, text)
											}
											onTextSubmit={(id, text) =>
												textEdit.flushChange(id, text)
											}
										/>
									))}
								</ul>
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
									placeholder={t("Input article to add")}
									maxLength={75}
									autoComplete="off"
									enterKeyHint="go"
									aria-label={t("New article")}
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
								mix={ref((node) => {
									addBtnEl = node
								})}
							>
								{t("Add")}
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
										{t("Clear list")}
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
								{t("Share this list")}
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
							{t("Delete selected articles")} ({selected.size})
						</button>
					</div>

					<dialog
						class="sl-dialog"
						mix={ref((node) => {
							clearDialogEl = node as HTMLDialogElement
						})}
					>
						<h2 class="sl-dialog-title">{t("Clear list")}</h2>
						<p>{t("Do you really want to clear the list?")}</p>
						<div class="sl-dialog-actions">
							<form method="dialog">
								<button class="btn btn-secondary" type="submit">
									{t("Cancel")}
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
									{t("Clear list")}
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
