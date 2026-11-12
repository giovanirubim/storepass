// password-curve.js — animated "visual fingerprint" of a seed: a closed curve whose
// shape and colors come from SHA-256 of the seed. Adapted from the password-viewer
// project with its settings fixed (spring animation, harmonic curve, three-tone
// gradient, dark background), so a seed always draws the same figure.
//
// Usage:
//   const curve = new PasswordCurve(canvas, { thick: 4 })
//   curve.start()
//   curve.setPassword(seed) // '' shows the neutral figure (gray circle)

// ───────────────────────── Fixed settings ─────────────────────────
const TERMS = 16 // harmonic terms
const COMPLEXITY = 2 // how much the curve twists
const EXTENT = 0.82 // fraction of the canvas the curve fills
const STIFFNESS = 60 // spring
const DAMPING = 40 // spring
const C_INTENSITY = 0.75 // how far the random intermediate curve C strays from A and B
const BG = 'rgb(13,15,20)'

const SAMPLES = 2400 // points per curve
const TAU = Math.PI * 2

// ───────────────────────── Genome ─────────────────────────
// Shape genes (values in [-1, 1]):
//   0..31  harmonic terms (re, im)
//   32     phase of the stroke width variation
//   33     global rotation
// Color genes (OKLCH): 3 tones × (normalized L, normalized C, hue in degrees)
const G_WPH = 2 * TERMS
const G_ROT = G_WPH + 1
const NSHAPE = G_ROT + 1
const COL = NSHAPE
const DIM = COL + 9
const isHue = new Uint8Array(DIM)
isHue[COL + 2] = isHue[COL + 5] = isHue[COL + 8] = 1

// Where each gene is read from in the derived byte stream (as 16-bit words).
// These are the positions the original module used, so a seed draws exactly
// the same figure as before the settings were fixed. Do not change.
const SRC_TERMS = 128
const SRC_WPH = 256
const SRC_ROT = 257
const SRC_COL = 260
const SRC_WORDS = SRC_COL + 9

// Neutral state (empty seed): shape genes 0 ⇒ circle; chroma 0 ⇒ gray
const NEUTRAL = new Float64Array(DIM)
for (const o of [0, 3, 6]) {
	NEUTRAL[COL + o] = 0.5 // L
	NEUTRAL[COL + o + 1] = -0.09 / 0.14 // normalized C that maps to chroma 0
}

// ───────────────────────── Hash / byte derivation ─────────────────────────
async function sha256(bytes) {
	return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
}

// block 0 = SHA-256(seed); block i = SHA-256(block0 || i)
async function deriveBytes(seed, n) {
	const base = await sha256(new TextEncoder().encode(seed))
	const blocks = Math.ceil(n / 32)
	const out = new Uint8Array(blocks * 32)
	out.set(base, 0)
	const jobs = []
	for (let i = 1; i < blocks; i++) {
		const buf = new Uint8Array(36)
		buf.set(base, 0)
		new DataView(buf.buffer).setUint32(32, i)
		jobs.push(sha256(buf).then((h) => out.set(h, i * 32)))
	}
	await Promise.all(jobs)
	return out.subarray(0, n)
}

function genomeFromBytes(b) {
	const u = (i) => ((b[2 * i] << 8) | b[2 * i + 1]) / 65535
	const g = new Float64Array(DIM)
	for (let i = 0; i < 2 * TERMS; i++) g[i] = u(SRC_TERMS + i) * 2 - 1
	g[G_WPH] = u(SRC_WPH) * 2 - 1
	g[G_ROT] = u(SRC_ROT) * 2 - 1
	const h1 = u(SRC_COL + 2) * 360
	const h2 = (h1 + 70 + u(SRC_COL + 5) * 110) % 360
	const h3 = (h2 + 70 + u(SRC_COL + 8) * 110) % 360
	g[COL + 0] = u(SRC_COL + 0); g[COL + 1] = u(SRC_COL + 1); g[COL + 2] = h1
	g[COL + 3] = u(SRC_COL + 3); g[COL + 4] = u(SRC_COL + 4); g[COL + 5] = h2
	g[COL + 6] = u(SRC_COL + 6); g[COL + 7] = u(SRC_COL + 7); g[COL + 8] = h3
	return g
}

// ───────────────────────── Utilities ─────────────────────────
const wrap180 = (d) => (((d % 360) + 540) % 360) - 180
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const smooth = (t) => t * t * (3 - 2 * t)

function shapeDist(a, b) {
	let s = 0
	for (let i = 0; i < NSHAPE; i++) {
		const d = a[i] - b[i]
		s += d * d
	}
	return Math.sqrt(s / NSHAPE)
}

