// Notas en el mástil: la app te pide una nota en una cuerda ("La en la 5ª cuerda") y la comprueba por el micrófono.
// Saber dónde está cada nota es la base para leer menos tabs, encontrar raíces de acordes con cejilla y hacer solos.
import { data, save, toast, esc, practiceStart, practiceEnd, $ } from "../store.js";
import * as A from "../audio.js";
import { Feedback, swapText } from "../ui/highway.js";

const STD = [40, 45, 50, 55, 59, 64];                  // de la 6ª a la 1ª
const SNAME = ["6ª (Mi grave)", "5ª (La)", "4ª (Re)", "3ª (Sol)", "2ª (Si)", "1ª (Mi aguda)"];
const ES = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
const EN = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
const S = { run: false, iv: null, cur: null, prev: null, t0: 0, tPrompt: 0, n: 0, good: 0, times: [], lastOnset: -9, tc: 0, mic: true, revealed: false, endAt: 0, startedAt: 0 };
let el, fb;

const cfg = () => { data.mastil = data.mastil || { cuerdas: [0, 1], hasta: 5, naturales: true, best: {}, notas: {} }; return data.mastil; };
const keyOf = c => `${c.cuerdas.slice().sort().join("")}-${c.hasta}-${c.naturales ? "n" : "t"}`;

export function mountMastil(container) {
  el = container;
  el.innerHTML = `
  <div class="cols" style="--cols:minmax(0,1.5fr) minmax(0,1fr)">
  <div class="col">
  <div class="panel deck-panel screen">
   <div class="deck">
    <div class="deck-top">
      <div class="seg mstrings" role="group" aria-label="Cuerdas" id="msStr">${[0, 1, 2, 3, 4, 5].map(s => `<button data-s="${s}" aria-pressed="false" title="Cuerda ${SNAME[s]}">${6 - s}ª</button>`).join("")}</div>
      <select id="msRange" aria-label="Trastes"><option value="5">Trastes 0 a 5</option><option value="7">Trastes 0 a 7</option><option value="12">Trastes 0 a 12</option></select>
      <label class="chip-toggle"><input type="checkbox" id="msNat"> Solo naturales</label>
    </div>
    <div class="stage dstage msstage" id="msStage" aria-live="polite">
      <div class="meta">
        <span class="lab" id="msLab">Listo</span>
        <div class="now"><span class="chordnow" id="msNote">La</span><span class="mswhere"><b id="msEn">A</b><span id="msStrName">en la 5ª cuerda</span></span></div>
        <div class="lmeter"><span>Escucho</span><div class="bar"><div id="msBar"></div></div><b id="msHeard">–</b></div>
        <span class="sub" id="msSub"></span>
      </div>
    </div>
    <div class="msboard" id="msBoard"></div>
    <div class="lprog" id="msProg"></div>
    <div class="deck-ctl">
      <label class="chip-toggle" title="La app comprueba la nota por el micrófono"><input type="checkbox" id="msMic"> Micrófono</label>
      <select id="msDur" aria-label="Duración"><option value="1">1 minuto</option><option value="2">2 minutos</option><option value="3">3 minutos</option></select>
      <button class="btn small" id="msShow" hidden>Ver dónde está</button>
      <button class="btn small" id="msSkip" hidden>Saltar</button>
      <button class="btn primary" id="msStart" data-primary>Empezar</button>
    </div>
   </div>
  </div>
  </div>
  <div class="col">
  <div class="panel" id="msStats"></div>
  <div class="panel">
    <div class="label">Cómo encontrarlas rápido</div>
    <ul class="mstips">
      <li>Aprende primero las notas de la 6ª y la 5ª cuerda: son las raíces de casi todos los acordes con cejilla y power chords.</li>
      <li>Entre Mi–Fa y Si–Do no hay sostenido: están a un traste. Entre las demás naturales hay dos trastes.</li>
      <li>El traste 12 repite la cuerda al aire, una octava arriba. Los puntos del mástil (3, 5, 7, 9, 12) son tu mapa.</li>
      <li>Octavas: de la 6ª cuerda, dos cuerdas abajo y dos trastes adelante está la misma nota.</li>
    </ul>
  </div>
  </div>
  </div>`;
  fb = new Feedback($("#msStage", el));
  el.querySelectorAll("[data-s]").forEach(b => b.onclick = () => {
    if (S.run) return; const c = cfg(), s = +b.dataset.s;
    c.cuerdas = c.cuerdas.includes(s) ? c.cuerdas.filter(x => x !== s) : [...c.cuerdas, s];
    if (!c.cuerdas.length) c.cuerdas = [s];
    save(); paint();
  });
  $("#msRange", el).onchange = e => { cfg().hasta = +e.target.value; save(); paint(); };
  $("#msNat", el).onchange = e => { cfg().naturales = e.target.checked; save(); paint(); };
  $("#msMic", el).onchange = e => { data.ajustes.mastilMic = e.target.checked; save(); };
  $("#msStart", el).onclick = () => { if (!S.run) return start(); const el2 = performance.now() - S.startedAt; if (S.good >= 3 && el2 >= 20000) finish(el2 / 60000); else stop(); };
  $("#msSkip", el).onclick = () => { if (S.run) answer(false); };
  $("#msShow", el).onclick = () => {
    if (!S.run) return;
    if (!S.revealed) { S.revealed = true; board(S.cur, "show"); $("#msShow", el).textContent = "La sabía"; $("#msSkip", el).textContent = "No la sabía"; $("#msShow", el).setAttribute("data-primary", ""); }
    else answer(true);
  };
  paint();
}
export function stopMastil() { if (S.run) stop(); }

