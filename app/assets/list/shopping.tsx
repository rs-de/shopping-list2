import { clientEntry, type Handle, on } from "remix/ui"

import type { Translations } from "../../i18n.ts"
import type { Article } from "../../utils/articles.ts"
import { createToast } from "../../utils/toast.tsx"
import { ModeSwitcher } from "./ui/mode-switcher.tsx"
import { CheckoffArticleRow } from "./ui/rows.tsx"
import { createDeleteHandler, createSyncEngine } from "./utils/sync.ts"

export const Shopping = clientEntry(
	import.meta.url,
	function Shopping(
		handle: Handle<{
			listId: string
			articles: Article[]
			t: Translations
		}>,
	) {
		const { listId, t } = handle.props
		let selected = new Set<string>()

		const toast = createToast(() => handle.update(), handle.signal)
		const sync = createSyncEngine(handle, t, toast)
		const deleteHandler = createDeleteHandler(sync)

		handle.queueTask(() => sync.init())

		async function deleteSelected() {
			const ids = [...selected]
			if (!ids.length) return
			selected = new Set()
			handle.update()
			await deleteHandler.deleteSelected(ids)
		}

		return () => {
			const articles = sync.getArticles()
			const showDelete = selected.size > 0

			return (
				<div class="sl-app">
					<ModeSwitcher listId={listId} active="shopping" t={t} />
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
								if (submitter?.value === "deleteArticles") {
									await deleteSelected()
								}
							})}
						/>

						{articles.length > 0 && (
							<div class="sl-list-outer">
								<ul class="sl-list">
									{articles.map((article) => (
										<CheckoffArticleRow
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
										/>
									))}
								</ul>
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

					{toast.render()}
				</div>
			)
		}
	},
)
