import { expect, type Page, test } from "@playwright/test"

// Shared across both serial blocks — avoids creating a second list and hitting
// the 5 s rate limiter.
let listUrl = ""

test("home page loads", async ({ page }) => {
	await page.goto("/")
	await expect(page.locator("h1")).toBeVisible()
	await expect(page.locator("button.home-menu__create-btn")).toBeVisible()
})

test.describe
	.serial("list workflow", () => {
		test("create list → navigate to list page", async ({ page }) => {
			await page.goto("/")
			await page.click("button.home-menu__create-btn")
			await page.waitForURL(/\/[A-Za-z0-9_-]{10}$/)
			listUrl = page.url()
			await expect(page.locator("h1.sl-heading")).toBeVisible()
		})

		test("add article → persists after reload", async ({ page }) => {
			await page.goto(listUrl, { waitUntil: "networkidle" })

			await page.fill("input.sl-add-input", "Milk")
			const patchDone = page.waitForResponse(
				(r) => r.request().method() === "PATCH",
			)
			await page.keyboard.press("Enter")
			await patchDone

			await expect(page.locator("input.sl-item-input").first()).toHaveValue(
				"Milk",
			)

			await page.reload()
			await expect(page.locator("input.sl-item-input").first()).toHaveValue(
				"Milk",
			)
		})

		test("articles mode has no rejig UI even with a long list", async ({
			page,
		}) => {
			await page.goto(listUrl, { waitUntil: "networkidle" })
			for (let i = 0; i < 6; i++) {
				await page.fill("input.sl-add-input", `Extra ${i}`)
				const done = page.waitForResponse(
					(r) => r.request().method() === "PATCH",
				)
				await page.keyboard.press("Enter")
				await done
			}
			await expect(page.locator(".sl-rejig-column")).toHaveCount(0)
		})

		// Smoke test for the mode-split routing/controller plumbing (routes.ts +
		// controller.tsx's loadAndMutateList helper), added before any
		// mode-specific client UI exists — both still render the same
		// (temporary) component as /:listId.
		test("plan and shopping routes exist and render", async ({
			page,
			request,
		}) => {
			const planRes = await request.get(`${listUrl}/plan`)
			expect(planRes.status()).toBe(200)
			const shoppingRes = await request.get(`${listUrl}/shopping`)
			expect(shoppingRes.status()).toBe(200)

			await page.goto(`${listUrl}/plan`)
			await expect(page.locator("h1.sl-heading")).toBeVisible()
			await page.goto(`${listUrl}/shopping`)
			await expect(page.locator("h1.sl-heading")).toBeVisible()
		})

		test("mode switcher navigates prev/next between all three modes", async ({
			page,
		}) => {
			await page.goto(listUrl, { waitUntil: "networkidle" })
			await page.click("a.sl-mode-link--next") // articles -> plan
			await page.waitForURL(`${listUrl}/plan`)
			await page.click("a.sl-mode-link--next") // plan -> shopping
			await page.waitForURL(`${listUrl}/shopping`)
			await page.click("a.sl-mode-link--next") // shopping -> articles (wraps)
			await page.waitForURL(listUrl)
			await page.click("a.sl-mode-link--prev") // articles -> shopping (wraps)
			await page.waitForURL(`${listUrl}/shopping`)
		})
	})

