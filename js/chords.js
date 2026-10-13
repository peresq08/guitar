// Biblioteca de acordes, diagramas y diapasón.
// f: trastes de 6ª a 1ª cuerda (x = no se toca). d: dedos (1 índice … 4 meñique, - sin dedo).
export const CHORDS = {
  // Mayores abiertos
  "C":   { f: "x32010", d: "-32-1-", g: "Mayores" },
  "D":   { f: "xx0232", d: "---132", g: "Mayores" },
  "E":   { f: "022100", d: "-231--", g: "Mayores" },
  "G":   { f: "320003", d: "21---3", g: "Mayores" },
  "A":   { f: "x02220", d: "--123-", g: "Mayores" },
  "F (mini)": { f: "xx3211", d: "--3211", g: "Mayores" },
  "Cadd9": { f: "x32033", d: "-21-34", g: "Mayores" },
  // Menores
  "Am":  { f: "x02210", d: "--231-", g: "Menores" },
  "Em":  { f: "022000", d: "-23---", g: "Menores" },
  "Dm":  { f: "xx0231", d: "---231", g: "Menores" },
  "Em7": { f: "022033", d: "-12-34", g: "Menores" },
  "Am7": { f: "x02010", d: "--2-1-", g: "Menores" },
  "Dm7": { f: "xx0211", d: "---211", g: "Menores" },
  // Séptimas y suspendidos
  "A7":  { f: "x02020", d: "--2-3-", g: "Séptimas y sus" },
  "D7":  { f: "xx0212", d: "---213", g: "Séptimas y sus" },
  "E7":  { f: "020100", d: "-2-1--", g: "Séptimas y sus" },
  "G7":  { f: "320001", d: "32---1", g: "Séptimas y sus" },
  "C7":  { f: "x32310", d: "-3241-", g: "Séptimas y sus" },
  "B7":  { f: "x21202", d: "-213-4", g: "Séptimas y sus" },
  "Asus2": { f: "x02200", d: "--12--", g: "Séptimas y sus" },
  "Dsus2": { f: "xx0230", d: "---13-", g: "Séptimas y sus" },
  "Dsus4": { f: "xx0233", d: "---134", g: "Séptimas y sus" },
  // Power chords
  "E5":  { f: "022xxx", d: "-12---", g: "Power chords" },
  "A5":  { f: "x022xx", d: "--12--", g: "Power chords" },
  "D5":  { f: "xx023x", d: "---12-", g: "Power chords" },
  "F#5": { f: "244xxx", d: "134---", g: "Power chords" },
  "G5":  { f: "355xxx", d: "134---", g: "Power chords" },
  "B5":  { f: "x244xx", d: "-134--", g: "Power chords" },
  "C5":  { f: "x355xx", d: "-134--", g: "Power chords" },
  "Bb5": { f: "x133xx", d: "-134--", g: "Power chords" },
  "F5":  { f: "133xxx", d: "134---", g: "Power chords" },
  "Ab5": { f: "466xxx", d: "134---", g: "Power chords" },
  "C#5": { f: "x466xx", d: "-134--", g: "Power chords" },
  // Cejilla
  "F":   { f: "133211", d: "134211", g: "Cejilla" },
  "Fm":  { f: "133111", d: "134111", g: "Cejilla" },
  "Bm":  { f: "x24432", d: "-13421", g: "Cejilla" },
  "B":   { f: "x24442", d: "-13331", g: "Cejilla" },
  "Bb":  { f: "x13331", d: "-13331", g: "Cejilla" },
  "Gm":  { f: "355333", d: "134111", g: "Cejilla" },
  "Cm":  { f: "x35543", d: "-13421", g: "Cejilla" },
  "F#m": { f: "244222", d: "134111", g: "Cejilla" },
  "F#":  { f: "244322", d: "134211", g: "Cejilla" },
  "C#m": { f: "x46654", d: "-13421", g: "Cejilla" },
  "G#m": { f: "466444", d: "134111", g: "Cejilla" },
};
export const GROUPS = ["Mayores", "Menores", "Séptimas y sus", "Power chords", "Cejilla"];

