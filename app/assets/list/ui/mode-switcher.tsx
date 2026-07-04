import { type Handle, on } from "remix/ui"

import type { Translations } from "../../../i18n.ts"

export type Mode = "articles" | "plan" | "shopping"

const ORDER: readonly Mode[] = ["articles", "plan", "shopping"]

function hrefFor(listId: string, mode: Mode): string {
	return mode === "articles" ? `/${listId}` : `/${listId}/${mode}`
}

function labelFor(t: Translations, mode: Mode): string {
	return mode === "articles"
		? t.mode_articles
		: mode === "plan"
			? t.mode_plan
			: t.mode_shopping
}

type Props = { listId: string; active: Mode; t: Translations }

/**
 * Plain nav, no hydration needed — flanks the centered heading with
 * prev/next links (wrapping) between the three modes.
 */
export function ModeSwitcher(handle: Handle<Props>) {
	// Mode links force a real browser navigation instead of the app's SPA
	// soft-navigation: switching modes means swapping to a completely
	// different top-level client component (a different bundle), which the
	// soft-nav's frame-reload isn't designed for — it can race and get stuck
	// re-fetching the current URL instead of the destination. A full
	// navigation is also simply correct here regardless of that bug, since
	// there's no shared component state to preserve across mode switches.
	function goTo(e: MouseEvent, href: string) {
		e.preventDefault()
		window.location.assign(href)
	}

	return () => {
		const { listId, active, t } = handle.props
		const idx = ORDER.indexOf(active)
		const prev = ORDER[(idx - 1 + ORDER.length) % ORDER.length]
		const next = ORDER[(idx + 1) % ORDER.length]
		const prevHref = hrefFor(listId, prev)
		const nextHref = hrefFor(listId, next)
		return (
			<div class="sl-heading-row">
				<a
					href={prevHref}
					class="sl-mode-link sl-mode-link--prev"
					mix={on("click", (e) => goTo(e, prevHref))}
				>
					‹ {labelFor(t, prev)}
				</a>
				<h1 class="sl-heading">{t.ShoppingList}</h1>
				<a
					href={nextHref}
					class="sl-mode-link sl-mode-link--next"
					mix={on("click", (e) => goTo(e, nextHref))}
				>
					{labelFor(t, next)} ›
				</a>
			</div>
		)
	}
}
