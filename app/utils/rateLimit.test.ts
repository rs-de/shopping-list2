import assert from "node:assert/strict"
import { test } from "node:test"

import { clientIp, isRateLimited } from "./rateLimit.ts"

test("isRateLimited (default max 1) opens a window per key, then blocks until it elapses", (t) => {
	t.mock.timers.enable({ apis: ["Date"], now: 0 })

	assert.equal(isRateLimited("a", 1000), false, "first call opens the window")
	assert.equal(
		isRateLimited("a", 1000),
		true,
		"a call within the window is limited",
	)
	assert.equal(
		isRateLimited("b", 1000),
		false,
		"a different key has its own window",
	)

	t.mock.timers.tick(999)
	assert.equal(
		isRateLimited("a", 1000),
		true,
		"still limited 1ms before the window closes",
	)

	t.mock.timers.tick(1)
	assert.equal(
		isRateLimited("a", 1000),
		false,
		"no longer limited once the window closes",
	)
})

test("isRateLimited allows up to max calls per window before blocking", (t) => {
	t.mock.timers.enable({ apis: ["Date"], now: 0 })

	assert.equal(isRateLimited("c", 1000, 3), false)
	assert.equal(isRateLimited("c", 1000, 3), false)
	assert.equal(isRateLimited("c", 1000, 3), false)
	assert.equal(
		isRateLimited("c", 1000, 3),
		true,
		"4th call within the window is limited",
	)

	t.mock.timers.tick(1000)
	assert.equal(
		isRateLimited("c", 1000, 3),
		false,
		"count resets once the window closes",
	)
})

test("clientIp prefers Fly-Client-IP over X-Forwarded-For", () => {
	const request = new Request("http://localhost", {
		headers: { "fly-client-ip": "1.2.3.4", "x-forwarded-for": "5.6.7.8" },
	})
	assert.equal(clientIp(request), "1.2.3.4")
})

test("clientIp falls back to the first X-Forwarded-For entry", () => {
	const request = new Request("http://localhost", {
		headers: { "x-forwarded-for": "5.6.7.8, 9.9.9.9" },
	})
	assert.equal(clientIp(request), "5.6.7.8")
})

test('clientIp falls back to "unknown" when neither header is present', () => {
	const request = new Request("http://localhost")
	assert.equal(clientIp(request), "unknown")
})