export function diagram(name, { large = false, button = false } = {}) {
  const c = CHORDS[name]; if (!c) return "";
  const f = [...c.f].map(ch => ch === "x" ? -1 : +ch), fin = [...(c.d || "------")];
  const pressed = f.filter(v => v > 0), max = Math.max(0, ...pressed), min = pressed.length ? Math.min(...pressed) : 1;
  const base = max > 4 ? min : 1;
  const x0 = 13, dx = 11, y0 = 22, dy = 14, W = 78, H = 96;
  let g = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Acorde ${name}">`;
  if (base === 1) g += `<rect x="${x0 - 1}" y="${y0 - 3}" width="${dx * 5 + 2}" height="3.2" fill="var(--ink)"/>`;
  else g += `<text x="${x0 + dx * 5 + 4}" y="${y0 + 10}" font-size="8" fill="var(--muted)" font-family="JetBrains Mono,monospace">${base}fr</text>`;
  for (let i = 0; i <= 5; i++) g += `<line x1="${x0}" x2="${x0 + dx * 5}" y1="${y0 + i * dy}" y2="${y0 + i * dy}" stroke="var(--line)" stroke-width="1.2"/>`;
  for (let i = 0; i < 6; i++) g += `<line x1="${x0 + i * dx}" x2="${x0 + i * dx}" y1="${y0}" y2="${y0 + 5 * dy}" stroke="var(--muted)" stroke-width="${1.6 - i * .15}"/>`;
  // Cejilla: dedo 1 en el traste más bajo sobre varias cuerdas
  const bars = f.map((v, i) => (fin[i] === "1" && v === min && v > 0) ? i : -1).filter(i => i >= 0);
  if (bars.length >= 2) {
    const r = min - base + 1, a = bars[0], b = bars[bars.length - 1];
    g += `<rect x="${x0 + a * dx - 4.5}" y="${y0 + (r - .5) * dy - 4.5}" width="${(b - a) * dx + 9}" height="9" rx="4.5" fill="var(--accent)"/>`;
  }
  f.forEach((v, i) => {
    const x = x0 + i * dx;
    if (v < 0) g += `<text x="${x}" y="${y0 - 7}" font-size="8.5" text-anchor="middle" fill="var(--muted)" font-family="Barlow,sans-serif">✕</text>`;
    else if (v === 0) g += `<circle cx="${x}" cy="${y0 - 9}" r="3" fill="none" stroke="var(--muted)" stroke-width="1.2"/>`;
    else {
      const r = v - base + 1, cy = y0 + (r - .5) * dy;
      if (!(bars.length >= 2 && bars.includes(i))) g += `<circle cx="${x}" cy="${cy}" r="4.6" fill="var(--accent)"/>`;
      if (fin[i] && fin[i] !== "-" && !(bars.length >= 2 && bars.includes(i) && i !== bars[0]))
        g += `<text x="${x}" y="${cy + 2.6}" font-size="7" font-weight="700" text-anchor="middle" fill="var(--accent-ink)" font-family="Barlow,sans-serif">${fin[i]}</text>`;
    }
  });
  g += `</svg>`;
  const tag = button ? "button" : "div";
  return `<${tag} class="chord${large ? " lg" : ""}" ${button ? `type="button" data-chord="${name}"` : ""}><b>${name}</b>${g}</${tag}>`;
}

/* ---- Teoría ---- */
export const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const NOTES_ES = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
export const STD = [40, 45, 50, 55, 59, 64];
export const STRING_NAMES = ["E", "A", "D", "G", "B", "e"];

// Pentatónica menor (caja 1) o escala completa en el diapasón
export function fretboard({ root = 4, intervals = [0, 3, 5, 7, 10], from = 0, to = 12, highlight = null } = {}) {
  const frets = to - from, W = 520, H = 150, L = 26, R = 10, T = 18, B = 26;
  const fw = (W - L - R) / (frets + 1), sh = (H - T - B) / 5;
  const pcs = new Set(intervals.map(i => (root + i) % 12));
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Escala en el diapasón">`;
  for (let k = 0; k <= frets + 1; k++) {
    const x = L + k * fw;
    s += `<line x1="${x}" x2="${x}" y1="${T}" y2="${T + 5 * sh}" stroke="${k === 1 && from === 0 ? "var(--ink)" : "var(--line)"}" stroke-width="${k === 1 && from === 0 ? 3 : 1.2}"/>`;
  }
  for (let k = 0; k <= frets; k++) {
    const n = from + k, x = L + (k + .5) * fw;
    if ([3, 5, 7, 9, 15, 17].includes(n)) s += `<circle cx="${x}" cy="${T + 2.5 * sh}" r="4" fill="var(--line)"/>`;
    if (n === 12) { s += `<circle cx="${x}" cy="${T + 1.5 * sh}" r="4" fill="var(--line)"/><circle cx="${x}" cy="${T + 3.5 * sh}" r="4" fill="var(--line)"/>`; }
    s += `<text x="${x}" y="${H - 8}" font-size="10" text-anchor="middle" fill="var(--muted)" font-family="JetBrains Mono,monospace">${n}</text>`;
  }
  for (let st = 0; st < 6; st++) {
    const y = T + (5 - st) * sh;
    s += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="var(--muted)" stroke-width="${1 + (5 - st) * .25}"/>`;
    s += `<text x="${L - 12}" y="${y + 4}" font-size="10" text-anchor="middle" fill="var(--muted)" font-family="Barlow,sans-serif">${STRING_NAMES[st]}</text>`;
    for (let k = 0; k <= frets; k++) {
      const n = from + k, pc = (STD[st] + n) % 12; if (!pcs.has(pc)) continue;
      const x = L + (k + .5) * fw, isRoot = pc === root % 12, hl = highlight && highlight.has(pc);
      s += `<circle cx="${x}" cy="${y}" r="9" fill="${isRoot ? "var(--accent)" : hl ? "var(--good)" : "var(--panel)"}" stroke="${isRoot ? "var(--accent)" : hl ? "var(--good)" : "var(--ink)"}" stroke-width="1.5"/>`;
      s += `<text x="${x}" y="${y + 3.5}" font-size="9" font-weight="700" text-anchor="middle" fill="${isRoot || hl ? "var(--accent-ink)" : "var(--ink)"}" font-family="Barlow,sans-serif">${NOTES[pc]}</text>`;
    }
  }
  return s + `</svg>`;
}
