// Tabs y riffs: importa tabs de Guitar Pro / MusicXML o pega tabs de texto, y apréndelas nota por nota.
// En modo Aprender la app muestra una nota (o acorde) a la vez y espera a escucharla por el micrófono antes de
// pasar a la siguiente. "Escuchar" toca la sección con guitarra sintetizada a la velocidad que elijas.
// Las tabs importadas se guardan solo en este dispositivo.
import { data, save, tabs, saveTabs, toast, esc, logSession, $ } from "../store.js";
import * as A from "../audio.js";
import { parseTextTab, stdTuning } from "../tabs/texto.js";
import { loadAlphaTab, readScore, listTracks, guessTrack, trackToTab, tuningLabel } from "../tabs/gp.js";
import { TabStaff, fretMini, noteName, pcName, stringName } from "../ui/tabstaff.js";
import { Feedback, swapText } from "../ui/highway.js";
import { openMicSettings, sheet, close as closeSheet } from "../ui/calib.js";

/* ---------- Ejercicios incluidos (material de práctica general, escrito para Riff) ---------- */
const EJERCICIOS = [
  { id: "ej-penta", titulo: "Pentatónica de La menor", artista: "Ejercicio · posición 1", texto: `
[Subiendo]
e|-----------------------5-8-|
B|-------------------5-8-----|
G|---------------5-7---------|
D|-----------5-7-------------|
A|-------5-7-----------------|
E|---5-8---------------------|
[Bajando]
e|-8-5-----------------------|
B|-----8-5-------------------|
G|---------7-5---------------|
D|-------------7-5-----------|
A|-----------------7-5-------|
E|---------------------8-5---|` },
  { id: "ej-arpegios", titulo: "Arpegios G, C, D y Em", artista: "Ejercicio · acordes abiertos", texto: `
[Arpegios]
e|-----------3-------|-----------0-------|---------2-------|-----------0-------|
B|---------0---0-----|---------1---1-----|-------3---3-----|---------0---0-----|
G|-------0-------0---|-------0-------0---|-----2-------2---|-------0-------0---|
D|-----0-----------0-|-----2-----------2-|---0-----------0-|-----2-----------2-|
A|-------------------|---3---------------|-----------------|-------------------|
E|---3---------------|-------------------|-----------------|---0---------------|` },
  { id: "ej-riff-e", titulo: "Riff de rock en Mi", artista: "Ejercicio · cuerdas graves", texto: `
[Riff]
e|-----------------|-----------------|
B|-----------------|-----------------|
G|-----------------|-----------------|
D|-----------------|---------2-0-----|
A|-------0-2-3-----|-0-2-3-------2-0-|
E|-0-0-3---------0-|-----------------|` },
  { id: "ej-legato", titulo: "Ligados en La menor", artista: "Ejercicio · hammer-on y pull-off", texto: `
[Hammer-on]
e|-----------------------5h8-|
B|-------------------5h8-----|
G|---------------5h7---------|
D|-----------5h7-------------|
A|-------5h7-----------------|
E|---5h8---------------------|
[Pull-off]
e|-8p5-----------------------|
B|-----8p5-------------------|
G|---------7p5---------------|
D|-------------7p5-----------|
A|-----------------7p5-------|
E|---------------------8p5---|` },
];
let builtins = null;
function builtinTabs() {
  if (!builtins) builtins = EJERCICIOS.map(x => Object.assign(parseTextTab(x.texto, { titulo: x.titulo, artista: x.artista }).tab, { id: x.id, ejercicio: true, tempo: 70 }));
  return builtins;
}
const allTabs = () => [...tabs, ...builtinTabs()];
const curTab = () => allTabs().find(t => t.id === data.ajustes.tabId) || allTabs()[0];
const prog = t => { data.tabsProg = data.tabsProg || {}; return (data.tabsProg[t.id] = data.tabsProg[t.id] || {}); };
const isStd = t => stdTuning(t.cuerdas).every((m, k) => m === t.afin[k]);
const median = a => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };

/* ---------- Secciones y rango ---------- */
function sections(t) {
  const out = []; const N = t.compases.length;
  t.compases.forEach((c, k) => { if (c.sec) out.push({ a: k, name: c.sec }); });
  out.forEach((s, k) => s.b = (out[k + 1]?.a ?? N) - 1);
  return out.filter(s => t.ev.some(e => e.c >= s.a && e.c <= s.b));
}
function range(t) {
  const p = prog(t), N = t.compases.length;
  let a = p.sel?.a ?? 0, b = p.sel?.b ?? N - 1;
  a = Math.max(0, Math.min(N - 1, a)); b = Math.max(a, Math.min(N - 1, b));
  let from = t.ev.findIndex(e => e.c >= a), to = -1;
  for (let i = t.ev.length - 1; i >= 0; i--) if (t.ev[i].c <= b) { to = i; break; }
  if (from < 0 || to < from) { from = 0; to = t.ev.length - 1; a = 0; b = N - 1; }
  return { a, b, from, to, key: `b${a}-${b}` };
}

