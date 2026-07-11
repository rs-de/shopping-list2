type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

// Bound memory as distinct keys accumulate over time (one per list, and
// lists keep getting created) — prune opportunistically on write rather
// than on a timer, since a quiet app may otherwise never get the chance to.
const MAX_BUCKETS = 10_000

/** Fixed-window counter: allows up to `max` calls per `windowMs` for a given key. */
export function isRateLimited(key: string, windowMs = 5_000, max = 1): boolean {
	const now = Date.now()
	const bucket = buckets.get(key)
	if (!bucket || now >= bucket.resetAt) {
		buckets.set(key, { count: 1, resetAt: now + windowMs })
		if (buckets.size > MAX_BUCKETS) {
			for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k)
		}
		return false
	}
	if (bucket.count >= max) return true
	bucket.count++
	return false
}