// Each test delays PATCH responses by 2 s via page.route(), then asserts the
// DOM updated within 1 s — proving the UI didn't wait for the server.
// Reuses the list from "list workflow" to avoid the 5 s rate limiter.
test.describe
	.serial("optimistic updates", () => {
		async function addAndWait(page: Page, text: string) {
			await page.fill("input.sl-add-input", text)
			const done = page.waitForResponse((r) => r.request().method() === "PATCH")
			await page.keyboard.press("Enter")
			await done
		}

		async function slowPatch(page: Page) {
			await page.route("**", async (route) => {
				if (route.request().method() === "PATCH")
					await new Promise((r) => setTimeout(r, 2000))
				await route.continue()
			})
		}

		test("add article updates list before server responds", async ({
			page,
		}) => {
			await page.goto(listUrl, { waitUntil: "networkidle" })
			await slowPatch(page)
			await page.fill("input.sl-add-input", "Butter")
			await page.keyboard.press("Enter")
			await expect(page.locator("input.sl-item-input").last()).toHaveValue(
				"Butter",
				{ timeout: 1000 },
			)
			await page.waitForResponse((r) => r.request().method() === "PATCH")
			await page.unrouteAll()
		})

		test("change article text is visible before server responds", async ({
			page,
		}) => {
			await page.goto(listUrl, { waitUntil: "networkidle" })
			await addAndWait(page, "Eggs")
			const input = page.locator("input.sl-item-input").last()
			await slowPatch(page)
			await input.fill("Bread")
			await expect(input).toHaveValue("Bread", { timeout: 1000 })
			// debounce is 750 ms + 2 s route delay → allow 5 s
			await page.waitForResponse((r) => r.request().method() === "PATCH", {
				timeout: 5000,
			})
			await page.unrouteAll()
		})

		test("delete article removes it before server responds", async ({
			page,
		}) => {
			await page.goto(listUrl, { waitUntil: "networkidle" })
			await addAndWait(page, "Sugar")
			const count = await page.locator("input.sl-item-input").count()
			await slowPatch(page)
			await page
				.locator('input[type="checkbox"][aria-label="Select article"]')
				.last()
				.check()
			await page.click("button.sl-delete-btn")
			await expect(page.locator("input.sl-item-input")).toHaveCount(count - 1, {
				timeout: 1000,
			})
			await page.waitForResponse((r) => r.request().method() === "PATCH")
			await page.unrouteAll()
		})

		test("clear list empties it before server responds", async ({ page }) => {
			await page.goto(listUrl, { waitUntil: "networkidle" })
			if ((await page.locator("input.sl-item-input").count()) === 0)
				await addAndWait(page, "Flour")
			await slowPatch(page)
			await page.locator("button.sl-clear-btn").first().click()
			await page.locator('.sl-dialog button:has-text("Clear list")').click()
			await expect(page.locator("input.sl-item-input")).toHaveCount(0, {
				timeout: 1000,
			})
			await page.waitForResponse((r) => r.request().method() === "PATCH")
			await page.unrouteAll()
		})

		test("rejig moves article before server responds", async ({ page }) => {
			// Adding is articles-mode only; rejig lives on /plan.
			await page.goto(listUrl, { waitUntil: "networkidle" })
			const existing = await page.locator("input.sl-item-input").count()
			for (let i = existing; i < 6; i++) await addAndWait(page, `Item ${i + 1}`)
			const lastText = await page
				.locator("input.sl-item-input")
				.last()
				.inputValue()

			await page.goto(`${listUrl}/plan`, { waitUntil: "networkidle" })
			// All items default to the last sortKey bucket; select the last item and
			// move it to the first bucket (Early) — it should appear first immediately.
			await page
				.locator('input[type="checkbox"][aria-label="Select article"]')
				.last()
				.check()
			await slowPatch(page)
			await page.locator('button.sl-rejig-btn:has-text("Early")').click()
			await expect(page.locator("input.sl-item-input").first()).toHaveValue(
				lastText,
				{ timeout: 1000 },
			)
			await page.waitForResponse((r) => r.request().method() === "PATCH")
			await page.unrouteAll()
		})

		test("rejigN selection persists across page reload", async ({ page }) => {
			await page.goto(`${listUrl}/plan`, { waitUntil: "networkidle" })
			// Rejig column is unconditionally visible in plan mode — no
			// checkbox needed to reveal it.
			await expect(page.locator(".sl-rejig-column")).toBeVisible()
			await page.selectOption("select.sl-rejig-select", "5")
			await page.reload({ waitUntil: "networkidle" })
			await expect(page.locator("select.sl-rejig-select")).toHaveValue("5")
		})

		test("delete still works from plan mode", async ({ page }) => {
			await page.goto(`${listUrl}/plan`, { waitUntil: "networkidle" })
			const before = await page.locator("input.sl-item-input").count()
			await page
				.locator('input[type="checkbox"][aria-label="Select article"]')
				.first()
				.check()
			await page.click("button.sl-delete-btn")
			await expect(page.locator("input.sl-item-input")).toHaveCount(before - 1)
		})

		test("shopping mode has no editable inputs and delete works", async ({
			page,
		}) => {
			await page.goto(`${listUrl}/shopping`, { waitUntil: "networkidle" })
			await expect(page.locator("input.sl-item-input")).toHaveCount(0)
			const before = await page.locator(".sl-item-text").count()
			expect(before).toBeGreaterThan(0)
			await page
				.locator('input[type="checkbox"][aria-label="Select article"]')
				.first()
				.check()
			await page.click("button.sl-delete-btn")
			await expect(page.locator(".sl-item-text")).toHaveCount(before - 1)
		})
	})

