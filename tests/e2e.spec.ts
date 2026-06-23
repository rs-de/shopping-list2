import { expect, test } from "@playwright/test"

test("home page loads", async ({ page }) => {
	await page.goto("/")
	await expect(page.locator("h1")).toBeVisible()
	await expect(page.locator("button.home-menu__create-btn")).toBeVisible()
})

// Serial block so tests 2-3 share one list and avoid the 5s rate limiter
test.describe
	.serial("list workflow", () => {
		let listUrl = ""

		test("create list → navigate to list page", async ({ page }) => {
			await page.goto("/")
			await page.click("button.home-menu__create-btn")
			await page.waitForURL(/\/\w+$/)
			listUrl = page.url()
			await expect(page.locator("h1.sl-heading")).toBeVisible()
		})

		test("add article → persists after reload", async ({ page }) => {
			await page.goto(listUrl)

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
