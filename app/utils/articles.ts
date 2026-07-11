export type Article = {
	id: string
	text: string
	sortKey: number
	createdAt: number
}

export const MAX_ARTICLES_PER_LIST = 500

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
