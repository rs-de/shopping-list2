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
		async manifest({ params }) {
			const { listId } = params;
			return Response.json({
				name: "Shopping List",
				short_name: "List",
				description: "An offline-first shopping list",
				start_url: `/${listId}`,
				display: "standalone",
				background_color: "#eaf4ff",
				theme_color: "hsl(206, 100%, 50%)",
				icons: [
					{
						src: "/icons/manifest-icon-192.maskable.png",
						sizes: "192x192",
						type: "image/png",
						purpose: "any maskable",
					},
					{
						src: "/icons/manifest-icon-512.maskable.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "any maskable",
					},
				],
			});
		},
		async show({ request, params, render }) {
			const { listId } = params;
			try {
				if (request.method === "DELETE") {
					await db.shoppingList
						.delete({ where: { id: listId } })
						.catch(() => {});
					return redirect(routes.home.href());
				}

				const list = await db.shoppingList.findUnique({
					where: { id: listId },
				});
				if (!list) {
					const lang = preferredLang(request.headers.get("accept-language"));
					const t = await loadTranslations(lang);
					return render(
						<Document title="404 — Shopping List" lang={lang} t={t}>
							<div class="content-box error-page">
								<h1 class="error-page__code">404</h1>
								<p class="error-page__msg">List not found.</p>
								<a href="/" class="btn btn-primary">
									Go home
								</a>
							</div>
						</Document>,
						{ status: 404 },
					);
				}
				const articles = list.articles as Article[];

				if (request.method === "PATCH") {
					const form = await request.formData();

					switch (form.get("_action")) {
						case "addArticle": {
							const id = String(form.get("id") ?? "");
							const text = String(form.get("new") ?? "").trim();
							if (!id || !text || text.length > 256)
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
							if (!id || text.length > 256)
								return new Response("Bad Request", { status: 400 });
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
						case "replaceArticles": {
							const newArticles = JSON.parse(
								String(form.get("articles") ?? "[]"),
							) as Article[];
							if (
								newArticles.some(
									(a) => typeof a.text !== "string" || a.text.length > 256,
								)
							)
								return new Response("Bad Request", { status: 400 });
							const updated = await db.shoppingList.update({
								where: { id: listId },
								data: { articles: newArticles },
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
					<Document
						title={t.ShoppingList}
						lang={lang}
						t={t}
						manifestHref={`/${listId}/manifest`}
					>
						<ShoppingListApp listId={listId} articles={articles} t={t} />
					</Document>,
				);
			} catch {
				if (request.method !== "GET") {
					return new Response("Internal Server Error", { status: 500 });
				}
				const lang = preferredLang(request.headers.get("accept-language"));
				const t = await loadTranslations(lang).catch(() => ({}) as never);
				return render(
					<Document title="Error — Shopping List" lang={lang} t={t}>
						<div class="content-box error-page">
							<h1 class="error-page__code">500</h1>
							<p class="error-page__msg">Something went wrong.</p>
							<a href={`/${listId}`} class="btn btn-primary">
								Retry
							</a>
						</div>
					</Document>,
					{ status: 500 },
				);
			}
		},
	},
});
