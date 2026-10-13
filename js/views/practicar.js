import { data, save, bestFor, toast, esc, $ } from "../store.js";
import { CHORDS, diagram, fretboard, NOTES } from "../chords.js";
import * as A from "../audio.js";

let root, tab = "cambios";
const sub = {};

export function mount(el) {
  root = el;
  el.innerHTML = `
  <div class="seg subtabs" role="tablist" aria-label="Herramientas">
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
  if (opts.mode && !C.run) setMode(opts.mode);
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
  <div class="cols" style="--cols:minmax(0,1.35fr) minmax(0,1fr)">
  <div class="col">
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
    <div class="stack" id="guiaCfg" hidden style="gap:12px">
      <label class="switch"><input type="checkbox" id="gAuto" checked> Tempo automático: sube conforme mejoras</label>
      <div class="grid2" id="gManual" hidden>
        <label for="gBpm">Tempo (BPM)<input type="number" id="gBpm" value="60" min="30" max="200"></label>
        <label for="gPer">Cambia cada<select id="gPer"><option value="4">4 tiempos</option><option value="2">2 tiempos</option><option value="1">1 tiempo</option></select></label>
      </div>
      <label class="switch"><input type="checkbox" id="gMic"> Calificar con el micrófono</label>
    </div>
    <div class="stack" id="micCfg" hidden style="padding:12px;border:1px solid var(--line);border-radius:10px;gap:10px">
      <div class="row"><button class="btn small" id="micBtn">Activar micrófono</button><span class="note" id="micStatus">El navegador te pedirá permiso.</span></div>
      <div class="meter"><b id="mA"></b><div class="bar"><div id="barA"></div></div><span id="sA">–</span></div>
      <div class="meter"><b id="mB"></b><div class="bar"><div id="barB"></div></div><span id="sB">–</span></div>
      <div class="meter"><b>Volumen</b><div class="bar lvlbar"><div id="barL" class="lvl"></div><i id="gateMark" title="Umbral"></i></div><span id="sL"></span></div>
      <p class="note" id="lvlHint">Cuando tocas, la barra de volumen debe pasar la línea.</p>
      <div class="row">
        <label class="field" for="micSens" style="flex:1">Sensibilidad<select id="micSens"><option value="alta">Alta (cuarto silencioso)</option><option value="media">Media</option><option value="baja">Baja (cuarto con ruido)</option></select></label>
        <button class="btn small" id="micNoise" style="align-self:flex-end">Medir ruido</button>
      </div>
      <div class="row"><button class="btn small" id="calA"></button><button class="btn small" id="calB"></button></div>
      <p class="note">Calibra cada acorde una vez: rasguéalo 3 segundos con tu guitarra y en tu cuarto. Mejora mucho la detección, sobre todo en pares parecidos como D y Dm.</p>
    </div>
    <div class="stage" id="stage" aria-live="polite"><span class="lab" id="stLab">Listo</span><span class="big" id="stNum">60</span><span class="sub" id="stSub"></span></div>
    <button class="btn primary block" id="cStart" data-primary>Empezar reto</button>
    <div class="panel hl" id="cResult" hidden>
      <div class="label" id="resLabel"></div>
      <div class="stepper"><button class="icon-btn" id="rMinus" aria-label="Uno menos">−</button><input type="number" id="resN" min="0" max="300" value="0" aria-label="Cambios"><button class="icon-btn" id="rPlus" aria-label="Uno más">+</button></div>
      <div class="row"><button class="btn primary" id="resSave">Guardar</button><button class="btn" id="resDrop">Descartar</button></div>
    </div>
  </div>
  </div>
  <div class="col">
  <div class="panel" id="gTrainerPanel" hidden><div class="stack" id="gTrainer" style="gap:10px"></div></div>
  <div class="panel">
    <div class="row between"><div class="label">Tu avance con este par</div><span class="chip acc" id="cBest"></span></div>
    <div class="chart" id="cChart"></div>
  </div>
  </div>
  </div>`;
  let p = null; try { p = JSON.parse(localStorage.getItem("riff-par") || "null"); } catch (e) {}
  setPair(p ? p[0] : "Am", p ? p[1] : "E");
  ["cA", "cB"].forEach(id => $("#" + id, el).onchange = () => setPair($("#cA", el).value, $("#cB", el).value));
  el.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => !C.run && setMode(b.dataset.mode));
  $("#micBtn", el).onclick = startMic;
  const sens = $("#micSens", el); sens.value = data.ajustes.micSens || "media"; A.setSensitivity(sens.value);
  sens.onchange = () => { data.ajustes.micSens = sens.value; A.setSensitivity(sens.value); save(); };
  $("#micNoise", el).onclick = async () => {
    if (C.run || !(await startMic())) return;
    const st = $("#micStatus", cel); st.textContent = "Silencia las cuerdas con la mano y no toques…";
    await A.measureNoise(1200); st.textContent = "Listo. Ruido de fondo medido.";
  };
  $("#calA", el).onclick = () => calibrate("A"); $("#calB", el).onclick = () => calibrate("B");
  const gAuto = $("#gAuto", el), gMic = $("#gMic", el);
  gAuto.checked = data.ajustes.tempoAuto !== false; gMic.checked = !!data.ajustes.calificarMic;
  gAuto.onchange = () => { data.ajustes.tempoAuto = gAuto.checked; save(); renderTrainer(); };
  gMic.onchange = () => { data.ajustes.calificarMic = gMic.checked; save(); renderTrainer(); };
  $("#cStart", el).onclick = startChallenge;
  const rn = $("#resN", el);
  $("#rMinus", el).onclick = () => rn.value = Math.max(0, (+rn.value || 0) - 1);
  $("#rPlus", el).onclick = () => rn.value = (+rn.value || 0) + 1;
  $("#resDrop", el).onclick = () => { $("#cResult", el).hidden = true; idle(); };
  $("#resSave", el).onclick = saveResult;
  let m = "libre"; try { m = localStorage.getItem("riff-modo") || "libre"; } catch (e) {}
  setMode(["libre", "guia", "mic"].includes(m) ? m : "libre");
}

