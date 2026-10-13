// Tabs y riffs: importa tabs de Guitar Pro / MusicXML o pega tabs de texto, y apréndelas nota por nota.
// En modo Aprender la app muestra una nota (o acorde) a la vez y espera a escucharla por el micrófono antes de
// pasar a la siguiente. "Escuchar" toca la sección con guitarra sintetizada a la velocidad que elijas.
// Las tabs importadas se guardan solo en este dispositivo.
import { data, save, tabs, saveTabs, toast, esc, logSession, $ } from "../store.js";
import * as A from "../audio.js";
import { parseTextTab, stdTuning } from "../tabs/texto.js";
import { loadAlphaTab, readScore, listTracks, guessTrack, trackToTab, tuningLabel, tracksForBacking, fixTabTexts, fixText } from "../tabs/gp.js";
import { TabStaff, fretMini, noteName, pcName, stringName, renderFullTab } from "../ui/tabstaff.js";
import { findShapes, shapeHint } from "../tabs/formas.js";
import { Feedback, swapText } from "../ui/highway.js";
import { openMicSettings, sheet, close as closeSheet, warnGuideEcho } from "../ui/calib.js";

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
const velOf = t => { const p = prog(t), k = range(t).key; return p.vel?.[k] ?? .6; };
function setVel(t, v) { const p = prog(t); p.vel = p.vel || {}; p.vel[range(t).key] = Math.round(Math.max(.3, Math.min(1.2, v)) * 100) / 100; save(); }
const shapeCache = new Map();
function shapesOf(t) {
  const k = t.id + ":" + t.ev.length;
  if (!shapeCache.has(k)) { let f = []; try { f = findShapes(t); } catch (e) {} shapeCache.set(k, f); }
  return shapeCache.get(k);
}
const shapeAt = (t, i) => shapesOf(t).find(x => i >= x.i && i <= x.j);
// Movimiento de la tab al escuchar y con tempo: "nota" (salta de nota en nota) o "continuo" (se desliza parejo)
const smoothMove = () => data.ajustes.tabMov === "continuo";
const modeOf = t => prog(t).modo === "tempo" ? "tempo" : "aprender";
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
  // corrige textos mal leídos (acentos) de tabs importadas antes
  if (tabs.map(fixTabTexts).some(Boolean)) saveTabs();
  el.innerHTML = `
  <div class="cols" style="--cols:minmax(0,1.5fr) minmax(0,1fr)">
  <div class="col">
  <div class="panel deck-panel screen">
   <div class="deck">
    <div class="deck-top">
      <select id="tbPick" aria-label="Elegir tab"></select>
      <select id="tbSec" aria-label="Sección" style="flex:0 1 230px"></select>
      <span id="tbBars" class="row" style="gap:6px" hidden><input type="number" id="tbA" min="1" aria-label="Desde el compás" style="width:70px"><span class="note">a</span><input type="number" id="tbB" min="1" aria-label="Hasta el compás" style="width:70px"></span>
    </div>
    <div id="tbStaffBox"><div class="tbtools">
      <button class="icon-btn tbtool" id="tbHome" aria-label="Volver al inicio de la sección" title="Volver al inicio de la sección"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 5v14M19 5l-9 7 9 7z"/></svg></button>
      <button class="icon-btn tbtool" id="tbFull" aria-label="Ver la tab completa" title="Ver la tab completa"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 10h16M4 14h16M4 18h10"/></svg></button>
      </div></div>
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
      <div class="seg" role="radiogroup" id="tbModeSeg" aria-label="Modo de práctica" style="flex:0 0 auto">
        <button role="radio" data-tbm="aprender">Aprender</button><button role="radio" data-tbm="tempo">Con tempo</button>
      </div>
      <span class="tbvel" title="Velocidad respecto al tempo original"><button class="icon-btn" id="tbVm" aria-label="Más lento">−</button><b><span id="tbVel">60%</span><small id="tbTempo"></small></b><button class="icon-btn" id="tbVp" aria-label="Más rápido">+</button></span>
      <label class="chip-toggle" id="tbMicRow" title="Avanza solo cuando el micrófono escucha la nota"><input type="checkbox" id="tbMic"> Micrófono</label>
      <label class="chip-toggle" title="Al terminar la sección, vuelve a empezar"><input type="checkbox" id="tbLoop"> Repetir</label>
      <label class="chip-toggle tb-tempo" title="La app toca la tab contigo (mejor con audífonos)"><input type="checkbox" id="tbGuide"> Sonido guía</label>
      <button class="btn small tb-learn" id="tbListen">Escuchar</button>
      <button class="btn small" id="tbMix" hidden>Pistas</button>
      <button class="icon-btn" id="tbCal" aria-label="Ajustes: afinación, clic, velocidad y micrófono" title="Ajustes: afinación, clic, velocidad y micrófono"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/></svg></button>
      <button class="btn small" id="tbSkip" hidden>Saltar nota</button>
      <button class="btn primary" id="tbStart" data-primary>Empezar</button>
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
  const step = d => { if (T.run) return; const t = curTab(); setVel(t, velOf(t) + d); paintVel(); if (PL.run) { stopListen(); listen(); } };
  $("#tbVm", el).onclick = () => step(-.05); $("#tbVp", el).onclick = () => step(.05);
  el.querySelectorAll("[data-tbm]").forEach(b => b.onclick = () => { if (L.run || T.run) return; if (PL.run) stopListen(); prog(curTab()).modo = b.dataset.tbm; save(); applyMode(); });
  $("#tbGuide", el).onchange = e => { data.ajustes.tabGuide = e.target.checked; save(); };
  $("#tbListen", el).onclick = () => PL.run ? stopListen() : listen();
  $("#tbStart", el).onclick = () => L.run ? learnStop() : T.run ? tempoStop() : modeOf(curTab()) === "tempo" ? tempoStart() : learnStart();
  $("#tbSkip", el).onclick = () => { if (L.run) advance(!L.mic); };
  $("#tbNow", el).onclick = () => { const t = curTab(); if (t && !T.run) playEvent(t, t.ev[cursor()], A.ctx() && A.now() + .02); };
  $("#tbCal", el).onclick = openSettings;
  $("#tbHome", el).onclick = goStart;
  $("#tbFull", el).onclick = openFull;
  $("#tbMix", el).onclick = openMixer;
  document.addEventListener("keydown", e => {
    if (el.offsetParent === null || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest("input,select,textarea,[contenteditable]")) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") { if (el.contains(e.target) || T.run) return; jumpTo(cursor() + (e.key === "ArrowRight" ? 1 : -1)); e.preventDefault(); }
  });
  window.addEventListener("riff:stop-audio", () => { if (PL.run) stopListen(); });
  window.addEventListener("riff:stop-tabs", () => stopAll());
  renderImport();
  render();
}
export function showTab(id) { if (allTabs().some(t => t.id === id)) { stopAll(); data.ajustes.tabId = id; save(); render(); } }
export function stopTabs() { stopAll(); }
function stopAll() { if (L.run) learnStop(); if (T.run) tempoStop(); if (PL.run) stopListen(); }

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
  $("#tbGuide", el).checked = !!data.ajustes.tabGuide;
  const r = range(t), secs = sections(t), p = prog(t);
  const sel = $("#tbSec", el), N = t.compases.length;
  sel.innerHTML = `<option value="all">Toda (${N} ${N === 1 ? "compás" : "compases"})</option>` +
    secs.map(s => `<option value="${s.a}-${s.b}">${esc(s.name)} · ${s.a === s.b ? "compás " + (s.a + 1) : "compases " + (s.a + 1) + "–" + (s.b + 1)}</option>`).join("") +
    `<option value="custom">Elegir compases…</option>`;
  sel.value = !p.sel ? "all" : p.sel.custom ? "custom" : `${p.sel.a}-${p.sel.b}`;
  if (!sel.value) sel.value = "custom";
  $("#tbBars", el).hidden = sel.value !== "custom";
  $("#tbA", el).value = r.a + 1; $("#tbB", el).value = r.b + 1; $("#tbA", el).max = $("#tbB", el).max = N;
  staff.set(t, r.from, r.to); staff.setLabels(viewTuning(t)); staff.setShapes(shapesOf(t));
  let pos = p.pos != null && p.pos >= r.from && p.pos <= r.to ? p.pos : r.from;
  L.view = pos; staff.setCursor(pos, true);
  show(); applyMode(); renderLib(); paintMix();
}
function paintVel() {
  const t = curTab(), v = velOf(t), base = t.tempo || 80;
  $("#tbVel", el).textContent = Math.round(v * 100) + "%";
  $("#tbTempo", el).textContent = `${t.tempo ? "" : "≈"}${Math.round(base * v)} BPM`;
  $("#tbVel", el).closest(".tbvel").title = t.tempo ? `Velocidad: ${Math.round(base * v)} de ${t.tempo} BPM originales` : "Velocidad (la tab de texto no trae tempo; es aproximado)";
}
function applyMode() {
  const t = curTab(), m = modeOf(t);
  el.querySelectorAll("[data-tbm]").forEach(b => b.setAttribute("aria-checked", b.dataset.tbm === m));
  el.querySelectorAll(".tb-tempo").forEach(x => x.hidden = m !== "tempo");
  el.querySelectorAll(".tb-learn").forEach(x => x.hidden = m !== "aprender");
  $("#tbMicRow", el).title = m === "tempo" ? "Califica cada nota: a tiempo, tarde o temprano, equivocada o sin tocar" : "Avanza solo cuando el micrófono escucha la nota";
  $("#tbStart", el).textContent = "Empezar";
  paintVel(); renderProgIdle();
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
  const sh = shapeAt(t, i);
  if (sh) where.insertAdjacentHTML("beforeend", `<span class="tbshape" title="Pon la mano en esta forma de acorde y toca las notas sin moverla">Mano en <b>${esc(shapeHint(sh.shape))}</b></span>`);
  $("#tbFret", el).innerHTML = fretMini(t, e.n, nx && i < r.to ? nx.n : [], sh ? sh.shape : null);
  $("#tbSub", el).textContent = `Compás ${e.c + 1} · nota ${i - r.from + 1} de ${r.to - r.from + 1}${isStd(t) ? "" : prog(t).afin === "std" ? " · tu guitarra en estándar" : " · afina " + tuningName(t).short}`;
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
  if (modeOf(t) === "tempo") {
    const tr = prog(t).tempo?.[r.key];
    box.innerHTML = tr ? `<span>Mejor vuelta en esta sección: <b>${Math.round(tr.pct * 100)}%</b> de notas bien a ${Math.round(tr.vel * 100)}% de velocidad · ${tr.pasadas} ${tr.pasadas === 1 ? "vuelta" : "vueltas"}</span>`
      : `<span class="note tbhint">Cuenta un compás de entrada y la tab avanza al tempo. Empieza lento: la velocidad sube sola cuando tocas bien.</span>`;
    return;
  }
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
  // las demás pistas, para el acompañamiento (la tuya se toca con el sonido guía)
  t.acomp = tracksForBacking(score).filter(x => x.i !== i);
  fixTabTexts(t);
  if (addTab(t)) toast(`Importada: ${t.titulo} · ${t.pista}${isStd(t) ? "" : ` · está en ${tuningName(t).long}: si tu guitarra está en estándar, cámbialo en Ajustes`}`);
}
function pickTrack(score, tracks, name) {
  const g = guessTrack(tracks);
  const { body } = sheet("Elige la pista");
  body.innerHTML = `<p class="sheet-lead"><b>${esc(fixText(score.title) || name)}</b>${score.artist ? " · " + esc(fixText(score.artist)) : ""} trae ${tracks.length} pistas. ¿Cuál quieres aprender?</p>
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
  $("#tbStart", el).textContent = "Empezar"; $("#tbStart", el).setAttribute("data-primary", "");
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
  const ready = med != null && med <= .8;
  $("#tbProg", el).innerHTML = `<div class="row between" style="gap:10px"><span><b>${esc(msg)}.</b>${tips.length ? " Te costaron: " + esc(tips.join("; ")) + "." : ""} ${ready ? "Ya la ubicas bien: pruébala con tempo." : "Dale otra vuelta (o activa Repetir) hasta bajar de 0.8 s por nota."}</span>${ready ? `<button class="btn small" id="tbToTempo">Practicar con tempo</button>` : ""}</div>`;
  const go = $("#tbToTempo", el); if (go) go.onclick = () => { prog(t).modo = "tempo"; save(); applyMode(); tempoStart(); };
  toast(msg);
}

