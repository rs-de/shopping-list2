import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as url from "node:url"

import { marked } from "marked"
import { redirect } from "remix/response/redirect"
import { createController } from "remix/router"

import { HomeMenu } from "../assets/home-menu.tsx"
import { appVersion, assetServer } from "../assets.ts"
import { db } from "../db.ts"
import { getTranslations } from "../i18n.ts"
import { routes } from "../routes.ts"
import { Document } from "../ui/document.tsx"
import { ErrorPage } from "../ui/error-page.tsx"
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
			return Response.json({ version: appVersion })
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
			const { lang, t } = await getTranslations(request)
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
			const { lang, t } = await getTranslations(request)
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
			const { lang, t } = await getTranslations(request)
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
			const { lang, t } = await getTranslations(request)
			return render(
				<Document title="404 — Shopping List" lang={lang} t={t}>
					<ErrorPage
						code={404}
						message="Page not found."
						href="/"
						label="Go home"
					/>
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
