// Motor de audio: clic, guitarra sintetizada (Karplus-Strong), batería, bajo y micrófono.
let ac = null, master = null, noiseBuf = null;

export function ctx() {
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" });
      master = ac.createDynamicsCompressor(); master.threshold.value = -10; master.ratio.value = 4;
      master.connect(ac.destination);
    } catch (e) { return null; }
  }
  if (ac.state === "suspended") ac.resume();
  return ac;
}
export const now = () => (ac ? ac.currentTime : 0);

export function beep(freq = 880, dur = .06, when = 0, vol = .35, type = "square") {
  const a = ctx(); if (!a) return; const t = when || a.currentTime;
  const o = a.createOscillator(), g = a.createGain(); o.frequency.value = freq; o.type = type;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + .02);
}
export function click(accent, when, vol = 1) {
  beep(accent ? 1500 : 1000, .035, when, (accent ? .5 : .3) * vol);
}
export function chime() { const t = now(); beep(660, .16, t + .01, .3, "triangle"); beep(990, .3, t + .18, .3, "triangle"); }

/* ---- Guitarra sintetizada ---- */
const ksCache = new Map();
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function ksBuffer(midi) {
  if (ksCache.has(midi)) return ksCache.get(midi);
  const a = ctx(), sr = a.sampleRate, len = Math.floor(sr * 2.6), buf = a.createBuffer(1, len, sr), y = buf.getChannelData(0);
  const N = Math.max(2, Math.round(sr / mtof(midi)));
  let prev = 0;
  for (let i = 0; i < N; i++) { const w = Math.random() * 2 - 1; prev = prev * .55 + w * .45; y[i] = prev; }
  const decay = midi < 50 ? .9975 : midi < 60 ? .9965 : .995;
  for (let i = N; i < len; i++) y[i] = decay * .5 * (y[i - N] + y[i - N - 1 < 0 ? 0 : i - N - 1]);
  let peak = 0; for (let i = 0; i < N * 4; i++) peak = Math.max(peak, Math.abs(y[i]));
  if (peak > 0) for (let i = 0; i < len; i++) y[i] /= peak;
  ksCache.set(midi, buf); return buf;
}
export function pluck(midi, when, vol = .35, dur = 2.4) {
  const a = ctx(); if (!a) return; const t = when || a.currentTime;
  const s = a.createBufferSource(); s.buffer = ksBuffer(midi);
  const g = a.createGain(); g.gain.setValueAtTime(vol, t); g.gain.setTargetAtTime(0, t + dur * .8, .08);
  const f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 3800;
  s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur + .4);
}
export const TUNING = [40, 45, 50, 55, 59, 64];
export function strum(frets, when, { down = true, gap = .028, vol = .3, dur = 2.4 } = {}) {
  const a = ctx(); if (!a) return; const t = when || a.currentTime;
  const notes = [...frets].map((c, i) => c === "x" ? null : TUNING[i] + parseInt(c, 10)).filter(n => n !== null);
  (down ? notes : notes.slice().reverse()).forEach((m, k) => pluck(m, t + k * gap, vol, dur));
}

/* ---- Batería y bajo ---- */
function noise() {
  if (noiseBuf) return noiseBuf;
  const a = ctx(), len = a.sampleRate; noiseBuf = a.createBuffer(1, len, a.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; return noiseBuf;
}
export function kick(t, vol = 1) {
  const a = ctx(), o = a.createOscillator(), g = a.createGain();
  o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + .12);
  g.gain.setValueAtTime(.9 * vol, t); g.gain.exponentialRampToValueAtTime(.001, t + .38);
  o.connect(g).connect(master); o.start(t); o.stop(t + .4);
}
export function snare(t, vol = 1) {
  const a = ctx(), s = a.createBufferSource(); s.buffer = noise();
  const f = a.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 1400;
  const g = a.createGain(); g.gain.setValueAtTime(.45 * vol, t); g.gain.exponentialRampToValueAtTime(.001, t + .2);
  s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + .22);
  const o = a.createOscillator(), og = a.createGain(); o.frequency.value = 190;
  og.gain.setValueAtTime(.3 * vol, t); og.gain.exponentialRampToValueAtTime(.001, t + .09);
  o.connect(og).connect(master); o.start(t); o.stop(t + .1);
}
export function hat(t, vol = 1, open = false) {
  const a = ctx(), s = a.createBufferSource(); s.buffer = noise();
  const f = a.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7500;
  const g = a.createGain(), d = open ? .22 : .045; g.gain.setValueAtTime(.16 * vol, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
  s.connect(f).connect(g).connect(master); s.start(t, Math.random() * .5); s.stop(t + d + .02);
}
export function bass(midi, t, dur, vol = 1) {
  const a = ctx(), o = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain();
  o.type = "sawtooth"; o.frequency.value = mtof(midi);
  f.type = "lowpass"; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(260, t + dur); f.Q.value = 2;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.32 * vol, t + .008); g.gain.setTargetAtTime(0, t + dur * .85, .03);
  o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + dur + .2);
}

