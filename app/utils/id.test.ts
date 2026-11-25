import assert from "node:assert/strict"
import { test } from "node:test"

import { generateId, isValidId } from "./id.ts"

test("generateId returns a 10-character id", () => {
	assert.equal(generateId().length, 10)
})

test("generateId uses only URL-safe characters", () => {
	assert.match(generateId(), /^[A-Za-z0-9_-]{10}$/)
})

// The controllers validate incoming ids with isValidId, so self-generated
// ids must always pass it.
test("isValidId accepts generated ids and rejects other shapes", () => {
	for (let i = 0; i < 1_000; i++) assert.ok(isValidId(generateId()))
	for (const bad of ["", "short", "elevenchars", "has space!", "a/b.c%d$ef"]) {
		assert.equal(isValidId(bad), false, bad)
	}
})

test("generateId does not repeat across many calls", () => {
	const ids = new Set(Array.from({ length: 10_000 }, generateId))
	assert.equal(ids.size, 10_000)
})