/* ---- Entrenador de tempo ----
   Mide la velocidad en cambios por minuto (cpm). El tempo y los tiempos por cambio se eligen
   para que el clic quede en un rango cómodo (hasta 120 BPM): 20 cpm = 80 BPM cambiando cada 4 tiempos. */
const clampCpm = v => Math.max(8, Math.min(120, Math.round(v)));
export function tempoOf(cpm) { const per = cpm * 4 <= 120 ? 4 : cpm * 2 <= 120 ? 2 : 1; return { per, bpm: cpm * per }; }
function trainer(k) {
  const t = (data.entrenador || {})[k];
  if (t) return t;
  const best = bestFor(k);
  return { cpm: best ? clampCpm(best * .75) : 20, hist: [], nuevo: true, base: best };
}
export function nextCpm(cpm, ratio) {
  if (ratio >= .95) return clampCpm(cpm + Math.max(1, cpm * .1));
  if (ratio >= .85) return clampCpm(cpm + Math.max(1, cpm * .05));
  if (ratio < .7) return clampCpm(cpm - Math.max(1, cpm * .1));
  return cpm;
}
function renderTrainer() {
  if (!cel) return;
  const auto = $("#gAuto", cel).checked;
  $("#gManual", cel).hidden = auto; $("#gTrainerPanel", cel).hidden = !(auto && C.mode === "guia");
  if (!C.run) idle();
  if (!auto) return;
  const k = pairKey(), t = trainer(k), { per, bpm } = tempoOf(t.cpm), h = (t.hist || []).slice(-20);
  let spark = "";
  if (h.length > 1) {
    const W = 300, H = 56, max = Math.max(...h.map(x => x.cpm)) * 1.1, min = Math.min(...h.map(x => x.cpm)) * .9;
    const xs = i => 4 + i * (W - 8) / (h.length - 1), ys = v => 6 + (H - 12) * (1 - (v - min) / Math.max(1, max - min));
    const pts = h.map((x, i) => xs(i) + "," + ys(x.cpm)).join(" ");
    spark = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Historial de tempo">
      <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>
      ${h.map((x, i) => `<circle cx="${xs(i)}" cy="${ys(x.cpm)}" r="3" fill="${x.ratio >= .85 ? "var(--good)" : x.ratio < .7 ? "var(--warn)" : "var(--muted)"}"/>`).join("")}</svg>
      <p class="note">Cada punto es una ronda: verde subió el tempo, gris se mantuvo, naranja bajó.</p>`;
  }
  $("#gTrainer", cel).innerHTML = `
    <div class="row between" style="align-items:flex-end">
      <div><div class="label">Tu tempo de entrenamiento</div><div class="big" style="font-size:2.6rem">${bpm}<span style="font-size:1rem;color:var(--muted)"> BPM</span></div></div>
      <div class="num" style="text-align:right;font-size:.9rem"><b>${t.cpm}</b> cambios/min<br><span class="muted">cada ${per} ${per === 1 ? "tiempo" : "tiempos"}</span></div>
    </div>
    ${spark}
    <p class="note">${t.nuevo ? (t.base ? `Empiezas al 75% de tu récord (${t.base}) para que los cambios salgan limpios.` : "Aún no tienes récord con este par: empiezas en 20 cambios por minuto. Una ronda en Cuenta tú o Escuchar te da un punto de partida más exacto.") : "Sube si 85% o más de los cambios salen limpios, se mantiene entre 70 y 85%, y baja si salen menos del 70%."}</p>
    ${t.nuevo ? "" : `<button class="btn small" id="gReset" style="align-self:flex-start">Volver a empezar desde mi récord</button>`}`;
  $("#gReset", cel)?.addEventListener("click", () => { delete data.entrenador[k]; save(); renderTrainer(); toast("Tempo reiniciado desde tu récord"); });
}
function setPair(a, b) {
  $("#cA", cel).value = a; $("#cB", cel).value = b;
  try { localStorage.setItem("riff-par", JSON.stringify([a, b])); } catch (e) {}
  $("#cChords", cel).innerHTML = diagram(a) + diagram(b);
  $("#mA", cel).textContent = a; $("#mB", cel).textContent = b;
  $("#calA", cel).textContent = (data.calibracion[a] ? "Recalibrar " : "Calibrar ") + a;
  $("#calB", cel).textContent = (data.calibracion[b] ? "Recalibrar " : "Calibrar ") + b;
  renderCambiosStats(); renderTrainer();
}
function setMode(m) {
  C.mode = m; try { localStorage.setItem("riff-modo", m); } catch (e) {}
  cel.querySelectorAll("[data-mode]").forEach(b => b.setAttribute("aria-checked", b.dataset.mode === m));
  renderTrainer();
  $("#guiaCfg", cel).hidden = m !== "guia"; $("#micCfg", cel).hidden = m !== "mic";
  $("#modeNote", cel).textContent = {
    libre: "Cuenta los cambios en voz alta o mentalmente. Al terminar el minuto escribes el número.",
    guia: "Un clic marca el tiempo y la pantalla te dice qué acorde sigue. Con el tempo automático, la app lo sube o lo baja después de cada ronda según tus cambios limpios.",
    mic: "La app escucha tu guitarra y cuenta los cambios sola. Funciona mejor con acústica o sonido limpio, cerca del teléfono y sin ruido de fondo.",
  }[m];
  idle();
}
function idle() {
  $("#stage", cel).classList.remove("live"); $("#stLab", cel).textContent = "Listo";
  const n = $("#stNum", cel); n.className = "big"; n.textContent = "60";
  let msg = "Tendrás 3 segundos para poner las manos en la guitarra";
  if (C.mode === "guia" && $("#gAuto", cel)?.checked) {
    const t = trainer(pairKey()), tp = tempoOf(t.cpm);
    msg = `Tempo de hoy: ${tp.bpm} BPM, cambias cada ${tp.per} ${tp.per === 1 ? "tiempo" : "tiempos"} (${t.cpm} cambios/min)`;
  }
  $("#stSub", cel).textContent = msg;
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
const LAB_MIN = .55, LAB_DIFF = .04;
async function startMic() {
  const st = $("#micStatus", cel);
  if (A.mic.an) return true;
  st.textContent = "Silencia las cuerdas con la mano un segundo mientras mido el ruido…";
  const ok = await A.micOn();
  if (!ok) { st.textContent = A.mic.error; return false; }
  $("#micBtn", cel).hidden = true; st.textContent = "Micrófono listo. Toca un acorde y mira las barras.";
  if (!D.loop) D.loop = setInterval(micTick, 50);
  return true;
}
function micTick() {
  if (root.hidden || cel.hidden || C.mode !== "mic") { if (!D.det && !D.cal) return; }
  const fr = A.chroma(), a = $("#cA", cel).value, b = $("#cB", cel).value;
  const sa = fr.on ? A.cosSim(fr.chroma, tpl(a)) : 0, sb = fr.on ? A.cosSim(fr.chroma, tpl(b)) : 0;
  $("#barL", cel).style.width = A.meterPos(fr.rms) * 100 + "%";
  $("#gateMark", cel).style.left = A.meterPos(A.gate()) * 100 + "%";
  $("#barL", cel).classList.toggle("win", fr.on);
  $("#barA", cel).style.width = sa * 100 + "%"; $("#barB", cel).style.width = sb * 100 + "%";
  $("#sA", cel).textContent = fr.on ? Math.round(sa * 100) : "–"; $("#sB", cel).textContent = fr.on ? Math.round(sb * 100) : "–";
  let lab = null; if (fr.on && Math.max(sa, sb) > LAB_MIN && Math.abs(sa - sb) > LAB_DIFF) lab = sa > sb ? "A" : "B";
  $("#barA", cel).classList.toggle("win", lab === "A"); $("#barB", cel).classList.toggle("win", lab === "B");
  if (D.cal && fr.on) D.cal.push(fr.chroma);
  const d = D.det; if (!d || !lab) return;   // los cuadros sin sonido claro no interrumpen el conteo
  if (lab === d.cand) d.cc++; else { d.cand = lab; d.cc = 1; }
  // Un cambio cuenta si el acorde nuevo se sostiene ~150 ms y pasó un mínimo de tiempo desde el anterior
  if (d.cc >= 3 && lab !== d.cur && performance.now() - d.lastT > 300) {
    d.lastT = performance.now();
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
  await new Promise(r => setTimeout(r, 4000));
  const fr = D.cal; D.cal = null; btn.disabled = false;
  if (fr.length < 8) { st.textContent = "Casi no escuché la guitarra: la barra de volumen no pasó la línea. Sube la sensibilidad o acerca el teléfono y vuelve a intentar."; return; }
  const avg = new Array(12).fill(0); fr.forEach(c => c.forEach((x, i) => avg[i] += x));
  data.calibracion[name] = A.norm(avg); save(); A.chime();
  st.textContent = `${name} calibrado.`; setPair($("#cA", cel).value, $("#cB", cel).value);
}

/* Reto */
function stop() { C.run = false; clearInterval(C.tick); A.keepAwake(false); $("#cStart", cel).textContent = "Empezar reto"; $("#cA", cel).disabled = $("#cB", cel).disabled = false; }
async function startChallenge() {
  const a = A.ctx(); if (!a) return;
  if (C.run) { stop(); D.det = null; idle(); return; }
  const listen = C.mode === "mic" || (C.mode === "guia" && $("#gMic", cel).checked);
  if (listen && !(await startMic())) { if (C.mode === "guia") toast(A.mic.error || "No se pudo usar el micrófono"); return; }
  $("#cResult", cel).hidden = true;
  C.run = true; C.t0 = a.currentTime + 3;
  C.autoTempo = C.mode === "guia" && $("#gAuto", cel).checked;
  if (C.autoTempo) { C.cpm = trainer(pairKey()).cpm; Object.assign(C, tempoOf(C.cpm)); }
  else { C.bpm = Math.min(200, Math.max(30, +$("#gBpm", cel).value || 60)); C.per = +$("#gPer", cel).value; }
  C.listen = listen;
  C.next = C.t0; C.k = 0; C.auto = 0; C.lastWarn = 0;
  [0, 1, 2].forEach(i => A.beep(800, .07, a.currentTime + i));
  if (listen) {
    const both = data.calibracion[$("#cA", cel).value] && data.calibracion[$("#cB", cel).value];
    setTimeout(() => { if (C.run) D.det = { cur: null, cand: null, cc: 0, lastT: 0, changes: 0, cleanN: 0, hold: 0, pending: false, clean: both ? .85 : .75 }; }, 3000);
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
    subt.textContent = "Cambio " + idx; C.auto = Math.min(idx, Math.ceil(C.bpm / C.per) - 1);
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
    } else if (C.mode === "guia") {
      C.micRes = null;
      if (C.listen) {
        const d = D.det || { changes: 0, cleanN: 0, pending: false }; D.det = null;
        if (d.pending && d.hold >= d.clean) d.cleanN++;
        const clean = Math.min(C.auto, d.cleanN); C.micRes = { changes: d.changes, clean };
        rn.value = clean; rl.textContent = `El micrófono escuchó ${clean} de ${C.auto} cambios limpios a ${C.bpm} BPM. Corrige el número si hace falta.`;
      } else { rn.value = C.auto; rl.textContent = `Hubo ${C.auto} cambios a ${C.bpm} BPM. ¿Cuántos salieron limpios?`; }
    }
    else { rn.value = prev || 0; rl.textContent = "¿Cuántos cambios lograste?"; }
    $("#cResult", cel).hidden = false;
  }
}
function saveResult() {
  const n = Math.max(0, Math.round(+$("#resN", cel).value || 0)), k = pairKey(), prev = bestFor(k);
  const rec = { par: k, n, t: new Date().toISOString(), modo: C.mode };
  if (C.mode === "guia") rec.bpm = C.bpm;
  if (C.mode === "mic" && C.micRes) rec.limpios = C.micRes.clean;
  data.intentos.push(rec);
  let msg = n > prev ? (prev ? `¡Nuevo récord! Antes: ${prev}` : "Primer registro guardado") : `Guardado. Tu récord sigue en ${prev}`;
  if (C.mode === "guia" && C.autoTempo && C.auto > 0) {
    const ratio = Math.min(1, n / C.auto), cpm = C.cpm, next = nextCpm(cpm, ratio), pct = Math.round(ratio * 100);
    data.entrenador = data.entrenador || {};
    const t = data.entrenador[k] || { cpm, hist: [] };
    t.cpm = next; t.hist = [...(t.hist || []), { t: rec.t, cpm, ratio: Math.round(ratio * 100) / 100 }].slice(-60);
    data.entrenador[k] = t;
    const nb = tempoOf(next).bpm;
    msg = next > cpm ? `${pct}% limpios. ¡Sube a ${nb} BPM!` : next < cpm ? `${pct}% limpios. Bajamos a ${nb} BPM para afianzar` : `${pct}% limpios. Repite a ${nb} BPM`;
  }
  save(); toast(msg);
  $("#cResult", cel).hidden = true; idle(); renderCambiosStats(); renderTrainer();
}

/* =================== METRÓNOMO =================== */
const M = { bpm: 80, run: false, beat: 0, sub: 0, bars: 0, next: 0, timer: null, meter: 4, subdiv: 1, taps: [] };
let mel;
function mountMetro(el) {
  mel = el;
  el.innerHTML = `
  <div class="cols">
  <div class="col">
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
  <div class="cols" style="--cols:minmax(0,1fr) minmax(0,1.4fr)">
  <div class="col">
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
    <button class="btn primary block" id="jStart" data-primary>Tocar</button>
  </div>
  </div>
  <div class="col">
  <div class="panel">
    <div class="row between"><div class="label" id="jScaleName">Pentatónica menor</div><span class="chip acc" id="jKey"></span></div>
    <div class="fret-wrap" id="jFret"></div>
    <p class="note">Naranja: tónica, tu "casa". Verde: notas del acorde que está sonando; caer en ellas al final de una frase suena seguro.</p>
  </div>
  </div>
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
