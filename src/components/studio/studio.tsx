import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Pause, Play, Upload } from "lucide-react";
import {
  bedPlan,
  downmix,
  makePeaks,
  mixVoiceAndBed,
  processVoice,
  type Mode,
} from "@/lib/audio/chain";
import {
  audioContext,
  channelsFrom,
  decodeMedia,
  encodeCompact,
  encodeMp3,
  formatBytes,
  formatTime,
  safeBase,
  saveBlob,
  stampName,
  toBuffer,
} from "@/lib/audio/export";

const MODES: { id: Mode; label: string; hint: string; file: string; rate: number }[] = [
  { id: "sach", label: "SẠCH", hint: "JBL · BOSE — khô, rõ lời, không ù", file: "Sach", rate: 48_000 },
  { id: "phongthanh", label: "PHÓNG THANH", hint: "TOA — truyền xa, vang ngắn, nén chặt", file: "PhongThanh", rate: 40_000 },
  { id: "quangcao", label: "QUẢNG CÁO", hint: "Ấm, dày, vang plate, lời nổi", file: "QuangCao", rate: 64_000 },
];

const CHAIN = ["+10%", "Cắt lặng", "Lọc ồn", "Mượt", "Đặc tính", "+15%", "Nén"];
const MIX_STEPS = ["Sạch lời", "Dày ấm", "Khớp nhạc", "Vào / ra", "+10%", "Nén"];

type Job = "p1" | "p2" | "mix" | null;

function modeMeta(id: Mode) {
  return MODES.find((m) => m.id === id) ?? MODES[0];
}

const BARS = 48;

function Waveform({ peaks, analyser, active }: { peaks: number[] | null; analyser: AnalyserNode | null; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const bars = host.children;
    const paint = (list: number[]) => {
      for (let i = 0; i < bars.length; i++) {
        const amp = list[i] ?? 0.06;
        const node = bars[i] as HTMLElement;
        node.style.transform = `scaleY(${Math.max(0.08, Math.min(1, amp))})`;
        node.style.opacity = String(0.35 + Math.min(1, amp) * 0.65);
      }
    };
    const fit = (list: number[]) => {
      if (list.length === BARS) return list;
      const out: number[] = [];
      for (let i = 0; i < BARS; i++) {
        const at = Math.floor((i / BARS) * list.length);
        out.push(list[at] ?? 0.06);
      }
      return out;
    };
    let raf = 0;
    if (active && analyser) {
      const buf = new Float32Array(analyser.fftSize);
      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        const step = Math.max(1, Math.floor(buf.length / BARS));
        const list: number[] = [];
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
    paint(fit(peaks && peaks.length ? peaks : new Array(BARS).fill(0.06)));
    return () => cancelAnimationFrame(raf);
  }, [peaks, analyser, active]);
  return (
    <div ref={ref} className="wave" aria-hidden="true">
      {Array.from({ length: BARS }, (_, i) => (
        <span key={i} className="wave-bar" />
      ))}
    </div>
  );
}

