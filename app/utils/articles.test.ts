import assert from "node:assert/strict"
import { test } from "node:test"

import type { Article } from "./articles.ts"
import {
	isValidPartition,
	MAX_ARTICLE_TEXT_LENGTH,
	parseArticle,
	sortArticles,
	sortByCreatedAt,
} from "./articles.ts"

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

test("parseArticle keeps only known fields and rejects bad shapes", () => {
	const ok = { id: "abc_DEF-12", text: "Milk", sortKey: 5, createdAt: 1 }
	assert.deepEqual(parseArticle({ ...ok, evil: "x".repeat(1000) }), ok)
	// Ids from older code (any short URL-safe id) must stay valid.
	assert.deepEqual(parseArticle({ ...ok, id: "restore-0" }), {
		...ok,
		id: "restore-0",
	})
	for (const bad of [
		null,
		"str",
		[],
		{ ...ok, id: "" },
		{ ...ok, id: "a/b" },
		{ ...ok, id: "x".repeat(65) },
		{ ...ok, text: 3 },
		{ ...ok, text: "x".repeat(MAX_ARTICLE_TEXT_LENGTH + 1) },
		{ ...ok, sortKey: "5" },
		{ ...ok, sortKey: Number.POSITIVE_INFINITY },
		{ ...ok, createdAt: Number.NaN },
	]) {
		assert.equal(parseArticle(bad), null, JSON.stringify(bad))
	}
})

test("isValidPartition accepts 1–7 integers only", () => {
	for (const n of [1, 4, 7]) assert.ok(isValidPartition(n), String(n))
	for (const n of [0, 8, 2.5, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
		assert.equal(isValidPartition(n), false, String(n))
	}
})
