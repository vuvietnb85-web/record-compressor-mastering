export type Mode = "sach" | "phongthanh" | "quangcao";

export type StepFn = (index: number) => void;

type Biquad = {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
  z1: number;
  z2: number;
};

const CEILING = 10 ** (-1 / 20);

export function dbToLin(db: number): number {
  return Math.exp((db * Math.LN10) / 20);
}

export function linToDb(lin: number): number {
  return 20 * Math.log10(Math.max(lin, 1e-12));
}

function yieldUI(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export function applyGain(x: Float32Array, gain: number): void {
  for (let i = 0; i < x.length; i++) x[i] *= gain;
}

export function rms(x: Float32Array): number {
  if (x.length === 0) return 0;
  const step = Math.max(1, Math.floor(x.length / 250_000));
  let s = 0;
  let n = 0;
  for (let i = 0; i < x.length; i += step) {
    s += x[i] * x[i];
    n++;
  }
  return Math.sqrt(s / n);
}

export function peakAbs(x: Float32Array): number {
  let p = 0;
  const step = x.length > 2_000_000 ? 2 : 1;
  for (let i = 0; i < x.length; i += step) {
    const a = Math.abs(x[i]);
    if (a > p) p = a;
  }
  return p;
}

function restrainPeak(x: Float32Array, maxPeak: number): void {
  const p = peakAbs(x);
  if (p > maxPeak && p > 0) applyGain(x, maxPeak / p);
}

function normBiquad(b0: number, b1: number, b2: number, a0: number, a1: number, a2: number): Biquad {
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0, z1: 0, z2: 0 };
}

function clampedFreq(freq: number, sr: number): number {
  return Math.min(Math.max(30, freq), sr * 0.45);
}

function biquadHP(freq: number, sr: number, q: number): Biquad {
  const w0 = (2 * Math.PI * clampedFreq(freq, sr)) / sr;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const alpha = sin / (2 * q);
  return normBiquad((1 + cos) / 2, -(1 + cos), (1 + cos) / 2, 1 + alpha, -2 * cos, 1 - alpha);
}

function biquadPeak(freq: number, sr: number, gainDb: number, q: number): Biquad {
  const A = 10 ** (gainDb / 40);
  const w0 = (2 * Math.PI * clampedFreq(freq, sr)) / sr;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const alpha = sin / (2 * q);
  return normBiquad(1 + alpha * A, -2 * cos, 1 - alpha * A, 1 + alpha / A, -2 * cos, 1 - alpha / A);
}

function biquadLowShelf(freq: number, sr: number, gainDb: number, q: number): Biquad {
  const A = 10 ** (gainDb / 40);
  const w0 = (2 * Math.PI * clampedFreq(freq, sr)) / sr;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const alpha = sin / (2 * q);
  const two = 2 * Math.sqrt(A) * alpha;
  const b0 = A * (A + 1 - (A - 1) * cos + two);
  const b1 = 2 * A * (A - 1 - (A + 1) * cos);
  const b2 = A * (A + 1 - (A - 1) * cos - two);
  const a0 = A + 1 + (A - 1) * cos + two;
  const a1 = -2 * (A - 1 + (A + 1) * cos);
  const a2 = A + 1 + (A - 1) * cos - two;
  return normBiquad(b0, b1, b2, a0, a1, a2);
}

function biquadHighShelf(freq: number, sr: number, gainDb: number, q: number): Biquad {
  const A = 10 ** (gainDb / 40);
  const w0 = (2 * Math.PI * clampedFreq(freq, sr)) / sr;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const alpha = sin / (2 * q);
  const two = 2 * Math.sqrt(A) * alpha;
  const b0 = A * (A + 1 + (A - 1) * cos + two);
  const b1 = -2 * A * (A - 1 + (A + 1) * cos);
  const b2 = A * (A + 1 + (A - 1) * cos - two);
  const a0 = A + 1 - (A - 1) * cos + two;
  const a1 = 2 * (A - 1 - (A + 1) * cos);
  const a2 = A + 1 - (A - 1) * cos - two;
  return normBiquad(b0, b1, b2, a0, a1, a2);
}

