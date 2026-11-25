import type { Handle, RemixNode } from "remix/component"

import type { I18n } from "../middleware/i18n.ts"
import { Document } from "./document.tsx"

type Props = {
	code: number
	message: string
	href: string
	label: string
}

export function ErrorPage(handle: Handle<Props>) {
	return () => {
		const { code, message, href, label } = handle.props
		return (
			<div class="content-box error-page">
				<h1 class="error-page__code">{code}</h1>
				<p class="error-page__msg">{message}</p>
				<a href={href} class="btn btn-primary">
					{label}
				</a>
			</div>
		)
	}
}

export type Render = (
	node: RemixNode,
	init?: ResponseInit,
) => Response | Promise<Response>

/**
 * A full HTML error document with `code` as its status. HTML (not plain
 * text) matters for navigations: Remix's frame resolver rejects non-HTML
 * 4xx responses, and a no-JS browser would otherwise show a bare string.
 */
export function renderErrorPage(
	render: Render,
	{ lang }: I18n,
	props: Props,
): Response | Promise<Response> {
	return render(
		<Document title={`${props.code} — Shopping List`} lang={lang}>
			<ErrorPage {...props} />
		</Document>,
		{ status: props.code },
	)
}
