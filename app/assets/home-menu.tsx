import { clientEntry, type Handle } from "remix/ui";

const LOCAL_STORAGE_KEY = "shoppingListId";

export const HomeMenu = clientEntry(
	import.meta.url,
	function HomeMenu(handle: Handle<Record<string, never>>) {
		let listId: string | null = null;

		handle.queueTask(() => {
			listId = localStorage.getItem(LOCAL_STORAGE_KEY);
			handle.update();
		});

		return () =>
			listId ? (
				<a href={`/${listId}`} class="home-menu__show-link">
					Show my list
				</a>
			) : (
				<form method="post" class="home-menu__form">
					<button type="submit" class="btn btn-primary home-menu__create-btn">
						New shopping list
					</button>
				</form>
			);
	},
);