// Regression test for a real data-loss path: a non-dirty IndexedDB snapshot
// from a previous visit must never be resurrected onto the server. The old
// bug let a stale snapshot become the live working state on reload; if two
// mutations then raced (a common client hiccup), the client marked itself
// "dirty" with that stale base and later flushed it whole via replaceArticles
// — silently reviving items another device had removed. This test forces
// that exact race and checks the *server's* final state, not a UI flash,
// since a transient flash self-corrects and isn't the real loss. See the IDB
// init block in app/assets/list/utils/sync.ts.
test.describe
	.serial("local-first sync", () => {
		// The Service Worker's own fetch() calls aren't visible to page.route()
		// (Playwright can't intercept requests a SW handles internally), which
		// would silently defeat the delays below. Block it for this test.
		test.use({ serviceWorkers: "block" })

		test("stale IDB snapshot cannot resurrect data removed by another device", async ({
			page,
			request,
		}) => {
			const listPath = new URL(listUrl).pathname

			// First visit in this browser context seeds IndexedDB with the
			// current (non-dirty) server state — this becomes the "stale"
			// snapshot once another device changes the list underneath it.
			await page.goto(listUrl, { waitUntil: "networkidle" })
			if ((await page.locator("input.sl-item-input").count()) === 0) {
				await page.fill("input.sl-add-input", "Cheese")
				const done = page.waitForResponse(
					(r) => r.request().method() === "PATCH",
				)
				await page.keyboard.press("Enter")
				await done
			}
			const staleTexts = await page
				.locator("input.sl-item-input")
				.evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value))
			expect(staleTexts.length).toBeGreaterThan(0)

			// Simulate another device clearing the list directly on the server —
			// this browser's IndexedDB is left holding the stale, non-dirty copy.
			await request.patch(listPath, { form: { _action: "clearList" } })

			// Delay both the background reconciliation fetch (pullFromServer)
			// and PATCH responses, so: (a) the stale IDB snapshot has time to
			// become the live state before the server correction lands, and
			// (b) two rapid adds are forced to overlap in flight, which marks
			// the client dirty using that stale base as its snapshot.
			await page.route("**", async (route) => {
				const req = route.request()
				if (req.method() === "PATCH") {
					await new Promise((r) => setTimeout(r, 1000))
				} else if (
					req.method() === "GET" &&
					req.headers().accept?.includes("application/json")
				) {
					await new Promise((r) => setTimeout(r, 5000))
				}
				// The first patch is aborted client-side once the second starts,
				// which can resolve this route before we get here — ignore that.
				await route.continue().catch(() => {})
			})

			// Capture the engine's "sl:sync-ready" signal (fired once the IDB-init
			// decision has been applied) before it can possibly fire, so we can
			// deterministically await it instead of guessing a fixed delay for
			// what is otherwise a fast but async IDB round trip.
			await page.addInitScript(() => {
				;(window as unknown as { __syncReady: Promise<void> }).__syncReady =
					new Promise((resolve) => {
						window.addEventListener("sl:sync-ready", () => resolve(), {
							once: true,
						})
					})
			})
			await page.reload()
			await page.evaluate(
				() => (window as unknown as { __syncReady: Promise<void> }).__syncReady,
			)
			await page.fill("input.sl-add-input", "Bread")
			await page.keyboard.press("Enter")
			await page.fill("input.sl-add-input", "Butter")
			await page.keyboard.press("Enter")
			await page.unrouteAll()

			// Wait for the resulting dirty-flush (replaceArticles) to land.
			await page
				.waitForResponse(
					(r) =>
						r.request().method() === "PATCH" &&
						(r.request().postData() ?? "").includes("replaceArticles"),
					{ timeout: 15_000 },
				)
				.catch(() => {})

			const finalState = await request.get(listPath, {
				headers: { accept: "application/json" },
			})
			const { articles } = (await finalState.json()) as {
				articles: { text: string }[]
			}
			const finalTexts = articles.map((a) => a.text)
			// None of the items removed by "the other device" may reappear.
			for (const text of staleTexts) {
				expect(finalTexts).not.toContain(text)
			}

			// Restore original contents for subsequent tests sharing this list.
			await request.patch(listPath, {
				form: {
					_action: "replaceArticles",
					articles: JSON.stringify(
						staleTexts.map((text, i) => ({
							id: `restore-${i}`,
							text,
							sortKey: 3,
							createdAt: Date.now(),
						})),
					),
				},
			})
		})
	})

// POST→redirect helper: waitForURL detects navigation even when URL stays the same
async function submitAndWait(page: Page, click: () => Promise<void>) {
	await Promise.all([
		page.waitForURL((url) => url.href === listUrl, { waitUntil: "load" }),
		click(),
	])
}

