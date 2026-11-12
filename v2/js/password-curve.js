// password-curve.js — animação e renderização da "impressão digital visual" de uma senha.
//
// Uso:
//   import { PasswordCurve, DEFAULTS } from "./password-curve.js";
//   const curve = new PasswordCurve(canvas, { ctype: "polar" });
//   curve.start();
//   input.addEventListener("input", () => curve.setPassword(input.value));

export const DEFAULTS = Object.freeze({
  minLen: 6,          // senhas com menos caracteres que isso mostram a curva neutra
  useC: true,         // passa por uma curva intermediária aleatória (A → C → B)
  method: "spring",   // "spring" | "hermite"
  stiff: 60,          // mola: rigidez
  damp: 40,           // mola: amortecimento
  dur: 2,             // hermite: duração de cada fase (s)
  cint: 0.75,         // intensidade da curva C (0..1)
  ctype: "fourier",   // "catmull" | "fourier" | "polar"
  points: 16,         // pontos de controle / termos (até 64)
  cx: 2,              // complexidade
  ext: 0.95,          // extensão: fração do canvas ocupada
  asp: 1,             // proporção largura/altura
  thick: 14,          // espessura do traço (px CSS)
  varw: true,         // espessura variável ao longo da curva
  cmode: "three",     // "solid" | "sweep" | "two" | "three"
  trail: false,       // rastro das curvas anteriores
  bg: "dark",         // "dark" | "light"
});

// ───────────────────────── Genoma ─────────────────────────
// Genes de forma (valores em [-1, 1]):
//   0..127   Catmull-Rom: por ponto (jitter angular, raio), até 64 pontos
//   128..255 Harmônicos / polar: por termo (re, im), até 64 termos
//   256      fase da variação de espessura
//   257      rotação global
// Genes de cor (OKLCH): 3 tons × (L normalizado, C normalizado, hue em graus)
const MAXP = 64;
const G_CAT = 0, G_FOU = 128, G_WPH = 256, G_ROT = 257;
const NSHAPE = 260;
const COL = NSHAPE;
const DIM = COL + 9;
const isHue = new Uint8Array(DIM);
isHue[COL + 2] = isHue[COL + 5] = isHue[COL + 8] = 1;

const SAMPLES = 2400; // amostras por curva (fixo, permite morph entre configurações)
const TAU = Math.PI * 2;
const MORPH_KEYS = new Set(["ctype", "points"]);

// Estado neutro (senhas curtas): genes de forma em 0 ⇒ círculo em todos os tipos de
// curva; croma 0 ⇒ cinza; luminosidade no meio da faixa.
const NEUTRAL = new Float64Array(DIM);
for (const o of [0, 3, 6]) {
  NEUTRAL[COL + o] = 0.5;              // L
  NEUTRAL[COL + o + 1] = -0.09 / 0.14; // C normalizado que mapeia para croma 0
}

// ───────────────────────── Hash / derivação de bytes ─────────────────────────
async function sha256(bytes) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

// bloco 0 = SHA-256(senha); bloco i = SHA-256(bloco0 || i)
async function deriveBytes(pw, n) {
  const base = await sha256(new TextEncoder().encode(pw));
  const blocks = Math.ceil(n / 32);
  const out = new Uint8Array(blocks * 32);
  out.set(base, 0);
  const jobs = [];
  for (let i = 1; i < blocks; i++) {
    const buf = new Uint8Array(36);
    buf.set(base, 0);
    new DataView(buf.buffer).setUint32(32, i);
    jobs.push(sha256(buf).then(h => out.set(h, i * 32)));
  }
  await Promise.all(jobs);
  return out.subarray(0, n);
}

function genomeFromBytes(b) {
  const u = i => ((b[2 * i] << 8) | b[2 * i + 1]) / 65535;
  const g = new Float64Array(DIM);
  for (let i = 0; i < NSHAPE; i++) g[i] = u(i) * 2 - 1;
  const h1 = u(COL + 2) * 360;
  const h2 = (h1 + 70 + u(COL + 5) * 110) % 360;
  const h3 = (h2 + 70 + u(COL + 8) * 110) % 360;
  g[COL + 0] = u(COL + 0); g[COL + 1] = u(COL + 1); g[COL + 2] = h1;
  g[COL + 3] = u(COL + 3); g[COL + 4] = u(COL + 4); g[COL + 5] = h2;
  g[COL + 6] = u(COL + 6); g[COL + 7] = u(COL + 7); g[COL + 8] = h3;
  return g;
}

