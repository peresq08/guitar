// Secuencias de acordes: arma la progresión de una canción y practica los cambios en orden, con clic,
// tempo automático y calificación por micrófono acorde por acorde.
import { data, save, toast, esc, $ } from "../store.js";
import { CHORDS, diagram } from "../chords.js";
import * as A from "../audio.js";
import { classify } from "../detect.js";
import { Highway, Feedback, ChordJudge, swapText } from "../ui/highway.js";
import { openMicSettings, warnGuideEcho } from "../ui/calib.js";
import { allPatterns, patternById, playHit, STRUM_SYMBOL } from "./rasgueo.js";
import { LIBRARY } from "../plan.js";

let el;
const BEATS = [1, 2, 3, 4, 6, 8];
const P = { run: false, tick: null, t0: 0, next: 0, k: 0, segs: [], total: 0, bpm: 70, lastSeg: -1, results: [], listen: false, expected: 0, countIn: 4, timeline: [] };

/* ---------- Datos ---------- */
const PRESETS = [
  { nombre: "Pop de cuatro acordes", acordes: "G D Em C", bpm: 70, nota: "La progresión de cientos de canciones." },
  { nombre: "Balada ochentera", acordes: "C G Am F (mini)", bpm: 66 },
  { nombre: "Acordes del nivel 2", acordes: "Am E Dm A", bpm: 60 },
  { nombre: "Summer of '69 · coro", acordes: "Bm A D G", bpm: 70, cancion: "Summer of '69" },
  { nombre: "Back in Black · riff simplificado", acordes: "E5:2 D5:1 A5:1", bpm: 60, cancion: "Back in Black" },
  { nombre: "Blues en La · 12 compases", acordes: "A7 A7 A7 A7 D7 D7 A7 A7 E7 D7 A7 E7", bpm: 80 },
];
export function parseChords(text) {
  const out = [], bad = [];
  // Acepta "G D Em C", "G:2 C:2", "G x2" y comas. "F (mini)" se escribe como F(mini) o "F (mini)".
  const norm = text.replace(/F\s*\(mini\)/gi, "F_(mini)").replace(/,/g, " ");
  const toks = norm.split(/\s+/).filter(Boolean);
  for (let i = 0; i < toks.length; i++) {
    let tok = toks[i], t = 4;
    const m = tok.match(/^(.+?):(\d+)$/); if (m) { tok = m[1]; t = +m[2]; }
    const name = tok.replace("_", " ");
    const found = Object.keys(CHORDS).find(c => c.toLowerCase() === name.toLowerCase());
    const rep = toks[i + 1] && /^x(\d+)$/i.test(toks[i + 1]) ? +toks[++i].slice(1) : 1;
    if (!found) { bad.push(name); continue; }
    for (let r = 0; r < rep; r++) out.push({ c: found, t: Math.max(1, Math.min(16, t)) });
  }
  return { acordes: out, bad };
}
function ensure() {
  let changed = false;
  if (!Array.isArray(data.secuencias)) {
    data.secuencias = PRESETS.map((p, i) => {
      const song = (data.canciones || []).find(s => s.titulo === p.cancion);
      return { id: "q" + i, nombre: p.nombre, cancion: song ? song.id : null, acordes: parseChords(p.acordes).acordes, bpm: p.bpm, auto: true, hist: [], fallos: {} };
    });
    changed = true;
  }
  // Secuencias de la biblioteca de canciones (solo una vez cada una: si la borras, no regresa)
  data.agregado = data.agregado || { canciones: [], secuencias: [] };
  data.agregado.secuencias = data.agregado.secuencias || [];
  LIBRARY.forEach((L, i) => (L.secuencias || []).forEach((sq, j) => {
    const key = L.titulo + "::" + sq.nombre;
    if (data.agregado.secuencias.includes(key)) return;
    data.agregado.secuencias.push(key); changed = true;
    const song = (data.canciones || []).find(s => s.titulo === L.titulo);
    if (!song) return;
    data.secuencias.push({ id: `l${i}-${j}`, nombre: `${L.titulo} · ${sq.nombre}`, cancion: song.id, acordes: parseChords(sq.acordes).acordes, bpm: sq.bpm || 60, auto: true, hist: [], fallos: {} });
  }));
  if (changed) save();
}
const list = () => data.secuencias || [];
const cur = () => list().find(q => q.id === data.ajustes.secId) || list()[0];
const distinct = q => [...new Set(q.acordes.map(a => a.c))];
const changesIn = q => q.acordes.filter((a, i) => a.c !== q.acordes[(i - 1 + q.acordes.length) % q.acordes.length].c).length;
const clampBpm = v => Math.max(40, Math.min(200, Math.round(v)));
function nextBpm(bpm, ratio) {
  if (ratio >= .95) return clampBpm(bpm * 1.1);
  if (ratio >= .85) return clampBpm(bpm * 1.05);
  if (ratio < .7) return clampBpm(bpm * .9);
  return bpm;
}