test.describe
	.serial("no-JS fallback", () => {
		test.use({ javaScriptEnabled: false })

		test("add article via POST redirects back with new item", async ({
			page,
		}) => {
			await page.goto(listUrl)
			const before = await page.locator("input.sl-item-input").count()
			await page.fill("input.sl-add-input", "NoJS Item")
			await submitAndWait(page, () => page.click("button.sl-add-btn"))
			await expect(page.locator("input.sl-item-input")).toHaveCount(before + 1)
			await expect(page.locator("input.sl-item-input").last()).toHaveValue(
				"NoJS Item",
			)
		})

		test("plan mode shows rejig column immediately, no reveal delay", async ({
			page,
		}) => {
			await page.goto(`${listUrl}/plan`)
			await expect(page.locator(".sl-rejig-column")).toBeVisible()
		})

		test("checked checkbox reveals delete bar via CSS :has()", async ({
			page,
		}) => {
			await page.goto(listUrl)
			await expect(page.locator(".sl-delete-bar")).not.toBeInViewport()
			await page
				.locator('input[type="checkbox"][aria-label="Select article"]')
				.first()
				.check()
			await expect(page.locator(".sl-delete-bar")).toBeInViewport()
		})

		test("delete selected via POST removes the article", async ({ page }) => {
			await page.goto(listUrl)
			const before = await page.locator("input.sl-item-input").count()
			await page
				.locator('input[type="checkbox"][aria-label="Select article"]')
				.first()
				.check()
			// Delete bar slides in with a 300ms CSS transition; wait for the
			// button itself to reach the viewport before submitting
			await expect(page.locator("button.sl-delete-btn")).toBeInViewport()
			await submitAndWait(page, () =>
				page.locator("button.sl-delete-btn").click({ force: true }),
			)
			await expect(page.locator("input.sl-item-input")).toHaveCount(before - 1)
		})

		test("clear list via POST empties list without dialog", async ({
			page,
		}) => {
			await page.goto(listUrl)
			// Without JS the toolbar Clear list button submits directly — no dialog
			await submitAndWait(page, () =>
				page.locator("button.sl-clear-btn").first().click(),
			)
			await expect(page.locator("input.sl-item-input")).toHaveCount(0)
		})

		test("rejig via POST moves selected article to front", async ({ page }) => {
			await page.goto(listUrl)
			// List is empty after the clear above — add 6 items via POST
			for (const text of ["A", "B", "C", "D", "E", "F"]) {
				await page.fill("input.sl-add-input", text)
				await submitAndWait(page, () => page.click("button.sl-add-btn"))
			}
			const lastText = await page
				.locator("input.sl-item-input")
				.last()
				.inputValue()
			// Rejig UI lives on /plan, not the articles route.
			await page.goto(`${listUrl}/plan`)
			await expect(page.locator(".sl-rejig-column")).toBeVisible()
			await page
				.locator('input[type="checkbox"][aria-label="Select article"]')
				.last()
				.check()
			// first rejig button = partition 1 = "Early" = lowest sortKey
			const planUrl = `${listUrl}/plan`
			await Promise.all([
				page.waitForURL((url) => url.href === planUrl, { waitUntil: "load" }),
				page.locator("button.sl-rejig-btn").first().click(),
			])
			await expect(page.locator("input.sl-item-input").first()).toHaveValue(
				lastText,
			)
		})

		test("shopping mode delete works via POST, no JS", async ({ page }) => {
			const shoppingUrl = `${listUrl}/shopping`
			await page.goto(shoppingUrl)
			await expect(page.locator("input.sl-item-input")).toHaveCount(0)
			const before = await page.locator(".sl-item-text").count()
			expect(before).toBeGreaterThan(0)
			await page
				.locator('input[type="checkbox"][aria-label="Select article"]')
				.first()
				.check()
			// Delete bar slides in with a 300ms CSS transition; wait for the
			// button itself to reach the viewport before submitting
			await expect(page.locator("button.sl-delete-btn")).toBeInViewport()
			await Promise.all([
				page.waitForURL((url) => url.href === shoppingUrl, {
					waitUntil: "load",
				}),
				page.locator("button.sl-delete-btn").click({ force: true }),
			])
			await expect(page.locator(".sl-item-text")).toHaveCount(before - 1)
		})
	})

test("404 for unknown multi-segment path", async ({ page }) => {
	const res = await page.goto("/foo/bar/baz")
	expect(res?.status()).toBe(404)
	await expect(page.locator("h1.error-page__code")).toHaveText("404")
})

