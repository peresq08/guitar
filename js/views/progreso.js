import { data, save, streak, bestStreak, dayKey, minutesOn, exportJSON, importJSON, toast, esc, $ } from "../store.js";
import { LEVELS, goalDone, toggleGoal, currentLevel, levelProgress } from "../plan.js";

let root;
const ESTADOS = { pendiente: "Por aprender", practicando: "Practicando", dominada: "Dominada" };

export function mount(el) { root = el; applyTheme(); render(); }
export function refresh() { if (!root.hidden) render(); }
export function onShow(opts = {}) {
  render();
  if (opts.focus) setTimeout(() => $("#" + opts.focus, root)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
}

function render() {
  const total = data.sesiones.reduce((a, s) => a + (s.min || 0), 0);
  const cur = currentLevel();
  root.innerHTML = `
  <div class="stats">
    <div class="stat"><b>${total >= 120 ? (total / 60).toFixed(1) : total}</b><span>${total >= 120 ? "horas" : "minutos"} en total</span></div>
    <div class="stat"><b>${streak()}</b><span>días de racha</span></div>
    <div class="stat"><b>${bestStreak()}</b><span>mejor racha</span></div>
  </div>

  <div class="cols">
  <div class="col">
  <div class="panel">
    <div class="row between"><div class="label">Minutos por día · últimas 2 semanas</div><span class="chip">${weekTotal()} min esta semana</span></div>
    <div class="chart">${dailyChart()}</div>
  </div>

  <div class="panel" id="camino">
    <div class="label">Tu camino</div>
    ${LEVELS.map(l => {
      const [d, t] = levelProgress(l), done = d === t, isCur = l.id === cur.id;
      return `<details class="level-card ${isCur ? "cur" : ""} ${done ? "done" : ""}" ${isCur ? "open" : ""}>
        <summary><span>Nivel ${l.id} · ${l.name}</span><span class="chip ${done ? "good" : isCur ? "acc" : ""}">${done ? "Completado" : d + "/" + t}</span></summary>
        <p class="note">${l.lema}</p>
        <div>${l.goals.map(g => {
          const ok = goalDone(g), auto = !!g.auto, p = g.prog ? g.prog() : null;
          return `<div class="goal">
            <button class="check ${ok ? "on" : ""} ${auto ? "auto" : ""}" ${auto ? `aria-disabled="true" title="Se marca sola con tus datos"` : `data-goal="${g.id}"`} aria-pressed="${ok}" aria-label="${esc(g.t)}">${ok ? `<svg viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7"/></svg>` : ""}</button>
            <span>${esc(g.t)}${auto && !ok ? ` <span class="note">(automática)</span>` : ""}</span>
            <span class="num note">${p ? Math.min(p[0], p[1]) + "/" + p[1] : ""}</span></div>`;
        }).join("")}</div></details>`;
    }).join("")}
  </div>
  </div>
  <div class="col">

  <div class="panel" id="repertorio">
    <div class="label">Mi repertorio</div><div class="seg wrap" role="radiogroup" aria-label="Filtrar canciones" id="sFilt">
      ${["todas", "practicando", "pendiente", "dominada"].map(f => `<button role="radio" data-f="${f}" aria-checked="${filt === f}">${f === "todas" ? "Todas" : ESTADOS[f]}</button>`).join("")}
    </div>
    <div>${songsHTML()}</div>
    <details>
      <summary>Agregar canción</summary>
      <div class="stack" style="margin-top:10px">
        <div class="grid2">
          <label for="nsT">Título<input type="text" id="nsT" maxlength="80"></label>
          <label for="nsA">Artista<input type="text" id="nsA" maxlength="80"></label>
          <label for="nsB">Tempo meta (BPM)<input type="number" id="nsB" min="30" max="260"></label>
          <label for="nsN">Nivel<select id="nsN">${LEVELS.map(l => `<option value="${l.id}">${l.id} · ${l.name}</option>`).join("")}</select></label>
        </div>
        <button class="btn primary" id="nsAdd" style="align-self:flex-start">Agregar</button>
      </div>
    </details>
  </div>

  <div class="panel">
    <div class="label">Récords de cambios</div>
    ${recordsHTML()}
  </div>

  <div class="panel">
    <div class="label">Ajustes y respaldo</div>
    <label class="field" for="theme">Apariencia<select id="theme">
      <option value="">Igual que el sistema</option><option value="light">Clara</option><option value="dark">Oscura</option></select></label>
    <p class="note">Tus datos viven en este dispositivo. Descarga un respaldo para pasarlos a otro teléfono o computadora, o para no perderlos si borras el navegador.</p>
    <div class="row">
      <button class="btn" id="bExp">Descargar respaldo</button>
      <label class="btn" for="bImp" style="cursor:pointer">Cargar respaldo</label>
      <input type="file" id="bImp" accept="application/json,.json" hidden>
    </div>
  </div>
  </div>
  </div>
  <p class="note" style="text-align:center">Riff · hecho a tu medida</p>`;
  bind();
}

let filt = "todas";
function songsHTML() {
  const list = (data.canciones || []).filter(s => filt === "todas" || s.estado === filt);
  if (!list.length) return `<div class="empty">No hay canciones en esta lista.</div>`;
  const order = { practicando: 0, pendiente: 1, dominada: 2 };
  return list.slice().sort((a, b) => order[a.estado] - order[b.estado] || (a.nivel || 1) - (b.nivel || 1)).map(s => `
    <div class="songrow">
      <div style="min-width:0"><div class="t">${esc(s.titulo)}</div><div class="a">${esc(s.artista)} · nivel ${s.nivel || 1}${s.bpmMeta ? ` · ${s.bpmMeta} BPM` : ""}</div>
        <a class="note" href="https://www.songsterr.com/?pattern=${encodeURIComponent(s.titulo + " " + s.artista)}" target="_blank" rel="noopener">Tablatura</a></div>
      <div class="row" style="flex-wrap:nowrap">
        <select data-song="${s.id}" aria-label="Estado de ${esc(s.titulo)}" style="min-height:38px;padding:6px">${Object.entries(ESTADOS).map(([k, v]) => `<option value="${k}" ${s.estado === k ? "selected" : ""}>${v}</option>`).join("")}</select>
        <button class="icon-btn" data-del="${s.id}" aria-label="Quitar ${esc(s.titulo)}" style="width:38px;height:38px;font-size:1rem">✕</button>
      </div>
    </div>`).join("");
}
function recordsHTML() {
  const best = {};
  data.intentos.forEach(x => { const b = best[x.par] || (best[x.par] = { max: 0, c: 0, last: 0, t: x.t }); b.max = Math.max(b.max, x.n); b.c++; b.last = x.n; b.t = x.t; });
  const ks = Object.keys(best).sort((a, b) => best[b].t.localeCompare(best[a].t));
  if (!ks.length) return `<div class="empty">Tus récords aparecerán después del primer reto de cambios.</div>`;
  return `<div class="tablewrap"><table><thead><tr><th>Par</th><th class="r">Récord</th><th class="r">Último</th><th class="r">Intentos</th></tr></thead>
    <tbody>${ks.map(k => `<tr><td>${esc(k)}</td><td class="r">${best[k].max}</td><td class="r">${best[k].last}</td><td class="r">${best[k].c}</td></tr>`).join("")}</tbody></table></div>`;
}
function weekTotal() { let t = 0; for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); t += minutesOn(dayKey(d)); } return Math.round(t); }
function dailyChart() {
  const days = []; for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push({ d, m: minutesOn(dayKey(d)) }); }
  const W = 340, H = 150, L = 28, R = 6, T = 12, B = 22, max = Math.max(30, ...days.map(x => x.m)), yM = Math.ceil(max / 15) * 15;
  const bw = (W - L - R) / days.length, ys = v => T + (H - T - B) * (1 - v / yM);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Minutos practicados por día">`;
  for (let v = 0; v <= yM; v += yM / 3) s += `<line x1="${L}" x2="${W - R}" y1="${ys(v)}" y2="${ys(v)}" stroke="var(--line)"/><text x="${L - 5}" y="${ys(v) + 3}" font-size="9" text-anchor="end" fill="var(--muted)" font-family="JetBrains Mono,monospace">${Math.round(v)}</text>`;
  const goal = data.ajustes.rutinaMin || 30;
  if (goal <= yM) s += `<line x1="${L}" x2="${W - R}" y1="${ys(goal)}" y2="${ys(goal)}" stroke="var(--accent)" stroke-dasharray="4 4"/><text x="${W - R}" y="${ys(goal) - 4}" font-size="9" text-anchor="end" fill="var(--accent)" font-family="Barlow,sans-serif">meta ${goal} min</text>`;
  days.forEach((x, i) => {
    const h = (H - T - B) * x.m / yM, today = i === days.length - 1;
    if (x.m > 0) s += `<rect x="${L + i * bw + 3}" y="${ys(x.m)}" width="${bw - 6}" height="${h}" rx="3" fill="${x.m >= goal ? "var(--accent)" : "var(--muted)"}" opacity="${x.m >= goal ? 1 : .6}"/>`;
    if (i % 2 === 1 || today) s += `<text x="${L + i * bw + bw / 2}" y="${H - 7}" font-size="9" text-anchor="middle" fill="${today ? "var(--ink)" : "var(--muted)"}" font-family="JetBrains Mono,monospace">${today ? "hoy" : x.d.getDate()}</text>`;
  });
  return s + `</svg>`;
}

function bind() {
  root.querySelectorAll("[data-goal]").forEach(b => b.onclick = () => toggleGoal(b.dataset.goal));
  root.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { filt = b.dataset.f; render(); setTimeout(() => $("#repertorio", root).scrollIntoView({ block: "start" }), 0); });
  root.querySelectorAll("[data-song]").forEach(s => s.onchange = () => {
    const song = data.canciones.find(x => x.id === s.dataset.song); song.estado = s.value; save();
    if (s.value === "dominada") toast(`¡${song.titulo} dominada!`);
  });
  root.querySelectorAll("[data-del]").forEach(b => {
    let armed = false;
    b.onclick = () => {
      if (!armed) { armed = true; b.textContent = "¿Sí?"; b.style.width = "auto"; b.style.padding = "0 10px"; setTimeout(() => { armed = false; b.textContent = "✕"; b.style.width = "38px"; b.style.padding = ""; }, 3000); return; }
      data.canciones = data.canciones.filter(x => x.id !== b.dataset.del); save();
    };
  });
  $("#nsAdd", root).onclick = () => {
    const t = $("#nsT", root).value.trim(); if (!t) { toast("Escribe el título de la canción"); return; }
    data.canciones.push({ id: "u" + Date.now(), titulo: t, artista: $("#nsA", root).value.trim(), bpmMeta: +$("#nsB", root).value || null, nivel: +$("#nsN", root).value, estado: "practicando", notas: "" });
    save(); toast("Canción agregada a Practicando");
  };
  const th = $("#theme", root); th.value = getTheme();
  th.onchange = () => { try { localStorage.setItem("riff-theme", th.value); } catch (e) {} applyTheme(); };
  $("#bExp", root).onclick = () => {
    const blob = new Blob([exportJSON()], { type: "application/json" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `riff-respaldo-${dayKey(new Date())}.json`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast("Respaldo descargado");
  };
  $("#bImp", root).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { importJSON(await f.text()); toast("Respaldo cargado"); } catch (err) { toast(err.message || "No se pudo leer el archivo"); }
  };
}
function getTheme() { try { return localStorage.getItem("riff-theme") || ""; } catch (e) { return ""; } }
function applyTheme() { const t = getTheme(); if (t) document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme"); }
