export type Article = {
	id: string
	text: string
	sortKey: number
	createdAt: number
}

export const MAX_ARTICLES_PER_LIST = 500

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
