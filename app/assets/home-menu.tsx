import { clientEntry, type Handle } from "remix/ui"

import type { Translations } from "../i18n.ts"
import { createToast } from "../utils/toast.tsx"

const LOCAL_STORAGE_KEY = "shoppingListId"

export const HomeMenu = clientEntry(
	import.meta.url,
	function HomeMenu(handle: Handle<{ t: Translations; recreateId?: string }>) {
		let listId: string | null = null
		const { t, recreateId } = handle.props
		const toast = createToast(() => handle.update(), handle.signal)

		handle.queueTask(() => {
			listId = localStorage.getItem(LOCAL_STORAGE_KEY)
			if (recreateId) toast.show(t["list-cleaned-up"], "success", { duration: 5000 })
			handle.update()
		})

		return () => {
			if (recreateId) {
				return (
					<>
						{toast.render()}
						<form method="post" class="home-menu__form">
							<input type="hidden" name="id" value={recreateId} />
							<button type="submit" class="btn btn-primary home-menu__create-btn">
								{t["recreate-list"]}
							</button>
						</form>
					</>
				)
			}
			return (
				<>
					{toast.render()}
					{listId ? (
						<a href={`/${listId}`} class="home-menu__show-link">
							{t["show-my-list"]}
						</a>
					) : (
						<form method="post" class="home-menu__form">
							<button type="submit" class="btn btn-primary home-menu__create-btn">
								{t.create_shoppingList}
							</button>
						</form>
					)}
				</>
			)
		}
	},
)
