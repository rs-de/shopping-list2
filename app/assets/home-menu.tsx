import { clientEntry, type Handle } from "remix/ui"

import type { Translations } from "../i18n.ts"

const LOCAL_STORAGE_KEY = "shoppingListId"

export const HomeMenu = clientEntry(
	import.meta.url,
	function HomeMenu(handle: Handle<{ t: Translations; recreateId?: string }>) {
		let listId: string | null = null
		const { t, recreateId } = handle.props

		handle.queueTask(() => {
			listId = localStorage.getItem(LOCAL_STORAGE_KEY)
			handle.update()
		})

		return () => {
			if (recreateId) {
				return (
					<form method="post" class="home-menu__form">
						<p class="home-menu__cleaned-up">{t["list-cleaned-up"]}</p>
						<input type="hidden" name="id" value={recreateId} />
						<button type="submit" class="btn btn-primary home-menu__create-btn">
							{t["recreate-list"]}
						</button>
					</form>
				)
			}
			return listId ? (
				<a href={`/${listId}`} class="home-menu__show-link">
					{t["show-my-list"]}
				</a>
			) : (
				<form method="post" class="home-menu__form">
					<button type="submit" class="btn btn-primary home-menu__create-btn">
						{t.create_shoppingList}
					</button>
				</form>
			)
		}
	},
)
