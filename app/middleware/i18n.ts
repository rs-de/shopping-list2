import { createContextKey, type Middleware } from "remix/router"

import {
	createTranslator,
	type Lang,
	resolveLang,
	type Translator,
} from "../utils/i18n.ts"

export type I18n = { lang: Lang; t: Translator }

export const I18nKey = createContextKey<I18n>()

/** Resolves the request's language once and exposes it as `context.i18n`. */
export function i18n(): Middleware<{
	key: typeof I18nKey
	value: I18n
	property: "i18n"
}> {
	return (context, next) => {
		const lang = resolveLang(context.headers.get("accept-language"))
		context.set(
			I18nKey,
			{ lang, t: createTranslator(lang) },
			{ property: "i18n" },
		)
		return next()
	}
}