function pool() {
  const c = cfg(), out = [];
  for (const s of c.cuerdas) for (let f = 0; f <= c.hasta; f++) { const pc = (STD[s] + f) % 12; if (!c.naturales || NATURAL.includes(pc)) out.push({ s, pc }); }
  const seen = new Set(); return out.filter(x => { const k = x.s + ":" + x.pc; if (seen.has(k)) return false; seen.add(k); return true; });
}
// Trastes donde está la nota en esa cuerda, dentro del rango
const fretsOf = (q, hasta = cfg().hasta) => { const out = []; for (let f = 0; f <= hasta; f++) if ((STD[q.s] + f) % 12 === q.pc) out.push(f); return out; };

function paint() {
  const c = cfg();
  el.querySelectorAll("[data-s]").forEach(b => b.setAttribute("aria-pressed", c.cuerdas.includes(+b.dataset.s)));
  $("#msRange", el).value = String(c.hasta); $("#msNat", el).checked = c.naturales;
  $("#msMic", el).checked = data.ajustes.mastilMic !== false;
  $("#msDur", el).value = String(data.ajustes.mastilMin || 1);
  $("#msDur", el).onchange = e => { data.ajustes.mastilMin = +e.target.value; save(); };
  if (!S.run) { prompt(pool()[0], true); $("#msSub", el).textContent = `${pool().length} notas posibles con esta selección`; }
  stats();
}
function prompt(q, idle = false) {
  S.cur = q; if (!q) return;
  swapText($("#msNote", el), ES[q.pc]);
  $("#msEn", el).textContent = EN[q.pc];
  $("#msStrName", el).textContent = `en la ${SNAME[q.s]}`;
  board(q, idle ? "idle" : "ask");
}
function board(q, mode) {
  const c = cfg(), hi = c.hasta, W = 46, H = 24, L = 30, T = 18, w = L + (hi + 1) * W + 10, h = T + 5 * H + 26;
  const X = f => f === 0 ? L - 12 : L + (f - .5) * W, Y = s => T + (5 - s) * H;
  let svg = `<svg viewBox="0 0 ${w} ${h}" width="100%" style="max-height:200px" role="img" aria-label="Diapasón">`;
  svg += `<rect x="${L - 3}" y="${T - 2}" width="4" height="${5 * H + 4}" fill="rgba(255,255,255,.8)"/>`;
  for (let f = 1; f <= hi; f++) svg += `<line x1="${L + f * W}" y1="${T}" x2="${L + f * W}" y2="${T + 5 * H}" stroke="rgba(255,255,255,.22)" stroke-width="2"/>`;
  for (const f of [3, 5, 7, 9, 12]) if (f <= hi) svg += f === 12 ? `<circle cx="${X(f)}" cy="${T + 1.5 * H}" r="4" fill="rgba(255,255,255,.14)"/><circle cx="${X(f)}" cy="${T + 3.5 * H}" r="4" fill="rgba(255,255,255,.14)"/>` : `<circle cx="${X(f)}" cy="${T + 2.5 * H}" r="4" fill="rgba(255,255,255,.14)"/>`;
  for (let s = 0; s < 6; s++) {
    const on = q && s === q.s && mode !== "idle";
    svg += `<line x1="${L}" y1="${Y(s)}" x2="${L + hi * W + 8}" y2="${Y(s)}" stroke="${on ? "#f2a33a" : "rgba(255,255,255,.4)"}" stroke-width="${on ? 3.2 : 1 + s * .3}" ${on ? `style="filter:drop-shadow(0 0 6px rgba(242,163,58,.7))"` : ""}/>`;
  }
  for (let f = 0; f <= hi; f++) svg += `<text x="${X(f)}" y="${h - 4}" text-anchor="middle" font-size="11" fill="rgba(255,255,255,.45)" font-family="JetBrains Mono, monospace">${f}</text>`;
  if (q && (mode === "show" || mode === "ok" || mode === "miss")) {
    const col = mode === "ok" ? "#41d184" : mode === "miss" ? "#ff5c4f" : "#f2a33a";
    for (const f of fretsOf(q)) svg += `<circle cx="${X(f)}" cy="${Y(q.s)}" r="11" fill="${col}"/><text x="${X(f)}" y="${Y(q.s) + 4}" text-anchor="middle" font-size="11" font-weight="800" fill="#11161c" font-family="JetBrains Mono, monospace">${EN[q.pc]}</text>`;
  }
  $("#msBoard", el).innerHTML = svg + "</svg>";
}

