// Entrenador de rasgueo: patrones en corcheas, semicorcheas o tresillos, sonido guía, tempo que sube
// poco a poco y calificación del tiempo de cada golpe con el micrófono.
import { data, save, toast, esc, practiceStart, practiceEnd, $ } from "../store.js";
import { CHORDS, diagram } from "../chords.js";
import * as A from "../audio.js";
import { Highway, Feedback, swapText } from "../ui/highway.js";
import { openMicSettings, warnGuideEcho } from "../ui/calib.js";

let el, hw, fb, micWarned = false;
// Cada casilla es una subdivisión. d/D = abajo (mayúscula = acento), u/U = arriba, x = golpe apagado, - = la mano pasa sin tocar.
export const PATTERNS = [
  { id: "negras", nombre: "Negras", nivel: 1, spb: 2, p: "d-d-d-d-", bpm: 70, desc: "Un golpe abajo por tiempo. La mano sube y baja sin parar aunque en la subida no toques: ese movimiento constante es la base de todo lo demás." },
  { id: "pop", nombre: "Pop básico", nivel: 1, spb: 2, p: "d-du-udu", bpm: 70, desc: "Abajo, abajo-arriba, arriba-abajo-arriba. Sirve para casi cualquier canción pop o balada. Fíjate que en el 3 la mano baja sin tocar." },
  { id: "balada", nombre: "Balada", nivel: 1, spb: 2, p: "D-d-dudu", bpm: 66, desc: "Dos golpes largos y luego abajo-arriba-abajo-arriba. Acentúa el primer tiempo." },
  { id: "country", nombre: "Country: bajo y rasgueo", nivel: 2, spb: 2, p: "b-dub-du", bpm: 90, desc: "El 'bum-chaca' del country: en 1 y 3 tocas solo la cuerda más grave del acorde (●) y en 2 y 4 rasgueas abajo-arriba. La mano derecha nunca se detiene." },
  { id: "boomchicka", nombre: "Boom-chicka (Johnny Cash)", nivel: 2, spb: 2, p: "b-d-b-d-", bpm: 100, desc: "Bajo y golpe, bajo y golpe, como un tren. Apaga un poco las cuerdas con la palma para que el golpe suene corto." },
  { id: "reggae", nombre: "Reggae: golpe en 2 y 4", nivel: 2, spb: 2, p: "--D---D-", bpm: 76, desc: "Un golpe corto y seco en el 2 y en el 4; los tiempos 1 y 3 quedan en silencio. Apaga las cuerdas justo después de cada golpe para que suene 'chak'." },
  { id: "rock8", nombre: "Rock en corcheas", nivel: 2, spb: 2, p: "duDuduDu", bpm: 90, desc: "Corcheas continuas con acento en 2 y 4, donde suena la tarola. Ideal con power chords." },
  { id: "ska", nombre: "Contratiempo (ska)", nivel: 2, spb: 2, p: "-U-U-U-U", bpm: 90, desc: "Solo los arriba, en los 'y'. La mano baja en silencio en cada tiempo. Corto y seco: apaga las cuerdas justo después de cada golpe." },
  { id: "rapido", nombre: "Corcheas abajo (punk/metal)", nivel: 3, spb: 4, p: "d-d-d-d-d-d-d-d-", bpm: 110, desc: "Todo hacia abajo, en corcheas. Con palm mute y muñeca suelta; si te cansas, el tempo está muy alto." },
  { id: "galope", nombre: "Galope", nivel: 3, spb: 4, p: "D-dud-duD-dud-du", bpm: 90, desc: "Abajo, abajo-arriba en cada tiempo (1, y-a): el ritmo de muchos riffs de heavy metal. Hazlo con palm mute." },
  { id: "shuffle", nombre: "Shuffle de blues", nivel: 3, spb: 3, p: "d-ud-ud-ud-u", bpm: 80, desc: "Tresillos con swing: largo-corto, largo-corto. Piensa en 'tum-ta, tum-ta'." },
  { id: "funk1", nombre: "Funk 1: semicorcheas parejas", nivel: 4, spb: 4, p: "DudududuDudududu", bpm: 70, desc: "Todas las semicorcheas, con acento en 1 y 3. Primero consigue que suenen parejas; después sube el tempo." },
  { id: "funk2", nombre: "Funk 2: golpe apagado en 2 y 4", nivel: 4, spb: 4, p: "DuduxuduDuduxudu", bpm: 75, desc: "Como el anterior, pero en 2 y 4 apagas las cuerdas con la mano del rasgueo (chuck). Es el sonido funky básico." },
  { id: "funk3", nombre: "Funk 3: sincopado", nivel: 5, spb: 4, p: "D--ux-du-ud-x-du", bpm: 70, desc: "Muchos golpes caen fuera del tiempo. La clave: la mano sigue bajando y subiendo en semicorcheas aunque no toques." },
];
const COUNT = { 2: ["", "y"], 3: ["", "y", "a"], 4: ["", "e", "y", "a"] };
// b = bajo: la nota más grave del acorde, sola (el "bum" del country)
const SYMBOL = { d: "↓", D: "↓", u: "↑", U: "↑", x: "✕", b: "●", "-": "·" };
const valid = (p, spb) => [...p].every((c, i) => spb === 3 || c === "-" || c === "x" || (i % 2 === 0 ? "dDb".includes(c) : "uU".includes(c)));