/* ---------- Montaje ---------- */
let el, staff, fb;
export function mountTabs(container) {
  el = container;
  el.innerHTML = `
  <div class="cols" style="--cols:minmax(0,1.5fr) minmax(0,1fr)">
  <div class="col">
  <div class="panel deck-panel screen">
   <div class="deck">
    <div class="deck-top">
      <select id="tbPick" aria-label="Elegir tab"></select>
      <select id="tbSec" aria-label="Sección" style="flex:0 1 230px"></select>
      <span id="tbBars" class="row" style="gap:6px" hidden><input type="number" id="tbA" min="1" aria-label="Desde el compás" style="width:70px"><span class="note">a</span><input type="number" id="tbB" min="1" aria-label="Hasta el compás" style="width:70px"></span>
      <span class="deck-tempo" id="tbTempo"></span>
    </div>
    <div id="tbStaffBox"></div>
    <div class="stage dstage tbstage" id="tbStage" aria-live="polite">
      <div class="meta">
        <span class="lab" id="tbLab">Listo</span>
        <div class="now"><button class="tbnote" id="tbNow" title="Escuchar esta nota"></button><span class="tbwhere" id="tbWhere"></span></div>
        <div class="lmeter" id="tbMatch"><span>Escucho</span><div class="bar"><div id="tbMatchBar"></div></div><b id="tbHeard">–</b></div>
        <span class="sub" id="tbSub"></span>
      </div>
      <div class="tbfret" id="tbFret"></div>
    </div>
    <div class="lprog" id="tbProg"></div>
    <div class="deck-ctl">
      <label class="chip-toggle" title="Avanza solo cuando el micrófono escucha la nota"><input type="checkbox" id="tbMic"> Micrófono</label>
      <label class="chip-toggle" title="Al terminar la sección, vuelve a empezar"><input type="checkbox" id="tbLoop"> Repetir</label>
      <select id="tbSpeed" aria-label="Velocidad al escuchar"><option value="0.5">50%</option><option value="0.75">75%</option><option value="1">100%</option></select>
      <button class="btn small" id="tbListen">Escuchar</button>
      <span class="tbtune" id="tbTune" hidden></span>
      <button class="icon-btn" id="tbCal" aria-label="Ajustes del micrófono" title="Ajustes del micrófono"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg></button>
      <button class="btn small" id="tbSkip" hidden>Saltar nota</button>
      <button class="btn primary" id="tbStart" data-primary>Empezar a aprender</button>
    </div>
   </div>
  </div>
  </div>
  <div class="col">
  <div class="panel" id="tbLib"></div>
  <div class="panel" id="tbImport"></div>
  </div>
  </div>`;
  staff = new TabStaff($("#tbStaffBox", el), { onPick: i => jumpTo(i) });
  fb = new Feedback($("#tbStage", el));
  $("#tbPick", el).onchange = e => { stopAll(); data.ajustes.tabId = e.target.value; save(); render(); };
  $("#tbSec", el).onchange = e => {
    stopAll(); const t = curTab(), p = prog(t), v = e.target.value;
    if (v === "all") p.sel = null;
    else if (v === "custom") { const r = range(t); p.sel = { a: r.a, b: r.b, custom: true }; }
    else { const [a, b] = v.split("-").map(Number); p.sel = { a, b }; }
    p.pos = null; save(); render();
  };
  const onBars = () => { stopAll(); const t = curTab(), p = prog(t), N = t.compases.length; const a = Math.max(1, Math.min(N, +$("#tbA", el).value || 1)), b = Math.max(a, Math.min(N, +$("#tbB", el).value || a)); p.sel = { a: a - 1, b: b - 1, custom: true }; p.pos = null; save(); render(); };
  $("#tbA", el).onchange = onBars; $("#tbB", el).onchange = onBars;
  $("#tbMic", el).onchange = e => { data.ajustes.tabMic = e.target.checked; save(); };
  $("#tbLoop", el).onchange = e => { data.ajustes.tabLoop = e.target.checked; save(); };
  $("#tbSpeed", el).onchange = e => { data.ajustes.tabSpeed = +e.target.value; save(); if (PL.run) { stopListen(); listen(); } };
  $("#tbListen", el).onclick = () => PL.run ? stopListen() : listen();
  $("#tbStart", el).onclick = () => L.run ? learnStop() : learnStart();
  $("#tbSkip", el).onclick = () => { if (L.run) advance(!L.mic); };
  $("#tbNow", el).onclick = () => { const t = curTab(); if (t) playEvent(t, t.ev[cursor()], A.ctx() && A.now() + .02); };
  $("#tbCal", el).onclick = () => openMicSettings({ title: "Micrófono" });
  document.addEventListener("keydown", e => {
    if (el.offsetParent === null || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest("input,select,textarea,[contenteditable]")) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") { if (el.contains(e.target)) return; jumpTo(cursor() + (e.key === "ArrowRight" ? 1 : -1)); e.preventDefault(); }
  });
  window.addEventListener("riff:stop-audio", () => { if (PL.run) stopListen(); });
  window.addEventListener("riff:stop-tabs", () => stopAll());
  renderImport();
  render();
}
export function showTab(id) { if (allTabs().some(t => t.id === id)) { stopAll(); data.ajustes.tabId = id; save(); render(); } }
export function stopTabs() { stopAll(); }
function stopAll() { if (L.run) learnStop(); if (PL.run) stopListen(); }

