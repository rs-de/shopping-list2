import assert from "node:assert/strict"
import { test } from "node:test"

import { isRateLimited } from "./rateLimit.ts"

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