const store = () => { data.rasgueos = data.rasgueos || { custom: [], prog: {} }; return data.rasgueos; };
const all = () => [...PATTERNS, ...(store().custom || [])];
export const allPatterns = () => all();
export const patternById = id => all().find(p => p.id === id) || null;
export const STRUM_SYMBOL = SYMBOL;
const curP = () => all().find(p => p.id === data.ajustes.rasgueoId) || PATTERNS[1];
const prog = id => store().prog[id] || { bpm: (all().find(p => p.id === id) || PATTERNS[1]).bpm, best: 0, hist: [] };
const clampB = v => Math.max(40, Math.min(220, Math.round(v)));

const R = { run: false, timer: null, next: 0, k: 0, t0: 0, bars: 0, hits: [], onsets: [], listen: false, bpm: 70, total: 0, chordAt: null, lastUi: -1, ramp: false };

/* ---------- Montaje ---------- */
export function mountRasgueo(container) {
  el = container;
  el.innerHTML = `
  <div class="cols" style="--cols:minmax(0,1.5fr) minmax(0,1fr)">
  <div class="col">
  <div class="panel deck-panel screen">
   <div class="deck">
    <div class="deck-top">
      <select id="rgPick" aria-label="Elegir patrón"></select>
      <span class="deck-tempo"><span id="rgBpm"></span><small>BPM</small></span>
      <button class="btn small" data-rd="-5" aria-label="Bajar 5 BPM">−5</button><button class="btn small" data-rd="5" aria-label="Subir 5 BPM">+5</button>
    </div>
    <div class="sgrid" id="rgGrid"></div>
    <div id="rgHwy"></div>
    <div class="stage dstage" id="rgStage" aria-live="polite">
      <div class="meta">
        <span class="lab" id="rgLab">Listo</span>
        <div class="now"><span class="chordnow" id="rgChord"></span><span class="stage-chord" id="rgDiag"></span></div>
        <span class="sub" id="rgSub"></span>
      </div>
      <div class="nextbox" id="rgNextBox" hidden><span class="lab">Sigue</span><span class="nxt" id="rgNext"></span></div>
    </div>
    <div class="panel hl" id="rgResult" hidden></div>
    <div class="deck-ctl">
      <select id="rgChords" aria-label="Acordes" style="max-width:190px"></select>
      <select id="rgLen" aria-label="Duración"><option value="8">8 compases</option><option value="16">16 compases</option><option value="m1">1 minuto</option><option value="m2">2 minutos</option><option value="m3">3 minutos</option><option value="m5">5 minutos</option><option value="0">Sin fin</option></select>
      <label class="chip-toggle"><input type="checkbox" id="rgGuide" checked> Sonido guía</label>
      <label class="chip-toggle" id="rgRampRow"><input type="checkbox" id="rgRamp"> +2 BPM cada 4 compases</label>
      <label class="chip-toggle"><input type="checkbox" id="rgMic"> Calificar con micrófono</label>
      <button class="btn small ghost" id="rgCal">Micrófono</button>
      <button class="btn primary" id="rgStart" data-primary>Empezar</button>
    </div>
   </div>
  </div>
  </div>
  <div class="col">
  <div class="panel">
    <div class="row between" style="align-items:flex-start"><div style="min-width:0"><div class="label" id="rgLevel"></div><h2 id="rgName"></h2></div><span class="chip acc" id="rgBest"></span></div>
    <p class="note" id="rgDesc"></p>
    <p class="note" id="rgLatState"></p>
  </div>
  <div class="panel" id="rgHist"></div>
  <div class="panel">
    <div class="label">Patrones</div>
    <div class="pgrid" id="rgList"></div>
  </div>
  <div class="panel" id="rgEditor"></div>
  </div>
  </div>`;
  hw = new Highway($("#rgHwy", el), { mode: "hits" });
  fb = new Feedback($("#rgStage", el));
  $("#rgPick", el).onchange = e => { if (R.run) return; data.ajustes.rasgueoId = e.target.value; save(); render(); };
  $("#rgChords", el).onchange = e => { data.ajustes.rasgueoAcordes = e.target.value; save(); idle(); };
  $("#rgLen", el).onchange = e => { data.ajustes.rasgueoLen = e.target.value; save(); $("#rgRampRow", el).hidden = e.target.value !== "0"; };
  el.querySelectorAll("[data-rd]").forEach(b => b.onclick = () => setBpm(R.bpm + +b.dataset.rd, true));
  $("#rgGuide", el).onchange = e => { data.ajustes.rasgueoGuia = e.target.checked; save(); };
  $("#rgMic", el).onchange = e => { data.ajustes.rasgueoMic = e.target.checked; save(); };
  $("#rgStart", el).onclick = toggle;
  $("#rgCal", el).onclick = () => { if (!R.run) openMicSettings({ rhythm: true, title: "Micrófono y calibración", onDone: latState }); };
  window.addEventListener("riff:stop-rasgueo", () => R.run && stop(true));
  render();
}
export function showRasgueo(id) { if (!R.run && all().some(p => p.id === id)) { data.ajustes.rasgueoId = id; save(); render(); } }

