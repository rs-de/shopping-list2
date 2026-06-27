import { expect, type Page, test } from "@playwright/test"

// Shared across both serial blocks — avoids creating a second list and hitting
// the 5 s rate limiter.
let listUrl = ""

test("home page loads", async ({ page }) => {
	await page.goto("/")
	await expect(page.locator("h1")).toBeVisible()
	await expect(page.locator("button.home-menu__create-btn")).toBeVisible()
})

test.describe.serial("list workflow", () => {
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
})

// Each test delays PATCH responses by 2 s via page.route(), then asserts the
// DOM updated within 1 s — proving the UI didn't wait for the server.
// Reuses the list from "list workflow" to avoid the 5 s rate limiter.
test.describe.serial("optimistic updates", () => {
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

	test("add article updates list before server responds", async ({ page }) => {
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

	test("delete article removes it before server responds", async ({ page }) => {
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
		await page.locator('button:has-text("Clear list")').first().click()
		await page.locator('.sl-dialog button:has-text("Clear list")').click()
		await expect(page.locator("input.sl-item-input")).toHaveCount(0, {
			timeout: 1000,
		})
		await page.waitForResponse((r) => r.request().method() === "PATCH")
		await page.unrouteAll()
	})

	test("rejig moves article before server responds", async ({ page }) => {
		await page.goto(listUrl, { waitUntil: "networkidle" })
		const existing = await page.locator("input.sl-item-input").count()
		for (let i = existing; i < 6; i++) await addAndWait(page, `Item ${i + 1}`)
		const firstText = await page
			.locator("input.sl-item-input")
			.first()
			.inputValue()
		await page
			.locator('input[type="checkbox"][aria-label="Select article"]')
			.first()
			.check()
		await slowPatch(page)
		await page.locator('button.sl-rejig-btn:has-text("Late")').click()
		await expect(page.locator("input.sl-item-input").last()).toHaveValue(
			firstText,
			{ timeout: 1000 },
		)
		await page.waitForResponse((r) => r.request().method() === "PATCH")
		await page.unrouteAll()
	})
})

test("404 for unknown multi-segment path", async ({ page }) => {
	const res = await page.goto("/foo/bar/baz")
	expect(res?.status()).toBe(404)
	await expect(page.locator("h1.error-page__code")).toHaveText("404")
})

test("404 for unknown list ID", async ({ page }) => {
	const res = await page.goto("/not-a-real-list-id-xyzzy")
	expect(res?.status()).toBe(404)
	await expect(page.locator("h1.error-page__code")).toHaveText("404")
})

test("/api/version returns version string", async ({ request }) => {
	const res = await request.get("/api/version")
	expect(res.status()).toBe(200)
	const body = (await res.json()) as { version: string }
	expect(typeof body.version).toBe("string")
	expect(body.version.length).toBeGreaterThan(0)
})
