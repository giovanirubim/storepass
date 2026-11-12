import { decodeBase32, encodeBase32, normalizeBase32 } from './base32.js'
import { decryptV1, isV1 } from './encryption-v1.js'

// v2: PBKDF2-SHA256 (600k) -> AES-128-GCM, zero IV, 32-bit tag.
// The zero IV is safe because every code has its own random salt, so its own key.
// Changing any of these parameters means a new version ("3"), never editing v2.
const VERSION = '2'
const SALT_BYTES = 8
const TAG_BYTES = 4
const ITERATIONS = 600000

const encoder = new TextEncoder()

async function deriveKey(pass, salt) {
	const base = await crypto.subtle.importKey(
		'raw',
		encoder.encode(pass),
		'PBKDF2',
		false,
		['deriveKey']
	)
	return crypto.subtle.deriveKey(
		{ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
		base,
		{ name: 'AES-GCM', length: 128 },
		false,
		['encrypt', 'decrypt']
	)
}

const gcm = { name: 'AES-GCM', iv: new Uint8Array(12), tagLength: TAG_BYTES * 8 }

// Returns the code without hyphens, e.g. "21G26TGAP7..."
export async function encrypt(pass, text) {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
	const key = await deriveKey(pass, salt)
	const sealed = new Uint8Array(
		await crypto.subtle.encrypt(gcm, key, encoder.encode(text))
	)
	const bytes = new Uint8Array(SALT_BYTES + sealed.length)
	bytes.set(salt)
	bytes.set(sealed, SALT_BYTES)
	return VERSION + encodeBase32(bytes)
}

// Splits a v2 code into salt and ciphertext+tag, or returns null if malformed
export function parseV2(code) {
	const clean = normalizeBase32(code)
	if (clean[0] !== VERSION) return null
	const body = clean.slice(1)
	const bytes = decodeBase32(body)
	if (!bytes || bytes.length < SALT_BYTES + TAG_BYTES + 1) return null
	// A valid code has exactly as many characters as its bytes need,
	// which catches most dropped or doubled characters
	if (body.length !== Math.ceil((bytes.length * 8) / 5)) return null
	return { salt: bytes.slice(0, SALT_BYTES), sealed: bytes.slice(SALT_BYTES) }
}

export function isValidCode(code) {
	return isV1(code) ? true : parseV2(code) !== null
}

// Returns { ok: true, password, version } or
// { ok: false, error: 'invalid' | 'wrongPass' }
export async function decrypt(code, pass) {
	if (isV1(code)) {
		const result = await decryptV1(code, pass)
		return result.ok ? { ...result, version: 1 } : result
	}
	const parts = parseV2(code)
	if (!parts) return { ok: false, error: 'invalid' }
	const key = await deriveKey(pass, parts.salt)
	try {
		const plain = await crypto.subtle.decrypt(gcm, key, parts.sealed)
		const password = new TextDecoder('utf-8', { fatal: true }).decode(plain)
		return { ok: true, password, version: 2 }
	} catch {
		return { ok: false, error: 'wrongPass' }
	}
}

// "21G26TGAP7..." -> "21G26-TGAP7-..."
export function formatCode(code) {
	return normalizeBase32(code).match(/.{1,5}/g).join('-')
}

// The code as it goes in a link: no hyphens, uppercase
export function compactCode(code) {
	return normalizeBase32(code)
}
