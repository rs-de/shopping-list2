import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as url from "node:url";

import { marked } from "marked";
import { createController } from "remix/router";

import { assetServer } from "../assets.ts";
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
		home(context) {
			return context.render(
				<Document>
					<h1>Hello World</h1>
				</Document>,
			);
		},
		async changelog({ render }) {
			const file = path.join(ROOT, "CHANGELOG.md");
			const markdown = await fs.readFile(file, "utf-8");
			const html = await marked(markdown);
			return render(
				<Document title="Changelog — Shopping List">
					<article class="prose changelog-page" innerHTML={html} />
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
