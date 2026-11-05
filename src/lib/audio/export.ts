import { Mp3Encoder } from "@breezystack/lamejs";
import { Muxer, ArrayBufferTarget } from "webm-muxer";
import { resampleLinear } from "@/lib/audio/chain";

export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${Math.max(0, Math.round(n))} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function stampName(tag: string): string {
  const d = new Date();
  const p = (v: number) => String(v).padStart(2, "0");
  return `ThuVang_${tag}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

export function safeBase(name: string): string {
  const cleaned = name.replace(/[^\p{L}\p{N}_-]+/gu, "_").replace(/^_+|_+$/g, "");
  return cleaned.slice(0, 80) || "ThuVang";
}

let shared: AudioContext | null = null;

export function audioContext(): AudioContext {
  if (!shared || shared.state === "closed") shared = new AudioContext();
  return shared;
}

export async function decodeMedia(file: File): Promise<AudioBuffer> {
  const ctx = audioContext();
  if (ctx.state === "suspended") await ctx.resume();
  const raw = await file.arrayBuffer();
  try {
    return await ctx.decodeAudioData(raw.slice(0));
  } catch {
    throw new Error("Không tách được tiếng. Hãy dùng MP3, WAV, M4A, OGG, WEBM hoặc video có tiếng.");
  }
}

export function channelsFrom(buffer: AudioBuffer): Float32Array[] {
  return Array.from({ length: buffer.numberOfChannels }, (_, i) => new Float32Array(buffer.getChannelData(i)));
}

export function toBuffer(channels: Float32Array[], sampleRate: number): AudioBuffer {
  const ctx = audioContext();
  const length = channels[0]?.length ?? 0;
  const buffer = ctx.createBuffer(Math.max(1, channels.length), Math.max(1, length), sampleRate);
  channels.forEach((ch, i) => buffer.getChannelData(i).set(ch.subarray(0, length)));
  return buffer;
}

type SaveHandle = {
  createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
};

type PickerWindow = Window & {
  showSaveFilePicker?: (opts: {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<SaveHandle>;
};

function wavBlob(channels: Float32Array[], sampleRate: number): Blob {
  const chs = (channels.length > 1 ? channels.slice(0, 2) : [channels[0] ?? new Float32Array(0)]).map((ch) =>
    sampleRate > 24000 ? resampleLinear(ch, sampleRate, 22050) : ch,
  );
  const rate = sampleRate > 24000 ? 22050 : sampleRate;
  const n = chs[0]?.length ?? 0;
  const count = chs.length;
  const block = n * count;
  const bytes = new ArrayBuffer(44 + block * 2);
  const view = new DataView(bytes);
  const writeStr = (off: number, s: string) => {
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
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < count; c++) {
      const s = Math.max(-1, Math.min(1, chs[c][i] ?? 0));
      view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([bytes], { type: "audio/wav" });
}

async function encodeOpus(channels: Float32Array[], sampleRate: number, bitrate: number): Promise<Blob | null> {
  if (typeof AudioEncoder === "undefined" || !channels[0]?.length) return null;
  const rate = 48000;
  const chs = channels.slice(0, 2).map((ch) => resampleLinear(ch, sampleRate, rate));
  const count = chs.length;
  const frames = chs[0].length;
  const supported = await AudioEncoder.isConfigSupported({
    codec: "opus",
    sampleRate: rate,
    numberOfChannels: count,
    bitrate,
  });
  if (!supported.supported) return null;
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    audio: { codec: "A_OPUS", numberOfChannels: count, sampleRate: rate },
    firstTimestampBehavior: "offset",
  });
  let failed = false;
  const encoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: () => {
      failed = true;
    },
  });
  encoder.configure({ codec: "opus", sampleRate: rate, numberOfChannels: count, bitrate });
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
      timestamp: Math.round((offset / rate) * 1_000_000),
      data,
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

function fileKind(filename: string): { ext: string; mime: string; description: string } {
  if (filename.endsWith(".wav")) return { ext: ".wav", mime: "audio/wav", description: "WAV" };
  if (filename.endsWith(".mp3")) return { ext: ".mp3", mime: "audio/mpeg", description: "MP3" };
  return { ext: ".webm", mime: "audio/webm", description: "WebM" };
}

const MPEG_RATES = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000];

function mpegRate(sampleRate: number): number {
  if (MPEG_RATES.includes(sampleRate)) return sampleRate;
  return MPEG_RATES.reduce((best, rate) => (Math.abs(rate - sampleRate) < Math.abs(best - sampleRate) ? rate : best));
}

function floatToI16(x: Float32Array): Int16Array {
  const out = new Int16Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const s = Math.max(-1, Math.min(1, x[i] ?? 0));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export async function encodeMp3(channels: Float32Array[], sampleRate: number, kbps: number): Promise<Blob> {
  const rate = mpegRate(sampleRate);
  const src = channels.slice(0, 2).map((ch) => (rate === sampleRate ? ch : resampleLinear(ch, sampleRate, rate)));
  const count = src.length > 1 ? 2 : 1;
  const left = src[0] ?? new Float32Array(0);
  const right = count === 2 ? (src[1] ?? left) : left;
  const encoder = new Mp3Encoder(count, rate, Math.max(32, Math.min(320, kbps)));
  const parts: Uint8Array[] = [];
  const block = 1152;
  for (let i = 0; i < left.length; i += block) {
    const end = Math.min(left.length, i + block);
    const l = floatToI16(left.subarray(i, end));
    const chunk = count === 2 ? encoder.encodeBuffer(l, floatToI16(right.subarray(i, end))) : encoder.encodeBuffer(l);
    if (chunk.length) parts.push(chunk);
    if ((i / block) % 20 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
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

export async function encodeCompact(
  channels: Float32Array[],
  sampleRate: number,
  bitsPerSecond: number,
): Promise<{ blob: Blob; ext: string }> {
  const data = channels.filter((ch) => ch.length > 0);
  const source = data.length ? data : [new Float32Array(Math.max(1, sampleRate))];
  try {
    const opus = await encodeOpus(source, sampleRate, bitsPerSecond);
    if (opus) return { blob: opus, ext: "webm" };
  } catch {
    /* WAV dự phòng */
  }
  return { blob: wavBlob(source, sampleRate), ext: "wav" };
}

export async function saveBlob(blob: Blob, filename: string): Promise<"saved" | "download" | "abort"> {
  const picker = (window as PickerWindow).showSaveFilePicker;
  const kind = fileKind(filename);
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: filename,
        types: [{ description: kind.description, accept: { [kind.mime]: [kind.ext] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "saved";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "abort";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "download";
}
