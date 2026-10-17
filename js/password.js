const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const DIGITS = '0123456789'
const SPECIAL = '@$!#()[]'
const ALL = UPPER + LOWER + DIGITS + SPECIAL

// Uniform random integer in [0, max), using rejection sampling to avoid bias
function randomInt(max) {
	const limit = Math.floor(2 ** 32 / max) * max
	const buff = new Uint32Array(1)
	do {
		crypto.getRandomValues(buff)
	} while (buff[0] >= limit)
	return buff[0] % max
}

function randomChar(charset) {
	return charset[randomInt(charset.length)]
}

// At least one character of each kind, the rest from all of them, shuffled
export function generatePassword(length = 16) {
	const chars = [UPPER, LOWER, DIGITS, SPECIAL].map(randomChar)
	while (chars.length < length) chars.push(randomChar(ALL))
	for (let i = chars.length - 1; i > 0; i--) {
		const j = randomInt(i + 1)
		;[chars[i], chars[j]] = [chars[j], chars[i]]
	}
	return chars.join('')
}