/* ---------- Escuchar (tu pista y, si quieres, el acompañamiento) ---------- */
const PL = { run: false, iv: null, j: 0, t0: 0, q: [], tl: null, r: null, bk: [], bi: 0 };
function secPerTick(t, e, speed) {
  let bpm = t.tempo || 80;
  for (let k = 0; k <= e.c; k++) if (t.compases[k]?.bpm) bpm = t.compases[k].bpm;
  return 60 / (bpm * speed * 960);
}
function playEvent(t, e, when) {
  if (!e || !A.ctx()) return;
  const dur = Math.min(2.2, Math.max(.35, e.d * secPerTick(t, e, velOf(t)) + .25));
  e.n.forEach((n, k) => { if (n[3].includes("x")) A.chuck(when + k * .012, .3); else A.pluck(target(t, n), when + k * .018, .32, dur); });
}
function listen() {
  const t = curTab(); if (!t || !A.ctx()) return;
  window.dispatchEvent(new Event("riff:stop-seq")); window.dispatchEvent(new Event("riff:stop-rasgueo")); window.dispatchEvent(new Event("riff:stop-cambios"));
  const r = range(t), tl = timeline(t, r, velOf(t));
  const j0 = (L.view >= r.from && L.view <= r.to ? L.view : r.from) - r.from, off = tl.times[j0];
  Object.assign(PL, { run: true, r, tl, j: j0, t0: A.now() + .15 - off, q: [], bk: backingList(t, tl, off - .01), bi: 0 });
  $("#tbListen", el).textContent = "Detener"; $("#tbStart", el).disabled = true;
  $("#tbLab", el).textContent = "Escuchando";
  const step = () => {
    if (!PL.run) return;
    const now = A.now(), horizon = now + .2, n = PL.r.to - PL.r.from + 1;
    while (PL.j < n && PL.t0 + PL.tl.times[PL.j] < horizon) {
      const i = PL.r.from + PL.j, at = PL.t0 + PL.tl.times[PL.j];
      playEvent(t, t.ev[i], at); PL.q.push({ at, i }); PL.j++;
    }
    while (PL.bi < PL.bk.length && PL.t0 + PL.bk[PL.bi].s < horizon) { playBacking(PL.bk[PL.bi], PL.t0 + PL.bk[PL.bi].s, t); PL.bi++; }
    if (PL.j >= n && PL.bi >= PL.bk.length && now > PL.t0 + PL.tl.end) {
      if (!data.ajustes.tabLoop) { stopListen(); return; }
      PL.t0 += PL.tl.end + .5; PL.j = 0; PL.bk = backingList(t, PL.tl, 0); PL.bi = 0;
    }
    while (PL.q.length && PL.q[0].at <= now) { const v = PL.q.shift(); L.view = v.i; if (!smoothMove()) staff.setCursor(v.i); show(); }
  };
  PL.iv = setInterval(step, 25); step();
  cancelAnimationFrame(PL.raf);
  const glide = () => {
    if (!PL.run) return;
    if (smoothMove()) {
      const now = A.now(), T0 = PL.t0, tm = PL.tl.times, n = tm.length;
      let j = 0; while (j + 1 < n && T0 + tm[j + 1] <= now) j++;
      if (now >= T0 + tm[0] - .3) {
        const a = T0 + tm[j], b = j + 1 < n ? T0 + tm[j + 1] : a + .5, frac = Math.max(0, Math.min(1, (now - a) / (b - a)));
        staff.play(staff.xAt(PL.r.from + j, now < a ? 0 : frac), PL.r.from + j);
      }
    }
    PL.raf = requestAnimationFrame(glide);
  };
  PL.raf = requestAnimationFrame(glide);
}
function stopListen() {
  clearInterval(PL.iv); cancelAnimationFrame(PL.raf); PL.run = false; PL.q = [];
  if (staff.playX != null) { staff.endPlay(); staff.setCursor(L.view, true); }
  $("#tbListen", el).textContent = "Escuchar"; $("#tbStart", el).disabled = false;
  if (!L.run) $("#tbLab", el).textContent = "Listo";
}

