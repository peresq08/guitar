import { data, save, streak, bestStreak, dayKey, minutesOn, exportJSON, importJSON, toast, esc, applyLane, $ } from "../store.js";
import { PATTERNS } from "./rasgueo.js";
import { listRecordings, getRecording, deleteRecording, renameRecording, fmtDur, extOf } from "../recorder.js";
const PATS = Object.fromEntries(PATTERNS.map(p => [p.id, p.nombre]));
import { LEVELS, goalDone, toggleGoal, currentLevel, levelProgress, CATS, DIFF, difficulty, EXTRA_GOALS, EXTRA_AREAS, extraProgress } from "../plan.js";

let root;
const ESTADOS = { pendiente: "Por aprender", practicando: "Practicando", dominada: "Dominada" };

export function mount(el) { root = el; applyTheme(); render(); window.addEventListener("riff:recordings", () => { if (!root.hidden) paintRecs(); }); }
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

  <div class="panel" id="metasExtra">
    <div class="row between"><div class="label">Más metas</div><span class="chip acc">${extraProgress()[0]} de ${extraProgress()[1]}</span></div>
    <p class="note">No bloquean tu nivel: se marcan solas con lo que practicas en cada herramienta.</p>
    ${Object.entries(EXTRA_AREAS).map(([k, name]) => {
      const gs = EXTRA_GOALS.filter(g => g.area === k), d = gs.filter(g => g.auto()).length;
      const next = gs.find(g => !g.auto());
      return `<details class="level-card xgoals ${d === gs.length ? "done" : ""}">
        <summary><span>${name}${next ? `<small class="note xnext">Siguiente: ${esc(next.t)}</small>` : ""}</span><span class="chip ${d === gs.length ? "good" : ""}">${d}/${gs.length}</span></summary>
        <div>${gs.map(g => {
          const ok = g.auto(), [v, m] = g.prog();
          return `<div class="goal xgoal">
            <span class="check auto ${ok ? "on" : ""}" aria-hidden="true">${ok ? `<svg viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7"/></svg>` : ""}</span>
            <span>${esc(g.t)}${ok ? "" : `<span class="xbar" aria-hidden="true"><i style="width:${Math.min(100, v / m * 100)}%"></i></span>`}</span>
            <span class="num note">${Math.min(v, m)}/${m}</span></div>`;
        }).join("")}</div></details>`;
    }).join("")}
  </div>
  </div>
  <div class="col">

  <div class="panel" id="repertorio">
    <div class="label">Mi repertorio</div><div class="seg wrap" role="radiogroup" aria-label="Filtrar canciones" id="sFilt">
      ${["todas", "practicando", "pendiente", "dominada"].map(f => `<button role="radio" data-f="${f}" aria-checked="${filt === f}">${f === "todas" ? "Todas" : ESTADOS[f]}</button>`).join("")}
    </div>
    <div class="repfilters">
      <select id="sCat" aria-label="Categoría"><option value="todas">Todas las categorías</option>${Object.entries(CATS).filter(([k]) => (data.canciones || []).some(s => (s.cat || "otras") === k)).map(([k, v]) => `<option value="${k}" ${catF === k ? "selected" : ""}>${v} (${(data.canciones || []).filter(s => (s.cat || "otras") === k).length})</option>`).join("")}</select>
      <div class="seg" role="radiogroup" aria-label="Dificultad" id="sDif">${["todas", "facil", "intermedia", "avanzada"].map(d => `<button role="radio" data-d="${d}" aria-checked="${difF === d}">${d === "todas" ? "Toda dificultad" : DIFF[d]}</button>`).join("")}</div>
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
          <label for="nsC">Categoría<select id="nsC">${Object.entries(CATS).map(([k, v]) => `<option value="${k}" ${k === "otras" ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        </div>
        <button class="btn primary" id="nsAdd" style="align-self:flex-start">Agregar</button>
      </div>
    </details>
  </div>

  <div class="panel" id="recPanel"><div class="label">Tus grabaciones</div><p class="note">Cargando…</p></div>

  <div class="panel">
    <div class="label">Récords de cambios</div>
    ${recordsHTML()}
  </div>

  <div class="panel">
    <div class="label">Ajustes y respaldo</div>
    <div class="stack" style="gap:6px">
      <span><b>Calibración del micrófono</b></span>
      <span class="note">${Object.keys(data.calibracion || {}).length ? `Acordes calibrados: ${Object.keys(data.calibracion).join(", ")}.` : "Ningún acorde calibrado."} ${data.ajustes.latenciaMic != null ? `Retraso del micrófono: ${Math.round(data.ajustes.latenciaMic * 1000)} ms.` : "Ritmo sin calibrar."} Se guarda en este dispositivo y viaja en el respaldo.</span>
      ${Object.keys(data.calibracion || {}).length || data.ajustes.latenciaMic != null ? `<button class="btn small ghost" id="calReset" style="align-self:flex-start">Borrar toda la calibración</button>` : ""}
    </div>
    <label class="field" for="laneSize">Tamaño del carril y de la tab<select id="laneSize">
      <option value="normal">Normal</option><option value="grande">Grande</option><option value="enorme">Enorme</option></select></label>
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
  bind(); paintRecs();
}

let filt = "todas", catF = "todas", difF = "todas";
function songsHTML() {
  const list = (data.canciones || []).filter(s => (filt === "todas" || s.estado === filt) && (catF === "todas" || (s.cat || "otras") === catF) && (difF === "todas" || difficulty(s.nivel) === difF));
  if (!list.length) return `<div class="empty">No hay canciones con estos filtros.</div>`;
  const order = { practicando: 0, pendiente: 1, dominada: 2 };
  const sorted = list.slice().sort((a, b) => (a.nivel || 1) - (b.nivel || 1) || order[a.estado] - order[b.estado] || a.titulo.localeCompare(b.titulo));
  // agrupa por categoría, en el orden de CATS
  return Object.keys(CATS).map(k => {
    const g = sorted.filter(s => (s.cat || "otras") === k); if (!g.length) return "";
    return `<details class="repcat" ${catF !== "todas" || filt !== "todas" || difF !== "todas" || k === openCat ? "open" : ""} data-cat="${k}"><summary><span>${CATS[k]}</span><span class="note">${g.length}</span></summary>${g.map(songRow).join("")}</details>`;
  }).join("");
}
let openCat = "rock80";
function songRow(s) {
  const d = difficulty(s.nivel);
  return `
    <div class="songrow">
      <div style="min-width:0"><div class="t">${esc(s.titulo)} <span class="dchip ${d}">${DIFF[d]}</span></div><div class="a">${esc(s.artista)}${s.anio ? ` · ${s.anio}` : ""} · nivel ${s.nivel || 1}${s.bpmMeta ? ` · ≈ ${s.bpmMeta} BPM` : ""}</div>${s.tip ? `<div class="a tipline">${esc(s.tip)}</div>` : ""}
        <span class="row" style="gap:12px"><a class="note" href="https://www.songsterr.com/?pattern=${encodeURIComponent(s.titulo + " " + s.artista)}" target="_blank" rel="noopener">Tablatura</a>${(data.secuencias || []).find(q => q.cancion === s.id && q.acordes.length > 1) ? `<a class="note" href="#" data-seq="${(data.secuencias || []).find(q => q.cancion === s.id).id}">Practicar acordes</a>` : ""}${s.rasgueo && PATS[s.rasgueo] ? `<a class="note" href="#" data-strum="${s.rasgueo}">Rasgueo: ${esc(PATS[s.rasgueo])}</a>` : ""}</span></div>
      <div class="row" style="flex-wrap:nowrap">
        <select data-song="${s.id}" aria-label="Estado de ${esc(s.titulo)}" style="min-height:38px;padding:6px">${Object.entries(ESTADOS).map(([k, v]) => `<option value="${k}" ${s.estado === k ? "selected" : ""}>${v}</option>`).join("")}</select>
        <button class="icon-btn" data-del="${s.id}" aria-label="Quitar ${esc(s.titulo)}" style="width:38px;height:38px;font-size:1rem">✕</button>
      </div>
    </div>`;
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
  root.querySelectorAll("[data-d]").forEach(b => b.onclick = () => { difF = b.dataset.d; render(); setTimeout(() => $("#repertorio", root).scrollIntoView({ block: "start" }), 0); });
  $("#sCat", root).onchange = e => { catF = e.target.value; render(); setTimeout(() => $("#repertorio", root).scrollIntoView({ block: "start" }), 0); };
  root.querySelectorAll(".repcat").forEach(d => d.addEventListener("toggle", () => { if (d.open) openCat = d.dataset.cat; }));
  root.querySelectorAll("[data-strum]").forEach(a => a.onclick = e => { e.preventDefault(); window.dispatchEvent(new CustomEvent("riff:go", { detail: { view: "practicar", opts: { tab: "rasgueo", pattern: a.dataset.strum } } })); });
  root.querySelectorAll("[data-seq]").forEach(a => a.onclick = e => { e.preventDefault(); window.dispatchEvent(new CustomEvent("riff:go", { detail: { view: "practicar", opts: { tab: "secuencia", seq: a.dataset.seq } } })); });
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
    data.canciones.push({ id: "u" + Date.now(), titulo: t, artista: $("#nsA", root).value.trim(), bpmMeta: +$("#nsB", root).value || null, nivel: +$("#nsN", root).value, cat: $("#nsC", root).value, estado: "practicando", notas: "" });
    save(); toast("Canción agregada a Practicando");
  };
  let calArmed = false;
  $("#calReset", root)?.addEventListener("click", e => {
    if (!calArmed) { calArmed = true; e.target.textContent = "¿Seguro? Toca otra vez"; setTimeout(() => { calArmed = false; if (e.target.isConnected) e.target.textContent = "Borrar toda la calibración"; }, 3000); return; }
    data.calibracion = {}; delete data.ajustes.latenciaMic; save(); toast("Calibración borrada");
  });
  const ls = $("#laneSize", root); ls.value = data.ajustes.carril || "normal";
  ls.onchange = () => { data.ajustes.carril = ls.value; applyLane(); save(); };
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


/* ---------- Grabaciones ---------- */
const urls = new Map();
const fmtDate = t => new Date(t).toLocaleString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
async function paintRecs() {
  const box = root && root.querySelector("#recPanel"); if (!box) return;
  let recs = [];
  try { recs = await listRecordings(); if (recs.length > (data.grabaciones || 0)) { data.grabaciones = recs.length; save(); } } catch (e) { box.innerHTML = `<div class="label">Tus grabaciones</div><p class="note">Este navegador no permite guardar grabaciones.</p>`; return; }
  const total = recs.reduce((a, r) => a + (r.blob?.size || 0), 0);
  box.innerHTML = `<div class="row between"><div class="label">Tus grabaciones</div>${recs.length ? `<span class="note">${recs.length} · ${total > 1048576 ? (total / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(total / 1024)) + " KB"}</span>` : ""}</div>
    ${recs.length ? `<ul class="reclist">${recs.map(r => {
      const first = recs.filter(x => x.label === r.label && x.t < r.t).pop();
      return `<li data-id="${r.id}">
        <div class="rec-top"><button class="rec-play" data-play="${r.id}" aria-label="Escuchar ${esc(r.label)}">▶</button>
          <div class="rec-info"><b class="rec-name" title="Toca para cambiar el nombre">${esc(r.label)}</b><small>${fmtDate(r.t)} · ${fmtDur(r.dur)}</small></div>
          <div class="rec-act">${first ? `<button class="btn small ghost" data-cmp="${r.id}" data-first="${first.id}" title="Escucha la primera vez que grabaste esta práctica y la de ahora">Comparar con la primera</button>` : ""}<button class="icon-btn" data-dl="${r.id}" aria-label="Descargar">⬇</button><button class="icon-btn" data-rdel="${r.id}" aria-label="Borrar">✕</button></div></div>
        <div class="rec-players"></div></li>`;
    }).join("")}</ul>` : `<p class="note">Graba tu práctica con el botón <b>Grabar</b> de Practicar (o la tecla R). Escucharte es la forma más rápida de notar cuerdas que zumban, cambios que cortan el sonido y tiempos que se adelantan.</p>`}`;
  // Las grabaciones WebM no traen la duración: se calcula una vez para que la barra de avance funcione
  const fixDur = root => root.querySelectorAll("audio").forEach(a => a.addEventListener("loadedmetadata", () => {
    if (a.duration !== Infinity) return;
    const back = () => { a.removeEventListener("timeupdate", back); a.currentTime = 0; };
    a.addEventListener("timeupdate", back); a.currentTime = 1e101;
  }, { once: true }));
  const urlOf = async id => { if (!urls.has(id)) { const r = await getRecording(id); urls.set(id, URL.createObjectURL(r.blob)); } return urls.get(id); };
  const player = (src, label) => `<div class="rec-player"><span class="note">${esc(label)}</span><audio controls src="${src}"></audio></div>`;
  box.querySelectorAll("[data-play]").forEach(b => b.onclick = async () => {
    const li = b.closest("li"), pl = li.querySelector(".rec-players");
    if (pl.innerHTML) { pl.innerHTML = ""; b.textContent = "▶"; return; }
    pl.innerHTML = player(await urlOf(b.dataset.play), ""); b.textContent = "■"; fixDur(pl); setTimeout(() => pl.querySelector("audio").play().catch(() => {}), 150);
  });
  box.querySelectorAll("[data-cmp]").forEach(b => b.onclick = async () => {
    const li = b.closest("li"), pl = li.querySelector(".rec-players"), f = recs.find(x => x.id === b.dataset.first), r = recs.find(x => x.id === b.dataset.cmp);
    pl.innerHTML = `<div class="rec-cmp">${player(await urlOf(f.id), "Antes · " + fmtDate(f.t))}${player(await urlOf(r.id), "Ahora · " + fmtDate(r.t))}</div>`; fixDur(pl);
  });
  box.querySelectorAll("[data-dl]").forEach(b => b.onclick = async () => {
    const r = recs.find(x => x.id === b.dataset.dl), a = document.createElement("a");
    a.href = await urlOf(r.id); a.download = `Riff ${r.label.replace(/[\\/:*?"<>|]/g, "-")} ${new Date(r.t).toISOString().slice(0, 16).replace("T", " ").replace(":", "h")}.${extOf(r.mime)}`; a.click();
  });
  box.querySelectorAll("[data-rdel]").forEach(b => { let armed = false; b.onclick = async () => {
    if (!armed) { armed = true; b.textContent = "¿Sí?"; b.style.width = "auto"; b.style.padding = "0 10px"; setTimeout(() => { armed = false; b.textContent = "✕"; b.style.width = ""; b.style.padding = ""; }, 3000); return; }
    await deleteRecording(b.dataset.rdel); paintRecs();
  }; });
  box.querySelectorAll(".rec-name").forEach(n => n.onclick = () => {
    const li = n.closest("li"), inp = document.createElement("input"); inp.type = "text"; inp.value = n.textContent; inp.className = "rec-rename"; inp.maxLength = 80;
    n.replaceWith(inp); inp.focus(); inp.select();
    const done = async ok => { if (ok && inp.value.trim()) await renameRecording(li.dataset.id, inp.value.trim()); paintRecs(); };
    inp.onkeydown = e => { if (e.key === "Enter") done(true); if (e.key === "Escape") done(false); };
    inp.onblur = () => done(true);
  });
}
