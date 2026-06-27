import { redirect } from "remix/response/redirect"
import { createController } from "remix/router"

import { ShoppingListApp } from "../../assets/shopping-list.tsx"
import { db } from "../../db.ts"
import { getTranslations } from "../../i18n.ts"
import { routes } from "../../routes.ts"
import { Document } from "../../ui/document.tsx"
import { ErrorPage } from "../../ui/error-page.tsx"
import { generateId } from "../../utils/id.ts"
import { type Article, moveArticles } from "../../utils/moveArticles.ts"

const badRequest = (msg = "Bad Request") => new Response(msg, { status: 400 })

function mutateArticles(
	form: FormData,
	articles: Article[],
): Article[] | Response {
	switch (form.get("_action")) {
		case "addArticle": {
			const id = String(form.get("id") ?? "").trim()
			const text = String(form.get("new") ?? "").trim()
			if (!id || !text || text.length > 256) return badRequest()
			return [...articles, { id, text }]
		}
		case "changeArticle": {
			const id = String(form.get("id") ?? "")
			const text = String(form.get("text") ?? "")
			if (!id || text.length > 256) return badRequest()
			return articles.map((a) => (a.id === id ? { ...a, text } : a))
		}
		case "deleteArticles": {
			const ids = form.getAll("selected").map(String)
			return articles.filter((a) => !ids.includes(a.id))
		}
		case "clearList":
			return []
		default:
			return badRequest()
	}
}

async function updateList(listId: string, articles: Article[]) {
	const updated = await db.shoppingList.update({
		where: { id: listId },
		data: { articles },
	})
	return Response.json(updated)
}

export default createController(routes.list, {
	actions: {
		async manifest({ params }) {
			const { listId } = params
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
			})
		},
		async show({ request, params, render }) {
			const { listId } = params
			try {
				if (request.method === "DELETE") {
					await db.shoppingList
						.delete({ where: { id: listId } })
						.catch(() => {})
					return redirect(routes.home.href())
				}

				const list = await db.shoppingList.findUnique({
					where: { id: listId },
				})
				if (!list) {
					const { lang, t } = await getTranslations(request)
					return render(
						<Document title="404 — Shopping List" lang={lang} t={t}>
							<ErrorPage
								code={404}
								message="List not found."
								href="/"
								label="Go home"
							/>
						</Document>,
						{ status: 404 },
					)
				}
				const articles = list.articles as Article[]

				if (request.method === "POST" || request.method === "PATCH") {
					const form = await request.formData()

					// PATCH-only actions
					if (request.method === "PATCH") {
						const action = form.get("_action")
						if (action === "rejig") {
							const selected = form.getAll("selected").map(String)
							const partitionNumber = Number(form.get("partitionNumber"))
							const partitionCount = Number(form.get("partitionCount"))
							if (!selected.length) return badRequest()
							return updateList(
								listId,
								moveArticles({ idsToRejig: selected, partitionNumber, partitionCount, articles }),
							)
						}
						if (action === "replaceArticles") {
							const newArticles = JSON.parse(
								String(form.get("articles") ?? "[]"),
							) as Article[]
							if (newArticles.some((a) => typeof a.text !== "string" || a.text.length > 256))
								return badRequest()
							return updateList(listId, newArticles)
						}
					}

					const next = mutateArticles(form, articles)
					if (next instanceof Response) return next

					if (request.method === "PATCH") return updateList(listId, next)
					await db.shoppingList.update({ where: { id: listId }, data: { articles: next } })
					return redirect(`/${listId}`)
				}

				const { lang, t } = await getTranslations(request)

				return render(
					<Document
						title={t.ShoppingList}
						lang={lang}
						t={t}
						manifestHref={`/${listId}/manifest`}
					>
						<ShoppingListApp listId={listId} articles={articles} t={t} nextId={generateId()} />
					</Document>,
				)
			} catch {
				if (request.method !== "GET") {
					return new Response("Internal Server Error", { status: 500 })
				}
				const { lang, t } = await getTranslations(request).catch(() => ({
					lang: "en" as const,
					t: {} as Record<string, string>,
				}))
				return render(
					<Document title="Error — Shopping List" lang={lang} t={t}>
						<ErrorPage
							code={500}
							message="Something went wrong."
							href={`/${listId}`}
							label="Retry"
						/>
					</Document>,
					{ status: 500 },
				)
			}
		},
	},
})