/* ---------- Acompañamiento: las demás pistas del archivo de Guitar Pro ---------- */
const TIPO = { guitarra: "Guitarra", bajo: "Bajo", bateria: "Batería", voz: "Voz (melodía)", teclado: "Teclado" };
const mixOn = (t, x) => { const m = prog(t).mix || {}; return m[x.i] ?? (x.tipo !== "voz"); };
const mixVol = t => prog(t).mixVol ?? .8;
function backingList(t, tl, fromSec) {
  if (!t.acomp?.length) return [];
  const out = [];
  for (const x of t.acomp) {
    if (!mixOn(t, x)) continue;
    for (const [tick, d, ms] of x.ev) {
      if (tick < tl.startTick || tick >= tl.endTick) continue;
      const s0 = tl.sec(tick); if (s0 < fromSec) continue;
      out.push({ s: s0, d: Math.max(.08, tl.sec(Math.min(tick + d, tl.endTick)) - s0), ms, tipo: x.tipo, vol: x.vol });
    }
  }
  return out.sort((a, b) => a.s - b.s);
}
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function playBacking(x, when, t) {
  const v = x.vol * mixVol(t);
  if (x.tipo === "bateria") { for (const m of x.ms) drum(m, when, v); return; }
  if (x.tipo === "bajo") { A.bass(x.ms[0], when, Math.max(.12, Math.min(x.d, 1.6)), .75 * v); return; }
  if (x.tipo === "voz") { x.ms.forEach(m => A.beep(mtof(m), Math.max(.18, Math.min(x.d, 1.6)), when, .05 * v, "triangle")); return; }
  x.ms.forEach((m, q) => A.pluck(m, when + q * .012, .15 * v, Math.min(2.2, x.d + .2)));
}
function drum(m, t, v) {
  if (m === 35 || m === 36) A.kick(t, .9 * v);
  else if (m >= 37 && m <= 40) A.snare(t, .75 * v);
  else if (m === 42 || m === 44) A.hat(t, .45 * v);
  else if (m === 46) A.hat(t, .5 * v, true);
  else if (m === 49 || m === 52 || m === 55 || m === 57) A.hat(t, .8 * v, true);
  else if (m === 51 || m === 53 || m === 59) A.hat(t, .35 * v);
  else if (m >= 41 && m <= 50) A.kick(t, .5 * v);
}
function paintMix() {
  const t = curTab(), b = $("#tbMix", el);
  b.hidden = !t.acomp?.length;
  if (t.acomp?.length) b.textContent = `Pistas ${t.acomp.filter(x => mixOn(t, x)).length}/${t.acomp.length}`;
}
function openMixer() {
  const t = curTab(); if (!t.acomp?.length) return;
  const { body } = sheet("Acompañamiento", () => paintMix());
  body.innerHTML = `<p class="sheet-lead">Elige qué pistas suenan contigo al escuchar y al tocar con tempo. Tu pista (<b>${esc(t.pista)}</b>) suena con <i>Escuchar</i> o con el <i>Sonido guía</i>.</p>
    <ul class="cal-list">${t.acomp.map(x => `<li><label class="switch" style="width:100%"><input type="checkbox" data-mix="${x.i}" ${mixOn(t, x) ? "checked" : ""}> <span><b>${esc(x.nombre)}</b> <small class="note">· ${TIPO[x.tipo] || x.tipo}</small></span></label></li>`).join("")}</ul>
    <label class="ms-meter">Volumen <input type="range" id="tbMixVol" min="0.1" max="1.5" step="0.05" value="${mixVol(t)}" style="accent-color:var(--amber-2)"></label>
    <p class="note">Si calificas con el micrófono, usa audífonos: así el micrófono no confunde el acompañamiento con tu guitarra.</p>
    <div class="row sheet-foot"><button class="btn primary" data-close>Listo</button></div>`;
  body.querySelectorAll("[data-mix]").forEach(c => c.onchange = () => { const p = prog(t); p.mix = p.mix || {}; p.mix[c.dataset.mix] = c.checked; save(); });
  $("#tbMixVol", body).oninput = e => { prog(t).mixVol = +e.target.value; save(); };
}

