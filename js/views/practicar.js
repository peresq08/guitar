import { data, save, bestFor, toast, esc, practiceStart, practiceEnd, $ } from "../store.js";
import { CHORDS, diagram, fretboard, NOTES } from "../chords.js";
import * as A from "../audio.js";
import { mountCambios, applyCambiosOpts, refreshCambios } from "./cambios.js";
import { mountSecuencias, showSecuencia } from "./secuencias.js";
import { mountRasgueo, showRasgueo } from "./rasgueo.js";
import { mountTabs, showTab, stopTabs } from "./tabs.js";
import { mountMastil, stopMastil } from "./mastil.js";

let root, tab = "cambios";
const sub = {};

export function mount(el) {
  root = el;
  el.innerHTML = `
  <div class="seg subtabs" role="tablist" aria-label="Herramientas">
    <button role="tab" data-sub="cambios">Cambios</button>
    <button role="tab" data-sub="secuencia">Secuencias</button>
    <button role="tab" data-sub="rasgueo">Rasgueo</button>
    <button role="tab" data-sub="tabs">Tabs</button>
    <button role="tab" data-sub="mastil">Mástil</button>
    <button role="tab" data-sub="metro">Metrónomo</button>
    <button role="tab" data-sub="jam">Jam</button>
  </div>
  <div id="p-cambios" class="stack" style="gap:16px"></div>
  <div id="p-secuencia" class="stack" style="gap:16px" hidden></div>
  <div id="p-rasgueo" class="stack" style="gap:16px" hidden></div>
  <div id="p-tabs" class="stack" style="gap:16px" hidden></div>
  <div id="p-mastil" class="stack" style="gap:16px" hidden></div>
  <div id="p-metro" class="stack" style="gap:16px" hidden></div>
  <div id="p-jam" class="stack" style="gap:16px" hidden></div>`;
  el.querySelectorAll("[data-sub]").forEach(b => b.onclick = () => setSub(b.dataset.sub));
  mountCambios($("#p-cambios", el)); mountSecuencias($("#p-secuencia", el)); mountRasgueo($("#p-rasgueo", el)); mountTabs($("#p-tabs", el)); mountMastil($("#p-mastil", el)); mountMetro($("#p-metro", el)); mountJam($("#p-jam", el));
  setSub("cambios");
}
function setSub(t) {
  if (tab === "tabs" && t !== "tabs") stopTabs();
  if (tab === "mastil" && t !== "mastil") stopMastil();
  tab = t;
  root.querySelectorAll("[data-sub]").forEach(b => b.setAttribute("aria-selected", b.dataset.sub === t));
  ["cambios", "secuencia", "rasgueo", "tabs", "mastil", "metro", "jam"].forEach(k => $("#p-" + k, root).hidden = k !== t);
}
export function onShow(opts = {}) {
  if (opts.tab) setSub(opts.tab);
  applyCambiosOpts(opts);
  if (opts.seq) showSecuencia(opts.seq);
  if (opts.pattern) showRasgueo(opts.pattern);
  if (opts.tabId) showTab(opts.tabId, opts);
}
export function refresh() { refreshCambios(); }
// Qué estás practicando, para nombrar las grabaciones
const SUBNAME = { cambios: "Cambios", secuencia: "Secuencias", rasgueo: "Rasgueo", tabs: "Tabs", mastil: "Mástil", metro: "Metrónomo", jam: "Jam" };
export function recLabel() {
  const p = root && $("#p-" + tab, root); if (!p) return "Práctica";
  const sels = [...p.querySelectorAll(".deck-top select, .screen select")].filter(s => s.offsetParent !== null && s.selectedOptions[0]).slice(0, 2).map(s => s.selectedOptions[0].textContent.trim());
  const what = tab === "cambios" ? sels.join(" ↔ ") : tab === "metro" ? `${$("#mBpm", p)?.textContent || ""} BPM` : sels.join(" · ");
  return SUBNAME[tab] + (what ? " · " + what : "");
}
export const stopOthers = () => { stopMetro(); stopJam(); };
window.addEventListener("riff:stop-audio", () => { stopMetro(); stopJam(); });