function processBiquad(x: Float32Array, f: Biquad): void {
  let z1 = f.z1;
  let z2 = f.z2;
  const { b0, b1, b2, a1, a2 } = f;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const y = b0 * xi + z1;
    z1 = b1 * xi - a1 * y + z2;
    z2 = b2 * xi - a2 * y;
    x[i] = y;
  }
  f.z1 = z1;
  f.z2 = z2;
}

function applyFilters(x: Float32Array, filters: Biquad[]): void {
  for (const f of filters) processBiquad(x, f);
}

function removeDc(x: Float32Array): void {
  if (x.length === 0) return;
  let mean = 0;
  const step = Math.max(1, Math.floor(x.length / 200_000));
  let n = 0;
  for (let i = 0; i < x.length; i += step) {
    mean += x[i];
    n++;
  }
  mean /= n;
  if (Math.abs(mean) < 1e-6) return;
  for (let i = 0; i < x.length; i++) x[i] -= mean;
}

export function cutSilence(x: Float32Array, sampleRate: number): Float32Array {
  if (x.length < sampleRate * 0.08) return x.slice();
  const win = Math.max(1, Math.floor(sampleRate * 0.02));
  const hop = Math.max(1, Math.floor(sampleRate * 0.01));
  const frameCount = Math.max(1, Math.floor((x.length - win) / hop) + 1);
  const energy = new Float32Array(frameCount);
  for (let f = 0; f < frameCount; f++) {
    const off = f * hop;
    const end = Math.min(x.length, off + win);
    let s = 0;
    for (let i = off; i < end; i++) s += x[i] * x[i];
    energy[f] = Math.sqrt(s / (end - off));
  }
  const sorted = Array.from(energy).sort((a, b) => a - b);
  const p20 = sorted[Math.floor(sorted.length * 0.2)] ?? 0;
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0.01;
  const thr = Math.min(Math.max(p20 * 2.6, 0.0038), Math.max(p95 * 0.22, 0.0038));
  const voiced = Array.from(energy, (v) => v >= thr);
  const first = voiced.findIndex(Boolean);
  if (first < 0) return x.slice(0, Math.min(x.length, Math.floor(sampleRate * 0.25)));
  let last = voiced.length - 1;
  while (last > first && !voiced[last]) last--;

  const padIn = Math.floor(sampleRate * 0.045);
  const padOut = Math.floor(sampleRate * 0.09);
  const regionStart = Math.max(0, first * hop - padIn);
  const regionEnd = Math.min(x.length, last * hop + win + padOut);
  const keepGap = Math.floor(sampleRate * 0.16);
  const minSilentFrames = Math.max(2, Math.floor((sampleRate * 0.38) / hop));
  const pieces: Array<{ a: number; b: number }> = [];
  let f = first;
  while (f <= last) {
    if (voiced[f]) {
      let g = f;
      while (g <= last && voiced[g]) g++;
      pieces.push({
        a: Math.max(regionStart, f * hop - Math.floor(sampleRate * 0.02)),
        b: Math.min(regionEnd, g * hop + win),
      });
      f = g;
    } else {
      let g = f;
      while (g <= last && !voiced[g]) g++;
      if (g - f >= minSilentFrames) {
        const mid = Math.floor(((f + g) / 2) * hop);
        const a = Math.max(regionStart, mid - Math.floor(keepGap / 2));
        pieces.push({ a, b: Math.min(regionEnd, a + keepGap) });
      } else {
        pieces.push({
          a: Math.max(regionStart, f * hop),
          b: Math.min(regionEnd, g * hop + win),
        });
      }
      f = g;
    }
  }
  pieces.sort((p, q) => p.a - q.a);
  const merged: Array<{ a: number; b: number }> = [];
  for (const piece of pieces) {
    if (piece.b <= piece.a) continue;
    const prev = merged[merged.length - 1];
    if (prev && piece.a <= prev.b) prev.b = Math.max(prev.b, piece.b);
    else merged.push({ a: piece.a, b: piece.b });
  }
  let total = 0;
  for (const piece of merged) total += piece.b - piece.a;
  if (total < Math.floor(sampleRate * 0.05)) return x.slice(regionStart, regionEnd);
  const out = new Float32Array(total);
  const fade = Math.max(1, Math.min(Math.floor(sampleRate * 0.008), hop));
  let pos = 0;
  for (let idx = 0; idx < merged.length; idx++) {
    const piece = merged[idx];
    const len = piece.b - piece.a;
    const separated = idx > 0 && piece.a > merged[idx - 1].b;
    for (let i = 0; i < len; i++) {
      let s = x[piece.a + i];
      if (separated && i < fade) s *= i / fade;
      out[pos + i] += s;
    }
    pos += len;
  }
  return out;
}

