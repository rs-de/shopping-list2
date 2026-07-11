import assert from "node:assert/strict"
import { test } from "node:test"

import type { Article } from "./articles.ts"
import { sortArticles, sortByCreatedAt } from "./articles.ts"

function article(overrides: Partial<Article> & Pick<Article, "id">): Article {
	return { text: "text", sortKey: 0, createdAt: 0, ...overrides }
}

test("sortArticles orders by sortKey, then by createdAt within a tie", () => {
	const a = article({ id: "a", sortKey: 1, createdAt: 200 })
	const b = article({ id: "b", sortKey: 0, createdAt: 100 })
	const c = article({ id: "c", sortKey: 1, createdAt: 100 })

	assert.deepEqual(
		sortArticles([a, b, c]).map((x) => x.id),
		["b", "c", "a"],
	)
})

test("sortArticles does not mutate the input array", () => {
	const list = [
		article({ id: "a", sortKey: 1 }),
		article({ id: "b", sortKey: 0 }),
	]
	const copy = [...list]
	sortArticles(list)
	assert.deepEqual(list, copy)
})

// Regression test for #97: the Articles page must show original add order,
// ignoring Plan mode's sortKey grouping.
test("sortByCreatedAt orders by createdAt regardless of sortKey", () => {
	const a = article({ id: "a", sortKey: 0, createdAt: 300 })
	const b = article({ id: "b", sortKey: 5, createdAt: 100 })
	const c = article({ id: "c", sortKey: 2, createdAt: 200 })

	assert.deepEqual(
		sortByCreatedAt([a, b, c]).map((x) => x.id),
		["b", "c", "a"],
	)
})
