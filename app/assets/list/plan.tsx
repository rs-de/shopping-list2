import { clientEntry, type Handle, on } from "remix/ui"

import type { Translations } from "../../i18n.ts"
import { type Article, sortArticles } from "../../utils/articles.ts"
import { createToast } from "../../utils/toast.tsx"
import { ModeSwitcher } from "./ui/mode-switcher.tsx"
import { EditableArticleRow } from "./ui/rows.tsx"
import {
	createDeleteHandler,
	createSyncEngine,
	createTextEditHandler,
} from "./utils/sync.ts"

export const Plan = clientEntry(
	import.meta.url,
	function Plan(
		handle: Handle<{
			listId: string
			articles: Article[]
			t: Translations
		}>,
	) {
		const { listId, t } = handle.props
		let selected = new Set<string>()
		let helpOpen = false

		const toast = createToast(() => handle.update(), handle.signal)
		const sync = createSyncEngine(handle, t, toast)
		const textEdit = createTextEditHandler(sync, handle.signal)
		const deleteHandler = createDeleteHandler(sync)

		handle.queueTask(() => sync.init())

		async function deleteSelected() {
			const ids = [...selected]
			if (!ids.length) return
			selected = new Set()
			handle.update()
			await deleteHandler.deleteSelected(ids)
		}

		async function rejig(partitionNumber: number) {
			const ids = [...selected]
			if (!ids.length) return
			selected = new Set()
			handle.update()
			const fd = new FormData()
			fd.set("_action", "rejig")
			for (const id of ids) fd.append("selected", id)
			fd.set("partitionNumber", String(partitionNumber))
			await sync.patch((current) => ({
				articles: sortArticles(
					current.map((a) =>
						ids.includes(a.id) ? { ...a, sortKey: partitionNumber } : a,
					),
				),
				body: fd,
			}))
		}

		return () => {
			const articles = sync.getArticles()
			const rejigN = sync.getRejigN()
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
						class="btn btn-secondary sl-rejig-btn"
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
					<ModeSwitcher listId={listId} active="plan" t={t} />
					{sync.isChecking() && (
						<div
							class="sl-verify-indicator"
							role="status"
							aria-label="Verifying"
						>
							<div class="spinner" />
						</div>
					)}

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
										<EditableArticleRow
											key={article.id}
											article={article}
											checked={selected.has(article.id)}
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
								<div class="sl-rejig-column">
									<button
										class="sl-rejig-help"
										type="button"
										aria-label="What is rejig?"
										mix={on("click", () => {
											if (helpOpen) return
											helpOpen = true
											handle.update()
										})}
									>
										?
									</button>
									<select
										class="sl-rejig-select"
										mix={on("change", (e) => {
											const n = Number(
												(e.currentTarget as HTMLSelectElement).value,
											)
											sync.setRejigN(n)
											const hasClamped = sync
												.getArticles()
												.some((a) => a.sortKey > n)
											if (hasClamped) {
												void sync.patch((current) => {
													const next = sortArticles(
														current.map((a) =>
															a.sortKey > n ? { ...a, sortKey: n } : a,
														),
													)
													const fd = new FormData()
													fd.set("_action", "replaceArticles")
													fd.set("articles", JSON.stringify(next))
													return { articles: next, body: fd }
												})
											}
											handle.update()
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
							</div>
						)}
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

					{helpOpen && (
						<div
							class="sl-rejig-backdrop"
							mix={on("click", () => {
								helpOpen = false
								handle.update()
							})}
						/>
					)}
					{helpOpen && (
						<div class="sl-rejig-help-panel">{t.rejig_description}</div>
					)}
					{toast.render()}
				</div>
			)
		}
	},
)
