import { redirect } from "remix/response/redirect"
import { createController } from "remix/router"
import type { RemixNode } from "remix/ui"

import { Articles } from "../../assets/list/articles.tsx"
import { Plan } from "../../assets/list/plan.tsx"
import { Shopping } from "../../assets/list/shopping.tsx"
import { db } from "../../db.ts"
import { getTranslations, type Lang, type Translations } from "../../i18n.ts"
import { routes } from "../../routes.ts"
import { Document } from "../../ui/document.tsx"
import { ErrorPage } from "../../ui/error-page.tsx"
import { type Article, sortArticles } from "../../utils/articles.ts"
import { generateId } from "../../utils/id.ts"

type Render = (
	node: RemixNode,
	init?: ResponseInit,
) => Response | Promise<Response>

const badRequest = (msg = "Bad Request") => new Response(msg, { status: 400 })

function mutateArticles(
	form: FormData,
	articles: Article[],
): Article[] | Response {
	switch (form.get("_action")) {
		case "addArticle": {
			const id = String(form.get("id") ?? "").trim()
			const text = String(form.get("new") ?? "").trim()
			const sortKey = Number(form.get("sortKey"))
			const createdAt = Number(form.get("createdAt")) || Date.now()
			if (!id || !text || text.length > 256 || !sortKey) return badRequest()
			return sortArticles([...articles, { id, text, sortKey, createdAt }])
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

type ListLoadResult =
	| { kind: "response"; response: Response }
	| {
			kind: "render"
			listId: string
			articles: Article[]
			t: Translations
			lang: Lang
	  }

// Shared by every leaf action on this route map (show/plan/shopping): reads
// the list, applies POST/PATCH mutations, and handles the DELETE/not-found/
// invalid-id/JSON-pull paths identically regardless of which mode-specific
// screen will ultimately render. Only a plain GET with no mutation reaches
// the "render" case, leaving the caller to pick which component to show.
async function loadAndMutateList({
	request,
	params,
	render,
}: {
	request: Request
	params: { listId: string }
	render: Render
}): Promise<ListLoadResult> {
	const { listId } = params
	try {
		if (request.method === "DELETE") {
			await db.shoppingList.delete({ where: { id: listId } }).catch(() => {})
			return { kind: "response", response: redirect(routes.home.href()) }
		}

		const VALID_ID = /^[A-Za-z0-9_-]{10}$/
		if (!VALID_ID.test(listId)) {
			const { lang, t } = await getTranslations(request)
			return {
				kind: "response",
				response: await render(
					<Document title="400 — Shopping List" lang={lang} t={t}>
						<ErrorPage
							code={400}
							message="Invalid list ID."
							href="/"
							label="Go home"
						/>
					</Document>,
					{ status: 400 },
				),
			}
		}
		const list = await db.shoppingList.findUnique({ where: { id: listId } })
		if (!list) {
			return {
				kind: "response",
				response: redirect(`/?recreate=${encodeURIComponent(listId)}`),
			}
		}
		const articles = list.articles as Article[]

		if (request.method === "POST" || request.method === "PATCH") {
			const form = await request.formData()

			// POST rejig (no-JS fallback)
			if (request.method === "POST" && form.has("partitionNumber")) {
				const partitionNumber = Number(form.get("partitionNumber"))
				const ids = form.getAll("selected").map(String)
				if (!ids.length || !partitionNumber) {
					return { kind: "response", response: badRequest() }
				}
				const next = sortArticles(
					articles.map((a) =>
						ids.includes(a.id) ? { ...a, sortKey: partitionNumber } : a,
					),
				)
				await db.shoppingList.update({
					where: { id: listId },
					data: { articles: next },
				})
				return {
					kind: "response",
					response: redirect(new URL(request.url).pathname),
				}
			}

			// PATCH-only actions
			if (request.method === "PATCH") {
				const action = form.get("_action")
				if (action === "rejig") {
					const selected = form.getAll("selected").map(String)
					const partitionNumber = Number(form.get("partitionNumber"))
					if (!selected.length || !partitionNumber) {
						return { kind: "response", response: badRequest() }
					}
					return {
						kind: "response",
						response: await updateList(
							listId,
							sortArticles(
								articles.map((a) =>
									selected.includes(a.id)
										? { ...a, sortKey: partitionNumber }
										: a,
								),
							),
						),
					}
				}
				if (action === "replaceArticles") {
					const newArticles = JSON.parse(
						String(form.get("articles") ?? "[]"),
					) as Article[]
					if (
						newArticles.some(
							(a) => typeof a.text !== "string" || a.text.length > 256,
						)
					) {
						return { kind: "response", response: badRequest() }
					}
					return {
						kind: "response",
						response: await updateList(listId, newArticles),
					}
				}
			}

			const next = mutateArticles(form, articles)
			if (next instanceof Response) {
				return { kind: "response", response: next }
			}

			if (request.method === "PATCH") {
				return { kind: "response", response: await updateList(listId, next) }
			}
			await db.shoppingList.update({
				where: { id: listId },
				data: { articles: next },
			})
			return {
				kind: "response",
				response: redirect(new URL(request.url).pathname),
			}
		}

		if (request.headers.get("accept")?.includes("application/json")) {
			return { kind: "response", response: Response.json({ articles }) }
		}

		const { lang, t } = await getTranslations(request)
		return { kind: "render", listId, articles, t, lang }
	} catch {
		if (request.method !== "GET") {
			return {
				kind: "response",
				response: new Response("Internal Server Error", { status: 500 }),
			}
		}
		const { lang, t } = await getTranslations(request).catch(() => ({
			lang: "en" as const,
			t: {} as Translations,
		}))
		return {
			kind: "response",
			response: await render(
				<Document title="Error — Shopping List" lang={lang} t={t}>
					<ErrorPage
						code={500}
						message="Something went wrong."
						href={`/${params.listId}`}
						label="Retry"
					/>
				</Document>,
				{ status: 500 },
			),
		}
	}
}

export default createController(routes.list, {
	actions: {
		async manifest({ params }) {
			const { listId } = params
			return Response.json({
				name: "Shopping List",
				short_name: "Shopping List",
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
			const result = await loadAndMutateList({ request, params, render })
			if (result.kind === "response") return result.response
			return render(
				<Document
					title={result.t.ShoppingList}
					lang={result.lang}
					t={result.t}
					manifestHref={`/${result.listId}/manifest`}
				>
					<Articles
						listId={result.listId}
						articles={result.articles}
						t={result.t}
						nextId={generateId()}
					/>
				</Document>,
			)
		},
		async plan({ request, params, render }) {
			const result = await loadAndMutateList({ request, params, render })
			if (result.kind === "response") return result.response
			return render(
				<Document
					title={result.t.ShoppingList}
					lang={result.lang}
					t={result.t}
					manifestHref={`/${result.listId}/manifest`}
				>
					<Plan
						listId={result.listId}
						articles={result.articles}
						t={result.t}
					/>
				</Document>,
			)
		},
		async shopping({ request, params, render }) {
			const result = await loadAndMutateList({ request, params, render })
			if (result.kind === "response") return result.response
			return render(
				<Document
					title={result.t.ShoppingList}
					lang={result.lang}
					t={result.t}
					manifestHref={`/${result.listId}/manifest`}
				>
					<Shopping
						listId={result.listId}
						articles={result.articles}
						t={result.t}
					/>
				</Document>,
			)
		},
	},
})
