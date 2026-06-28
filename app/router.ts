import { compression } from "remix/middleware/compression"
import { staticFiles } from "remix/middleware/static"
import { createRouter, type MiddlewareContext } from "remix/router"

import controller from "./actions/controller.tsx"
import listController from "./actions/list/controller.tsx"
import { render } from "./middleware/render.tsx"
import { routes } from "./routes.ts"

type AppContext = MiddlewareContext<[ReturnType<typeof render>]>

declare module "remix/router" {
	interface RouterTypes {
		context: AppContext
	}
}

export const router = createRouter<AppContext>({
	middleware: [
		compression(),
		staticFiles("./public", { index: false }),
		render(),
	],
})

router.map(routes, controller)
router.map(routes.list, listController)
