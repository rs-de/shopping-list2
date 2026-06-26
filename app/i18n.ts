import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as url from "node:url"

import { AcceptLanguage } from "remix/headers/accept-language"

export type Lang = "de" | "en"
export type Translations = Record<string, string>

const DIR = path.dirname(url.fileURLToPath(import.meta.url))

const SUPPORTED = ["en", "de"] as const satisfies readonly Lang[]

export function preferredLang(header: string | null): Lang {
	return AcceptLanguage.from(header).getPreferred(SUPPORTED) ?? "en"
}

export async function loadTranslations(lang: Lang): Promise<Translations> {
	const file = path.join(DIR, `../public/locales/${lang}/common.json`)
	const content = await fs.readFile(file, "utf-8")
	return JSON.parse(content) as Translations
}

export async function getTranslations(
	request: Request,
): Promise<{ lang: Lang; t: Translations }> {
	const lang = preferredLang(request.headers.get("accept-language"))
	const t = await loadTranslations(lang)
	return { lang, t }
}
