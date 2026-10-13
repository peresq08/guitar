// Lee tabs de texto (las de "e|---0---3---|" que se copian de cualquier página o documento)
// y las convierte al mismo formato que las importadas de Guitar Pro.
//
// Formato de una tab en Riff:
//   afin: notas MIDI de cada cuerda, de la más aguda (renglón de arriba) a la más grave
//   compases: [{ s: tick de inicio, n, d: compás, sec?: nombre de sección, bpm? }]
//   ev: [{ c: compás, t: tick, d: duración, n: [[cuerda (0 = la más aguda), traste, midi, marcas], …] }]
// Marcas: h = sigue ligado (hammer/pull), H = llega ligada (no se ataca), / = slide, S = llega con slide,
//         b = bend, x = nota muerta, m = palm mute, ~ = vibrato, * = armónico, g = nota de adorno.
// 960 ticks = una negra (igual que Guitar Pro / alphaTab).

export const Q = 960;
const STD = { 4: [43, 38, 33, 28], 5: [43, 38, 33, 28, 23], 6: [64, 59, 55, 50, 45, 40], 7: [64, 59, 55, 50, 45, 40, 35], 8: [64, 59, 55, 50, 45, 40, 35, 30] };
export const stdTuning = n => STD[n] || STD[6];
const PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

