import type { Translations } from "../i18n.ts"

export function getTranslations(): Translations {
	const el = document.getElementById("sl-i18n")
	return el ? (JSON.parse(el.textContent!) as Translations) : ({} as Translations)
}
