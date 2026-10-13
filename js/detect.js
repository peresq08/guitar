// Huella de cada acorde para la detección por micrófono: la calibrada por ti si existe,
// si no, una teórica a partir de las notas del acorde y sus armónicos principales.
import { CHORDS } from "./chords.js";
import { data } from "./store.js";
import * as A from "./audio.js";

export function theoTemplate(name) {
  const v = new Array(12).fill(0);
  [...CHORDS[name].f].forEach((c, i) => { if (c === "x") return; const m = A.TUNING[i] + +c; v[m % 12] += 1; v[(m + 7) % 12] += .3; v[(m + 4) % 12] += .1; });
  return A.norm(v);
}
export const chordTemplate = n => data.calibracion[n] || theoTemplate(n);
export const LAB_MIN = .55, LAB_DIFF = .04;

// Clasifica un cuadro de audio entre varios acordes candidatos. Devuelve el nombre o null si no es claro.
export function classify(fr, names) {
  if (!fr.on) return null;
  let best = null, b1 = -1, b2 = -1;
  for (const n of names) {
    const s = A.cosSim(fr.chroma, chordTemplate(n));
    if (s > b1) { b2 = b1; b1 = s; best = n; } else if (s > b2) b2 = s;
  }
  return b1 > LAB_MIN && (names.length < 2 || b1 - b2 > LAB_DIFF) ? best : null;
}