// ───────────────────────── Utilidades ─────────────────────────
const wrap180 = d => ((d % 360) + 540) % 360 - 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = t => t * t * (3 - 2 * t);

function shapeDist(a, b) {
  let s = 0;
  for (let i = 0; i < NSHAPE; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s / NSHAPE);
}

// Curva intermediária C com aleatoriedade real
function makeC(A, B, I) {
  const r = new Uint32Array(DIM);
  crypto.getRandomValues(r);
  const rnd = i => r[i] / 4294967295;
  const C = new Float64Array(DIM);
  for (let i = 0; i < DIM; i++) {
    if (isHue[i]) {
      const mid = A[i] + wrap180(B[i] - A[i]) / 2;
      C[i] = mid + (rnd(i) * 2 - 1) * 180 * I;
    } else if (i >= COL) {
      C[i] = ((A[i] + B[i]) / 2) * (1 - I) + rnd(i) * I;
    } else {
      C[i] = ((A[i] + B[i]) / 2) * (1 - I) + (rnd(i) * 2 - 1) * I;
    }
  }
  return C;
}

// ───────────────────────── Métodos de animação ─────────────────────────
// Interface comum:
//   step(state, target, dt, cfg)        avança state.x / state.v rumo ao alvo
//   reached(state, target, ctl)         indica se a fase atual terminou
const methods = {
  spring: {
    step(st, tgt, dt, cfg) {
      const k = cfg.stiff, d = cfg.damp;
      const n = Math.max(1, Math.ceil(dt / (1 / 240)));
      const h = dt / n;
      const x = st.x, v = st.v;
      for (let s = 0; s < n; s++) {
        for (let i = 0; i < DIM; i++) {
          let T = tgt[i];
          if (isHue[i]) T = x[i] + wrap180(T - x[i]); // caminho mais curto do matiz
          v[i] += (k * (T - x[i]) - d * v[i]) * h;
          x[i] += v[i] * h;
        }
      }
      st.seg = null;
    },
    reached(st, tgt, ctl) {
      return shapeDist(st.x, tgt) < 0.3 * ctl.startDist || ctl.phaseTime > 1.4;
    },
  },

  hermite: {
    step(st, tgt, dt, cfg) {
      let seg = st.seg;
      if (!seg || seg.target !== tgt) {
        const x1 = new Float64Array(DIM);
        for (let i = 0; i < DIM; i++)
          x1[i] = isHue[i] ? st.x[i] + wrap180(tgt[i] - st.x[i]) : tgt[i];
        seg = st.seg = { target: tgt, x0: st.x.slice(), v0: st.v.slice(), x1, T: cfg.dur, t: 0 };
      }
      seg.t = Math.min(seg.T, seg.t + dt);
      const T = seg.T, s = seg.t / T, s2 = s * s, s3 = s2 * s;
      const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2;
      const d00 = (6 * s2 - 6 * s) / T, d10 = 3 * s2 - 4 * s + 1, d01 = (-6 * s2 + 6 * s) / T;
      const { x0, v0, x1 } = seg;
      for (let i = 0; i < DIM; i++) {
        st.x[i] = h00 * x0[i] + h10 * T * v0[i] + h01 * x1[i];
        st.v[i] = d00 * x0[i] + d10 * v0[i] + d01 * x1[i];
      }
    },
    reached(st, tgt) {
      return !!st.seg && st.seg.target === tgt && st.seg.t >= st.seg.T;
    },
  },
};

// ───────────────────────── Geometria das curvas ─────────────────────────
// Catmull-Rom: n pontos ao redor do centro, com jitter angular e de raio
const ctrlBuf = new Float64Array(2 * MAXP);

function sampleCatmull(g, pts, cfg) {
  const N = cfg.points, J = 0.5 * cfg.cx, R = 0.45 * cfg.cx, P = ctrlBuf;
  for (let i = 0; i < N; i++) {
    const th = TAU * (i + J * g[G_CAT + 2 * i]) / N;
    const r = 1 + R * g[G_CAT + 2 * i + 1];
    P[2 * i] = r * Math.cos(th); P[2 * i + 1] = r * Math.sin(th);
  }
  for (let s = 0; s < SAMPLES; s++) {
    const u = (s / SAMPLES) * N, k = Math.floor(u), t = u - k;
    const i0 = (k - 1 + N) % N, i1 = k % N, i2 = (k + 1) % N, i3 = (k + 2) % N;
    const t2 = t * t, t3 = t2 * t;
    for (let d = 0; d < 2; d++) {
      const p0 = P[2 * i0 + d], p1 = P[2 * i1 + d], p2 = P[2 * i2 + d], p3 = P[2 * i3 + d];
      pts[2 * s + d] = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    }
  }
}

