import de from "./locales/de.ts"

export type Lang = "en" | "de"

export const SUPPORTED_LANGS: readonly Lang[] = ["en", "de"]

const DICTIONARIES: Partial<Record<Lang, Record<string, string>>> = { de }

function interpolate(
	template: string,
	params?: Record<string, string | number>,
): string {
	if (!params) return template
	return template.replace(/\{(\w+)\}/g, (match, key) =>
		key in params ? String(params[key]) : match,
	)
}

export type T = (
	template: string,
	params?: Record<string, string | number>,
) => string

/**
 * English needs no dictionary — `t()` just interpolates the source text
 * directly. Other languages look the source text up by its exact value,
 * falling back to the literal English if a translation hasn't been added
 * yet (never a broken or blank string).
 */
export function createT(lang: Lang): T {
	const dict = DICTIONARIES[lang]
	return (template, params) => interpolate(dict?.[template] ?? template, params)
}
