import assert from "node:assert/strict";
import test from "node:test";
import { cutSilence, fitBed, limitLinked, mixVoiceAndBed, processVoice, resampleLinear } from "./chain.ts";

test("silence trim keeps the tone and drops the long gap", () => {
  const sr = 8000;
  const tone = Math.floor(sr * 0.4);
  const gap = Math.floor(sr * 0.9);
  const x = new Float32Array(tone + gap + tone);
  for (let i = 0; i < tone; i++) {
    const s = Math.sin((2 * Math.PI * 440 * i) / sr) * 0.4;
    x[i] = s;
    x[tone + gap + i] = s;
  }
  const y = cutSilence(x, sr);
  assert.ok(y.length < x.length * 0.8);
  assert.ok(y.length > sr * 0.5);
});

test("bed fit loops short and trims long", () => {
  const src = new Float32Array(1000);
  src.fill(0.2);
  assert.equal(fitBed(src, 2500, 8000).length, 2500);
  assert.equal(fitBed(src, 400, 8000).length, 400);
});

test("resample length follows the rate", () => {
  const x = new Float32Array(16000);
  assert.equal(resampleLinear(x, 16000, 8000).length, 8000);
});

test("limiter holds the ceiling", () => {
  const x = new Float32Array(4000);
  x.fill(1.8);
  limitLinked([x], 8000, 0.89);
  for (let i = 0; i < x.length; i++) assert.ok(Math.abs(x[i]) <= 0.891);
});

test("voice chain stays finite and bounded", async () => {
  const sr = 16000;
  const x = new Float32Array(sr);
  for (let i = 0; i < x.length; i++) x[i] = Math.sin((2 * Math.PI * 220 * i) / sr) * 0.25;
  const y = await processVoice(x, sr, "sach");
  assert.ok(y.length > sr * 0.4);
  let peak = 0;
  for (let i = 0; i < y.length; i++) {
    assert.ok(Number.isFinite(y[i]));
    peak = Math.max(peak, Math.abs(y[i]));
  }
  assert.ok(peak <= 0.9);
  assert.ok(peak > 0.02);
});

test("mix matches the voice duration", async () => {
  const sr = 8000;
  const voice = new Float32Array(sr);
  const music = new Float32Array(Math.floor(sr * 0.35));
  for (let i = 0; i < voice.length; i++) voice[i] = Math.sin((2 * Math.PI * 180 * i) / sr) * 0.3;
  for (let i = 0; i < music.length; i++) music[i] = Math.sin((2 * Math.PI * 90 * i) / sr) * 0.2;
  const mix = await mixVoiceAndBed(voice, sr, [music], sr);
  assert.equal(mix.left.length, mix.right.length);
  assert.ok(mix.left.length > sr * 0.5);
  assert.match(mix.plan, /nhân bản/i);
});
