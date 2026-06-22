import * as http from "node:http";
import * as path from "node:path";
import { createRequestListener } from "remix/node-fetch-server";

import { router } from "./app/router.ts";

const STATIC_EXTS = new Set([
	"css",
	"js",
	"webp",
	"png",
	"jpg",
	"ico",
	"svg",
	"woff",
	"woff2",
	"ttf",
	"gif",
]);

function withCacheHeaders(response: Response, url: URL): Response {
	const ext = path.extname(url.pathname).slice(1).toLowerCase();
	if (!response.ok || !STATIC_EXTS.has(ext)) return response;
	const headers = new Headers(response.headers);
	// SW must never be immutably cached — browsers check for updates on every load
	if (url.pathname === "/sw.js") {
		headers.set("Cache-Control", "no-cache");
	} else {
		headers.set("Cache-Control", "public, max-age=31536000, immutable");
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100;

const server = http.createServer(
	createRequestListener(async (request) => {
		const url = new URL(request.url);
		try {
			return withCacheHeaders(await router.fetch(request), url);
		} catch (error) {
			if (!(request.signal.aborted && error === request.signal.reason)) {
				console.error(error);
			}
			return new Response("Internal Server Error", { status: 500 });
		}
	}),
);

server.listen(port, () => {
	console.log(`Server listening on http://localhost:${port}`);
});

let shuttingDown = false;

function shutdown() {
	if (shuttingDown) {
		return;
	}

	shuttingDown = true;
	server.close(() => process.exit(0));
	server.closeAllConnections();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