/* ---- Pantalla encendida mientras practicas ---- */
let wake = null, wakeUsers = 0;
export async function keepAwake(on) {
  wakeUsers = Math.max(0, wakeUsers + (on ? 1 : -1));
  try {
    if (wakeUsers > 0 && !wake && navigator.wakeLock) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => wake = null); }
    else if (wakeUsers === 0 && wake) { await wake.release(); wake = null; }
  } catch (e) {}
}

/* ---- Micrófono ---- */
export const mic = { an: null, tb: null, fb: null, floor: .006, error: "" };
export async function micOn() {
  if (mic.an) return true;
  const a = ctx();
  if (!a || !navigator.mediaDevices?.getUserMedia) { mic.error = "Este navegador no permite usar el micrófono."; return false; }
  try {
    const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const src = a.createMediaStreamSource(st); const an = a.createAnalyser(); an.fftSize = 8192; an.smoothingTimeConstant = .35;
    src.connect(an); mic.an = an; mic.tb = new Float32Array(an.fftSize); mic.fb = new Float32Array(an.frequencyBinCount);
  } catch (e) { mic.error = "Sin permiso para el micrófono. Actívalo en la configuración del navegador para esta página."; return false; }
  // Ruido de fondo
  const rs = []; await new Promise(r => { const t = setInterval(() => { rs.push(level()); if (rs.length >= 16) { clearInterval(t); r(); } }, 50); });
  rs.sort((x, y) => x - y); mic.floor = Math.max(.004, rs[Math.floor(rs.length * .8)] * 3);
  return true;
}
export function level() {
  mic.an.getFloatTimeDomainData(mic.tb); let r = 0; const b = mic.tb;
  for (let i = 0; i < b.length; i++) r += b[i] * b[i]; return Math.sqrt(r / b.length);
}
export const norm = v => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; return Array.from(v, x => x / s); };
export const cosSim = (a, b) => { let s = 0; for (let i = 0; i < 12; i++) s += a[i] * b[i]; return s; };
export function chroma() {
  const rms = level(); mic.an.getFloatFrequencyData(mic.fb);
  const sr = ac.sampleRate, n = mic.an.fftSize, ch = new Array(12).fill(0);
  for (let k = Math.floor(75 * n / sr); k < Math.ceil(1300 * n / sr); k++) {
    const db = mic.fb[k]; if (!isFinite(db)) continue;
    const p = Math.pow(10, db / 10), m = 69 + 12 * Math.log2((k * sr / n) / 440), rm = Math.round(m), d = Math.abs(m - rm);
    if (d < .4) ch[((rm % 12) + 12) % 12] += p * (1 - d * 2);
  }
  return { rms, chroma: norm(ch), on: rms > mic.floor };
}
// Detección de tono (NSDF / McLeod) para el afinador
export function pitch() {
  const rms = level(); if (rms < mic.floor) return { rms, f: 0, clarity: 0 };
  const sr = ac.sampleRate, b = mic.tb, N = Math.min(b.length, 3072), off = b.length - N;
  const minLag = Math.floor(sr / 1000), maxLag = Math.min(Math.floor(sr / 65), N - 1);
  const nsdf = new Float32Array(maxLag + 2);
  for (let lag = minLag; lag <= maxLag + 1; lag++) {
    let acf = 0, m = 0;
    for (let i = off; i < off + N - lag; i++) { const x = b[i], y = b[i + lag]; acf += x * y; m += x * x + y * y; }
    nsdf[lag] = m ? 2 * acf / m : 0;
  }
  let peaks = [], pos = false, best = -1, bl = 0;
  for (let lag = minLag + 1; lag <= maxLag; lag++) {
    if (nsdf[lag] > 0 && nsdf[lag - 1] <= 0) { pos = true; best = -1; }
    if (pos) {
      if (nsdf[lag] > best) { best = nsdf[lag]; bl = lag; }
      if (nsdf[lag] <= 0 && nsdf[lag - 1] > 0) { peaks.push([bl, best]); pos = false; }
    }
  }
  if (pos && best > 0) peaks.push([bl, best]);
  if (!peaks.length) return { rms, f: 0, clarity: 0 };
  const top = Math.max(...peaks.map(p => p[1]));
  const [L, c] = peaks.find(p => p[1] >= top * .9);
  const y0 = nsdf[L - 1], y1 = nsdf[L], y2 = nsdf[L + 1], den = y0 - 2 * y1 + y2;
  const shift = den ? .5 * (y0 - y2) / den : 0;
  return { rms, f: sr / (L + shift), clarity: c };
}
