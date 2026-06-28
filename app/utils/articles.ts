export type Article = {
	id: string
	text: string
	sortKey: number
	createdAt: number
}

export function sortArticles(articles: Article[]): Article[] {
	return [...articles].sort((a, b) => {
		if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey
		return a.createdAt - b.createdAt
	})
}
