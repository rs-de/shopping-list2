// URL-safe alphabet of exactly 64 symbols: `byte & 63` maps every random
// byte onto it uniformly (256 is a multiple of 64), so there is no modulo
// bias. Same id shape as the nanoid(10) this replaced.
const ALPHABET =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-"

export const generateId = (size = 10) =>
	Array.from(
		crypto.getRandomValues(new Uint8Array(size)),
		(byte) => ALPHABET[byte & 63],
	).join("")
