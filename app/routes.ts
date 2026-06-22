import { get, route } from "remix/routes";

export const routes = route({
	assets: get("/assets/*path"),
	sw: get("/sw.js"),
	home: "/",
	about: get("/about"),
	changelog: get("/changelog"),
	list: {
		show: "/:listId",
		manifest: get("/:listId/manifest"),
	},
});
