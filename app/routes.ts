import { get, route } from "remix/routes"

export const routes = route({
	assets: get("/assets/*path"),
	sw: get("/sw.js"),
	manifest: get("/manifest.webmanifest"),
	version: get("/api/version"),
	home: "/",
	about: get("/about"),
	changelog: get("/changelog"),
	list: {
		show: "/:listId",
		plan: "/:listId/plan",
		shopping: "/:listId/shopping",
		manifest: get("/:listId/manifest"),
	},
	notFound: get("/*path"),
})