/* ---------- Montaje ---------- */
let hw, fb, judge, micWarned = false;
export function mountSecuencias(container) {
  el = container; ensure();
  el.innerHTML = `
  <div class="cols" style="--cols:minmax(0,1.5fr) minmax(0,1fr)">
  <div class="col">
  <div class="panel deck-panel screen">
   <div class="deck">
    <div class="deck-top">
      <select id="sqPick" aria-label="Elegir secuencia"></select>
      <span id="sqManual" class="row" style="gap:6px" hidden><input type="number" id="sqBpm" min="40" max="200" aria-label="Tempo en BPM" style="width:80px"></span>
      <select id="sqStrum" aria-label="Rasgueo" style="flex:0 1 210px"></select>
      <span class="deck-tempo" id="sqTempoTop"></span><span id="sqTitle" hidden></span>
    </div>
    <div class="prog-chords" id="sqStrip"></div>
    <div id="sqHwy"></div>
    <div class="stage dstage" id="sqStage" aria-live="polite">
      <div class="meta">
        <span class="lab" id="sqLab">Listo</span>
        <div class="now"><span class="chordnow" id="sqNow"></span><span class="stage-chord" id="sqDiag"></span></div>
        <div class="beats" id="sqBeats" style="justify-content:flex-start"></div>
        <div class="sgrid stage-strum" id="sqStrumGrid" hidden></div>
        <span class="sub" id="sqSub"></span>
      </div>
      <div class="nextbox" id="sqNextBox"><span class="lab">Sigue</span><span class="nxt" id="sqNext"></span><span class="stage-chord" id="sqNextDiag"></span></div>
    </div>
    <div class="panel hl" id="sqResult" hidden>
      <div class="label" id="sqResLabel"></div>
      <div class="row"><div class="stepper"><button class="icon-btn" id="sqMinus" aria-label="Uno menos">−</button><input type="number" id="sqResN" min="0" max="400" value="0" aria-label="Cambios limpios"><button class="icon-btn" id="sqPlus" aria-label="Uno más">+</button></div>
      <button class="btn primary" id="sqSave">Guardar</button><button class="btn" id="sqDrop">Descartar</button></div>
    </div>
    <div class="deck-ctl">
      <label class="chip-toggle"><input type="checkbox" id="sqAuto"> Tempo automático</label>
      <label class="chip-toggle"><input type="checkbox" id="sqMic"> Calificar con micrófono</label>
      <label class="chip-toggle" id="sqGuideRow"><input type="checkbox" id="sqGuide"> Sonido guía</label>
      <button class="btn small ghost" id="sqCal">Micrófono y calibración</button>
      <select id="sqDur" aria-label="Duración de la ronda"><option value="1">1 minuto</option><option value="2">2 minutos</option><option value="3">3 minutos</option><option value="5">5 minutos</option><option value="10">10 minutos</option></select>
      <button class="btn primary" id="sqStart" data-primary>Empezar ronda</button>
    </div>
   </div>
  </div>
  </div>
  <div class="col">
  <div class="panel" id="sqStats"></div>
  <div class="panel" id="sqEditor"></div>
  </div>
  </div>`;
  hw = new Highway($("#sqHwy", el), { mode: "chords" });
  fb = new Feedback($("#sqStage", el));
  judge = new ChordJudge({ onResult: (s, st) => { hw.mark(s.id, st); if (P.run && s.isChange) fb.show(st); } });
  $("#sqPick", el).onchange = e => { if (P.run) return; data.ajustes.secId = e.target.value; save(); render(); };
  $("#sqAuto", el).onchange = e => { const q = cur(); q.auto = e.target.checked; save(); renderTempo(); idle(); };
  $("#sqMic", el).onchange = e => { data.ajustes.secMic = e.target.checked; save(); renderStats(); };
  $("#sqBpm", el).onchange = e => { const q = cur(); q.bpm = clampBpm(+e.target.value || q.bpm); e.target.value = q.bpm; save(); renderTempo(); idle(); };
  $("#sqStart", el).onclick = toggle;
  $("#sqStrum", el).onchange = e => { if (P.run) return; cur().rasgueo = e.target.value; save(); render(); };
  $("#sqGuide", el).onchange = e => { data.ajustes.secGuia = e.target.checked; save(); };
  const dur = $("#sqDur", el); dur.value = String(data.ajustes.secMin || 1);
  dur.onchange = () => { data.ajustes.secMin = +dur.value; save(); };
  $("#sqCal", el).onclick = () => { if (P.run) return; const q = cur(); openMicSettings({ chords: distinct(q), title: "Micrófono y calibración", onDone: () => renderStats() }); };
  const rn = $("#sqResN", el);
  $("#sqMinus", el).onclick = () => rn.value = Math.max(0, (+rn.value || 0) - 1);
  $("#sqPlus", el).onclick = () => rn.value = (+rn.value || 0) + 1;
  $("#sqDrop", el).onclick = () => { $("#sqResult", el).hidden = true; idle(); };
  $("#sqSave", el).onclick = saveRound;
  window.addEventListener("riff:stop-seq", () => P.run && stop(true));
  render();
}
export function showSecuencia(id) { if (P.run) return; if (list().some(q => q.id === id)) { data.ajustes.secId = id; save(); render(); } }

