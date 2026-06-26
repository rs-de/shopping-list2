import type { Handle } from "remix/ui"

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
