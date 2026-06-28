let until = 0

export function isRateLimited(windowMs = 5_000): boolean {
	const now = Date.now()
	if (now < until) return true
	until = now + windowMs
	return false
}
