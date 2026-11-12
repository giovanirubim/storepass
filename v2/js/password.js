const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const DIGITS = '0123456789'
const SYMBOLS = '@$!#()[]'
const GROUPS = [UPPER, LOWER, DIGITS, SYMBOLS]
const ALL = GROUPS.join('')

// Uniform integer in [0, max), rejection sampling avoids modulo bias
function randomInt(max) {
	const limit = Math.floor(2 ** 32 / max) * max
	const value = new Uint32Array(1)
	do crypto.getRandomValues(value)
	while (value[0] >= limit)
	return value[0] % max
}

const pick = (chars) => chars[randomInt(chars.length)]

// One character of each group, the rest from all of them, then shuffled
export function generatePassword(length = 16) {
	const chars = GROUPS.map(pick)
	while (chars.length < length) chars.push(pick(ALL))
	for (let i = chars.length - 1; i > 0; i--) {
		const j = randomInt(i + 1)
		;[chars[i], chars[j]] = [chars[j], chars[i]]
	}
	return chars.join('')
}
