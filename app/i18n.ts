import { AcceptLanguage } from "remix/headers/accept-language"

import {
	createT,
	type Lang,
	SUPPORTED_LANGS,
	type T,
} from "./utils/translate.ts"

export type { Lang, T } from "./utils/translate.ts"

export function preferredLang(header: string | null): Lang {
	return AcceptLanguage.from(header).getPreferred(SUPPORTED_LANGS) ?? "en"
}

export function getTranslations(request: Request): { lang: Lang; t: T } {
	const lang = preferredLang(request.headers.get("accept-language"))
	return { lang, t: createT(lang) }
}