function render() {
  const p = curP(), g = prog(p.id);
  $("#rgLevel", el).textContent = `Nivel ${p.nivel || "·"} · ${p.spb === 4 ? "semicorcheas" : p.spb === 3 ? "tresillos" : "corcheas"}`;
  $("#rgName", el).textContent = p.nombre;
  const groups = {}; all().forEach(x => { const k = x.custom ? "Tus patrones" : "Nivel " + x.nivel; (groups[k] = groups[k] || []).push(x); });
  $("#rgPick", el).innerHTML = Object.entries(groups).map(([k, xs]) => `<optgroup label="${k}">${xs.map(x => `<option value="${x.id}" ${x.id === p.id ? "selected" : ""}>${esc(x.nombre)}</option>`).join("")}</optgroup>`).join("");
  $("#rgDesc", el).textContent = p.desc || ""; latState();
  $("#rgBest", el).textContent = g.best ? `Mejor: ${g.best} BPM limpio` : "Sin marca aún";
  setBpm(g.bpm, false);
  const sel = $("#rgChords", el), cur = data.ajustes.rasgueoAcordes || "c:Em";
  sel.innerHTML = `<optgroup label="Un acorde">${Object.keys(CHORDS).map(c => `<option value="c:${esc(c)}">${esc(c)}</option>`).join("")}</optgroup>
    <optgroup label="Secuencias">${(data.secuencias || []).filter(q => q.acordes.length > 1).map(q => `<option value="s:${q.id}">${esc(q.nombre)}</option>`).join("")}</optgroup>`;
  sel.value = cur; if (!sel.value) sel.value = "c:Em";
  $("#rgLen", el).value = data.ajustes.rasgueoLen || "8"; $("#rgRampRow", el).hidden = $("#rgLen", el).value !== "0";
  $("#rgGuide", el).checked = data.ajustes.rasgueoGuia !== false;
  $("#rgMic", el).checked = data.ajustes.rasgueoMic !== false;
  grid(-1); idle(); renderList(); renderHist(); renderEditor();
}
function setBpm(v, persist) {
  R.bpm = clampB(v); $("#rgBpm", el).textContent = R.bpm;
  if (persist && !R.run) { const p = curP(), s = store(); s.prog[p.id] = { ...prog(p.id), bpm: R.bpm }; save(); }
  if (!R.run && hw && persist) idle();
}
function grid(active, marks) {
  const p = curP(), cnt = COUNT[p.spb];
  $("#rgGrid", el).style.setProperty("--n", p.p.length); $("#rgGrid", el).style.setProperty("--half", p.p.length / 2);
  $("#rgGrid", el).innerHTML = [...p.p].map((c, i) => {
    const beat = Math.floor(i / p.spb) + 1, sub = i % p.spb, lab = sub === 0 ? beat : cnt[sub];
    const m = marks && marks[i];
    return `<div class="scell ${c === "-" ? "rest" : ""} ${"DU".includes(c) ? "acc" : ""} ${c === "x" ? "mute" : ""} ${c === "b" ? "bass" : ""} ${i === active ? "on" : ""} ${sub === 0 ? "beat" : ""}">
      <span class="sym">${SYMBOL[c]}</span><span class="cnt">${lab}</span>${m ? `<span class="dev ${m.cls}" title="${m.title}">${m.txt}</span>` : ""}</div>`;
  }).join("");
}
function chordPlan() {
  const v = $("#rgChords", el).value || "c:Em";
  if (v.startsWith("c:")) { const c = v.slice(2); return { name: c, at: () => c, next: () => c }; }
  const q = (data.secuencias || []).find(x => x.id === v.slice(2));
  if (!q) return { name: "Em", at: () => "Em", next: () => "Em" };
  const total = q.acordes.reduce((s, a) => s + a.t, 0);
  const find = b => { let p = ((b % total) + total) % total; for (let i = 0; i < q.acordes.length; i++) { if (p < q.acordes[i].t) return i; p -= q.acordes[i].t; } return 0; };
  return { name: q.nombre, at: b => q.acordes[find(b)].c, next: b => q.acordes[(find(b) + 1) % q.acordes.length].c };
}
function latState() {
  const L = data.ajustes.latenciaMic;
  $("#rgLatState", el).innerHTML = L != null ? `<b>Ritmo calibrado:</b> tu micrófono tarda ${Math.round(L * 1000)} ms. La calificación ya lo toma en cuenta.` : `<b>Ritmo sin calibrar.</b> La app estima el retraso del micrófono en cada ronda; calibrarlo una vez la hace más exacta, sobre todo en semicorcheas.`;
}
function showChord(c, nx) {
  if ($("#rgChord", el).textContent !== c) { swapText($("#rgChord", el), c); $("#rgDiag", el).innerHTML = CHORDS[c] ? diagram(c) : ""; }
  $("#rgNextBox", el).hidden = !nx; $("#rgNext", el).textContent = nx || "";
}
function idle() {
  const plan = chordPlan(), c = plan.at(0);
  $("#rgStage", el).classList.remove("live"); $("#rgLab", el).textContent = "Listo";
  showChord(c, plan.next(0) !== c ? plan.next(0) : null);
  $("#rgSub", el).textContent = `Un compás de entrada y luego el patrón. ${$("#rgGuide", el).checked ? "El sonido guía toca contigo." : "Solo clic."}`;
  if (!R.run && hw) {
    fb.reset();
    const p = curP(), dt = 60 / R.bpm / p.spb, list = [];
    for (let k = 0, t = .3; t < 12; k++, t += dt) { const c = p.p[k % p.p.length]; if (c !== "-") list.push({ id: "p" + k, t, sym: SYMBOL[c], acc: "DU".includes(c) }); }
    hw.preview(list);
  }
}