/* ---------- Afinación y micrófono ---------- */
function openSettings() {
  const t = curTab(), p = prog(t);
  const { body } = sheet("Ajustes de práctica", () => { staff.setLabels(viewTuning(t)); show(); });
  const tl = tuningName(t);
  body.innerHTML = `${isStd(t) ? `<p class="sheet-lead">Esta tab está en afinación estándar.</p>` : `
    <div class="ms-block"><b>Esta tab está en ${esc(tl.long)}</b>
      <label class="field">Tu guitarra está
        <select id="tbTuneSel"><option value="tab">afinada como la tab (${esc(tl.short)})</option><option value="std">en afinación estándar</option></select></label>
      <span class="note">Los trastes son los mismos; la app ajusta qué notas espera escuchar y cómo suenan.</span></div>`}
    <div class="ms-block"><b>Movimiento de la tab</b><span class="note">Al escuchar y al tocar con tempo.</span>
      <div class="seg" role="radiogroup" aria-label="Movimiento de la tab"><button role="radio" data-mov="nota">Nota por nota</button><button role="radio" data-mov="continuo">Continuo</button></div>
      <span class="note" id="tbMovNote"></span></div>
    <div class="ms-block"><b>Con tempo</b>
      <label class="switch"><input type="checkbox" id="tbClick"> Clic de metrónomo en cada tiempo</label>
      <label class="switch"><input type="checkbox" id="tbAuto"> Subir la velocidad sola: +5% cuando una vuelta sale con 90% o más, −5% si baja de 70%</label></div>
    <div class="ms-block"><b>Micrófono</b><span class="note">Sensibilidad, ruido del cuarto, prueba de bocinas y retraso del micrófono (para calificar a tiempo en Con tempo).</span>
      <button class="btn" id="tbMicSet">Ajustar micrófono</button></div>
    <div class="row sheet-foot"><button class="btn primary" data-close>Listo</button></div>`;
  const paintMov = () => {
    const m = smoothMove() ? "continuo" : "nota";
    body.querySelectorAll("[data-mov]").forEach(b => b.setAttribute("aria-checked", b.dataset.mov === m));
    $("#tbMovNote", body).textContent = m === "continuo" ? "La marca se desliza a velocidad constante entre notas. Se lee mejor en tempos rápidos." : "La marca salta a cada nota cuando suena. Se lee mejor en tempos lentos.";
  };
  body.querySelectorAll("[data-mov]").forEach(b => b.onclick = () => { data.ajustes.tabMov = b.dataset.mov; save(); paintMov(); });
  paintMov();
  const ck = $("#tbClick", body), au = $("#tbAuto", body);
  ck.checked = data.ajustes.tabClick !== false; au.checked = data.ajustes.tabAuto !== false;
  ck.onchange = () => { data.ajustes.tabClick = ck.checked; save(); }; au.onchange = () => { data.ajustes.tabAuto = au.checked; save(); };
  const ts = $("#tbTuneSel", body);
  if (ts) { ts.value = p.afin === "std" ? "std" : "tab"; ts.onchange = () => { p.afin = ts.value; save(); }; }
  $("#tbMicSet", body).onclick = () => { closeSheet(); openMicSettings({ title: "Micrófono", rhythm: true }); };
}

