// Panel grande de acordes para pantalla completa: diagrama grande del acorde de ahora con dedos de colores,
// una mano que muestra qué dedo va dónde, el acorde que sigue y qué dedos se quedan fijos en el cambio.
import { CHORDS } from "../chords.js";

const FINGER = { 1: { name: "Índice", c: "#f2a33a" }, 2: { name: "Medio", c: "#41d184" }, 3: { name: "Anular", c: "#5fb4ff" }, 4: { name: "Meñique", c: "#ff7aa8" } };
const STR = ["6ª", "5ª", "4ª", "3ª", "2ª", "1ª"], STRN = ["E", "A", "D", "G", "B", "e"];

// Posiciones de cada dedo: [{ f: dedo, s: índice de cuerda (0 = 6ª), fret }]
export function fingering(name) {
  const c = CHORDS[name]; if (!c) return null;
  const out = [];
  [...c.f].forEach((ch, s) => { const d = c.d[s]; if (ch !== "x" && ch !== "0" && /[1-4]/.test(d)) out.push({ f: +d, s, fret: +ch }); });
  return out;
}

function chordSVG(name, { w = 250, small = false } = {}) {
  const c = CHORDS[name]; if (!c) return "";
  const fr = [...c.f].map(x => x === "x" ? null : +x), played = fr.filter(x => x > 0);
  const maxF = played.length ? Math.max(...played) : 0, minF = played.length ? Math.min(...played) : 0;
  const start = maxF > 4 ? minF : 1, N = 5;
  const L = 34, T = 40, gx = (w - L - 22) / 5, gy = gx * 1.25, H = T + gy * N + 34;
  const X = s => L + s * gx, Y = f => T + (f - start + .5) * gy;
  let svg = `<svg viewBox="0 0 ${w} ${H}" width="${w}" height="${H}" class="bigchart" role="img" aria-label="Diagrama de ${name}">`;
  svg += start === 1 ? `<rect x="${L - 3}" y="${T - 7}" width="${gx * 5 + 6}" height="7" rx="2" fill="#eef1f5"/>` : `<text x="${L - 12}" y="${T + gy * .62}" text-anchor="end" font-size="15" font-weight="700" fill="#8e9aa8" font-family="JetBrains Mono, monospace">${start}</text>`;
  for (let k = 0; k <= N; k++) svg += `<line x1="${L}" y1="${T + k * gy}" x2="${L + gx * 5}" y2="${T + k * gy}" stroke="rgba(255,255,255,.28)" stroke-width="2"/>`;
  for (let s = 0; s < 6; s++) svg += `<line x1="${X(s)}" y1="${T}" x2="${X(s)}" y2="${T + gy * N}" stroke="rgba(255,255,255,${.35 + (5 - s) * .03})" stroke-width="${1.2 + (5 - s) * .35}"/>`;
  // cejillas: un mismo dedo en varias cuerdas del mismo traste
  const byF = {};
  [...c.f].forEach((ch, s) => { const d = c.d[s]; if (ch !== "x" && ch !== "0" && /[1-4]/.test(d)) (byF[d + ":" + ch] = byF[d + ":" + ch] || []).push(s); });
  const r = Math.min(17, gx * .42);
  for (const [k, ss] of Object.entries(byF)) {
    if (ss.length < 2) continue;
    const [d, f] = k.split(":"), col = FINGER[d].c;
    svg += `<rect x="${X(Math.min(...ss)) - r}" y="${Y(+f) - r}" width="${X(Math.max(...ss)) - X(Math.min(...ss)) + 2 * r}" height="${2 * r}" rx="${r}" fill="${col}" opacity=".9"/>`;
  }
  [...c.f].forEach((ch, s) => {
    if (ch === "x") { svg += `<text x="${X(s)}" y="${T - 16}" text-anchor="middle" font-size="18" font-weight="700" fill="#ff7a6e">×</text>`; return; }
    if (ch === "0") { svg += `<circle cx="${X(s)}" cy="${T - 22}" r="7" fill="none" stroke="#eef1f5" stroke-width="2"/>`; return; }
    const d = c.d[s], col = FINGER[d]?.c || "#eef1f5";
    svg += `<circle cx="${X(s)}" cy="${Y(+ch)}" r="${r}" fill="${col}" style="filter:drop-shadow(0 0 8px ${col}88)"/>`;
    if (/[1-4]/.test(d)) svg += `<text x="${X(s)}" y="${Y(+ch) + 6}" text-anchor="middle" font-size="${small ? 15 : 17}" font-weight="800" fill="#11161c" font-family="JetBrains Mono, monospace">${d}</text>`;
  });
  STRN.forEach((n, s) => svg += `<text x="${X(s)}" y="${H - 8}" text-anchor="middle" font-size="13" fill="#8e9aa8" font-family="JetBrains Mono, monospace">${n}</text>`);
  return svg + "</svg>";
}