/* ---------- Lista y editor ---------- */
function mini(p) { return [...p.p].map((c, i) => `${i && i % p.spb === 0 ? " " : ""}${SYMBOL[c]}`).join(""); }
function renderList() {
  const cur = curP();
  $("#rgList", el).innerHTML = all().map(p => {
    const g = prog(p.id);
    return `<button class="pcard ${p.id === cur.id ? "on" : ""}" data-pat="${p.id}">
      <span class="row between" style="width:100%"><b>${esc(p.nombre)}</b><span class="chip">${p.custom ? "Tuyo" : "Nivel " + p.nivel}</span></span>
      <span class="num pmini">${mini(p)}</span>
      <span class="note">${g.best ? `Mejor ${g.best} BPM · ` : ""}tempo actual ${g.bpm} BPM</span></button>`;
  }).join("");
  el.querySelectorAll("[data-pat]").forEach(b => b.onclick = () => { if (R.run) return; data.ajustes.rasgueoId = b.dataset.pat; save(); render(); });
}
let draft = null;
function renderEditor() {
  const box = $("#rgEditor", el), cur = curP();
  if (!draft) {
    box.innerHTML = `<div class="label">Tus patrones</div>
      <p class="note">Crea el rasgueo de una canción: toca cada casilla para cambiarla entre abajo, acento, apagado y silencio.</p>
      <div class="row"><button class="btn small" id="peNew">Crear patrón</button>${cur.custom ? `<button class="btn small" id="peEdit">Editar este</button><button class="btn small" id="peDel">Borrar este</button>` : ""}</div>`;
    $("#peNew", box).onclick = () => { draft = { id: "r" + Date.now(), nombre: "Mi patrón", spb: 2, p: "d-du-udu", bpm: 70, nivel: 0, custom: true, isNew: true }; renderEditor(); };
    $("#peEdit", box)?.addEventListener("click", () => { draft = { ...cur }; renderEditor(); });
    let armed = false;
    $("#peDel", box)?.addEventListener("click", e => {
      if (!armed) { armed = true; e.target.textContent = "¿Seguro?"; setTimeout(() => { armed = false; if (e.target.isConnected) e.target.textContent = "Borrar este"; }, 3000); return; }
      const s = store(); s.custom = s.custom.filter(x => x.id !== cur.id); data.ajustes.rasgueoId = "pop"; save(); render(); toast("Patrón borrado");
    });
    return;
  }
  const d = draft, cnt = COUNT[d.spb];
  box.innerHTML = `<div class="label">${d.isNew ? "Nuevo patrón" : "Editar patrón"}</div>
    <div class="grid2">
      <label for="peName">Nombre<input type="text" id="peName" maxlength="40" value="${esc(d.nombre)}"></label>
      <label for="peSpb">Subdivisión<select id="peSpb"><option value="2">Corcheas (1 y)</option><option value="4">Semicorcheas (1 e y a)</option><option value="3">Tresillos (1 y a)</option></select></label>
    </div>
    <div class="sgrid edit" style="--n:${d.p.length};--half:${d.p.length / 2}">${[...d.p].map((c, i) => { const sub = i % d.spb; return `<button class="scell ${c === "-" ? "rest" : ""} ${"DU".includes(c) ? "acc" : ""} ${c === "x" ? "mute" : ""} ${c === "b" ? "bass" : ""} ${sub === 0 ? "beat" : ""}" data-cell="${i}" aria-label="Casilla ${i + 1}"><span class="sym">${SYMBOL[c]}</span><span class="cnt">${sub === 0 ? Math.floor(i / d.spb) + 1 : cnt[sub]}</span></button>`; }).join("")}</div>
    <p class="note">Toca una casilla: ${d.spb === 3 ? "abajo → acento → arriba → apagado → nada" : "en los tiempos y los 'y' la mano va abajo; en los 'e' y 'a', arriba"}. Mayúscula = acento.</p>
    <div class="row"><button class="btn primary small" id="peSave">Guardar</button><button class="btn small" id="peCancel">Cancelar</button><button class="btn small" id="peHear">▶ Escuchar</button></div>`;
  $("#peSpb", box).value = String(d.spb);
  $("#peName", box).oninput = e => d.nombre = e.target.value;
  $("#peSpb", box).onchange = e => { const n = +e.target.value; d.spb = n; d.p = n === 4 ? "d-du-udud-du-udu" : n === 3 ? "d-ud-ud-ud-u" : "d-du-udu"; renderEditor(); };
  box.querySelectorAll("[data-cell]").forEach(b => b.onclick = () => {
    const i = +b.dataset.cell, c = d.p[i];
    const cyc = d.spb === 3 ? ["d", "D", "b", "u", "x", "-"] : i % 2 === 0 ? ["d", "D", "b", "x", "-"] : ["u", "U", "x", "-"];
    const nx = cyc[(cyc.indexOf(c) + 1) % cyc.length];
    d.p = d.p.slice(0, i) + nx + d.p.slice(i + 1); renderEditor();
  });
  $("#peCancel", box).onclick = () => { draft = null; renderEditor(); };
  $("#peHear", box).onclick = () => preview(d);
  $("#peSave", box).onclick = () => {
    if (!/[dDuUx]/.test(d.p)) { toast("El patrón necesita al menos un golpe"); return; }
    const s = store(), item = { id: d.id, nombre: (d.nombre || "").trim() || "Mi patrón", spb: d.spb, p: d.p, bpm: d.bpm || 70, nivel: 0, custom: true, desc: "Patrón creado por ti." };
    const i = s.custom.findIndex(x => x.id === d.id); if (i >= 0) s.custom[i] = item; else s.custom.push(item);
    data.ajustes.rasgueoId = item.id; draft = null; save(); render(); toast("Patrón guardado");
  };
}
function preview(p) {
  const a = A.ctx(); if (!a) return;
  const slot = 60 / 80 / p.spb, t0 = a.currentTime + .1, frets = (CHORDS.Em).f;
  for (let bar = 0; bar < 2; bar++) [...p.p].forEach((c, i) => playHit(c, frets, t0 + (bar * p.p.length + i) * slot, slot));
}

