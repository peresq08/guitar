import { data, save, bestFor, toast, esc, $ } from "../store.js";
import { CHORDS, diagram, fretboard, NOTES } from "../chords.js";
import * as A from "../audio.js";

let root, tab = "cambios";
const sub = {};

export function mount(el) {
  root = el;
  el.innerHTML = `
  <div class="seg" role="tablist" aria-label="Herramientas">
    <button role="tab" data-sub="cambios">Cambios</button>
    <button role="tab" data-sub="metro">Metrónomo</button>
    <button role="tab" data-sub="jam">Jam</button>
  </div>
  <div id="p-cambios" class="stack" style="gap:16px"></div>
  <div id="p-metro" class="stack" style="gap:16px" hidden></div>
  <div id="p-jam" class="stack" style="gap:16px" hidden></div>`;
  el.querySelectorAll("[data-sub]").forEach(b => b.onclick = () => setSub(b.dataset.sub));
  mountCambios($("#p-cambios", el)); mountMetro($("#p-metro", el)); mountJam($("#p-jam", el));
  setSub("cambios");
}
function setSub(t) {
  tab = t;
  root.querySelectorAll("[data-sub]").forEach(b => b.setAttribute("aria-selected", b.dataset.sub === t));
  ["cambios", "metro", "jam"].forEach(k => $("#p-" + k, root).hidden = k !== t);
}
export function onShow(opts = {}) {
  if (opts.tab) setSub(opts.tab);
  if (opts.pair && CHORDS[opts.pair[0]] && CHORDS[opts.pair[1]]) setPair(opts.pair[0], opts.pair[1]);
}
export function refresh() { renderCambiosStats(); }

/* =================== CAMBIOS =================== */
const C = { mode: "libre", run: false, tick: null, t0: 0, next: 0, k: 0, auto: 0, bpm: 60, per: 4, lastWarn: 0, micRes: null };
const D = { loop: null, det: null, cal: null };
let cel;
const pairKey = () => $("#cA", cel).value + " ↔ " + $("#cB", cel).value;