// Un renglón de tab: etiqueta opcional (e, B, G, D#, Eb…), una barra o dos puntos, y el resto con guiones y números.
const LINE = /^\s*([A-Ga-g](?:#|b)?)?\s*(\|\|?|:|\[)?(.*)$/;
function tabLine(raw) {
  const s = raw.replace(/\t/g, "    ").replace(/[–—]/g, "-");
  const m = s.match(LINE); if (!m) return null;
  const body = m[3] || "";
  const dashes = (body.match(/-/g) || []).length, solid = body.replace(/\s/g, "").length;
  if (dashes < 4 || dashes / Math.max(1, solid) < .4) return null;
  if (!m[2] && !m[1] && !/^\s*-/.test(s)) return null;
  // columna donde empieza el contenido: después de la etiqueta y la primera barra
  const start = s.length - body.length;
  return { label: m[1] || null, start, text: s };
}
function heading(raw) {
  const s = raw.trim(); if (!s || s.length > 40) return null;
  const m = s.match(/^\[([^\]]{1,30})\]$/) || s.match(/^([A-Za-zÁÉÍÓÚáéíóúñÑ][\w ÁÉÍÓÚáéíóúñÑ'’.\-]{1,28}):?\s*(?:\(.*\))?$/);
  if (!m) return null;
  const t = m[1].trim();
  if (/^(e|b|g|d|a)$/i.test(t)) return null;
  return t;
}
function labelsToTuning(labels) {
  const n = labels.length, ref = stdTuning(n);
  if (labels.some(l => !l)) return ref.slice();
  const out = [];
  for (let i = 0; i < n; i++) {
    const l = labels[i], pc = (PC[l[0].toLowerCase()] + (l[1] === "#" ? 1 : l[1] === "b" ? -1 : 0) + 12) % 12;
    let best = null; for (let m = ref[i] - 6; m <= ref[i] + 6; m++) if (((m % 12) + 12) % 12 === pc && (best === null || Math.abs(m - ref[i]) < Math.abs(best - ref[i]))) best = m;
    out.push(best ?? ref[i]);
  }
  // si las etiquetas no bajan de agudo a grave, no son confiables
  for (let i = 1; i < n; i++) if (out[i] >= out[i - 1]) return ref.slice();
  return out;
}

// Devuelve { tab } o { error }
export function parseTextTab(text, { titulo = "", artista = "" } = {}) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const blocks = []; let cur = null, pendingSec = null, lastText = -10;
  lines.forEach((raw, i) => {
    const L = tabLine(raw);
    if (L) { if (!cur) { cur = { lines: [], sec: i - lastText <= 2 ? pendingSec : null }; blocks.push(cur); pendingSec = null; } cur.lines.push(L); return; }
    cur = null;
    const h = heading(raw); if (h) { pendingSec = h; lastText = i; }
  });
  const good = blocks.filter(b => b.lines.length >= 4 && b.lines.length <= 8);
  if (!good.length) return { error: "No encontré renglones de tab. Una tab de texto tiene un renglón por cuerda (6 en guitarra), por ejemplo: e|---0---3---|" };
  // el número de cuerdas más común
  const counts = {}; good.forEach(b => counts[b.lines.length] = (counts[b.lines.length] || 0) + 1);
  const strings = +Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const use = good.filter(b => b.lines.length === strings);
  const firstLabels = use[0].lines.map(l => l.label);
  const afin = labelsToTuning(firstLabels);

  const cols = [];       // eventos en columnas globales
  const barCols = [];    // columnas donde empieza un compás
  const secAt = [];      // [columna, nombre]
  let base = 0;
  for (const b of use) {
    const rows = b.lines.map(l => l.text.slice(l.start));
    const W = Math.max(...rows.map(r => r.length));
    if (b.sec) secAt.push([base, b.sec]);
    barCols.push(base);
    const notes = [];
    rows.forEach((r, s) => {
      for (let p = 0; p < r.length; p++) {
        const ch = r[p];
        if (/\d/.test(ch) && !/\d/.test(r[p - 1] || "")) {
          let q = p + 1; while (q < r.length && /\d/.test(r[q]) && q - p < 2) q++;
          let num = r.slice(p, q);
          if (num.length === 2 && +num > 24) { num = num[0]; q = p + 1; }
          const before = r[p - 1] || "", after = r[q] || "";
          let fl = "";
          if (/[hp]/i.test(before)) fl += "H"; if (/[\/\\s]/.test(before)) fl += "S";
          if (/[hp]/i.test(after)) fl += "h"; if (/[\/\\]/.test(after)) fl += "/";
          if (/b/.test(after)) fl += "b"; if (/~/.test(after)) fl += "~";
          if (before === "<" || before === "*") fl += "*";
          if (before === "(" && after === ")") fl += "g";
          notes.push({ p, e: q - 1, s, f: +num, fl });
          p = q - 1;
        } else if ((ch === "x" || ch === "X") && /[-|]/.test(r[p - 1] || "-") && /[-|]/.test(r[p + 1] || "-")) {
          notes.push({ p, e: p, s, f: 0, fl: "x" });
        }
      }
    });
    // barras de compás: columnas donde la mayoría de los renglones tienen "|"
    for (let p = 1; p < W; p++) {
      const bars = rows.filter(r => r[p] === "|").length;
      if (bars >= Math.ceil(rows.length / 2) && rows.some(r => r[p - 1] !== "|") && p < W - 2) barCols.push(base + p);
    }
    notes.sort((a, b) => a.p - b.p || a.s - b.s);
    let ev = null;
    for (const n of notes) {
      if (ev && n.p <= ev.e && !ev.n.some(x => x.s === n.s)) { ev.n.push(n); ev.e = Math.max(ev.e, n.e); }
      else { ev = { p: base + n.p, e: n.e, n: [n] }; ev.e = n.e; ev.p0 = n.p; cols.push(ev); }
    }
    base += W + 4;
  }
  if (!cols.length) return { error: "Encontré los renglones de la tab pero ningún número de traste." };

  // Ticks: la separación más común entre notas vale una corchea.
  const gaps = []; for (let i = 1; i < cols.length; i++) { const g = cols[i].p - cols[i - 1].p; if (g > 0 && g < 12) gaps.push(g); }
  gaps.sort((a, b) => a - b);
  const unit = gaps.length ? gaps[gaps.length >> 1] : 2, tpc = (Q / 2) / unit;
  const bars = [...new Set(barCols)].sort((a, b) => a - b);
  const compases = []; const barOf = col => { let k = 0; while (k + 1 < bars.length && bars[k + 1] <= col) k++; return k; };
  bars.forEach((c, k) => compases.push({ s: Math.round(c * tpc), n: 4, d: 4 }));
  secAt.forEach(([c, name]) => { const k = barOf(c); if (compases[k] && !compases[k].sec) compases[k].sec = name; });
  const ev = cols.map((e, i) => {
    const nx = cols[i + 1], d = nx ? Math.max(Q / 8, Math.min(Q * 2, (nx.p - e.p) * tpc)) : Q;
    return { c: barOf(e.p), t: Math.round(e.p * tpc), d: Math.round(d), n: e.n.map(x => [x.s, x.f, afin[x.s] + x.f, x.fl]) };
  });
  // quita compases vacíos al final y renumera
  const used = [...new Set(ev.map(e => e.c))].sort((a, b) => a - b), map = new Map(used.map((c, k) => [c, k]));
  const comp2 = used.map(c => compases[c]);
  ev.forEach(e => e.c = map.get(e.c));
  return {
    tab: {
      fuente: "texto", titulo: titulo || "Tab sin título", artista, pista: strings === 4 ? "Bajo" : "Guitarra",
      afin, cuerdas: strings, tempo: null, compases: comp2, ev, notas: ev.reduce((a, e) => a + e.n.length, 0),
    },
  };
}
