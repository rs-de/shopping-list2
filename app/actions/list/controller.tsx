import { redirect } from "remix/response/redirect"
import { createController } from "remix/router"

import { Articles } from "../../assets/list/articles.tsx"
import { Plan } from "../../assets/list/plan.tsx"
import { Shopping } from "../../assets/list/shopping.tsx"
import { db, shoppingLists } from "../../db.ts"
import type { I18n } from "../../middleware/i18n.ts"
import { routes } from "../../routes.ts"
import { Document } from "../../ui/document.tsx"
import { type Render, renderErrorPage } from "../../ui/error-page.tsx"
import {
	type Article,
	defaultSortKey,
	MAX_ARTICLE_TEXT_LENGTH,
	MAX_ARTICLES_PER_LIST,
	rejigSortKey,
	sortArticles,
} from "../../utils/articles.ts"
import { generateId, isValidId } from "../../utils/id.ts"
import { isRateLimited } from "../../utils/rateLimit.ts"

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
			if (!id || !text || text.length > MAX_ARTICLE_TEXT_LENGTH || !sortKey)
				return badRequest()
			if (articles.length >= MAX_ARTICLES_PER_LIST) return badRequest()
			return sortArticles([...articles, { id, text, sortKey, createdAt }])
		}
		case "quickAdd": {
			const text = String(form.get("text") ?? "").trim()
			if (!text || text.length > MAX_ARTICLE_TEXT_LENGTH) return badRequest()
			if (articles.length >= MAX_ARTICLES_PER_LIST) return badRequest()
			return sortArticles([
				...articles,
				{
					id: generateId(),
					text,
					sortKey: defaultSortKey(3),
					createdAt: Date.now(),
				},
			])
		}
		case "changeArticle": {
			const id = String(form.get("id") ?? "")
			const text = String(form.get("text") ?? "")
			if (!id || text.length > MAX_ARTICLE_TEXT_LENGTH) return badRequest()
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
	const updated = await db.update(shoppingLists, listId, { articles })
	return Response.json(updated)
}

type ListLoadResult =
	| { kind: "response"; response: Response }
	| {
			kind: "render"
			listId: string
			articles: Article[]
	  }

// Shared by every leaf action on this route map (show/plan/shopping): reads
// the list, applies POST/PATCH mutations, and handles the DELETE/not-found/
// invalid-id/JSON-pull paths identically regardless of which mode-specific
// screen will ultimately render. Only a plain GET with no mutation reaches
// the "render" case, leaving the caller to pick which component to show.
async function loadAndMutateList({
	request,
	url,
	params,
	render,
	i18n,
}: {
	request: Request
	url: URL
	params: { listId: string }
	render: Render
	i18n: I18n
}): Promise<ListLoadResult> {
	const { listId } = params
	const { t } = i18n
	try {
		if (request.method === "DELETE") {
			await db.delete(shoppingLists, listId)
			return { kind: "response", response: redirect(routes.home.href(), 303) }
		}

		if (!isValidId(listId)) {
			return {
				kind: "response",
				response: await renderErrorPage(render, i18n, {
					code: 400,
					message: t("Invalid list ID."),
					href: routes.home.href(),
					label: t("Go home"),
				}),
			}
		}
		const list = await db.find(shoppingLists, listId)
		if (!list) {
			return {
				kind: "response",
				response: redirect(
					routes.home.href(undefined, { searchParams: { recreate: listId } }),
					303,
				),
			}
		}
		const articles = list.articles as Article[]

		if (request.method === "POST" || request.method === "PATCH") {
			// Keyed by list, not by IP: bounds this list's total write rate
			// regardless of how many distinct clients (or spoofed IPs) hit it.
			if (isRateLimited(`list:${listId}`, 1_000, 15)) {
				// A no-JS form POST is a navigation and gets a page; the client's
				// PATCH sync only checks res.ok, so keep that path cheap.
				return {
					kind: "response",
					response:
						request.method === "POST"
							? await renderErrorPage(render, i18n, {
									code: 429,
									message: t(
										"Too many requests. Please wait a moment and try again.",
									),
									href: url.pathname,
									label: t("Retry"),
								})
							: new Response("Too Many Requests", { status: 429 }),
				}
			}
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
						ids.includes(a.id)
							? { ...a, sortKey: rejigSortKey(partitionNumber) }
							: a,
					),
				)
				await db.update(shoppingLists, listId, { articles: next })
				return {
					kind: "response",
					response: redirect(url.pathname, 303),
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
										? { ...a, sortKey: rejigSortKey(partitionNumber) }
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
						newArticles.length > MAX_ARTICLES_PER_LIST ||
						newArticles.some(
							(a) =>
								typeof a.text !== "string" ||
								a.text.length > MAX_ARTICLE_TEXT_LENGTH,
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
			await db.update(shoppingLists, listId, { articles: next })
			return {
				kind: "response",
				response: redirect(url.pathname, 303),
			}
		}

		if (request.headers.get("accept")?.includes("application/json")) {
			return { kind: "response", response: Response.json({ articles }) }
		}

		return { kind: "render", listId, articles }
	} catch {
		if (request.method !== "GET") {
			return {
				kind: "response",
				response: new Response("Internal Server Error", { status: 500 }),
			}
		}
		return {
			kind: "response",
			response: await renderErrorPage(render, i18n, {
				code: 500,
				message: t("Something went wrong."),
				href: routes.list.show.href(params),
				label: t("Retry"),
			}),
		}
	}
}

export default createController(routes.list, {
	actions: {
		async manifest({ params, i18n: { t } }) {
			const { listId } = params
			return Response.json({
				name: t("Shopping List"),
				short_name: t("Shopping List"),
				description: t("An offline-first shopping list"),
				start_url: routes.list.show.href({ listId }),
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
		async show(context) {
			const { render, i18n } = context
			const { t } = i18n
			const result = await loadAndMutateList(context)
			if (result.kind === "response") return result.response
			return render(
				<Document
					title={t("Shopping List")}
					lang={i18n.lang}
					manifestHref={routes.list.manifest.href({ listId: result.listId })}
				>
					<Articles
						listId={result.listId}
						articles={result.articles}
						lang={i18n.lang}
						nextId={generateId()}
					/>
				</Document>,
			)
		},
		async plan(context) {
			const { render, i18n } = context
			const { t } = i18n
			const result = await loadAndMutateList(context)
			if (result.kind === "response") return result.response
			return render(
				<Document
					title={t("Shopping List")}
					lang={i18n.lang}
					manifestHref={routes.list.manifest.href({ listId: result.listId })}
				>
					<Plan
						listId={result.listId}
						articles={result.articles}
						lang={i18n.lang}
					/>
				</Document>,
			)
		},
		async shopping(context) {
			const { render, i18n } = context
			const { t } = i18n
			const result = await loadAndMutateList(context)
			if (result.kind === "response") return result.response
			return render(
				<Document
					title={t("Shopping List")}
					lang={i18n.lang}
					manifestHref={routes.list.manifest.href({ listId: result.listId })}
				>
					<Shopping
						listId={result.listId}
						articles={result.articles}
						lang={i18n.lang}
					/>
				</Document>,
			)
		},
	},
})