/* ---------- Pintar ---------- */
function render() {
  const t = curTab();
  const pick = $("#tbPick", el);
  const mine = tabs.map(x => `<option value="${esc(x.id)}">${esc(x.titulo)}${x.pista && x.fuente === "gp" ? " · " + esc(x.pista) : ""}</option>`).join("");
  const ej = builtinTabs().map(x => `<option value="${esc(x.id)}">${esc(x.titulo)}</option>`).join("");
  pick.innerHTML = (mine ? `<optgroup label="Tus tabs">${mine}</optgroup>` : "") + `<optgroup label="Ejercicios">${ej}</optgroup>`;
  pick.value = t.id;
  $("#tbMic", el).checked = data.ajustes.tabMic !== false;
  $("#tbLoop", el).checked = !!data.ajustes.tabLoop;
  $("#tbSpeed", el).value = String(data.ajustes.tabSpeed || .75);
  const r = range(t), secs = sections(t), p = prog(t);
  const sel = $("#tbSec", el), N = t.compases.length;
  sel.innerHTML = `<option value="all">Toda (${N} ${N === 1 ? "compás" : "compases"})</option>` +
    secs.map(s => `<option value="${s.a}-${s.b}">${esc(s.name)} · ${s.a === s.b ? "compás " + (s.a + 1) : "compases " + (s.a + 1) + "–" + (s.b + 1)}</option>`).join("") +
    `<option value="custom">Elegir compases…</option>`;
  sel.value = !p.sel ? "all" : p.sel.custom ? "custom" : `${p.sel.a}-${p.sel.b}`;
  if (!sel.value) sel.value = "custom";
  $("#tbBars", el).hidden = sel.value !== "custom";
  $("#tbA", el).value = r.a + 1; $("#tbB", el).value = r.b + 1; $("#tbA", el).max = $("#tbB", el).max = N;
  $("#tbTempo", el).innerHTML = t.tempo ? `${t.tempo}<small>BPM</small>` : "";
  // afinación
  const tune = $("#tbTune", el);
  if (!isStd(t)) {
    tune.hidden = false;
    const tl = tuningName(t);
    tune.innerHTML = `<select id="tbTuneSel" aria-label="Afinación de tu guitarra" title="La tab está en ${esc(tl.long)}"><option value="tab">Guitarra ${esc(tl.short)} (como la tab)</option><option value="std">Guitarra en afinación estándar</option></select>`;
    const ts = $("#tbTuneSel", tune); ts.value = p.afin === "std" ? "std" : "tab";
    ts.onchange = () => { p.afin = ts.value; save(); staff.setLabels(viewTuning(t)); show(); };
  } else tune.hidden = true;
  staff.set(t, r.from, r.to); staff.setLabels(viewTuning(t));
  let pos = p.pos != null && p.pos >= r.from && p.pos <= r.to ? p.pos : r.from;
  L.view = pos; staff.setCursor(pos, true);
  show(); renderProgIdle(); renderLib();
}
const cursor = () => L.run ? L.idx : (L.view ?? 0);
function jumpTo(i) {
  const t = curTab(), r = range(t); i = Math.max(r.from, Math.min(r.to, i));
  if (L.run) { L.idx = i; L.tPrompt = performance.now(); L.tcAudio = A.now(); L.good = 0; L.goodSince = 0; L.first = true; }
  else { L.view = i; prog(t).pos = i; }
  staff.setCursor(i); show();
}
// Nota MIDI que debe sonar con la afinación de tu guitarra
function target(t, n) {
  if (prog(t).afin === "std" && !isStd(t)) return n[2] - t.afin[n[0]] + stdTuning(t.cuerdas)[n[0]];
  return n[2];
}
const viewTuning = t => prog(t).afin === "std" && !isStd(t) ? stdTuning(t.cuerdas) : t.afin;
function stringLabel(t, s) { return `cuerda ${s + 1} · ${stringName(viewTuning(t), s)}`; }
function tuningName(t) {
  const std = stdTuning(t.cuerdas), d = t.afin.map((m, k) => m - std[k]);
  if (d.every(x => x === -1)) return { short: "½ tono abajo", long: "Mi bemol (medio tono abajo)" };
  if (d.every(x => x === -2)) return { short: "un tono abajo", long: "Re (un tono abajo)" };
  if (d.slice(0, -1).every(x => x === 0) && d[d.length - 1] === -2) return { short: "Drop D", long: "Drop D (6ª cuerda en Re)" };
  if (d.slice(0, -1).every(x => x === -1) && d[d.length - 1] === -3) return { short: "Drop C#", long: "Drop C# (medio tono abajo y 6ª en Do#)" };
  return { short: tuningLabel(t.afin), long: tuningLabel(t.afin) };
}
function show() {
  const t = curTab(), i = cursor(), e = t.ev[i], nx = t.ev[i + 1], r = range(t);
  if (!e) return;
  const playable = e.n.filter(n => !n[3].includes("x"));
  const now = $("#tbNow", el), where = $("#tbWhere", el);
  if (e.n.length === 1) {
    const n = e.n[0];
    swapText(now, n[3].includes("x") ? "×" : String(n[1]));
    where.innerHTML = `<b>${esc(stringLabel(t, n[0]))}</b><span>${n[3].includes("x") ? "Nota apagada: rasguea con la mano encima de las cuerdas" : "Suena " + esc(noteName(target(t, n)))}${techText(n[3])}</span>`;
  } else {
    swapText(now, playable.length ? `${e.n.length} notas` : "×");
    where.innerHTML = `<b>${e.n.map(n => `<span class="tbchip">${stringName(viewTuning(t), n[0])}<i>${n[3].includes("x") ? "×" : n[1]}</i></span>`).join("")}</b><span>Toca las ${e.n.length} cuerdas juntas${techText(e.n.map(n => n[3]).join(""))}</span>`;
  }
  now.classList.toggle("multi", e.n.length > 1);
  $("#tbFret", el).innerHTML = fretMini(t, e.n, nx && i < r.to ? nx.n : []);
  $("#tbSub", el).textContent = `Compás ${e.c + 1} · nota ${i - r.from + 1} de ${r.to - r.from + 1}`;
}
function techText(fl) {
  const out = [];
  if (fl.includes("H")) out.push("ligada (sin atacar)"); else if (fl.includes("h")) out.push("luego hammer-on o pull-off");
  if (fl.includes("/")) out.push("luego desliza"); if (fl.includes("S")) out.push("llega deslizando");
  if (fl.includes("b")) out.push("con bend"); if (fl.includes("m")) out.push("palm mute"); if (fl.includes("~")) out.push("vibrato"); if (fl.includes("*")) out.push("armónico");
  return out.length ? " · " + out.join(", ") : "";
}
function renderProgIdle() {
  const t = curTab(), r = range(t), rec = prog(t)[r.key];
  const box = $("#tbProg", el);
  box.innerHTML = rec ? `<span>Tu mejor paso en esta sección: <b>${rec.med.toFixed(1)} s por nota</b> · ${rec.pasadas} ${rec.pasadas === 1 ? "vez completa" : "veces completa"}</span>`
    : `<span class="note tbhint">La app avanza al escuchar cada nota. Muévete con ← → o con clic en la tab.</span>`;
}

