import { spawn } from "node:child_process"
import { chromium } from "@playwright/test"
import lighthouse from "lighthouse"

// Dedicated ports, never shared with `pnpm dev` (44100) or e2e (44101): with
// no URL argument, the audit always starts its own production server rather
// than auditing whatever happens to be listening.
const SERVER_PORT = 44_102
const DEBUG_PORT = 44_103
const url = process.argv[2] ?? `http://localhost:${SERVER_PORT}`
const CATEGORIES = [
	"performance",
	"accessibility",
	"best-practices",
	"seo",
] as const

const THRESHOLDS: Record<string, number> = {
	performance: 80,
	accessibility: 90,
	"best-practices": 90,
	seo: 90,
}

async function isServerUp(): Promise<boolean> {
	try {
		await fetch(url, { signal: AbortSignal.timeout(1000) })
		return true
	} catch {
		return false
	}
}

async function waitForServer(ms = 10_000): Promise<void> {
	const deadline = Date.now() + ms
	while (Date.now() < deadline) {
		if (await isServerUp()) return
		await new Promise((r) => setTimeout(r, 300))
	}
	throw new Error(`Server not ready at ${url} after ${ms}ms`)
}

let serverProcess: ReturnType<typeof spawn> | null = null

if (!process.argv[2]) {
	if (await isServerUp()) {
		throw new Error(`Port ${SERVER_PORT} is already in use`)
	}
	serverProcess = spawn("node", ["--import", "remix/node-tsx", "server.ts"], {
		stdio: "ignore",
		env: {
			...process.env,
			NODE_ENV: "production",
			PORT: String(SERVER_PORT),
			DATABASE_URL: "file:./test.db",
		},
	})
}

const result = await (async () => {
	try {
		if (serverProcess) await waitForServer()
		const browser = await chromium.launch({
			args: [`--remote-debugging-port=${DEBUG_PORT}`, "--headless=new"],
		})
		try {
			return await lighthouse(url, {
				port: DEBUG_PORT,
				output: "json",
				logLevel: "error",
				onlyCategories: [...CATEGORIES],
			})
		} finally {
			await browser.close()
		}
	} finally {
		serverProcess?.kill()
	}
})()

if (!result) throw new Error("Lighthouse returned no result")

const { categories, audits } = result.lhr

console.log(`\nLighthouse — ${url}\n`)

const failures: string[] = []
for (const cat of Object.values(categories)) {
	const score = Math.round((cat.score ?? 0) * 100)
	const threshold = THRESHOLDS[cat.id] ?? 0
	const pass = score >= threshold
	const icon = pass ? "✓" : "✗"
	console.log(`  ${icon}  ${cat.title.padEnd(20)} ${score}  (min ${threshold})`)
	if (!pass) failures.push(`${cat.title}: ${score} < ${threshold}`)
}

const failed = Object.values(audits)
	.filter((a) => a.score !== null && a.score < 1)
	.sort((a, b) => (a.score ?? 0) - (b.score ?? 0))

if (failed.length) {
	console.log("\nIssues:\n")
	for (const a of failed) {
		const score = String(Math.round((a.score ?? 0) * 100)).padStart(3)
		console.log(`  [${score}]  ${a.title}`)
		if (a.displayValue) console.log(`         ${a.displayValue}`)
	}
}

if (failures.length) {
	console.log(
		`\nFailed thresholds:\n${failures.map((f) => `  • ${f}`).join("\n")}\n`,
	)
	process.exit(1)
}

console.log()
