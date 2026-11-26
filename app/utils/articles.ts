export type Article = {
	id: string
	text: string
	sortKey: number
	createdAt: number
}

export const MAX_ARTICLES_PER_LIST = 500

/** Server-side cap; the edit inputs use a tighter maxLength for typing. */
export const MAX_ARTICLE_TEXT_LENGTH = 256

/** Largest rejig partition count the UI offers (3, 5 or 7 columns). */
const MAX_REJIG_PARTITIONS = 7

// New articles get generateId()'s 10 chars, but stored lists may hold ids
// from older code, so accept any short URL-safe id rather than exactly 10 —
// rejecting a stored id would make that list's sync fail forever.
const ARTICLE_ID = /^[A-Za-z0-9_-]{1,64}$/

export function isValidArticleId(value: unknown): value is string {
	return typeof value === "string" && ARTICLE_ID.test(value)
}

export function isValidPartition(value: number): boolean {
	return Number.isInteger(value) && value >= 1 && value <= MAX_REJIG_PARTITIONS
}

/**
 * Rebuilds an article from untrusted input with only the known, type-checked
 * fields — extra properties are dropped, so clients can't store arbitrary
 * data. Returns null when any field is missing or out of bounds.
 */
export function parseArticle(value: unknown): Article | null {
	if (typeof value !== "object" || value === null) return null
	const { id, text, sortKey, createdAt } = value as Record<string, unknown>
	if (
		!isValidArticleId(id) ||
		typeof text !== "string" ||
		text.length > MAX_ARTICLE_TEXT_LENGTH ||
		typeof sortKey !== "number" ||
		!Number.isFinite(sortKey) ||
		typeof createdAt !== "number" ||
		!Number.isFinite(createdAt)
	) {
		return null
	}
	return { id, text, sortKey, createdAt }
}

/**
 * Rejig bucket assignments use even sortKeys and not-yet-rejigged articles
 * default to an odd one (see defaultSortKey) so an explicit "Late" rejig
 * always sorts after still-undecided articles instead of tying with them.
 */
export function rejigSortKey(partitionNumber: number): number {
	return partitionNumber * 2
}

/** Sits strictly between the last two rejig buckets — see rejigSortKey. */
export function defaultSortKey(rejigN: number): number {
	return rejigN * 2 - 1
}

export function sortArticles(articles: Article[]): Article[] {
	return [...articles].sort((a, b) => {
		if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey
		return a.createdAt - b.createdAt
	})
}

/** Articles-page display order: original add order, independent of Plan's sortKey grouping. */
export function sortByCreatedAt(articles: Article[]): Article[] {
	return [...articles].sort((a, b) => a.createdAt - b.createdAt)
}