/* ---------- Inicio y vista completa ---------- */
function goStart() {
  const t = curTab(), r = range(t);
  if (T.run) { clearInterval(T.iv); startPass(); return; }
  if (PL.run) { stopListen(); L.view = r.from; listen(); return; }
  if (L.run) { staff.clearMarks(); jumpTo(r.from); return; }
  L.view = r.from; prog(t).pos = r.from; staff.setCursor(r.from); show();
}
function openFull() {
  const t = curTab(), r = range(t);
  const { body } = sheet(t.titulo || "Tab completa");
  body.closest(".sheet").classList.add("wide");
  const tl = isStd(t) ? "afinación estándar" : tuningName(t).long;
  body.innerHTML = `<p class="sheet-lead">${esc([t.artista, t.fuente === "gp" ? t.pista : null, `${t.compases.length} compases`, tl, t.tempo ? t.tempo + " BPM" : null].filter(Boolean).join(" · "))}. La sección que practicas está resaltada; toca una nota para ir a ella.</p>
    <div class="tblegend"><span><b>h</b> hammer-on</span><span><b>p</b> pull-off</span><span><b>sl.</b> slide</span><span><b>↗</b> bend</span><span><b>∿</b> vibrato</span><span><b>P.M.</b> palm mute</span><span><b>×</b> nota muerta</span><span><b>&lt;12&gt;</b> armónico</span><span><b>(5)</b> nota de adorno</span>${shapesOf(t).length ? `<span><b class="pill">C</b> forma de acorde</span>` : ""}</div>
    <div class="tbfull" id="tbFullBox"></div>`;
  renderFullTab($("#tbFullBox", body), t, {
    cur: cursor(), sel: [r.a, r.b], labels: viewTuning(t), shapes: shapesOf(t),
    onPick: i => { closeSheet(); if (T.run) return; if (i < r.from || i > r.to) { const p = prog(t); p.sel = null; p.pos = i; save(); render(); } jumpTo(i); },
  });
}