// Intermediate curve C, with true randomness, so the animation reveals nothing
function makeC(A, B) {
	const I = C_INTENSITY
	const r = new Uint32Array(DIM)
	crypto.getRandomValues(r)
	const rnd = (i) => r[i] / 4294967295
	const C = new Float64Array(DIM)
	for (let i = 0; i < DIM; i++) {
		if (isHue[i]) {
			const mid = A[i] + wrap180(B[i] - A[i]) / 2
			C[i] = mid + (rnd(i) * 2 - 1) * 180 * I
		} else if (i >= COL) {
			C[i] = ((A[i] + B[i]) / 2) * (1 - I) + rnd(i) * I
		} else {
			C[i] = ((A[i] + B[i]) / 2) * (1 - I) + (rnd(i) * 2 - 1) * I
		}
	}
	return C
}

// ───────────────────────── Spring animation ─────────────────────────
function springStep(st, tgt, dt) {
	const n = Math.max(1, Math.ceil(dt / (1 / 240)))
	const h = dt / n
	const x = st.x, v = st.v
	for (let s = 0; s < n; s++) {
		for (let i = 0; i < DIM; i++) {
			let T = tgt[i]
			if (isHue[i]) T = x[i] + wrap180(T - x[i]) // shortest way around the hue
			v[i] += (STIFFNESS * (T - x[i]) - DAMPING * v[i]) * h
			x[i] += v[i] * h
		}
	}
}

function springReached(st, tgt, ctl) {
	return shapeDist(st.x, tgt) < 0.3 * ctl.startDist || ctl.phaseTime > 1.4
}

// ───────────────────────── Curve geometry ─────────────────────────
// z(t) = Σ w_j (a_j + i b_j) e^{i f_j t}, frequencies f = 1, 2, 0, 3, -1, 4, -2, …
// Then rotated, centered (bbox center at the origin) and scaled to max radius 1.
function sampleCurve(g, pts) {
	const terms = []
	for (let j = 0; j < TERMS; j++) {
		const rank = Math.ceil(j / 2)
		const f = j % 2 ? 1 + rank : 1 - rank
		let a = g[2 * j], b = g[2 * j + 1], w
		if (j === 0) { a = 1 + 0.3 * a; b *= 0.3; w = 1 }
		else w = (COMPLEXITY * 0.75) / Math.pow(rank, 1.05)
		terms.push(f, w * a, w * b)
	}
	for (let s = 0; s < SAMPLES; s++) {
		const t = (s / SAMPLES) * TAU
		let x = 0, y = 0
		for (let k = 0; k < terms.length; k += 3) {
			const ang = terms[k] * t, co = Math.cos(ang), si = Math.sin(ang)
			const a = terms[k + 1], b = terms[k + 2]
			x += a * co - b * si
			y += a * si + b * co
		}
		pts[2 * s] = x; pts[2 * s + 1] = y
	}
	// rotation reads back the stored (float32) points, as the original did
	const rot = g[G_ROT] * Math.PI, cr = Math.cos(rot), sr = Math.sin(rot)
	let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
	for (let s = 0; s < SAMPLES; s++) {
		const x = pts[2 * s], y = pts[2 * s + 1]
		const X = x * cr - y * sr, Y = x * sr + y * cr
		pts[2 * s] = X; pts[2 * s + 1] = Y
		if (X < minX) minX = X; if (X > maxX) maxX = X
		if (Y < minY) minY = Y; if (Y > maxY) maxY = Y
	}
	const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
	let maxR = 1e-9
	for (let s = 0; s < SAMPLES; s++) {
		const x = pts[2 * s] - cx, y = pts[2 * s + 1] - cy
		pts[2 * s] = x; pts[2 * s + 1] = y
		const r = x * x + y * y
		if (r > maxR) maxR = r
	}
	const k = 1 / Math.sqrt(maxR)
	for (let i = 0; i < pts.length; i++) pts[i] *= k
}

// ───────────────────────── Color (OKLCH → sRGB) ─────────────────────────
function oklchToCss(L, C, h) {
	const hr = (h * Math.PI) / 180, a = C * Math.cos(hr), b = C * Math.sin(hr)
	const l_ = L + 0.3963377774 * a + 0.2158037573 * b
	const m_ = L - 0.1055613458 * a - 0.0638541728 * b
	const s_ = L - 0.0894841775 * a - 1.291485548 * b
	const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_
	const lin = [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	]
	const ch = lin.map((x) => {
		x = clamp(x, 0, 1)
		x = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055
		return Math.round(x * 255)
	})
	return `rgb(${ch[0]},${ch[1]},${ch[2]})`
}

// The three tones, tuned for the dark background
function tones(x) {
	const L = (n) => 0.62 + 0.26 * n
	const C = (n) => Math.max(0, 0.09 + 0.14 * n)
	return [0, 3, 6].map((o) => [L(x[COL + o]), C(x[COL + o + 1]), x[COL + o + 2]])
}

function mixTone(p, q, f) {
	return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, p[2] + wrap180(q[2] - p[2]) * f]
}

// Three-tone gradient along the curve
function colorAt(tn, t) {
	const u = t * 3, k = Math.min(2, Math.floor(u))
	return mixTone(tn[k], tn[(k + 1) % 3], smooth(u - k))
}