test("400 for syntactically invalid list ID", async ({ page }) => {
	const res = await page.goto("/not-a-real-list-id-xyzzy")
	expect(res?.status()).toBe(400)
	await expect(page.locator("h1.error-page__code")).toHaveText("400")
})

test("valid-format unknown ID redirects to home with recreate prompt", async ({
	page,
	request,
}) => {
	await request.delete("/wipe_test1") // ensure list doesn't exist
	const res = await page.goto("/wipe_test1")
	expect(res?.status()).toBe(200)
	await expect(page).toHaveURL(/\?recreate=wipe_test1/)
	await expect(page.locator("h1")).toBeVisible()
})

test("/api/version returns version string", async ({ request }) => {
	const res = await request.get("/api/version")
	expect(res.status()).toBe(200)
	const body = (await res.json()) as { version: string }
	expect(typeof body.version).toBe("string")
	expect(body.version.length).toBeGreaterThan(0)
})

// Regression test: iOS Safari has served a stale cached /sw.js for its own
// update-comparison fetch, so a new worker was never detected (only fixed by
// wiping site data). Registering with a per-deploy query string forces that
// fetch to be a new URL each time — verify the registration actually carries
// one, since it's easy to "clean up" as dead-looking code later.
test("service worker registers with a cache-busting version query", async ({
	page,
}) => {
	await page.goto("/")
	const scriptURL = await page.evaluate(async () => {
		const reg = await navigator.serviceWorker.ready
		return reg.active?.scriptURL ?? null
	})
	expect(scriptURL).toMatch(/\/sw\.js\?v=.+/)
})

// Regression test: soft navigations (client router's resolveFrame fetch, used
// for e.g. the navbar logo link) went through networkFirst, which ignores the
// cache and always waits on the network — so a slow/cold origin made the link
// feel unresponsive. Static pages are now precached on install and served via
// staleWhileRevalidate for these fetches too, so this must resolve instantly
// even when the network is slow.
test("precached pages make soft navigation instant even on a slow network", async ({
	page,
}) => {
	await page.goto("/")
	await page.waitForFunction(async () => {
		const reg = await navigator.serviceWorker.getRegistration()
		return reg?.active?.state === "activated"
	})
	await expect
		.poll(
			() =>
				page.evaluate(async () => {
					const keys = await caches.keys()
					if (keys.length === 0) return []
					const cache = await caches.open(keys[0])
					const reqs = await cache.keys()
					return reqs.map((r) => new URL(r.url).pathname).sort()
				}),
			{ timeout: 5000 },
		)
		.toEqual(["/about", "/changelog", "/"].sort())

	await page.goto("/about", { waitUntil: "networkidle" })
	await page.route("**", async (route) => {
		const req = route.request()
		if (
			new URL(req.url()).pathname === "/" &&
			req.headers().accept?.includes("text/html")
		) {
			await new Promise((r) => setTimeout(r, 3000))
		}
		await route.continue().catch(() => {})
	})

	await page.click('a[href="/"]')
	await expect(page.locator("button.home-menu__create-btn")).toBeVisible({
		timeout: 1000,
	})
	await page.unrouteAll()
})

// Regression test: networkFirst() used to only cache responses with
// content-type text/html. JS/CSS modules served under /assets/ aren't
// "static assets" per the SW's own isStaticAsset check, so they went
// through networkFirst too — meaning they were never cached at all. The app
// worked fine online (always fresh network) but broke completely offline,
// since the JS that hydrates the list never loaded. Only the specific
// pullFromServer JSON GET (which shares its URL with the HTML page and
// would otherwise clobber that page's cached HTML) should be excluded.
test("list stays usable offline: shows existing articles and queues new ones", async ({
	page,
	context,
}) => {
	await page.goto(listUrl, { waitUntil: "networkidle" })
	await page.waitForFunction(async () => {
		const reg = await navigator.serviceWorker.getRegistration()
		return reg?.active?.state === "activated"
	})
	// Reload once so the (already-active) SW actually intercepts and caches
	// this page's JS/CSS — matching a real "used the app before" visit.
	await page.reload({ waitUntil: "networkidle" })
	const before = await page.locator("input.sl-item-input").count()
	expect(before).toBeGreaterThan(0)

	await context.setOffline(true)
	await page.reload()
	await expect(page.locator("input.sl-item-input")).toHaveCount(before, {
		timeout: 5000,
	})

	await page.fill("input.sl-add-input", "Offline item")
	await page.keyboard.press("Enter")
	await expect(page.locator("input.sl-item-input").last()).toHaveValue(
		"Offline item",
	)

	await context.setOffline(false)
})