/* ---------- Con tempo ----------
   Un compás de entrada y la tab avanza al tempo (al % de velocidad elegido). Con el micrófono, cada nota se califica:
   bien (ataque a tiempo y nota correcta), tarde/temprano (más de 70 ms) o sin ataque claro, equivocada o sin tocar.
   El ataque se mide con el detector de golpes del rasgueo (corregido por la latencia del micrófono) y la nota con el
   detector de tono (notas sueltas) o la croma (acordes). Las notas muy cortas se califican solo por el ataque. */
const T = { run: false, iv: null, raf: 0, ev: [], t0: 0, tEnd: 0, beats: [], bi: 0, gi: 0, k: -1, lat: .05, mic: false, speed: .6, pass: 0, startedAt: 0, minF: 70, maxF: 1400 };
const TIGHT = .07;
// Línea de tiempo en segundos desde el inicio del primer compás de la sección
function timeline(t, r, speed) {
  const C = t.compases, a = t.ev[r.from].c, b = t.ev[r.to].c;
  let bpm = t.tempo || 80; for (let k = 0; k <= a; k++) if (C[k]?.bpm) bpm = C[k].bpm;
  const bar = {}; let sec = 0;
  for (let k = a; k <= b; k++) {
    if (C[k].bpm) bpm = C[k].bpm;
    const len = (k + 1 < C.length ? C[k + 1].s : C[k].s + 960 * 4 * C[k].n / C[k].d) - C[k].s;
    bar[k] = { s: sec, bpm, spt: 60 / (bpm * speed * 960) }; sec += len * bar[k].spt;
  }
  const at = (tick, k) => bar[k].s + (tick - C[k].s) * bar[k].spt;
  const times = []; for (let i = r.from; i <= r.to; i++) times.push(at(t.ev[i].t, t.ev[i].c));
  const last = t.ev[r.to], end = Math.min(sec, at(last.t + last.d, last.c) + .2);
  const beats = [];
  for (let k = a; k <= b; k++) { const bt = 960 * 4 / C[k].d; for (let j = 0; j < C[k].n; j++) beats.push({ t: at(C[k].s + j * bt, k), acc: j === 0 }); }
  const beat0 = 60 / (bar[a].bpm * speed) * 4 / C[a].d, nIn = C[a].n;
  const startTick = C[a].s, endTick = b + 1 < C.length ? C[b + 1].s : C[b].s + 960 * 4 * C[b].n / C[b].d;
  const secOf = tick => { let k = a; while (k < b && C[k + 1].s <= tick) k++; return at(tick, k); };
  return { times, end, beats, countIn: { n: nIn, dur: beat0 }, startTick, endTick, sec: secOf };
}
async function tempoStart() {
  const t = curTab(); if (!t) return;
  if (PL.run) stopListen();
  window.dispatchEvent(new Event("riff:stop-audio")); window.dispatchEvent(new Event("riff:stop-seq")); window.dispatchEvent(new Event("riff:stop-rasgueo")); window.dispatchEvent(new Event("riff:stop-cambios"));
  if (!A.ctx()) return;
  T.mic = data.ajustes.tabMic !== false;
  if (T.mic && !(await A.micOn())) { T.mic = false; toast(A.mic.error || "Sin micrófono: la tab avanza al tempo pero no se califica"); }
  if (T.mic && (data.ajustes.tabGuide || t.acomp?.some(x => mixOn(t, x)))) warnGuideEcho();
  T.run = true; T.pass = 0; T.startedAt = performance.now(); T.lat = data.ajustes.latenciaMic ?? .05;
  if (T.mic) A.startOnsets(o => onsetIn(o));
  $("#tbStage", el).classList.add("live"); $("#tbStart", el).textContent = "Detener";
  el.querySelectorAll(".tbvel button").forEach(b => b.disabled = true);
  A.keepAwake(true);
  startPass();
  const loop = () => { if (!T.run) return; frameDraw(); T.raf = requestAnimationFrame(loop); };
  T.raf = requestAnimationFrame(loop);
}
function startPass() {
  const t = curTab(), r = range(t), sp = velOf(t);
  const tl = timeline(t, r, sp);
  T.speed = sp; T.r = r; T.k = -1;
  const lead = .35 + tl.countIn.n * tl.countIn.dur;
  T.t0 = A.now() + lead; T.tEnd = T.t0 + tl.end;
  T.ev = tl.times.map((x, j) => {
    const i = r.from + j, e = t.ev[i], prev = tl.times[j - 1], next = tl.times[j + 1];
    const gp = prev != null ? x - prev : 1, gn = next != null ? next - x : 1;
    const W = Math.max(.05, Math.min(.12, gp * .45, gn * .45));
    const tg = e.n.filter(n => !n[3].includes("x")).map(n => target(t, n));
    return { i, at: T.t0 + x, W, dur: Math.min(gn, 1.5), tg, legato: e.n.every(n => /[HS]/.test(n[3])), onset: null, good: 0, bad: 0, done: false };
  });
  const all = T.ev.flatMap(x => x.tg);
  T.minF = all.length ? Math.max(38, 440 * Math.pow(2, (Math.min(...all) - 13 - 69) / 12)) : 70;
  T.maxF = all.length ? Math.min(2000, 440 * Math.pow(2, (Math.max(...all) + 2 - 69) / 12)) : 1400;
  T.beats = tl.beats.map(b => ({ at: T.t0 + b.t, acc: b.acc }));
  for (let j = 0; j < tl.countIn.n; j++) A.click(j === 0, T.t0 - (tl.countIn.n - j) * tl.countIn.dur, 1);
  T.countIn = tl.countIn; T.bi = 0; T.gi = 0; T.bk = backingList(t, tl, 0); T.ki = 0;
  staff.clearMarks(); fb.reset();
  const sk = T.ev[0]; staff.play(staff.xAt(sk.i, 0) - 30, sk.i);
  clearInterval(T.iv); T.iv = setInterval(tempoTick, 25);
}
function onsetIn(o) {
  if (!T.run) return;
  const oc = o - T.lat; let best = null, bd = 1;
  for (const x of T.ev) { if (x.done) continue; const d = Math.abs(oc - x.at); if (d <= x.W && d < bd) { bd = d; best = x; } if (x.at - oc > .5) break; }
  if (best && (best.onset == null || Math.abs(best.onset) > bd)) best.onset = oc - best.at;
}
function tempoTick() {
  if (!T.run) return;
  const now = A.now(), t = curTab();
  // clic y sonido guía
  while (T.bi < T.beats.length && T.beats[T.bi].at < now + .15) { const b = T.beats[T.bi++]; if (data.ajustes.tabClick !== false) A.click(b.acc, b.at, .8); }
  while (T.gi < T.ev.length && T.ev[T.gi].at < now + .15) { const x = T.ev[T.gi++]; if (data.ajustes.tabGuide) playEvent(t, t.ev[x.i], x.at); }
  while (T.ki < T.bk.length && T.t0 + T.bk[T.ki].s < now + .15) { const x = T.bk[T.ki++]; playBacking(x, T.t0 + x.s, t); }
  if (!T.mic) { if (now > T.tEnd + .3) passDone(); return; }
  // análisis de lo que suena (el cuadro mira ~35 ms atrás, más la latencia del micrófono)
  const ft = now - .035 - T.lat;
  const cur = T.ev.findLast ? T.ev.findLast(x => x.at + .02 <= ft) : [...T.ev].reverse().find(x => x.at + .02 <= ft);
  if (cur && !cur.done && ft < cur.at + Math.max(cur.dur, .1) && cur.tg.length) {
    if (cur.tg.length === 1) {
      const p = A.pitch({ minF: T.minF, maxF: T.maxF });
      if (p.f && p.clarity > .75) {
        const m = 69 + 12 * Math.log2(p.f / 440), d = m - cur.tg[0], dd = Math.min(...[0, 12, -12, 24].map(o => Math.abs(d - o)));
        if (dd < .5) cur.good++; else { const prev = T.ev[T.ev.indexOf(cur) - 1]; if (!(prev && prev.tg.some(q => Math.abs(m - q) < .5))) cur.bad++; }
        $("#tbHeard", el).textContent = noteName(Math.round(m));
      }
    } else {
      const fr = A.chroma();
      if (fr.on) { const s = A.cosSim(fr.chroma, tmpl(cur.tg)); if (s > .75) cur.good++; else if (s < .55) cur.bad++; $("#tbHeard", el).textContent = Math.round(s * 100) + "%"; }
    }
  }
  // calificar las notas cuya ventana ya pasó
  const nowc = now - T.lat;
  for (const x of T.ev) {
    if (x.done) continue;
    if (nowc < x.at + Math.max(x.W, Math.min(x.dur, .35)) + .06) break;
    judge(x);
  }
  if (now > T.tEnd + .4 && T.ev.every(x => x.done)) passDone();
}
function judge(x) {
  x.done = true;
  const measurable = x.dur >= .13 && x.tg.length > 0, pitchOk = x.good > 0 || !measurable;
  const hit = x.onset != null, onTime = hit && Math.abs(x.onset) <= TIGHT;
  let st;
  if (!x.tg.length) st = hit ? "ok" : "miss";
  else if (x.legato) st = x.good > 0 || (!measurable && hit) ? "ok" : hit ? "meh" : "miss";
  else if (hit && x.bad >= 2 && x.good === 0 && measurable) st = "wrong";
  else if (hit && pitchOk) st = onTime ? "ok" : "meh";
  else if (!hit && x.good >= 2) st = "meh";
  else st = hit ? "meh" : "miss";
  x.st = st;
  staff.mark(x.i, st);
  if (st === "ok") { fb.streak++; fb.best = Math.max(fb.best, fb.streak); fb.paint(fb.streak % 10 === 0); }
  else fb.show(st);
}
function frameDraw() {
  const now = A.now(), t = curTab();
  const ev = T.ev; if (!ev.length) return;
  let k = T.k; while (k + 1 < ev.length && ev[k + 1].at <= now) k++;
  if (now < ev[0].at) {
    const left = ev[0].at - now, beatsLeft = Math.ceil((T.t0 - now) / T.countIn.dur);
    if (smoothMove()) staff.play(staff.xAt(ev[0].i, 0) - Math.min(30, left * 60), ev[0].i);
    else if (staff.cur !== ev[0].i || staff.playX != null) { staff.endPlay(); staff.setCursor(ev[0].i); }
    $("#tbLab", el).textContent = now < T.t0 && beatsLeft > 0 ? `Entrada: ${beatsLeft}` : "¡Ya!";
    if (T.k !== -1 || $("#tbSub", el).dataset.c !== "in") { $("#tbSub", el).dataset.c = "in"; T.k = -1; showAt(ev[0].i); }
    return;
  }
  const a = ev[k], b = ev[k + 1], frac = b ? (now - a.at) / (b.at - a.at) : Math.min(1, (now - a.at) / .5);
  if (smoothMove()) staff.play(staff.xAt(a.i, frac), a.i);
  else if (k !== T.k) { staff.endPlay(); staff.setCursor(a.i); }
  if (k !== T.k) { T.k = k; $("#tbSub", el).dataset.c = ""; showAt(a.i); $("#tbLab", el).textContent = T.mic ? "Tocando" : "Tocando (sin calificar)"; }
}
function showAt(i) { L.view = i; show(); }
function passDone() {
  clearInterval(T.iv);
  const t = curTab(), r = T.r, p = prog(t), n = T.ev.length;
  if (!T.mic) { if (data.ajustes.tabLoop && T.run) { T.pass++; startPass(); } else tempoStop(); return; }
  const c = { ok: 0, meh: 0, wrong: 0, miss: 0 }; T.ev.forEach(x => c[x.st]++);
  const pct = n ? (c.ok + c.meh * .5) / n : 0;
  const v0 = T.speed; let v1 = v0, note = "";
  if (data.ajustes.tabAuto !== false) {
    if (pct >= .9 && v0 < 1) { v1 = Math.min(1, v0 + .05); note = `Sube a ${Math.round(v1 * 100)}%.`; }
    else if (pct < .7 && v0 > .3) { v1 = Math.max(.3, v0 - .05); note = `Baja a ${Math.round(v1 * 100)}% para afianzarla.`; }
    else note = pct >= .9 ? "¡Ya la tocas a velocidad original!" : "Se queda la velocidad.";
  }
  p.tempo = p.tempo || {};
  const rec = p.tempo[r.key];
  // mejor vuelta: la más rápida con 90% o más; si aún no hay una así, la de mayor porcentaje
  const better = !rec || (pct >= .9 ? (rec.pct < .9 || v0 > rec.vel) : (rec.pct < .9 && pct > rec.pct));
  p.tempo[r.key] = { pct: better ? pct : rec.pct, vel: better ? v0 : rec.vel, pasadas: (rec?.pasadas || 0) + 1, t: Date.now() };
  if (v1 !== v0) setVel(t, v1); else save();
  paintVel();
  // compás con más errores
  const byBar = {}; T.ev.forEach(x => { if (x.st === "wrong" || x.st === "miss") { const bar = t.ev[x.i].c; byBar[bar] = (byBar[bar] || 0) + 1; } });
  const worst = Object.entries(byBar).sort((a, b) => b[1] - a[1])[0];
  const parts = [`<b>${Math.round(pct * 100)}%</b> bien a ${Math.round(v0 * 100)}% de velocidad`, `${c.ok} a tiempo`];
  if (c.meh) parts.push(`${c.meh} tarde, temprano o sin ataque claro`); if (c.wrong) parts.push(`${c.wrong} ${c.wrong === 1 ? "equivocada" : "equivocadas"}`); if (c.miss) parts.push(`${c.miss} sin tocar`);
  const msg = parts.join(" · ") + (note ? ". " + note : "");
  const worstBtn = worst && worst[1] >= 2 ? `<button class="btn small" id="tbFix" data-bar="${worst[0]}">Aprender el compás ${+worst[0] + 1}</button>` : "";
  $("#tbProg", el).innerHTML = `<div class="row between" style="gap:10px"><span>${msg}</span>${worstBtn}</div>`;
  const fix = $("#tbFix", el);
  if (fix) fix.onclick = () => { stopAll(); const bar = +fix.dataset.bar; p.sel = { a: bar, b: bar, custom: true }; p.pos = null; p.modo = "aprender"; save(); render(); };
  toast(`${Math.round(pct * 100)}% bien${note ? " · " + note : ""}`);
  if (data.ajustes.tabLoop && T.run) { T.pass++; setTimeout(() => { if (T.run) startPass(); }, 1500); }
  else tempoStop(true);
}
function tempoStop(keepMsg) {
  clearInterval(T.iv); cancelAnimationFrame(T.raf); T.run = false; A.stopOnsets(); A.keepAwake(false);
  const min = (performance.now() - T.startedAt) / 60000;
  if (min >= .5) logSession(Math.round(min * 10) / 10, "tabs"); else save();
  staff.endPlay();
  $("#tbStage", el).classList.remove("live"); $("#tbStart", el).textContent = "Empezar";
  el.querySelectorAll(".tbvel button").forEach(b => b.disabled = false);
  $("#tbLab", el).textContent = "Listo"; $("#tbHeard", el).textContent = "–";
  const t = curTab(), r = range(t); L.view = r.from; staff.setCursor(r.from, true); show();
  if (keepMsg !== true) renderProgIdle();
}

export const _tempoState = () => T;   // para pruebas