function mountCambios(el) {
  cel = el;
  const opts = Object.keys(CHORDS).map(c => `<option>${esc(c)}</option>`).join("");
  el.innerHTML = `
  <div class="panel">
    <div><div class="label">Reto de un minuto</div><h2>¿Cuántos cambios limpios logras en 60 segundos?</h2></div>
    <div class="row" style="flex-wrap:nowrap">
      <select id="cA" aria-label="Primer acorde" style="flex:1">${opts}</select><span class="muted num">↔</span><select id="cB" aria-label="Segundo acorde" style="flex:1">${opts}</select>
    </div>
    <div class="chords" id="cChords" style="justify-content:center"></div>
    <div class="seg" role="radiogroup" aria-label="Modo del reto">
      <button role="radio" data-mode="libre">Cuenta tú</button>
      <button role="radio" data-mode="guia">Con clic</button>
      <button role="radio" data-mode="mic">Escuchar</button>
    </div>
    <p class="note" id="modeNote"></p>
    <div class="grid2" id="guiaCfg" hidden>
      <label for="gBpm">Tempo (BPM)<input type="number" id="gBpm" value="60" min="30" max="200"></label>
      <label for="gPer">Cambia cada<select id="gPer"><option value="4">4 tiempos</option><option value="2">2 tiempos</option><option value="1">1 tiempo</option></select></label>
    </div>
    <div class="stack" id="micCfg" hidden style="padding:12px;border:1px solid var(--line);border-radius:10px;gap:10px">
      <div class="row"><button class="btn small" id="micBtn">Activar micrófono</button><span class="note" id="micStatus">El navegador te pedirá permiso.</span></div>
      <div class="meter"><b id="mA"></b><div class="bar"><div id="barA"></div></div><span id="sA">–</span></div>
      <div class="meter"><b id="mB"></b><div class="bar"><div id="barB"></div></div><span id="sB">–</span></div>
      <div class="meter"><b>Nivel</b><div class="bar"><div id="barL" class="lvl"></div></div><span></span></div>
      <div class="row"><button class="btn small" id="calA"></button><button class="btn small" id="calB"></button></div>
      <p class="note">Calibra cada acorde una vez: rasguéalo 3 segundos con tu guitarra y en tu cuarto. Mejora mucho la detección, sobre todo en pares parecidos como D y Dm.</p>
    </div>
    <div class="stage" id="stage" aria-live="polite"><span class="lab" id="stLab">Listo</span><span class="big" id="stNum">60</span><span class="sub" id="stSub"></span></div>
    <button class="btn primary block" id="cStart">Empezar reto</button>
    <div class="panel hl" id="cResult" hidden>
      <div class="label" id="resLabel"></div>
      <div class="stepper"><button class="icon-btn" id="rMinus" aria-label="Uno menos">−</button><input type="number" id="resN" min="0" max="300" value="0" aria-label="Cambios"><button class="icon-btn" id="rPlus" aria-label="Uno más">+</button></div>
      <div class="row"><button class="btn primary" id="resSave">Guardar</button><button class="btn" id="resDrop">Descartar</button></div>
    </div>
  </div>
  <div class="panel">
    <div class="row between"><div class="label">Tu avance con este par</div><span class="chip acc" id="cBest"></span></div>
    <div class="chart" id="cChart"></div>
  </div>`;
  let p = null; try { p = JSON.parse(localStorage.getItem("riff-par") || "null"); } catch (e) {}
  setPair(p ? p[0] : "Am", p ? p[1] : "E");
  ["cA", "cB"].forEach(id => $("#" + id, el).onchange = () => setPair($("#cA", el).value, $("#cB", el).value));
  el.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => !C.run && setMode(b.dataset.mode));
  $("#micBtn", el).onclick = startMic;
  $("#calA", el).onclick = () => calibrate("A"); $("#calB", el).onclick = () => calibrate("B");
  $("#cStart", el).onclick = startChallenge;
  const rn = $("#resN", el);
  $("#rMinus", el).onclick = () => rn.value = Math.max(0, (+rn.value || 0) - 1);
  $("#rPlus", el).onclick = () => rn.value = (+rn.value || 0) + 1;
  $("#resDrop", el).onclick = () => { $("#cResult", el).hidden = true; idle(); };
  $("#resSave", el).onclick = saveResult;
  setMode("libre");
}
function setPair(a, b) {
  $("#cA", cel).value = a; $("#cB", cel).value = b;
  try { localStorage.setItem("riff-par", JSON.stringify([a, b])); } catch (e) {}
  $("#cChords", cel).innerHTML = diagram(a) + diagram(b);
  $("#mA", cel).textContent = a; $("#mB", cel).textContent = b;
  $("#calA", cel).textContent = (data.calibracion[a] ? "Recalibrar " : "Calibrar ") + a;
  $("#calB", cel).textContent = (data.calibracion[b] ? "Recalibrar " : "Calibrar ") + b;
  renderCambiosStats();
}
function setMode(m) {
  C.mode = m;
  cel.querySelectorAll("[data-mode]").forEach(b => b.setAttribute("aria-checked", b.dataset.mode === m));
  $("#guiaCfg", cel).hidden = m !== "guia"; $("#micCfg", cel).hidden = m !== "mic";
  $("#modeNote", cel).textContent = {
    libre: "Cuenta los cambios en voz alta o mentalmente. Al terminar el minuto escribes el número.",
    guia: "Un clic marca el tiempo y la pantalla te dice qué acorde sigue. Cuando todos salgan limpios, sube el tempo.",
    mic: "La app escucha tu guitarra y cuenta los cambios sola. Funciona mejor con acústica o sonido limpio, cerca del teléfono y sin ruido de fondo.",
  }[m];
  idle();
}
function idle() {
  $("#stage", cel).classList.remove("live"); $("#stLab", cel).textContent = "Listo";
  const n = $("#stNum", cel); n.className = "big"; n.textContent = "60";
  $("#stSub", cel).textContent = "Tendrás 3 segundos para poner las manos en la guitarra";
}
function renderCambiosStats() {
  if (!cel) return;
  const k = pairKey(), list = data.intentos.filter(x => x.par === k).slice(-20);
  $("#cBest", cel).textContent = "Récord " + bestFor(k);
  if (!list.length) { $("#cChart", cel).innerHTML = `<div class="empty">Aún no hay intentos con ${esc(k)}. Haz el primero y aquí verás cómo sube tu número.</div>`; return; }
  const W = 340, H = 150, L = 30, R = 12, T = 14, B = 22, ymax = Math.max(60, ...list.map(x => x.n)), yM = Math.ceil(ymax / 20) * 20;
  const xs = i => list.length === 1 ? L + (W - L - R) / 2 : L + i * (W - L - R) / (list.length - 1), ys = v => T + (H - T - B) * (1 - v / yM);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cambios por intento">`;
  for (let v = 0; v <= yM; v += 20) s += `<line x1="${L}" x2="${W - R}" y1="${ys(v)}" y2="${ys(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${ys(v) + 3}" font-size="9" text-anchor="end" fill="var(--muted)" font-family="JetBrains Mono,monospace">${v}</text>`;
  const pts = list.map((x, i) => xs(i) + "," + ys(x.n)).join(" ");
  s += `<polygon points="${xs(0)},${ys(0)} ${pts} ${xs(list.length - 1)},${ys(0)}" fill="var(--accent)" opacity=".14"/>`;
  s += `<polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>`;
  list.forEach((x, i) => s += `<circle cx="${xs(i)}" cy="${ys(x.n)}" r="${i === list.length - 1 ? 4.5 : 2.8}" fill="var(--accent)"/>`);
  const l = list[list.length - 1];
  s += `<text x="${xs(list.length - 1)}" y="${ys(l.n) - 8}" font-size="10" text-anchor="end" fill="var(--ink)" font-weight="700" font-family="JetBrains Mono,monospace">${l.n}</text>`;
  s += `<text x="${L}" y="${H - 5}" font-size="9" fill="var(--muted)" font-family="Barlow,sans-serif">Últimos ${list.length} intentos</text></svg>`;
  $("#cChart", cel).innerHTML = s;
}

