// Reto de cambios entre dos acordes: cuenta tú, con clic (entrenador de tempo) o escuchando por micrófono.
// Con micrófono, el carril muestra lo que viene y lo que tocaste, y cada cambio se califica al momento.
import { data, save, bestFor, toast, esc, practiceStart, practiceEnd, $ } from "../store.js";
import { CHORDS, diagram } from "../chords.js";
import * as A from "../audio.js";
import { chordTemplate, LAB_MIN, LAB_DIFF } from "../detect.js";
import { Highway, Feedback, ChordJudge, swapText } from "../ui/highway.js";
import { openChordCalibration, openMicSettings } from "../ui/calib.js";
import { BigChords } from "../ui/bigchord.js";

const C = { mode: "mic", run: false, tick: null, t0: 0, next: 0, k: 0, auto: 0, bpm: 60, per: 4, lastWarn: 0, micRes: null, listen: false };
const D = { loop: null, det: null, cal: null };
let cel, hw, fb, judge, micWarned = false;
const A_ = () => $("#cA", cel).value, B_ = () => $("#cB", cel).value;
const pairKey = () => A_() + " ↔ " + B_();
const goTo = (view, opts) => window.dispatchEvent(new CustomEvent("riff:go", { detail: { view, opts } }));

export function mountCambios(el) {
  cel = el;
  const opts = Object.keys(CHORDS).map(c => `<option>${esc(c)}</option>`).join("");
  el.innerHTML = `
  <div class="cols" style="--cols:minmax(0,1.5fr) minmax(0,1fr)">
  <div class="col">
  <div class="panel deck-panel screen">
   <div class="deck">
    <div class="deck-top">
      <select id="cA" aria-label="Primer acorde" style="flex:0 1 110px">${opts}</select><span class="muted num">↔</span>
      <select id="cB" aria-label="Segundo acorde" style="flex:0 1 110px">${opts}</select>
      <div class="seg" role="radiogroup" aria-label="Modo del reto" style="flex:1 1 300px">
        <button role="radio" data-mode="libre">Cuenta tú</button>
        <button role="radio" data-mode="guia">Con clic</button>
        <button role="radio" data-mode="mic">Escuchar</button>
      </div>
    </div>
    <p class="note" id="modeNote"></p>
    <div id="cHwy"></div>
    <div class="stage dstage" id="stage" aria-live="polite">
      <div class="meta">
        <span class="lab" id="stLab">Listo</span>
        <div class="now"><span class="chordnow" id="stNum"></span><span class="stage-chord" id="stDiag"></span></div>
        <span class="sub" id="stSub"></span>
      </div>
      <div class="nextbox" id="stNextBox"><span class="lab">Sigue</span><span class="nxt" id="stNext"></span><span class="stage-chord" id="stNextDiag"></span></div>
    </div>
    <div id="cBig"></div>
    <div class="panel hl" id="cResult" hidden>
      <div class="label" id="resLabel"></div>
      <div class="row"><div class="stepper"><button class="icon-btn" id="rMinus" aria-label="Uno menos">−</button><input type="number" id="resN" min="0" max="300" value="0" aria-label="Cambios"><button class="icon-btn" id="rPlus" aria-label="Uno más">+</button></div>
      <button class="btn primary" id="resSave">Guardar</button><button class="btn" id="resDrop">Descartar</button></div>
    </div>
    <div class="deck-ctl">
      <span id="guiaCtl" class="row" style="gap:8px">
        <label class="chip-toggle"><input type="checkbox" id="gAuto" checked> Tempo automático</label>
        <label class="chip-toggle"><input type="checkbox" id="gMic"> Calificar con micrófono</label>
        <span id="gManual" class="row" style="gap:6px" hidden>
          <input type="number" id="gBpm" value="60" min="30" max="200" aria-label="Tempo en BPM" style="width:80px"><span class="note">BPM, cambia cada</span>
          <select id="gPer" aria-label="Tiempos por cambio"><option value="4">4</option><option value="2">2</option><option value="1">1</option></select>
        </span>
      </span>
      <span class="deck-tempo" id="cTempo"></span>
      <select id="cDur" aria-label="Duración de la ronda"><option value="1">1 minuto</option><option value="2">2 minutos</option><option value="3">3 minutos</option><option value="5">5 minutos</option><option value="10">10 minutos</option></select>
      <button class="btn primary" id="cStart" data-primary>Empezar reto</button>
    </div>
   </div>
  </div>
  </div>
  <div class="col">
  <div class="panel" id="gTrainerPanel" hidden><div class="stack" id="gTrainer" style="gap:10px"></div></div>
  <div class="panel" id="micCfg">
    <div class="row between"><div class="label">Micrófono</div><button class="btn small" id="micBtn">Activar micrófono</button></div>
    <span class="note" id="micStatus">El navegador te pedirá permiso. Silencia las cuerdas un segundo mientras mide el ruido.</span>
    <div class="meter"><b id="mA"></b><div class="bar"><div id="barA"></div></div><span id="sA">–</span></div>
    <div class="meter"><b id="mB"></b><div class="bar"><div id="barB"></div></div><span id="sB">–</span></div>
    <div class="meter"><b>Volumen</b><div class="bar lvlbar"><div id="barL" class="lvl"></div><i id="gateMark" title="Umbral"></i></div><span></span></div>
    <p class="note">Cuando tocas, la barra de volumen debe pasar la línea.</p>
    <div class="row">
      <label class="field" for="micSens" style="flex:1">Sensibilidad<select id="micSens"><option value="alta">Alta (cuarto silencioso)</option><option value="media">Media</option><option value="baja">Baja (cuarto con ruido)</option></select></label>
      <button class="btn small" id="micNoise" style="align-self:flex-end">Medir ruido</button>
    </div>
    <div class="row between"><span class="note" id="calState"></span><span class="row" style="gap:6px"><button class="btn small" id="calBtn">Calibrar acordes</button><button class="btn small" id="ecoBtn">Bocinas y eco</button></span></div>
    <p class="note">Calibra cada acorde una vez: rasguéalo 4 segundos con tu guitarra y en tu cuarto. Se guarda en este dispositivo y ayuda mucho con acordes parecidos como D y Dm.</p>
  </div>
  <div class="panel">
    <div class="row between"><div class="label">Tu avance con este par</div><span class="chip acc" id="cBest"></span></div>
    <div class="chart" id="cChart"></div>
  </div>
  </div>
  </div>`;
  hw = new Highway($("#cHwy", el), { mode: "chords" });
  big = new BigChords($("#cBig", el));
  fb = new Feedback($("#stage", el));
  judge = new ChordJudge({ onResult: onJudge });
  let p = null; try { p = JSON.parse(localStorage.getItem("riff-par") || "null"); } catch (e) {}
  setPair(p ? p[0] : "Am", p ? p[1] : "E");
  ["cA", "cB"].forEach(id => $("#" + id, el).onchange = () => setPair(A_(), B_()));
  // acordes nuevos creados por ti
  window.addEventListener("riff:chords", () => ["cA", "cB"].forEach(id => { const s = $("#" + id, el), v = s.value; s.innerHTML = Object.keys(CHORDS).map(c => `<option>${esc(c)}</option>`).join(""); s.value = CHORDS[v] ? v : s.options[0].value; }));
  el.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => !C.run && setMode(b.dataset.mode));
  $("#micBtn", el).onclick = startMic;
  const sens = $("#micSens", el); sens.value = data.ajustes.micSens || "media"; A.setSensitivity(sens.value);
  sens.onchange = () => { data.ajustes.micSens = sens.value; A.setSensitivity(sens.value); save(); };
  $("#micNoise", el).onclick = async () => {
    if (C.run || !(await startMic())) return;
    const st = $("#micStatus", cel); st.textContent = "Silencia las cuerdas con la mano y no toques…";
    await A.measureNoise(1200); st.textContent = "Listo. Ruido de fondo medido.";
  };
  $("#ecoBtn", el).onclick = () => { if (!C.run) openMicSettings({ chords: [A_(), B_()], onDone: () => { sens.value = data.ajustes.micSens || "media"; setPair(A_(), B_()); } }); };
  $("#calBtn", el).onclick = () => { if (!C.run) openChordCalibration([A_(), B_()], { title: `Calibrar ${A_()} y ${B_()}`, onDone: () => setPair(A_(), B_()) }); };
  const gAuto = $("#gAuto", el), gMic = $("#gMic", el);
  gAuto.checked = data.ajustes.tempoAuto !== false; gMic.checked = data.ajustes.calificarMic !== false;
  gAuto.onchange = () => { data.ajustes.tempoAuto = gAuto.checked; save(); renderTrainer(); };
  gMic.onchange = () => { data.ajustes.calificarMic = gMic.checked; save(); setMode(C.mode); };
  ["gBpm", "gPer"].forEach(id => $("#" + id, el).onchange = () => idle());
  $("#cStart", el).onclick = startChallenge;
  const dur = $("#cDur", el); dur.value = String(data.ajustes.cambiosMin || 1);
  dur.onchange = () => { data.ajustes.cambiosMin = +dur.value; save(); idle(); };
  const rn = $("#resN", el);
  $("#rMinus", el).onclick = () => rn.value = Math.max(0, (+rn.value || 0) - 1);
  $("#rPlus", el).onclick = () => rn.value = (+rn.value || 0) + 1;
  $("#resDrop", el).onclick = () => { $("#cResult", el).hidden = true; idle(); };
  $("#resSave", el).onclick = saveResult;
  let m = null; try { m = localStorage.getItem("riff-modo"); } catch (e) {}
  setMode(["libre", "guia", "mic"].includes(m) ? m : "mic");
  window.addEventListener("riff:stop-audio", () => { if (C.run && !C.starting) { stop(); idle(); } });
  window.addEventListener("riff:stop-cambios", () => { if (C.run) { stop(); idle(); } });
}
export const cambiosRunning = () => C.run;
export function applyCambiosOpts(opts) {
  if (opts.pair && CHORDS[opts.pair[0]] && CHORDS[opts.pair[1]] && !C.run) setPair(opts.pair[0], opts.pair[1]);
  if (opts.mode && !C.run) setMode(opts.mode);
}
export function refreshCambios() { renderCambiosStats(); }

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
function guiaTempo() {
  if ($("#gAuto", cel).checked) { const t = trainer(pairKey()); return { cpm: t.cpm, ...tempoOf(t.cpm) }; }
  const bpm = Math.min(200, Math.max(30, +$("#gBpm", cel).value || 60)), per = +$("#gPer", cel).value;
  return { bpm, per, cpm: Math.round(bpm / per) };
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
    spark = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Historial de tempo">
      <polyline points="${h.map((x, i) => xs(i) + "," + ys(x.cpm)).join(" ")}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>
      ${h.map((x, i) => `<circle cx="${xs(i)}" cy="${ys(x.cpm)}" r="3" fill="${x.ratio >= .85 ? "var(--good)" : x.ratio < .7 ? "var(--warn)" : "var(--muted)"}"/>`).join("")}</svg>
      <p class="note">Cada punto es una ronda: verde subió el tempo, gris se mantuvo, naranja bajó.</p>`;
  }
  $("#gTrainer", cel).innerHTML = `
    <div class="row between" style="align-items:flex-end">
      <div><div class="label">Tu tempo de entrenamiento</div><div class="big" style="font-size:2.4rem">${bpm}<span style="font-size:1rem;color:var(--muted)"> BPM</span></div></div>
      <div class="num" style="text-align:right;font-size:.9rem"><b>${t.cpm}</b> cambios/min<br><span class="muted">cada ${per} ${per === 1 ? "tiempo" : "tiempos"}</span></div>
    </div>
    ${spark}
    <p class="note">${t.nuevo ? (t.base ? `Empiezas al 75% de tu récord (${t.base}) para que los cambios salgan limpios.` : "Aún no tienes récord con este par: empiezas en 20 cambios por minuto. Una ronda en Escuchar o Cuenta tú te da un punto de partida más exacto.") : "Sube si 85% o más de los cambios salen limpios, se mantiene entre 70 y 85%, y baja si salen menos del 70%."}</p>
    ${t.nuevo ? "" : `<button class="btn small" id="gReset" style="align-self:flex-start">Volver a empezar desde mi récord</button>`}`;
  $("#gReset", cel)?.addEventListener("click", () => { delete data.entrenador[k]; save(); renderTrainer(); toast("Tempo reiniciado desde tu récord"); });
}
function setPair(a, b) {
  $("#cA", cel).value = a; $("#cB", cel).value = b;
  try { localStorage.setItem("riff-par", JSON.stringify([a, b])); } catch (e) {}
  $("#mA", cel).textContent = a; $("#mB", cel).textContent = b;
  const nCal = [a, b].filter(c => data.calibracion[c]).length;
  $("#calState", cel).textContent = nCal === 2 ? `${a} y ${b} calibrados` : nCal === 1 ? `${data.calibracion[a] ? a : b} calibrado; falta ${data.calibracion[a] ? b : a}` : "Sin calibrar";
  renderCambiosStats(); renderTrainer();
}
function setMode(m) {
  C.mode = m; try { localStorage.setItem("riff-modo", m); } catch (e) {}
  cel.querySelectorAll("[data-mode]").forEach(b => b.setAttribute("aria-checked", b.dataset.mode === m));
  $("#guiaCtl", cel).hidden = m !== "guia";
  $("#cHwy", cel).hidden = m === "libre";
  $("#micCfg", cel).hidden = !(m === "mic" || (m === "guia" && $("#gMic", cel).checked));
  $("#modeNote", cel).textContent = {
    libre: "Cuenta los cambios en voz alta. Al terminar la ronda escribes el número.",
    guia: "Cambia con el clic. El carril muestra lo que viene; con micrófono, cada cambio se califica al momento.",
    mic: "Cambia a tu ritmo: la app escucha, cuenta los cambios y te muestra cada uno en el carril.",
  }[m];
  renderTrainer(); idle();
}
const mins = () => +($("#cDur", cel)?.value || 1);
const fmt = s => s >= 60 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : String(Math.ceil(s));
function diag(name) { return CHORDS[name] ? diagram(name) : ""; }
let big;
function showNow(name, sub) {
  const n = $("#stNum", cel), changed = n.textContent !== name || n.classList.contains("big");
  n.classList.remove("big"); n.classList.add("chordnow"); swapText(n, name);
  if (changed) $("#stDiag", cel).innerHTML = diag(name);
  big?.set(name);
  if (sub !== undefined) $("#stSub", cel).textContent = sub;
}
function showNext(name) {
  $("#stNextBox", cel).hidden = !name; $("#stNext", cel).textContent = name || "";
  $("#stNextDiag", cel).innerHTML = name ? diag(name) : "";
  big?.set(undefined, name || null);
}
function idle() {
  $("#stage", cel).classList.remove("live"); $("#stLab", cel).textContent = "Listo";
  const tp = C.mode === "guia" ? guiaTempo() : null;
  $("#cTempo", cel).innerHTML = tp ? `${tp.bpm}<small>BPM</small>` : "";
  if (C.mode === "libre") {
    $("#stNum", cel).className = "big"; $("#stNum", cel).textContent = fmt(mins() * 60); $("#stDiag", cel).innerHTML = diag(A_()); big?.set(A_());
    showNext(B_()); $("#stSub", cel).textContent = "Tendrás 3 segundos para poner las manos en la guitarra";
  } else {
    showNow(A_(), tp ? `${tp.bpm} BPM · cambias cada ${tp.per} ${tp.per === 1 ? "tiempo" : "tiempos"} · ${tp.cpm} cambios por minuto` : "Empieza con " + A_() + " y cambia a tu ritmo");
    showNext(B_());
  }
  if (!C.run) {
    fb.reset();
    if (C.mode === "guia") {
      const len = tp.per * 60 / tp.bpm, list = [];
      for (let i = 0; i * len < 12; i++) list.push({ id: "p" + i, t0: 1 + i * len, t1: 1 + (i + 1) * len, label: i % 2 === 0 ? A_() : B_() });
      hw.preview(list);
    } else hw.reset();
  }
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

/* ---- Micrófono ---- */
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
  const panelOn = !cel.closest(".view").hidden && !cel.hidden && !$("#micCfg", cel).hidden;
  const needed = (C.run && C.listen) || D.cal || panelOn;
  if (!needed) return;
  const fr = A.chroma(), a = A_(), b = B_(), now = A.now();
  const sa = fr.on ? A.cosSim(fr.chroma, chordTemplate(a)) : 0, sb = fr.on ? A.cosSim(fr.chroma, chordTemplate(b)) : 0;
  if (panelOn) {
    $("#barL", cel).style.width = A.meterPos(fr.rms) * 100 + "%";
    $("#gateMark", cel).style.left = A.meterPos(A.gate()) * 100 + "%";
    $("#barL", cel).classList.toggle("win", fr.on);
    $("#barA", cel).style.width = sa * 100 + "%"; $("#barB", cel).style.width = sb * 100 + "%";
    $("#sA", cel).textContent = fr.on ? Math.round(sa * 100) : "–"; $("#sB", cel).textContent = fr.on ? Math.round(sb * 100) : "–";
  }
  let lab = null; if (fr.on && Math.max(sa, sb) > LAB_MIN && Math.abs(sa - sb) > LAB_DIFF) lab = sa > sb ? "A" : "B";
  if (panelOn) { $("#barA", cel).classList.toggle("win", lab === "A"); $("#barB", cel).classList.toggle("win", lab === "B"); }
  if (D.cal && fr.on) D.cal.push(fr.chroma);
  const name = lab === "A" ? a : lab === "B" ? b : null;
  if (!C.run || !C.listen || now < C.t0) return;
  const tc = now - .12;   // el análisis abarca ~170 ms hacia atrás
  if (C.mode === "guia") {
    judge.frame(now, name);
    if (name) { const exp = expectedAt(tc); hw.heard(tc - .03, tc + .03, name, name === exp); }
    return;
  }
  // Modo Escuchar: cuenta cambios y arma el carril con lo que vas tocando
  const d = D.det; if (!d) return;
  if (d.block) d.block.t1 = tc;
  if (!name) return;   // los cuadros sin sonido claro no interrumpen el conteo
  hw.heard(tc - .03, tc + .03, name, true);
  if (lab === d.cand) d.cc++; else { d.cand = lab; d.cc = 1; }
  // Un cambio cuenta si el acorde nuevo se sostiene ~150 ms y pasó un mínimo de tiempo desde el anterior
  if (d.cc >= 3 && lab !== d.cur && performance.now() - d.lastT > 300) {
    d.lastT = performance.now();
    if (d.pending) { const clean = d.hold >= d.clean; if (clean) d.cleanN++; }
    if (d.block) { d.block.status = d.hold >= d.clean ? "ok" : "meh"; d.block.t1 = tc - .15; }
    if (d.cur) { d.changes++; fb.show(d.hold >= d.clean || !d.pending ? "ok" : "meh"); }
    d.pending = !!d.cur; d.cur = lab; d.hold = 0;
    d.block = hw.add({ id: "m" + d.changes, t0: tc - .15, t1: tc, label: name });
    showNow(name); showNext(name === a ? b : a);
  }
  if (lab === d.cur) d.hold = Math.max(d.hold, lab === "A" ? sa : sb);
}
function expectedAt(t) { const s = (judge.segs || []).find(s => t >= s.t0 && t < s.t1); return s ? s.c : null; }
function onJudge(s, status) {
  hw.mark(s.id, status);
  if (C.run) fb.show(status);
}
/* ---- Reto ---- */
function stop() {
  practiceEnd("cambios");
  C.run = false; clearInterval(C.tick); A.keepAwake(false); hw.stop();
  $("#cStart", cel).textContent = "Empezar reto"; $("#cA", cel).disabled = $("#cB", cel).disabled = false; $("#cDur", cel).disabled = false;
  cel.querySelectorAll("[data-mode]").forEach(b => b.disabled = false);
}
async function startChallenge() {
  const a = A.ctx(); if (!a) return;
  if (C.run) {
    // detenido antes de tiempo: si ya llevabas 15 s o más, se califica lo que alcanzaste a tocar
    const played = A.now() - C.t0;
    if (played >= 15) { C.partial = played; C.min = played / 60; C.dur = played; finish(); return; }
    stop(); D.det = null; idle(); return;
  }
  C.partial = null;
  let listen = C.mode === "mic" || (C.mode === "guia" && $("#gMic", cel).checked);
  if (listen && !(await startMic())) {
    if (!micWarned) { toast("Sin micrófono: sigue sin calificación automática"); micWarned = true; }
    if (C.mode === "mic") setMode("libre");
    listen = false;
  }
  C.starting = true;
  window.dispatchEvent(new Event("riff:stop-audio")); window.dispatchEvent(new Event("riff:stop-seq")); window.dispatchEvent(new Event("riff:stop-rasgueo"));
  C.starting = false;
  $("#cResult", cel).hidden = true;
  C.run = true; practiceStart("cambios"); C.t0 = a.currentTime + 3; C.listen = listen; C.min = mins(); C.dur = C.min * 60;
  $("#cDur", cel).disabled = true;
  C.autoTempo = C.mode === "guia" && $("#gAuto", cel).checked;
  Object.assign(C, C.mode === "guia" ? guiaTempo() : {});
  C.next = C.t0; C.k = 0; C.auto = 0; C.lastWarn = 0;
  [0, 1, 2].forEach(i => A.beep(800, .07, a.currentTime + i));
  hw.reset(); fb.reset();
  if (C.mode === "guia") {
    // Línea de tiempo completa del minuto: el carril la muestra acercándose desde la cuenta regresiva
    const segLen = C.per * 60 / C.bpm, segs = [];
    for (let i = 0; C.t0 + i * segLen < C.t0 + C.dur - .01; i++) {
      const c = i % 2 === 0 ? A_() : B_();
      segs.push({ id: "g" + i, t0: C.t0 + i * segLen, t1: Math.min(C.t0 + (i + 1) * segLen, C.t0 + C.dur), c, isChange: i > 0 });
    }
    hw.addMany(segs.map(s => ({ id: s.id, t0: s.t0, t1: s.t1, label: s.c })));
    judge.setSegments(listen ? segs : []);
  }
  if (C.mode === "mic") {
    const both = data.calibracion[A_()] && data.calibracion[B_()];
    D.det = { cur: null, cand: null, cc: 0, lastT: 0, changes: 0, cleanN: 0, hold: 0, pending: false, clean: both ? .85 : .75, block: null };
  }
  if (C.mode !== "libre") hw.run(() => A.now());
  $("#stage", cel).classList.add("live"); $("#cStart", cel).textContent = "Cancelar";
  $("#cA", cel).disabled = $("#cB", cel).disabled = true;
  cel.querySelectorAll("[data-mode]").forEach(b => b.disabled = true);
  C.tick = setInterval(tick, 50); A.keepAwake(true); tick();
}
function tick() {
  const now = A.now(), lab = $("#stLab", cel), subt = $("#stSub", cel);
  if (now < C.t0) {
    lab.textContent = "Prepárate";
    if (C.mode === "libre") { $("#stNum", cel).className = "big"; $("#stNum", cel).textContent = Math.ceil(C.t0 - now); }
    else showNow(A_(), `Empieza en ${Math.ceil(C.t0 - now)}…`);
    return;
  }
  const el = now - C.t0, left = Math.max(0, C.dur - el);
  if (C.mode === "guia") {
    while (C.next < now + .12 && C.next < C.t0 + C.dur) { A.click(C.k % C.per === 0, C.next); C.next += 60 / C.bpm; C.k++; }
    const idx = Math.floor(Math.floor(el / (60 / C.bpm)) / C.per);
    const cur = idx % 2 === 0 ? A_() : B_(), nx = idx % 2 === 0 ? B_() : A_();
    lab.textContent = `Quedan ${fmt(left)}${left < 60 ? " s" : ""}`;
    if ($("#stNum", cel).textContent !== cur || $("#stNum", cel).className !== "chordnow") { showNow(cur); showNext(nx); }
    subt.textContent = `Cambio ${idx} · ${C.bpm} BPM`; C.auto = Math.min(idx, Math.ceil(C.bpm * C.min / C.per) - 1);
  } else if (C.mode === "mic") {
    const d = D.det;
    lab.textContent = `Quedan ${fmt(left)}${left < 60 ? " s" : ""}`;
    if (!d || !d.cur) { $("#stNum", cel).className = "chordnow"; $("#stNum", cel).textContent = "…"; }
    subt.textContent = "Cambios detectados: " + (d ? d.changes : 0);
  } else {
    lab.textContent = "Cambia y cuenta"; $("#stNum", cel).className = "big"; $("#stNum", cel).textContent = fmt(left);
    const s = Math.ceil(left); if (s <= 3 && s > 0 && C.lastWarn !== s) { C.lastWarn = s; A.beep(700, .06); }
  }
  if (left <= 0) finish();
}
function finish() {
  if (C.mode === "guia" && C.listen) judge.flush(C.t0 + C.dur);
  stop(); A.chime(); $("#stage", cel).classList.remove("live");
  $("#stLab", cel).textContent = "¡Tiempo!"; $("#stSub", cel).textContent = fb.best ? `Mejor racha: ${fb.best}` : "";
  const prev = bestFor(pairKey()), rn = $("#resN", cel), rl = $("#resLabel", cel);
  if (C.mode === "mic") {
    const d = D.det || { changes: 0, cleanN: 0, pending: false, hold: 0, clean: 1 }; D.det = null;
    if (d.pending && d.hold >= d.clean) d.cleanN++;
    if (d.block) d.block.status = d.hold >= d.clean ? "ok" : "meh";
    C.micRes = { changes: d.changes, clean: d.cleanN }; rn.value = d.changes;
    rl.textContent = `Detecté ${d.changes} cambios; ${d.cleanN} con el acorde sonando claro. Corrige el número si hace falta.`;
  } else if (C.mode === "guia") {
    C.micRes = null;
    if (C.listen) {
      const ok = judge.segs.filter(s => s.isChange && s.status === "ok").length, clean = Math.min(C.auto, ok);
      C.micRes = { changes: C.auto, clean };
      rn.value = clean; rl.textContent = `El micrófono escuchó ${clean} de ${C.auto} cambios limpios y a tiempo a ${C.bpm} BPM. Corrige el número si hace falta.`;
    } else { rn.value = C.auto; rl.textContent = `Hubo ${C.auto} cambios a ${C.bpm} BPM. ¿Cuántos salieron limpios?`; }
  } else { rn.value = (prev || 0) * C.min; rl.textContent = C.min > 1 ? `¿Cuántos cambios lograste en ${C.min} minutos?` : "¿Cuántos cambios lograste?"; }
  if (C.partial != null) rl.textContent = `Reto detenido a los ${C.partial < 60 ? Math.round(C.partial) + " s" : fmt(C.partial)}${C.partial < 60 ? " (no cuenta para récord por ser menos de un minuto)" : ""}. ` + rl.textContent.replace(/en \d+ minutos/, "");
  $("#cResult", cel).hidden = false;
}
function saveResult() {
  // El récord se guarda por minuto para comparar rondas de distinta duración
  const total = Math.max(0, Math.round(+$("#resN", cel).value || 0)), n = Math.round(total / (C.min || 1)), k = pairKey(), prev = bestFor(k);
  const rec = { par: k, n, t: new Date().toISOString(), modo: C.mode };
  if (C.min !== 1) { rec.total = total; rec.min = Math.round(C.min * 100) / 100; }
  if (C.partial != null) rec.parcial = true;
  if (C.mode === "guia") rec.bpm = C.bpm;
  if (C.micRes) rec.limpios = C.micRes.clean;
  data.intentos.push(rec);
  let msg = (C.min !== 1 ? `${n} cambios por minuto. ` : "") + (n > prev ? (prev ? `¡Nuevo récord! Antes: ${prev}` : "Primer registro guardado") : `Guardado. Tu récord sigue en ${prev}`);
  if (C.mode === "guia" && C.autoTempo && C.auto > 0) {
    const ratio = Math.min(1, total / C.auto), cpm = C.cpm, next = nextCpm(cpm, ratio), pct = Math.round(ratio * 100);
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