/* ---------- Biblioteca ---------- */
function renderLib() {
  const box = $("#tbLib", el), t = curTab();
  const row = x => {
    const notas = x.notas ?? x.ev.reduce((a, e) => a + e.n.length, 0);
    return `<li class="${x.id === t.id ? "on" : ""}"><button class="tbitem" data-open="${esc(x.id)}"><b>${esc(x.titulo)}</b><small>${esc([x.artista, x.fuente === "gp" ? x.pista : null, `${x.compases.length} compases`, `${notas} notas`].filter(Boolean).join(" · "))}</small></button>${x.ejercicio ? "" : `<button class="icon-btn" data-del="${esc(x.id)}" aria-label="Borrar ${esc(x.titulo)}" title="Borrar">✕</button>`}</li>`;
  };
  box.innerHTML = `<h3>Tus tabs</h3>
    ${tabs.length ? `<ul class="tblist">${tabs.map(row).join("")}</ul>` : `<p class="note">Todavía no importas ninguna. Mientras, practica con los ejercicios de abajo.</p>`}
    <div class="label" style="margin-top:6px">Ejercicios</div>
    <ul class="tblist">${builtinTabs().map(row).join("")}</ul>`;
  box.querySelectorAll("[data-open]").forEach(b => b.onclick = () => showTab(b.dataset.open));
  box.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "¿Borrar?"; b.classList.add("danger"); setTimeout(() => { if (b.isConnected) { b.dataset.sure = ""; b.textContent = "✕"; b.classList.remove("danger"); } }, 3000); return; }
    stopAll();
    const k = tabs.findIndex(x => x.id === b.dataset.del); if (k >= 0) tabs.splice(k, 1);
    saveTabs(); if (data.tabsProg) delete data.tabsProg[b.dataset.del];
    if (data.ajustes.tabId === b.dataset.del) data.ajustes.tabId = null;
    save(); render(); toast("Tab borrada");
  });
}