/* =================== METRÓNOMO =================== */
const M = { bpm: 80, run: false, beat: 0, sub: 0, bars: 0, next: 0, timer: null, meter: 4, subdiv: 1, taps: [] };
let mel;
function mountMetro(el) {
  mel = el;
  el.innerHTML = `
  <div class="cols">
  <div class="col">
  <div class="panel screen">
    <div class="row between" style="align-items:flex-end">
      <div><div class="label" id="mMeterLbl">Tempo · 4/4</div><div class="big"><span id="mBpm">80</span><span style="font-size:1.1rem;color:var(--muted)"> BPM</span></div></div>
      <button class="btn small" id="mTap">Tap</button>
    </div>
    <div class="beats" id="mBeats"></div>
    <input type="range" id="mRange" min="30" max="250" value="80" aria-label="Tempo" style="width:100%;accent-color:var(--accent)">
    <div class="row" style="justify-content:center">
      <button class="btn" data-d="-5">−5</button><button class="btn" data-d="-1">−1</button><button class="btn" data-d="1">+1</button><button class="btn" data-d="5">+5</button>
    </div>
    <div class="grid2">
      <label for="mMeter">Compás<select id="mMeter"><option value="4">4/4</option><option value="3">3/4</option><option value="2">2/4</option><option value="6">6/8</option></select></label>
      <label for="mSub">Subdivisión<select id="mSub"><option value="1">Negras</option><option value="2">Corcheas</option><option value="3">Tresillos</option><option value="4">Semicorcheas</option></select></label>
    </div>
    <button class="btn primary block" id="mStart" data-primary>Iniciar</button>
  </div>
  </div>
  <div class="col">
  <div class="panel">
    <label class="switch"><input type="checkbox" id="mProg"> Modo progresivo: sube el tempo solo</label>
    <div class="grid2" id="mProgCfg">
      <label for="pIni">Empieza en (BPM)<input type="number" id="pIni" value="70" min="30" max="250"></label>
      <label for="pMeta">Meta (BPM)<input type="number" id="pMeta" value="110" min="30" max="250"></label>
      <label for="pPaso">Sube de a (BPM)<input type="number" id="pPaso" value="4" min="1" max="20"></label>
      <label for="pComp">Cada (compases)<input type="number" id="pComp" value="8" min="1" max="64"></label>
    </div>
    <p class="note" id="mProgInfo"></p>
    <p class="note">Si fallas en un tempo, bájale 5 BPM y vuelve a subir. Tocar limpio importa más que tocar rápido.</p>
  </div>
  </div>
  </div>`;
  el.querySelectorAll("[data-d]").forEach(b => b.onclick = () => setBpm(M.bpm + +b.dataset.d));
  $("#mRange", el).oninput = e => setBpm(+e.target.value);
  $("#mMeter", el).onchange = e => { M.meter = +e.target.value; beatsUI(); };
  $("#mSub", el).onchange = e => M.subdiv = +e.target.value;
  $("#mTap", el).onclick = tapTempo;
  $("#mStart", el).onclick = toggleMetro;
  ["mProg", "pIni", "pMeta", "pPaso", "pComp"].forEach(id => $("#" + id, el).addEventListener("input", progInfo));
  beatsUI(); progInfo();
}
function setBpm(v) { M.bpm = Math.min(250, Math.max(30, Math.round(v))); $("#mBpm", mel).textContent = M.bpm; $("#mRange", mel).value = M.bpm; }
function beatsUI() {
  $("#mMeterLbl", mel).textContent = "Tempo · " + (M.meter === 6 ? "6/8" : M.meter + "/4");
  $("#mBeats", mel).innerHTML = Array.from({ length: M.meter }, (_, i) => `<i class="${i === 0 ? "acc" : ""}"></i>`).join("");
}
function tapTempo() {
  A.ctx(); const t = performance.now(); M.taps = M.taps.filter(x => t - x < 2500); M.taps.push(t);
  if (M.taps.length >= 3) { const d = (M.taps[M.taps.length - 1] - M.taps[0]) / (M.taps.length - 1); setBpm(60000 / d); }
  A.beep(1200, .03);
}
const pcfg = () => ({ ini: +$("#pIni", mel).value || 70, meta: +$("#pMeta", mel).value || 110, paso: +$("#pPaso", mel).value || 4, comp: +$("#pComp", mel).value || 8 });
function progInfo() {
  const on = $("#mProg", mel).checked; $("#mProgCfg", mel).style.opacity = on ? 1 : .5;
  const c = pcfg(), info = $("#mProgInfo", mel);
  if (!on) { info.textContent = ""; return; }
  info.textContent = M.run ? (M.bpm >= c.meta ? "Meta alcanzada. ¡Sostenla!" : `Sube a ${Math.min(c.meta, M.bpm + c.paso)} BPM en ${c.comp - (M.bars % c.comp)} compases`) : `De ${c.ini} a ${c.meta} BPM, +${c.paso} cada ${c.comp} compases`;
}
function schedule() {
  const a = A.ctx();
  while (M.next < a.currentTime + .12) {
    const first = M.sub === 0, acc = M.beat === 0 && first;
    if (first) A.click(acc, M.next); else A.beep(800, .025, M.next, .15);
    if (first) { const b = M.beat, delay = Math.max(0, (M.next - a.currentTime) * 1000);
      setTimeout(() => mel.querySelectorAll("#mBeats i").forEach((el, k) => el.classList.toggle("on", k === b)), delay); }
    const beatLen = M.meter === 6 ? 60 / M.bpm / 2 : 60 / M.bpm, subs = M.meter === 6 ? 1 : M.subdiv;
    M.next += beatLen / subs; M.sub = (M.sub + 1) % subs;
    if (M.sub === 0) {
      M.beat = (M.beat + 1) % M.meter;
      if (M.beat === 0) { M.bars++; if ($("#mProg", mel).checked) { const c = pcfg(); if (M.bars % c.comp === 0 && M.bpm < c.meta) setBpm(Math.min(c.meta, M.bpm + c.paso)); } progInfo(); }
    }
  }
}
function toggleMetro() {
  const a = A.ctx(); if (!a) return;
  if (M.run) { practiceEnd("metro", "metronomo"); M.run = false; clearInterval(M.timer); A.keepAwake(false); $("#mStart", mel).textContent = "Iniciar"; mel.querySelectorAll("#mBeats i").forEach(e => e.classList.remove("on")); progInfo(); return; }
  if ($("#mProg", mel).checked) setBpm(pcfg().ini);
  stopJam(); window.dispatchEvent(new Event("riff:stop-seq")); window.dispatchEvent(new Event("riff:stop-rasgueo")); window.dispatchEvent(new Event("riff:stop-cambios"));
  Object.assign(M, { run: true, beat: 0, sub: 0, bars: 0, next: a.currentTime + .06 });
  M.timer = setInterval(schedule, 25); A.keepAwake(true); practiceStart("metro"); $("#mStart", mel).textContent = "Detener"; progInfo();
}
function stopMetro() { if (M.run) toggleMetro(); }

