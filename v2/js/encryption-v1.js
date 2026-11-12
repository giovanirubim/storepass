// Reader for v1 codes (salt.content.checksum or salt/content-checksum).
// Decrypt only: new codes are always v2. The algorithm and format must not
// change, or codes already printed stop opening.

const encoder = new TextEncoder()

function bytesToHex(bytes) {
	return [...new Uint8Array(bytes)]
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('')
}

async function sha256Hex(text) {
	return bytesToHex(await crypto.subtle.digest('SHA-256', encoder.encode(text)))
}

// Keystream: sha256(salt + pass), sha256(salt + pass + ':1'), ... as hex
async function keystreamHex(salt, pass, length) {
	let out = ''
	for (let i = 0; out.length < length; i++) {
		out += await sha256Hex(salt + pass + (i === 0 ? '' : ':' + i))
	}
	return out.slice(0, length)
}

function xorHex(a, b) {
	let out = ''
	for (let i = 0; i < Math.min(a.length, b.length); i++) {
		out += (parseInt(a[i], 16) ^ parseInt(b[i], 16)).toString(16)
	}
	return out
}

// Same typo fixes v1 applied when reading a code
function fixTypos(text) {
	const map = { O: '0', o: '0', I: '1', i: '1', L: '1', l: '1', Z: '2', z: '2', S: '5', s: '5', G: '6', g: '9', _: '-' }
	return [...text.replace(/\s/g, '')]
		.map((char) => map[char] ?? char)
		.join('')
		.toLowerCase()
}

export function isV1(code) {
	return /[./]/.test(code)
}

// Splits a v1 code into its parts, or returns null if malformed
export function parseV1(code) {
	const fixed = fixTypos(code)
	const match =
		fixed.match(/^([0-9a-f]{6})\/([0-9a-f]+)-([0-9a-f]{2})$/) ||
		fixed.match(/^([0-9a-f]{6})\.([0-9a-f]+)\.([0-9a-f]{2})$/)
	if (!match || match[2].length % 2 !== 0) return null
	const [, salt, content, checksum] = match
	return { salt, content, checksum }
}

// Returns { ok: true, password } or { ok: false, error: 'invalid' | 'wrongPass' }.
// The v1 checksum does not cover the master password, so a wrong one is only
// caught when the result is not valid UTF-8.
export async function decryptV1(code, pass) {
	const parts = parseV1(code)
	if (!parts) return { ok: false, error: 'invalid' }
	const { salt, content, checksum } = parts
	if ((await sha256Hex(salt + content)).slice(0, 2) !== checksum) {
		return { ok: false, error: 'invalid' }
	}
	const plainHex = xorHex(await keystreamHex(salt, pass, content.length), content)
	const bytes = new Uint8Array(plainHex.match(/../g).map((x) => parseInt(x, 16)))
	try {
		const password = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
		return { ok: true, password }
	} catch {
		return { ok: false, error: 'wrongPass' }
	}
}