export function trimEdges(x: Float32Array, sampleRate: number): Float32Array {
  if (x.length < sampleRate * 0.05) return x.slice();
  const win = Math.max(1, Math.floor(sampleRate * 0.02));
  const hop = Math.max(1, Math.floor(sampleRate * 0.01));
  const thr = Math.max(0.004, peakAbs(x) * 0.02);
  let first = 0;
  let last = x.length;
  for (let i = 0; i + win < x.length; i += hop) {
    let s = 0;
    for (let j = 0; j < win; j++) s += x[i + j] * x[i + j];
    if (Math.sqrt(s / win) > thr) {
      first = Math.max(0, i - Math.floor(sampleRate * 0.03));
      break;
    }
  }
  for (let i = x.length - win; i > 0; i -= hop) {
    let s = 0;
    for (let j = 0; j < win; j++) s += x[i + j] * x[i + j];
    if (Math.sqrt(s / win) > thr) {
      last = Math.min(x.length, i + win + Math.floor(sampleRate * 0.05));
      break;
    }
  }
  if (last - first < Math.floor(sampleRate * 0.05)) return x.slice();
  return x.slice(first, last);
}

function lowpass1(x: Float32Array, sampleRate: number, freq: number): void {
  if (freq >= sampleRate * 0.45) return;
  const a = Math.exp((-2 * Math.PI * freq) / sampleRate);
  let y = 0;
  const b = 1 - a;
  for (let i = 0; i < x.length; i++) {
    y = b * x[i] + a * y;
    x[i] = y;
  }
}

function deEss(x: Float32Array, sampleRate: number): void {
  const hp = x.slice();
  processBiquad(hp, biquadHP(5600, sampleRate, 0.7));
  const att = Math.exp(-1 / (sampleRate * 0.004));
  const rel = Math.exp(-1 / (sampleRate * 0.05));
  let env = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(hp[i]);
    env = a > env ? att * env + (1 - att) * a : rel * env + (1 - rel) * a;
    const over = env - 0.055;
    if (over > 0) {
      const gr = Math.min(0.62, over * 3.4);
      x[i] -= hp[i] * gr;
    }
  }
}

function smoothInPlace(x: Float32Array, sampleRate: number): void {
  lowpass1(x, sampleRate, 13500);
  deEss(x, sampleRate);
}

function downwardExpand(x: Float32Array, sampleRate: number): void {
  const peak = peakAbs(x);
  const open = Math.max(peak * 0.075, 0.0045);
  const openDb = linToDb(open);
  const att = Math.exp(-1 / (sampleRate * 0.008));
  const rel = Math.exp(-1 / (sampleRate * 0.09));
  let env = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]);
    env = a > env ? att * env + (1 - att) * a : rel * env + (1 - rel) * a;
    if (env < open) {
      const envDb = linToDb(env);
      const gained = openDb - (openDb - envDb) * 2.15;
      const g = dbToLin(gained - envDb);
      x[i] *= Math.min(1, Math.max(0.03, g));
    }
  }
}

function gentleDenoise(x: Float32Array, sampleRate: number): Float32Array {
  const y = x.slice();
  removeDc(y);
  processBiquad(y, biquadHP(75, sampleRate, 0.707));
  downwardExpand(y, sampleRate);
  return y;
}

