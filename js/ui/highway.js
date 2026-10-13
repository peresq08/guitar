// Carril de tiempo estilo Guitar Hero. A la derecha de la línea "ahora" va lo que viene (10 s);
// a la izquierda, lo que ya pasó (30 s), pintado según el resultado. Abajo, una franja con lo que se escuchó.
// Dibuja en canvas con requestAnimationFrame usando el reloj de audio.

const NOW_FRAC = .6;

export class Highway {
  // Acordes: 10 s adelante y 30 s atrás. Golpes de rasgueo: ventana corta para que no se encimen.
  constructor(container, { mode = "chords", past = mode === "hits" ? 4 : 30, future = mode === "hits" ? 2 : 10 } = {}) {
    this.mode = mode; this.past = past; this.future = future; this.baseFuture = future; this.items = []; this.heardSegs = []; this.ticks = []; this.clock = null; this.raf = 0;
    this.wrap = document.createElement("div"); this.wrap.className = "hwy";
    this.canvas = document.createElement("canvas"); this.canvas.setAttribute("role", "img");
    this.canvas.setAttribute("aria-label", "Carril: lo que viene a la derecha, lo que tocaste a la izquierda");
    this.wrap.appendChild(this.canvas); container.appendChild(this.wrap);
    this.colors = null; this.colorsAt = 0;
    new ResizeObserver(() => this.draw()).observe(this.wrap);
  }
  reset() { this.items = []; this.heardSegs = []; this.ticks = []; this.strums = []; this.draw(); }
  // Golpes de rasgueo que se dibujan dentro de los bloques de acordes
  setStrums(list) { this.strums = list || []; this.future = this.strums.length && this.mode === "chords" ? 7 : this.baseFuture; }
  add(item) { this.items.push(item); return item; }
  addMany(list) { list.forEach(i => this.items.push(i)); }
  // Reemplaza lo proyectado a futuro (por ejemplo cuando cambia el tempo)
  replaceFuture(list, fromT) { this.items = this.items.filter(i => (i.t ?? i.t0) < fromT || i.fixed); this.addMany(list); }
  get(id) { return this.items.find(i => i.id === id); }
  heard(t0, t1, label, ok) {
    const last = this.heardSegs[this.heardSegs.length - 1];
    if (last && last.label === label && last.ok === ok && t0 - last.t1 < .2) last.t1 = t1;
    else this.heardSegs.push({ t0, t1, label, ok });
    if (this.heardSegs.length > 600) this.heardSegs.splice(0, 200);
  }
  tick(t, status) { this.ticks.push({ t, status }); if (this.ticks.length > 800) this.ticks.splice(0, 300); }
  // Vista previa en reposo: muestra lo que viene como si la ronda empezara en un segundo
  preview(list, strums) { this.stop(); this.items = []; this.heardSegs = []; this.ticks = []; this.setStrums(strums); this.addMany(list); this.clock = () => 0; this.draw(); }
  run(clock) { this.clock = clock; cancelAnimationFrame(this.raf); const loop = () => { this.draw(); this.raf = requestAnimationFrame(loop); }; loop(); }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; this.draw(); }

  palette() {
    const now = performance.now();
    if (!this.colors || now - this.colorsAt > 1000) {
      const cs = getComputedStyle(this.wrap), v = n => cs.getPropertyValue(n).trim();
      this.colors = { ink: v("--ink"), muted: v("--muted"), line: v("--line"), panel: v("--panel"), panel2: v("--panel2"), accent: v("--accent"), accentInk: v("--accent-ink"), good: v("--good"), warn: v("--warn"), bad: v("--led"), soft: v("--soft") };
      this.colorsAt = now;
    }
    return this.colors;
  }
  // Destello en la línea de "ahora" cuando algo sale bien (o mal)
  burst(kind) { (this.bursts = this.bursts || []).push({ at: performance.now(), kind }); if (this.bursts.length > 12) this.bursts.shift(); }
  mark(id, status) { const i = this.get(id); if (i) { i.status = status; if (this.raf) this.burst(status); } }
  draw() {
    const c = this.canvas, w = this.wrap.clientWidth, h = this.wrap.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const C = this.palette(), now = this.clock ? this.clock() : 0, nx = Math.round(w * NOW_FRAC);
    const PAST = this.past, FUTURE = this.future;
    const X = t => t <= now ? nx - (now - t) / PAST * nx : nx + (t - now) / FUTURE * (w - nx);
    const laneA = { y: 20, h: h - 20 - 28 }, laneB = { y: h - 21, h: 13 };
    const DISPLAY = '"Big Shoulders Display", "Barlow Condensed", system-ui, sans-serif';
    // Fondo: pasado apagado a la izquierda, futuro con un leve brillo hacia la línea
    let bg = g.createLinearGradient(0, 0, w, 0);
    bg.addColorStop(0, "rgba(255,255,255,0)"); bg.addColorStop(NOW_FRAC, "rgba(255,255,255,.025)"); bg.addColorStop(1, "rgba(242,163,58,.05)");
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.font = `600 10.5px Barlow, system-ui, sans-serif`; g.textBaseline = "middle";
    g.fillStyle = C.muted; g.textAlign = "left"; g.fillText("Lo que tocaste", 10, 10);
    g.textAlign = "right"; g.fillText("Lo que viene", w - 10, 10);
    // Marcas de tiempo
    g.strokeStyle = C.line; g.lineWidth = 1;
    const step = this.mode === "hits" ? 1 : 5;
    for (let s = Math.ceil(now - PAST); s <= now + FUTURE; s += (s < now ? step : 1)) {
      const x = Math.round(X(s)) + .5; if (x < 0 || x > w) continue;
      g.beginPath(); g.moveTo(x, laneA.y + laneA.h + 3); g.lineTo(x, laneA.y + laneA.h + 6); g.stroke();
    }
    const colorOf = st => st === "ok" ? C.good : st === "wrong" ? C.bad : st === "miss" ? C.muted : st === "meh" || st === "early" || st === "late" ? C.warn : null;
    // Atenuación del pasado lejano
    const fade = x => x >= nx ? 1 : .35 + .65 * Math.max(0, x / nx);
    if (this.mode === "chords") {
      for (const it of this.items) {
        const x0 = X(it.t0), x1 = X(it.t1); if (x1 < 0 || x0 > w) continue;
        const past = it.t1 <= now, cur = it.t0 <= now && it.t1 > now, col = colorOf(it.status);
        const x = Math.max(0, x0) + 2, ww = Math.min(w, x1) - x - 2; if (ww <= 0) continue;
        g.globalAlpha = fade(x + ww);
        roundRect(g, x, laneA.y, ww, laneA.h, 8);
        if (col) {
          const gr = g.createLinearGradient(0, laneA.y, 0, laneA.y + laneA.h);
          gr.addColorStop(0, col); gr.addColorStop(1, shade(col, -.35));
          g.fillStyle = gr; if (it.status === "miss") g.globalAlpha *= .45; g.fill();
          if (it.status === "ok" && x1 > nx - 60) { g.shadowColor = col; g.shadowBlur = 14; g.fill(); g.shadowBlur = 0; }
        } else {
          g.fillStyle = cur ? "rgba(242,163,58,.16)" : past ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.07)"; g.fill();
        }
        g.lineWidth = cur ? 2 : 1; g.strokeStyle = cur ? C.accent : col ? "rgba(255,255,255,.12)" : C.line;
        if (cur) { g.shadowColor = C.accent; g.shadowBlur = 16; }
        g.stroke(); g.shadowBlur = 0;
        // brillo superior
        g.fillStyle = "rgba(255,255,255,.06)"; roundRect(g, x + 1, laneA.y + 1, Math.max(0, ww - 2), 6, 6); g.fill();
        if (ww > 18) {
          g.fillStyle = col && it.status !== "miss" ? "#fff" : cur ? "#fff" : C.ink; g.textAlign = "center";
          const fs = past ? 14 : cur ? 22 : 20, hasStrums = this.strums && this.strums.length;
          g.font = `800 ${fs}px ${DISPLAY}`;
          g.fillText(it.label, x + ww / 2, laneA.y + (hasStrums ? laneA.h * .36 : laneA.h / 2) + 1, ww - 6);
        }
        g.globalAlpha = 1;
      }
      // Rasgueo: flechas pequeñas en la parte baja de los bloques
      if (this.strums && this.strums.length) {
        const ys = laneA.y + laneA.h - 11;
        g.textAlign = "center";
        for (const st of this.strums) {
          const x = X(st.t); if (x < 4 || x > w - 4) continue;
          const past = st.t <= now, near = Math.abs(st.t - now) < .09;
          g.globalAlpha = past ? .45 * fade(x) : 1;
          g.fillStyle = near ? C.accent : st.sym === "✕" ? C.warn : st.acc ? "#fff" : "rgba(255,255,255,.75)";
          g.font = `${st.acc ? 800 : 600} ${st.acc ? 13 : 11}px system-ui, sans-serif`;
          g.fillText(st.sym, x, ys);
        }
        g.globalAlpha = 1;
      }
    } else {
      const yc = laneA.y + laneA.h / 2;
      for (const it of this.items) {
        const x = X(it.t); if (x < -12 || x > w + 12) continue;
        const col = colorOf(it.status), r = it.acc ? 9 : 7.5, past = it.t <= now;
        g.globalAlpha = fade(x);
        g.beginPath(); g.arc(x, yc, r, 0, Math.PI * 2);
        if (col) { g.fillStyle = col; g.shadowColor = col; g.shadowBlur = it.status === "ok" ? 10 : 0; }
        else g.fillStyle = past ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.1)";
        g.fill(); g.shadowBlur = 0;
        g.lineWidth = 1.5; g.strokeStyle = col ? "rgba(255,255,255,.25)" : it.acc ? C.accent : "rgba(255,255,255,.3)"; g.stroke();
        g.fillStyle = col ? "#fff" : it.sym === "✕" ? C.warn : C.ink; g.textAlign = "center";
        g.font = `700 ${it.sym === "✕" ? 10 : 12}px system-ui, sans-serif`; g.fillText(it.sym, x, yc + .5);
        g.globalAlpha = 1;
      }
    }
    // Lo que se escuchó
    g.fillStyle = "rgba(255,255,255,.04)"; roundRect(g, 4, laneB.y, nx - 4, laneB.h, 5); g.fill();
    for (const s of this.heardSegs) {
      const x0 = Math.max(4, X(s.t0)), x1 = Math.min(nx, X(Math.min(s.t1, now))); if (x1 <= 4 || x1 - x0 < 1) continue;
      g.globalAlpha = .85 * fade(x1); g.fillStyle = s.ok ? C.good : C.bad; g.fillRect(x0, laneB.y + 3, x1 - x0, laneB.h - 6); g.globalAlpha = 1;
      if (x1 - x0 > 26) { g.fillStyle = "#fff"; g.textAlign = "center"; g.font = "700 9.5px Barlow, system-ui, sans-serif"; g.fillText(s.label, (x0 + x1) / 2, laneB.y + laneB.h / 2 + .5, x1 - x0 - 4); }
    }
    for (const k of this.ticks) {
      const x = X(k.t - (this.tickOffset || 0)); if (x < 4 || x > nx) continue;
      g.globalAlpha = fade(x); g.fillStyle = k.status === "extra" ? C.bad : "rgba(255,255,255,.75)"; g.fillRect(Math.round(x) - 1, laneB.y + 2, 2, laneB.h - 4); g.globalAlpha = 1;
    }
    // Línea de "ahora" con brillo
    const glow = g.createLinearGradient(nx - 26, 0, nx + 26, 0);
    glow.addColorStop(0, "rgba(242,163,58,0)"); glow.addColorStop(.5, "rgba(242,163,58,.18)"); glow.addColorStop(1, "rgba(242,163,58,0)");
    g.fillStyle = glow; g.fillRect(nx - 26, 14, 52, h - 14);
    g.shadowColor = C.accent; g.shadowBlur = 12; g.fillStyle = C.accent; g.fillRect(nx - 1.5, 14, 3, h - 14); g.shadowBlur = 0;
    g.beginPath(); g.moveTo(nx - 6, 14); g.lineTo(nx + 6, 14); g.lineTo(nx, 21); g.closePath(); g.fill();
    // Destellos
    const tnow = performance.now();
    (this.bursts || []).forEach(b => {
      const p = (tnow - b.at) / 450; if (p > 1) return;
      const col = b.kind === "ok" ? C.good : b.kind === "wrong" ? C.bad : b.kind === "miss" ? C.muted : C.warn;
      g.globalAlpha = 1 - p; g.strokeStyle = col; g.lineWidth = 3 * (1 - p) + .5;
      g.beginPath(); g.arc(nx, laneA.y + laneA.h / 2, 8 + p * 30, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
    });
  }
}
// Oscurece (k<0) o aclara (k>0) un color #rrggbb
function shade(hex, k) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim()); if (!m) return hex;
  const f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return `rgb(${f(parseInt(m[1], 16))},${f(parseInt(m[2], 16))},${f(parseInt(m[3], 16))})`;
}
function roundRect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/* ---- Reacción al momento: ícono que aparece un instante + racha ---- */
const ICONS = {
  ok: `<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
  wrong: `<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg>`,
  miss: `<svg viewBox="0 0 24 24"><path d="M5 12h9M11 7l5 5-5 5"/><path d="M19 6v12"/></svg>`,
  meh: `<svg viewBox="0 0 24 24"><path d="M6 13c2-3 4-3 6 0s4 3 6 0"/></svg>`,
};
const LABELS = { ok: "Bien", wrong: "Otro acorde", miss: "Te lo brincaste", meh: "Casi" };
export class Feedback {
  constructor(container) {
    this.el = document.createElement("div"); this.el.className = "fbk"; this.el.setAttribute("aria-live", "polite");
    this.el.innerHTML = `<span class="fbk-icon" aria-hidden="true"></span><span class="fbk-streak"><b>0</b><small>racha</small></span><span class="vh fbk-say"></span>`;
    container.appendChild(this.el); this.streak = 0; this.best = 0; this.host = container;
  }
  reset() { this.streak = 0; this.best = 0; this.paint(); this.el.querySelector(".fbk-icon").className = "fbk-icon"; }
  show(kind) {
    const ic = this.el.querySelector(".fbk-icon");
    ic.className = "fbk-icon"; void ic.offsetWidth; ic.innerHTML = ICONS[kind]; ic.className = `fbk-icon pop ${kind}`;
    this.el.querySelector(".fbk-say").textContent = LABELS[kind];
    if (kind === "ok") { this.streak++; this.best = Math.max(this.best, this.streak); } else if (kind !== "meh") this.streak = 0;
    this.paint(kind === "ok");
    this.host.classList.remove("flash-ok", "flash-bad"); void this.host.offsetWidth;
    if (kind === "ok") this.host.classList.add("flash-ok"); else if (kind !== "meh") this.host.classList.add("flash-bad");
  }
  paint(bump) {
    const s = this.el.querySelector(".fbk-streak"); s.querySelector("b").textContent = this.streak;
    s.classList.toggle("hot", this.streak >= 5);
    if (bump) { s.classList.remove("bump"); void s.offsetWidth; s.classList.add("bump"); }
  }
}

/* ---- Juez de acordes en tiempo real ----
   Recibe la línea de tiempo esperada (segmentos con su acorde) y, cuadro a cuadro, lo que se detecta.
   Da el veredicto en cuanto hay evidencia suficiente (para reaccionar al momento) o al terminar el segmento. */
export class ChordJudge {
  constructor({ onResult }) { this.segs = []; this.onResult = onResult; }
  setSegments(segs) { this.segs = segs.map(s => ({ ...s, hit: 0, n: 0, other: {}, done: false })); }
  addSegments(segs) { segs.forEach(s => this.segs.push({ ...s, hit: 0, n: 0, other: {}, done: false })); }
  // t: tiempo del cuadro en el reloj de audio; label: acorde detectado o null
  frame(t, label) {
    const ta = t - .12;   // el análisis mira ~170 ms hacia atrás: centra el cuadro
    for (const s of this.segs) {
      if (s.done) continue;
      const len = s.t1 - s.t0, from = s.t0 + Math.min(.25, len * .2);
      if (ta >= from && ta < s.t1 + .05 && label) {
        s.n++; if (label === s.c) s.hit++; else s.other[label] = (s.other[label] || 0) + 1;
        if (s.hit >= 3 && s.hit / s.n >= .6) this.finish(s, "ok");
      }
      if (!s.done && ta >= s.t1 + .05) {
        const st = s.n >= 2 && s.hit / s.n >= .5 ? "ok" : s.n >= 3 ? "wrong" : "miss";
        this.finish(s, st);
      }
    }
  }
  finish(s, status) { s.done = true; s.status = status; this.onResult?.(s, status); }
  flush(tEnd) { this.segs.forEach(s => { if (!s.done && s.t0 < tEnd - .3) this.frame(s.t1 + .2, null); }); }
}

// Cambia el texto de un elemento con una entrada breve (para el acorde actual)
export function swapText(el, text) {
  if (!el || el.textContent === String(text)) return;
  el.textContent = text; el.classList.remove("swap"); void el.offsetWidth; el.classList.add("swap");
}
