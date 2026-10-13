// Reconoce formas de acordes dentro de una tab: partes donde todas las notas (aunque se toquen una a la vez,
// como un arpegio) caben en una misma forma de acorde. Así la app puede sugerir "aquí pon la mano en C".
// Se buscan los acordes abiertos de la biblioteca y las formas móviles (cejilla tipo Mi y tipo La, y power chords).
// Las formas son de posición: si la tab está medio tono abajo, "forma de C" se pone igual aunque suene a B.
import { CHORDS, NOTES } from "../chords.js";

const ROOT_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const STD = [64, 59, 55, 50, 45, 40];   // de la 1ª (aguda) a la 6ª
function rootPc(name) { const m = name.match(/^([A-G])([#b])?/); return m ? (ROOT_PC[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12 : null; }

let SHAPES = null;
function shapes() {
  if (SHAPES) return SHAPES;
  const out = [];
  for (const [name, c] of Object.entries(CHORDS)) {
    const pos = [...c.f].reverse().map(ch => ch === "x" ? null : +ch);   // pos[cuerda], 0 = la más aguda
    out.push({ name, pos, root: rootPc(name), open: true });
  }
  const mov = (label, suf, form, base) => {
    for (let r = 1; r <= 12; r++) {
      const pos = form.map(d => d == null ? null : r + d), root = (base + r) % 12;
      out.push({ name: NOTES[root] + suf, pos, root, barre: label, fret: r });
    }
  };
  mov("cejilla tipo Mi", "", [0, 0, 1, 2, 2, 0], 4);
  mov("cejilla tipo Mi", "m", [0, 0, 0, 2, 2, 0], 4);
  mov("cejilla tipo La", "", [0, 2, 2, 2, 0, null], 9);
  mov("cejilla tipo La", "m", [0, 1, 2, 2, 0, null], 9);
  mov("power chord", "5", [null, null, null, 2, 2, 0], 4);
  mov("power chord", "5", [null, null, 2, 2, 0, null], 9);
  return (SHAPES = out);
}

// ¿Todas las notas caben en la forma, y la más grave es la raíz del acorde?
function fits(sh, notes) {
  let low = null;
  for (const [s, f] of notes) {
    if (s > 5 || sh.pos[s] == null || sh.pos[s] !== f) return false;
    const m = STD[s] + f; if (low == null || m < low) low = m;
  }
  return low != null && low % 12 === sh.root;
}
function match(notes) {
  const strings = new Set(notes.map(n => n[0]));
  if (strings.size < 3) return null;
  return shapes().find(sh => fits(sh, notes)) || null;
}

// Devuelve [{ i, j, name, shape }] con los tramos (índices de tab.ev) que forman un acorde.
export function findShapes(tab) {
  if (tab.cuerdas !== 6) return [];
  // solo si las cuerdas guardan los intervalos de la afinación estándar (estándar, medio tono abajo, etc.)
  const d = tab.afin.map((m, k) => m - STD[k]); if (d.some(x => x !== d[0])) return [];
  const out = [], ev = tab.ev, C = tab.compases;
  const segsOf = (idx) => {
    const notes = idx.flatMap(i => ev[i].n.filter(n => !n[3].includes("x")).map(n => [n[0], n[1]]));
    return notes.length >= 3 && idx.length >= 2 ? match(notes) : null;
  };
  let i = 0;
  while (i < ev.length) {
    const c = ev[i].c; let j = i; while (j + 1 < ev.length && ev[j + 1].c === c) j++;
    const idx = []; for (let k = i; k <= j; k++) idx.push(k);
    const whole = segsOf(idx);
    if (whole) out.push({ i, j, name: whole.name, shape: whole });
    else {
      // mitades del compás
      const bar = C[c], len = (C[c + 1]?.s ?? bar.s + 3840) - bar.s, mid = bar.s + len / 2;
      const A = idx.filter(k => ev[k].t < mid), B = idx.filter(k => ev[k].t >= mid);
      for (const part of [A, B]) { const sh = part.length && segsOf(part); if (sh) out.push({ i: part[0], j: part[part.length - 1], name: sh.name, shape: sh }); }
    }
    i = j + 1;
  }
  // une tramos seguidos del mismo acorde
  const merged = [];
  for (const x of out) { const p = merged[merged.length - 1]; if (p && p.name === x.name && x.i === p.j + 1) p.j = x.j; else merged.push({ ...x }); }
  return merged;
}
export function shapeHint(sh) {
  if (sh.open) return `forma de ${sh.name}`;
  return `${sh.name}, ${sh.barre} en traste ${sh.fret}`;
}
