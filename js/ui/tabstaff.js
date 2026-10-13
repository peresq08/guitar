// Pentagrama de tablatura en canvas: un renglón por cuerda (la más aguda arriba), números de traste,
// barras de compás y nombres de sección. La nota actual se marca en ámbar y la vista se desliza sola
// para tenerla siempre a la vista; las que ya tocaste quedan en verde y las saltadas en gris.
const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const DISPLAY = '"Big Shoulders Display", "Barlow Condensed", system-ui, sans-serif';
const GUTTER = 30, TOP = 30, ROW = 21, CUR_FRAC = .3;

export class TabStaff {
  constructor(container, { onPick } = {}) {
    this.wrap = document.createElement("div"); this.wrap.className = "tabstaff";
    this.canvas = document.createElement("canvas"); this.canvas.setAttribute("role", "img");
    this.canvas.setAttribute("aria-label", "Tablatura: la nota que toca está marcada en ámbar");
    this.wrap.appendChild(this.canvas); container.appendChild(this.wrap);
    this.tab = null; this.items = []; this.cur = -1; this.status = new Map(); this.off = 0; this.target = 0; this.raf = 0; this.onPick = onPick;
    new ResizeObserver(() => { this.follow(true); this.draw(); }).observe(this.wrap);
    this.canvas.addEventListener("click", e => {
      if (!this.onPick || !this.items.length) return;
      const r = this.canvas.getBoundingClientRect(), x = e.clientX - r.left + this.off - GUTTER;
      let best = -1, bd = 24; this.items.forEach((it, k) => { const d = Math.abs(it.x - x); if (d < bd) { bd = d; best = k; } });
      if (best >= 0) this.onPick(this.items[best].i);
    });
  }
  // Muestra los eventos [from, to] de la tab (índices de tab.ev)
  set(tab, from, to) {
    this.tab = tab; this.status = new Map(); this.items = []; this.bars = []; this.secs = [];
    if (!tab) { this.draw(); return; }
    const ev = tab.ev; let x = 18, prevT = null, prevC = null;
    for (let i = from; i <= to && i < ev.length; i++) {
      const e = ev[i];
      if (prevT != null) x += Math.max(30, Math.min(110, (e.t - prevT) * .085));
      if (e.c !== prevC) {
        const bx = prevT == null ? 4 : x - 14; if (prevT != null) x += 6;
        this.bars.push({ x: bx, n: e.c + 1 });
        const sec = tab.compases[e.c]?.sec; if (sec) this.secs.push({ x: bx, text: sec });
        prevC = e.c;
      }
      const w = Math.max(...e.n.map(n => String(n[1]).length));
      this.items.push({ i, x, w, e }); prevT = e.t;
    }
    this.width = x + 40;
    this.cur = -1; this.off = this.target = 0; this.draw();
  }
  setLabels(afin) { this.labels = afin; this.draw(); }
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
    const tab = this.tab; if (!tab) return;
    const S = tab.cuerdas, rowH = Math.min(ROW, (h - TOP - 10) / Math.max(1, S - 1)), y0 = TOP, Y = s => y0 + s * rowH;
    // cuerdas
    g.strokeStyle = "rgba(255,255,255,.16)"; g.lineWidth = 1;
    for (let s = 0; s < S; s++) { g.beginPath(); g.moveTo(GUTTER - 4, Math.round(Y(s)) + .5); g.lineTo(w, Math.round(Y(s)) + .5); g.stroke(); }
    g.save(); g.beginPath(); g.rect(GUTTER, 0, w - GUTTER, h); g.clip();
    g.translate(GUTTER - this.off, 0);
    const vis = x => x > this.off - 60 && x < this.off + w;
    // compases y secciones
    g.textBaseline = "alphabetic";
    for (const b of this.bars) {
      if (!vis(b.x)) continue;
      g.strokeStyle = "rgba(255,255,255,.28)"; g.beginPath(); g.moveTo(Math.round(b.x) + .5, Y(0)); g.lineTo(Math.round(b.x) + .5, Y(S - 1)); g.stroke();
      g.fillStyle = "rgba(255,255,255,.38)"; g.font = `600 10px ${MONO}`; g.textAlign = "left"; g.fillText(String(b.n), b.x + 3, y0 - 8);
    }
    for (const s of this.secs) {
      if (!vis(s.x + 80)) continue;
      g.font = `800 13px ${DISPLAY}`; g.fillStyle = "#f2a33a"; g.textAlign = "left"; g.fillText(s.text, s.x + 22, y0 - 8);
    }
    // columna de la nota actual
    const curIt = this.items.find(t => t.i === this.cur);
    if (curIt) {
      const gx = curIt.x, gr = g.createLinearGradient(0, Y(0) - 14, 0, Y(S - 1) + 14);
      gr.addColorStop(0, "rgba(242,163,58,.10)"); gr.addColorStop(.5, "rgba(242,163,58,.22)"); gr.addColorStop(1, "rgba(242,163,58,.10)");
      g.fillStyle = gr; roundRect(g, gx - 16 - curIt.w * 3, Y(0) - 13, 32 + curIt.w * 6, (S - 1) * rowH + 26, 9); g.fill();
    }
    // notas
    const fs = Math.max(11, Math.min(14, rowH * .66));
    g.textAlign = "center"; g.textBaseline = "middle";
    for (let k = 0; k < this.items.length; k++) {
      const it = this.items[k]; if (!vis(it.x)) continue;
      const st = this.status.get(it.i), isCur = it.i === this.cur, nx = this.items[k + 1];
      for (const n of it.e.n) {
        const [s, f, , fl] = n, y = Y(s), txt = fl.includes("x") ? "×" : String(f);
        const tw = txt.length * fs * .62 + 6;
        g.fillStyle = isCur ? "#f2a33a" : "#141a21";
        roundRect(g, it.x - tw / 2, y - fs * .62, tw, fs * 1.24, 4); g.fill();
        if (isCur) { g.shadowColor = "rgba(242,163,58,.85)"; g.shadowBlur = 14; g.fill(); g.shadowBlur = 0; }
        g.font = `700 ${fs}px ${MONO}`;
        g.fillStyle = isCur ? "#1c1306" : st === "ok" ? "#41d184" : st === "skip" ? "rgba(255,255,255,.32)" : (fl.includes("g") ? "rgba(238,241,245,.7)" : "#eef1f5");
        g.fillText(txt, it.x, y + .5);
        // técnicas
        g.font = `600 10px ${MONO}`; g.fillStyle = isCur ? "#f2a33a" : "rgba(255,255,255,.5)";
        if (fl.includes("b")) g.fillText("b", it.x + tw / 2 + 5, y - 6);
        if (fl.includes("~")) g.fillText("~", it.x + tw / 2 + 5, y - 6);
        if ((fl.includes("h") || fl.includes("/")) && nx) {
          const nn = nx.e.n.find(m => m[0] === s);
          if (nn) {
            const mx = (it.x + nx.x) / 2;
            if (fl.includes("/")) { g.strokeStyle = g.fillStyle; g.beginPath(); const up = nn[1] > f; g.moveTo(it.x + tw / 2 + 2, up ? y + 4 : y - 4); g.lineTo(nx.x - 8, up ? y - 4 : y + 4); g.stroke(); }
            else g.fillText(nn[1] >= f ? "h" : "p", mx, y - rowH * .55);
          }
        }
        if (fl.includes("m") && !it.e.n.some(m => m[0] < s && m[3].includes("m"))) { g.fillText("PM", it.x, Y(S - 1) + 15); }
      }
    }
    g.restore();
    // nombres de las cuerdas
    g.fillStyle = "#12171d"; g.fillRect(0, 0, GUTTER - 4, h);
    g.font = `700 11px ${MONO}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "rgba(255,255,255,.5)";
    const lab = this.labels && this.labels.length === S ? this.labels : tab.afin;
    for (let s = 0; s < S; s++) g.fillText(stringName(lab, s), GUTTER / 2 - 2, Y(s));
  }
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// Diapasón pequeño con las notas de ahora (llenas, ámbar) y las que siguen (aro).
export function fretMini(tab, cur, next) {
  const S = tab.cuerdas, all = [...(cur || []), ...(next || [])].filter(n => !n[3].includes("x"));
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
  for (const n of next || []) { if (n[3].includes("x") || (cur || []).some(c => c[0] === n[0] && c[1] === n[1])) continue; svg += `<circle cx="${X(n[1])}" cy="${T + n[0] * H}" r="7" fill="none" stroke="rgba(242,163,58,.7)" stroke-width="1.6" stroke-dasharray="${n[1] === 0 ? "2 2" : "0"}"/>`; }
  for (const n of cur || []) {
    if (n[3].includes("x")) { svg += `<text x="${L - 12}" y="${T + n[0] * H + 4}" text-anchor="middle" font-size="12" fill="#ff5c4f" font-weight="700">×</text>`; continue; }
    const cx = X(n[1]), cy = T + n[0] * H;
    svg += n[1] === 0 ? `<circle cx="${cx}" cy="${cy}" r="6.5" fill="none" stroke="#f2a33a" stroke-width="2.2"/>`
      : `<circle cx="${cx}" cy="${cy}" r="8.5" fill="#f2a33a" style="filter:drop-shadow(0 0 6px rgba(242,163,58,.8))"/><text x="${cx}" y="${cy + 3.5}" text-anchor="middle" font-size="10" font-weight="800" font-family="JetBrains Mono, monospace" fill="#1c1306">${n[1]}</text>`;
  }
  return svg + "</svg>";
}
// Nombre de cada cuerda (con bemoles, como se nombran las afinaciones; la 1ª en "e" si es Mi)
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
export const stringName = (afin, s) => { const n = FLATS[((afin[s] % 12) + 12) % 12]; return s === 0 && n === "E" ? "e" : n; };
export const noteName = m => NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
export const pcName = m => NAMES[((m % 12) + 12) % 12];
