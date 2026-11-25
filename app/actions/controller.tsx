import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as url from "node:url"

import { marked } from "marked"
import { unsafeHTML } from "remix/component"
import { redirect } from "remix/response/redirect"
import { createController } from "remix/router"

import { HomeMenu } from "../assets/home-menu.tsx"
import { appVersion, assetServer } from "../assets.ts"
import { db, shoppingLists } from "../db.ts"
import { routes } from "../routes.ts"
import { Document } from "../ui/document.tsx"
import { renderErrorPage } from "../ui/error-page.tsx"
import { generateId, isValidId } from "../utils/id.ts"
import { isRateLimited } from "../utils/rateLimit.ts"

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
		async manifest({ i18n: { t } }) {
			return new Response(
				JSON.stringify({
					name: t("Shopping List"),
					short_name: t("Shopping List"),
					description: t(
						"Simple and secure shopping list webapp for free, shareable with others and without registration.",
					),
					start_url: routes.home.href(),
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
				}),
				{ headers: { "content-type": "application/manifest+json" } },
			)
		},
		async version() {
			return Response.json({ version: appVersion })
		},
		async sw({ url: requestUrl }) {
			const url = new URL(
				routes.assets.href({ path: "app/assets/sw.ts" }),
				requestUrl,
			)
			return (
				(await assetServer.fetch(new Request(url.toString()))) ??
				new Response("Not Found", { status: 404 })
			)
		},
		async home({ request, url, render, i18n, formData: form }) {
			const { lang, t } = i18n
			if (request.method === "POST") {
				// Global, not per-IP: a per-IP cap here would only matter if it
				// were tighter than this one, which would just make it the real
				// limit. This one cap is what actually bounds total list-creation
				// throughput against a distributed (many-IP) attacker.
				if (isRateLimited("create-list")) {
					return renderErrorPage(render, i18n, {
						code: 429,
						message: t(
							"Too many requests. Please wait a moment and try again.",
						),
						href: routes.home.href(),
						label: t("Retry"),
					})
				}
				const requestedId = String(form.get("id") ?? "").trim()
				const id =
					requestedId && isValidId(requestedId) ? requestedId : generateId()
				// Insert-or-keep: an existing list with this id is left untouched
				// (touch: false), so the new row's timestamps are set explicitly.
				const now = new Date()
				await db
					.query(shoppingLists)
					.upsert(
						{ id, articles: [], createdAt: now, updatedAt: now },
						{ update: {}, touch: false },
					)
				return redirect(routes.list.show.href({ listId: id }), 303)
			}
			const recreateId = url.searchParams.get("recreate") ?? undefined
			const validRecreateId =
				recreateId && isValidId(recreateId) ? recreateId : undefined
			return render(
				<Document title={t("Free shopping list web app")} lang={lang}>
					<div class="content-box home-page">
						<div class="home-page__header">
							<h1>{t("Shopping List")}</h1>
							<h2>{t("Simple - Secure - Free - Shareable - No login")}</h2>
						</div>
						<div class="home-menu">
							<HomeMenu lang={lang} recreateId={validRecreateId} />
						</div>
						<span aria-hidden="true" />
					</div>
				</Document>,
			)
		},
		async changelog({ render, i18n: { lang } }) {
			const file = path.join(ROOT, "CHANGELOG.md")
			const markdown = await fs.readFile(file, "utf-8")
			const html = await marked(markdown)
			return render(
				<Document title="Changelog — Shopping List" lang={lang}>
					<article
						class="content-box prose changelog-page"
						innerHTML={unsafeHTML(html)}
					/>
				</Document>,
			)
		},
		async about({ render, i18n: { lang, t } }) {
			const file = path.join(DIR, "about", `about.${lang}.md`)
			const markdown = await fs.readFile(file, "utf-8")
			const html = await marked(markdown)
			return render(
				<Document title="About — Shopping List" lang={lang}>
					<div class="about-page">
						<div class="about-page__header">
							<h1>{t("Shopping List")}</h1>
							<h2>{t("Simple - Secure - Free - Shareable - No login")}</h2>
						</div>
						<article class="prose" innerHTML={unsafeHTML(html)} />
					</div>
				</Document>,
			)
		},
		async notFound({ render, i18n }) {
			const { t } = i18n
			return renderErrorPage(render, i18n, {
				code: 404,
				message: t("Page not found."),
				href: routes.home.href(),
				label: t("Go home"),
			})
		},
	},
})
