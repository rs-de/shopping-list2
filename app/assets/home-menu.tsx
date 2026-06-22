import { clientEntry, type Handle } from "remix/ui";

import type { Translations } from "../i18n.ts";

const LOCAL_STORAGE_KEY = "shoppingListId";

export const HomeMenu = clientEntry(
	import.meta.url,
	function HomeMenu(handle: Handle<{ t: Translations }>) {
		let listId: string | null = null;
		const { t } = handle.props;

		handle.queueTask(() => {
			listId = localStorage.getItem(LOCAL_STORAGE_KEY);
			handle.update();
		});

		return () =>
			listId ? (
				<a href={`/${listId}`} class="home-menu__show-link">
					{t["show-my-list"]}
				</a>
			) : (
				<form method="post" class="home-menu__form">
					<button type="submit" class="btn btn-primary home-menu__create-btn">
						{t.create_shoppingList}
					</button>
				</form>
			);
	},
);
