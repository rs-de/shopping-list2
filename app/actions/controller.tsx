import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as url from "node:url";

import { marked } from "marked";
import { redirect } from "remix/response/redirect";
import { createController } from "remix/router";
import { HomeMenu } from "../assets/home-menu.tsx";
import { assetServer } from "../assets.ts";
import { db } from "../db.ts";
import { routes } from "../routes.ts";
import { Document } from "../ui/document.tsx";

const DIR = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, "../..");

export default createController(routes, {
	actions: {
		async assets(context) {
			return (
				(await assetServer.fetch(context.request)) ??
				new Response("Not Found", { status: 404 })
			);
		},
		async home({ request, render }) {
			if (request.method === "POST") {
				if (isRateLimited()) {
					return new Response("Too Many Requests", { status: 429 });
				}
				const list = await db.shoppingList.create({ data: {} });
				return redirect(`/${list.id}`, 303);
			}
			return render(
				<Document title="Free shopping list web app">
					<div class="content-box home-page">
						<div class="home-page__header">
							<h1>Shopping List</h1>
							<h2>Simple - Secure - Free - Shareable - No login</h2>
						</div>
						<div class="home-menu">
							<HomeMenu />
						</div>
						<span aria-hidden="true" />
					</div>
				</Document>,
			);
		},
		async changelog({ render }) {
			const file = path.join(ROOT, "CHANGELOG.md");
			const markdown = await fs.readFile(file, "utf-8");
			const html = await marked(markdown);
			return render(
				<Document title="Changelog — Shopping List">
					<article class="content-box prose changelog-page" innerHTML={html} />
				</Document>,
			);
		},
		async about({ request, render }) {
			const lang = preferredLang(request.headers.get("accept-language"));
			const file = path.join(DIR, "about", `about.${lang}.md`);
			const markdown = await fs.readFile(file, "utf-8");
			const html = await marked(markdown);
			return render(
				<Document title="About — Shopping List">
					<div class="about-page">
						<div class="about-page__header">
							<h1>Shopping List</h1>
							<h2>Simple - Secure - Free - Shareable - No login</h2>
						</div>
						<article class="prose" innerHTML={html} />
					</div>
				</Document>,
			);
		},
	},
});

let rateLimitUntil = 0;

function isRateLimited(): boolean {
	const now = Date.now();
	if (now < rateLimitUntil) return true;
	rateLimitUntil = now + 5_000;
	return false;
}

function preferredLang(header: string | null): "de" | "en" {
	if (!header) return "en";
	const langs = header
		.split(",")
		.map((entry) =>
			entry.trim().split(";")[0]?.trim().toLowerCase().slice(0, 2),
		)
		.filter((lang): lang is string => lang !== undefined);
	return langs.includes("de") ? "de" : "en";
}
