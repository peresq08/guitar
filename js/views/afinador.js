import { data, save, $ } from "../store.js";
import { NOTES, NOTES_ES, STD, STRING_NAMES } from "../chords.js";
import * as A from "../audio.js";

let root, loop = null, lock = -1, hist = [], okSince = 0;

// Afinaciones (MIDI de la 6ª a la 1ª cuerda)
export const TUNINGS = [
  { id: "estandar", name: "Estándar", notes: [40, 45, 50, 55, 59, 64] },
  { id: "mib", name: "Medio tono abajo (Mi bemol)", notes: [39, 44, 49, 54, 58, 63] },
  { id: "re", name: "Un tono abajo (Re)", notes: [38, 43, 48, 53, 57, 62] },
  { id: "dropd", name: "Drop D", notes: [38, 45, 50, 55, 59, 64] },
  { id: "dropcs", name: "Drop C# (medio tono abajo y 6ª en Do#)", notes: [37, 44, 49, 54, 58, 63] },
  { id: "dropc", name: "Drop C", notes: [36, 43, 48, 53, 57, 62] },
  { id: "dadgad", name: "DADGAD", notes: [38, 45, 50, 55, 57, 62] },
  { id: "openg", name: "Open G", notes: [38, 43, 50, 55, 59, 62] },
  { id: "opend", name: "Open D", notes: [38, 45, 50, 54, 57, 62] },
];
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const nameOf = (m, i) => { const n = FLATS[((m % 12) + 12) % 12]; return i === 5 && n === "E" ? "e" : n; };
function tuning() {
  const id = data.ajustes.afinacion || "estandar";
  if (id === "tab" && Array.isArray(data.ajustes.afinacionTab) && data.ajustes.afinacionTab.length === 6) return { id: "tab", name: "La de tu tab", notes: data.ajustes.afinacionTab };
  return TUNINGS.find(t => t.id === id) || TUNINGS[0];
}
const TUN = () => tuning().notes;