function render() {
  const q = cur(); if (!q) return;
  // Agrupa: primero tus secuencias y ejemplos, luego las de canciones
  const mine = list().filter(x => !x.cancion), songs = list().filter(x => x.cancion);
  const opt = x => `<option value="${x.id}" ${x.id === q.id ? "selected" : ""}>${esc(x.nombre)}</option>`;
  $("#sqPick", el).innerHTML = `${mine.length ? `<optgroup label="Progresiones">${mine.map(opt).join("")}</optgroup>` : ""}${songs.length ? `<optgroup label="Canciones">${songs.map(opt).join("")}</optgroup>` : ""}`;
  $("#sqTitle", el).textContent = q.nombre;
  // Rasgueo: el elegido para la secuencia o, si no hay, el sugerido de la canción ligada
  if (q.rasgueo === undefined) { const song = (data.canciones || []).find(s => s.id === q.cancion); q.rasgueo = song && song.rasgueo ? song.rasgueo : ""; }
  $("#sqStrum", el).innerHTML = `<option value="">Sin rasgueo (solo clic)</option>` + allPatterns().map(p => `<option value="${p.id}" ${q.rasgueo === p.id ? "selected" : ""}>Rasgueo: ${esc(p.nombre)}</option>`).join("");
  $("#sqGuideRow", el).hidden = !q.rasgueo; $("#sqGuide", el).checked = data.ajustes.secGuia !== false;
  $("#sqAuto", el).checked = q.auto !== false;
  $("#sqMic", el).checked = data.ajustes.secMic !== false;
  strip(-1); renderTempo(); idle(); renderStats(); renderEditor();
}
function strip(active) {
  const q = cur();
  $("#sqStrip", el).innerHTML = q.acordes.map((a, i) => `<span class="${i === active ? "on" : ""}">${esc(a.c)}<small>${a.t}</small></span>`).join("") || `<span class="muted">Sin acordes</span>`;
}
function renderTempo() {
  const q = cur(), auto = q.auto !== false;
  $("#sqManual", el).hidden = auto; $("#sqBpm", el).value = q.bpm;
  $("#sqTempoTop", el).innerHTML = auto ? `${q.bpm}<small>BPM</small>` : `<small>BPM</small>`;
}
function stageShow(name, next) {
  if ($("#sqNow", el).textContent !== (name || "—")) $("#sqDiag", el).innerHTML = name && CHORDS[name] ? diagram(name) : "";
  swapText($("#sqNow", el), name || "—");
  $("#sqNextBox", el).hidden = !next; $("#sqNext", el).textContent = next || "";
  $("#sqNextDiag", el).innerHTML = next && CHORDS[next] ? diagram(next) : "";
}
function idle() {
  const q = cur(), a0 = q.acordes[0], nx = q.acordes.find(a => a.c !== (a0 && a0.c));
  $("#sqStage", el).classList.remove("live");
  $("#sqLab", el).textContent = "Listo"; $("#sqBeats", el).innerHTML = "";
  stageShow(a0 && a0.c, nx && nx.c);
  strumGrid(q, -1);
  const ch = changesIn(q), total = q.acordes.reduce((s, a) => s + a.t, 0) || 1;
  $("#sqSub", el).textContent = distinct(q).length < 2 ? "Agrega al menos dos acordes distintos" :
    `${q.bpm} BPM · ${q.acordes.length} acordes · ${Math.round(ch * q.bpm / total)} cambios por minuto`;
  $("#sqStart", el).disabled = distinct(q).length < 2;
  if (!P.run && hw) {
    fb.reset();
    const beat = 60 / q.bpm, list = []; let t = 1, n = 0;
    while (q.acordes.length && t < 12 && n < 200) { const a = q.acordes[n % q.acordes.length]; list.push({ id: "p" + n, t0: t, t1: t + a.t * beat, label: a.c }); t += a.t * beat; n++; }
    hw.preview(list, strumHits(q, 1, 12, q.bpm, 0));
  }
}
// Patrón de rasgueo en grande dentro de la tarjeta: la casilla que suena se ilumina y la del siguiente golpe se marca
const COUNTS = { 2: ["", "y"], 3: ["", "y", "a"], 4: ["", "e", "y", "a"] };
function strumGrid(q, active) {
  const box = $("#sqStrumGrid", el), p = q.rasgueo ? patternById(q.rasgueo) : null;
  box.hidden = !p; $("#sqBeats", el).hidden = !!p;
  if (!p) return;
  if (box.dataset.pat !== p.id + p.p) {
    box.dataset.pat = p.id + p.p;
    box.style.setProperty("--n", p.p.length); box.style.setProperty("--half", p.p.length / 2);
    box.innerHTML = [...p.p].map((c, i) => { const sub = i % p.spb; return `<div class="scell ${c === "-" ? "rest" : ""} ${"DU".includes(c) ? "acc" : ""} ${c === "x" ? "mute" : ""} ${sub === 0 ? "beat" : ""}"><span class="sym">${STRUM_SYMBOL[c]}</span><span class="cnt">${sub === 0 ? Math.floor(i / p.spb) + 1 : COUNTS[p.spb][sub]}</span></div>`; }).join("");
  }
  const cells = box.children;
  let nextHit = -1;
  if (active >= 0) for (let j = 1; j <= p.p.length; j++) { const k = (active + j) % p.p.length; if (p.p[k] !== "-") { nextHit = k; break; } }
  for (let i = 0; i < cells.length; i++) { cells[i].classList.toggle("on", i === active); cells[i].classList.toggle("next", i === nextHit && i !== active); }
}
// Golpes del patrón de rasgueo a lo largo del tiempo, empezando en t0
function strumHits(q, t0, until, bpm, k0) {
  const p = q.rasgueo ? patternById(q.rasgueo) : null; if (!p) return [];
  const dt = 60 / bpm / p.spb, out = [];
  for (let k = k0 || 0, t = t0; t < until; k++, t += dt) { const c = p.p[k % p.p.length]; if (c !== "-") out.push({ id: "s" + k, t, c, sym: STRUM_SYMBOL[c], acc: "DU".includes(c) }); }
  return out;
}

