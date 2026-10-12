import { esc, $ } from "../store.js";
import { CHORDS, GROUPS, diagram, fretboard, NOTES, NOTES_ES } from "../chords.js";
import * as A from "../audio.js";

let root, group = "Mayores", sel = "C", scaleKey = 9, scaleType = "pm";
const goTo = (view, opts) => window.dispatchEvent(new CustomEvent("riff:go", { detail: { view, opts } }));
const SC = {
  pm: { n: "Pentatónica menor", iv: [0, 3, 5, 7, 10], tip: "La base de casi todos los solos de rock y blues. Empieza por la caja que inicia en la tónica sobre la 6ª cuerda." },
  blues: { n: "Escala de blues", iv: [0, 3, 5, 6, 7, 10], tip: "La pentatónica menor más la 'blue note'. Úsala de paso, no te quedes en ella." },
  pM: { n: "Pentatónica mayor", iv: [0, 2, 4, 7, 9], tip: "Suena más alegre y country; útil sobre progresiones mayores como la balada." },
  menor: { n: "Menor natural", iv: [0, 2, 3, 5, 7, 8, 10], tip: "La escala de muchos riffs de metal; agrega dos notas a la pentatónica." },
};

export function mount(el) { root = el; render(); }

function render() {
  const names = Object.keys(CHORDS).filter(n => CHORDS[n].g === group);
  if (!names.includes(sel)) sel = names[0];
  const c = CHORDS[sel];
  const r = (scaleKey - 4 + 12) % 12;
  root.innerHTML = `
  <div class="panel">
    <div class="label">Biblioteca de acordes</div>
    <div class="seg wrap" role="tablist" aria-label="Tipo de acorde">
      ${GROUPS.map(g => `<button role="tab" aria-selected="${g === group}" data-g="${g}">${g === "Séptimas y sus" ? "7ª y sus" : g === "Power chords" ? "Power" : g}</button>`).join("")}
    </div>
    <div class="lib">${names.map(n => diagram(n, { button: true }).replace('class="chord"', `class="chord" aria-pressed="${n === sel}"`)).join("")}</div>
  </div>
  <div class="panel">
    <div class="row" style="align-items:flex-start;gap:16px">
      ${diagram(sel, { large: true })}
      <div class="stack" style="flex:1;min-width:160px">
        <p class="note">Cuerdas de 6ª (grave) a 1ª (aguda). ○ al aire, ✕ no se toca. Los números son los dedos: 1 índice, 2 medio, 3 anular, 4 meñique.</p>
        <div class="num muted">${esc(c.f.split("").join(" "))}</div>
        <div class="row">
          <button class="btn primary small" id="aStrum">▶ Rasgueo</button>
          <button class="btn small" id="aArp">Nota por nota</button>
        </div>
        <button class="btn small" id="aPair">Practicar cambios con este</button>
      </div>
    </div>
    ${tips(sel)}
  </div>
  <div class="panel">
    <div class="label">Escalas en el diapasón</div>
    <div class="grid2">
      <label for="sKey">Tono<select id="sKey">${NOTES.map((n, i) => `<option value="${i}" ${i === scaleKey ? "selected" : ""}>${n} · ${NOTES_ES[i]}</option>`).join("")}</select></label>
      <label for="sType">Escala<select id="sType">${Object.entries(SC).map(([k, v]) => `<option value="${k}" ${k === scaleType ? "selected" : ""}>${v.n}</option>`).join("")}</select></label>
    </div>
    <div class="fret-wrap">${fretboard({ root: scaleKey, intervals: SC[scaleType].iv, from: 0, to: 15 })}</div>
    <p class="note">${SC[scaleType].tip} La tónica de ${NOTES[scaleKey]} cae en el traste ${r} de la 6ª cuerda${r < 5 ? ` y en el ${r + 12}` : ""}.</p>
    <button class="btn small" id="sPlay" style="align-self:flex-start">▶ Escuchar la escala</button>
  </div>`;
  root.querySelectorAll("[data-g]").forEach(b => b.onclick = () => { group = b.dataset.g; render(); });
  root.querySelectorAll("[data-chord]").forEach(b => b.onclick = () => { sel = b.dataset.chord; render(); A.strum(CHORDS[sel].f, 0, { vol: .28 }); });
  $("#aStrum", root).onclick = () => A.strum(c.f, 0, { vol: .3 });
  $("#aArp", root).onclick = () => A.strum(c.f, 0, { gap: .35, vol: .3, dur: 1.6 });
  $("#aPair", root).onclick = () => goTo("practicar", { tab: "cambios", pair: [sel, partner(sel)] });
  $("#sKey", root).onchange = e => { scaleKey = +e.target.value; render(); };
  $("#sType", root).onchange = e => { scaleType = e.target.value; render(); };
  $("#sPlay", root).onclick = () => {
    const a = A.ctx(), base = 40 + r, t0 = a.currentTime + .05, iv = SC[scaleType].iv;
    const notes = [...iv.map(i => base + i), base + 12, ...iv.slice().reverse().map(i => base + i)];
    notes.forEach((m, k) => A.pluck(m + 12, t0 + k * .28, .35, .9));
  };
}
function partner(n) {
  const map = { "C": "G", "G": "C", "D": "A", "E": "Am", "A": "D", "Am": "E", "Em": "G", "Dm": "Am", "F (mini)": "C", "F": "C", "Bm": "G", "E5": "A5", "A5": "E5", "G5": "A5", "D5": "A5" };
  return map[n] || (n === "C" ? "G" : "C");
}
function tips(n) {
  const t = {
    "F": "Apoya la cejilla con el costado del índice, no con la yema, y acerca el dedo al traste. Si suenan apagadas las cuerdas 2 y 3, gira un poco el índice hacia afuera.",
    "Bm": "Empieza con la versión parcial (sin la 5ª cuerda en cejilla) y ve completándola.",
    "F (mini)": "El índice pisa las dos primeras cuerdas a la vez. Es el paso previo a la F completa.",
    "G": "Muchos guitarristas de rock usan 3-2-0-0-3-3 con el anular y meñique: suena más lleno y facilita el cambio a C y D.",
    "E5": "Toca solo las tres cuerdas graves y apaga el resto con la palma o el índice.",
    "A5": "Apaga la 6ª cuerda con la punta del índice para que no suene.",
  }[n];
  return t ? `<p class="note"><b>Consejo:</b> ${t}</p>` : "";
}
export function onShow() {}