function ModeSwitch({ value, onChange, disabled }: { value: Mode; onChange: (m: Mode) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Chế độ xử lý">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={value === m.id}
          disabled={disabled}
          onClick={() => onChange(m.id)}
          className={value === m.id ? "mode-btn mode-btn-on" : "mode-btn"}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

function Steps({ labels, step }: { labels: string[]; step: number }) {
  return (
    <div className="steps" aria-label="Chuỗi xử lý">
      {labels.map((label, i) => (
        <span key={label} className={i <= step ? "step step-on" : "step"}>
          {label}
        </span>
      ))}
    </div>
  );
}

function clampPos(x: number, y: number) {
  const margin = 8;
  const size = 76;
  return {
    x: Math.min(Math.max(margin, x), window.innerWidth - size - margin),
    y: Math.min(Math.max(margin, y), window.innerHeight - size - margin),
  };
}

export function Studio() {
  const [p1Mode, setP1Mode] = useState<Mode>("sach");
  const [p2Mode, setP2Mode] = useState<Mode>("sach");
  const [job, setJob] = useState<Job>(null);
  const [p1Step, setP1Step] = useState(-1);
  const [p2Step, setP2Step] = useState(-1);
  const [mixStep, setMixStep] = useState(-1);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [micAsk, setMicAsk] = useState(false);
  const [p1Err, setP1Err] = useState("");
  const [p2Err, setP2Err] = useState("");
  const [mixErr, setMixErr] = useState("");
  const [note, setNote] = useState("");
  const [raw, setRaw] = useState<Float32Array | null>(null);
  const [rawRate, setRawRate] = useState(48000);
  const [cooked, setCooked] = useState<Float32Array | null>(null);
  const [cookedMode, setCookedMode] = useState<Mode>("sach");
  const [p1Peaks, setP1Peaks] = useState<number[] | null>(null);
  const [p1Name, setP1Name] = useState("");
  const [p1File, setP1File] = useState<{ blob: Blob; ext: string } | null>(null);
  const [p1Hot, setP1Hot] = useState(false);
  const [mediaName, setMediaName] = useState("");
  const [mediaDur, setMediaDur] = useState(0);
  const [mediaCh, setMediaCh] = useState<Float32Array[] | null>(null);
  const [mediaRate, setMediaRate] = useState(48000);
  const [p2Peaks, setP2Peaks] = useState<number[] | null>(null);
  const [p2Cooked, setP2Cooked] = useState<Float32Array | null>(null);
  const [p2Name, setP2Name] = useState("");
  const [p2File, setP2File] = useState<{ blob: Blob; ext: string } | null>(null);
  const [mixOpen, setMixOpen] = useState(false);
  const [voiceName, setVoiceName] = useState("");
  const [musicName, setMusicName] = useState("");
  const [voiceCh, setVoiceCh] = useState<Float32Array[] | null>(null);
  const [voiceRate, setVoiceRate] = useState(48000);
  const [musicCh, setMusicCh] = useState<Float32Array[] | null>(null);
  const [musicRate, setMusicRate] = useState(48000);
  const [mixPlan, setMixPlan] = useState("");
  const [mixAudio, setMixAudio] = useState<{ left: Float32Array; right: Float32Array; rate: number } | null>(null);
  const [mixName, setMixName] = useState("");
  const [mixFile, setMixFile] = useState<{ blob: Blob; ext: string } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [mp3Busy, setMp3Busy] = useState<"p1" | "p2" | "mix" | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const micOk = useRef(false);
  const playRef = useRef<AudioBufferSourceNode | null>(null);
  const posRef = useRef(pos);
  posRef.current = pos;
  const pushed = useRef(false);

  const stopPlay = useCallback(() => {
    try {
      playRef.current?.stop();
    } catch {
      /* đã dừng */
    }
    playRef.current = null;
    setPlaying(null);
  }, []);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    stopPlay();
  }, [stopPlay]);

  useEffect(() => {
    if (!recording) return;
    const t0 = performance.now();
    const id = window.setInterval(() => setElapsed((performance.now() - t0) / 1000), 200);
    return () => window.clearInterval(id);
  }, [recording]);

  useEffect(() => {
    const rawPos = localStorage.getItem("thuvang-mica");
    if (rawPos) {
      try {
        const saved = JSON.parse(rawPos) as { x: number; y: number };
        if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
          setPos(clampPos(saved.x, saved.y));
          return;
        }
      } catch {
        /* bỏ vị trí hỏng */
      }
    }
    setPos({ x: window.innerWidth - 92, y: window.innerHeight - 112 });
  }, []);

  useEffect(() => {
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

  const playBuffer = useCallback(
    async (id: string, channels: Float32Array[], sampleRate: number) => {
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
      src.onended = () => setPlaying((cur) => (cur === id ? null : cur));
      src.start();
      playRef.current = src;
      setPlaying(id);
    },
    [playing, stopPlay],
  );

  const finishP1 = useCallback(async (samples: Float32Array, sampleRate: number, mode: Mode) => {
    setJob("p1");
    setP1Err("");
    setP1Step(0);
    setRaw(samples);
    setRawRate(sampleRate);
    setP1Hot(samples.some((v, i) => i % 32 === 0 && Math.abs(v) > 0.98));
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
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
        video: false,
      });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
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
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (ev) => {
      if (ev.data.size) chunksRef.current.push(ev.data);
    };
    rec.start(1000);
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
    const blob = await new Promise<Blob>((resolve) => {
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
      void stopRec();
      return;
    }
    if (!micOk.current) {
      setMicAsk(true);
      pushOverlay();
      return;
    }
    void startRec();
  };

  const runP2 = async () => {
    if (!mediaCh || job) return;
    setJob("p2");
    setP2Err("");
    setP2Step(0);
    stopPlay();
    try {
      const mono = downmix(mediaCh);
      const processed = await processVoice(mono, mediaRate, p2Mode, setP2Step);
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

  const takeMedia = async (file: File | undefined) => {
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

  const takeMixFile = async (kind: "voice" | "music", file: File | undefined) => {
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
      const voice = downmix(voiceCh);
      const mixed = await mixVoiceAndBed(voice, voiceRate, musicCh, musicRate, setMixStep);
      const encoded = await encodeCompact([mixed.left, mixed.right], mixed.sampleRate, 96_000);
      setMixAudio({ left: mixed.left, right: mixed.right, rate: mixed.sampleRate });
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

  const store = async (which: "p1" | "p2" | "mix") => {
    const pack = which === "p1" ? p1File : which === "p2" ? p2File : mixFile;
    const base = which === "p1" ? p1Name : which === "p2" ? p2Name : mixName;
    if (!pack) return;
    const filename = `${safeBase(base)}.${pack.ext}`;
    const result = await saveBlob(pack.blob, filename);
    if (result === "abort") return;
    setNote(result === "saved" ? `Đã lưu ${filename}` : `Đã tải ${filename}`);
  };

  const storeMp3 = async (which: "p1" | "p2" | "mix") => {
    if (mp3Busy || job) return;
    const spec =
      which === "p1" && cooked
        ? { channels: [cooked], rate: rawRate, kbps: Math.round(modeMeta(cookedMode).rate / 1000), base: p1Name }
        : which === "p2" && p2Cooked
          ? { channels: [p2Cooked], rate: mediaRate, kbps: Math.round(modeMeta(p2Mode).rate / 1000), base: p2Name }
          : which === "mix" && mixAudio
            ? { channels: [mixAudio.left, mixAudio.right], rate: mixAudio.rate, kbps: 128, base: mixName }
            : null;
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
  const planPreview =
    voiceCh && musicCh ? bedPlan(Math.round(voiceSec * voiceRate), Math.round(musicSec * voiceRate), voiceRate) : "";
  const busy = job !== null;

  return (
    <div className="flex h-dvh flex-col bg-deep text-ink">
      <header className="safe-top px-4 pb-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="kicker">PHÒNG THU</p>
            <h1 className="text-2xl font-extrabold tracking-wide">THU VÀNG</h1>
          </div>
          <p className="max-w-44 text-right text-xs leading-snug text-muted">Sạch · Phóng thanh · Quảng cáo</p>
        </div>
      </header>
      <div className="rule" />
      <div className="grid min-h-0 flex-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-1">
        <section className="panel" aria-label="P1 ghi âm">
          <div>
            <p className="kicker">P1</p>
            <h2 className="text-lg font-bold">Ghi âm đa năng</h2>
            <p className="text-sm text-muted">{modeMeta(p1Mode).hint}</p>
          </div>
          <ModeSwitch value={p1Mode} onChange={setP1Mode} disabled={recording || job === "p1"} />
          <div className="well px-2 py-2">
            <Waveform peaks={p1Peaks} analyser={analyser} active={recording} />
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              className={recording ? "rec-btn is-on" : "rec-btn"}
              onClick={onRecord}
              disabled={busy}
              aria-pressed={recording}
              aria-label={recording ? "Dừng ghi" : "Bắt đầu ghi"}
            >
              <span className="rec-core" />
            </button>
            <div>
              <p className="text-2xl font-bold tabular-nums">{formatTime(elapsed)}</p>
              <p className="text-xs text-muted">{recording ? "Đang ghi — bấm để dừng" : "Bấm để ghi"}</p>
            </div>
          </div>
          <Steps labels={CHAIN} step={job === "p1" ? p1Step : cooked ? CHAIN.length : -1} />
          <p className="text-xs leading-relaxed text-muted">
            Đúng thứ tự: tăng 10%, cắt khoảng lặng, lọc ồn, làm mượt, đặc tính, tăng 15%, nén kỹ thuật. Trần −1 dBTP.
          </p>
          {p1Hot ? <p className="text-xs text-gold">Nguồn chạm trần. Lùi micro rồi ghi lại cho đỡ vỡ.</p> : null}
          {p1Err ? <p className="text-sm text-gold">{p1Err}</p> : null}
          {cooked ? (
            <div className="grid gap-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => void playBuffer("p1", [cooked], rawRate)}
                >
                  {playing === "p1" ? <Pause className="mr-1 inline size-4" /> : <Play className="mr-1 inline size-4" />}
                  Nghe
                </button>
                {raw ? (
                  <button type="button" className="btn-ghost" onClick={() => void playBuffer("p1raw", [raw], rawRate)}>
                    {playing === "p1raw" ? "Đang nghe gốc" : "Gốc"}
                  </button>
                ) : null}
                {cookedMode !== p1Mode ? (
                  <button
                    type="button"
                    className="btn-gold"
                    disabled={busy || recording || !raw}
                    onClick={() => raw && void finishP1(raw, rawRate, p1Mode)}
                  >
                    Xử lý lại
                  </button>
                ) : null}
              </div>
              <label className="grid gap-1 text-xs text-muted">
                Tên tệp
                <input className="field" value={p1Name} onChange={(e) => setP1Name(e.target.value)} maxLength={80} />
              </label>
              <button type="button" className="btn-gold" disabled={!p1File || busy || mp3Busy !== null} onClick={() => void store("p1")}>
                <Download className="mr-1 inline size-4" />
                Chọn nơi lưu
                {p1File ? ` · ${formatBytes(p1File.blob.size)} ${p1File.ext.toUpperCase()}` : ""}
              </button>
              <button type="button" className="btn-ghost" disabled={busy || mp3Busy !== null} onClick={() => void storeMp3("p1")}>
                <Download className="mr-1 inline size-4" />
                {mp3Busy === "p1" ? "Đang nén MP3…" : "Tải MP3"}
              </button>
            </div>
          ) : null}
        </section>

        <section className="panel panel-end" aria-label="P2 tách media">
          <div>
            <p className="kicker">P2</p>
            <h2 className="text-lg font-bold">Tách âm từ media</h2>
            <p className="text-sm text-muted">Mọi tệp máy đọc được. Tiếng được tách rồi đi đúng chuỗi P1.</p>
          </div>
          <ModeSwitch value={p2Mode} onChange={setP2Mode} disabled={job === "p2"} />
          <label
            className="well grid min-h-24 cursor-pointer place-items-center px-3 py-4 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void takeMedia(e.dataTransfer.files?.[0]);
            }}
          >
            <input
              className="sr-only"
              type="file"
              accept="audio/*,video/*"
              onChange={(e) => {
                void takeMedia(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Upload className="mb-1 size-5 text-gold" />
            <span className="text-sm font-semibold">{mediaName || "Chọn hoặc thả tệp nhạc, video"}</span>
            {mediaCh ? (
              <span className="text-xs text-muted">
                {formatTime(mediaDur)} · {mediaCh.length > 1 ? "stereo" : "mono"}
              </span>
            ) : (
              <span className="text-xs text-muted">MP3, WAV, M4A, MP4, WEBM…</span>
            )}
          </label>
          <div className="well px-2 py-2">
            <Waveform peaks={p2Peaks} analyser={null} active={false} />
          </div>
          <Steps labels={CHAIN} step={job === "p2" ? p2Step : p2Cooked ? CHAIN.length : -1} />
          {p2Err ? <p className="text-sm text-gold">{p2Err}</p> : null}
          <button type="button" className="btn-gold" disabled={!mediaCh || busy || recording} onClick={() => void runP2()}>
            {job === "p2" ? "Đang xử lý chuỗi P1…" : "Xử lý theo chuỗi P1"}
          </button>
          {p2Cooked ? (
            <div className="grid gap-2">
              <button type="button" className="btn-ghost" onClick={() => void playBuffer("p2", [p2Cooked], mediaRate)}>
                {playing === "p2" ? <Pause className="mr-1 inline size-4" /> : <Play className="mr-1 inline size-4" />}
                Nghe bản đã xử lý
              </button>
              <label className="grid gap-1 text-xs text-muted">
                Tên tệp
                <input className="field" value={p2Name} onChange={(e) => setP2Name(e.target.value)} maxLength={80} />
              </label>
              <button type="button" className="btn-gold" disabled={!p2File || busy || mp3Busy !== null} onClick={() => void store("p2")}>
                <Download className="mr-1 inline size-4" />
                Chọn nơi lưu
                {p2File ? ` · ${formatBytes(p2File.blob.size)} ${p2File.ext.toUpperCase()}` : ""}
              </button>
              <button type="button" className="btn-ghost" disabled={busy || mp3Busy !== null} onClick={() => void storeMp3("p2")}>
                <Download className="mr-1 inline size-4" />
                {mp3Busy === "p2" ? "Đang nén MP3…" : "Tải MP3"}
              </button>
            </div>
          ) : null}
        </section>
      </div>
      {note ? <p className="safe-bottom px-4 pb-3 text-center text-xs text-gold">{note}</p> : <div className="h-2" />}

      {mixOpen ? null : (
        <button
          type="button"
          className={pos ? "mica fixed z-30" : "mica fixed right-4 bottom-24 z-30"}
          style={pos ? { left: pos.x, top: pos.y } : undefined}
          aria-label="Mở trộn lời và nhạc"
          onPointerDown={(e) => {
            const el = e.currentTarget;
            el.setPointerCapture(e.pointerId);
            const startX = e.clientX;
            const startY = e.clientY;
            const origin = posRef.current ?? {
              x: el.getBoundingClientRect().left,
              y: el.getBoundingClientRect().top,
            };
            let moved = false;
            const latest = { ...origin };
            const move = (ev: PointerEvent) => {
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
          }}
        >
          TRỘN
        </button>
      )}

      {micAsk ? (
        <div className="sheet fixed inset-0 z-40 grid place-items-center px-5">
          <div className="panel m-0 w-full max-w-sm">
            <p className="kicker">MICRO</p>
            <h2 className="text-lg font-bold">Cho phép ghi âm</h2>
            <p className="text-sm leading-relaxed text-muted">
              THU VÀNG chỉ thu khi bạn bấm ghi. Không ghi nền, không gửi bản ghi đi đâu. Âm được xử lý ngay trên máy.
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost flex-1" onClick={closeOverlay}>
                Huỷ
              </button>
              <button
                type="button"
                className="btn-gold flex-1"
                onClick={() => {
                  micOk.current = true;
                  closeOverlay();
                  void startRec();
                }}
              >
                Cho phép micro
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mixOpen ? (
        <div className="sheet fixed inset-0 z-40 overflow-auto">
          <div className="safe-top safe-bottom mx-auto grid w-full max-w-lg gap-3 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="kicker">MICA</p>
                <h2 className="text-xl font-extrabold">Trộn lời và nhạc</h2>
              </div>
              <button type="button" className="btn-ghost" onClick={closeOverlay}>
                Đóng
              </button>
            </div>
            <p className="text-sm leading-relaxed text-muted">
              Nhạc nền to dần, nhỏ dần, tự lặp hoặc cắt cho khớp lời. Lời được làm sạch, to, dày, ấm và nổi trên nền.
              Sau đó tăng 10% và nén kỹ thuật.
            </p>
            <FilePick label="File lời" name={voiceName} onFile={(file) => void takeMixFile("voice", file)} />
            <FilePick label="File nhạc nền" name={musicName} onFile={(file) => void takeMixFile("music", file)} />
            {voiceCh && musicCh ? (
              <p className="text-sm text-ink">
                Lời {formatTime(voiceSec)} · Nhạc {formatTime(musicSec)}. {mixPlan || planPreview}
              </p>
            ) : null}
            <div className="steps">
              {MIX_STEPS.map((label, i) => (
                <span key={label} className={i <= (job === "mix" ? mixStep : mixAudio ? MIX_STEPS.length : -1) ? "step step-on" : "step"}>
                  {label}
                </span>
              ))}
            </div>
            {mixErr ? <p className="text-sm text-gold">{mixErr}</p> : null}
            <button type="button" className="btn-gold" disabled={!voiceCh || !musicCh || busy || recording} onClick={() => void runMix()}>
              {job === "mix" ? "Đang trộn…" : "Trộn, nén và nghe"}
            </button>
            {mixAudio ? (
              <div className="grid gap-2">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => void playBuffer("mix", [mixAudio.left, mixAudio.right], mixAudio.rate)}
                >
                  {playing === "mix" ? <Pause className="mr-1 inline size-4" /> : <Play className="mr-1 inline size-4" />}
                  Nghe bản trộn
                </button>
                <label className="grid gap-1 text-xs text-muted">
                  Tên tệp
                  <input className="field" value={mixName} onChange={(e) => setMixName(e.target.value)} maxLength={80} />
                </label>
                <button type="button" className="btn-gold" disabled={!mixFile || busy || mp3Busy !== null} onClick={() => void store("mix")}>
                  <Download className="mr-1 inline size-4" />
                  Tải về
                  {mixFile ? ` · ${formatBytes(mixFile.blob.size)} ${mixFile.ext.toUpperCase()}` : ""}
                </button>
                <button type="button" className="btn-ghost" disabled={busy || mp3Busy !== null} onClick={() => void storeMp3("mix")}>
                  <Download className="mr-1 inline size-4" />
                  {mp3Busy === "mix" ? "Đang nén MP3…" : "Tải MP3"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilePick({ label, name, onFile }: { label: string; name: string; onFile: (file: File | undefined) => void }) {
  return (
    <label className="well grid cursor-pointer gap-1 px-3 py-3">
      <input
        className="sr-only"
        type="file"
        accept="audio/*,video/*"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <span className="text-xs font-bold tracking-wide text-gold">{label}</span>
      <span className="truncate text-sm">{name || "Chọn tệp"}</span>
    </label>
  );
}