/* Detección por micrófono */
function theoTpl(name) {
  const v = new Array(12).fill(0);
  [...CHORDS[name].f].forEach((c, i) => { if (c === "x") return; const m = A.TUNING[i] + +c; v[m % 12] += 1; v[(m + 7) % 12] += .3; v[(m + 4) % 12] += .1; });
  return A.norm(v);
}
const tpl = n => data.calibracion[n] || theoTpl(n);
async function startMic() {
  const st = $("#micStatus", cel);
  if (A.mic.an) return true;
  st.textContent = "Midiendo el ruido del cuarto, no toques un segundo…";
  const ok = await A.micOn();
  if (!ok) { st.textContent = A.mic.error; return false; }
  $("#micBtn", cel).hidden = true; st.textContent = "Micrófono listo. Toca un acorde para probar.";
  if (!D.loop) D.loop = setInterval(micTick, 50);
  return true;
}
function micTick() {
  if (root.hidden || cel.hidden || C.mode !== "mic") { if (!D.det && !D.cal) return; }
  const fr = A.chroma(), a = $("#cA", cel).value, b = $("#cB", cel).value;
  const sa = fr.on ? A.cosSim(fr.chroma, tpl(a)) : 0, sb = fr.on ? A.cosSim(fr.chroma, tpl(b)) : 0;
  $("#barL", cel).style.width = Math.min(100, fr.rms / A.mic.floor * 25) + "%";
  $("#barA", cel).style.width = sa * 100 + "%"; $("#barB", cel).style.width = sb * 100 + "%";
  $("#sA", cel).textContent = fr.on ? Math.round(sa * 100) : "–"; $("#sB", cel).textContent = fr.on ? Math.round(sb * 100) : "–";
  let lab = null; if (fr.on && Math.max(sa, sb) > .55 && Math.abs(sa - sb) > .04) lab = sa > sb ? "A" : "B";
  $("#barA", cel).classList.toggle("win", lab === "A"); $("#barB", cel).classList.toggle("win", lab === "B");
  if (D.cal && fr.on) D.cal.push(fr.chroma);
  const d = D.det; if (!d) return;
  if (lab === d.cand) d.cc++; else { d.cand = lab; d.cc = 1; }
  if (lab && d.cc === 3 && lab !== d.cur) {
    if (d.pending && d.hold >= d.clean) d.cleanN++;
    if (d.cur) d.changes++;
    d.pending = !!d.cur; d.cur = lab; d.hold = 0;
  }
  if (lab && lab === d.cur) d.hold = Math.max(d.hold, lab === "A" ? sa : sb);
}
async function calibrate(which) {
  if (C.run || !(await startMic())) return;
  const name = $(which === "A" ? "#cA" : "#cB", cel).value, btn = $(which === "A" ? "#calA" : "#calB", cel), st = $("#micStatus", cel);
  btn.disabled = true;
  for (let i = 3; i > 0; i--) { st.textContent = `Prepárate para rasguear ${name}… ${i}`; A.beep(800, .07); await new Promise(r => setTimeout(r, 1000)); }
  A.beep(1200, .12); D.cal = []; st.textContent = `Rasguea ${name} varias veces…`;
  await new Promise(r => setTimeout(r, 3000));
  const fr = D.cal; D.cal = null; btn.disabled = false;
  if (fr.length < 15) { st.textContent = "No escuché suficiente sonido. Acércate al teléfono y rasguea más fuerte."; return; }
  const avg = new Array(12).fill(0); fr.forEach(c => c.forEach((x, i) => avg[i] += x));
  data.calibracion[name] = A.norm(avg); save(); A.chime();
  st.textContent = `${name} calibrado.`; setPair($("#cA", cel).value, $("#cB", cel).value);
}

