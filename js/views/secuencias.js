// Secuencias de acordes: arma la progresión de una canción y practica los cambios en orden, con clic,
// tempo automático y calificación por micrófono acorde por acorde.
import { data, save, toast, esc, $ } from "../store.js";
import { CHORDS, diagram } from "../chords.js";
import * as A from "../audio.js";
import { classify } from "../detect.js";

let el;
const BEATS = [1, 2, 3, 4, 6, 8];
const P = { run: false, tick: null, t0: 0, beat: 0, next: 0, k: 0, segs: [], total: 0, bpm: 70, lastSeg: -1, votes: null, results: [], listen: false, expected: 0, countIn: 4 };

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
  if (Array.isArray(data.secuencias)) return;
  data.secuencias = PRESETS.map((p, i) => {
    const song = (data.canciones || []).find(s => s.titulo === p.cancion);
    return { id: "q" + i, nombre: p.nombre, cancion: song ? song.id : null, acordes: parseChords(p.acordes).acordes, bpm: p.bpm, auto: true, hist: [], fallos: {} };
  });
  save();
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
export function mountSecuencias(container) {
  el = container; ensure();
  el.innerHTML = `
  <div class="cols" style="--cols:minmax(0,1.3fr) minmax(0,1fr)">
  <div class="col">
  <div class="panel">
    <div class="row between" style="align-items:flex-start">
      <div style="min-width:0"><div class="label">Secuencia</div><h2 id="sqTitle"></h2></div>
      <select id="sqPick" aria-label="Elegir secuencia" style="max-width:220px"></select>
    </div>
    <div class="prog-chords" id="sqStrip"></div>
    <div class="stage" id="sqStage" aria-live="polite">
      <span class="lab" id="sqLab">Listo</span>
      <span class="chordnow" id="sqNow"></span>
      <div class="beats" id="sqBeats"></div>
      <span class="sub" id="sqNext"></span>
    </div>
    <div class="chords" id="sqDiag" style="justify-content:center"></div>
    <label class="switch"><input type="checkbox" id="sqAuto"> Tempo automático: sube conforme mejoras</label>
    <div id="sqTempo"></div>
    <label class="switch"><input type="checkbox" id="sqMic"> Calificar con el micrófono, acorde por acorde</label>
    <p class="note" id="sqMicNote" hidden>Usa la sensibilidad y la calibración de acordes de la pestaña Cambios, modo Escuchar.</p>
    <button class="btn primary block" id="sqStart" data-primary>Empezar ronda de 1 minuto</button>
    <div class="panel hl" id="sqResult" hidden>
      <div class="label" id="sqResLabel"></div>
      <div class="stepper"><button class="icon-btn" id="sqMinus" aria-label="Uno menos">−</button><input type="number" id="sqResN" min="0" max="400" value="0" aria-label="Cambios limpios"><button class="icon-btn" id="sqPlus" aria-label="Uno más">+</button></div>
      <div class="row"><button class="btn primary" id="sqSave">Guardar</button><button class="btn" id="sqDrop">Descartar</button></div>
    </div>
  </div>
  <div class="panel" id="sqStats"></div>
  </div>
  <div class="col">
  <div class="panel" id="sqEditor"></div>
  </div>
  </div>`;
  $("#sqPick", el).onchange = e => { if (P.run) return; data.ajustes.secId = e.target.value; save(); render(); };
  $("#sqAuto", el).onchange = e => { const q = cur(); q.auto = e.target.checked; save(); renderTempo(); idle(); };
  $("#sqMic", el).onchange = e => { data.ajustes.secMic = e.target.checked; save(); $("#sqMicNote", el).hidden = !e.target.checked; };
  $("#sqStart", el).onclick = toggle;
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
  $("#sqPick", el).innerHTML = list().map(x => `<option value="${x.id}" ${x.id === q.id ? "selected" : ""}>${esc(x.nombre)}</option>`).join("");
  $("#sqTitle", el).textContent = q.nombre;
  $("#sqAuto", el).checked = q.auto !== false;
  $("#sqMic", el).checked = !!data.ajustes.secMic; $("#sqMicNote", el).hidden = !data.ajustes.secMic;
  strip(-1); renderTempo(); idle(); renderStats(); renderEditor();
}
function strip(active) {
  const q = cur();
  $("#sqStrip", el).innerHTML = q.acordes.map((a, i) => `<span class="${i === active ? "on" : ""}">${esc(a.c)}<small>${a.t}</small></span>`).join("") || `<span class="muted">Sin acordes</span>`;
}
function renderTempo() {
  const q = cur(), box = $("#sqTempo", el);
  if (q.auto !== false) {
    box.innerHTML = `<div class="row between" style="align-items:flex-end">
      <div><div class="label">Tempo de entrenamiento</div><div class="big" style="font-size:2.4rem">${q.bpm}<span style="font-size:1rem;color:var(--muted)"> BPM</span></div></div>
      <p class="note" style="max-width:260px;text-align:right">Sube si 85% o más de los cambios salen limpios y a tiempo; baja si salen menos del 70%.</p></div>`;
  } else {
    box.innerHTML = `<div class="row"><label class="field" for="sqBpm" style="flex:1">Tempo (BPM)<input type="number" id="sqBpm" min="40" max="200" value="${q.bpm}"></label></div>`;
    $("#sqBpm", el).onchange = e => { q.bpm = clampBpm(+e.target.value || q.bpm); e.target.value = q.bpm; save(); idle(); };
  }
}
function idle() {
  const q = cur(), a0 = q.acordes[0], a1 = q.acordes[1];
  $("#sqStage", el).classList.remove("live");
  $("#sqLab", el).textContent = "Listo";
  $("#sqNow", el).textContent = a0 ? a0.c : "—";
  $("#sqBeats", el).innerHTML = "";
  const ch = changesIn(q);
  $("#sqNext", el).textContent = distinct(q).length < 2 ? "Agrega al menos dos acordes distintos" :
    `${q.bpm} BPM · ${q.acordes.length} acordes · ${Math.round(ch * 60 * q.bpm / 60 / q.acordes.reduce((s, a) => s + a.t, 0))} cambios por minuto`;
  $("#sqDiag", el).innerHTML = (a0 ? diagram(a0.c) : "") + (a1 && a1.c !== a0.c ? diagram(a1.c) : "");
  $("#sqStart", el).disabled = distinct(q).length < 2;
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
    ${fallos.length ? `<div class="stack"><div class="label">Los cambios que más te cuestan</div>
      ${fallos.map(f => { const [a, b] = f.k.split("→"); return `<div class="row between"><span><b>${esc(a)} → ${esc(b)}</b> <span class="note">${Math.round(f.p * 100)}% limpios en ${f.tot} intentos</span></span>
        <button class="btn small" data-pair="${esc(a)}|${esc(b)}">Practicar este par</button></div>`; }).join("")}</div>` :
      (data.ajustes.secMic ? (Object.keys(q.fallos || {}).length ? `<p class="note">Todos los cambios de esta secuencia te están saliendo limpios.</p>` : "") : `<p class="note">Con la calificación por micrófono, aquí verás qué cambio de la secuencia te cuesta más.</p>`)}`;
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
    if (!A.mic.an) { $("#sqLab", el).textContent = "Silencia las cuerdas"; $("#sqNext", el).textContent = "Midiendo el ruido del cuarto…"; }
    if (!(await A.micOn())) { toast(A.mic.error || "No se pudo usar el micrófono"); idle(); return; }
  }
  window.dispatchEvent(new Event("riff:stop-audio"));
  $("#sqResult", el).hidden = true;
  P.bpm = q.bpm; const beat = 60 / P.bpm;
  P.segs = []; let acc = 0;
  q.acordes.forEach((x, i) => { P.segs.push({ c: x.c, start: acc, len: x.t, i }); acc += x.t; });
  P.total = acc; P.names = distinct(q);
  P.t0 = a.currentTime + .1 + P.countIn * beat;   // compás de entrada
  P.next = a.currentTime + .1; P.k = -P.countIn;
  P.lastSeg = -1; P.results = []; P.votes = null; P.expected = 0;
  P.run = true; $("#sqStage", el).classList.add("live"); $("#sqStart", el).textContent = "Detener";
  $("#sqPick", el).disabled = true;
  P.tick = setInterval(tick, 40); A.keepAwake(true); tick();
}
function stop(cancel) {
  P.run = false; clearInterval(P.tick); A.keepAwake(false);
  $("#sqStart", el).textContent = "Empezar ronda de 1 minuto"; $("#sqPick", el).disabled = false;
  if (cancel) { strip(-1); idle(); }
}
function segAt(beatIdx) {
  const p = ((beatIdx % P.total) + P.total) % P.total, loop = Math.floor(beatIdx / P.total);
  const s = P.segs.find(s => p >= s.start && p < s.start + s.len);
  return { s, loop, inSeg: p - s.start, abs: loop * P.segs.length + s.i };
}
function tick() {
  const a = A.ctx(), now = a.currentTime, beat = 60 / P.bpm, end = P.t0 + 60;
  // Programa clics: acento al inicio de cada acorde; la entrada usa otro tono
  while (P.next < now + .12 && P.next < end) {
    if (P.k < 0) A.beep(P.k === -P.countIn ? 1300 : 900, .05, P.next, .4);
    else { const g = segAt(P.k); A.click(g.inSeg === 0, P.next); }
    P.next += beat; P.k++;
  }
  if (now < P.t0) {
    const n = Math.min(P.countIn, Math.floor((now - (P.t0 - P.countIn * beat)) / beat) + 1);
    $("#sqLab", el).textContent = "Entrada"; $("#sqNow", el).textContent = Math.max(1, n);
    $("#sqNext", el).textContent = "Primero: " + P.segs[0].c; return;
  }
  const el2 = now - P.t0, left = Math.max(0, 60 - el2), b = Math.floor(el2 / beat), g = segAt(b);
  // Votación del micrófono dentro del acorde que suena (desde el 25% de su duración)
  if (g.abs !== P.lastSeg) {
    closeSegment();
    const prevC = P.lastSeg >= 0 ? P.curC : null;
    P.lastSeg = g.abs; P.curC = g.s.c; P.isChange = prevC !== null && prevC !== g.s.c; P.from = prevC;
    if (P.isChange) P.expected++;
    P.votes = { hit: 0, n: 0 }; P.segStartT = P.t0 + b * beat - g.inSeg * beat; P.segLen = g.s.len * beat;
    strip(g.s.i);
    const nx = P.segs[(g.s.i + 1) % P.segs.length];
    $("#sqNow", el).textContent = g.s.c;
    $("#sqDiag", el).innerHTML = diagram(g.s.c) + (nx.c !== g.s.c ? diagram(nx.c) : "");
  }
  if (P.listen && now - P.segStartT > P.segLen * .25) {
    const lab = classify(A.chroma(), P.names);
    if (lab) { P.votes.n++; if (lab === P.curC) P.votes.hit++; }
  }
  const nx = P.segs[(g.s.i + 1) % P.segs.length];
  $("#sqLab", el).textContent = `Quedan ${Math.ceil(left)} s`;
  $("#sqBeats", el).innerHTML = Array.from({ length: g.s.len }, (_, i) => `<i class="${i === g.inSeg ? "on" : ""} ${i === 0 ? "acc" : ""}"></i>`).join("");
  $("#sqNext", el).textContent = "Sigue: " + nx.c;
  if (left <= 0) finish();
}
function closeSegment() {
  if (!P.votes || !P.isChange) return;
  const ok = P.votes.n >= 2 && P.votes.hit / P.votes.n >= .5;
  P.results.push({ from: P.from, to: P.curC, ok });
}
function finish() {
  // El acorde que suena al terminar el minuto solo cuenta si ya pasó la mitad de su duración
  if (P.votes && P.isChange && A.now() - P.segStartT < P.segLen * .5) { P.expected--; P.votes = null; }
  closeSegment();
  stop(false); A.chime();
  $("#sqStage", el).classList.remove("live"); $("#sqLab", el).textContent = "¡Tiempo!"; $("#sqBeats", el).innerHTML = ""; strip(-1);
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
