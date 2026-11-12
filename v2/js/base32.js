// Crockford Base32: no I, L, O, U, so codes are hard to misread
export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function encodeBase32(bytes) {
	let out = ''
	let buffer = 0
	let bits = 0
	for (const byte of bytes) {
		buffer = (buffer << 8) | byte
		bits += 8
		while (bits >= 5) {
			bits -= 5
			out += ALPHABET[(buffer >>> bits) & 31]
		}
		buffer &= (1 << bits) - 1
	}
	if (bits > 0) out += ALPHABET[(buffer << (5 - bits)) & 31]
	return out
}

// Case-insensitive, ignores spaces and hyphens, reads O as 0 and I/L as 1
export function normalizeBase32(text) {
	return text
		.toUpperCase()
		.replace(/[\s-]/g, '')
		.replace(/O/g, '0')
		.replace(/[IL]/g, '1')
}

// Returns null if a character is not in the alphabet.
// Leftover bits at the end (fewer than 8) are discarded.
export function decodeBase32(text) {
	const clean = normalizeBase32(text)
	const bytes = []
	let buffer = 0
	let bits = 0
	for (const char of clean) {
		const value = ALPHABET.indexOf(char)
		if (value < 0) return null
		buffer = (buffer << 5) | value
		bits += 5
		if (bits >= 8) {
			bits -= 8
			bytes.push((buffer >>> bits) & 255)
		}
		buffer &= (1 << bits) - 1
	}
	return new Uint8Array(bytes)
}