/* ---------- Importar ---------- */
function renderImport() {
  const box = $("#tbImport", el);
  box.innerHTML = `<h3>Importar una tab</h3>
    <div class="tbdrop" id="tbDrop">
      <label class="btn primary" for="tbFile">Abrir archivo Guitar Pro o MusicXML</label>
      <input type="file" id="tbFile" accept=".gp,.gp3,.gp4,.gp5,.gpx,.gp7,.xml,.musicxml,.mxl" hidden>
      <span class="note">.gp · .gp3 · .gp4 · .gp5 · .gpx · .musicxml. También puedes soltarlo aquí.</span>
    </div>
    <p class="note" id="tbFileMsg" role="status"></p>
    <details class="tbpaste">
      <summary>Pegar una tab de texto</summary>
      <div class="stack" style="gap:8px;margin-top:8px">
        <div class="grid2"><label>Canción<input type="text" id="tbTitle" placeholder="Nombre"></label><label>Artista<input type="text" id="tbArtist" placeholder="Opcional"></label></div>
        <textarea id="tbText" rows="8" spellcheck="false" placeholder="e|-----0-----3--|&#10;B|---1---1------|&#10;G|-0-------0----|&#10;D|--------------|&#10;A|--------------|&#10;E|--------------|"></textarea>
        <div class="row"><button class="btn" id="tbPaste">Importar texto</button><span class="note" id="tbPasteMsg" role="status"></span></div>
      </div>
    </details>
    <details class="tbhelp">
      <summary>¿Dónde consigo tabs así?</summary>
      <ul>
        <li><b>Archivos de Guitar Pro</b> (lo mejor: traen ritmo y tempo). En los sitios de tabs, busca la versión "Guitar Pro" de la canción y su botón de descarga. Muchos sitios piden cuenta o suscripción para descargar.</li>
        <li><b>MusicXML</b>: en partituras de MuseScore u otros editores, usa Exportar o Descargar → MusicXML.</li>
        <li><b>Tabs de texto</b>: selecciona la tab en la página, cópiala y pégala arriba. Pega los renglones completos (e|, B|, G|…); los nombres de sección como [Intro] se aprovechan.</li>
        <li><b>PDF</b>: si puedes seleccionar el texto del PDF, cópialo y pégalo. Si el PDF es una imagen (por ejemplo, una página impresa a PDF), no se puede leer.</li>
      </ul>
      <p class="note">Las tabs se guardan solo en este dispositivo y viajan en tu respaldo de Progreso.</p>
    </details>`;
  const file = $("#tbFile", box);
  file.onchange = () => { if (file.files[0]) importFile(file.files[0]); file.value = ""; };
  const drop = $("#tbDrop", box);
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); const f = e.dataTransfer.files[0]; if (f) importFile(f); });
  $("#tbPaste", box).onclick = () => {
    const msg = $("#tbPasteMsg", box);
    const r = parseTextTab($("#tbText", box).value, { titulo: $("#tbTitle", box).value.trim(), artista: $("#tbArtist", box).value.trim() });
    if (r.error) { msg.textContent = r.error; return; }
    if (addTab(r.tab)) { msg.textContent = ""; $("#tbText", box).value = ""; $("#tbTitle", box).value = ""; $("#tbArtist", box).value = ""; toast(`Tab importada: ${r.tab.compases.length} compases, ${r.tab.notas} notas`); }
  };
}
function addTab(t) {
  t.id = "t" + Date.now().toString(36); t.creado = Date.now();
  tabs.unshift(t);
  if (!saveTabs()) { tabs.shift(); toast("No hay espacio para guardar esta tab. Borra alguna que ya no uses."); return false; }
  stopAll(); data.ajustes.tabId = t.id; save(); render(); return true;
}
async function importFile(f) {
  const msg = $("#tbFileMsg", el);
  if (f.size > 8e6) { msg.textContent = "El archivo es demasiado grande para una tab (más de 8 MB)."; return; }
  msg.textContent = "Leyendo " + f.name + "…";
  let at;
  try { at = await loadAlphaTab(); }
  catch (e) { msg.textContent = "No pude descargar el lector de Guitar Pro. Revisa tu conexión: solo se necesita la primera vez."; return; }
  let score;
  try { score = await readScore(new Uint8Array(await f.arrayBuffer()), at); }
  catch (e) { msg.textContent = "No reconocí este archivo. Funciona con Guitar Pro 3 a 8 (.gp3, .gp4, .gp5, .gpx, .gp) y MusicXML sin comprimir (.musicxml o .xml)."; return; }
  const tracks = listTracks(score);
  if (!tracks.length) { msg.textContent = "El archivo no tiene pistas con tablatura (solo batería o voz sin cuerdas)."; return; }
  msg.textContent = "";
  if (tracks.length === 1) { finishImport(score, tracks[0].i, f.name); return; }
  pickTrack(score, tracks, f.name);
}
function finishImport(score, i, name) {
  const t = trackToTab(score, i);
  if (!t.titulo) t.titulo = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
  t.archivo = name;
  if (!t.ev.length) { toast("Esa pista no tiene notas."); return; }
  if (addTab(t)) toast(`Importada: ${t.titulo} · ${t.pista} (${t.compases.length} compases)`);
}
function pickTrack(score, tracks, name) {
  const g = guessTrack(tracks);
  const { body } = sheet("Elige la pista");
  body.innerHTML = `<p class="sheet-lead"><b>${esc(score.title || name)}</b>${score.artist ? " · " + esc(score.artist) : ""} trae ${tracks.length} pistas. ¿Cuál quieres aprender?</p>
    <ul class="cal-list tbtracks">${tracks.map(t => `<li><label><input type="radio" name="tbTrack" value="${t.i}" ${t.i === g.i ? "checked" : ""}>
      <span><b>${esc(t.nombre)}</b><small>${t.cuerdas} cuerdas · ${esc(t.afinacion)}${t.capo ? " · capo " + t.capo : ""} · ${t.notas} notas</small></span></label></li>`).join("")}</ul>
    <div class="row sheet-foot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="tbTrackOk">Importar pista</button></div>`;
  $("#tbTrackOk", body).onclick = () => {
    const v = body.querySelector("input[name=tbTrack]:checked"); if (!v) return;
    closeSheet(); finishImport(score, +v.value, name);
  };
}