function fftRadix2(re: Float32Array, im: Float32Array, inverse: boolean): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wlenRe = Math.cos(ang);
    const wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      const half = len >> 1;
      for (let j = 0; j < half; j++) {
        const ur = re[i + j];
        const ui = im[i + j];
        const vr = re[i + j + half] * wRe - im[i + j + half] * wIm;
        const vi = re[i + j + half] * wIm + im[i + j + half] * wRe;
        re[i + j] = ur + vr;
        im[i + j] = ui + vi;
        re[i + j + half] = ur - vr;
        im[i + j + half] = ui - vi;
        const nextRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nextRe;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

function hann(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  return w;
}

async function spectralDenoise(x: Float32Array, sampleRate: number): Promise<Float32Array> {
  const nfft = 512;
  const long = x.length > sampleRate * 90;
  const hop = long ? 256 : 128;
  const window = hann(nfft);
  const frameCount = Math.max(1, Math.floor((x.length - nfft) / hop) + 1);
  if (x.length < nfft * 2) return gentleDenoise(x, sampleRate);
  const energy = new Float32Array(frameCount);
  for (let f = 0; f < frameCount; f++) {
    const off = f * hop;
    let e = 0;
    for (let i = 0; i < nfft; i++) e += x[off + i] * x[off + i];
    energy[f] = e;
  }
  const order = Array.from(energy).sort((a, b) => a - b);
  const e20 = order[Math.floor(frameCount * 0.2)] ?? 0;
  const e80 = order[Math.floor(frameCount * 0.8)] ?? 1;
  if (!(e20 < e80 * 0.45)) return gentleDenoise(x, sampleRate);

  const noiseIdx: number[] = [];
  const gate = e20 * 1.35 + 1e-12;
  for (let f = 0; f < frameCount && noiseIdx.length < Math.max(4, Math.floor(frameCount * 0.12)); f++) {
    if (energy[f] <= gate) noiseIdx.push(f);
  }
  if (noiseIdx.length < 3) return gentleDenoise(x, sampleRate);

  const bins = nfft / 2 + 1;
  const noiseMag = new Float32Array(bins);
  const re = new Float32Array(nfft);
  const im = new Float32Array(nfft);
  for (const f of noiseIdx) {
    const off = f * hop;
    for (let i = 0; i < nfft; i++) {
      re[i] = x[off + i] * window[i];
      im[i] = 0;
    }
    fftRadix2(re, im, false);
    for (let i = 0; i < bins; i++) noiseMag[i] += Math.hypot(re[i], im[i]);
  }
  for (let i = 0; i < bins; i++) noiseMag[i] /= noiseIdx.length;

  const out = new Float32Array(x.length + nfft);
  const winSum = new Float32Array(out.length);
  for (let f = 0; f < frameCount; f++) {
    if (f % 48 === 0) await yieldUI();
    const off = f * hop;
    for (let i = 0; i < nfft; i++) {
      re[i] = (off + i < x.length ? x[off + i] : 0) * window[i];
      im[i] = 0;
    }
    fftRadix2(re, im, false);
    for (let i = 0; i < bins; i++) {
      const mag = Math.hypot(re[i], im[i]);
      const pr = mag > 1e-12 ? re[i] / mag : 1;
      const pi = mag > 1e-12 ? im[i] / mag : 0;
      const cleaned = Math.max(mag - noiseMag[i] * 1.15, mag * 0.07);
      re[i] = pr * cleaned;
      im[i] = pi * cleaned;
    }
    im[0] = 0;
    im[nfft / 2] = 0;
    for (let i = 1; i < nfft / 2; i++) {
      re[nfft - i] = re[i];
      im[nfft - i] = -im[i];
    }
    fftRadix2(re, im, true);
    for (let i = 0; i < nfft; i++) {
      out[off + i] += re[i] * window[i];
      winSum[off + i] += window[i] * window[i];
    }
  }
  const result = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const w = winSum[i];
    result[i] = w > 1e-8 ? out[i] / w : 0;
  }
  processBiquad(result, biquadHP(70, sampleRate, 0.707));
  downwardExpand(result, sampleRate);
  return result;
}

function saturate(x: Float32Array, drive: number): void {
  const norm = Math.tanh(drive);
  for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * drive) / norm;
}

function earlyReflections(x: Float32Array, sampleRate: number): Float32Array {
  const out = x.slice();
  const taps: Array<[number, number]> = [
    [0.016, 0.2],
    [0.027, 0.13],
    [0.041, 0.07],
    [0.058, 0.04],
  ];
  for (const [sec, gain] of taps) {
    const d = Math.floor(sampleRate * sec);
    for (let i = d; i < x.length; i++) out[i] += x[i - d] * gain;
  }
  applyGain(out, 0.84);
  return out;
}

