import { randomBytes } from "node:crypto"

import { createContextKey, type Middleware } from "remix/router"

// rc.2's <ImportMap> renders an inline <script type="importmap">, so a
// per-request nonce is required for it to run under our `script-src 'self'`
// policy. Generated here (not per-render) so the same value can be attached
// to both the CSP header and the <ImportMap nonce> prop for one request.
export const CspNonce = createContextKey<string>()

export function csp(): Middleware<{
	key: typeof CspNonce
	value: string
	property: "cspNonce"
}> {
	return async (context, next) => {
		const nonce = randomBytes(16).toString("base64")
		context.set(CspNonce, nonce, { property: "cspNonce" })
		const response = await next()
		const headers = new Headers(response.headers)
		headers.set(
			"Content-Security-Policy",
			`default-src 'self'; script-src 'self' 'nonce-${nonce}'; frame-ancestors 'none'`,
		)
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		})
	}
}
