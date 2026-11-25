import { compression } from "remix/middleware/compression"
import { csp } from "remix/middleware/csp"
import { formData } from "remix/middleware/form-data"
import { render } from "remix/middleware/render"
import { staticFiles } from "remix/middleware/static"
import { createRouter, type MiddlewareContext } from "remix/router"

import controller from "./actions/controller.tsx"
import listController from "./actions/list/controller.tsx"
import { assetServer } from "./assets.ts"
import { i18n } from "./middleware/i18n.ts"
import { routes } from "./routes.ts"

type AppContext = MiddlewareContext<
	[
		ReturnType<typeof csp>,
		ReturnType<typeof formData>,
		ReturnType<typeof i18n>,
		ReturnType<typeof render>,
	]
>

declare module "remix/router" {
	interface RouterTypes {
		context: AppContext
	}
}

export const router = createRouter<AppContext>({
	middleware: [
		// render() stamps this request's nonce on the generated <ImportMap>.
		csp({
			policy: ({ nonce }) => ({
				defaultSrc: ["'self'"],
				scriptSrc: ["'self'", `'nonce-${nonce}'`],
				frameAncestors: ["'none'"],
			}),
		}),
		compression(),
		staticFiles("./public", { index: false }),
		// Missing or malformed bodies become an empty FormData, so a bad POST
		// gets the normal 400 path instead of a thrown parse error (500).
		formData({ suppressErrors: true }),
		i18n(),
		render({ assets: assetServer }),
	],
})

router.map(routes, controller)
router.map(routes.list, listController)