// z(t) = Σ w_j (a_j + i b_j) e^{i f_j t}, frequências f = 1, 2, 0, 3, -1, 4, -2, …
function sampleFourier(g, pts, cfg) {
  const n = cfg.points, c = cfg.cx;
  const terms = [];
  for (let j = 0; j < n; j++) {
    const rank = Math.ceil(j / 2);
    const f = j % 2 ? 1 + rank : 1 - rank;
    let a = g[G_FOU + 2 * j], b = g[G_FOU + 2 * j + 1], w;
    if (j === 0) { a = 1 + 0.3 * a; b *= 0.3; w = 1; }
    else w = (c * 0.75) / Math.pow(rank, 1.05);
    terms.push(f, w * a, w * b);
  }
  for (let s = 0; s < SAMPLES; s++) {
    const t = (s / SAMPLES) * TAU;
    let x = 0, y = 0;
    for (let k = 0; k < terms.length; k += 3) {
      const ang = terms[k] * t, co = Math.cos(ang), si = Math.sin(ang);
      const a = terms[k + 1], b = terms[k + 2];
      x += a * co - b * si; y += a * si + b * co;
    }
    pts[2 * s] = x; pts[2 * s + 1] = y;
  }
}

// r(θ) = 1 + Σ w_k (a_k cos(kθ) + b_k sin(kθ))
function samplePolar(g, pts, cfg) {
  const n = cfg.points, c = cfg.cx;
  const coef = [];
  for (let k = 1; k <= n; k++) {
    const w = (c * 0.55) / Math.pow(k, 0.95);
    coef.push(k, w * g[G_FOU + 2 * (k - 1)], w * g[G_FOU + 2 * (k - 1) + 1]);
  }
  for (let s = 0; s < SAMPLES; s++) {
    const th = (s / SAMPLES) * TAU;
    let r = 1;
    for (let i = 0; i < coef.length; i += 3) {
      const a = coef[i] * th;
      r += coef[i + 1] * Math.cos(a) + coef[i + 2] * Math.sin(a);
    }
    pts[2 * s] = r * Math.cos(th); pts[2 * s + 1] = r * Math.sin(th);
  }
}

const samplers = { catmull: sampleCatmull, fourier: sampleFourier, polar: samplePolar };

// Amostra a curva e normaliza (centro do bbox na origem, raio máximo = 1)
function sampleCurve(g, pts, cfg) {
  (samplers[cfg.ctype] || sampleFourier)(g, pts, cfg);

  const rot = g[G_ROT] * Math.PI, cr = Math.cos(rot), sr = Math.sin(rot);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let s = 0; s < SAMPLES; s++) {
    const x = pts[2 * s], y = pts[2 * s + 1];
    const X = x * cr - y * sr, Y = x * sr + y * cr;
    pts[2 * s] = X; pts[2 * s + 1] = Y;
    if (X < minX) minX = X; if (X > maxX) maxX = X;
    if (Y < minY) minY = Y; if (Y > maxY) maxY = Y;
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  let maxR = 1e-9;
  for (let s = 0; s < SAMPLES; s++) {
    const x = pts[2 * s] - cx, y = pts[2 * s + 1] - cy;
    pts[2 * s] = x; pts[2 * s + 1] = y;
    const r = x * x + y * y; if (r > maxR) maxR = r;
  }
  const k = 1 / Math.sqrt(maxR);
  for (let i = 0; i < pts.length; i++) pts[i] *= k;
}

// ───────────────────────── Cor (OKLCH → sRGB) ─────────────────────────
function oklchToCss(L, C, h) {
  const hr = (h * Math.PI) / 180, a = C * Math.cos(hr), b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const ch = lin.map(x => {
    x = clamp(x, 0, 1);
    x = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
    return Math.round(x * 255);
  });
  return `rgb(${ch[0]},${ch[1]},${ch[2]})`;
}

function tones(x, cfg) {
  const dark = cfg.bg === "dark";
  const L = n => dark ? 0.62 + 0.26 * n : 0.42 + 0.22 * n;
  const C = n => Math.max(0, 0.09 + 0.14 * n);
  return [0, 3, 6].map(o => [L(x[COL + o]), C(x[COL + o + 1]), x[COL + o + 2]]);
}

