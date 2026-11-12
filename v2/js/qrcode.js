// Minimal QR code encoder (ISO/IEC 18004), byte and alphanumeric segments.
// Returns a square boolean matrix (true = dark), without the quiet zone.

const ECL = {
	L: { index: 0, formatBits: 1 },
	M: { index: 1, formatBits: 0 },
	Q: { index: 2, formatBits: 3 },
	H: { index: 3, formatBits: 2 },
}

// Indexed by [ecl][version]
const ECC_PER_BLOCK = [
	[-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
	[-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
	[-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
	[-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
]
const NUM_BLOCKS = [
	[-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
	[-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
	[-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
	[-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
]

const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:'

const MODES = {
	byte: { bits: 0x4, countBits: [8, 16, 16] },
	alnum: { bits: 0x2, countBits: [9, 11, 13] },
}

function countBits(mode, version) {
	return MODES[mode].countBits[version <= 9 ? 0 : version <= 26 ? 1 : 2]
}

function pushBits(out, value, length) {
	for (let i = length - 1; i >= 0; i--) out.push((value >>> i) & 1)
}

// A segment is { mode, count, bits }
export function byteSegment(text) {
	const bytes = new TextEncoder().encode(text)
	const bits = []
	for (const byte of bytes) pushBits(bits, byte, 8)
	return { mode: 'byte', count: bytes.length, bits }
}

export function isAlnum(text) {
	return [...text].every((char) => ALNUM.includes(char))
}

export function alnumSegment(text) {
	const bits = []
	let i = 0
	for (; i + 1 < text.length; i += 2) {
		pushBits(bits, ALNUM.indexOf(text[i]) * 45 + ALNUM.indexOf(text[i + 1]), 11)
	}
	if (i < text.length) pushBits(bits, ALNUM.indexOf(text[i]), 6)
	return { mode: 'alnum', count: text.length, bits }
}

function segmentsBitLength(segments, version) {
	let total = 0
	for (const seg of segments) {
		const cb = countBits(seg.mode, version)
		if (seg.count >= 1 << cb) return Infinity
		total += 4 + cb + seg.bits.length
	}
	return total
}

function rawDataModules(version) {
	let result = (16 * version + 128) * version + 64
	if (version >= 2) {
		const numAlign = Math.floor(version / 7) + 2
		result -= (25 * numAlign - 10) * numAlign - 55
		if (version >= 7) result -= 36
	}
	return result
}

function dataCodewords(version, ecl) {
	return (
		Math.floor(rawDataModules(version) / 8) -
		ECC_PER_BLOCK[ecl.index][version] * NUM_BLOCKS[ecl.index][version]
	)
}

// --- Reed-Solomon over GF(2^8), polynomial 0x11D ---

function gfMultiply(x, y) {
	let z = 0
	for (let i = 7; i >= 0; i--) {
		z = (z << 1) ^ ((z >>> 7) * 0x11d)
		z ^= ((y >>> i) & 1) * x
	}
	return z & 0xff
}

function rsDivisor(degree) {
	const result = new Array(degree).fill(0)
	result[degree - 1] = 1
	let root = 1
	for (let i = 0; i < degree; i++) {
		for (let j = 0; j < degree; j++) {
			result[j] = gfMultiply(result[j], root)
			if (j + 1 < degree) result[j] ^= result[j + 1]
		}
		root = gfMultiply(root, 2)
	}
	return result
}

function rsRemainder(data, divisor) {
	const result = new Array(divisor.length).fill(0)
	for (const byte of data) {
		const factor = byte ^ result.shift()
		result.push(0)
		for (let i = 0; i < divisor.length; i++) {
			result[i] ^= gfMultiply(divisor[i], factor)
		}
	}
	return result
}

function addEccAndInterleave(data, version, ecl) {
	const numBlocks = NUM_BLOCKS[ecl.index][version]
	const eccLen = ECC_PER_BLOCK[ecl.index][version]
	const rawCodewords = Math.floor(rawDataModules(version) / 8)
	const numShortBlocks = numBlocks - (rawCodewords % numBlocks)
	const shortBlockLen = Math.floor(rawCodewords / numBlocks)
	const divisor = rsDivisor(eccLen)
	const blocks = []
	for (let i = 0, k = 0; i < numBlocks; i++) {
		const len = shortBlockLen - eccLen + (i < numShortBlocks ? 0 : 1)
		const block = data.slice(k, k + len)
		k += len
		const ecc = rsRemainder(block, divisor)
		if (i < numShortBlocks) block.push(0) // placeholder, skipped below
		blocks.push(block.concat(ecc))
	}
	const result = []
	for (let i = 0; i < blocks[0].length; i++) {
		blocks.forEach((block, j) => {
			if (i !== shortBlockLen - eccLen || j >= numShortBlocks) result.push(block[i])
		})
	}
	return result
}

// --- Matrix ---

function alignmentPositions(version) {
	if (version === 1) return []
	const size = version * 4 + 17
	const numAlign = Math.floor(version / 7) + 2
	const step =
		version === 32 ? 26 : Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2
	const result = [6]
	for (let pos = size - 7; result.length < numAlign; pos -= step) {
		result.splice(1, 0, pos)
	}
	return result
}

const MASKS = [
	(x, y) => (x + y) % 2 === 0,
	(x, y) => y % 2 === 0,
	(x) => x % 3 === 0,
	(x, y) => (x + y) % 3 === 0,
	(x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
	(x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
	(x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
	(x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
]

class Matrix {
	constructor(version) {
		this.version = version
		this.size = version * 4 + 17
		this.modules = Array.from({ length: this.size }, () =>
			new Array(this.size).fill(false)
		)
		this.isFunction = Array.from({ length: this.size }, () =>
			new Array(this.size).fill(false)
		)
	}

	setFunction(x, y, dark) {
		this.modules[y][x] = dark
		this.isFunction[y][x] = true
	}

	drawFunctionPatterns() {
		const { size } = this
		for (let i = 0; i < size; i++) {
			this.setFunction(6, i, i % 2 === 0)
			this.setFunction(i, 6, i % 2 === 0)
		}
		this.drawFinder(3, 3)
		this.drawFinder(size - 4, 3)
		this.drawFinder(3, size - 4)
		const pos = alignmentPositions(this.version)
		const last = pos.length - 1
		pos.forEach((px, i) =>
			pos.forEach((py, j) => {
				const corner =
					(i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)
				if (!corner) this.drawAlignment(px, py)
			})
		)
		this.drawFormatBits(ECL.L, 0) // reserve the area; redrawn later
		this.drawVersion()
	}

	drawFinder(x, y) {
		for (let dy = -4; dy <= 4; dy++) {
			for (let dx = -4; dx <= 4; dx++) {
				const dist = Math.max(Math.abs(dx), Math.abs(dy))
				const xx = x + dx
				const yy = y + dy
				if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) {
					this.setFunction(xx, yy, dist !== 2 && dist !== 4)
				}
			}
		}
	}

	drawAlignment(x, y) {
		for (let dy = -2; dy <= 2; dy++) {
			for (let dx = -2; dx <= 2; dx++) {
				this.setFunction(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
			}
		}
	}

	drawFormatBits(ecl, mask) {
		const data = (ecl.formatBits << 3) | mask
		let rem = data
		for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
		const bits = ((data << 10) | rem) ^ 0x5412
		const bit = (i) => ((bits >>> i) & 1) === 1
		const { size } = this
		for (let i = 0; i <= 5; i++) this.setFunction(8, i, bit(i))
		this.setFunction(8, 7, bit(6))
		this.setFunction(8, 8, bit(7))
		this.setFunction(7, 8, bit(8))
		for (let i = 9; i < 15; i++) this.setFunction(14 - i, 8, bit(i))
		for (let i = 0; i < 8; i++) this.setFunction(size - 1 - i, 8, bit(i))
		for (let i = 8; i < 15; i++) this.setFunction(8, size - 15 + i, bit(i))
		this.setFunction(8, size - 8, true)
	}

	drawVersion() {
		if (this.version < 7) return
		let rem = this.version
		for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
		const bits = (this.version << 12) | rem
		for (let i = 0; i < 18; i++) {
			const dark = ((bits >>> i) & 1) === 1
			const a = this.size - 11 + (i % 3)
			const b = Math.floor(i / 3)
			this.setFunction(a, b, dark)
			this.setFunction(b, a, dark)
		}
	}

	drawCodewords(codewords) {
		const { size } = this
		let i = 0
		for (let right = size - 1; right >= 1; right -= 2) {
			if (right === 6) right = 5
			for (let vert = 0; vert < size; vert++) {
				for (let j = 0; j < 2; j++) {
					const x = right - j
					const upward = ((right + 1) & 2) === 0
					const y = upward ? size - 1 - vert : vert
					if (!this.isFunction[y][x] && i < codewords.length * 8) {
						this.modules[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1
						i++
					}
				}
			}
		}
	}

	applyMask(mask) {
		const fn = MASKS[mask]
		for (let y = 0; y < this.size; y++) {
			for (let x = 0; x < this.size; x++) {
				if (!this.isFunction[y][x] && fn(x, y)) this.modules[y][x] = !this.modules[y][x]
			}
		}
	}

	penalty() {
		const { size, modules } = this
		let score = 0
		const lines = []
		for (let i = 0; i < size; i++) {
			lines.push(modules[i])
			lines.push(modules.map((row) => row[i]))
		}
		const finderLike = [
			[1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0],
			[0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1],
		]
		for (const line of lines) {
			let run = 1
			for (let i = 1; i <= size; i++) {
				if (i < size && line[i] === line[i - 1]) {
					run++
				} else {
					if (run >= 5) score += 3 + run - 5
					run = 1
				}
			}
			for (let i = 0; i + 11 <= size; i++) {
				for (const pattern of finderLike) {
					if (pattern.every((v, k) => line[i + k] === (v === 1))) score += 40
				}
			}
		}
		for (let y = 0; y + 1 < size; y++) {
			for (let x = 0; x + 1 < size; x++) {
				const c = modules[y][x]
				if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) {
					score += 3
				}
			}
		}
		const dark = modules.reduce((sum, row) => sum + row.filter(Boolean).length, 0)
		const total = size * size
		score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10
		return score
	}
}

// Options: ecl ('L' | 'M' | 'Q' | 'H'), mask (0-7, or omitted to pick the best)
export function encodeSegments(segments, { ecl: eclName = 'Q', mask } = {}) {
	const ecl = ECL[eclName]
	let version = 1
	let dataBits
	for (; ; version++) {
		if (version > 40) throw new Error('Data too long for a QR code')
		dataBits = segmentsBitLength(segments, version)
		if (dataBits <= dataCodewords(version, ecl) * 8) break
	}

	const capacity = dataCodewords(version, ecl) * 8
	const bits = []
	for (const seg of segments) {
		pushBits(bits, MODES[seg.mode].bits, 4)
		pushBits(bits, seg.count, countBits(seg.mode, version))
		bits.push(...seg.bits)
	}
	pushBits(bits, 0, Math.min(4, capacity - bits.length))
	pushBits(bits, 0, (8 - (bits.length % 8)) % 8)
	for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) pushBits(bits, pad, 8)

	const data = []
	for (let i = 0; i < bits.length; i += 8) {
		data.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0))
	}
	const codewords = addEccAndInterleave(data, version, ecl)

	const build = (m) => {
		const matrix = new Matrix(version)
		matrix.drawFunctionPatterns()
		matrix.drawCodewords(codewords)
		matrix.applyMask(m)
		matrix.drawFormatBits(ecl, m)
		return matrix
	}

	let best
	if (mask !== undefined) {
		best = build(mask)
	} else {
		let bestScore = Infinity
		for (let m = 0; m < 8; m++) {
			const matrix = build(m)
			const score = matrix.penalty()
			if (score < bestScore) {
				best = matrix
				bestScore = score
			}
		}
	}
	return best.modules
}

export function encodeText(text, options) {
	const segments = isAlnum(text) ? [alnumSegment(text)] : [byteSegment(text)]
	return encodeSegments(segments, options)
}
