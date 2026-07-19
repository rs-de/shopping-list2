import { clientEntry, type Handle } from "remix/ui"

import type { Lang } from "../i18n.ts"
import { createToast } from "../utils/toast.tsx"
import { createT } from "../utils/translate.ts"

const LOCAL_STORAGE_KEY = "shoppingListId"

export const HomeMenu = clientEntry(
	import.meta.url,
	function HomeMenu(handle: Handle<{ lang: Lang; recreateId?: string }>) {
		// `null` = not checked yet; localStorage is only readable client-side,
		// so until the queued task below runs we don't know if a list exists.
		// Rendering "create list" as the default here would be wrong whenever
		// that task doesn't land in time (e.g. a soft navigation) and risks the
		// user spawning a duplicate list, orphaning their real one.
		let listId: string | null | undefined = null
		const { lang, recreateId } = handle.props
		const t = createT(lang)
		const toast = createToast(() => handle.update(), handle.signal)

		handle.queueTask(() => {
			listId = localStorage.getItem(LOCAL_STORAGE_KEY) ?? undefined
			if (recreateId)
				toast.show(t("Your list was cleaned up."), "success", {
					duration: 5000,
				})
			handle.update()
		})

		return () => {
			if (recreateId) {
				return (
					<>
						{toast.render()}
						<form method="post" class="home-menu__form">
							<input type="hidden" name="id" value={recreateId} />
							<button
								type="submit"
								class="btn btn-primary home-menu__create-btn"
							>
								{t("Recreate list")}
							</button>
						</form>
					</>
				)
			}
			if (listId === null) {
				return (
					<>
						{toast.render()}
						<div class="home-menu__loading" aria-busy="true">
							<div class="spinner" />
						</div>
					</>
				)
			}
			return (
				<>
					{toast.render()}
					{listId ? (
						<a href={`/${listId}`} class="home-menu__show-link">
							{t("Show my list")}
						</a>
					) : (
						<form method="post" class="home-menu__form">
							<button
								type="submit"
								class="btn btn-primary home-menu__create-btn"
							>
								{t("New shopping list")}
							</button>
						</form>
					)}
				</>
			)
		}
	},
)
