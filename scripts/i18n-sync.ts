import * as fs from "node:fs"
import * as path from "node:path"
import * as url from "node:url"

import { CONFIGURED_LANGUAGES } from "../app/utils/i18n.ts"

const ROOT = path.resolve(
	path.dirname(url.fileURLToPath(import.meta.url)),
	"..",
)
const SCAN_DIR = path.join(ROOT, "app")
const I18N_DIR = path.join(ROOT, "app/i18n")

const CHECK = process.argv.includes("--check")

function listSourceFiles(dir: string): string[] {
	const out: string[] = []
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name)
		if (entry.isDirectory()) {
			if (full === I18N_DIR) continue
			out.push(...listSourceFiles(full))
		} else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
			out.push(full)
		}
	}
	return out
}

// Matches `t(` followed by a string or template literal — the one hard
// constraint the sync script relies on: the text must always be a literal,
// never built at runtime, or it can't be found here. A regex rather than the
// TypeScript compiler API, which TypeScript 7 (the native port) doesn't ship.
const T_CALL_PATTERN = /\bt\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g

/** Finds every `t("...")` call with a string-literal first argument. */
function findTranslationCalls(file: string): string[] {
	const source = fs.readFileSync(file, "utf-8")
	const found: string[] = []
	for (const match of source.matchAll(T_CALL_PATTERN)) {
		const raw = match[0].slice("t(".length).trim()
		if (raw.includes("${")) {
			console.warn(
				`${file}: skipping a t() call with a dynamic template literal — the text must be a plain string literal.`,
			)
			continue
		}
		// The matched literal is valid JS source (same quoting/escaping rules
		// as the file it came from), so evaluating it is the simplest correct
		// unescape — this only ever runs against our own trusted repo source.
		found.push(new Function(`return (${raw})`)() as string)
	}
	return found
}

async function loadDictionary(lang: string): Promise<Record<string, string>> {
	const file = path.join(I18N_DIR, `${lang}.ts`)
	if (!fs.existsSync(file)) return {}
	const mod = (await import(url.pathToFileURL(file).href)) as Record<
		string,
		Record<string, string>
	>
	return mod[lang] ?? {}
}

function serializeDictionary(
	lang: string,
	dict: Record<string, string>,
): string {
	const sortedKeys = Object.keys(dict).sort()
	const body = sortedKeys
		.map((key) => `\t${JSON.stringify(key)}: ${JSON.stringify(dict[key])},`)
		.join("\n")
	return (
		"// Generated/maintained by `pnpm i18n:sync` — do not hand-edit keys, only values.\n" +
		`export const ${lang}: Record<string, string> = {\n${body}\n}\n`
	)
}

async function main() {
	const files = listSourceFiles(SCAN_DIR)
	const used = new Set<string>()
	for (const file of files) {
		for (const text of findTranslationCalls(file)) used.add(text)
	}

	let failed = false

	for (const lang of CONFIGURED_LANGUAGES) {
		const dict = await loadDictionary(lang)
		const missing = [...used].filter((key) => !(key in dict))
		const stale = Object.keys(dict).filter((key) => !used.has(key))
		const stubs = [...used].filter(
			(key) => dict[key] !== undefined && dict[key] === key,
		)

		if (CHECK) {
			if (missing.length > 0) {
				failed = true
				console.error(
					`[${lang}] missing translation for ${missing.length} string(s):`,
				)
				for (const key of missing) console.error(`  - ${JSON.stringify(key)}`)
			}
			if (stale.length > 0) {
				failed = true
				console.error(
					`[${lang}] ${stale.length} key(s) no longer used in source — run \`pnpm i18n:sync\` to remove them:`,
				)
				for (const key of stale) console.error(`  - ${JSON.stringify(key)}`)
			}
			if (!failed) {
				console.log(`[${lang}] up to date (${used.size} strings).`)
			}
		} else {
			const next = { ...dict }
			for (const key of missing) next[key] = key
			for (const key of stale) delete next[key]
			if (missing.length > 0 || stale.length > 0) {
				fs.writeFileSync(
					path.join(I18N_DIR, `${lang}.ts`),
					serializeDictionary(lang, next),
				)
			}
			if (missing.length === 0 && stale.length === 0) {
				console.log(`[${lang}] up to date (${used.size} strings).`)
			}
			if (missing.length > 0) {
				console.log(`[${lang}] added ${missing.length} new key(s):`)
				for (const key of missing) console.log(`  - ${JSON.stringify(key)}`)
			}
			if (stale.length > 0) {
				console.log(`[${lang}] removed ${stale.length} unused key(s):`)
				for (const key of stale) console.log(`  - ${JSON.stringify(key)}`)
			}
		}

		if (stubs.length > 0) {
			console.warn(
				`[${lang}] ${stubs.length} translation(s) still match the English source (unfinished stub?):`,
			)
			for (const key of stubs) console.warn(`  - ${JSON.stringify(key)}`)
		}
	}

	if (CHECK && failed) process.exitCode = 1
}

await main()
