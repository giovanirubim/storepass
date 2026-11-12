// Visual signature of the master password: a 2x2 grid of colored shapes.
// Lets the user notice a typo without typing the password twice.
//
// It is a verifier for the master password, so it is derived from a slow hash
// and uses only 24 bits: someone who sees it gains little for an offline attack.
// Never printed, never stored.

const SALT = 'storepass-v2-visual'
const ITERATIONS = 300000 // fixed: the figure must be the same on every device

export const COLORS = [
	'#e53935', // red
	'#fb8c00', // orange
	'#fdd835', // yellow
	'#43a047', // green
	'#1e88e5', // blue
	'#8e24aa', // purple
	'#ec407a', // pink
	'#6d4c41', // brown
]

// Shapes drawn in a 100x100 box
const SHAPES = [
	'<circle cx="50" cy="50" r="38"/>',
	'<rect x="14" y="14" width="72" height="72" rx="6"/>',
	'<path d="M50 10 L90 84 L10 84 Z"/>',
	'<path d="M50 6 L94 50 L50 94 L6 50 Z"/>',
	'<path d="M50 6 L61 37 L94 38 L68 58 L77 90 L50 71 L23 90 L32 58 L6 38 L39 37 Z"/>',
	'<path d="M50 88 C20 66 8 50 8 33 C8 19 19 10 31 10 C40 10 46 15 50 22 C54 15 60 10 69 10 C81 10 92 19 92 33 C92 50 80 66 50 88 Z"/>',
	'<path d="M28 12 L72 12 L94 50 L72 88 L28 88 L6 50 Z"/>',
	'<path d="M36 8 H64 V36 H92 V64 H64 V92 H36 V64 H8 V36 H36 Z"/>',
]

const encoder = new TextEncoder()

// Returns 4 cells, each { shape, color } with indexes 0-7
export async function computeSignature(pass) {
	const base = await crypto.subtle.importKey(
		'raw',
		encoder.encode(pass),
		'PBKDF2',
		false,
		['deriveBits']
	)
	const bytes = new Uint8Array(
		await crypto.subtle.deriveBits(
			{ name: 'PBKDF2', salt: encoder.encode(SALT), iterations: ITERATIONS, hash: 'SHA-256' },
			base,
			24
		)
	)
	const bits = (bytes[0] << 16) | (bytes[1] << 8) | bytes[2]
	const cells = []
	for (let i = 0; i < 4; i++) {
		const value = (bits >>> (18 - 6 * i)) & 63
		cells.push({ shape: value >> 3, color: value & 7 })
	}
	return cells
}

export function signatureSVG(cells) {
	const parts = cells.map(({ shape, color }, i) => {
		const x = (i % 2) * 100
		const y = Math.floor(i / 2) * 100
		return `<g transform="translate(${x + 5} ${y + 5}) scale(0.9)" fill="${COLORS[color]}">${SHAPES[shape]}</g>`
	})
	return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" stroke="rgba(0,0,0,.35)" stroke-width="3" stroke-linejoin="round">${parts.join('')}</svg>`
}
