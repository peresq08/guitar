// Acordes que creas tú: se guardan en tus datos (y en el respaldo) y se suman a la biblioteca,
// así que funcionan en Secuencias, Cambios, Rasgueo, el carril y la detección por micrófono.
import { data, save } from "./store.js";
import { CHORDS, GROUPS } from "./chords.js";

export const GROUP = "Tus acordes";
const STD = [40, 45, 50, 55, 59, 64];
const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

export function registerCustomChords() {
  for (const k of Object.keys(CHORDS)) if (CHORDS[k].custom) delete CHORDS[k];
  const own = data.acordesPropios || {};
  for (const [name, c] of Object.entries(own)) if (!CHORDS[name]) CHORDS[name] = { f: c.f, d: c.d, g: GROUP, custom: true };
  const has = Object.keys(own).length > 0, i = GROUPS.indexOf(GROUP);
  if (has && i < 0) GROUPS.push(GROUP); else if (!has && i >= 0) GROUPS.splice(i, 1);
}
export function saveCustomChord(name, f, d, oldName) {
  data.acordesPropios = data.acordesPropios || {};
  if (oldName && oldName !== name) delete data.acordesPropios[oldName];
  data.acordesPropios[name] = { f: f.map(String), d };
  registerCustomChords(); save();
  window.dispatchEvent(new Event("riff:chords"));
}
export function deleteCustomChord(name) {
  if (!data.acordesPropios) return;
  delete data.acordesPropios[name]; delete data.calibracion?.[name];
  registerCustomChords(); save();
  window.dispatchEvent(new Event("riff:chords"));
}

// Notas que suenan (MIDI) de una lista de trastes de 6ª a 1ª ("x" = no suena)
export const midis = f => f.map((x, i) => x === "x" || x == null ? null : STD[i] + +x).filter(m => m != null);
export const noteNames = f => midis(f).map(m => NAMES[m % 12]);

// Nombre del acorde a partir de sus notas: busca la fórmula que coincide exactamente, preferentemente con el bajo como raíz.
const FORMULAS = [
  ["", [0, 4, 7]], ["m", [0, 3, 7]], ["5", [0, 7]], ["7", [0, 4, 7, 10]], ["maj7", [0, 4, 7, 11]], ["m7", [0, 3, 7, 10]],
  ["sus2", [0, 2, 7]], ["sus4", [0, 5, 7]], ["add9", [0, 2, 4, 7]], ["madd9", [0, 2, 3, 7]], ["6", [0, 4, 7, 9]], ["m6", [0, 3, 7, 9]],
  ["7sus4", [0, 5, 7, 10]], ["9", [0, 2, 4, 7, 10]], ["m9", [0, 2, 3, 7, 10]], ["maj9", [0, 2, 4, 7, 11]], ["6/9", [0, 2, 4, 7, 9]],
  ["dim", [0, 3, 6]], ["dim7", [0, 3, 6, 9]], ["m7b5", [0, 3, 6, 10]], ["aug", [0, 4, 8]], ["7#9", [0, 3, 4, 7, 10]],
  ["(sin 3ª)", [0]], ["maj7 (sin 5ª)", [0, 4, 11]], ["7 (sin 5ª)", [0, 4, 10]], ["m7 (sin 5ª)", [0, 3, 10]],
];
export function nameChord(f) {
  const ms = midis(f); if (ms.length < 2) return { name: ms.length ? NAMES[ms[0] % 12] : "", alts: [] };
  const pcs = [...new Set(ms.map(m => m % 12))], bass = Math.min(...ms) % 12;
  const found = [];
  for (const root of pcs) for (const [suf, iv] of FORMULAS) {
    const set = iv.map(i => (root + i) % 12);
    if (set.length === pcs.length && set.every(p => pcs.includes(p))) {
      const nm = NAMES[root] + suf.replace(/ \(.*\)/, "") + (root === bass ? "" : "/" + NAMES[bass]);
      found.push({ name: nm, score: (root === bass ? 0 : 10) + FORMULAS.findIndex(x => x[0] === suf) });
    }
  }
  found.sort((a, b) => a.score - b.score);
  const uniq = [...new Set(found.map(x => x.name))];
  return { name: uniq[0] || NAMES[bass] + "?", alts: uniq.slice(1, 4) };
}

// Dedos sugeridos: cejilla con el índice si el traste más bajo se repite en las cuerdas de los extremos,
// y los demás dedos según la distancia en trastes.
export function suggestFingers(f) {
  const fr = f.map(x => x === "x" || x == null ? null : +x), pressed = fr.map((v, i) => ({ v, i })).filter(p => p.v > 0);
  const d = fr.map(v => v == null || v === 0 ? "-" : "?");
  if (!pressed.length) return d.join("");
  const min = Math.min(...pressed.map(p => p.v)), atMin = pressed.filter(p => p.v === min);
  const lo = Math.min(...pressed.map(p => p.i)), hi = Math.max(...pressed.map(p => p.i));
  const covers = atMin.some(p => p.i === lo) && atMin.some(p => p.i === hi);
  const adjTop = atMin.length === 2 && Math.abs(atMin[0].i - atMin[1].i) === 1 && atMin.some(p => p.i === hi);
  const barre = atMin.length >= 3 || (atMin.length === 2 && covers && hi - lo >= 3) || adjTop;
  if (barre) {
    const a = Math.min(...atMin.map(p => p.i)), b = Math.max(...atMin.map(p => p.i));
    for (let i = a; i <= b; i++) if (fr[i] === min) d[i] = "1";
  }
  let next = barre ? 2 : 1;
  const rest = pressed.filter(p => d[p.i] === "?").sort((x, y) => x.v - y.v || x.i - y.i);
  // tres o más notas en el mismo traste, en cuerdas seguidas (forma de La con cejilla): mini cejilla con el anular
  const byFret = {}; rest.forEach(p => (byFret[p.v] = byFret[p.v] || []).push(p));
  for (const g of Object.values(byFret)) if (g.length >= 3 && g[g.length - 1].i - g[0].i === g.length - 1) g.forEach(p => d[p.i] = "3");
  for (const p of rest.filter(p => d[p.i] === "?")) { const fg = Math.min(4, Math.max(next, 1 + p.v - min)); d[p.i] = String(fg); next = Math.min(4, fg + 1); }
  return d.join("");
}
export const isValidName = n => /^[A-G][#b]?[^\s]{0,14}$/.test(n);