function addComb(
  src: Float32Array,
  wet: Float32Array,
  sampleRate: number,
  delayMs: number,
  feedback: number,
  damp: number,
  gain: number,
): void {
  const d = Math.max(1, Math.floor((sampleRate * delayMs) / 1000));
  const buf = new Float32Array(d);
  let idx = 0;
  let filt = 0;
  for (let i = 0; i < src.length; i++) {
    const y = buf[idx];
    filt = y * (1 - damp) + filt * damp;
    buf[idx] = src[i] + filt * feedback;
    wet[i] += y * gain;
    if (++idx >= d) idx = 0;
  }
}

function allpassInPlace(x: Float32Array, sampleRate: number, delayMs: number, g: number): void {
  const d = Math.max(1, Math.floor((sampleRate * delayMs) / 1000));
  const buf = new Float32Array(d);
  let idx = 0;
  for (let i = 0; i < x.length; i++) {
    const bufOut = buf[idx];
    const y = -g * x[i] + bufOut;
    buf[idx] = x[i] + g * y;
    x[i] = y;
    if (++idx >= d) idx = 0;
  }
}

function plate(dry: Float32Array, sampleRate: number): Float32Array {
  const tail = Math.floor(sampleRate * 1.05);
  const pre = Math.floor(sampleRate * 0.028);
  const src = new Float32Array(dry.length + tail);
  for (let i = 0; i < dry.length; i++) src[i + pre] = dry[i];
  const wet = new Float32Array(src.length);
  addComb(src, wet, sampleRate, 29.7, 0.74, 0.28, 0.26);
  addComb(src, wet, sampleRate, 37.1, 0.72, 0.32, 0.24);
  addComb(src, wet, sampleRate, 41.3, 0.7, 0.34, 0.22);
  addComb(src, wet, sampleRate, 43.7, 0.68, 0.36, 0.2);
  allpassInPlace(wet, sampleRate, 5.2, 0.65);
  allpassInPlace(wet, sampleRate, 1.7, 0.65);
  const out = new Float32Array(src.length);
  for (let i = 0; i < dry.length; i++) out[i] = dry[i] * 0.84;
  for (let i = 0; i < out.length; i++) out[i] += wet[i] * 0.22;
  return out;
}

function character(x: Float32Array, sampleRate: number, mode: Mode): Float32Array {
  const y = x.slice();
  if (mode === "sach") {
    applyFilters(y, [
      biquadHP(80, sampleRate, 0.707),
      biquadLowShelf(170, sampleRate, -2.2, 0.7),
      biquadPeak(360, sampleRate, -1.5, 0.9),
      biquadPeak(2500, sampleRate, 2.2, 0.9),
      biquadPeak(3400, sampleRate, 1.6, 1.1),
      biquadPeak(7000, sampleRate, -2.1, 1.25),
      biquadHighShelf(10500, sampleRate, 1.0, 0.7),
    ]);
  } else if (mode === "phongthanh") {
    applyFilters(y, [
      biquadHP(185, sampleRate, 0.78),
      biquadPeak(280, sampleRate, -3.3, 0.9),
      biquadPeak(1600, sampleRate, 4.6, 0.8),
      biquadPeak(3200, sampleRate, 3.6, 1.0),
      biquadPeak(7400, sampleRate, -2.6, 1.35),
    ]);
    saturate(y, 1.32);
    const reflected = earlyReflections(y, sampleRate);
    restrainPeak(reflected, 1);
    return reflected;
  } else {
    applyFilters(y, [
      biquadHP(70, sampleRate, 0.707),
      biquadLowShelf(190, sampleRate, 3.3, 0.7),
      biquadPeak(420, sampleRate, -1.1, 0.8),
      biquadPeak(2800, sampleRate, 3.0, 0.95),
      biquadPeak(6600, sampleRate, -3.1, 1.45),
      biquadHighShelf(11000, sampleRate, 1.15, 0.7),
    ]);
    saturate(y, 1.1);
    const wet = plate(y, sampleRate);
    restrainPeak(wet, 1);
    return wet;
  }
  restrainPeak(y, 1);
  return y;
}

type Comp = { thresholdDb: number; ratio: number; attack: number; release: number; knee: number };

function gainComputer(levelDb: number, c: Comp): number {
  const half = c.knee / 2;
  if (levelDb < c.thresholdDb - half) return 0;
  if (c.knee > 0 && levelDb < c.thresholdDb + half) {
    const t = levelDb - c.thresholdDb + half;
    return (1 / c.ratio - 1) * ((t * t) / (2 * c.knee));
  }
  return (c.thresholdDb + (levelDb - c.thresholdDb) / c.ratio) - levelDb;
}

