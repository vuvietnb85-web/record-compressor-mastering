import { i as __toESM } from "../_runtime.mjs";
import { K as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Download, i as Pause, r as Play, t as Upload } from "../_libs/lucide-react.mjs";
import { t as Sr } from "../_libs/breezystack__lamejs.mjs";
import { n as Muxer, t as ArrayBufferTarget } from "../_libs/webm-muxer.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DnfWwtr9.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var CEILING = 10 ** (-1 / 20);
function dbToLin(db) {
	return Math.exp(db * Math.LN10 / 20);
}
function linToDb(lin) {
	return 20 * Math.log10(Math.max(lin, 1e-12));
}
function yieldUI() {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}
function applyGain(x, gain) {
	for (let i = 0; i < x.length; i++) x[i] *= gain;
}
function rms(x) {
	if (x.length === 0) return 0;
	const step = Math.max(1, Math.floor(x.length / 25e4));
	let s = 0;
	let n = 0;
	for (let i = 0; i < x.length; i += step) {
		s += x[i] * x[i];
		n++;
	}
	return Math.sqrt(s / n);
}
function peakAbs(x) {
	let p = 0;
	const step = x.length > 2e6 ? 2 : 1;
	for (let i = 0; i < x.length; i += step) {
		const a = Math.abs(x[i]);
		if (a > p) p = a;
	}
	return p;
}
function restrainPeak(x, maxPeak) {
	const p = peakAbs(x);
	if (p > maxPeak && p > 0) applyGain(x, maxPeak / p);
}
function normBiquad(b0, b1, b2, a0, a1, a2) {
	return {
		b0: b0 / a0,
		b1: b1 / a0,
		b2: b2 / a0,
		a1: a1 / a0,
		a2: a2 / a0,
		z1: 0,
		z2: 0
	};
}
function clampedFreq(freq, sr) {
	return Math.min(Math.max(30, freq), sr * .45);
}
function biquadHP(freq, sr, q) {
	const w0 = 2 * Math.PI * clampedFreq(freq, sr) / sr;
	const cos = Math.cos(w0);
	const alpha = Math.sin(w0) / (2 * q);
	return normBiquad((1 + cos) / 2, -(1 + cos), (1 + cos) / 2, 1 + alpha, -2 * cos, 1 - alpha);
}
function biquadPeak(freq, sr, gainDb, q) {
	const A = 10 ** (gainDb / 40);
	const w0 = 2 * Math.PI * clampedFreq(freq, sr) / sr;
	const cos = Math.cos(w0);
	const alpha = Math.sin(w0) / (2 * q);
	return normBiquad(1 + alpha * A, -2 * cos, 1 - alpha * A, 1 + alpha / A, -2 * cos, 1 - alpha / A);
}
function biquadLowShelf(freq, sr, gainDb, q) {
	const A = 10 ** (gainDb / 40);
	const w0 = 2 * Math.PI * clampedFreq(freq, sr) / sr;
	const cos = Math.cos(w0);
	const alpha = Math.sin(w0) / (2 * q);
	const two = 2 * Math.sqrt(A) * alpha;
	return normBiquad(A * (A + 1 - (A - 1) * cos + two), 2 * A * (A - 1 - (A + 1) * cos), A * (A + 1 - (A - 1) * cos - two), A + 1 + (A - 1) * cos + two, -2 * (A - 1 + (A + 1) * cos), A + 1 + (A - 1) * cos - two);
}
function biquadHighShelf(freq, sr, gainDb, q) {
	const A = 10 ** (gainDb / 40);
	const w0 = 2 * Math.PI * clampedFreq(freq, sr) / sr;
	const cos = Math.cos(w0);
	const alpha = Math.sin(w0) / (2 * q);
	const two = 2 * Math.sqrt(A) * alpha;
	return normBiquad(A * (A + 1 + (A - 1) * cos + two), -2 * A * (A - 1 + (A + 1) * cos), A * (A + 1 + (A - 1) * cos - two), A + 1 - (A - 1) * cos + two, 2 * (A - 1 - (A + 1) * cos), A + 1 - (A - 1) * cos - two);
}
function processBiquad(x, f) {
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
function applyFilters(x, filters) {
	for (const f of filters) processBiquad(x, f);
}
function removeDc(x) {
	if (x.length === 0) return;
	let mean = 0;
	const step = Math.max(1, Math.floor(x.length / 2e5));
	let n = 0;
	for (let i = 0; i < x.length; i += step) {
		mean += x[i];
		n++;
	}
	mean /= n;
	if (Math.abs(mean) < 1e-6) return;
	for (let i = 0; i < x.length; i++) x[i] -= mean;
}
function cutSilence(x, sampleRate) {
	if (x.length < sampleRate * .08) return x.slice();
	const win = Math.max(1, Math.floor(sampleRate * .02));
	const hop = Math.max(1, Math.floor(sampleRate * .01));
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
	const p20 = sorted[Math.floor(sorted.length * .2)] ?? 0;
	const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))] ?? .01;
	const thr = Math.min(Math.max(p20 * 2.6, .0038), Math.max(p95 * .22, .0038));
	const voiced = Array.from(energy, (v) => v >= thr);
	const first = voiced.findIndex(Boolean);
	if (first < 0) return x.slice(0, Math.min(x.length, Math.floor(sampleRate * .25)));
	let last = voiced.length - 1;
	while (last > first && !voiced[last]) last--;
	const padIn = Math.floor(sampleRate * .045);
	const padOut = Math.floor(sampleRate * .09);
	const regionStart = Math.max(0, first * hop - padIn);
	const regionEnd = Math.min(x.length, last * hop + win + padOut);
	const keepGap = Math.floor(sampleRate * .16);
	const minSilentFrames = Math.max(2, Math.floor(sampleRate * .38 / hop));
	const pieces = [];
	let f = first;
	while (f <= last) if (voiced[f]) {
		let g = f;
		while (g <= last && voiced[g]) g++;
		pieces.push({
			a: Math.max(regionStart, f * hop - Math.floor(sampleRate * .02)),
			b: Math.min(regionEnd, g * hop + win)
		});
		f = g;
	} else {
		let g = f;
		while (g <= last && !voiced[g]) g++;
		if (g - f >= minSilentFrames) {
			const mid = Math.floor((f + g) / 2 * hop);
			const a = Math.max(regionStart, mid - Math.floor(keepGap / 2));
			pieces.push({
				a,
				b: Math.min(regionEnd, a + keepGap)
			});
		} else pieces.push({
			a: Math.max(regionStart, f * hop),
			b: Math.min(regionEnd, g * hop + win)
		});
		f = g;
	}
	pieces.sort((p, q) => p.a - q.a);
	const merged = [];
	for (const piece of pieces) {
		if (piece.b <= piece.a) continue;
		const prev = merged[merged.length - 1];
		if (prev && piece.a <= prev.b) prev.b = Math.max(prev.b, piece.b);
		else merged.push({
			a: piece.a,
			b: piece.b
		});
	}
	let total = 0;
	for (const piece of merged) total += piece.b - piece.a;
	if (total < Math.floor(sampleRate * .05)) return x.slice(regionStart, regionEnd);
	const out = new Float32Array(total);
	const fade = Math.max(1, Math.min(Math.floor(sampleRate * .008), hop));
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
function trimEdges(x, sampleRate) {
	if (x.length < sampleRate * .05) return x.slice();
	const win = Math.max(1, Math.floor(sampleRate * .02));
	const hop = Math.max(1, Math.floor(sampleRate * .01));
	const thr = Math.max(.004, peakAbs(x) * .02);
	let first = 0;
	let last = x.length;
	for (let i = 0; i + win < x.length; i += hop) {
		let s = 0;
		for (let j = 0; j < win; j++) s += x[i + j] * x[i + j];
		if (Math.sqrt(s / win) > thr) {
			first = Math.max(0, i - Math.floor(sampleRate * .03));
			break;
		}
	}
	for (let i = x.length - win; i > 0; i -= hop) {
		let s = 0;
		for (let j = 0; j < win; j++) s += x[i + j] * x[i + j];
		if (Math.sqrt(s / win) > thr) {
			last = Math.min(x.length, i + win + Math.floor(sampleRate * .05));
			break;
		}
	}
	if (last - first < Math.floor(sampleRate * .05)) return x.slice();
	return x.slice(first, last);
}
function lowpass1(x, sampleRate, freq) {
	if (freq >= sampleRate * .45) return;
	const a = Math.exp(-2 * Math.PI * freq / sampleRate);
	let y = 0;
	const b = 1 - a;
	for (let i = 0; i < x.length; i++) {
		y = b * x[i] + a * y;
		x[i] = y;
	}
}
function deEss(x, sampleRate) {
	const hp = x.slice();
	processBiquad(hp, biquadHP(5600, sampleRate, .7));
	const att = Math.exp(-1 / (sampleRate * .004));
	const rel = Math.exp(-1 / (sampleRate * .05));
	let env = 0;
	for (let i = 0; i < x.length; i++) {
		const a = Math.abs(hp[i]);
		env = a > env ? att * env + (1 - att) * a : rel * env + (1 - rel) * a;
		const over = env - .055;
		if (over > 0) {
			const gr = Math.min(.62, over * 3.4);
			x[i] -= hp[i] * gr;
		}
	}
}
function smoothInPlace(x, sampleRate) {
	lowpass1(x, sampleRate, 13500);
	deEss(x, sampleRate);
}
function downwardExpand(x, sampleRate) {
	const peak = peakAbs(x);
	const open = Math.max(peak * .075, .0045);
	const openDb = linToDb(open);
	const att = Math.exp(-1 / (sampleRate * .008));
	const rel = Math.exp(-1 / (sampleRate * .09));
	let env = 0;
	for (let i = 0; i < x.length; i++) {
		const a = Math.abs(x[i]);
		env = a > env ? att * env + (1 - att) * a : rel * env + (1 - rel) * a;
		if (env < open) {
			const envDb = linToDb(env);
			const g = dbToLin(openDb - (openDb - envDb) * 2.15 - envDb);
			x[i] *= Math.min(1, Math.max(.03, g));
		}
	}
}
function gentleDenoise(x, sampleRate) {
	const y = x.slice();
	removeDc(y);
	processBiquad(y, biquadHP(75, sampleRate, .707));
	downwardExpand(y, sampleRate);
	return y;
}
function fftRadix2(re, im, inverse) {
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
		const ang = (inverse ? 2 : -2) * Math.PI / len;
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
	if (inverse) for (let i = 0; i < n; i++) {
		re[i] /= n;
		im[i] /= n;
	}
}
function hann(n) {
	const w = new Float32Array(n);
	for (let i = 0; i < n; i++) w[i] = .5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)));
	return w;
}
async function spectralDenoise(x, sampleRate) {
	const nfft = 512;
	const hop = x.length > sampleRate * 90 ? 256 : 128;
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
	const e20 = order[Math.floor(frameCount * .2)] ?? 0;
	if (!(e20 < (order[Math.floor(frameCount * .8)] ?? 1) * .45)) return gentleDenoise(x, sampleRate);
	const noiseIdx = [];
	const gate = e20 * 1.35 + 1e-12;
	for (let f = 0; f < frameCount && noiseIdx.length < Math.max(4, Math.floor(frameCount * .12)); f++) if (energy[f] <= gate) noiseIdx.push(f);
	if (noiseIdx.length < 3) return gentleDenoise(x, sampleRate);
	const bins = 257;
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
			const cleaned = Math.max(mag - noiseMag[i] * 1.15, mag * .07);
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
	processBiquad(result, biquadHP(70, sampleRate, .707));
	downwardExpand(result, sampleRate);
	return result;
}
function saturate(x, drive) {
	const norm = Math.tanh(drive);
	for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * drive) / norm;
}
function earlyReflections(x, sampleRate) {
	const out = x.slice();
	for (const [sec, gain] of [
		[.016, .2],
		[.027, .13],
		[.041, .07],
		[.058, .04]
	]) {
		const d = Math.floor(sampleRate * sec);
		for (let i = d; i < x.length; i++) out[i] += x[i - d] * gain;
	}
	applyGain(out, .84);
	return out;
}
function addComb(src, wet, sampleRate, delayMs, feedback, damp, gain) {
	const d = Math.max(1, Math.floor(sampleRate * delayMs / 1e3));
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
function allpassInPlace(x, sampleRate, delayMs, g) {
	const d = Math.max(1, Math.floor(sampleRate * delayMs / 1e3));
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
function plate(dry, sampleRate) {
	const tail = Math.floor(sampleRate * 1.05);
	const pre = Math.floor(sampleRate * .028);
	const src = new Float32Array(dry.length + tail);
	for (let i = 0; i < dry.length; i++) src[i + pre] = dry[i];
	const wet = new Float32Array(src.length);
	addComb(src, wet, sampleRate, 29.7, .74, .28, .26);
	addComb(src, wet, sampleRate, 37.1, .72, .32, .24);
	addComb(src, wet, sampleRate, 41.3, .7, .34, .22);
	addComb(src, wet, sampleRate, 43.7, .68, .36, .2);
	allpassInPlace(wet, sampleRate, 5.2, .65);
	allpassInPlace(wet, sampleRate, 1.7, .65);
	const out = new Float32Array(src.length);
	for (let i = 0; i < dry.length; i++) out[i] = dry[i] * .84;
	for (let i = 0; i < out.length; i++) out[i] += wet[i] * .22;
	return out;
}
function character(x, sampleRate, mode) {
	const y = x.slice();
	if (mode === "sach") applyFilters(y, [
		biquadHP(80, sampleRate, .707),
		biquadLowShelf(170, sampleRate, -2.2, .7),
		biquadPeak(360, sampleRate, -1.5, .9),
		biquadPeak(2500, sampleRate, 2.2, .9),
		biquadPeak(3400, sampleRate, 1.6, 1.1),
		biquadPeak(7e3, sampleRate, -2.1, 1.25),
		biquadHighShelf(10500, sampleRate, 1, .7)
	]);
	else if (mode === "phongthanh") {
		applyFilters(y, [
			biquadHP(185, sampleRate, .78),
			biquadPeak(280, sampleRate, -3.3, .9),
			biquadPeak(1600, sampleRate, 4.6, .8),
			biquadPeak(3200, sampleRate, 3.6, 1),
			biquadPeak(7400, sampleRate, -2.6, 1.35)
		]);
		saturate(y, 1.32);
		const reflected = earlyReflections(y, sampleRate);
		restrainPeak(reflected, 1);
		return reflected;
	} else {
		applyFilters(y, [
			biquadHP(70, sampleRate, .707),
			biquadLowShelf(190, sampleRate, 3.3, .7),
			biquadPeak(420, sampleRate, -1.1, .8),
			biquadPeak(2800, sampleRate, 3, .95),
			biquadPeak(6600, sampleRate, -3.1, 1.45),
			biquadHighShelf(11e3, sampleRate, 1.15, .7)
		]);
		saturate(y, 1.1);
		const wet = plate(y, sampleRate);
		restrainPeak(wet, 1);
		return wet;
	}
	restrainPeak(y, 1);
	return y;
}
function gainComputer(levelDb, c) {
	const half = c.knee / 2;
	if (levelDb < c.thresholdDb - half) return 0;
	if (c.knee > 0 && levelDb < c.thresholdDb + half) {
		const t = levelDb - c.thresholdDb + half;
		return (1 / c.ratio - 1) * (t * t / (2 * c.knee));
	}
	return c.thresholdDb + (levelDb - c.thresholdDb) / c.ratio - levelDb;
}
function compressLinked(channels, sampleRate, c) {
	const n = channels[0]?.length ?? 0;
	if (!n) return;
	const det = new Float32Array(n);
	for (const ch of channels) for (let i = 0; i < n; i++) det[i] += ch[i] / channels.length;
	processBiquad(det, biquadHP(140, sampleRate, .707));
	const att = Math.exp(-1 / (sampleRate * c.attack));
	const rel = Math.exp(-1 / (sampleRate * c.release));
	let env = 0;
	const gains = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		const a = Math.abs(det[i]);
		env = a > env ? att * env + (1 - att) * a : rel * env + (1 - rel) * a;
		gains[i] = dbToLin(gainComputer(linToDb(env), c));
	}
	for (const ch of channels) for (let i = 0; i < n; i++) ch[i] *= gains[i];
}
function limitLinked(channels, sampleRate, ceiling = CEILING) {
	const n = channels[0]?.length ?? 0;
	if (!n) return;
	const look = Math.max(1, Math.floor(sampleRate * .005));
	const block = Math.max(32, Math.floor(look / 4));
	const nBlocks = Math.ceil(n / block);
	const blockMax = new Float32Array(nBlocks);
	for (let b = 0; b < nBlocks; b++) {
		const s = b * block;
		const e = Math.min(n, s + block);
		let m = 0;
		for (let i = s; i < e; i++) for (const ch of channels) {
			const a = Math.abs(ch[i]);
			if (a > m) m = a;
		}
		blockMax[b] = m;
	}
	const lookBlocks = Math.ceil(look / block) + 1;
	const rel = Math.exp(-1 / (sampleRate * .08));
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
function compProfile(mode) {
	if (mode === "phongthanh") return {
		thresholdDb: -21,
		ratio: 6.2,
		attack: .0035,
		release: .085,
		knee: 3
	};
	if (mode === "quangcao") return {
		thresholdDb: -18,
		ratio: 3.1,
		attack: .016,
		release: .17,
		knee: 8
	};
	return {
		thresholdDb: -16,
		ratio: 2.7,
		attack: .012,
		release: .13,
		knee: 6
	};
}
function technicalCompress(channels, sampleRate, mode) {
	compressLinked(channels, sampleRate, compProfile(mode));
	const level = rms(channels[0]);
	if (level > 1e-4) {
		const target = dbToLin(-16);
		const boost = Math.min(target / level, dbToLin(12));
		if (boost > 1.02) for (const ch of channels) applyGain(ch, boost);
	}
	limitLinked(channels, sampleRate, CEILING);
	for (const ch of channels) for (let i = 0; i < ch.length; i++) if (!Number.isFinite(ch[i])) ch[i] = 0;
}
async function processVoice(input, sampleRate, mode, onStep) {
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
function downmix(channels) {
	const n = channels[0]?.length ?? 0;
	const out = new Float32Array(n);
	if (!channels.length || !n) return out;
	const g = 1 / channels.length;
	for (const ch of channels) for (let i = 0; i < n; i++) out[i] += (ch[i] ?? 0) * g;
	return out;
}
function resampleLinear(x, fromRate, toRate) {
	if (fromRate === toRate || x.length === 0) return x.slice();
	const n = Math.max(1, Math.round(x.length * toRate / fromRate));
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
function fitBed(src, target, sampleRate) {
	const out = new Float32Array(Math.max(0, target));
	if (target <= 0 || src.length === 0) return out;
	if (src.length >= target) {
		out.set(src.subarray(0, target));
		return out;
	}
	const xfade = Math.min(Math.floor(sampleRate * .08), Math.floor(src.length / 3));
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
			} else out[pos + i] = s;
		}
		if (pos + src.length >= target) break;
		pos += step;
		first = false;
	}
	return out;
}
function fadeEdges(x, sampleRate, inSec, outSec) {
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
function matchRms(x, targetDb, maxBoostDb) {
	const level = rms(x);
	if (level < 1e-5) return;
	const boost = Math.min(dbToLin(targetDb) / level, dbToLin(maxBoostDb));
	if (boost > 0 && Math.abs(boost - 1) > .02) applyGain(x, boost);
}
function duck(music, voice, sampleRate) {
	const n = music[0]?.length ?? 0;
	const att = Math.exp(-1 / (sampleRate * .018));
	const rel = Math.exp(-1 / (sampleRate * .28));
	let env = 0;
	for (let i = 0; i < n; i++) {
		const v = i < voice.length ? Math.abs(voice[i]) : 0;
		env = v > env ? att * env + (1 - att) * v : rel * env + (1 - rel) * v;
		const g = 1 - Math.min(1, env / .11) * .64;
		for (const ch of music) ch[i] *= g;
	}
}
async function prepareVoice(voice, sampleRate) {
	const clean = await spectralDenoise(trimEdges(voice, sampleRate), sampleRate);
	smoothInPlace(clean, sampleRate);
	applyFilters(clean, [
		biquadHP(75, sampleRate, .707),
		biquadLowShelf(180, sampleRate, 3.1, .7),
		biquadPeak(260, sampleRate, 1.4, .8),
		biquadPeak(3e3, sampleRate, 3.2, .95),
		biquadPeak(6800, sampleRate, -2.4, 1.4),
		biquadHighShelf(10500, sampleRate, .8, .7)
	]);
	saturate(clean, 1.08);
	fadeEdges(clean, sampleRate, .012, .02);
	matchRms(clean, -18, 18);
	restrainPeak(clean, .92);
	return clean;
}
function bedPlan(voiceLength, musicLength, sampleRate) {
	if (musicLength + sampleRate * .08 < voiceLength) return "Nhạc ngắn hơn lời — nhân bản, chồng mờ, rồi khớp thời lượng.";
	if (musicLength > voiceLength + sampleRate * .08) return "Nhạc dài hơn lời — cắt bớt cho đúng thời lượng lời.";
	return "Nhạc và lời đã cùng thời lượng.";
}
async function mixVoiceAndBed(voiceIn, voiceRate, musicIn, musicRate, onStep) {
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
		processBiquad(ch, biquadHP(50, sampleRate, .707));
		processBiquad(ch, biquadPeak(2800, sampleRate, -3, .85));
		processBiquad(ch, biquadHighShelf(9e3, sampleRate, -1.2, .7));
	}
	const bedRms = rms(beds[0]);
	if (bedRms > 1e-5) {
		const g = Math.min(dbToLin(-23) / bedRms, dbToLin(18));
		for (const ch of beds) applyGain(ch, g);
	}
	await yieldUI();
	onStep?.(3);
	duck(beds, voice, sampleRate);
	const fadeIn = Math.min(1.6, Math.max(.35, voice.length / sampleRate * .08));
	const fadeOut = Math.min(2.2, Math.max(.5, voice.length / sampleRate * .12));
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
		attack: .02,
		release: .2,
		knee: 6
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
	return {
		left,
		right,
		sampleRate,
		plan
	};
}
function makePeaks(x, bars = 72) {
	const out = new Array(bars).fill(0);
	if (!x.length) return out;
	const size = Math.max(1, Math.floor(x.length / bars));
	let max = 1e-4;
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
	const norm = max > 1 ? max : Math.max(max, .2);
	for (let i = 0; i < bars; i++) out[i] = Math.min(1, out[i] / norm);
	return out;
}
function formatTime(sec) {
	if (!Number.isFinite(sec) || sec < 0) sec = 0;
	const s = Math.floor(sec);
	return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
function formatBytes(n) {
	if (n < 1024) return `${Math.max(0, Math.round(n))} B`;
	if (n < 1048576) return `${Math.round(n / 1024)} KB`;
	return `${(n / 1048576).toFixed(1)} MB`;
}
function stampName(tag) {
	const d = /* @__PURE__ */ new Date();
	const p = (v) => String(v).padStart(2, "0");
	return `ThuVang_${tag}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}
function safeBase(name) {
	return name.replace(/[^\p{L}\p{N}_-]+/gu, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "ThuVang";
}
var shared = null;
function audioContext() {
	if (!shared || shared.state === "closed") shared = new AudioContext();
	return shared;
}
async function decodeMedia(file) {
	const ctx = audioContext();
	if (ctx.state === "suspended") await ctx.resume();
	const raw = await file.arrayBuffer();
	try {
		return await ctx.decodeAudioData(raw.slice(0));
	} catch {
		throw new Error("Không tách được tiếng. Hãy dùng MP3, WAV, M4A, OGG, WEBM hoặc video có tiếng.");
	}
}
function channelsFrom(buffer) {
	return Array.from({ length: buffer.numberOfChannels }, (_, i) => new Float32Array(buffer.getChannelData(i)));
}
function toBuffer(channels, sampleRate) {
	const ctx = audioContext();
	const length = channels[0]?.length ?? 0;
	const buffer = ctx.createBuffer(Math.max(1, channels.length), Math.max(1, length), sampleRate);
	channels.forEach((ch, i) => buffer.getChannelData(i).set(ch.subarray(0, length)));
	return buffer;
}
function wavBlob(channels, sampleRate) {
	const chs = (channels.length > 1 ? channels.slice(0, 2) : [channels[0] ?? /* @__PURE__ */ new Float32Array(0)]).map((ch) => sampleRate > 24e3 ? resampleLinear(ch, sampleRate, 22050) : ch);
	const rate = sampleRate > 24e3 ? 22050 : sampleRate;
	const n = chs[0]?.length ?? 0;
	const count = chs.length;
	const block = n * count;
	const bytes = /* @__PURE__ */ new ArrayBuffer(44 + block * 2);
	const view = new DataView(bytes);
	const writeStr = (off, s) => {
		for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
	};
	writeStr(0, "RIFF");
	view.setUint32(4, 36 + block * 2, true);
	writeStr(8, "WAVE");
	writeStr(12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, count, true);
	view.setUint32(24, rate, true);
	view.setUint32(28, rate * count * 2, true);
	view.setUint16(32, count * 2, true);
	view.setUint16(34, 16, true);
	writeStr(36, "data");
	view.setUint32(40, block * 2, true);
	let o = 44;
	for (let i = 0; i < n; i++) for (let c = 0; c < count; c++) {
		const s = Math.max(-1, Math.min(1, chs[c][i] ?? 0));
		view.setInt16(o, s < 0 ? s * 32768 : s * 32767, true);
		o += 2;
	}
	return new Blob([bytes], { type: "audio/wav" });
}
async function encodeOpus(channels, sampleRate, bitrate) {
	if (typeof AudioEncoder === "undefined" || !channels[0]?.length) return null;
	const rate = 48e3;
	const chs = channels.slice(0, 2).map((ch) => resampleLinear(ch, sampleRate, rate));
	const count = chs.length;
	const frames = chs[0].length;
	if (!(await AudioEncoder.isConfigSupported({
		codec: "opus",
		sampleRate: rate,
		numberOfChannels: count,
		bitrate
	})).supported) return null;
	const target = new ArrayBufferTarget();
	const muxer = new Muxer({
		target,
		audio: {
			codec: "A_OPUS",
			numberOfChannels: count,
			sampleRate: rate
		},
		firstTimestampBehavior: "offset"
	});
	let failed = false;
	const encoder = new AudioEncoder({
		output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
		error: () => {
			failed = true;
		}
	});
	encoder.configure({
		codec: "opus",
		sampleRate: rate,
		numberOfChannels: count,
		bitrate
	});
	const packet = 960;
	for (let offset = 0; offset < frames; offset += packet) {
		const n = Math.min(packet, frames - offset);
		const data = new Float32Array(n * count);
		for (let c = 0; c < count; c++) data.set(chs[c].subarray(offset, offset + n), c * n);
		const audio = new AudioData({
			format: "f32-planar",
			sampleRate: rate,
			numberOfFrames: n,
			numberOfChannels: count,
			timestamp: Math.round(offset / rate * 1e6),
			data
		});
		encoder.encode(audio);
		audio.close();
		if (offset % (packet * 80) === 0) await new Promise((resolve) => setTimeout(resolve, 0));
	}
	await encoder.flush();
	if (failed || encoder.state === "closed") return null;
	muxer.finalize();
	encoder.close();
	if (!target.buffer || target.buffer.byteLength < 64) return null;
	return new Blob([target.buffer], { type: "audio/webm" });
}
function fileKind(filename) {
	if (filename.endsWith(".wav")) return {
		ext: ".wav",
		mime: "audio/wav",
		description: "WAV"
	};
	if (filename.endsWith(".mp3")) return {
		ext: ".mp3",
		mime: "audio/mpeg",
		description: "MP3"
	};
	return {
		ext: ".webm",
		mime: "audio/webm",
		description: "WebM"
	};
}
var MPEG_RATES = [
	8e3,
	11025,
	12e3,
	16e3,
	22050,
	24e3,
	32e3,
	44100,
	48e3
];
function mpegRate(sampleRate) {
	if (MPEG_RATES.includes(sampleRate)) return sampleRate;
	return MPEG_RATES.reduce((best, rate) => Math.abs(rate - sampleRate) < Math.abs(best - sampleRate) ? rate : best);
}
function floatToI16(x) {
	const out = new Int16Array(x.length);
	for (let i = 0; i < x.length; i++) {
		const s = Math.max(-1, Math.min(1, x[i] ?? 0));
		out[i] = s < 0 ? s * 32768 : s * 32767;
	}
	return out;
}
async function encodeMp3(channels, sampleRate, kbps) {
	const rate = mpegRate(sampleRate);
	const src = channels.slice(0, 2).map((ch) => rate === sampleRate ? ch : resampleLinear(ch, sampleRate, rate));
	const count = src.length > 1 ? 2 : 1;
	const left = src[0] ?? /* @__PURE__ */ new Float32Array(0);
	const right = count === 2 ? src[1] ?? left : left;
	const encoder = new Sr(count, rate, Math.max(32, Math.min(320, kbps)));
	const parts = [];
	const block = 1152;
	for (let i = 0; i < left.length; i += block) {
		const end = Math.min(left.length, i + block);
		const l = floatToI16(left.subarray(i, end));
		const chunk = count === 2 ? encoder.encodeBuffer(l, floatToI16(right.subarray(i, end))) : encoder.encodeBuffer(l);
		if (chunk.length) parts.push(chunk);
		if (i / block % 20 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
	}
	const tail = encoder.flush();
	if (tail.length) parts.push(tail);
	if (!parts.length) throw new Error("Không nén được MP3.");
	const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
	const joined = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		joined.set(part, offset);
		offset += part.byteLength;
	}
	return new Blob([joined.buffer], { type: "audio/mpeg" });
}
async function encodeCompact(channels, sampleRate, bitsPerSecond) {
	const data = channels.filter((ch) => ch.length > 0);
	const source = data.length ? data : [new Float32Array(Math.max(1, sampleRate))];
	try {
		const opus = await encodeOpus(source, sampleRate, bitsPerSecond);
		if (opus) return {
			blob: opus,
			ext: "webm"
		};
	} catch {}
	return {
		blob: wavBlob(source, sampleRate),
		ext: "wav"
	};
}
async function saveBlob(blob, filename) {
	const picker = window.showSaveFilePicker;
	const kind = fileKind(filename);
	if (picker) try {
		const writable = await (await picker({
			suggestedName: filename,
			types: [{
				description: kind.description,
				accept: { [kind.mime]: [kind.ext] }
			}]
		})).createWritable();
		await writable.write(blob);
		await writable.close();
		return "saved";
	} catch (err) {
		if (err instanceof DOMException && err.name === "AbortError") return "abort";
	}
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	window.setTimeout(() => URL.revokeObjectURL(url), 4e3);
	return "download";
}
var MODES = [
	{
		id: "sach",
		label: "SẠCH",
		hint: "JBL · BOSE — khô, rõ lời, không ù",
		file: "Sach",
		rate: 48e3
	},
	{
		id: "phongthanh",
		label: "PHÓNG THANH",
		hint: "TOA — truyền xa, vang ngắn, nén chặt",
		file: "PhongThanh",
		rate: 4e4
	},
	{
		id: "quangcao",
		label: "QUẢNG CÁO",
		hint: "Ấm, dày, vang plate, lời nổi",
		file: "QuangCao",
		rate: 64e3
	}
];
var CHAIN = [
	"+10%",
	"Cắt lặng",
	"Lọc ồn",
	"Mượt",
	"Đặc tính",
	"+15%",
	"Nén"
];
var MIX_STEPS = [
	"Sạch lời",
	"Dày ấm",
	"Khớp nhạc",
	"Vào / ra",
	"+10%",
	"Nén"
];
function modeMeta(id) {
	return MODES.find((m) => m.id === id) ?? MODES[0];
}
var BARS = 48;
function Waveform({ peaks, analyser, active }) {
	const ref = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const host = ref.current;
		if (!host) return;
		const bars = host.children;
		const paint = (list) => {
			for (let i = 0; i < bars.length; i++) {
				const amp = list[i] ?? .06;
				const node = bars[i];
				node.style.transform = `scaleY(${Math.max(.08, Math.min(1, amp))})`;
				node.style.opacity = String(.35 + Math.min(1, amp) * .65);
			}
		};
		const fit = (list) => {
			if (list.length === BARS) return list;
			const out = [];
			for (let i = 0; i < BARS; i++) {
				const at = Math.floor(i / BARS * list.length);
				out.push(list[at] ?? .06);
			}
			return out;
		};
		let raf = 0;
		if (active && analyser) {
			const buf = new Float32Array(analyser.fftSize);
			const tick = () => {
				analyser.getFloatTimeDomainData(buf);
				const step = Math.max(1, Math.floor(buf.length / BARS));
				const list = [];
				for (let i = 0; i < BARS; i++) {
					let m = 0;
					const s = i * step;
					for (let j = 0; j < step; j += 2) m = Math.max(m, Math.abs(buf[s + j] || 0));
					list.push(Math.min(1, m * 1.4));
				}
				paint(list);
				raf = requestAnimationFrame(tick);
			};
			raf = requestAnimationFrame(tick);
			return () => cancelAnimationFrame(raf);
		}
		paint(fit(peaks && peaks.length ? peaks : new Array(BARS).fill(.06)));
		return () => cancelAnimationFrame(raf);
	}, [
		peaks,
		analyser,
		active
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref,
		className: "wave",
		"aria-hidden": "true",
		children: Array.from({ length: BARS }, (_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "wave-bar" }, i))
	});
}
function ModeSwitch({ value, onChange, disabled }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid grid-cols-3 gap-1",
		role: "radiogroup",
		"aria-label": "Chế độ xử lý",
		children: MODES.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			role: "radio",
			"aria-checked": value === m.id,
			disabled,
			onClick: () => onChange(m.id),
			className: value === m.id ? "mode-btn mode-btn-on" : "mode-btn",
			children: m.label
		}, m.id))
	});
}
function Steps({ labels, step }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "steps",
		"aria-label": "Chuỗi xử lý",
		children: labels.map((label, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: i <= step ? "step step-on" : "step",
			children: label
		}, label))
	});
}
function clampPos(x, y) {
	const margin = 8;
	const size = 76;
	return {
		x: Math.min(Math.max(margin, x), window.innerWidth - size - margin),
		y: Math.min(Math.max(margin, y), window.innerHeight - size - margin)
	};
}
function Studio() {
	const [p1Mode, setP1Mode] = (0, import_react.useState)("sach");
	const [p2Mode, setP2Mode] = (0, import_react.useState)("sach");
	const [job, setJob] = (0, import_react.useState)(null);
	const [p1Step, setP1Step] = (0, import_react.useState)(-1);
	const [p2Step, setP2Step] = (0, import_react.useState)(-1);
	const [mixStep, setMixStep] = (0, import_react.useState)(-1);
	const [recording, setRecording] = (0, import_react.useState)(false);
	const [elapsed, setElapsed] = (0, import_react.useState)(0);
	const [analyser, setAnalyser] = (0, import_react.useState)(null);
	const [micAsk, setMicAsk] = (0, import_react.useState)(false);
	const [p1Err, setP1Err] = (0, import_react.useState)("");
	const [p2Err, setP2Err] = (0, import_react.useState)("");
	const [mixErr, setMixErr] = (0, import_react.useState)("");
	const [note, setNote] = (0, import_react.useState)("");
	const [raw, setRaw] = (0, import_react.useState)(null);
	const [rawRate, setRawRate] = (0, import_react.useState)(48e3);
	const [cooked, setCooked] = (0, import_react.useState)(null);
	const [cookedMode, setCookedMode] = (0, import_react.useState)("sach");
	const [p1Peaks, setP1Peaks] = (0, import_react.useState)(null);
	const [p1Name, setP1Name] = (0, import_react.useState)("");
	const [p1File, setP1File] = (0, import_react.useState)(null);
	const [p1Hot, setP1Hot] = (0, import_react.useState)(false);
	const [mediaName, setMediaName] = (0, import_react.useState)("");
	const [mediaDur, setMediaDur] = (0, import_react.useState)(0);
	const [mediaCh, setMediaCh] = (0, import_react.useState)(null);
	const [mediaRate, setMediaRate] = (0, import_react.useState)(48e3);
	const [p2Peaks, setP2Peaks] = (0, import_react.useState)(null);
	const [p2Cooked, setP2Cooked] = (0, import_react.useState)(null);
	const [p2Name, setP2Name] = (0, import_react.useState)("");
	const [p2File, setP2File] = (0, import_react.useState)(null);
	const [mixOpen, setMixOpen] = (0, import_react.useState)(false);
	const [voiceName, setVoiceName] = (0, import_react.useState)("");
	const [musicName, setMusicName] = (0, import_react.useState)("");
	const [voiceCh, setVoiceCh] = (0, import_react.useState)(null);
	const [voiceRate, setVoiceRate] = (0, import_react.useState)(48e3);
	const [musicCh, setMusicCh] = (0, import_react.useState)(null);
	const [musicRate, setMusicRate] = (0, import_react.useState)(48e3);
	const [mixPlan, setMixPlan] = (0, import_react.useState)("");
	const [mixAudio, setMixAudio] = (0, import_react.useState)(null);
	const [mixName, setMixName] = (0, import_react.useState)("");
	const [mixFile, setMixFile] = (0, import_react.useState)(null);
	const [pos, setPos] = (0, import_react.useState)(null);
	const [playing, setPlaying] = (0, import_react.useState)(null);
	const [mp3Busy, setMp3Busy] = (0, import_react.useState)(null);
	const streamRef = (0, import_react.useRef)(null);
	const recRef = (0, import_react.useRef)(null);
	const chunksRef = (0, import_react.useRef)([]);
	const micOk = (0, import_react.useRef)(false);
	const playRef = (0, import_react.useRef)(null);
	const posRef = (0, import_react.useRef)(pos);
	posRef.current = pos;
	const pushed = (0, import_react.useRef)(false);
	const stopPlay = (0, import_react.useCallback)(() => {
		try {
			playRef.current?.stop();
		} catch {}
		playRef.current = null;
		setPlaying(null);
	}, []);
	(0, import_react.useEffect)(() => () => {
		streamRef.current?.getTracks().forEach((t) => t.stop());
		stopPlay();
	}, [stopPlay]);
	(0, import_react.useEffect)(() => {
		if (!recording) return;
		const t0 = performance.now();
		const id = window.setInterval(() => setElapsed((performance.now() - t0) / 1e3), 200);
		return () => window.clearInterval(id);
	}, [recording]);
	(0, import_react.useEffect)(() => {
		const rawPos = localStorage.getItem("thuvang-mica");
		if (rawPos) try {
			const saved = JSON.parse(rawPos);
			if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
				setPos(clampPos(saved.x, saved.y));
				return;
			}
		} catch {}
		setPos({
			x: window.innerWidth - 92,
			y: window.innerHeight - 112
		});
	}, []);
	(0, import_react.useEffect)(() => {
		const onPop = () => {
			pushed.current = false;
			setMixOpen(false);
			setMicAsk(false);
		};
		window.addEventListener("popstate", onPop);
		return () => window.removeEventListener("popstate", onPop);
	}, []);
	const pushOverlay = () => {
		if (pushed.current) return;
		history.pushState({ thuvang: 1 }, "");
		pushed.current = true;
	};
	const closeOverlay = () => {
		setMixOpen(false);
		setMicAsk(false);
		if (pushed.current) {
			pushed.current = false;
			history.back();
		}
	};
	const playBuffer = (0, import_react.useCallback)(async (id, channels, sampleRate) => {
		if (playing === id) {
			stopPlay();
			return;
		}
		stopPlay();
		const ctx = audioContext();
		if (ctx.state === "suspended") await ctx.resume();
		const src = ctx.createBufferSource();
		src.buffer = toBuffer(channels, sampleRate);
		src.connect(ctx.destination);
		src.onended = () => setPlaying((cur) => cur === id ? null : cur);
		src.start();
		playRef.current = src;
		setPlaying(id);
	}, [playing, stopPlay]);
	const finishP1 = (0, import_react.useCallback)(async (samples, sampleRate, mode) => {
		setJob("p1");
		setP1Err("");
		setP1Step(0);
		setRaw(samples);
		setRawRate(sampleRate);
		setP1Hot(samples.some((v, i) => i % 32 === 0 && Math.abs(v) > .98));
		try {
			const processed = await processVoice(samples, sampleRate, mode, setP1Step);
			const meta = modeMeta(mode);
			const encoded = await encodeCompact([processed], sampleRate, meta.rate);
			setCooked(processed);
			setCookedMode(mode);
			setP1Peaks(makePeaks(processed));
			setP1File(encoded);
			setP1Name((name) => name || stampName(meta.file));
			setNote("");
		} catch {
			setP1Err("Không xử lý được bản ghi. Hãy ghi ngắn hơn rồi thử lại.");
		} finally {
			setJob(null);
			setP1Step(CHAIN.length);
		}
	}, []);
	const startRec = async () => {
		setP1Err("");
		setNote("");
		stopPlay();
		let stream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: false,
					autoGainControl: false
				},
				video: false
			});
		} catch {
			try {
				stream = await navigator.mediaDevices.getUserMedia({
					audio: true,
					video: false
				});
			} catch {
				setP1Err("Máy đang chặn micro. Hãy cho phép micro rồi bấm ghi lại.");
				return;
			}
		}
		const ctx = audioContext();
		if (ctx.state === "suspended") await ctx.resume();
		const source = ctx.createMediaStreamSource(stream);
		const node = ctx.createAnalyser();
		node.fftSize = 1024;
		source.connect(node);
		const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
		const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : void 0);
		chunksRef.current = [];
		rec.ondataavailable = (ev) => {
			if (ev.data.size) chunksRef.current.push(ev.data);
		};
		rec.start(1e3);
		streamRef.current = stream;
		recRef.current = rec;
		setAnalyser(node);
		setElapsed(0);
		setRecording(true);
	};
	const stopRec = async () => {
		const rec = recRef.current;
		setRecording(false);
		setAnalyser(null);
		if (!rec) return;
		const blob = await new Promise((resolve) => {
			rec.onstop = () => resolve(new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" }));
			if (rec.state !== "inactive") rec.stop();
			else resolve(new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" }));
		});
		streamRef.current?.getTracks().forEach((t) => t.stop());
		streamRef.current = null;
		recRef.current = null;
		if (blob.size < 32) {
			setP1Err("Bản ghi trống. Hãy nói gần micro rồi ghi lại.");
			return;
		}
		try {
			const audio = await decodeMedia(new File([blob], "ghi.webm", { type: blob.type }));
			const mono = downmix(channelsFrom(audio));
			await finishP1(mono, audio.sampleRate, p1Mode);
		} catch {
			setP1Err("Không đọc được bản ghi. Hãy ghi lại.");
		}
	};
	const onRecord = () => {
		if (job) return;
		if (recording) {
			stopRec();
			return;
		}
		if (!micOk.current) {
			setMicAsk(true);
			pushOverlay();
			return;
		}
		startRec();
	};
	const runP2 = async () => {
		if (!mediaCh || job) return;
		setJob("p2");
		setP2Err("");
		setP2Step(0);
		stopPlay();
		try {
			const processed = await processVoice(downmix(mediaCh), mediaRate, p2Mode, setP2Step);
			const meta = modeMeta(p2Mode);
			const encoded = await encodeCompact([processed], mediaRate, meta.rate);
			setP2Cooked(processed);
			setP2Peaks(makePeaks(processed));
			setP2File(encoded);
			setP2Name((name) => name || stampName(`${meta.file}_Media`));
		} catch {
			setP2Err("Không xử lý được tệp này. Hãy thử tệp ngắn hơn.");
		} finally {
			setJob(null);
			setP2Step(CHAIN.length);
		}
	};
	const takeMedia = async (file) => {
		if (!file || job) return;
		setP2Err("");
		setP2Cooked(null);
		setP2File(null);
		setP2Peaks(null);
		try {
			const audio = await decodeMedia(file);
			setMediaCh(channelsFrom(audio));
			setMediaRate(audio.sampleRate);
			setMediaDur(audio.duration);
			setMediaName(file.name);
			setP2Name(stampName(`${modeMeta(p2Mode).file}_Media`));
		} catch (err) {
			setMediaCh(null);
			setMediaName("");
			setP2Err(err instanceof Error ? err.message : "Không tách được tiếng.");
		}
	};
	const takeMixFile = async (kind, file) => {
		if (!file) return;
		setMixErr("");
		setMixAudio(null);
		setMixFile(null);
		try {
			const audio = await decodeMedia(file);
			if (kind === "voice") {
				setVoiceCh(channelsFrom(audio));
				setVoiceRate(audio.sampleRate);
				setVoiceName(file.name);
				setMixName(stampName("Tron"));
			} else {
				setMusicCh(channelsFrom(audio));
				setMusicRate(audio.sampleRate);
				setMusicName(file.name);
			}
		} catch (err) {
			setMixErr(err instanceof Error ? err.message : "Không đọc được tệp.");
		}
	};
	const runMix = async () => {
		if (!voiceCh || !musicCh || job) return;
		setJob("mix");
		setMixErr("");
		setMixStep(0);
		stopPlay();
		try {
			const mixed = await mixVoiceAndBed(downmix(voiceCh), voiceRate, musicCh, musicRate, setMixStep);
			const encoded = await encodeCompact([mixed.left, mixed.right], mixed.sampleRate, 96e3);
			setMixAudio({
				left: mixed.left,
				right: mixed.right,
				rate: mixed.sampleRate
			});
			setMixPlan(mixed.plan);
			setMixFile(encoded);
			setMixName((name) => name || stampName("Tron"));
		} catch {
			setMixErr("Không trộn được. Hãy chọn lại lời và nhạc, tệp ngắn hơn nếu máy chậm.");
		} finally {
			setJob(null);
			setMixStep(MIX_STEPS.length);
		}
	};
	const store = async (which) => {
		const pack = which === "p1" ? p1File : which === "p2" ? p2File : mixFile;
		const base = which === "p1" ? p1Name : which === "p2" ? p2Name : mixName;
		if (!pack) return;
		const filename = `${safeBase(base)}.${pack.ext}`;
		const result = await saveBlob(pack.blob, filename);
		if (result === "abort") return;
		setNote(result === "saved" ? `Đã lưu ${filename}` : `Đã tải ${filename}`);
	};
	const storeMp3 = async (which) => {
		if (mp3Busy || job) return;
		const spec = which === "p1" && cooked ? {
			channels: [cooked],
			rate: rawRate,
			kbps: Math.round(modeMeta(cookedMode).rate / 1e3),
			base: p1Name
		} : which === "p2" && p2Cooked ? {
			channels: [p2Cooked],
			rate: mediaRate,
			kbps: Math.round(modeMeta(p2Mode).rate / 1e3),
			base: p2Name
		} : which === "mix" && mixAudio ? {
			channels: [mixAudio.left, mixAudio.right],
			rate: mixAudio.rate,
			kbps: 128,
			base: mixName
		} : null;
		if (!spec) return;
		setMp3Busy(which);
		try {
			const blob = await encodeMp3(spec.channels, spec.rate, spec.kbps);
			const filename = `${safeBase(spec.base)}.mp3`;
			const result = await saveBlob(blob, filename);
			if (result === "abort") return;
			setNote(result === "saved" ? `Đã lưu ${filename}` : `Đã tải ${filename} · ${formatBytes(blob.size)}`);
		} catch {
			setNote("Không nén được MP3. Hãy thử lại.");
		} finally {
			setMp3Busy(null);
		}
	};
	const voiceSec = voiceCh?.[0] ? voiceCh[0].length / voiceRate : 0;
	const musicSec = musicCh?.[0] ? musicCh[0].length / musicRate : 0;
	const planPreview = voiceCh && musicCh ? bedPlan(Math.round(voiceSec * voiceRate), Math.round(musicSec * voiceRate), voiceRate) : "";
	const busy = job !== null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-dvh flex-col bg-deep text-ink",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
				className: "safe-top px-4 pb-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-end justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "kicker",
						children: "PHÒNG THU"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-2xl font-extrabold tracking-wide",
						children: "THU VÀNG"
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "max-w-44 text-right text-xs leading-snug text-muted",
						children: "Sạch · Phóng thanh · Quảng cáo"
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "rule" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid min-h-0 flex-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "panel",
					"aria-label": "P1 ghi âm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "kicker",
								children: "P1"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-lg font-bold",
								children: "Ghi âm đa năng"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-muted",
								children: modeMeta(p1Mode).hint
							})
						] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModeSwitch, {
							value: p1Mode,
							onChange: setP1Mode,
							disabled: recording || job === "p1"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "well px-2 py-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Waveform, {
								peaks: p1Peaks,
								analyser,
								active: recording
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: recording ? "rec-btn is-on" : "rec-btn",
								onClick: onRecord,
								disabled: busy,
								"aria-pressed": recording,
								"aria-label": recording ? "Dừng ghi" : "Bắt đầu ghi",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "rec-core" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-2xl font-bold tabular-nums",
								children: formatTime(elapsed)
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted",
								children: recording ? "Đang ghi — bấm để dừng" : "Bấm để ghi"
							})] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Steps, {
							labels: CHAIN,
							step: job === "p1" ? p1Step : cooked ? CHAIN.length : -1
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs leading-relaxed text-muted",
							children: "Đúng thứ tự: tăng 10%, cắt khoảng lặng, lọc ồn, làm mượt, đặc tính, tăng 15%, nén kỹ thuật. Trần −1 dBTP."
						}),
						p1Hot ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-gold",
							children: "Nguồn chạm trần. Lùi micro rồi ghi lại cho đỡ vỡ."
						}) : null,
						p1Err ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-gold",
							children: p1Err
						}) : null,
						cooked ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											className: "btn-ghost",
											onClick: () => void playBuffer("p1", [cooked], rawRate),
											children: [playing === "p1" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "mr-1 inline size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "mr-1 inline size-4" }), "Nghe"]
										}),
										raw ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "btn-ghost",
											onClick: () => void playBuffer("p1raw", [raw], rawRate),
											children: playing === "p1raw" ? "Đang nghe gốc" : "Gốc"
										}) : null,
										cookedMode !== p1Mode ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "btn-gold",
											disabled: busy || recording || !raw,
											onClick: () => raw && void finishP1(raw, rawRate, p1Mode),
											children: "Xử lý lại"
										}) : null
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "grid gap-1 text-xs text-muted",
									children: ["Tên tệp", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "field",
										value: p1Name,
										onChange: (e) => setP1Name(e.target.value),
										maxLength: 80
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "btn-gold",
									disabled: !p1File || busy || mp3Busy !== null,
									onClick: () => void store("p1"),
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "mr-1 inline size-4" }),
										"Chọn nơi lưu",
										p1File ? ` · ${formatBytes(p1File.blob.size)} ${p1File.ext.toUpperCase()}` : ""
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "btn-ghost",
									disabled: busy || mp3Busy !== null,
									onClick: () => void storeMp3("p1"),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "mr-1 inline size-4" }), mp3Busy === "p1" ? "Đang nén MP3…" : "Tải MP3"]
								})
							]
						}) : null
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "panel panel-end",
					"aria-label": "P2 tách media",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "kicker",
								children: "P2"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-lg font-bold",
								children: "Tách âm từ media"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-muted",
								children: "Mọi tệp máy đọc được. Tiếng được tách rồi đi đúng chuỗi P1."
							})
						] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModeSwitch, {
							value: p2Mode,
							onChange: setP2Mode,
							disabled: job === "p2"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "well grid min-h-24 cursor-pointer place-items-center px-3 py-4 text-center",
							onDragOver: (e) => e.preventDefault(),
							onDrop: (e) => {
								e.preventDefault();
								takeMedia(e.dataTransfer.files?.[0]);
							},
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "sr-only",
									type: "file",
									accept: "audio/*,video/*",
									onChange: (e) => {
										takeMedia(e.target.files?.[0]);
										e.target.value = "";
									}
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "mb-1 size-5 text-gold" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-sm font-semibold",
									children: mediaName || "Chọn hoặc thả tệp nhạc, video"
								}),
								mediaCh ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-xs text-muted",
									children: [
										formatTime(mediaDur),
										" · ",
										mediaCh.length > 1 ? "stereo" : "mono"
									]
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs text-muted",
									children: "MP3, WAV, M4A, MP4, WEBM…"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "well px-2 py-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Waveform, {
								peaks: p2Peaks,
								analyser: null,
								active: false
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Steps, {
							labels: CHAIN,
							step: job === "p2" ? p2Step : p2Cooked ? CHAIN.length : -1
						}),
						p2Err ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-gold",
							children: p2Err
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "btn-gold",
							disabled: !mediaCh || busy || recording,
							onClick: () => void runP2(),
							children: job === "p2" ? "Đang xử lý chuỗi P1…" : "Xử lý theo chuỗi P1"
						}),
						p2Cooked ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "btn-ghost",
									onClick: () => void playBuffer("p2", [p2Cooked], mediaRate),
									children: [playing === "p2" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "mr-1 inline size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "mr-1 inline size-4" }), "Nghe bản đã xử lý"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "grid gap-1 text-xs text-muted",
									children: ["Tên tệp", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "field",
										value: p2Name,
										onChange: (e) => setP2Name(e.target.value),
										maxLength: 80
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "btn-gold",
									disabled: !p2File || busy || mp3Busy !== null,
									onClick: () => void store("p2"),
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "mr-1 inline size-4" }),
										"Chọn nơi lưu",
										p2File ? ` · ${formatBytes(p2File.blob.size)} ${p2File.ext.toUpperCase()}` : ""
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "btn-ghost",
									disabled: busy || mp3Busy !== null,
									onClick: () => void storeMp3("p2"),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "mr-1 inline size-4" }), mp3Busy === "p2" ? "Đang nén MP3…" : "Tải MP3"]
								})
							]
						}) : null
					]
				})]
			}),
			note ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "safe-bottom px-4 pb-3 text-center text-xs text-gold",
				children: note
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-2" }),
			mixOpen ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: pos ? "mica fixed z-30" : "mica fixed right-4 bottom-24 z-30",
				style: pos ? {
					left: pos.x,
					top: pos.y
				} : void 0,
				"aria-label": "Mở trộn lời và nhạc",
				onPointerDown: (e) => {
					const el = e.currentTarget;
					el.setPointerCapture(e.pointerId);
					const startX = e.clientX;
					const startY = e.clientY;
					const origin = posRef.current ?? {
						x: el.getBoundingClientRect().left,
						y: el.getBoundingClientRect().top
					};
					let moved = false;
					const latest = { ...origin };
					const move = (ev) => {
						const dx = ev.clientX - startX;
						const dy = ev.clientY - startY;
						if (dx * dx + dy * dy > 36) moved = true;
						const next = clampPos(origin.x + dx, origin.y + dy);
						latest.x = next.x;
						latest.y = next.y;
						setPos(next);
					};
					const up = () => {
						el.removeEventListener("pointermove", move);
						if (moved) localStorage.setItem("thuvang-mica", JSON.stringify(latest));
						else {
							setMixOpen(true);
							pushOverlay();
						}
					};
					el.addEventListener("pointermove", move);
					el.addEventListener("pointerup", up, { once: true });
				},
				children: "TRỘN"
			}),
			micAsk ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "sheet fixed inset-0 z-40 grid place-items-center px-5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "panel m-0 w-full max-w-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "kicker",
							children: "MICRO"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-lg font-bold",
							children: "Cho phép ghi âm"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm leading-relaxed text-muted",
							children: "THU VÀNG chỉ thu khi bạn bấm ghi. Không ghi nền, không gửi bản ghi đi đâu. Âm được xử lý ngay trên máy."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "btn-ghost flex-1",
								onClick: closeOverlay,
								children: "Huỷ"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "btn-gold flex-1",
								onClick: () => {
									micOk.current = true;
									closeOverlay();
									startRec();
								},
								children: "Cho phép micro"
							})]
						})
					]
				})
			}) : null,
			mixOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "sheet fixed inset-0 z-40 overflow-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "safe-top safe-bottom mx-auto grid w-full max-w-lg gap-3 px-4 py-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "kicker",
								children: "MICA"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-xl font-extrabold",
								children: "Trộn lời và nhạc"
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "btn-ghost",
								onClick: closeOverlay,
								children: "Đóng"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm leading-relaxed text-muted",
							children: "Nhạc nền to dần, nhỏ dần, tự lặp hoặc cắt cho khớp lời. Lời được làm sạch, to, dày, ấm và nổi trên nền. Sau đó tăng 10% và nén kỹ thuật."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilePick, {
							label: "File lời",
							name: voiceName,
							onFile: (file) => void takeMixFile("voice", file)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilePick, {
							label: "File nhạc nền",
							name: musicName,
							onFile: (file) => void takeMixFile("music", file)
						}),
						voiceCh && musicCh ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-sm text-ink",
							children: [
								"Lời ",
								formatTime(voiceSec),
								" · Nhạc ",
								formatTime(musicSec),
								". ",
								mixPlan || planPreview
							]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "steps",
							children: MIX_STEPS.map((label, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: i <= (job === "mix" ? mixStep : mixAudio ? MIX_STEPS.length : -1) ? "step step-on" : "step",
								children: label
							}, label))
						}),
						mixErr ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-gold",
							children: mixErr
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "btn-gold",
							disabled: !voiceCh || !musicCh || busy || recording,
							onClick: () => void runMix(),
							children: job === "mix" ? "Đang trộn…" : "Trộn, nén và nghe"
						}),
						mixAudio ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "btn-ghost",
									onClick: () => void playBuffer("mix", [mixAudio.left, mixAudio.right], mixAudio.rate),
									children: [playing === "mix" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "mr-1 inline size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "mr-1 inline size-4" }), "Nghe bản trộn"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "grid gap-1 text-xs text-muted",
									children: ["Tên tệp", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "field",
										value: mixName,
										onChange: (e) => setMixName(e.target.value),
										maxLength: 80
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "btn-gold",
									disabled: !mixFile || busy || mp3Busy !== null,
									onClick: () => void store("mix"),
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "mr-1 inline size-4" }),
										"Tải về",
										mixFile ? ` · ${formatBytes(mixFile.blob.size)} ${mixFile.ext.toUpperCase()}` : ""
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "btn-ghost",
									disabled: busy || mp3Busy !== null,
									onClick: () => void storeMp3("mix"),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "mr-1 inline size-4" }), mp3Busy === "mix" ? "Đang nén MP3…" : "Tải MP3"]
								})
							]
						}) : null
					]
				})
			}) : null
		]
	});
}
function FilePick({ label, name, onFile }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "well grid cursor-pointer gap-1 px-3 py-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				className: "sr-only",
				type: "file",
				accept: "audio/*,video/*",
				onChange: (e) => {
					onFile(e.target.files?.[0]);
					e.target.value = "";
				}
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-xs font-bold tracking-wide text-gold",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "truncate text-sm",
				children: name || "Chọn tệp"
			})
		]
	});
}
var SplitComponent = Studio;
//#endregion
export { SplitComponent as component };
