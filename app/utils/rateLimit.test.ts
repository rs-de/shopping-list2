import assert from "node:assert/strict"
import { test } from "node:test"

import { isRateLimited } from "./rateLimit.ts"

test("isRateLimited opens a window on the first call, then blocks until it elapses", (t) => {
	t.mock.timers.enable({ apis: ["Date"], now: 0 })

	assert.equal(isRateLimited(1000), false, "first call opens the window")
	assert.equal(isRateLimited(1000), true, "a call within the window is limited")

	t.mock.timers.tick(999)
	assert.equal(
		isRateLimited(1000),
		true,
		"still limited 1ms before the window closes",
	)

	t.mock.timers.tick(1)
	assert.equal(
		isRateLimited(1000),
		false,
		"no longer limited once the window closes",
	)
})