export function mount(el) {
  root = el;
  el.innerHTML = `
  <div class="cols" style="--cols:minmax(0,1.5fr) minmax(0,1fr)">
  <div class="col">
  <div class="panel tuner screen">
    <div class="row between" style="gap:10px;flex-wrap:wrap">
      <select id="tTuning" aria-label="Afinación" style="flex:1 1 240px"></select>
      <span class="label" id="tTuneNotes"></span>
    </div>
    <svg viewBox="0 0 300 170" aria-hidden="true">
      <path d="M30 150 A120 120 0 0 1 270 150" fill="none" stroke="var(--line)" stroke-width="10" stroke-linecap="round"/>
      <path id="tOk" d="M134.3 31 A120 120 0 0 1 165.7 31" fill="none" stroke="var(--good)" stroke-width="10" stroke-linecap="round" opacity=".35"/>
      ${Array.from({ length: 11 }, (_, i) => { const a = (-90 + (i - 5) * 15) * Math.PI / 180, r1 = 104, r2 = i === 5 ? 92 : 98;
        return `<line x1="${150 + r1 * Math.cos(a)}" y1="${150 + r1 * Math.sin(a)}" x2="${150 + r2 * Math.cos(a)}" y2="${150 + r2 * Math.sin(a)}" stroke="var(--muted)" stroke-width="${i === 5 ? 3 : 1.5}"/>`; }).join("")}
      <text x="40" y="168" font-size="11" fill="var(--muted)" font-family="JetBrains Mono,monospace">−50</text>
      <text x="246" y="168" font-size="11" fill="var(--muted)" font-family="JetBrains Mono,monospace">+50</text>
      <g id="tNeedle" transform="rotate(0 150 150)"><line x1="150" y1="150" x2="150" y2="44" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/><circle cx="150" cy="150" r="8" fill="var(--accent)"/></g>
    </svg>
    <div class="note-name" id="tNote">–</div>
    <div class="num muted" id="tInfo">Activa el micrófono y toca una cuerda</div>
    <div class="strings" id="tStrings"></div>
    <p class="note" id="tHint">Detecta la cuerda sola. Toca una cuerda de arriba para fijarla y escuchar su tono de referencia.</p>
    <button class="btn primary block" id="tStart" data-primary>Activar afinador</button>
  </div>
  </div>
  <div class="col">
  <div class="panel">
    <div class="row between">
      <label class="field" for="tA4" style="flex:1">Referencia La4 (Hz)<input type="number" id="tA4" min="430" max="450" value="${data.ajustes.a4}"></label>
    </div>
    <p class="note">Deja 440 Hz salvo que toques junto a una grabación afinada distinto.</p>
  </div>
  <div class="panel">
    <div class="label">Afinaciones de las canciones</div>
    <p class="note">Muchas canciones de rock y metal de los 80 (Guns N' Roses, Van Halen, Mötley Crüe) y algunas de The Cure van medio tono abajo. Las de Tabs te dicen su afinación y te traen aquí con <b>Afinar así</b>. Si no quieres cambiar de afinación, en Tabs elige <i>Guitarra en afinación estándar</i>: los trastes son los mismos y la canción suena medio tono más aguda.</p>
  </div>
  </div>
  </div>`;
  $("#tStart", el).onclick = start;
  const sel = $("#tTuning", el);
  sel.onchange = () => { data.ajustes.afinacion = sel.value; save(); lock = -1; paintTuning(); };
  paintTuning();
  $("#tA4", el).onchange = e => { const v = Math.min(450, Math.max(430, +e.target.value || 440)); data.ajustes.a4 = v; save(); };
}
function paintTuning() {
  const t = tuning(), sel = $("#tTuning", root);
  sel.innerHTML = TUNINGS.map(x => `<option value="${x.id}">${x.name}</option>`).join("") + (Array.isArray(data.ajustes.afinacionTab) ? `<option value="tab">La de tu tab (${data.ajustes.afinacionTab.map(nameOf).join(" ")})</option>` : "");
  sel.value = t.id;
  $("#tTuneNotes", root).textContent = t.notes.map(nameOf).join(" ");
  $("#tStrings", root).innerHTML = t.notes.map((m, i) => `<button data-s="${i}" aria-label="Cuerda ${6 - i}, ${nameOf(m, i)}">${nameOf(m, i)}</button>`).join("");
  root.querySelectorAll("[data-s]").forEach(b => b.onclick = () => {
    const i = +b.dataset.s; lock = lock === i ? -1 : i;
    if (lock >= 0) A.pluck(TUN()[i], 0, .4);
    paintStrings(-1, false);
  });
}
// Abre el afinador con una afinación (desde Tabs): opts.afinacion = id o lista MIDI de 6ª a 1ª
export function onShow(opts = {}) {
  if (opts.afinacion) {
    if (Array.isArray(opts.afinacion)) {
      const hit = TUNINGS.find(t => t.notes.every((m, k) => m === opts.afinacion[k]));
      if (hit) data.ajustes.afinacion = hit.id; else { data.ajustes.afinacionTab = opts.afinacion; data.ajustes.afinacion = "tab"; }
    } else data.ajustes.afinacion = opts.afinacion;
    save(); lock = -1; paintTuning();
  }
}
async function start() {
  const btn = $("#tStart", root);
  if (loop) { clearInterval(loop); loop = null; btn.textContent = "Activar afinador"; A.keepAwake(false); return; }
  btn.disabled = true; $("#tInfo", root).textContent = "Midiendo el ruido del cuarto…";
  const ok = await A.micOn(); btn.disabled = false;
  if (!ok) { $("#tInfo", root).textContent = A.mic.error; return; }
  btn.textContent = "Pausar afinador"; $("#tInfo", root).textContent = "Toca una cuerda al aire";
  loop = setInterval(tick, 70); A.keepAwake(true);
}
function paintStrings(cur, ok) {
  root.querySelectorAll("[data-s]").forEach((b, i) => { b.classList.toggle("on", i === lock || (lock < 0 && i === cur)); b.classList.toggle("ok", ok && i === cur); });
}
function tick() {
  if (root.hidden) return;
  const p = A.pitch();
  if (!p.f || p.clarity < .8 || p.f < 60 || p.f > 1100) {
    if (hist.length && performance.now() - hist.lastT > 600) { hist = []; }
    return;
  }
  hist.push(p.f); hist.lastT = performance.now(); if (hist.length > 5) hist.shift();
  const f = [...hist].sort((a, b) => a - b)[Math.floor(hist.length / 2)];
  const a4 = data.ajustes.a4, midi = 69 + 12 * Math.log2(f / a4);
  let target, cents;
  let s = lock;
  const T = TUN();
  if (s < 0) { let best = 99; T.forEach((m, i) => { const d = Math.abs(midi - m); if (d < best) { best = d; s = i; } }); if (best > 3) s = -1; }
  if (s >= 0) { target = T[s]; cents = (midi - target) * 100; }
  else { target = Math.round(midi); cents = (midi - target) * 100; }
  const pc = ((target % 12) + 12) % 12, oct = Math.floor(target / 12) - 1;
  const clamped = Math.max(-50, Math.min(50, cents));
  $("#tNeedle", root).setAttribute("transform", `rotate(${clamped * 1.5} 150 150)`);
  const inTune = Math.abs(cents) < 5;
  $("#tNote", root).textContent = (tuning().id === "estandar" ? NOTES[pc] : FLATS[pc]) + oct;
  $("#tNote", root).style.color = inTune ? "var(--good)" : "var(--ink)";
  $("#tInfo", root).textContent = `${f.toFixed(1)} Hz · ${cents > 0 ? "+" : ""}${Math.round(cents)} cents · ${inTune ? "afinada" : cents < 0 ? "sube (aprieta)" : "baja (afloja)"}`;
  $("#tOk", root).setAttribute("opacity", inTune ? "1" : ".35");
  if (inTune) { if (!okSince) okSince = performance.now(); } else okSince = 0;
  paintStrings(s, inTune && performance.now() - okSince > 400);
  $("#tHint", root).textContent = s >= 0 ? `Cuerda ${6 - s} · ${nameOf(T[s], s)} (${NOTES_ES[T[s] % 12]})` : "Nota fuera de las cuerdas al aire";
}
export function onHide() { /* el bucle se pausa solo cuando la vista está oculta */ }
