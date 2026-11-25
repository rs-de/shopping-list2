// URL-safe alphabet of exactly 64 symbols: `byte & 63` maps every random
// byte onto it uniformly (256 is a multiple of 64), so there is no modulo
// bias. Same id shape as the nanoid(10) this replaced.
const ALPHABET =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-"

const ID_LENGTH = 10

const VALID_ID = new RegExp(`^[A-Za-z0-9_-]{${ID_LENGTH}}$`)

export const generateId = () =>
	Array.from(
		crypto.getRandomValues(new Uint8Array(ID_LENGTH)),
		(byte) => ALPHABET[byte & 63],
	).join("")

/** Whether `value` has the shape `generateId()` produces. */
export const isValidId = (value: string) => VALID_ID.test(value)
