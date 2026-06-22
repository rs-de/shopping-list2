import { redirect } from "remix/response/redirect";
import { createController } from "remix/router";

import { ShoppingListApp } from "../../assets/shopping-list.tsx";
import { db } from "../../db.ts";
import { loadTranslations, preferredLang } from "../../i18n.ts";
import { routes } from "../../routes.ts";
import { Document } from "../../ui/document.tsx";
import { type Article, moveArticles } from "../../utils/moveArticles.ts";

export default createController(routes.list, {
	actions: {
		async show({ request, params, render }) {
			const { listId } = params;

			if (request.method === "DELETE") {
				await db.shoppingList.delete({ where: { id: listId } }).catch(() => {});
				return redirect(routes.home.href());
			}

			const list = await db.shoppingList.findUnique({ where: { id: listId } });
			if (!list) return new Response("Not Found", { status: 404 });
			const articles = list.articles as Article[];

			if (request.method === "PATCH") {
				const form = await request.formData();

				switch (form.get("_action")) {
					case "addArticle": {
						const id = String(form.get("id") ?? "");
						const text = String(form.get("new") ?? "").trim();
						if (!id || !text)
							return new Response("Bad Request", { status: 400 });
						const updated = await db.shoppingList.update({
							where: { id: listId },
							data: { articles: [...articles, { id, text }] },
						});
						return Response.json(updated);
					}
					case "changeArticle": {
						const id = String(form.get("id") ?? "");
						const text = String(form.get("text") ?? "");
						if (!id) return new Response("Bad Request", { status: 400 });
						const updated = await db.shoppingList.update({
							where: { id: listId },
							data: {
								articles: articles.map((a) =>
									a.id === id ? { ...a, text } : a,
								),
							},
						});
						return Response.json(updated);
					}
					case "deleteArticles": {
						const ids = form.getAll("selected").map(String);
						const updated = await db.shoppingList.update({
							where: { id: listId },
							data: { articles: articles.filter((a) => !ids.includes(a.id)) },
						});
						return Response.json(updated);
					}
					case "rejig": {
						const selected = form.getAll("selected").map(String);
						const partitionNumber = Number(form.get("partitionNumber"));
						const partitionCount = Number(form.get("partitionCount"));
						if (!selected.length)
							return new Response("Bad Request", { status: 400 });
						const updated = await db.shoppingList.update({
							where: { id: listId },
							data: {
								articles: moveArticles({
									idsToRejig: selected,
									partitionNumber,
									partitionCount,
									articles,
								}),
							},
						});
						return Response.json(updated);
					}
					case "clearList": {
						const updated = await db.shoppingList.update({
							where: { id: listId },
							data: { articles: [] },
						});
						return Response.json(updated);
					}
					default:
						return new Response("Bad Request: unknown _action", {
							status: 400,
						});
				}
			}

			const lang = preferredLang(request.headers.get("accept-language"));
			const t = await loadTranslations(lang);

			return render(
				<Document title={t.ShoppingList} lang={lang} t={t}>
					<ShoppingListApp listId={listId} articles={articles} t={t} />
				</Document>,
			);
		},
	},
});
