import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as url from "node:url"

import { marked } from "marked"
import { redirect } from "remix/response/redirect"
import { createController } from "remix/router"

import { HomeMenu } from "../assets/home-menu.tsx"
import { assetServer } from "../assets.ts"
import { db } from "../db.ts"
import { loadTranslations, preferredLang } from "../i18n.ts"
import { routes } from "../routes.ts"
import { Document } from "../ui/document.tsx"
import { generateId } from "../utils/id.ts"

const DIR = path.dirname(url.fileURLToPath(import.meta.url))
const ROOT = path.resolve(DIR, "../..")

export default createController(routes, {
	actions: {
		async assets(context) {
			return (
				(await assetServer.fetch(context.request)) ??
				new Response("Not Found", { status: 404 })
			)
		},
		async version() {
			const pkg = JSON.parse(
				await fs.readFile(path.join(ROOT, "package.json"), "utf-8"),
			) as { version: string }
			return Response.json({ version: pkg.version })
		},
		async sw({ request }) {
			const url = new URL("/assets/app/assets/sw.ts", request.url)
			return (
				(await assetServer.fetch(new Request(url.toString()))) ??
				new Response("Not Found", { status: 404 })
			)
		},
		async home({ request, render }) {
			if (request.method === "POST") {
				if (isRateLimited()) {
					return new Response("Too Many Requests", { status: 429 })
				}
				const list = await db.shoppingList.create({
					data: { id: generateId() },
				})
				return redirect(`/${list.id}`, 303)
			}
			const lang = preferredLang(request.headers.get("accept-language"))
			const t = await loadTranslations(lang)
			return render(
				<Document title={t["page-title"]} lang={lang} t={t}>
					<div class="content-box home-page">
						<div class="home-page__header">
							<h1>{t.ShoppingList}</h1>
							<h2>{t["app-teaser-text"]}</h2>
						</div>
						<div class="home-menu">
							<HomeMenu t={t} />
						</div>
						<span aria-hidden="true" />
					</div>
				</Document>,
			)
		},
		async changelog({ request, render }) {
			const lang = preferredLang(request.headers.get("accept-language"))
			const t = await loadTranslations(lang)
			const file = path.join(ROOT, "CHANGELOG.md")
			const markdown = await fs.readFile(file, "utf-8")
			const html = await marked(markdown)
			return render(
				<Document title="Changelog — Shopping List" lang={lang} t={t}>
					<article class="content-box prose changelog-page" innerHTML={html} />
				</Document>,
			)
		},
		async about({ request, render }) {
			const lang = preferredLang(request.headers.get("accept-language"))
			const t = await loadTranslations(lang)
			const file = path.join(DIR, "about", `about.${lang}.md`)
			const markdown = await fs.readFile(file, "utf-8")
			const html = await marked(markdown)
			return render(
				<Document title="About — Shopping List" lang={lang} t={t}>
					<div class="about-page">
						<div class="about-page__header">
							<h1>{t.ShoppingList}</h1>
							<h2>{t["app-teaser-text"]}</h2>
						</div>
						<article class="prose" innerHTML={html} />
					</div>
				</Document>,
			)
		},
		async notFound({ request, render }) {
			const lang = preferredLang(request.headers.get("accept-language"))
			const t = await loadTranslations(lang)
			return render(
				<Document title="404 — Shopping List" lang={lang} t={t}>
					<div class="content-box error-page">
						<h1 class="error-page__code">404</h1>
						<p class="error-page__msg">Page not found.</p>
						<a href="/" class="btn btn-primary">
							Go home
						</a>
					</div>
				</Document>,
				{ status: 404 },
			)
		},
	},
})

let rateLimitUntil = 0

function isRateLimited(): boolean {
	const now = Date.now()
	if (now < rateLimitUntil) return true
	rateLimitUntil = now + 5_000
	return false
}