/* ---------- Estadísticas ---------- */
function renderStats() {
  const q = cur(), h = (q.hist || []).slice(-20), box = $("#sqStats", el);
  const fallos = Object.entries(q.fallos || {}).filter(([, v]) => v[1] >= 3 && v[0] < v[1]).map(([k, v]) => ({ k, ok: v[0], tot: v[1], p: v[0] / v[1] })).sort((a, b) => a.p - b.p).slice(0, 3);
  let chart = `<div class="empty">Aún no hay rondas con esta secuencia. Cada ronda guardada aparece aquí con su tempo.</div>`;
  if (h.length) {
    const W = 340, H = 120, L = 30, R = 10, T = 12, B = 20, max = Math.max(...h.map(x => x.bpm)) + 10, min = Math.max(0, Math.min(...h.map(x => x.bpm)) - 10);
    const xs = i => h.length === 1 ? L + (W - L - R) / 2 : L + i * (W - L - R) / (h.length - 1), ys = v => T + (H - T - B) * (1 - (v - min) / (max - min));
    chart = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Tempo por ronda">
      ${[min, Math.round((min + max) / 2), max].map(v => `<line x1="${L}" x2="${W - R}" y1="${ys(v)}" y2="${ys(v)}" stroke="var(--line)"/><text x="${L - 5}" y="${ys(v) + 3}" font-size="9" text-anchor="end" fill="var(--muted)" font-family="JetBrains Mono,monospace">${v}</text>`).join("")}
      <polyline points="${h.map((x, i) => xs(i) + "," + ys(x.bpm)).join(" ")}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>
      ${h.map((x, i) => `<circle cx="${xs(i)}" cy="${ys(x.bpm)}" r="3.5" fill="${x.ratio >= .85 ? "var(--good)" : x.ratio < .7 ? "var(--warn)" : "var(--muted)"}"/>`).join("")}
      <text x="${L}" y="${H - 4}" font-size="9" fill="var(--muted)" font-family="Barlow,sans-serif">BPM por ronda · verde: subió, gris: igual, naranja: bajó</text></svg>`;
  }
  box.innerHTML = `<div class="label">Tu avance con esta secuencia</div>${chart}
    <p class="note">${q.auto !== false ? "Tempo automático: sube si 85% o más de los cambios salen limpios y a tiempo, se mantiene entre 70 y 85%, y baja si salen menos del 70%." : "Tempo fijo: cámbialo junto al selector de secuencia."}${data.ajustes.secMic !== false ? " La sensibilidad y la prueba de bocinas están en Micrófono y calibración." : ""}</p>
    ${(() => { const ds = distinct(q), ok = ds.filter(c => data.calibracion[c]); return `<p class="note"><b>Calibración:</b> ${ok.length === ds.length ? "todos los acordes de esta secuencia están calibrados." : `${ok.length} de ${ds.length} acordes calibrados${ds.length - ok.length ? ` (faltan ${ds.filter(c => !data.calibracion[c]).join(", ")})` : ""}.`}</p>`; })()}
    ${fallos.length ? `<div class="stack"><div class="label">Los cambios que más te cuestan</div>
      ${fallos.map(f => { const [a, b] = f.k.split("→"); return `<div class="row between"><span><b>${esc(a)} → ${esc(b)}</b> <span class="note">${Math.round(f.p * 100)}% limpios en ${f.tot} intentos</span></span>
        <button class="btn small" data-pair="${esc(a)}|${esc(b)}">Practicar este par</button></div>`; }).join("")}</div>` :
      (data.ajustes.secMic !== false ? (Object.keys(q.fallos || {}).length ? `<p class="note">Todos los cambios de esta secuencia te están saliendo limpios.</p>` : "") : `<p class="note">Con la calificación por micrófono, aquí verás qué cambio de la secuencia te cuesta más.</p>`)}`;
  box.querySelectorAll("[data-pair]").forEach(b => b.onclick = () => {
    const [a, c] = b.dataset.pair.split("|");
    window.dispatchEvent(new CustomEvent("riff:go", { detail: { view: "practicar", opts: { tab: "cambios", pair: [a, c], mode: "guia" } } }));
  });
}

/* ---------- Editor ---------- */
function renderEditor() {
  const q = cur(), box = $("#sqEditor", el);
  const opts = Object.keys(CHORDS).map(c => `<option>${esc(c)}</option>`).join("");
  const songs = (data.canciones || []).map(s => `<option value="${s.id}" ${q.cancion === s.id ? "selected" : ""}>${esc(s.titulo)}</option>`).join("");
  box.innerHTML = `
    <div class="row between"><div class="label">Editar secuencia</div>
      <div class="row"><button class="btn small" id="qNew">Nueva</button><button class="btn small" id="qDel">Borrar</button></div></div>
    <label class="field" for="qName">Nombre<input type="text" id="qName" maxlength="60" value="${esc(q.nombre)}"></label>
    <label class="field" for="qSong">Canción del repertorio (opcional)<select id="qSong"><option value="">Ninguna</option>${songs}</select></label>
    <div class="stack" style="gap:6px">
      <div class="label">Acordes en orden · t = tiempos</div>
      ${q.acordes.length ? `<ol class="seqlist">${q.acordes.map((a, i) => `
        <li><span class="num muted">${i + 1}</span><b>${esc(a.c)}</b>
          <select data-beats="${i}" aria-label="Tiempos de ${esc(a.c)}">${BEATS.map(b => `<option value="${b}" ${a.t === b ? "selected" : ""}>${b} t</option>`).join("")}${BEATS.includes(a.t) ? "" : `<option selected value="${a.t}">${a.t} t</option>`}</select>
          <span class="row" style="gap:4px;flex-wrap:nowrap">
            <button class="icon-btn sm" data-up="${i}" aria-label="Subir" ${i === 0 ? "disabled" : ""}>↑</button>
            <button class="icon-btn sm" data-down="${i}" aria-label="Bajar" ${i === q.acordes.length - 1 ? "disabled" : ""}>↓</button>
            <button class="icon-btn sm" data-rm="${i}" aria-label="Quitar ${esc(a.c)}">✕</button></span></li>`).join("")}</ol>` : `<div class="empty">Agrega los acordes de la canción en el orden en que suenan.</div>`}
    </div>
    <div class="row" style="flex-wrap:nowrap">
      <select id="qAddC" aria-label="Acorde para agregar" style="flex:1">${opts}</select>
      <select id="qAddT" aria-label="Tiempos">${BEATS.map(b => `<option value="${b}" ${b === 4 ? "selected" : ""}>${b} t</option>`).join("")}</select>
      <button class="btn small" id="qAdd">Agregar</button>
    </div>
    <details>
      <summary>Escribir la secuencia de una vez</summary>
      <div class="stack" style="margin-top:8px">
        <input type="text" id="qText" placeholder="G D Em C   o   G:2 C:2 D:4   o   A7 x4 D7 x2" aria-label="Secuencia escrita">
        <p class="note">Separa los acordes con espacios. Usa <span class="num">:2</span> para cambiar los tiempos y <span class="num">x4</span> para repetir.</p>
        <button class="btn small" id="qApply" style="align-self:flex-start">Reemplazar acordes</button>
      </div>
    </details>`;
  const mutate = fn => { if (P.run) { toast("Detén la ronda para editar"); return; } fn(); save(); strip(-1); idle(); renderEditor(); };
  $("#qName", box).onchange = e => mutate(() => { q.nombre = e.target.value.trim() || "Sin nombre"; $("#sqTitle", el).textContent = q.nombre; render(); });
  $("#qSong", box).onchange = e => mutate(() => q.cancion = e.target.value || null);
  box.querySelectorAll("[data-beats]").forEach(s => s.onchange = () => mutate(() => q.acordes[+s.dataset.beats].t = +s.value));
  box.querySelectorAll("[data-up]").forEach(b => b.onclick = () => mutate(() => { const i = +b.dataset.up; [q.acordes[i - 1], q.acordes[i]] = [q.acordes[i], q.acordes[i - 1]]; }));
  box.querySelectorAll("[data-down]").forEach(b => b.onclick = () => mutate(() => { const i = +b.dataset.down; [q.acordes[i + 1], q.acordes[i]] = [q.acordes[i], q.acordes[i + 1]]; }));
  box.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => mutate(() => q.acordes.splice(+b.dataset.rm, 1)));
  $("#qAdd", box).onclick = () => mutate(() => q.acordes.push({ c: $("#qAddC", box).value, t: +$("#qAddT", box).value }));
  $("#qApply", box).onclick = () => {
    const r = parseChords($("#qText", box).value);
    if (r.bad.length) { toast("No conozco: " + r.bad.join(", ")); return; }
    if (!r.acordes.length) { toast("Escribe al menos dos acordes"); return; }
    mutate(() => q.acordes = r.acordes);
  };
  $("#qNew", box).onclick = () => {
    if (P.run) return;
    const q2 = { id: "u" + Date.now(), nombre: "Mi secuencia", cancion: null, acordes: [], bpm: 60, auto: true, hist: [], fallos: {} };
    data.secuencias.push(q2); data.ajustes.secId = q2.id; save(); render();
    setTimeout(() => $("#qName", el)?.focus(), 0);
  };
  let armed = false;
  $("#qDel", box).onclick = e => {
    if (P.run) return;
    if (!armed) { armed = true; e.target.textContent = "¿Seguro?"; setTimeout(() => { armed = false; if (e.target.isConnected) e.target.textContent = "Borrar"; }, 3000); return; }
    data.secuencias = data.secuencias.filter(x => x.id !== q.id);
    if (!data.secuencias.length) data.secuencias.push({ id: "u" + Date.now(), nombre: "Mi secuencia", cancion: null, acordes: [], bpm: 60, auto: true, hist: [], fallos: {} });
    data.ajustes.secId = data.secuencias[0].id; save(); render(); toast("Secuencia borrada");
  };
}

/* ---------- Reproducción ---------- */
async function toggle() {
  if (P.run) { stop(true); return; }
  const a = A.ctx(); if (!a) return;
  const q = cur(); if (distinct(q).length < 2) return;
  P.listen = $("#sqMic", el).checked;
  if (P.listen) {
    if (!A.mic.an) { $("#sqLab", el).textContent = "Silencia las cuerdas"; $("#sqSub", el).textContent = "Midiendo el ruido del cuarto…"; }
    if (!(await A.micOn())) {
      if (!micWarned) { toast("Sin micrófono: la ronda sigue sin calificación automática"); micWarned = true; }
      P.listen = false;
    }
  }
  window.dispatchEvent(new Event("riff:stop-audio")); window.dispatchEvent(new Event("riff:stop-cambios")); window.dispatchEvent(new Event("riff:stop-rasgueo"));
  $("#sqResult", el).hidden = true;
  P.bpm = q.bpm; const beat = 60 / P.bpm;
  P.segs = []; let acc = 0;
  q.acordes.forEach((x, i) => { P.segs.push({ c: x.c, start: acc, len: x.t, i }); acc += x.t; });
  P.total = acc; P.names = distinct(q);
  P.t0 = a.currentTime + .1 + P.countIn * beat;   // compás de entrada
  P.next = a.currentTime + .1; P.k = -P.countIn; P.lastSeg = -1;
  // Línea de tiempo del minuto completo. El último acorde solo cuenta si cabe al menos la mitad.
  P.dur = (+$("#sqDur", el).value || 1) * 60; $("#sqDur", el).disabled = true;
  const end = P.t0 + P.dur, tl = []; let t = P.t0, n = 0, prev = null;
  while (true) {
    const s = P.segs[n % P.segs.length], len = s.len * beat;
    if (t + len * .5 > end) break;
    tl.push({ id: "q" + n, t0: t, t1: Math.min(t + len, end), c: s.c, i: s.i, isChange: prev !== null && prev !== s.c, from: prev });
    prev = s.c; t += len; n++;
  }
  P.timeline = tl; P.expected = tl.filter(s => s.isChange).length;
  hw.reset(); fb.reset();
  hw.addMany(tl.map(s => ({ id: s.id, t0: s.t0, t1: s.t1, label: s.c })));
  P.strums = strumHits(q, P.t0, end, P.bpm, 0); P.si = 0; P.lastSi = -1; P.guide = !!q.rasgueo && $("#sqGuide", el).checked;
  hw.setStrums(P.strums);
  if (P.guide && P.listen) warnGuideEcho();
  if (P.listen && q.rasgueo) { hw.tickOffset = data.ajustes.latenciaMic ?? .06; A.startOnsets(t => hw.tick(t, "hit")); }
  judge.setSegments(P.listen ? tl : []);
  hw.run(() => A.now());
  P.run = true; $("#sqStage", el).classList.add("live"); $("#sqStart", el).textContent = "Detener";
  $("#sqPick", el).disabled = true;
  P.tick = setInterval(tick, 40); A.keepAwake(true); tick();
}
function stop(cancel) {
  P.run = false; clearInterval(P.tick); A.keepAwake(false); hw.stop(); A.stopOnsets();
  $("#sqStart", el).textContent = "Empezar ronda"; $("#sqPick", el).disabled = false; $("#sqDur", el).disabled = false;
  if (cancel) { strip(-1); idle(); }
}
function segAt(beatIdx) {
  const p = ((beatIdx % P.total) + P.total) % P.total, loop = Math.floor(beatIdx / P.total);
  const s = P.segs.find(s => p >= s.start && p < s.start + s.len);
  return { s, loop, inSeg: p - s.start, abs: loop * P.segs.length + s.i };
}
function tick() {
  const a = A.ctx(), now = a.currentTime, beat = 60 / P.bpm, end = P.t0 + P.dur;
  // Clics: acento al inicio de cada acorde; la entrada usa otro tono
  while (P.next < now + .12 && P.next < end) {
    if (P.k < 0) A.beep(P.k === -P.countIn ? 1300 : 900, .05, P.next, .4);
    else { const g = segAt(P.k); A.click(g.inSeg === 0, P.next, P.guide ? .5 : 1); }
    P.next += beat; P.k++;
  }
  // Sonido guía: toca el rasgueo con el acorde que corresponde a cada golpe
  if (P.guide) {
    const p = patternById(cur().rasgueo), dt = 60 / P.bpm / (p ? p.spb : 2);
    while (P.si < P.strums.length && P.strums[P.si].t < now + .12) {
      const st = P.strums[P.si++], seg = P.timeline.find(s => st.t >= s.t0 - .001 && st.t < s.t1);
      if (seg && CHORDS[seg.c]) playHit(st.c, CHORDS[seg.c].f, st.t, dt);
    }
  }
  // Micrófono: cada cuadro se compara con los acordes de la secuencia
  if (P.listen && now >= P.t0 - .2) {
    const lab = classify(A.chroma(), P.names);
    judge.frame(now, lab);
    if (lab) { const tc = now - .12, exp = P.timeline.find(s => tc >= s.t0 && tc < s.t1); hw.heard(tc - .03, tc + .03, lab, !!exp && exp.c === lab); }
  }
  if (now < P.t0) {
    const n = Math.min(P.countIn, Math.floor((now - (P.t0 - P.countIn * beat)) / beat) + 1);
    $("#sqLab", el).textContent = "Entrada";
    if (P.lastSeg !== -2) { P.lastSeg = -2; stageShow(P.segs[0].c, P.segs.find(s => s.c !== P.segs[0].c)?.c); }
    $("#sqSub", el).textContent = `Empieza en ${P.countIn - Math.max(1, n) + 1}…`; return;
  }
  const el2 = now - P.t0, left = Math.max(0, P.dur - el2), b = Math.floor(el2 / beat), g = segAt(b);
  if (g.abs !== P.lastSeg) {
    P.lastSeg = g.abs; strip(g.s.i);
    let j = 1, nx = P.segs[(g.s.i + 1) % P.segs.length];
    while (nx.c === g.s.c && j < P.segs.length) { j++; nx = P.segs[(g.s.i + j) % P.segs.length]; }
    stageShow(g.s.c, nx.c !== g.s.c ? nx.c : null);
  }
  if (P.strums && P.strums.length) {
    const p = patternById(cur().rasgueo), dt = 60 / P.bpm / p.spb, k = Math.floor((now - P.t0) / dt + 1e-6), i = ((k % p.p.length) + p.p.length) % p.p.length;
    if (i !== P.lastSi) { P.lastSi = i; strumGrid(cur(), i); }
  }
  $("#sqLab", el).textContent = left >= 60 ? `Quedan ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}` : `Quedan ${Math.ceil(left)} s`;
  $("#sqBeats", el).innerHTML = Array.from({ length: g.s.len }, (_, i) => `<i class="${i === g.inSeg ? "on" : ""} ${i === 0 ? "acc" : ""}"></i>`).join("");
  $("#sqSub", el).textContent = `${P.bpm} BPM`;
  if (left <= 0) finish();
}
function finish() {
  if (P.listen) judge.flush(P.t0 + P.dur);
  stop(false); A.chime();
  $("#sqStage", el).classList.remove("live"); $("#sqLab", el).textContent = "¡Tiempo!"; $("#sqBeats", el).innerHTML = ""; strip(-1);
  $("#sqSub", el).textContent = fb.best ? `Mejor racha: ${fb.best}` : "";
  P.results = P.listen ? judge.segs.filter(s => s.isChange).map(s => ({ from: s.from, to: s.c, ok: s.status === "ok" })) : [];
  const rn = $("#sqResN", el), rl = $("#sqResLabel", el), exp = Math.max(0, P.expected);
  if (P.listen) {
    const ok = P.results.filter(r => r.ok).length;
    rn.value = Math.min(ok, exp);
    rl.textContent = `El micrófono escuchó ${Math.min(ok, exp)} de ${exp} cambios limpios y a tiempo a ${P.bpm} BPM. Corrige el número si hace falta.`;
  } else { rn.value = exp; rl.textContent = `Hubo ${exp} cambios a ${P.bpm} BPM. ¿Cuántos salieron limpios y a tiempo?`; }
  $("#sqResult", el).hidden = false;
}
function saveRound() {
  const q = cur(), exp = Math.max(1, P.expected), n = Math.max(0, Math.round(+$("#sqResN", el).value || 0));
  const ratio = Math.min(1, n / exp), pct = Math.round(ratio * 100), t = new Date().toISOString();
  q.hist = [...(q.hist || []), { t, bpm: P.bpm, ratio: Math.round(ratio * 100) / 100 }].slice(-60);
  if (P.listen) { q.fallos = q.fallos || {}; P.results.forEach(r => { const k = r.from + "→" + r.to, v = q.fallos[k] || [0, 0]; v[0] += r.ok ? 1 : 0; v[1]++; q.fallos[k] = v; }); }
  let msg = `Guardado: ${pct}% limpios.`;
  if (q.auto !== false) {
    const nb = nextBpm(P.bpm, ratio); q.bpm = nb;
    msg = nb > P.bpm ? `${pct}% limpios. ¡Sube a ${nb} BPM!` : nb < P.bpm ? `${pct}% limpios. Bajamos a ${nb} BPM para afianzar` : `${pct}% limpios. Repite a ${nb} BPM`;
  }
  save(); toast(msg);
  $("#sqResult", el).hidden = true; renderTempo(); idle(); renderStats();
}