/* ---------- Aprender nota por nota ---------- */
const L = { run: false, iv: null, idx: 0, view: 0, tPrompt: 0, tcAudio: 0, lastOnset: -9, good: 0, goodSince: 0, times: [], slow: [], first: true, mic: true, match: 0, startedAt: 0, pass: 0 };
const OVERHEAD = .15;   // lo que tarda la detección en confirmar una nota
function tmpl(midis) {
  const v = new Array(12).fill(0);
  for (const m of midis) { v[m % 12] += 1; v[(m + 7) % 12] += .3; v[(m + 4) % 12] += .1; }
  return A.norm(v);
}
async function learnStart() {
  const t = curTab(); if (!t) return;
  if (PL.run) stopListen();
  window.dispatchEvent(new Event("riff:stop-audio")); window.dispatchEvent(new Event("riff:stop-seq")); window.dispatchEvent(new Event("riff:stop-rasgueo")); window.dispatchEvent(new Event("riff:stop-cambios"));
  L.mic = data.ajustes.tabMic !== false;
  if (L.mic && !(await A.micOn())) { L.mic = false; toast(A.mic.error || "Sin micrófono: avanza con Ya la toqué o la barra espaciadora"); }
  const r = range(t);
  Object.assign(L, { run: true, idx: L.view >= r.from && L.view <= r.to ? L.view : r.from, times: [], slow: [], first: true, good: 0, goodSince: 0, match: 0, startedAt: performance.now(), pass: 0, lastOnset: -9, attack: -9 });
  L.tPrompt = performance.now(); L.tcAudio = A.now();
  if (L.mic) A.startOnsets(tt => { L.lastOnset = tt; });
  staff.clearMarks(); fb.reset();
  $("#tbStage", el).classList.add("live");
  $("#tbStart", el).textContent = "Terminar";
  const sk = $("#tbSkip", el); sk.hidden = false; sk.textContent = L.mic ? "Saltar nota" : "Ya la toqué";
  sk.toggleAttribute("data-primary", !L.mic); $("#tbStart", el).toggleAttribute("data-primary", L.mic);
  $("#tbLab", el).textContent = L.mic ? "Toca esta nota" : "Toca y pulsa Ya la toqué";
  $("#tbListen", el).disabled = true;
  staff.setCursor(L.idx); show(); learnProg();
  L.iv = setInterval(learnTick, 40); A.keepAwake(true);
}
function learnStop() {
  clearInterval(L.iv); L.run = false; A.stopOnsets(); A.keepAwake(false);
  const t = curTab(); L.view = L.idx; if (t) prog(t).pos = L.idx;
  const min = (performance.now() - L.startedAt) / 60000;
  if (min >= .5) logSession(Math.round(min * 10) / 10, "tabs"); else save();
  $("#tbStage", el).classList.remove("live");
  $("#tbStart", el).textContent = "Empezar a aprender"; $("#tbStart", el).setAttribute("data-primary", "");
  const sk = $("#tbSkip", el); sk.hidden = true; sk.removeAttribute("data-primary");
  $("#tbLab", el).textContent = "Listo"; $("#tbListen", el).disabled = false;
  $("#tbHeard", el).textContent = "–"; $("#tbMatchBar", el).style.width = "0";
  if (t) { show(); if (!L.done) renderProgIdle(); }
  L.done = false;
}
function learnProg(extra = "") {
  const t = curTab(), r = range(t), n = r.to - r.from + 1, k = L.idx - r.from;
  const med = median(L.times.slice(-16));
  $("#tbProg", el).innerHTML = `<div class="row between"><span>${extra || (med != null ? `Vas a <b>${med.toFixed(1)} s</b> por nota (mediana de las últimas ${Math.min(16, L.times.length)})` : "La primera nota no cuenta tiempo: tómate tu tiempo para ubicarla")}</span><span class="note">${k} / ${n}${L.pass ? " · vuelta " + (L.pass + 1) : ""}</span></div><div class="bar"><div style="width:${Math.round(k / n * 100)}%"></div></div>`;
}
function learnTick() {
  if (!L.run) return;
  const t = curTab(), e = t.ev[L.idx]; if (!e) return;
  if (!L.mic) return;
  const tg = e.n.filter(n => !n[3].includes("x")).map(n => target(t, n));
  const legato = e.n.every(n => /[HS]/.test(n[3]));
  // Un ataque nuevo: después de mostrar la nota (con un margen pequeño) y no el eco del ataque anterior,
  // que a veces el detector marca dos veces en ~100 ms.
  const armed = legato || (L.lastOnset >= L.tcAudio - .04 && L.lastOnset > L.attack + .15);
  let good = false, match = 0, heard = "–";
  if (!tg.length) { good = armed; match = good ? 1 : 0; heard = good ? "×" : "–"; }
  else if (tg.length === 1) {
    const p = A.pitch({ minF: t.cuerdas <= 5 ? 38 : 70, maxF: 1400 });
    if (p.f && p.clarity > .75) {
      const m = 69 + 12 * Math.log2(p.f / 440), d = m - tg[0], dd = Math.min(...[0, 12, -12, 24].map(o => Math.abs(d - o)));
      good = dd < .5; match = Math.max(0, 1 - dd / 2.5); heard = noteName(Math.round(m));
    } else {
      const fr = A.chroma();
      if (fr.on) { const s = A.cosSim(fr.chroma, tmpl(tg)); match = s; good = s > .9; heard = good ? pcName(tg[0]) : "…"; }
    }
  } else {
    const fr = A.chroma();
    if (fr.on) { const s = A.cosSim(fr.chroma, tmpl(tg)); match = s; good = s > .8; heard = Math.round(s * 100) + "%"; }
  }
  L.match = L.match * .5 + match * .5;
  $("#tbMatchBar", el).style.width = Math.round(L.match * 100) + "%";
  $("#tbMatchBar", el).parentElement.classList.toggle("good", good);
  $("#tbHeard", el).textContent = heard;
  const now = performance.now();
  if (good) { if (!L.goodSince) L.goodSince = now; } else L.goodSince = 0;
  if (good && armed) L.good++; else if (!good) L.good = 0;
  const need = tg.length > 1 ? 3 : 2;
  if (L.good >= need) { advance(true); return; }
  // Si el ataque no se detectó (nota suave), pero la nota correcta lleva sonando un segundo y es distinta a la anterior, cuenta.
  const prev = t.ev[L.idx - 1];
  if (L.goodSince && now - L.goodSince > 1000 && !(prev && prev.n.length === e.n.length && prev.n.every((n, k) => target(t, n) === target(t, e.n[k])))) { advance(true); return; }
  if (!L.hinted && now - L.tPrompt > 9000) { L.hinted = true; toast("¿Te atoras? Toca el número grande para escuchar la nota, o usa Saltar nota."); }
}
function advance(counted) {
  const t = curTab(), r = range(t);
  const dt = Math.max(.05, (performance.now() - L.tPrompt) / 1000 - (L.mic ? OVERHEAD : 0));
  if (!L.first) { L.times.push(counted ? dt : Math.max(dt, 3)); L.slow.push({ i: L.idx, dt: counted ? dt : 99 }); }
  L.first = false;
  staff.mark(L.idx, counted ? "ok" : "skip"); fb.show(counted ? "ok" : "miss");
  L.attack = L.lastOnset; L.idx++; L.tPrompt = performance.now(); L.tcAudio = A.now(); L.good = 0; L.goodSince = 0; L.hinted = false; L.match = 0;
  if (L.idx > r.to) { sectionDone(t, r); return; }
  staff.setCursor(L.idx); show(); learnProg();
}
function sectionDone(t, r) {
  const med = median(L.times), p = prog(t);
  let msg = "Sección completa";
  if (med != null && L.times.length >= 4) {
    const rec = p[r.key], best = !rec || med < rec.med;
    p[r.key] = { med: best ? med : rec.med, pasadas: (rec?.pasadas || 0) + 1, t: Date.now() };
    msg = `Sección completa: ${med.toFixed(1)} s por nota${best && rec ? " · ¡tu mejor paso!" : ""}`;
    save();
  }
  const slow = L.slow.filter(x => x.dt > Math.max(1.5, (med || 0) * 2)).sort((a, b) => b.dt - a.dt).slice(0, 3);
  const tips = slow.map(x => { const e = t.ev[x.i]; return `compás ${e.c + 1} (${e.n.length > 1 ? `acorde de ${e.n.length} notas` : `${e.n[0][0] + 1}ª cuerda, traste ${e.n[0][1]}`})`; });
  if (data.ajustes.tabLoop) {
    L.pass++; L.idx = r.from; L.first = true; L.times = []; L.slow = []; L.tPrompt = performance.now(); L.tcAudio = A.now();
    staff.clearMarks(); staff.setCursor(L.idx); show();
    learnProg(msg + (tips.length ? ". Te costaron: " + tips.join("; ") : "") + ". Otra vuelta.");
    toast(msg);
    return;
  }
  L.idx = r.from; L.done = true; learnStop();
  $("#tbProg", el).innerHTML = `<span><b>${esc(msg)}.</b>${tips.length ? " Te costaron: " + esc(tips.join("; ")) + "." : ""} Activa Repetir sección para darle varias vueltas seguidas.</span>`;
  toast(msg);
}