/* Reto */
function stop() { C.run = false; clearInterval(C.tick); A.keepAwake(false); $("#cStart", cel).textContent = "Empezar reto"; $("#cA", cel).disabled = $("#cB", cel).disabled = false; }
async function startChallenge() {
  const a = A.ctx(); if (!a) return;
  if (C.run) { stop(); D.det = null; idle(); return; }
  if (C.mode === "mic" && !(await startMic())) return;
  $("#cResult", cel).hidden = true;
  C.run = true; C.t0 = a.currentTime + 3; C.bpm = Math.min(200, Math.max(30, +$("#gBpm", cel).value || 60)); C.per = +$("#gPer", cel).value;
  C.next = C.t0; C.k = 0; C.auto = 0; C.lastWarn = 0;
  [0, 1, 2].forEach(i => A.beep(800, .07, a.currentTime + i));
  if (C.mode === "mic") {
    const both = data.calibracion[$("#cA", cel).value] && data.calibracion[$("#cB", cel).value];
    setTimeout(() => { if (C.run) D.det = { cur: null, cand: null, cc: 0, changes: 0, cleanN: 0, hold: 0, pending: false, clean: both ? .85 : .75 }; }, 3000);
  }
  $("#stage", cel).classList.add("live"); $("#cStart", cel).textContent = "Cancelar";
  $("#cA", cel).disabled = $("#cB", cel).disabled = true;
  C.tick = setInterval(tick, 50); A.keepAwake(true); tick();
}
function tick() {
  const now = A.now(), lab = $("#stLab", cel), num = $("#stNum", cel), subt = $("#stSub", cel);
  if (now < C.t0) { lab.textContent = "Prepárate"; num.className = "big"; num.textContent = Math.ceil(C.t0 - now); subt.textContent = pairKey(); return; }
  const el = now - C.t0, left = Math.max(0, 60 - el);
  if (C.mode === "guia") {
    while (C.next < now + .12 && C.next < C.t0 + 60) { A.click(C.k % C.per === 0, C.next); C.next += 60 / C.bpm; C.k++; }
    const idx = Math.floor(Math.floor(el / (60 / C.bpm)) / C.per);
    lab.textContent = `Quedan ${Math.ceil(left)} s`; num.className = "chordnow"; num.textContent = idx % 2 === 0 ? $("#cA", cel).value : $("#cB", cel).value;
    subt.textContent = "Cambio " + idx; C.auto = idx;
  } else if (C.mode === "mic") {
    const d = D.det;
    lab.textContent = `Quedan ${Math.ceil(left)} s`; num.className = "chordnow";
    num.textContent = d && d.cur ? (d.cur === "A" ? $("#cA", cel).value : $("#cB", cel).value) : "…";
    subt.textContent = "Cambios detectados: " + (d ? d.changes : 0);
  } else {
    lab.textContent = "Cambia y cuenta"; num.className = "big"; num.textContent = Math.ceil(left); subt.textContent = pairKey();
    const s = Math.ceil(left); if (s <= 3 && s > 0 && C.lastWarn !== s) { C.lastWarn = s; A.beep(700, .06); }
  }
  if (left <= 0) {
    stop(); A.chime(); $("#stage", cel).classList.remove("live");
    lab.textContent = "¡Tiempo!"; num.className = "big"; num.textContent = "0"; subt.textContent = "";
    const prev = bestFor(pairKey()), rn = $("#resN", cel), rl = $("#resLabel", cel);
    if (C.mode === "mic") {
      const d = D.det || { changes: 0, cleanN: 0, pending: false }; D.det = null;
      if (d.pending && d.hold >= d.clean) d.cleanN++;
      C.micRes = { changes: d.changes, clean: d.cleanN }; rn.value = d.changes;
      rl.textContent = `Detecté ${d.changes} cambios; ${d.cleanN} con el acorde sonando claro. Corrige el número si hace falta.`;
    } else if (C.mode === "guia") { rn.value = C.auto; rl.textContent = `Hubo ${C.auto} cambios a ${C.bpm} BPM. ¿Cuántos salieron limpios?`; }
    else { rn.value = prev || 0; rl.textContent = "¿Cuántos cambios lograste?"; }
    $("#cResult", cel).hidden = false;
  }
}
function saveResult() {
  const n = Math.max(0, Math.round(+$("#resN", cel).value || 0)), k = pairKey(), prev = bestFor(k);
  const rec = { par: k, n, t: new Date().toISOString(), modo: C.mode };
  if (C.mode === "guia") rec.bpm = C.bpm;
  if (C.mode === "mic" && C.micRes) rec.limpios = C.micRes.clean;
  data.intentos.push(rec); save();
  toast(n > prev ? (prev ? `¡Nuevo récord! Antes: ${prev}` : "Primer registro guardado") : `Guardado. Tu récord sigue en ${prev}`);
  $("#cResult", cel).hidden = true; idle(); renderCambiosStats();
}

