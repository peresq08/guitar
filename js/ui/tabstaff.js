// Pentagrama de tablatura en canvas: un renglón por cuerda (la más aguda arriba), números de traste,
// barras de compás, nombres de sección y técnicas (ligados, slides, bends, vibrato, palm mute, armónicos).
// La nota actual se marca en ámbar y la vista se desliza sola para tenerla siempre a la vista;
// las que ya tocaste quedan en verde, naranja (fuera de tiempo), rojo (equivocadas) o gris (saltadas).
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const DISPLAY = '"Big Shoulders Display", "Barlow Condensed", system-ui, sans-serif';
const BODY = '"Barlow", system-ui, sans-serif';
const TECH = "#ffc46b";
export const GUTTER = 30;
import { laneScale, cycleLane } from "../store.js";
const TOP0 = 36, TOP_SHAPES = 54, BOTTOM = 24, ROW = 22, CUR_FRAC = .3;

// Posiciones horizontales de los eventos [from, to]: proporcionales a la duración, con mínimo y máximo.
export function layout(tab, from, to, k = laneScale()) {
  const items = [], bars = [], secs = [];
  const ev = tab.ev; let x = 18, prevT = null, prevC = null;
  for (let i = from; i <= to && i < ev.length; i++) {
    const e = ev[i], prev = ev[i - 1];
    const legato = prev && i > from && prev.n.some(n => /[h\/]/.test(n[3]));
    if (prevT != null) x += Math.max((legato ? 38 : 32) * k, Math.min(110 * k, (e.t - prevT) * .085 * k));
    if (e.c !== prevC) {
      const bx = prevT == null ? 4 : x - 14; if (prevT != null) x += 6;
      bars.push({ x: bx, n: e.c + 1, c: e.c });
      const sec = tab.compases[e.c]?.sec; if (sec) secs.push({ x: bx, text: sec });
      prevC = e.c;
    }
    const w = Math.max(...e.n.map(n => (n[3].includes("*") ? 2 : 0) + String(n[1]).length));
    items.push({ i, x, w, e }); prevT = e.t;
  }
  return { items, bars, secs, width: x + 40, k };
}
export const staffHeight = (S, shapes, k = laneScale()) => (shapes ? TOP_SHAPES : TOP0) + (S - 1) * ROW * k + BOTTOM;