/* ---------- Escuchar ---------- */
const PL = { run: false, iv: null, i: 0, when: 0, q: [], from: 0, to: 0 };
function secPerTick(t, e, speed) {
  let bpm = t.tempo || 80;
  for (let k = 0; k <= e.c; k++) if (t.compases[k]?.bpm) bpm = t.compases[k].bpm;
  return 60 / (bpm * speed * 960);
}
function playEvent(t, e, when) {
  if (!e || !A.ctx()) return;
  const dur = Math.min(2.2, Math.max(.35, e.d * secPerTick(t, e, data.ajustes.tabSpeed || .75) + .25));
  e.n.forEach((n, k) => { if (n[3].includes("x")) A.chuck(when + k * .012, .3); else A.pluck(target(t, n), when + k * .018, .32, dur); });
}
function listen() {
  const t = curTab(); if (!t || !A.ctx()) return;
  window.dispatchEvent(new Event("riff:stop-seq")); window.dispatchEvent(new Event("riff:stop-rasgueo")); window.dispatchEvent(new Event("riff:stop-cambios"));
  const r = range(t), speed = data.ajustes.tabSpeed || .75;
  Object.assign(PL, { run: true, i: L.view >= r.from && L.view <= r.to ? L.view : r.from, when: A.now() + .15, q: [], from: r.from, to: r.to, speed });
  $("#tbListen", el).textContent = "Detener"; $("#tbStart", el).disabled = true;
  $("#tbLab", el).textContent = "Escuchando";
  const step = () => {
    if (!PL.run) return;
    const horizon = A.now() + .2;
    while (PL.when < horizon) {
      if (PL.i > PL.to) {
        if (!data.ajustes.tabLoop) { if (A.now() > PL.when + .3) { stopListen(); return; } break; }
        PL.i = PL.from; PL.when += .5;
      }
      const e = t.ev[PL.i]; playEvent(t, e, PL.when); PL.q.push({ at: PL.when, i: PL.i });
      const nx = t.ev[PL.i + 1];
      PL.when += (nx && PL.i < PL.to ? Math.max(0, nx.t - e.t) : e.d) * secPerTick(t, e, PL.speed);
      PL.i++;
    }
    while (PL.q.length && PL.q[0].at <= A.now()) { const v = PL.q.shift(); L.view = v.i; staff.setCursor(v.i); show(); }
  };
  PL.iv = setInterval(step, 25); step();
}
function stopListen() {
  clearInterval(PL.iv); PL.run = false; PL.q = [];
  $("#tbListen", el).textContent = "Escuchar"; $("#tbStart", el).disabled = false;
  if (!L.run) $("#tbLab", el).textContent = "Listo";
}