/* ---------- Sonido y reproducción ---------- */
export function playHit(c, frets, t, slot) {
  if (c === "-") return;
  if (c === "x") { A.chuck(t, .45); return; }
  if (c === "b") {   // bajo: la cuerda más grave que suena en el acorde
    const i = [...frets].findIndex(f => f !== "x"); if (i < 0) return;
    A.pluck(A.TUNING[i] + +frets[i], t, .42, Math.max(.4, Math.min(1.4, slot * 2.5))); return;
  }
  const acc = c === "D" || c === "U", down = c === "d" || c === "D";
  const dur = Math.max(.25, Math.min(1.6, slot * 2.2));
  A.strum(down ? frets : frets.slice(0, 6), t, { down, gap: down ? .011 : .009, vol: (down ? .22 : .15) * (acc ? 1.6 : 1), dur });
}
async function toggle() {
  if (R.run) {
    // detenida antes de terminar: con dos compases o más, se califica lo que alcanzaste a tocar
    if (R.bars >= 2 && !R.finishing) { const now = A.now(); R.hits = R.hits.filter(h => h.t < now - .1); R.partial = true; R.finishing = true; finishAt(now); return; }
    stop(true); return;
  }
  R.partial = false; R.finishing = false;
  const a = A.ctx(); if (!a) return;
  R.listen = $("#rgMic", el).checked;
  if (R.listen) {
    if (!A.mic.an) { $("#rgLab", el).textContent = "Silencia las cuerdas"; $("#rgSub", el).textContent = "Midiendo el ruido del cuarto…"; }
    if (!(await A.micOn())) {
      if (!micWarned) { toast("Sin micrófono: la ronda sigue sin calificación automática"); micWarned = true; }
      R.listen = false;
    }
  }
  window.dispatchEvent(new Event("riff:stop-audio")); window.dispatchEvent(new Event("riff:stop-cambios")); window.dispatchEvent(new Event("riff:stop-seq"));
  const p = curP(); R.pat = p; R.plan = chordPlan();
  // Duración: compases, o minutos convertidos a compases completos al tempo actual
  const lenV = $("#rgLen", el).value || "8";
  R.len = lenV.startsWith("m") ? Math.max(1, Math.ceil(+lenV.slice(1) * R.bpm / (p.p.length / p.spb))) : +lenV; R.ramp = R.len === 0 && $("#rgRamp", el).checked; R.guide = $("#rgGuide", el).checked;
  R.slotsPerBar = p.p.length; R.beatsPerBar = p.p.length / p.spb;
  const beat = 60 / R.bpm;
  R.k = -R.beatsPerBar * p.spb;   // compás de entrada, en casillas
  R.next = a.currentTime + .12; R.t0 = R.next + R.beatsPerBar * beat;
  R.hits = []; R.onsets = []; R.sched = []; R.bars = 0; R.lat = data.ajustes.latenciaMic ?? .06; R.latAt = 0; R.jIdx = 0; R.used = new Set(); R.barStat = {};
  R.hitsPerBar = [...p.p].filter(c => c !== "-").length;
  hw.reset(); fb.reset(); hw.tickOffset = R.lat;
  hw.addMany(projectHits(0, R.t0, R.bpm, R.len ? Infinity : R.t0 + 14));
  hw.run(() => A.now()); R.lastUi = -1; R.startBpm = R.bpm;
  if (R.listen && R.guide) warnGuideEcho();
  if (R.listen) A.startOnsets(t => { R.onsets.push(t); hw.tick(t, "hit"); });
  R.run = true; practiceStart("rasgueo"); $("#rgStage", el).classList.add("live"); $("#rgStart", el).textContent = "Detener"; $("#rgResult", el).hidden = true;
  R.timer = setInterval(tick, 25); A.keepAwake(true); tick();
}
function stop(cancel) {
  practiceEnd("rasgueo");
  R.run = false; clearInterval(R.timer); hw.stop(); A.keepAwake(false); if (R.listen) setTimeout(A.stopOnsets, 300);
  $("#rgStart", el).textContent = "Empezar"; $("#rgStage", el).classList.remove("live");
  if (cancel) {
    grid(-1); idle();
    if (R.len === 0 && R.bpm !== R.startBpm) setBpm(R.bpm, true);
  }
}
function tick() {
  const a = A.ctx(), now = a.currentTime, p = R.pat, spb = p.spb;
  while (R.next < now + .12) {
    const slotDur = 60 / R.bpm / spb;
    if (R.k < 0) {   // entrada: clics en cada tiempo
      const sub = ((R.k % spb) + spb) % spb;
      if (sub === 0) A.beep(R.k === -R.beatsPerBar * spb ? 1300 : 900, .05, R.next, .4);
    } else {
      const i = R.k % R.slotsPerBar, bar = Math.floor(R.k / R.slotsPerBar), beatIdx = bar * R.beatsPerBar + Math.floor(i / spb);
      if (R.len && bar >= R.len) { finishAt(R.next); return; }
      if (i % spb === 0) A.click(i === 0, R.next, R.guide ? .55 : 1);
      const c = p.p[i];
      R.sched.push({ t: R.next, i, beatIdx, bar });
      if (R.guide) playHit(c, CHORDS[R.plan.at(beatIdx)]?.f || CHORDS.Em.f, R.next, slotDur);
      if (c !== "-") R.hits.push({ t: R.next, i, c, k: R.k });
      if (i === 0 && bar > 0) {
        R.bars = bar;
        if (R.ramp && bar % 4 === 0) setBpm(R.bpm + 2, false);
        if (!R.len) hw.replaceFuture(projectHits(R.k, R.next, R.bpm, R.next + 14), R.next);
      }
    }
    R.next += 60 / R.bpm / spb; R.k++;
  }
  liveJudge(now);
  // Interfaz
  if (now < R.t0) {
    const n = Math.floor((now - (R.t0 - R.beatsPerBar * 60 / R.bpm)) / (60 / R.bpm)) + 1;
    $("#rgLab", el).textContent = "Entrada"; showChord(R.plan.at(0), null);
    $("#rgSub", el).textContent = `Empieza en ${R.beatsPerBar - Math.max(1, Math.min(R.beatsPerBar, n)) + 1}…`; return;
  }
  // La casilla que suena ahora es la última programada cuyo tiempo ya pasó (funciona aunque el tempo suba)
  let cur = null; while (R.sched.length && R.sched[0].t <= now) cur = R.sched.shift();
  if (cur && cur.i !== R.lastUi) {
    R.lastUi = cur.i; grid(cur.i);
    const c = R.plan.at(cur.beatIdx), nx = R.plan.next(cur.beatIdx);
    showChord(c, nx !== c ? nx : null);
    $("#rgLab", el).textContent = R.len ? `Compás ${Math.min(cur.bar + 1, R.len)} de ${R.len}` : `Compás ${cur.bar + 1}`;
    $("#rgSub", el).textContent = `${R.bpm} BPM`;
    $("#rgBpm", el).textContent = R.bpm;
  }
}
// Fichas del carril para los golpes que vienen
function projectHits(fromK, fromT, bpm, until) {
  const p = R.pat, out = [], dt = 60 / bpm / p.spb; let k = fromK, t = fromT;
  while (t < until) {
    if (k >= 0) {
      const i = k % R.slotsPerBar, bar = Math.floor(k / R.slotsPerBar); if (R.len && bar >= R.len) break;
      const c = p.p[i]; if (c !== "-") out.push({ id: "h" + k, t, sym: SYMBOL[c], acc: "DU".includes(c) });
    }
    k++; t += dt;
  }
  return out;
}
// Calificación al momento: cada golpe se busca entre lo detectado en cuanto termina su ventana.
// El retraso del micrófono se estima con los golpes que ya pasaron y se actualiza cada medio segundo.
function liveJudge(now) {
  if (!R.listen) return;
  const slotDur = 60 / R.bpm / R.pat.spb, win = Math.min(slotDur * .4, .07);
  if (now - R.latAt > .5) {
    const past = R.hits.filter(h => h.t < now - .25);
    if (past.length >= 8) { R.lat = analyze(past, R.onsets, slotDur).latency; hw.tickOffset = R.lat; }
    R.latAt = now;
  }
  while (R.jIdx < R.hits.length && R.hits[R.jIdx].t + R.lat + win < now - .03) {
    const h = R.hits[R.jIdx++], t = h.t + R.lat; let bi = -1, bd = win;
    R.onsets.forEach((o, k) => { if (R.used.has(k)) return; const d = Math.abs(o - t); if (d < bd) { bd = d; bi = k; } });
    let st = "miss";
    if (bi >= 0) { R.used.add(bi); const err = (R.onsets[bi] - t) * 1000; st = Math.abs(err) <= 25 ? "ok" : err < 0 ? "early" : "late"; }
    hw.mark("h" + h.k, st);
    const bar = Math.floor(h.k / R.slotsPerBar), b = R.barStat[bar] || (R.barStat[bar] = { n: 0, miss: 0, off: 0 });
    b.n++; if (st === "miss") b.miss++; else if (st !== "ok") b.off++;
    if (b.n === R.hitsPerBar) fb.show(b.miss ? "miss" : b.off > 1 ? "meh" : "ok");
  }
}
function finishAt(tEnd) {
  clearInterval(R.timer);
  const wait = Math.max(0, (tEnd - A.now()) * 1000) + 350;   // deja que el último golpe se escuche y se detecte
  setTimeout(() => { R.finishing = false; liveJudge(A.now() + 1); stop(false); A.chime(); $("#rgLab", el).textContent = R.partial ? `Ronda detenida en el compás ${R.bars + 1}` : "Ronda terminada"; $("#rgSub", el).textContent = R.listen ? "Mira tu resultado abajo" : "¿Cómo te salió?"; grade(); }, wait);
}