// ───────────────────────── Public class ─────────────────────────
export class PasswordCurve {
	#canvas; #ctx; #thick
	#state = { x: null, v: new Float64Array(DIM) }
	#ctl = { B: null, C: null, phase: 'idle', phaseTime: 0, startDist: 0 }
	#pts = new Float32Array(SAMPLES * 2)
	#seed = ''
	#seq = 0
	#raf = 0
	#last = 0
	#W = 0; #H = 0; #dpr = 0

	/**
	 * @param {HTMLCanvasElement} canvas  where the curve is drawn (its size comes from CSS)
	 * @param {{ thick: number }} options  stroke width in CSS px
	 */
	constructor(canvas, { thick }) {
		this.#canvas = canvas
		this.#ctx = canvas.getContext('2d')
		this.#thick = thick
		this.#refresh()
	}

	/** Starts the animation loop. */
	start() {
		if (this.#raf) return
		this.#last = performance.now()
		const frame = (now) => {
			const dt = Math.min(0.1, Math.max(0, (now - this.#last) / 1000))
			this.#last = now
			this.#update(dt)
			this.#render()
			this.#raf = requestAnimationFrame(frame)
		}
		this.#raf = requestAnimationFrame(frame)
	}

	/** Stops the animation loop (state is kept; start() resumes). */
	stop() {
		cancelAnimationFrame(this.#raf)
		this.#raf = 0
	}

	/** Shows the figure for a seed; '' shows the neutral figure. */
	setPassword(seed) {
		this.#seed = String(seed)
		return this.#refresh()
	}

	// ── seed → target ──
	async #refresh() {
		const my = ++this.#seq
		const seed = this.#seed
		if (!seed) {
			// don't restart the animation if already heading to neutral
			if (this.#ctl.B !== NEUTRAL) this.#setTarget(NEUTRAL)
			return
		}
		const bytes = await deriveBytes(seed, SRC_WORDS * 2)
		if (my !== this.#seq) return // out-of-order result: discard
		const B = genomeFromBytes(bytes)
		bytes.fill(0)
		const cur = this.#ctl.B
		if (cur && cur.every((v, i) => v === B[i])) return // same target: don't restart
		this.#setTarget(B)
	}

	// ── phases: A → C (random) → B ──
	#setTarget(B) {
		const st = this.#state, ctl = this.#ctl
		ctl.B = B
		if (!st.x) {
			st.x = B.slice() // first figure: no animation
			return
		}
		ctl.C = makeC(st.x, B)
		ctl.phase = 'C'
		ctl.phaseTime = 0
		ctl.startDist = shapeDist(st.x, ctl.C)
	}

	#update(dt) {
		const st = this.#state, ctl = this.#ctl
		if (!st.x) return
		const tgt = ctl.phase === 'C' ? ctl.C : ctl.B
		springStep(st, tgt, dt)
		ctl.phaseTime += dt
		if (ctl.phase === 'C' && springReached(st, tgt, ctl)) {
			ctl.phase = 'B'
			ctl.phaseTime = 0
			ctl.startDist = shapeDist(st.x, ctl.B)
		} else if (ctl.phase === 'B' && springReached(st, tgt, ctl)) {
			ctl.phase = 'idle'
		}
	}

	// ── rendering ──
	// Matches the canvas buffer to its displayed size and devicePixelRatio
	#fitCanvas() {
		const c = this.#canvas, dpr = window.devicePixelRatio || 1
		const W = c.clientWidth, H = c.clientHeight
		if (W === this.#W && H === this.#H && dpr === this.#dpr) return
		this.#W = W; this.#H = H; this.#dpr = dpr
		c.width = Math.round(W * dpr); c.height = Math.round(H * dpr)
		this.#ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
	}

	#render() {
		this.#fitCanvas()
		const ctx = this.#ctx, W = this.#W, H = this.#H, x = this.#state.x
		ctx.fillStyle = BG
		ctx.fillRect(0, 0, W, H)
		if (!x) return

		const pts = this.#pts
		sampleCurve(x, pts)

		// square box centered on the canvas
		const size = Math.min(W, H) * EXTENT
		const cx = W / 2, cy = H / 2, sc = size / 2

		const tn = tones(x)
		const wph = x[G_WPH] * Math.PI
		const wfreq = 3 // stroke width ripples per turn
		// in the neutral state (chroma 0) the width variation fades out
		const wamp = clamp(tn[0][1] / 0.09, 0, 1)
		ctx.lineCap = 'round'
		ctx.lineJoin = 'round'

		const CH = 3 // samples per drawn segment
		for (let s = 0; s < SAMPLES; s += CH) {
			const t = (s + CH / 2) / SAMPLES
			const c = colorAt(tn, t)
			ctx.strokeStyle = oklchToCss(c[0], c[1], c[2])
			ctx.lineWidth = this.#thick * (1 + wamp * (1.5 * (0.5 + 0.5 * Math.sin(TAU * wfreq * t + wph)) - 0.75))
			ctx.beginPath()
			for (let k = 0; k <= CH; k++) {
				const i = (s + k) % SAMPLES, X = cx + pts[2 * i] * sc, Y = cy + pts[2 * i + 1] * sc
				k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y)
			}
			ctx.stroke()
		}
	}
}
