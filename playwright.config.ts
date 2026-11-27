import { defineConfig } from "@playwright/test"

// Lets context.route() see requests made by the service worker, so tests can
// stall the network behind the SW's cache (Chromium only).
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1"

// Own port and database, never shared with `pnpm dev` (44100): a reused or
// foreign server on the same port would make the suite test the wrong app.
const PORT = 44101
const URL = `http://localhost:${PORT}`

export default defineConfig({
	testDir: "./tests",
	use: {
		baseURL: URL,
	},
	webServer: {
		command: "node --import remix/node-tsx server.ts",
		url: URL,
		env: { PORT: String(PORT), DATABASE_URL: "file:./test.db" },
		reuseExistingServer: false,
		timeout: 30_000,
	},
})
