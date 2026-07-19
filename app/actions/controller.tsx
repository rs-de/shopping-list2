import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as url from "node:url"

import { marked } from "marked"
import { redirect } from "remix/response/redirect"
import { createController } from "remix/router"

import { HomeMenu } from "../assets/home-menu.tsx"
import { appVersion, assetServer } from "../assets.ts"
import { db } from "../db.ts"
import { routes } from "../routes.ts"
import { Document } from "../ui/document.tsx"
import { ErrorPage } from "../ui/error-page.tsx"
import { createTranslator, resolveLang } from "../utils/i18n.ts"
import { generateId } from "../utils/id.ts"
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
		async manifest({ request }) {
			const t = createTranslator(
				resolveLang(request.headers.get("accept-language")),
			)
			return new Response(
				JSON.stringify({
					name: t("Shopping List"),
					short_name: t("Shopping List"),
					description: t(
						"Simple and secure shopping list webapp for free, shareable with others and without registration.",
					),
					start_url: "/",
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
		async sw({ request }) {
			const url = new URL("/assets/app/assets/sw.ts", request.url)
			return (
				(await assetServer.fetch(new Request(url.toString()))) ??
				new Response("Not Found", { status: 404 })
			)
		},
		async home({ request, render }) {
			const VALID_ID = /^[A-Za-z0-9_-]{10}$/
			const lang = resolveLang(request.headers.get("accept-language"))
			const t = createTranslator(lang)
			if (request.method === "POST") {
				// Global, not per-IP: a per-IP cap here would only matter if it
				// were tighter than this one, which would just make it the real
				// limit. This one cap is what actually bounds total list-creation
				// throughput against a distributed (many-IP) attacker.
				if (isRateLimited("create-list")) {
					return new Response("Too Many Requests", { status: 429 })
				}
				const form = await request.formData()
				const requestedId = String(form.get("id") ?? "").trim()
				const id =
					requestedId && VALID_ID.test(requestedId) ? requestedId : generateId()
				await db.shoppingList.upsert({
					where: { id },
					create: { id, articles: [] },
					update: {},
				})
				return redirect(`/${id}`, 303)
			}
			const url = new URL(request.url)
			const recreateId = url.searchParams.get("recreate") ?? undefined
			const validRecreateId =
				recreateId && VALID_ID.test(recreateId) ? recreateId : undefined
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
		async changelog({ request, render }) {
			const lang = resolveLang(request.headers.get("accept-language"))
			const file = path.join(ROOT, "CHANGELOG.md")
			const markdown = await fs.readFile(file, "utf-8")
			const html = await marked(markdown)
			return render(
				<Document title="Changelog — Shopping List" lang={lang}>
					<article class="content-box prose changelog-page" innerHTML={html} />
				</Document>,
			)
		},
		async about({ request, render }) {
			const lang = resolveLang(request.headers.get("accept-language"))
			const t = createTranslator(lang)
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
						<article class="prose" innerHTML={html} />
					</div>
				</Document>,
			)
		},
		async notFound({ request, render }) {
			const lang = resolveLang(request.headers.get("accept-language"))
			const t = createTranslator(lang)
			return render(
				<Document title="404 — Shopping List" lang={lang}>
					<ErrorPage
						code={404}
						message={t("Page not found.")}
						href="/"
						label={t("Go home")}
					/>
				</Document>,
				{ status: 404 },
			)
		},
	},
})