function compressLinked(channels: Float32Array[], sampleRate: number, c: Comp): void {
  const n = channels[0]?.length ?? 0;
  if (!n) return;
  const det = new Float32Array(n);
  for (const ch of channels) {
    for (let i = 0; i < n; i++) det[i] += ch[i] / channels.length;
  }
  processBiquad(det, biquadHP(140, sampleRate, 0.707));
  const att = Math.exp(-1 / (sampleRate * c.attack));
  const rel = Math.exp(-1 / (sampleRate * c.release));
  let env = 0;
  const gains = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.abs(det[i]);
    env = a > env ? att * env + (1 - att) * a : rel * env + (1 - rel) * a;
    gains[i] = dbToLin(gainComputer(linToDb(env), c));
  }
  for (const ch of channels) {
    for (let i = 0; i < n; i++) ch[i] *= gains[i];
  }
}

export function limitLinked(channels: Float32Array[], sampleRate: number, ceiling = CEILING): void {
  const n = channels[0]?.length ?? 0;
  if (!n) return;
  const look = Math.max(1, Math.floor(sampleRate * 0.005));
  const block = Math.max(32, Math.floor(look / 4));
  const nBlocks = Math.ceil(n / block);
  const blockMax = new Float32Array(nBlocks);
  for (let b = 0; b < nBlocks; b++) {
    const s = b * block;
    const e = Math.min(n, s + block);
    let m = 0;
    for (let i = s; i < e; i++) {
      for (const ch of channels) {
        const a = Math.abs(ch[i]);
        if (a > m) m = a;
      }
    }
    blockMax[b] = m;
  }
  const lookBlocks = Math.ceil(look / block) + 1;
  const rel = Math.exp(-1 / (sampleRate * 0.08));
  let g = 1;
  for (let i = 0; i < n; i++) {
    const b0 = Math.floor(i / block);
    const b1 = Math.min(nBlocks, b0 + lookBlocks);
    let peak = 0;
    for (let b = b0; b < b1; b++) if (blockMax[b] > peak) peak = blockMax[b];
    const need = peak > ceiling ? ceiling / peak : 1;
    g = need < g ? need : g * rel + need * (1 - rel);
    for (const ch of channels) {
      const y = ch[i] * g;
      ch[i] = Math.max(-ceiling, Math.min(ceiling, y));
    }
  }
}

function compProfile(mode: Mode): Comp {
  if (mode === "phongthanh") return { thresholdDb: -21, ratio: 6.2, attack: 0.0035, release: 0.085, knee: 3 };
  if (mode === "quangcao") return { thresholdDb: -18, ratio: 3.1, attack: 0.016, release: 0.17, knee: 8 };
  return { thresholdDb: -16, ratio: 2.7, attack: 0.012, release: 0.13, knee: 6 };
}

function technicalCompress(channels: Float32Array[], sampleRate: number, mode: Mode): void {
  compressLinked(channels, sampleRate, compProfile(mode));
  const level = rms(channels[0]);
  if (level > 1e-4) {
    const target = dbToLin(-16);
    const boost = Math.min(target / level, dbToLin(12));
    if (boost > 1.02) {
      for (const ch of channels) applyGain(ch, boost);
    }
  }
  limitLinked(channels, sampleRate, CEILING);
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      if (!Number.isFinite(ch[i])) ch[i] = 0;
    }
  }
}

export async function processVoice(
  input: Float32Array,
  sampleRate: number,
  mode: Mode,
  onStep?: StepFn,
): Promise<Float32Array> {
  onStep?.(0);
  const x = input.slice();
  applyGain(x, 1.1);
  await yieldUI();
  onStep?.(1);
  const cut = cutSilence(x, sampleRate);
  await yieldUI();
  onStep?.(2);
  const denoised = await spectralDenoise(cut, sampleRate);
  await yieldUI();
  onStep?.(3);
  smoothInPlace(denoised, sampleRate);
  await yieldUI();
  onStep?.(4);
  const shaped = character(denoised, sampleRate, mode);
  await yieldUI();
  onStep?.(5);
  applyGain(shaped, 1.15);
  await yieldUI();
  onStep?.(6);
  technicalCompress([shaped], sampleRate, mode);
  return shaped;
}