// Mano izquierda vista de frente (palma hacia ti): pulgar a la izquierda; los dedos que se usan, en su color.
function handSVG(used) {
  const W = 210, H = 250;
  const F = [{ f: 1, x: 62, h: 104, top: 30 }, { f: 2, x: 96, h: 116, top: 16 }, { f: 3, x: 130, h: 108, top: 24 }, { f: 4, x: 162, h: 86, top: 48 }];
  let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="hand" role="img" aria-label="Mano: ${[...used].map(f => FINGER[f].name).join(", ") || "sin dedos"}">`;
  svg += `<path d="M44 128 Q30 150 34 186 Q40 232 104 236 Q170 236 180 196 L184 130 Z" fill="rgba(255,255,255,.07)" stroke="rgba(255,255,255,.22)" stroke-width="2"/>`;
  // pulgar
  svg += `<path d="M46 150 Q18 140 12 112 Q8 96 20 92 Q32 90 38 106 Q46 124 60 132 Z" fill="rgba(255,255,255,.07)" stroke="rgba(255,255,255,.22)" stroke-width="2"/>`;
  for (const x of F) {
    const on = used.has(x.f), col = FINGER[x.f].c, bottom = x.top + x.h + 20;
    svg += `<rect x="${x.x - 14}" y="${x.top}" width="28" height="${bottom - x.top}" rx="14" fill="${on ? col : "rgba(255,255,255,.07)"}" stroke="${on ? col : "rgba(255,255,255,.22)"}" stroke-width="2" ${on ? `style="filter:drop-shadow(0 0 10px ${col}99)"` : ""}/>`;
    svg += `<text x="${x.x}" y="${x.top + 22}" text-anchor="middle" font-size="16" font-weight="800" fill="${on ? "#11161c" : "rgba(255,255,255,.45)"}" font-family="JetBrains Mono, monospace">${x.f}</text>`;
  }
  return svg + "</svg>";
}

function fingerList(name) {
  const fg = fingering(name); if (!fg) return "";
  const by = {}; fg.forEach(p => (by[p.f] = by[p.f] || []).push(p));
  return Object.keys(by).sort().map(f => {
    const ps = by[f], frets = [...new Set(ps.map(p => p.fret))];
    const where = ps.length > 1 && frets.length === 1 ? `cejilla en traste ${frets[0]}, cuerdas ${STR[Math.max(...ps.map(p => p.s))]}–${STR[Math.min(...ps.map(p => p.s))]}` : ps.map(p => `cuerda ${STR[p.s]}, traste ${p.fret}`).join(" y ");
    return `<li><i style="background:${FINGER[f].c}">${f}</i><b>${FINGER[f].name}</b><span>${where}</span></li>`;
  }).join("");
}

// Qué dedos se quedan fijos o se deslizan por la misma cuerda entre dos acordes
export function changeHint(a, b) {
  const A = fingering(a), B = fingering(b); if (!A || !B) return "";
  const keep = A.filter(p => B.some(q => q.f === p.f && q.s === p.s && q.fret === p.fret)).map(p => p.f);
  const slide = A.filter(p => !keep.includes(p.f) && B.some(q => q.f === p.f && q.s === p.s && q.fret !== p.fret)).map(p => p.f);
  const nm = fs => [...new Set(fs)].map(f => FINGER[f].name.toLowerCase());
  const parts = [];
  if (keep.length) parts.push(`Deja fijo ${nm(keep).join(" y ")}`);
  if (slide.length) parts.push(`desliza ${nm(slide).join(" y ")} por la misma cuerda`);
  if (!parts.length) return "Cambia todos los dedos juntos: mira la forma completa antes de moverte.";
  const t = parts.join("; ") + "."; return t[0].toUpperCase() + t.slice(1);
}

export class BigChords {
  constructor(container) {
    this.el = document.createElement("div"); this.el.className = "bigchords";
    this.el.innerHTML = `<div class="bc-now"><div class="bc-head"><span class="bc-lab">Ahora</span><b class="bc-name"></b></div><div class="bc-body"><div class="bc-chart"></div><div class="bc-hand"></div><ul class="bc-fingers"></ul></div></div>
      <div class="bc-next"><div class="bc-head"><span class="bc-lab">Sigue</span><b class="bc-name"></b></div><div class="bc-chart"></div><p class="bc-hint"></p></div>`;
    container.appendChild(this.el); this.cur = null; this.next = null;
  }
  set(cur, next) {
    if (cur !== undefined) this.cur = cur;
    if (next !== undefined) this.next = next;
    const n = this.el.querySelector(".bc-now"), x = this.el.querySelector(".bc-next");
    const ok = this.cur && CHORDS[this.cur];
    this.el.hidden = !ok; if (!ok) return;
    if (n.dataset.c !== this.cur) {
      n.dataset.c = this.cur;
      n.querySelector(".bc-name").textContent = this.cur;
      n.querySelector(".bc-chart").innerHTML = chordSVG(this.cur);
      n.querySelector(".bc-hand").innerHTML = handSVG(new Set((fingering(this.cur) || []).map(p => p.f)));
      n.querySelector(".bc-fingers").innerHTML = fingerList(this.cur) || `<li><span>Solo cuerdas al aire.</span></li>`;
    }
    const hasNext = this.next && CHORDS[this.next] && this.next !== this.cur;
    x.hidden = !hasNext;
    if (hasNext && x.dataset.c !== this.cur + ">" + this.next) {
      x.dataset.c = this.cur + ">" + this.next;
      x.querySelector(".bc-name").textContent = this.next;
      x.querySelector(".bc-chart").innerHTML = chordSVG(this.next, { w: 170, small: true });
      x.querySelector(".bc-hint").textContent = changeHint(this.cur, this.next);
    }
  }
}