/* ---------- Calificación ---------- */
// La latencia del micrófono es desconocida (varía por equipo), así que se estima: se busca el desfase que
// alinea más golpes detectados con los esperados. Después se mide qué tan parejo vas respecto a ese desfase.
export function analyze(hits, onsets, slotDur, prior = data.ajustes.latenciaMic) {
  const win = Math.min(slotDur * .4, .07);
  // Patrones muy parejos (semicorcheas continuas) encajan igual de bien corridos una casilla, así que el
  // desfase se busca solo en un rango realista y, entre opciones casi empatadas, gana el más cercano a 60 ms.
  const cands = [];
  const lo = prior != null ? prior - .05 : -.04, hi = prior != null ? prior + .05 : .2, center = prior != null ? prior : .06;
  for (let L = lo; L <= hi; L += .002) {
    let score = 0, err = 0, j = 0;
    for (const h of hits) {
      const t = h.t + L;
      while (j < onsets.length && onsets[j] < t - win) j++;
      if (j < onsets.length && Math.abs(onsets[j] - t) < win) { score++; err += Math.abs(onsets[j] - t); }
    }
    cands.push({ L, score, err: score ? err / score : Infinity });
  }
  const top = Math.max(...cands.map(c => c.score));
  const near = cands.filter(c => c.score >= top * .97);
  // dentro de los casi empatados, primero el de menor error medio; si hay varios grupos separados, el más cercano a 60 ms
  near.sort((a, b) => (Math.abs(a.L - center) - Math.abs(b.L - center)));
  const region = near.filter(c => Math.abs(c.L - near[0].L) < win);
  region.sort((a, b) => b.score - a.score || a.err - b.err);
  const bestL = region.length ? region[0].L : 0;
  const used = new Set(), res = hits.map(h => {
    const t = h.t + bestL; let bi = -1, bd = win;
    onsets.forEach((o, k) => { const d = Math.abs(o - t); if (d < bd && !used.has(k)) { bd = d; bi = k; } });
    if (bi >= 0) { used.add(bi); return { ...h, ok: true, err: (onsets[bi] - t) * 1000 }; }
    return { ...h, ok: false };
  });
  const first = hits.length ? hits[0].t + bestL - win : 0, last = hits.length ? hits[hits.length - 1].t + bestL + win : 0;
  const extra = onsets.filter((o, k) => !used.has(k) && o > first && o < last).length;
  const errs = res.filter(r => r.ok).map(r => r.err);
  const mean = errs.reduce((s, x) => s + x, 0) / (errs.length || 1);
  const sd = Math.sqrt(errs.reduce((s, x) => s + (x - mean) ** 2, 0) / (errs.length || 1));
  return { res, matched: errs.length, total: hits.length, extra, sd, latency: bestL };
}
function grade() {
  const p = R.pat, box = $("#rgResult", el), slotDur = 60 / R.bpm / p.spb, g = prog(p.id);
  if (R.listen) {
    const an = analyze(R.hits, R.onsets, slotDur), hitRate = an.total ? an.matched / an.total : 0;
    const cnt = COUNT[p.spb], name = i => { const sub = i % p.spb; return sub === 0 ? `el ${Math.floor(i / p.spb) + 1}` : `la "${cnt[sub]}" del ${Math.floor(i / p.spb) + 1}`; };
    // Promedio de desvío por casilla del patrón
    const per = {}; an.res.forEach(r => { const s = per[r.i] || (per[r.i] = { n: 0, ok: 0, sum: 0 }); s.n++; if (r.ok) { s.ok++; s.sum += r.err; } });
    const meanAll = an.res.filter(r => r.ok).reduce((s, r) => s + r.err, 0) / (an.matched || 1);
    const marks = {}; let worst = null;
    Object.entries(per).forEach(([i, s]) => {
      const miss = 1 - s.ok / s.n, dev = s.ok ? s.sum / s.ok - meanAll : 0;
      const cls = miss > .3 ? "bad" : Math.abs(dev) > 20 ? "warn" : "good";
      marks[i] = { cls, txt: miss > .3 ? `${Math.round(miss * 100)}%✕` : `${dev > 0 ? "+" : ""}${Math.round(dev)}`, title: miss > .3 ? "Golpes que no se escucharon" : "Milisegundos antes (−) o después (+) del resto" };
      const score = miss * 100 + Math.abs(dev);
      if (cls !== "good" && (!worst || score > worst.score)) worst = { i: +i, miss, dev, score };
    });
    grid(-1, marks);
    // Si la misma subdivisión (por ejemplo todas las "a") se desvía en varios tiempos, ese es el consejo
    const bySub = {}; an.res.filter(r => r.ok).forEach(r => { const k = r.i % p.spb, s = bySub[k] || (bySub[k] = { n: 0, sum: 0, beats: new Set() }); s.n++; s.sum += r.err - meanAll; s.beats.add(Math.floor(r.i / p.spb)); });
    const subName = k => k === 0 ? "golpes en el tiempo (1, 2, 3, 4)" : `"${cnt[k]}"`;
    const subOff = Object.entries(bySub).map(([k, s]) => ({ k: +k, dev: s.sum / s.n, beats: s.beats.size })).filter(s => s.beats >= 2 && Math.abs(s.dev) > 18).sort((a, b) => Math.abs(b.dev) - Math.abs(a.dev))[0];
    const good = hitRate >= .9 && an.extra <= an.total * .05 && an.sd <= 25 && !subOff, ok = hitRate >= .75 && an.sd <= 40;
    const nb = good ? clampB(R.bpm + 5) : ok ? R.bpm : clampB(R.bpm - 5);
    const tip = subOff ? `Las ${subName(subOff.k)} llegan ${Math.round(Math.abs(subOff.dev))} ms ${subOff.dev > 0 ? "tarde" : "antes"} respecto al resto. ${subOff.dev > 0 ? "Adelanta un poco ese golpe: la mano debe ir y venir pareja, como un péndulo." : "No te apresures: deja que la mano llegue a ese golpe con el pulso."} Repite a este tempo hasta que salga parejo.` :
      !worst ? "Todos los golpes caen parejos. ¡Muy bien!" :
      worst.miss > .3 ? `En ${name(worst.i)} faltan golpes: no se escuchó el ${Math.round(worst.miss * 100)}% de las veces.` :
      `En ${name(worst.i)} vas ${Math.round(Math.abs(worst.dev))} ms ${worst.dev > 0 ? "tarde" : "adelantado"} respecto al resto del patrón.`;
    box.innerHTML = `<div class="label">Resultado</div>
      <div class="stats" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <div class="stat"><b>${an.matched}/${an.total}</b><span>golpes a tiempo</span></div>
        <div class="stat"><b>±${Math.round(an.sd)}</b><span>ms de variación</span></div>
        <div class="stat"><b>${an.extra}</b><span>golpes de más</span></div></div>
      <p>${tip}</p>
      <p class="note">Bajo cada casilla: verde = parejo, naranja = más de 20 ms fuera, rojo = golpes faltantes. ±25 ms o menos es un ritmo sólido.</p>
      <div class="row"><button class="btn primary" data-apply="${nb}">${nb > R.bpm ? `Subir a ${nb} BPM` : nb < R.bpm ? `Bajar a ${nb} BPM` : `Repetir a ${nb} BPM`}</button>${nb !== R.bpm ? `<button class="btn" data-apply="${R.bpm}">Quedarme en ${R.bpm}</button>` : ""}</div>`;
    record(p, good ? R.bpm : 0, Math.round(hitRate * 100), tip);
  } else {
    box.innerHTML = `<div class="label">¿Cómo te salió a ${R.bpm} BPM?</div>
      <div class="row"><button class="btn primary" data-apply="${clampB(R.bpm + 5)}" data-clean="1">Limpio: subir a ${clampB(R.bpm + 5)}</button>
      <button class="btn" data-apply="${R.bpm}">Más o menos: repetir</button>
      <button class="btn" data-apply="${clampB(R.bpm - 5)}">Me perdí: bajar a ${clampB(R.bpm - 5)}</button></div>`;
  }
  box.hidden = false;
  box.querySelectorAll("[data-apply]").forEach(b => b.onclick = () => {
    if (b.dataset.clean) record(p, R.bpm, null);
    setBpm(+b.dataset.apply, true); box.hidden = true; grid(-1); idle(); renderList(); renderHist();
    toast(+b.dataset.apply > R.startBpm ? `¡A ${b.dataset.apply} BPM!` : `Tempo: ${b.dataset.apply} BPM`);
  });
}
function record(p, cleanBpm, score, tip) {
  const s = store(), g = { ...prog(p.id) };
  g.nombre = p.nombre; if (tip !== undefined) g.tip = tip;
  g.hist = [...(g.hist || []), { t: new Date().toISOString(), bpm: R.bpm, limpio: !!cleanBpm, score }].slice(-60);
  if (cleanBpm && cleanBpm > (g.best || 0)) g.best = cleanBpm;
  s.prog[p.id] = g; save();
  $("#rgBest", el).textContent = g.best ? `Mejor: ${g.best} BPM limpio` : "Sin marca aún";
}
function renderHist() {
  const p = curP(), h = (prog(p.id).hist || []).slice(-20), box = $("#rgHist", el);
  if (!h.length) { box.innerHTML = `<div class="label">Tu avance con este patrón</div><div class="empty">Cada ronda que califiques aparece aquí con su tempo. La meta: subir el tempo sin perder lo parejo.</div>`; return; }
  const W = 340, H = 110, L = 30, Rr = 10, T = 10, B = 18, max = Math.max(...h.map(x => x.bpm)) + 8, min = Math.max(0, Math.min(...h.map(x => x.bpm)) - 8);
  const xs = i => h.length === 1 ? L + (W - L - Rr) / 2 : L + i * (W - L - Rr) / (h.length - 1), ys = v => T + (H - T - B) * (1 - (v - min) / (max - min));
  box.innerHTML = `<div class="label">Tu avance con este patrón</div>
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Tempo por ronda">
    ${[min, Math.round((min + max) / 2), max].map(v => `<line x1="${L}" x2="${W - Rr}" y1="${ys(v)}" y2="${ys(v)}" stroke="var(--line)"/><text x="${L - 5}" y="${ys(v) + 3}" font-size="9" text-anchor="end" fill="var(--muted)" font-family="JetBrains Mono,monospace">${v}</text>`).join("")}
    <polyline points="${h.map((x, i) => xs(i) + "," + ys(x.bpm)).join(" ")}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>
    ${h.map((x, i) => `<circle cx="${xs(i)}" cy="${ys(x.bpm)}" r="3.5" fill="${x.limpio ? "var(--good)" : "var(--muted)"}"/>`).join("")}
    <text x="${L}" y="${H - 3}" font-size="9" fill="var(--muted)" font-family="Barlow,sans-serif">BPM por ronda · verde: salió limpio</text></svg>`;
}