export function downmix(channels: Float32Array[]): Float32Array {
  const n = channels[0]?.length ?? 0;
  const out = new Float32Array(n);
  if (!channels.length || !n) return out;
  const g = 1 / channels.length;
  for (const ch of channels) {
    for (let i = 0; i < n; i++) out[i] += (ch[i] ?? 0) * g;
  }
  return out;
}

export function resampleLinear(x: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || x.length === 0) return x.slice();
  const n = Math.max(1, Math.round((x.length * toRate) / fromRate));
  const out = new Float32Array(n);
  const ratio = fromRate / toRate;
  const last = x.length - 1;
  for (let i = 0; i < n; i++) {
    const src = i * ratio;
    const i0 = Math.min(last, Math.floor(src));
    const i1 = Math.min(last, i0 + 1);
    const t = src - i0;
    out[i] = x[i0] + (x[i1] - x[i0]) * t;
  }
  return out;
}

export function fitBed(src: Float32Array, target: number, sampleRate: number): Float32Array {
  const out = new Float32Array(Math.max(0, target));
  if (target <= 0 || src.length === 0) return out;
  if (src.length >= target) {
    out.set(src.subarray(0, target));
    return out;
  }
  const xfade = Math.min(Math.floor(sampleRate * 0.08), Math.floor(src.length / 3));
  const step = Math.max(1, src.length - xfade);
  let pos = 0;
  let first = true;
  while (pos < target) {
    const n = Math.min(src.length, target - pos);
    for (let i = 0; i < n; i++) {
      const s = src[i];
      if (!first && i < xfade) {
        const t = i / xfade;
        out[pos + i] = out[pos + i] * (1 - t) + s * t;
      } else {
        out[pos + i] = s;
      }
    }
    if (pos + src.length >= target) break;
    pos += step;
    first = false;
  }
  return out;
}

function fadeEdges(x: Float32Array, sampleRate: number, inSec: number, outSec: number): void {
  const fi = Math.min(x.length, Math.max(1, Math.floor(sampleRate * inSec)));
  const fo = Math.min(x.length, Math.max(1, Math.floor(sampleRate * outSec)));
  for (let i = 0; i < fi; i++) {
    const t = i / fi;
    const s = t * t * (3 - 2 * t);
    x[i] *= s;
  }
  for (let i = 0; i < fo; i++) {
    const t = i / fo;
    const s = 1 - t * t * (3 - 2 * t);
    x[x.length - 1 - i] *= s;
  }
}

function matchRms(x: Float32Array, targetDb: number, maxBoostDb: number): void {
  const level = rms(x);
  if (level < 1e-5) return;
  const boost = Math.min(dbToLin(targetDb) / level, dbToLin(maxBoostDb));
  if (boost > 0 && Math.abs(boost - 1) > 0.02) applyGain(x, boost);
}

function duck(music: Float32Array[], voice: Float32Array, sampleRate: number): void {
  const n = music[0]?.length ?? 0;
  const att = Math.exp(-1 / (sampleRate * 0.018));
  const rel = Math.exp(-1 / (sampleRate * 0.28));
  let env = 0;
  for (let i = 0; i < n; i++) {
    const v = i < voice.length ? Math.abs(voice[i]) : 0;
    env = v > env ? att * env + (1 - att) * v : rel * env + (1 - rel) * v;
    const depth = Math.min(1, env / 0.11);
    const g = 1 - depth * 0.64;
    for (const ch of music) ch[i] *= g;
  }
}

async function prepareVoice(voice: Float32Array, sampleRate: number): Promise<Float32Array> {
  const trimmed = trimEdges(voice, sampleRate);
  const clean = await spectralDenoise(trimmed, sampleRate);
  smoothInPlace(clean, sampleRate);
  applyFilters(clean, [
    biquadHP(75, sampleRate, 0.707),
    biquadLowShelf(180, sampleRate, 3.1, 0.7),
    biquadPeak(260, sampleRate, 1.4, 0.8),
    biquadPeak(3000, sampleRate, 3.2, 0.95),
    biquadPeak(6800, sampleRate, -2.4, 1.4),
    biquadHighShelf(10500, sampleRate, 0.8, 0.7),
  ]);
  saturate(clean, 1.08);
  fadeEdges(clean, sampleRate, 0.012, 0.02);
  matchRms(clean, -18, 18);
  restrainPeak(clean, 0.92);
  return clean;
}

