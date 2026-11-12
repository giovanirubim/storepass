// Visual signature of the master password: an animated curve (see password-curve.js).
// Lets the user notice a typo without typing the password twice.
//
// It is a verifier for the master password, so the curve is never fed the password
// itself: it gets a seed derived from a slow hash, keeping only 24 bits. Someone who
// sees the figure gains little for an offline attack. Never printed, never stored.

import { PasswordCurve } from './password-curve.js'

const SALT = 'storepass-v2-visual'
const ITERATIONS = 300000 // fixed: the figure must be the same on every device

// Fixed look, so the figure is the same on every device and in light/dark mode
const LOOK = {
	minLen: 1, // empty seed shows the neutral (gray circle) curve
	bg: 'dark', // matches the .signature background in main.css
	ext: 0.82, // leave room for the stroke in the small boxes
}

const encoder = new TextEncoder()

// Returns a 24-bit seed (6 hex chars) for the master password
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
	return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Creates the animated figure on a canvas. Show a seed with view.setPassword(seed),
// or the neutral figure with view.setPassword('').
export function createSignatureView(canvas, { thick }) {
	return new PasswordCurve(canvas, { ...LOOK, thick })
}
