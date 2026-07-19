import * as fs from "node:fs"
import * as path from "node:path"
import * as url from "node:url"
import ts from "typescript"

import { SUPPORTED_LANGS } from "../app/utils/translate.ts"

const ROOT = path.resolve(
	path.dirname(url.fileURLToPath(import.meta.url)),
	"..",
)
const SCAN_DIR = path.join(ROOT, "app")
const LOCALES_DIR = path.join(ROOT, "app/utils/locales")
const TARGET_LANGS = SUPPORTED_LANGS.filter((lang) => lang !== "en")

const CHECK = process.argv.includes("--check")

function listSourceFiles(dir: string): string[] {
	const out: string[] = []
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name)
		if (entry.isDirectory()) {
			out.push(...listSourceFiles(full))
		} else if (
			/\.tsx?$/.test(entry.name) &&
			!entry.name.endsWith(".test.ts") &&
			!full.startsWith(LOCALES_DIR)
		) {
			out.push(full)
		}
	}
	return out
}

/** Finds every `t("...")` call with a string-literal first argument — the one hard constraint the sync script relies on for static extraction. */
function findTranslationCalls(file: string): string[] {
	const source = fs.readFileSync(file, "utf-8")
	const sourceFile = ts.createSourceFile(
		file,
		source,
		ts.ScriptTarget.Latest,
		true,
		file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
	)
	const found: string[] = []
	function visit(node: ts.Node) {
		if (
			ts.isCallExpression(node) &&
			ts.isIdentifier(node.expression) &&
			node.expression.text === "t" &&
			node.arguments.length > 0 &&
			ts.isStringLiteralLike(node.arguments[0])
		) {
			found.push(node.arguments[0].text)
		}
		ts.forEachChild(node, visit)
	}
	visit(sourceFile)
	return found
}

async function loadDictionary(lang: string): Promise<Record<string, string>> {
	const file = path.join(LOCALES_DIR, `${lang}.ts`)
	if (!fs.existsSync(file)) return {}
	const mod = (await import(url.pathToFileURL(file).href)) as {
		default: Record<string, string>
	}
	return mod.default
}

function serializeDictionary(dict: Record<string, string>): string {
	const entries = Object.entries(dict)
		.map(
			([key, value]) => `\t${JSON.stringify(key)}: ${JSON.stringify(value)},`,
		)
		.join("\n")
	return `/**
 * Translations, keyed by the exact English source text passed to \`t()\`.
 * Maintained by \`pnpm i18n:sync\` — new keys discovered in source are
 * appended here stubbed with the English text; translate by hand
 * afterward. Run \`pnpm i18n:check\` to fail if a \`t()\` call has no entry.
 */
export default {
${entries}
} satisfies Record<string, string>
`
}

async function main() {
	const files = listSourceFiles(SCAN_DIR)
	const used = new Set<string>()
	for (const file of files) {
		for (const text of findTranslationCalls(file)) used.add(text)
	}

	let failed = false

	for (const lang of TARGET_LANGS) {
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
		} else if (missing.length > 0) {
			const next = { ...dict }
			for (const key of missing) next[key] = key
			fs.writeFileSync(
				path.join(LOCALES_DIR, `${lang}.ts`),
				serializeDictionary(next),
			)
			console.log(`[${lang}] added ${missing.length} new key(s):`)
			for (const key of missing) console.log(`  - ${JSON.stringify(key)}`)
		} else {
			console.log(`[${lang}] up to date (${used.size} strings).`)
		}

		if (stale.length > 0) {
			console.warn(
				`[${lang}] ${stale.length} unused translation(s) (no longer in source):`,
			)
			for (const key of stale) console.warn(`  - ${JSON.stringify(key)}`)
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