export function bedPlan(voiceLength: number, musicLength: number, sampleRate: number): string {
  if (musicLength + sampleRate * 0.08 < voiceLength) return "Nhạc ngắn hơn lời — nhân bản, chồng mờ, rồi khớp thời lượng.";
  if (musicLength > voiceLength + sampleRate * 0.08) return "Nhạc dài hơn lời — cắt bớt cho đúng thời lượng lời.";
  return "Nhạc và lời đã cùng thời lượng.";
}

export async function mixVoiceAndBed(
  voiceIn: Float32Array,
  voiceRate: number,
  musicIn: Float32Array[],
  musicRate: number,
  onStep?: StepFn,
): Promise<{ left: Float32Array; right: Float32Array; sampleRate: number; plan: string }> {
  onStep?.(0);
  const voice = await prepareVoice(voiceIn, voiceRate);
  await yieldUI();
  onStep?.(1);
  const sampleRate = voiceRate;
  const music = musicIn.map((ch) => resampleLinear(ch, musicRate, sampleRate));
  const plan = bedPlan(voice.length, music[0]?.length ?? 0, sampleRate);
  onStep?.(2);
  const target = voice.length;
  let beds = music.map((ch) => fitBed(ch, target, sampleRate));
  if (beds.length === 1) beds = [beds[0], beds[0].slice()];
  for (const ch of beds) {
    processBiquad(ch, biquadHP(50, sampleRate, 0.707));
    processBiquad(ch, biquadPeak(2800, sampleRate, -3.0, 0.85));
    processBiquad(ch, biquadHighShelf(9000, sampleRate, -1.2, 0.7));
  }
  const bedRms = rms(beds[0]);
  if (bedRms > 1e-5) {
    const g = Math.min(dbToLin(-23) / bedRms, dbToLin(18));
    for (const ch of beds) applyGain(ch, g);
  }
  await yieldUI();
  onStep?.(3);
  duck(beds, voice, sampleRate);
  const fadeIn = Math.min(1.6, Math.max(0.35, voice.length / sampleRate * 0.08));
  const fadeOut = Math.min(2.2, Math.max(0.5, voice.length / sampleRate * 0.12));
  for (const ch of beds) fadeEdges(ch, sampleRate, fadeIn, fadeOut);
  const left = new Float32Array(target);
  const right = new Float32Array(target);
  for (let i = 0; i < target; i++) {
    const v = voice[i] ?? 0;
    left[i] = (beds[0][i] ?? 0) + v;
    right[i] = (beds[1][i] ?? 0) + v;
  }
  await yieldUI();
  onStep?.(4);
  applyGain(left, 1.1);
  applyGain(right, 1.1);
  await yieldUI();
  onStep?.(5);
  compressLinked([left, right], sampleRate, {
    thresholdDb: -14,
    ratio: 2.4,
    attack: 0.02,
    release: 0.2,
    knee: 6,
  });
  const level = rms(left);
  if (level > 1e-4) {
    const boost = Math.min(dbToLin(-14) / level, dbToLin(8));
    if (boost > 1.02) {
      applyGain(left, boost);
      applyGain(right, boost);
    }
  }
  limitLinked([left, right], sampleRate, CEILING);
  return { left, right, sampleRate, plan };
}

export function makePeaks(x: Float32Array, bars = 72): number[] {
  const out = new Array<number>(bars).fill(0);
  if (!x.length) return out;
  const size = Math.max(1, Math.floor(x.length / bars));
  let max = 0.0001;
  for (let i = 0; i < bars; i++) {
    const s = i * size;
    const e = Math.min(x.length, s + size);
    let m = 0;
    const step = Math.max(1, Math.floor((e - s) / 180));
    for (let j = s; j < e; j += step) {
      const a = Math.abs(x[j]);
      if (a > m) m = a;
    }
    out[i] = m;
    if (m > max) max = m;
  }
  const norm = max > 1 ? max : Math.max(max, 0.2);
  for (let i = 0; i < bars; i++) out[i] = Math.min(1, out[i] / norm);
  return out;
}