/* =================== JAM =================== */
const STYLES = [
  { id: "rock", name: "Rock en Mi menor", key: 4, bpm: 100, prog: ["Em", "D", "C", "D"], drums: "rock", bassPat: "eighths", scale: "pm" },
  { id: "balada", name: "Balada ochentera", key: 4, bpm: 76, prog: ["G", "D", "Em", "C"], drums: "ballad", bassPat: "half", scale: "pm", note: "Está en Sol mayor; la pentatónica de Mi menor encaja perfecto." },
  { id: "blues", name: "Blues en La", key: 9, bpm: 92, prog: ["A7", "D7", "A7", "A7", "D7", "D7", "A7", "A7", "E7", "D7", "A7", "E7"], drums: "shuffle", bassPat: "boogie", scale: "blues", swing: true },
  { id: "hard", name: "Hard rock en La", key: 9, bpm: 118, prog: ["A5", "C5", "D5", "A5"], drums: "rock", bassPat: "eighths", scale: "pm" },
  { id: "galope", name: "Galope metalero", key: 4, bpm: 150, prog: ["E5", "E5", "C5", "D5"], drums: "gallop", bassPat: "gallop", scale: "pm" },
  { id: "pop80", name: "Pop ochentero en Re", key: 2, bpm: 120, prog: ["D", "A", "Bm", "G"], drums: "rock", bassPat: "eighths", scale: "pM", note: "Pentatónica mayor de Re: suena luminosa, como los solos limpios con chorus de los 80." },
  { id: "country", name: "Country en Sol", key: 7, bpm: 110, prog: ["G", "G", "C", "D"], drums: "rock", bassPat: "half", scale: "pM", note: "Pentatónica mayor de Sol, la base de los solos de country." },
  { id: "esp", name: "Rock en español en La menor", key: 9, bpm: 112, prog: ["Am", "F", "C", "G"], drums: "rock", bassPat: "eighths", scale: "pm" },
  { id: "balmenor", name: "Balada en La menor", key: 9, bpm: 72, prog: ["Am", "G", "F (mini)", "E"], drums: "ballad", bassPat: "half", scale: "menor", note: "Escala menor natural de La; sobre el E, el Sol# del acorde le da tensión." },
];
const DRUMS = {
  rock:    { k: "x.......x.x.....", s: "....x.......x...", h: "x.x.x.x.x.x.x.x." },
  ballad:  { k: "x.........x.....", s: "........x.......", h: "x...x...x...x..." },
  shuffle: { k: "x.......x.......", s: "....x.......x...", h: "x.x.x.x.x.x.x.x." },
  gallop:  { k: "x.xxx.xxx.xxx.xx", s: "....x.......x...", h: "x...x...x...x..." },
};
const BASS = { eighths: "x.x.x.x.x.x.x.x.", half: "x.......x.......", boogie: "x.x.x.x.x.x.x.x.", gallop: "x.xxx.xxx.xxx.xx" };
const BOOGIE = [0, 0, 7, 7, 9, 9, 10, 9];
const SCALES = {
  pm: { name: "Pentatónica menor", iv: [0, 3, 5, 7, 10], minor: true }, blues: { name: "Escala de blues", iv: [0, 3, 5, 6, 7, 10], minor: true },
  pM: { name: "Pentatónica mayor", iv: [0, 2, 4, 7, 9], minor: false }, menor: { name: "Menor natural", iv: [0, 2, 3, 5, 7, 8, 10], minor: true },
};
// Cajas de la pentatónica: trastes relativos a la tónica menor en la 6ª cuerda
const BOXES = [[0, 3], [2, 5], [4, 8], [7, 10], [9, 13]];
function boxRange(s, n) {
  if (!n) return { from: 0, to: 12 };
  const minorRoot = SCALES[s.scale].minor ? s.key : (s.key + 9) % 12, rf = (minorRoot - 4 + 12) % 12;
  let [a, b] = BOXES[n - 1]; a += rf; b += rf;
  if (a > 10) { a -= 12; b -= 12; }
  if (a < 0) { a += 12; b += 12; }
  return { from: Math.max(0, a - (a > 0 ? 1 : 0)), to: Math.max(b, a + 4) };
}
const J = { st: STYLES[0], bpm: 100, run: false, step: 0, bar: 0, next: 0, timer: null, drums: true, bass: true, gtr: true, startedAt: 0, scale: "pm", box: 0, idx: -1, listen: false, heard: null, stats: { tone: 0, scale: 0, out: 0 } };
let jel;
function rootPc(ch) { const m = ch.match(/^([A-G])(#|b)?/); let pc = NOTES.indexOf(m[1]); if (m[2] === "#") pc++; if (m[2] === "b") pc--; return (pc + 12) % 12; }
function chordPcs(ch) {
  const c = CHORDS[ch]; if (!c) return new Set([rootPc(ch)]);
  return new Set([...c.f].map((x, i) => x === "x" ? null : (A.TUNING[i] + +x) % 12).filter(x => x !== null));
}
function mountJam(el) {
  jel = el;
  el.innerHTML = `
  <div class="cols" style="--cols:minmax(0,1fr) minmax(0,1.4fr)">
  <div class="col">
  <div class="panel screen">
    <div><div class="label">Pista de acompañamiento</div><h2>Improvisa sobre una banda virtual</h2></div>
    <select id="jStyle" aria-label="Estilo">${STYLES.map(s => `<option value="${s.id}">${s.name}</option>`).join("")}</select>
    <p class="note" id="jNote"></p>
    <div class="prog-chords" id="jProg"></div>
    <div class="row between" style="align-items:flex-end">
      <div><div class="label">Tempo</div><div class="big" style="font-size:2.6rem"><span id="jBpm">100</span><span style="font-size:1rem;color:var(--muted)"> BPM</span></div></div>
      <div class="row"><button class="btn" data-jd="-5">−5</button><button class="btn" data-jd="5">+5</button></div>
    </div>
    <div class="row">
      <label class="switch"><input type="checkbox" id="jDr" checked> Batería</label>
      <label class="switch"><input type="checkbox" id="jBa" checked> Bajo</label>
      <label class="switch"><input type="checkbox" id="jGt" checked> Guitarra rítmica</label>
    </div>
    <button class="btn primary block" id="jStart" data-primary>Tocar</button>
  </div>
  </div>
  <div class="col">
  <div class="panel">
    <div class="row between"><div class="label" id="jScaleName">Pentatónica menor</div><span class="chip acc" id="jKey"></span></div>
    <div class="row" style="gap:8px;flex-wrap:wrap">
      <select id="jBox" aria-label="Zona del mástil"><option value="0">Todo el mástil</option>${[1, 2, 3, 4, 5].map(n => `<option value="${n}">Caja ${n}</option>`).join("")}</select>
      <label class="chip-toggle" title="Usa audífonos: así el micrófono solo te escucha a ti"><input type="checkbox" id="jListen"> Escuchar lo que toco</label>
      <span class="jnext" id="jNext"></span>
    </div>
    <div class="fret-wrap" id="jFret"></div>
    <p class="note">Naranja: tónica, tu "casa". Verde: notas del acorde que está sonando; caer en ellas al final de una frase suena seguro.</p>
    <div class="jheard" id="jHeard" hidden></div>
  </div>
  </div>
  </div>`;
  $("#jStyle", el).onchange = e => { J.st = STYLES.find(s => s.id === e.target.value); J.bpm = J.st.bpm; renderJam(); };
  el.querySelectorAll("[data-jd]").forEach(b => b.onclick = () => { J.bpm = Math.min(220, Math.max(40, J.bpm + +b.dataset.jd)); $("#jBpm", el).textContent = J.bpm; });
  $("#jDr", el).onchange = e => J.drums = e.target.checked;
  $("#jBa", el).onchange = e => J.bass = e.target.checked;
  $("#jGt", el).onchange = e => J.gtr = e.target.checked;
  $("#jStart", el).onclick = toggleJam;
  $("#jBox", el).onchange = e => { J.box = +e.target.value; renderJam(J.run ? J.idx : -1); };
  $("#jListen", el).onchange = async e => { J.listen = e.target.checked; data.ajustes.jamListen = J.listen; save(); if (J.run) J.listen ? await startJamListen() : stopJamListen(); paintHeard(); };
  J.listen = !!data.ajustes.jamListen; $("#jListen", el).checked = J.listen;
  J.bpm = J.st.bpm; renderJam();
}
function renderJam(curIdx = -1) {
  const s = J.st;
  $("#jNote", jel).textContent = s.note || "";
  $("#jBpm", jel).textContent = J.bpm;
  $("#jProg", jel).innerHTML = s.prog.map((c, i) => `<span class="${i === curIdx ? "on" : ""}">${esc(c)}</span>`).join("");
  $("#jScaleName", jel).textContent = SCALES[s.scale].name;
  $("#jKey", jel).textContent = "Tono: " + NOTES[s.key] + (s.key === 4 ? " (Mi)" : s.key === 9 ? " (La)" : "");
  J.idx = curIdx;
  const hl = curIdx >= 0 ? chordPcs(s.prog[curIdx]) : null, rg = boxRange(s, J.box);
  $("#jFret", jel).innerHTML = fretboard({ root: s.key, intervals: SCALES[s.scale].iv, from: rg.from, to: rg.to, highlight: hl, played: J.heard?.midi ?? null, playedCls: J.heard?.cls || "" });
  const nx = curIdx >= 0 ? s.prog[(curIdx + 1) % s.prog.length] : null;
  $("#jNext", jel).textContent = curIdx >= 0 ? `Suena ${s.prog[curIdx]} · sigue ${nx}` : "";
}
function jamSchedule() {
  const a = A.ctx(), s = J.st, dr = DRUMS[s.drums], bp = BASS[s.bassPat];
  while (J.next < a.currentTime + .12) {
    const st = J.step, chord = s.prog[J.bar % s.prog.length], r = rootPc(chord);
    let t = J.next;
    if (s.swing && st % 4 === 2) t += (60 / J.bpm) / 6;
    if (J.drums) {
      if (dr.k[st] === "x") A.kick(t);
      if (dr.s[st] === "x") A.snare(t);
      if (dr.h[st] === "x") A.hat(t, st % 4 === 0 ? 1 : .7);
    }
    if (J.bass && bp[st] === "x") {
      const base = 28 + ((r - 4 + 12) % 12), off = s.bassPat === "boogie" ? BOOGIE[(st / 2) % 8] : 0;
      const len = s.bassPat === "half" ? 60 / J.bpm * 1.9 : s.bassPat === "gallop" ? 60 / J.bpm / 4.4 : 60 / J.bpm / 2.2;
      A.bass(base + off, t, len);
    }
    if (J.gtr && CHORDS[chord] && (st === 0 || (s.drums !== "gallop" && st === 8))) A.strum(CHORDS[chord].f, t, { vol: .14, dur: s.drums === "ballad" ? 2.4 : 1.2 });
    if (st === 0) { const idx = J.bar % s.prog.length, delay = Math.max(0, (t - a.currentTime) * 1000); setTimeout(() => J.run && renderJam(idx), delay); }
    J.next += 60 / J.bpm / 4; J.step = (J.step + 1) % 16; if (J.step === 0) J.bar++;
  }
}
function toggleJam() {
  const a = A.ctx(); if (!a) return;
  if (J.run) { stopJam(); return; }
  stopMetro(); window.dispatchEvent(new Event("riff:stop-seq")); window.dispatchEvent(new Event("riff:stop-rasgueo")); window.dispatchEvent(new Event("riff:stop-cambios"));
  Object.assign(J, { run: true, step: 0, bar: 0, next: a.currentTime + .1, startedAt: performance.now() });
  J.timer = setInterval(jamSchedule, 25); A.keepAwake(true); practiceStart("jam"); $("#jStart", jel).textContent = "Detener";
  J.stats = { tone: 0, scale: 0, out: 0 }; J.heard = null;
  if (J.listen) startJamListen();
  paintHeard();
}
// Escucha tus notas mientras improvisas: verde si es nota del acorde, azul si está en la escala, rojo si queda fuera
let jl = null;
async function startJamListen() {
  if (!(await A.micOn())) { toast(A.mic.error || "Sin micrófono"); J.listen = false; $("#jListen", jel).checked = false; return; }
  stopJamListen();
  jl = { pend: 0 };
  A.startOnsets(() => { jl && (jl.pend = performance.now()); });
  jl.iv = setInterval(() => {
    if (!jl.pend || performance.now() - jl.pend < 90) return;
    jl.pend = 0;
    const p = A.pitch({ minF: 70, maxF: 1400 }); if (!p.f || p.clarity < .8) return;
    const midi = Math.round(69 + 12 * Math.log2(p.f / 440)), pc = midi % 12, s = J.st;
    const chord = J.idx >= 0 ? chordPcs(s.prog[J.idx]) : new Set(), inScale = SCALES[s.scale].iv.some(i => (s.key + i) % 12 === pc);
    const cls = chord.has(pc) ? "tone" : inScale ? "scale" : "out";
    J.stats[cls]++; J.heard = { midi, cls, at: performance.now() };
    renderJam(J.idx); paintHeard();
  }, 30);
}
function stopJamListen() { if (jl) { clearInterval(jl.iv); A.stopOnsets(); jl = null; } }
function paintHeard() {
  const box = $("#jHeard", jel); if (!box) return;
  box.hidden = !J.listen;
  const st = J.stats, n = st.tone + st.scale + st.out;
  const h = J.heard, lab = h ? { tone: "nota del acorde", scale: "en la escala", out: "fuera de la escala" }[h.cls] : "";
  box.innerHTML = `<div class="row between" style="gap:10px;flex-wrap:wrap"><span>${h ? `Tocaste <b class="jh-${h.cls}">${NOTES[h.midi % 12]}</b> · ${lab}` : "Toca algo: cada nota se marca en el diapasón."}</span>
    ${n ? `<span class="note">${n} notas · ${Math.round((st.tone + st.scale) / n * 100)}% en la escala · ${Math.round(st.tone / n * 100)}% del acorde</span>` : ""}</div>
    <p class="note">Usa audífonos para que el micrófono no escuche la pista.</p>`;
}
function stopJam() {
  if (!J.run) return;
  J.run = false; practiceEnd("jam"); clearInterval(J.timer); A.keepAwake(false); $("#jStart", jel).textContent = "Tocar"; stopJamListen(); J.heard = null; renderJam();
  const st = J.stats, n = st.tone + st.scale + st.out;
  if (J.listen && n >= 10) toast(`${n} notas: ${Math.round((st.tone + st.scale) / n * 100)}% en la escala y ${Math.round(st.tone / n * 100)}% en notas del acorde`);
  const min = (performance.now() - J.startedAt) / 60000;
  if (min >= 1) { data.jams = data.jams || []; data.jams.push({ t: new Date().toISOString(), min: Math.round(min * 10) / 10, estilo: J.st.id, ...(J.listen && n >= 20 ? { pct: Math.round((st.tone + st.scale) / n * 100) } : {}) }); save(); toast(`Jam de ${Math.round(min)} min registrado`); }
}
export function onHide() { stopTabs(); stopMastil(); /* el resto del audio sigue sonando si cambias de pestaña a propósito */ }