// Dibuja la tab en el contexto g. o: { tab, w, h, off, cur, status, playX, labels, x0 (inicio visible) }
export function paint(g, L, o) {
  const { tab, w, h } = o, off = o.off || 0, status = o.status || new Map(), TOP = o.shapes?.length ? TOP_SHAPES : TOP0;
  const labY = o.shapes?.length ? TOP - 40 : TOP - 20;
  const K = L.k || 1;
  const S = tab.cuerdas, rowH = Math.min(ROW * K, (h - TOP - BOTTOM) / Math.max(1, S - 1)), Y = s => TOP + s * rowH, yLow = Y(S - 1);
  g.strokeStyle = "rgba(255,255,255,.16)"; g.lineWidth = 1;
  for (let s = 0; s < S; s++) { g.beginPath(); g.moveTo(GUTTER - 4, Math.round(Y(s)) + .5); g.lineTo(w, Math.round(Y(s)) + .5); g.stroke(); }
  g.save(); g.beginPath(); g.rect(GUTTER, 0, w - GUTTER, h); g.clip();
  g.translate(GUTTER - off, 0);
  const vis = x => x > off - 60 && x < off + w;
  // rango resaltado (vista completa)
  if (o.sel) { const [xa, xb] = o.sel; g.fillStyle = "rgba(242,163,58,.06)"; g.fillRect(xa, Y(0) - 14, xb - xa, (S - 1) * rowH + 28); }
  g.textBaseline = "alphabetic";
  for (const b of L.bars) {
    if (!vis(b.x)) continue;
    g.strokeStyle = "rgba(255,255,255,.3)"; g.beginPath(); g.moveTo(Math.round(b.x) + .5, Y(0)); g.lineTo(Math.round(b.x) + .5, yLow); g.stroke();
    g.fillStyle = "rgba(255,255,255,.4)"; g.font = `600 10px ${MONO}`; g.textAlign = "left"; g.fillText(String(b.n), b.x + 3, labY);
  }
  for (const s of L.secs) {
    if (!vis(s.x + 80)) continue;
    g.font = `800 13px ${DISPLAY}`; g.fillStyle = "#f2a33a"; g.textAlign = "left"; g.fillText(s.text, s.x + 24, labY);
  }
  // formas de acorde: "C" con una línea que abarca las notas que caben en esa forma
  if (o.shapes?.length) {
    const byI = new Map(L.items.map(it => [it.i, it]));
    g.textBaseline = "middle"; g.textAlign = "left";
    for (const sh of o.shapes) {
      const a = byI.get(sh.i), b = byI.get(sh.j); if (!a || !b) continue;
      const xa = a.x - 10, xb = b.x + 10; if (xb < off - 20 || xa > off + w) continue;
      const y = TOP - 22, on = o.cur >= sh.i && o.cur <= sh.j;
      g.font = `800 14px ${DISPLAY}`; const tw = g.measureText(sh.name).width + 12;
      g.fillStyle = on ? "rgba(242,163,58,.95)" : "rgba(242,163,58,.16)"; roundRect(g, xa, y - 9, tw, 18, 6); g.fill();
      g.fillStyle = on ? "#1c1306" : "#ffc46b"; g.fillText(sh.name, xa + 6, y + 1);
      if (xb - xa > tw + 6) { g.strokeStyle = on ? "rgba(242,163,58,.8)" : "rgba(242,163,58,.35)"; g.beginPath(); g.moveTo(xa + tw + 4, y + .5); g.lineTo(xb, y + .5); g.moveTo(xb, y - 4); g.lineTo(xb, y + 5); g.stroke(); }
    }
  }
  if (o.playX != null) {
    g.strokeStyle = "rgba(242,163,58,.9)"; g.lineWidth = 2; g.shadowColor = "rgba(242,163,58,.8)"; g.shadowBlur = 10;
    g.beginPath(); g.moveTo(o.playX, Y(0) - 16); g.lineTo(o.playX, yLow + 12); g.stroke(); g.shadowBlur = 0; g.lineWidth = 1;
  }
  const curIt = o.playX == null ? L.items.find(t => t.i === o.cur) : null;
  if (curIt) {
    const gr = g.createLinearGradient(0, Y(0) - 14, 0, yLow + 14);
    gr.addColorStop(0, "rgba(242,163,58,.10)"); gr.addColorStop(.5, "rgba(242,163,58,.22)"); gr.addColorStop(1, "rgba(242,163,58,.10)");
    g.fillStyle = gr; roundRect(g, curIt.x - 16 - curIt.w * 3, Y(0) - 13, 32 + curIt.w * 6, (S - 1) * rowH + 26, 9); g.fill();
  }
  const fs = Math.max(11, Math.min(14 * K, rowH * .66));
  const tw = (it, n) => (labelOf(n).length) * fs * .62 + 6;
  // Palm mute: "P.M." con línea punteada bajo los eventos seguidos que lo llevan
  g.font = `800 11px ${BODY}`; g.textAlign = "left"; g.textBaseline = "middle";
  for (let k = 0; k < L.items.length; k++) {
    const isPM = it => it && it.e.n.some(n => n[3].includes("m"));
    if (!isPM(L.items[k]) || isPM(L.items[k - 1])) continue;
    let j = k; while (isPM(L.items[j + 1]) && L.items[j + 1].e.c - L.items[j].e.c <= 1) j++;
    const xa = L.items[k].x - 10, xb = L.items[j].x + 10;
    if (!vis(xa) && !vis(xb) && !(xa < off && xb > off + w)) continue;
    const yy = yLow + 15;
    g.fillStyle = TECH; g.fillText("P.M.", xa, yy);
    if (xb - xa > 34) { g.strokeStyle = TECH; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(xa + 28, yy); g.lineTo(xb, yy); g.stroke(); g.setLineDash([]); g.beginPath(); g.moveTo(xb, yy - 4); g.lineTo(xb, yy + 4); g.stroke(); }
  }
  // notas y técnicas
  g.textBaseline = "middle";
  for (let k = 0; k < L.items.length; k++) {
    const it = L.items[k]; if (!vis(it.x)) continue;
    const st = status.get(it.i), isCur = it.i === o.cur, nx = L.items[k + 1];
    for (const n of it.e.n) {
      const [s, f, , fl] = n, y = Y(s), txt = labelOf(n), wdt = tw(it, n);
      g.fillStyle = isCur ? "#f2a33a" : "#121820";
      roundRect(g, it.x - wdt / 2, y - fs * .62, wdt, fs * 1.24, 4); g.fill();
      if (isCur) { g.shadowColor = "rgba(242,163,58,.85)"; g.shadowBlur = 14; g.fill(); g.shadowBlur = 0; }
      g.font = `700 ${fl.includes("g") ? fs - 2 : fs}px ${MONO}`; g.textAlign = "center";
      g.fillStyle = isCur ? "#1c1306" : st === "ok" ? "#41d184" : st === "meh" ? "#ffb23f" : st === "wrong" ? "#ff5c4f" : (st === "skip" || st === "miss") ? "rgba(255,255,255,.32)" : fl.includes("x") ? "#ff9a8f" : fl.includes("g") ? "rgba(238,241,245,.7)" : "#eef1f5";
      g.fillText(txt, it.x, y + .5);
      g.strokeStyle = TECH; g.fillStyle = TECH; g.lineWidth = 1.7;
      const nn = nx && nx.e.n.find(m => m[0] === s);
      // hammer-on / pull-off: arco sobre la cuerda hasta la nota siguiente, con h o p
      if (fl.includes("h") && nn) {
        const x1 = it.x + 2, x2 = nx.x - 2, yt = y - fs * .62 - 2, mx = (x1 + x2) / 2;
        g.beginPath(); g.moveTo(x1, yt); g.quadraticCurveTo(mx, yt - 13, x2, yt); g.stroke();
        g.font = `800 ${Math.round(12 * K)}px ${BODY}`; g.fillText(nn[1] >= f ? "h" : "p", mx, yt - 13);
      }
      // slide: línea diagonal hasta la siguiente nota
      if (fl.includes("/")) {
        const up = nn ? nn[1] > f : true, xa = it.x + wdt / 2 + 1, xb = nn ? nx.x - tw(nx, nn) / 2 - 1 : xa + 14;
        g.beginPath(); g.moveTo(xa, up ? y + 4 : y - 4); g.lineTo(xb, up ? y - 4 : y + 4); g.stroke();
        if (nn && xb - xa > 18) { g.font = `800 10px ${BODY}`; g.fillText("sl.", (xa + xb) / 2, y - 10); }
      }
      // bend: flecha curva hacia arriba
      if (fl.includes("b")) {
        const xa = it.x + wdt / 2 + 1, xb = xa + 12, yb = y - 15;
        g.beginPath(); g.moveTo(xa, y); g.quadraticCurveTo(xb, y, xb, yb + 3); g.stroke();
        g.beginPath(); g.moveTo(xb - 4, yb + 5); g.lineTo(xb, yb - 1); g.lineTo(xb + 4, yb + 5); g.closePath(); g.fill();
      }
      // vibrato: onda
      if (fl.includes("~")) {
        const xa = it.x - 8, yv = y - fs * .62 - 6; g.beginPath();
        for (let q = 0; q <= 18; q++) { const xx = xa + q, yy = yv + Math.sin(q / 18 * Math.PI * 4) * 2.2; q ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }
        g.stroke();
      }
      g.lineWidth = 1;
    }
  }
  g.restore();
  g.fillStyle = "#12171d"; g.fillRect(0, 0, GUTTER - 4, h);
  g.font = `700 11px ${MONO}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "rgba(255,255,255,.5)";
  const lab = o.labels && o.labels.length === S ? o.labels : tab.afin;
  for (let s = 0; s < S; s++) g.fillText(stringName(lab, s), GUTTER / 2 - 2, Y(s));
}
const labelOf = n => n[3].includes("x") ? "×" : n[3].includes("*") ? `<${n[1]}>` : n[3].includes("g") ? `(${n[1]})` : String(n[1]);

export class TabStaff {
  constructor(container, { onPick } = {}) {
    this.wrap = document.createElement("div"); this.wrap.className = "tabstaff";
    this.canvas = document.createElement("canvas"); this.canvas.setAttribute("role", "img");
    this.canvas.setAttribute("aria-label", "Tablatura: la nota que toca está marcada en ámbar");
    this.wrap.appendChild(this.canvas); container.appendChild(this.wrap);
    const zb = document.createElement("button"); zb.className = "lanesize"; zb.type = "button"; zb.textContent = "A+";
    zb.title = "Cambiar el tamaño de la tab"; zb.setAttribute("aria-label", "Cambiar el tamaño de la tab");
    zb.onclick = e => { e.stopPropagation(); cycleLane(); }; this.wrap.appendChild(zb);
    this.tab = null; this.L = { items: [], bars: [], secs: [], width: 0 }; this.cur = -1; this.status = new Map(); this.off = 0; this.target = 0; this.raf = 0; this.onPick = onPick;
    new ResizeObserver(() => {
      if (this.tab && this.L.k !== laneScale()) { this.L = layout(this.tab, this.rng[0], this.rng[1]); }
      this.follow(true); this.draw();
    }).observe(this.wrap);
    this.canvas.addEventListener("click", e => {
      if (!this.onPick || !this.items.length) return;
      const r = this.canvas.getBoundingClientRect(), x = e.clientX - r.left + this.off - GUTTER;
      let best = -1, bd = 24; this.items.forEach((it, k) => { const d = Math.abs(it.x - x); if (d < bd) { bd = d; best = k; } });
      if (best >= 0) this.onPick(this.items[best].i);
    });
  }
  get items() { return this.L.items; }
  get width() { return this.L.width; }
  // Muestra los eventos [from, to] de la tab (índices de tab.ev)
  set(tab, from, to) {
    this.tab = tab; this.status = new Map(); this.rng = [from, to];
    this.L = tab ? layout(tab, from, to) : { items: [], bars: [], secs: [], width: 0 };
    this.cur = -1; this.off = this.target = 0; this.draw();
  }
  // Modo con tempo: la vista avanza continua; x es la posición del "ahora" en la tab
  play(x, cur) {
    this.playX = x; if (cur != null) this.cur = cur;
    const w = this.wrap.clientWidth - GUTTER;
    this.off = this.target = Math.max(0, Math.min(Math.max(0, this.width - w), x - w * CUR_FRAC));
    this.draw();
  }
  endPlay() { this.playX = null; this.draw(); }
  // Posición entre la nota i y la siguiente (frac 0–1)
  xAt(i, frac = 0) {
    const k = this.items.findIndex(t => t.i === i); if (k < 0) return 0;
    const a = this.items[k].x, b = this.items[k + 1]?.x ?? a + 40;
    return a + (b - a) * Math.max(0, Math.min(1, frac));
  }
  setLabels(afin) { this.labels = afin; this.draw(); }
  setShapes(list) { this.shapes = list || []; this.wrap.classList.toggle("shapes", !!this.shapes.length); this.draw(); }
  setCursor(i, instant = false) { this.cur = i; this.follow(instant); }
  mark(i, st) { this.status.set(i, st); this.kick(); }
  clearMarks() { this.status.clear(); this.kick(); }
  follow(instant) {
    const it = this.items.find(t => t.i === this.cur); if (!it) { this.kick(); return; }
    const w = this.wrap.clientWidth - GUTTER;
    this.target = Math.max(0, Math.min(Math.max(0, this.width - w), it.x - w * CUR_FRAC));
    if (instant) this.off = this.target;
    this.kick();
  }
  kick() {
    if (this.raf) return;
    const loop = () => {
      const d = this.target - this.off;
      this.off += Math.abs(d) < .5 ? d : d * .22;
      this.draw();
      this.raf = Math.abs(this.target - this.off) > .3 ? requestAnimationFrame(loop) : 0;
      if (!this.raf) this.draw();
    };
    this.raf = requestAnimationFrame(loop);
  }
  draw() {
    const c = this.canvas, w = this.wrap.clientWidth, h = this.wrap.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    if (!this.tab) return;
    paint(g, this.L, { tab: this.tab, w, h, off: this.off, cur: this.cur, status: this.status, playX: this.playX, labels: this.labels, shapes: this.shapes });
  }
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// Vista completa: la tab partida en renglones, como impresa. Clic en una nota para ir a ella.
export function renderFullTab(box, tab, { cur = -1, sel = null, labels = null, shapes = null, onPick } = {}) {
  const L = layout(tab, 0, tab.ev.length - 1);
  const W = Math.max(320, box.clientWidth || 900), avail = W - GUTTER - 8, H = staffHeight(tab.cuerdas, shapes?.length);
  const bounds = L.bars.map(b => b.x).concat([L.width - 24]);
  const systems = []; let start = 0;
  for (let k = 1; k < bounds.length; k++) {
    if (bounds[k] - bounds[start] > avail && k - 1 > start) { systems.push([bounds[start], bounds[k - 1]]); start = k - 1; }
  }
  systems.push([bounds[start], bounds[bounds.length - 1]]);
  let selX = null;
  if (sel) { const a = L.bars.find(b => b.c === sel[0]), bEnd = L.bars.find(b => b.c === sel[1] + 1); if (a) selX = [a.x, bEnd ? bEnd.x : L.width]; }
  box.innerHTML = "";
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  for (const [x0, x1] of systems) {
    const c = document.createElement("canvas"), w = Math.min(W, x1 - x0 + GUTTER + 12);
    c.width = Math.round(w * dpr); c.height = Math.round(H * dpr); c.style.width = w + "px"; c.style.height = H + "px";
    const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(g, L, { tab, w, h: H, off: x0 - 4, cur, labels, sel: selX, shapes });
    if (onPick) c.addEventListener("click", e => {
      const r = c.getBoundingClientRect(), x = e.clientX - r.left + x0 - 4 - GUTTER;
      let best = null, bd = 22; for (const it of L.items) { const d = Math.abs(it.x - x); if (d < bd) { bd = d; best = it; } }
      if (best) onPick(best.i);
    });
    box.appendChild(c);
  }
  const curIt = L.items.find(t => t.i === cur);
  if (curIt) { const k = systems.findIndex(([a, b]) => curIt.x >= a && curIt.x <= b + 20); if (k >= 0) setTimeout(() => box.children[k]?.scrollIntoView({ block: "center" }), 60); }
}

// Diapasón pequeño con las notas de ahora (llenas, ámbar) y las que siguen (aro).
export function fretMini(tab, cur, next, shape = null) {
  const S = tab.cuerdas, ghost = shape ? shape.pos.map((f, s) => f == null ? null : [s, f, 0, ""]).filter(Boolean) : [];
  const all = [...(cur || []), ...(next || []), ...ghost].filter(n => !n[3].includes("x"));
  const fr = all.map(n => n[1]).filter(f => f > 0);
  let lo = fr.length ? Math.min(...fr) : 1, hi = fr.length ? Math.max(...fr) : 4;
  if (hi - lo > 5) { const cf = (cur || []).map(n => n[1]).filter(f => f > 0); if (cf.length) { lo = Math.min(...cf); hi = Math.max(...cf); } }
  let start = Math.max(1, lo - 1); const span = Math.max(4, hi - start + 1); if (start + span - 1 < hi) start = hi - span + 1;
  const W = 46, H = 15, L = 26, T = 14, width = L + span * W + 8, height = T + (S - 1) * H + 22;
  const X = f => f === 0 ? L - 12 : L + (f - start) * W + W / 2;
  let svg = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true" class="fretmini">`;
  if (start === 1) svg += `<rect x="${L - 3}" y="${T - 1}" width="4" height="${(S - 1) * H + 2}" fill="rgba(255,255,255,.75)"/>`;
  for (let k = 0; k <= span; k++) svg += `<line x1="${L + k * W}" y1="${T}" x2="${L + k * W}" y2="${T + (S - 1) * H}" stroke="rgba(255,255,255,.22)"/>`;
  for (let s = 0; s < S; s++) svg += `<line x1="${L}" y1="${T + s * H}" x2="${L + span * W}" y2="${T + s * H}" stroke="rgba(255,255,255,${.25 + s * .05})" stroke-width="${1 + s * .25}"/>`;
  for (let k = 0; k < span; k++) { const f = start + k; if ([3, 5, 7, 9, 15, 17, 19, 21].includes(f)) svg += `<circle cx="${L + k * W + W / 2}" cy="${T + (S - 1) * H / 2}" r="3" fill="rgba(255,255,255,.12)"/>`; if (f === 12 || f === 24) svg += `<circle cx="${L + k * W + W / 2}" cy="${T + H * .5}" r="3" fill="rgba(255,255,255,.12)"/><circle cx="${L + k * W + W / 2}" cy="${T + (S - 1.5) * H}" r="3" fill="rgba(255,255,255,.12)"/>`; }
  for (let k = 0; k < span; k++) svg += `<text x="${L + k * W + W / 2}" y="${height - 3}" text-anchor="middle" font-size="10" font-family="JetBrains Mono, monospace" fill="rgba(255,255,255,.45)">${start + k}</text>`;
  for (const n of ghost) { if (n[1] === 0) svg += `<circle cx="${X(0)}" cy="${T + n[0] * H}" r="5" fill="none" stroke="rgba(255,196,107,.35)" stroke-width="1.4"/>`; else svg += `<circle cx="${X(n[1])}" cy="${T + n[0] * H}" r="7.5" fill="rgba(255,196,107,.18)" stroke="rgba(255,196,107,.35)"/>`; }
  for (const s2 of (shape ? shape.pos.map((f, s) => f == null ? s : -1).filter(s => s >= 0) : [])) svg += `<text x="${L - 12}" y="${T + s2 * H + 4}" text-anchor="middle" font-size="11" fill="rgba(255,255,255,.35)">×</text>`;
  for (const n of next || []) { if (n[3].includes("x") || (cur || []).some(c => c[0] === n[0] && c[1] === n[1])) continue; svg += `<circle cx="${X(n[1])}" cy="${T + n[0] * H}" r="7" fill="none" stroke="rgba(242,163,58,.7)" stroke-width="1.6" stroke-dasharray="${n[1] === 0 ? "2 2" : "0"}"/>`; }
  for (const n of cur || []) {
    if (n[3].includes("x")) { svg += `<text x="${L - 12}" y="${T + n[0] * H + 4}" text-anchor="middle" font-size="12" fill="#ff5c4f" font-weight="700">×</text>`; continue; }
    const cx = X(n[1]), cy = T + n[0] * H;
    svg += n[1] === 0 ? `<circle cx="${cx}" cy="${cy}" r="6.5" fill="none" stroke="#f2a33a" stroke-width="2.2"/>`
      : `<circle cx="${cx}" cy="${cy}" r="8.5" fill="#f2a33a" style="filter:drop-shadow(0 0 6px rgba(242,163,58,.8))"/><text x="${cx}" y="${cy + 3.5}" text-anchor="middle" font-size="10" font-weight="800" font-family="JetBrains Mono, monospace" fill="#1c1306">${n[1]}</text>`;
  }
  return svg + "</svg>";
}
const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
// Nombre de cada cuerda (con bemoles, como se nombran las afinaciones; la 1ª en "e" si es Mi)
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
export const stringName = (afin, s) => { const n = FLATS[((afin[s] % 12) + 12) % 12]; return s === 0 && n === "E" ? "e" : n; };
export const noteName = m => NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
export const pcName = m => NAMES[((m % 12) + 12) % 12];
