import type { Handle, RemixNode } from "remix/ui"

import type { Lang, Translations } from "../i18n.ts"
import { routes } from "../routes.ts"
import { Footer } from "./footer.tsx"
import { Navbar } from "./navbar.tsx"

export interface DocumentProps {
	children?: RemixNode
	head?: RemixNode
	title?: string
	lang?: Lang
	t: Translations
	manifestHref?: string
}

const DEFAULT_TITLE = readAppDisplayName("Shopping%20List2")

export function Document(handle: Handle<DocumentProps>) {
	return () => {
		const {
			children,
			head,
			title = DEFAULT_TITLE,
			lang = "en",
			t,
			manifestHref = "/manifest.webmanifest",
		} = handle.props

		return (
			<html lang={lang}>
				<head>
					<meta charSet="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<meta name="theme-color" content="hsl(206, 100%, 50%)" />
					<meta
						name="description"
						content="A fast, offline-first shopping list. No login or account needed."
					/>
					<link rel="manifest" href={manifestHref} />
					<link rel="apple-touch-icon" href="/icons/apple-icon-180.png" />
					<link rel="icon" type="image/x-icon" href="/favicon.ico" />
					<link rel="stylesheet" href="/styles/main.css" />
					<title>{title}</title>
					{head}
				</head>
				<body>
					<div class="app-root">
						<Navbar />
						<main class="app-main">{children}</main>
						<Footer t={t} />
					</div>
					<script
						type="application/json"
						id="sl-i18n"
						innerHTML={JSON.stringify(t).replace(/</g, "\\u003c")}
					/>
					<script
						type="module"
						src={routes.assets.href({ path: "app/assets/entry.ts" })}
					></script>
				</body>
			</html>
		)
	}
}

function readAppDisplayName(value: string): string {
	return value.startsWith("%%") ? "Remix App" : decodeURIComponent(value)
}