/* =================== METRÓNOMO =================== */
const M = { bpm: 80, run: false, beat: 0, sub: 0, bars: 0, next: 0, timer: null, meter: 4, subdiv: 1, taps: [] };
let mel;
function mountMetro(el) {
  mel = el;
  el.innerHTML = `
  <div class="panel">
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
    <button class="btn primary block" id="mStart">Iniciar</button>
  </div>
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
  if (M.run) { M.run = false; clearInterval(M.timer); A.keepAwake(false); $("#mStart", mel).textContent = "Iniciar"; mel.querySelectorAll("#mBeats i").forEach(e => e.classList.remove("on")); progInfo(); return; }
  if ($("#mProg", mel).checked) setBpm(pcfg().ini);
  stopJam();
  Object.assign(M, { run: true, beat: 0, sub: 0, bars: 0, next: a.currentTime + .06 });
  M.timer = setInterval(schedule, 25); A.keepAwake(true); $("#mStart", mel).textContent = "Detener"; progInfo();
}
function stopMetro() { if (M.run) toggleMetro(); }

/* =================== JAM =================== */
const STYLES = [
  { id: "rock", name: "Rock en Mi menor", key: 4, bpm: 100, prog: ["Em", "D", "C", "D"], drums: "rock", bassPat: "eighths", scale: "pm" },
  { id: "balada", name: "Balada ochentera", key: 4, bpm: 76, prog: ["G", "D", "Em", "C"], drums: "ballad", bassPat: "half", scale: "pm", note: "Está en Sol mayor; la pentatónica de Mi menor encaja perfecto." },
  { id: "blues", name: "Blues en La", key: 9, bpm: 92, prog: ["A7", "D7", "A7", "A7", "D7", "D7", "A7", "A7", "E7", "D7", "A7", "E7"], drums: "shuffle", bassPat: "boogie", scale: "blues", swing: true },
  { id: "hard", name: "Hard rock en La", key: 9, bpm: 118, prog: ["A5", "C5", "D5", "A5"], drums: "rock", bassPat: "eighths", scale: "pm" },
  { id: "galope", name: "Galope metalero", key: 4, bpm: 150, prog: ["E5", "E5", "C5", "D5"], drums: "gallop", bassPat: "gallop", scale: "pm" },
];
const DRUMS = {
  rock:    { k: "x.......x.x.....", s: "....x.......x...", h: "x.x.x.x.x.x.x.x." },
  ballad:  { k: "x.........x.....", s: "........x.......", h: "x...x...x...x..." },
  shuffle: { k: "x.......x.......", s: "....x.......x...", h: "x.x.x.x.x.x.x.x." },
  gallop:  { k: "x.xxx.xxx.xxx.xx", s: "....x.......x...", h: "x...x...x...x..." },
};
const BASS = { eighths: "x.x.x.x.x.x.x.x.", half: "x.......x.......", boogie: "x.x.x.x.x.x.x.x.", gallop: "x.xxx.xxx.xxx.xx" };
const BOOGIE = [0, 0, 7, 7, 9, 9, 10, 9];
const SCALES = { pm: { name: "Pentatónica menor", iv: [0, 3, 5, 7, 10] }, blues: { name: "Escala de blues", iv: [0, 3, 5, 6, 7, 10] } };
const J = { st: STYLES[0], bpm: 100, run: false, step: 0, bar: 0, next: 0, timer: null, drums: true, bass: true, gtr: true, startedAt: 0, scale: "pm" };
let jel;
function rootPc(ch) { const m = ch.match(/^([A-G])(#|b)?/); let pc = NOTES.indexOf(m[1]); if (m[2] === "#") pc++; if (m[2] === "b") pc--; return (pc + 12) % 12; }
function chordPcs(ch) {
  const c = CHORDS[ch]; if (!c) return new Set([rootPc(ch)]);
  return new Set([...c.f].map((x, i) => x === "x" ? null : (A.TUNING[i] + +x) % 12).filter(x => x !== null));
}
function mountJam(el) {
  jel = el;
  el.innerHTML = `
  <div class="panel">
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
    <button class="btn primary block" id="jStart">Tocar</button>
  </div>
  <div class="panel">
    <div class="row between"><div class="label" id="jScaleName">Pentatónica menor</div><span class="chip acc" id="jKey"></span></div>
    <div class="fret-wrap" id="jFret"></div>
    <p class="note">Naranja: tónica, tu "casa". Verde: notas del acorde que está sonando; caer en ellas al final de una frase suena seguro.</p>
  </div>`;
  $("#jStyle", el).onchange = e => { J.st = STYLES.find(s => s.id === e.target.value); J.bpm = J.st.bpm; renderJam(); };
  el.querySelectorAll("[data-jd]").forEach(b => b.onclick = () => { J.bpm = Math.min(220, Math.max(40, J.bpm + +b.dataset.jd)); $("#jBpm", el).textContent = J.bpm; });
  $("#jDr", el).onchange = e => J.drums = e.target.checked;
  $("#jBa", el).onchange = e => J.bass = e.target.checked;
  $("#jGt", el).onchange = e => J.gtr = e.target.checked;
  $("#jStart", el).onclick = toggleJam;
  J.bpm = J.st.bpm; renderJam();
}
function renderJam(curIdx = -1) {
  const s = J.st;
  $("#jNote", jel).textContent = s.note || "";
  $("#jBpm", jel).textContent = J.bpm;
  $("#jProg", jel).innerHTML = s.prog.map((c, i) => `<span class="${i === curIdx ? "on" : ""}">${esc(c)}</span>`).join("");
  $("#jScaleName", jel).textContent = SCALES[s.scale].name;
  $("#jKey", jel).textContent = "Tono: " + NOTES[s.key] + (s.key === 4 ? " (Mi)" : s.key === 9 ? " (La)" : "");
  const hl = curIdx >= 0 ? chordPcs(s.prog[curIdx]) : null;
  $("#jFret", jel).innerHTML = fretboard({ root: s.key, intervals: SCALES[s.scale].iv, from: 0, to: 12, highlight: hl });
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
  stopMetro();
  Object.assign(J, { run: true, step: 0, bar: 0, next: a.currentTime + .1, startedAt: performance.now() });
  J.timer = setInterval(jamSchedule, 25); A.keepAwake(true); $("#jStart", jel).textContent = "Detener";
}
function stopJam() {
  if (!J.run) return;
  J.run = false; clearInterval(J.timer); A.keepAwake(false); $("#jStart", jel).textContent = "Tocar"; renderJam();
  const min = (performance.now() - J.startedAt) / 60000;
  if (min >= 1) { data.jams = data.jams || []; data.jams.push({ t: new Date().toISOString(), min: Math.round(min * 10) / 10, estilo: J.st.id }); save(); toast(`Jam de ${Math.round(min)} min registrado`); }
}
export function onHide() { /* el audio sigue sonando si cambias de pestaña a propósito */ }
