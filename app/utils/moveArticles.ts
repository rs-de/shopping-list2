export type Article = { id: string; text: string }

export function moveArticles({
	idsToRejig,
	partitionNumber,
	partitionCount,
	articles,
}: {
	idsToRejig: string[]
	partitionNumber: number
	partitionCount: number
	articles: Article[]
}): Article[] {
	const filteredArticles = articles.filter(({ id }) => !idsToRejig.includes(id))
	const articlesToRejig = articles.filter(({ id }) => idsToRejig.includes(id))
	const startIndex = Math.max(
		0,
		Math.floor(
			(partitionNumber - 1) *
				Math.floor(articles.length / (partitionCount - 1)),
		),
	)
	const result = filteredArticles.slice()
	result.splice(startIndex, 0, ...articlesToRejig)
	return result
}
