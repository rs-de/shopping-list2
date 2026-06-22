import lighthouse from "lighthouse";
import { chromium } from "playwright";

const PORT = 9_222;
const url = process.argv[2] ?? "http://localhost:44100";
const CATEGORIES = [
	"performance",
	"accessibility",
	"best-practices",
	"seo",
] as const;

const browser = await chromium.launch({
	args: [`--remote-debugging-port=${PORT}`, "--headless=new"],
});

const result = await lighthouse(url, {
	port: PORT,
	output: "json",
	logLevel: "error",
	onlyCategories: [...CATEGORIES],
}).finally(() => browser.close());

if (!result) throw new Error("Lighthouse returned no result");

const { categories, audits } = result.lhr;

console.log(`\nLighthouse — ${url}\n`);
for (const cat of Object.values(categories)) {
	const score = Math.round((cat.score ?? 0) * 100);
	const icon = score >= 90 ? "✓" : score >= 50 ? "!" : "✗";
	console.log(`  ${icon}  ${cat.title.padEnd(20)} ${score}`);
}

const failed = Object.values(audits)
	.filter((a) => a.score !== null && a.score < 1)
	.sort((a, b) => (a.score ?? 0) - (b.score ?? 0));

if (failed.length) {
	console.log("\nIssues to fix:\n");
	for (const a of failed) {
		const score = String(Math.round((a.score ?? 0) * 100)).padStart(3);
		console.log(`  [${score}]  ${a.title}`);
		if (a.displayValue) console.log(`         ${a.displayValue}`);
	}
}
console.log();