async function start() {
  const p = pool(); if (p.length < 2) { toast("Elige más cuerdas o más trastes."); return; }
  window.dispatchEvent(new Event("riff:stop-audio"));
  S.mic = data.ajustes.mastilMic !== false;
  if (S.mic && !(await A.micOn())) { S.mic = false; toast(A.mic.error || "Sin micrófono: usa Ver dónde está para revisarte"); }
  Object.assign(S, { run: true, paused: false, cur: null, n: 0, good: 0, times: [], startedAt: performance.now(), endAt: performance.now() + (data.ajustes.mastilMin || 1) * 60000, lastOnset: -9 });
  if (S.mic) A.startOnsets(t => { S.lastOnset = t; });
  fb.reset(); $("#msStage", el).classList.add("live"); $("#msStart", el).textContent = "Terminar";
  $("#msShow", el).hidden = S.mic; $("#msSkip", el).hidden = false; $("#msSkip", el).textContent = S.mic ? "Saltar" : "No la sabía";
  $("#msShow", el).textContent = "Ver dónde está"; $("#msShow", el).removeAttribute("data-primary");
  next();
  S.iv = setInterval(tick, 40); A.keepAwake(true); practiceStart("mastil");
}
function next() {
  const p = pool().filter(q => !S.cur || !(q.s === S.cur.s && q.pc === S.cur.pc) || pool().length < 2);
  // las notas que más te cuestan salen más seguido
  const st = cfg().notas, wt = q => { const v = st[q.s + ":" + q.pc]; return v ? 1 + Math.min(3, (v[0] / v[1]) / 2) : 1.5; };
  let r = Math.random() * p.reduce((a, q) => a + wt(q), 0), q = p[0];
  for (const x of p) { r -= wt(x); if (r <= 0) { q = x; break; } }
  S.paused = false; S.prev = S.cur; prompt(q); S.tPrompt = performance.now(); S.tc = A.now(); S.goodFrames = 0; S.revealed = false;
  $("#msLab", el).textContent = S.mic ? "Toca esta nota" : "¿Dónde está? Tócala y revisa";
  progLine();
}
function tick() {
  if (!S.run) return;
  if (performance.now() > S.endAt) { finish(); return; }
  progLine();
  if (S.paused) return;
  if (!S.mic) return;
  const q = S.cur, p = A.pitch({ minF: 70, maxF: 1100 });
  let good = false, match = 0;
  if (p.f && p.clarity > .8) {
    const m = 69 + 12 * Math.log2(p.f / 440), targets = fretsOf(q).map(f => STD[q.s] + f);
    const d = Math.min(...targets.map(t => Math.abs(m - t)));
    good = d < .45; match = Math.max(0, 1 - d / 3);
    $("#msHeard", el).textContent = EN[((Math.round(m) % 12) + 12) % 12] + (Math.floor(Math.round(m) / 12) - 1);
  }
  $("#msBar", el).style.width = Math.round(match * 100) + "%";
  $("#msBar", el).parentElement.classList.toggle("good", good);
  const armed = S.lastOnset >= S.tc - .04 || !(S.prev && S.prev.pc === q.pc);
  if (good && armed) S.goodFrames++; else if (!good) S.goodFrames = 0;
  if (S.goodFrames >= 2) answer(true);
}
function answer(ok) {
  if (S.paused) return;
  const q = S.cur, dt = (performance.now() - S.tPrompt) / 1000;
  S.n++; if (ok) { S.good++; S.times.push(dt); }
  const st = cfg().notas, k = q.s + ":" + q.pc, v = st[k] || [0, 0];
  st[k] = [v[0] + (ok ? dt : Math.max(dt, 8)), v[1] + 1];
  fb.show(ok ? "ok" : "miss"); board(q, ok ? "ok" : "miss");
  $("#msSub", el).textContent = ok ? `${ES[q.pc]} en el traste ${fretsOf(q).join(" o ")} · ${dt.toFixed(1)} s` : `Estaba en el traste ${fretsOf(q).join(" o ")}`;
  S.cur = { ...q }; S.paused = true;
  setTimeout(() => { if (S.run) next(); }, ok ? 650 : 1400);
}
function progLine() {
  const left = Math.max(0, (S.endAt - performance.now()) / 1000);
  $("#msProg", el).innerHTML = `<div class="row between"><span><b>${S.good}</b> ${S.good === 1 ? "nota" : "notas"} encontradas${S.n - S.good ? ` · ${S.n - S.good} saltadas` : ""}</span><span class="num">${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}</span></div>`;
}
function finish(partMin) {
  const c = cfg(), k = keyOf(c), full = (data.ajustes.mastilMin || 1), min = partMin || full, npm = S.good / min, prev = c.best[k] || 0;
  if (npm > prev) c.best[k] = Math.round(npm * 10) / 10;
  stop(true);
  const med = S.times.length ? S.times.slice().sort((a, b) => a - b)[S.times.length >> 1] : null;
  $("#msProg", el).innerHTML = `<span><b>${S.good} notas en ${partMin ? `${Math.floor(min)}:${String(Math.round(min * 60 % 60)).padStart(2, "0")} (detenido antes)` : `${min} ${min === 1 ? "minuto" : "minutos"}`}</b> · ${Math.round(npm * 10) / 10} por minuto${med ? ` · ${med.toFixed(1)} s por nota` : ""}${npm > prev && prev ? " · ¡nuevo récord!" : ""}</span>`;
  toast(npm > prev && prev ? `¡Récord: ${Math.round(npm * 10) / 10} notas por minuto!` : `${S.good} notas encontradas`);
}
function stop(keep) {
  clearInterval(S.iv); S.run = false; A.stopOnsets(); A.keepAwake(false);
  practiceEnd("mastil"); save();
  $("#msStage", el).classList.remove("live"); $("#msStart", el).textContent = "Empezar";
  $("#msShow", el).hidden = true; $("#msSkip", el).hidden = true; $("#msShow", el).removeAttribute("data-primary");
  $("#msLab", el).textContent = "Listo"; $("#msHeard", el).textContent = "–"; $("#msBar", el).style.width = "0";
  if (!keep) $("#msProg", el).innerHTML = "";
  stats();
}
function stats() {
  const c = cfg(), k = keyOf(c), box = $("#msStats", el);
  const rows = Object.entries(c.notas).map(([key, v]) => { const [s, pc] = key.split(":").map(Number); return { s, pc, avg: v[0] / v[1], n: v[1] }; }).filter(x => x.n >= 2);
  const slow = rows.filter(x => c.cuerdas.includes(x.s)).sort((a, b) => b.avg - a.avg).slice(0, 5);
  box.innerHTML = `<div class="label">Tu avance</div>
    <div class="stats" style="grid-template-columns:repeat(2,minmax(0,1fr))">
      <div class="stat"><b>${c.best[k] || "–"}</b><span>récord de notas por minuto con estas cuerdas</span></div>
      <div class="stat"><b>${rows.length}</b><span>notas practicadas en total</span></div></div>
    ${slow.length ? `<div class="label" style="margin-top:8px">Las que más te cuestan</div><ul class="msslow">${slow.map(x => `<li><b>${ES[x.pc]}</b> <span class="note">${EN[x.pc]} · ${SNAME[x.s]}</span><span class="num">${x.avg.toFixed(1)} s</span></li>`).join("")}</ul><p class="note">Estas salen más seguido en las siguientes rondas.</p>` : `<p class="note">Empieza con la 6ª y la 5ª cuerda en los trastes 0 a 5. Cuando pases de 15 notas por minuto, agrega trastes o cuerdas.</p>`}`;
}