function mixTone(p, q, f) {
  return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, p[2] + wrap180(q[2] - p[2]) * f];
}

function colorAt(tn, t, cmode) {
  switch (cmode) {
    case "solid": return tn[0];
    case "sweep": return [tn[0][0], tn[0][1], tn[0][2] + 360 * t];
    case "two": return mixTone(tn[0], tn[1], (1 - Math.cos(TAU * t)) / 2);
    default: {
      const u = t * 3, k = Math.min(2, Math.floor(u));
      return mixTone(tn[k], tn[(k + 1) % 3], smooth(u - k));
    }
  }
}

const BG = { dark: [13, 15, 20], light: [244, 242, 238] };

// ───────────────────────── Classe pública ─────────────────────────
export class PasswordCurve {
  #canvas; #ctx; #cfg;
  #state = { x: null, v: new Float64Array(DIM), seg: null };
  #ctl = { B: null, C: null, phase: "idle", phaseTime: 0, startDist: 0 };
  #pts = new Float32Array(SAMPLES * 2);
  #morph = { from: null, t: 1 };
  #password = "";
  #seq = 0;
  #raf = 0;
  #last = 0;
  #W = 0; #H = 0; #dpr = 0;

  /**
   * @param {HTMLCanvasElement} canvas  canvas onde a curva é desenhada (o tamanho vem do CSS)
   * @param {Partial<typeof DEFAULTS>} config  configurações; campos ausentes usam DEFAULTS
   */
  constructor(canvas, config = {}) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext("2d");
    this.#cfg = { ...DEFAULTS };
    for (const k of Object.keys(DEFAULTS)) if (k in config) this.#cfg[k] = config[k];
    this.#refresh();
  }

  /** Cópia das configurações atuais. */
  get config() {
    return { ...this.#cfg };
  }

  /** Começa o loop de animação. */
  start() {
    if (this.#raf) return;
    this.#last = performance.now();
    const frame = now => {
      const dt = Math.min(0.1, Math.max(0, (now - this.#last) / 1000));
      this.#last = now;
      this.#update(dt);
      this.#render(dt);
      this.#raf = requestAnimationFrame(frame);
    };
    this.#raf = requestAnimationFrame(frame);
  }

  /** Para o loop de animação (o estado é mantido; start() continua de onde parou). */
  stop() {
    cancelAnimationFrame(this.#raf);
    this.#raf = 0;
  }

  /** Atualiza a senha — equivalente a uma tecla digitada no campo. */
  setPassword(password) {
    this.#password = String(password);
    return this.#refresh();
  }

  /** Altera configurações ao vivo (campos omitidos ficam como estão). */
  setConfig(partial) {
    const cfg = this.#cfg, st = this.#state, ctl = this.#ctl;
    for (const k of Object.keys(DEFAULTS)) {
      if (!(k in partial) || partial[k] === cfg[k]) continue;
      const v = partial[k];
      if (MORPH_KEYS.has(k)) this.#startMorph();
      cfg[k] = v;
      if (k === "method") st.seg = null;
      if (k === "minLen") this.#refresh(); // reavalia a senha atual com o novo limite
      if (k === "useC" && !v && ctl.phase === "C") {
        // desligado no meio da fase A→C: segue direto para B a partir do estado atual
        st.seg = null;
        this.#enterB();
      }
    }
  }

  // ── senha → alvo ──
  async #refresh() {
    const my = ++this.#seq;
    const pw = this.#password;
    if ([...pw].length < this.#cfg.minLen) {
      // senha curta: alvo neutro; não reinicia a animação se já estiver indo para ele
      if (this.#ctl.B !== NEUTRAL) this.#setTarget(NEUTRAL);
      return;
    }
    const bytes = await deriveBytes(pw, DIM * 2);
    if (my !== this.#seq) return; // resultado fora de ordem: descarta
    const B = genomeFromBytes(bytes);
    bytes.fill(0);
    const cur = this.#ctl.B;
    if (cur && cur.every((v, i) => v === B[i])) return; // mesmo alvo: não reinicia
    this.#setTarget(B);
  }

  // ── controle de fases ──
  #setTarget(B) {
    const st = this.#state, ctl = this.#ctl;
    ctl.B = B;
    if (!st.x) { st.x = B.slice(); return; } // primeira curva: sem animação
    st.seg = null; // a nova interpolação parte da posição e velocidade atuais
    if (!this.#cfg.useC) { this.#enterB(); return; } // sem curva intermediária: A → B direto
    ctl.C = makeC(st.x, B, this.#cfg.cint);
    ctl.phase = "C";
    ctl.phaseTime = 0;
    ctl.startDist = shapeDist(st.x, ctl.C);
  }

  #enterB() {
    const ctl = this.#ctl;
    ctl.phase = "B";
    ctl.phaseTime = 0;
    ctl.startDist = shapeDist(this.#state.x, ctl.B);
  }

  #update(dt) {
    const st = this.#state, ctl = this.#ctl;
    if (!st.x) return;
    const m = methods[this.#cfg.method] || methods.spring;
    const tgt = ctl.phase === "C" ? ctl.C : ctl.B;
    m.step(st, tgt, dt, this.#cfg);
    ctl.phaseTime += dt;
    if (ctl.phase === "C" && m.reached(st, tgt, ctl)) this.#enterB();
    else if (ctl.phase === "B" && m.reached(st, tgt, ctl)) ctl.phase = "idle";
  }

  // ── renderização ──
  // Mudanças discretas de configuração fazem um morph curto em vez de um salto
  #startMorph() {
    if (!this.#state.x) return;
    this.#morph.from = this.#pts.slice();
    this.#morph.t = 0;
  }

  // Ajusta o buffer do canvas ao tamanho exibido e ao devicePixelRatio
  #fitCanvas() {
    const c = this.#canvas, dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth, H = c.clientHeight;
    if (W === this.#W && H === this.#H && dpr === this.#dpr) return;
    this.#W = W; this.#H = H; this.#dpr = dpr;
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    this.#ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  #render(dt) {
    this.#fitCanvas();
    const cfg = this.#cfg, ctx = this.#ctx, W = this.#W, H = this.#H, x = this.#state.x;
    const bg = BG[cfg.bg] || BG.dark;
    const alpha = cfg.trail ? 1 - Math.exp(-dt * 2.5) : 1;
    ctx.fillStyle = `rgba(${bg[0]},${bg[1]},${bg[2]},${alpha.toFixed(4)})`;
    ctx.fillRect(0, 0, W, H);
    if (!x) return;

    const pts = this.#pts, morph = this.#morph;
    sampleCurve(x, pts, cfg);
    if (morph.t < 1) {
      morph.t = Math.min(1, morph.t + dt / 0.45);
      const f = smooth(morph.t), from = morph.from;
      for (let i = 0; i < pts.length; i++) pts[i] = from[i] + (pts[i] - from[i]) * f;
    }

    // caixa da curva respeitando extensão e proporção, centrada no canvas
    const bw = Math.min(W * cfg.ext, H * cfg.ext * cfg.asp), bh = bw / cfg.asp;
    const cx = W / 2, cy = H / 2, sx = bw / 2, sy = bh / 2;

    const tn = tones(x, cfg);
    const wph = x[G_WPH] * Math.PI;
    const wfreq = 3; // ondulações da espessura por volta
    // no estado neutro (croma 0) a espessura variável some, deixando o traço uniforme
    const wamp = clamp(tn[0][1] / 0.09, 0, 1);
    ctx.lineCap = "round"; ctx.lineJoin = "round";

    if (cfg.cmode === "solid" && !cfg.varw) {
      const c = tn[0];
      ctx.strokeStyle = oklchToCss(c[0], c[1], c[2]);
      ctx.lineWidth = cfg.thick;
      ctx.beginPath();
      for (let s = 0; s <= SAMPLES; s++) {
        const i = s % SAMPLES, X = cx + pts[2 * i] * sx, Y = cy + pts[2 * i + 1] * sy;
        s ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      }
      ctx.stroke();
      return;
    }

    const CH = 3; // amostras por segmento desenhado
    for (let s = 0; s < SAMPLES; s += CH) {
      const t = (s + CH / 2) / SAMPLES;
      const c = colorAt(tn, t, cfg.cmode);
      ctx.strokeStyle = oklchToCss(c[0], c[1], c[2]);
      ctx.lineWidth = cfg.varw
        ? cfg.thick * (1 + wamp * (1.5 * (0.5 + 0.5 * Math.sin(TAU * wfreq * t + wph)) - 0.75))
        : cfg.thick;
      ctx.beginPath();
      for (let k = 0; k <= CH; k++) {
        const i = (s + k) % SAMPLES, X = cx + pts[2 * i] * sx, Y = cy + pts[2 * i + 1] * sy;
        k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      }
      ctx.stroke();
    }
  }
}
