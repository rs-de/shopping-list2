import assert from "node:assert/strict"
import { test } from "node:test"

import { generateId } from "./id.ts"

test("generateId returns a 10-character id", () => {
	assert.equal(generateId().length, 10)
})

// Must match controller.tsx's VALID_ID regex, or self-generated ids would
// fail their own validation.
test("generateId uses only URL-safe characters", () => {
	assert.match(generateId(), /^[A-Za-z0-9_-]{10}$/)
})

test("generateId does not repeat across many calls", () => {
	const ids = new Set(Array.from({ length: 10_000 }, generateId))
	assert.equal(ids.size, 10_000)
})
