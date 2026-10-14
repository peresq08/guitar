import { data, save, logSession, bestFor, toast, esc, $, setRoutineRunning } from "../store.js";
import { currentLevel, levelProgress, nextGoal, buildRoutine, LEVELS, EXTRA_GOALS } from "../plan.js";
import { diagram } from "../chords.js";
import { chime, ctx, keepAwake } from "../audio.js";

let root, mini;
const R = { blocks: [], i: 0, left: 0, run: false, last: 0, done: [], practiced: 0, tick: null, finished: false, ses: null, beat: 0 };
// La rutina se guarda mientras avanza: si pausas, cierras la app o cambias de pestaña, lo practicado ya cuenta
// y al volver hoy mismo sigue donde se quedó.
const RKEY = "riff-rutina", today = () => new Date().toDateString();
function persist() {
  try { localStorage.setItem(RKEY, JSON.stringify({ d: today(), blocks: R.blocks, i: R.i, left: R.left, done: R.done, practiced: R.practiced, finished: R.finished, ses: R.ses })); } catch (e) {}
}
function restore() {
  try {
    const s = JSON.parse(localStorage.getItem(RKEY) || "null");
    if (s && s.d === today() && s.practiced > 0 && s.blocks?.length) {
      Object.assign(R, { blocks: s.blocks, i: Math.min(s.i, s.blocks.length - 1), left: s.left, done: s.done || [], practiced: s.practiced, finished: !!s.finished, ses: s.ses || null, run: false });
      return true;
    }
  } catch (e) {}
  return false;
}
// Una sola sesión por rutina que se va actualizando con los minutos reales
function logProgress() {
  if (R.practiced < 30) { persist(); return; }
  let e = R.ses && data.sesiones.find(x => x.t === R.ses);
  if (!e) { R.ses = new Date().toISOString(); e = { t: R.ses, min: 1, tipo: "rutina" }; data.sesiones.push(e); }
  e.min = Math.max(1, Math.round(R.practiced / 60)); save(); persist();
}
function pause() { R.run = false; clearInterval(R.tick); keepAwake(false); setRoutineRunning(false); logProgress(); }
const seqFor = song => song && (data.secuencias || []).find(q => q.cancion === song.id && q.acordes.length > 1);
const fmt = s => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
const goTo = (view, opts) => window.dispatchEvent(new CustomEvent("riff:go", { detail: { view, opts } }));

function ring(done, total) {
  const r = 34, c = 2 * Math.PI * r, p = total ? done / total : 0;
  return `<svg class="ring" viewBox="0 0 84 84" aria-hidden="true">
    <circle cx="42" cy="42" r="${r}" fill="none" stroke="var(--line)" stroke-width="8"/>
    <circle cx="42" cy="42" r="${r}" fill="none" stroke="var(--accent)" stroke-width="8" stroke-linecap="round"
      stroke-dasharray="${c * p} ${c}" transform="rotate(-90 42 42)"/>
    <text x="42" y="47" text-anchor="middle" font-family="JetBrains Mono,monospace" font-weight="700" font-size="16" fill="var(--ink)">${done}/${total}</text></svg>`;
}

function resetRoutine() {
  clearInterval(R.tick); keepAwake(false); setRoutineRunning(false);
  Object.assign(R, { blocks: buildRoutine(), i: 0, run: false, done: [], practiced: 0, finished: false, ses: null });
  try { localStorage.removeItem(RKEY); } catch (e) {}
  R.left = R.blocks[0].min * 60;
}

export function mount(el) {
  root = el;
  mini = document.createElement("button");
  mini.className = "btn dark minibar"; mini.hidden = true;
  mini.addEventListener("click", () => goTo("hoy"));
  document.body.appendChild(mini);
  if (!restore()) resetRoutine();
  document.addEventListener("visibilitychange", () => { if (document.hidden && R.practiced > 0) logProgress(); });
  window.addEventListener("pagehide", () => { if (R.practiced > 0) logProgress(); });
  render();
}

function render() {
  const l = currentLevel(), [d, t] = levelProgress(l), lg = nextGoal(l);
  // Si ya cumpliste las metas del nivel, la siguiente es la meta extra más cercana
  const g = lg || EXTRA_GOALS.filter(x => !x.auto()).map(x => ({ x, r: (([v, m]) => v / m)(x.prog()) })).sort((a, b) => b.r - a.r)[0]?.x;
  const gp = g && g.prog ? g.prog() : null;
  const b = R.blocks[R.i];
  root.innerHTML = `
  <div class="cols" style="--cols:minmax(0,1.55fr) minmax(0,1fr)">
  <div class="col">
  <div class="panel screen">
    <div class="row between">
      <div><div class="label">Rutina de hoy</div><h2>${R.finished ? "Rutina terminada" : esc(b.n)}</h2>${!R.finished && b.weak ? `<span class="chip acc" title="Este bloque sale de lo que más te ha costado en tus prácticas">Según tus datos</span>` : ""}</div>
      <div class="big" id="hBig">${fmt(Math.ceil(R.left))}</div>
    </div>
    ${R.finished ? "" : `
    <div class="bar"><div id="hBar" style="width:${100 * (1 - R.left / (b.min * 60))}%"></div></div>
    <div class="player">
      ${b.song ? `<div class="song"><div class="label">Canción del día</div><h3>${esc(b.song.titulo)}</h3><span class="muted">${esc(b.song.artista)}${b.song.anio ? ` · ${b.song.anio}` : ""}${b.song.bpmMeta ? ` · original ≈ ${b.song.bpmMeta} BPM` : ""}</span><p>${esc(b.song.tip || b.song.notas || "Tócala junto a la grabación. Si una parte cuesta, aíslala y repítela lento.")}</p>
        <div class="row"><a class="btn small" href="https://www.songsterr.com/?pattern=${encodeURIComponent(b.song.titulo + " " + b.song.artista)}" target="_blank" rel="noopener">Ver tablatura</a>${seqFor(b.song) ? `<button class="btn small primary" id="hSeq">Practicar sus acordes</button>` : ""}${b.song.rasgueo ? `<button class="btn small" id="hStrum">Su rasgueo</button>` : ""}</div></div>` : `<p>${esc(b.tip)}</p>`}
      ${b.chords ? `<div class="chords">${b.chords.map(c => diagram(c)).join("")}</div>` : ""}
      ${b.tool ? `<button class="btn small" id="hTool" style="align-self:flex-start">${{ cambios: "Abrir reto de cambios", metro: "Abrir metrónomo", jam: "Abrir Jam", rasgueo: "Abrir entrenador de rasgueo", tabs: "Abrir la tab en ese compás" }[b.tool]}</button>` : ""}
    </div>`}
    <div class="row">
      ${R.finished ? "" : `<button class="btn primary" id="hStart" data-primary>${R.run ? "Pausa" : (R.practiced > 0 ? "Continuar" : "Empezar")}</button><button class="btn" id="hSkip">Siguiente</button>`}
      <button class="btn" id="hReset">Reiniciar</button>
    </div>
    ${R.finished ? `<div class="panel hl"><h3>¡Bien hecho!</h3><p>Practicaste ${Math.max(1, Math.round(R.practiced / 60))} minutos y ya quedaron guardados en tu racha.</p>
      <div class="row"><button class="btn primary" id="hSave">Nueva rutina</button></div></div>` : ""}
    ${!R.finished && !R.run && R.practiced >= 30 ? `<p class="note">Llevas ${fmt(R.practiced)} de práctica guardados. Si cierras la app, aquí sigue tu rutina hoy.</p>` : ""}
    <ol class="steps">${R.blocks.map((x, k) => `<li class="${R.done[k] ? "done" : ""} ${k === R.i && !R.finished ? "cur" : ""}"><span class="dot"></span><span>${esc(x.n)}</span><span class="t">${x.min} min</span></li>`).join("")}</ol>
    <div class="row between">
      <span class="note">Duración</span>
      <div class="seg" role="radiogroup" aria-label="Duración de la rutina" style="flex:0 1 220px">
        ${[15, 30, 45].map(m => `<button role="radio" aria-checked="${data.ajustes.rutinaMin === m}" data-min="${m}">${m} min</button>`).join("")}
      </div>
    </div>
  </div>
  </div>
  <div class="col">
  <div class="panel m-first">
    <div class="hero">
      ${ring(d, t)}
      <div class="stack" style="gap:4px;min-width:0">
        <div class="label">Nivel ${l.id} de ${LEVELS.length}</div>
        <h2>${l.name}</h2>
        <p class="muted">${l.lema}</p>
      </div>
    </div>
    ${g ? `<div class="stack" style="gap:6px">
      <div class="label">Siguiente meta</div>
      <p><b>${esc(g.t)}</b></p>
      ${gp ? `<div class="row between note"><span>Tu mejor marca</span><span class="num">${gp[0]} / ${gp[1]}</span></div><div class="bar"><div style="width:${Math.min(100, gp[0] / gp[1] * 100)}%"></div></div>` : ""}
    </div>` : `<p><b>Completaste todos los niveles.</b> Sigue con tu repertorio y súbele al tempo.</p>`}
    <button class="btn small" id="hViewPlan" style="align-self:flex-start">Ver mi camino</button>
  </div>

  <div class="panel">
    <div class="label">¿Practicaste por tu cuenta?</div>
    <div class="row">
      <div class="stepper"><button class="icon-btn" id="qMinus" aria-label="Menos minutos">−</button><input type="number" id="qMin" value="20" min="1" max="300" aria-label="Minutos"><button class="icon-btn" id="qPlus" aria-label="Más minutos">+</button></div>
      <button class="btn" id="qLog">Registrar minutos</button>
    </div>
  </div>
  </div>
  </div>`;
  bind();
  updateMini();
}

function bind() {
  $("#hViewPlan", root).onclick = () => goTo("progreso", { focus: "camino" });
  const b = R.blocks[R.i];
  $("#hStrum", root)?.addEventListener("click", () => goTo("practicar", { tab: "rasgueo", pattern: b.song.rasgueo }));
  $("#hSeq", root)?.addEventListener("click", () => goTo("practicar", { tab: "secuencia", seq: seqFor(b.song).id }));
  $("#hTool", root)?.addEventListener("click", () => goTo("practicar", { tab: b.tool, pair: b.pair, mode: b.mode, pattern: b.pattern, tabId: b.tabId, tabPista: b.tabPista, tabSel: b.tabSel, tabMode: b.tabMode }));
  $("#hStart", root)?.addEventListener("click", () => {
    ctx();
    if (R.run) pause();
    else { R.run = true; R.last = performance.now(); R.beat = R.last; R.tick = setInterval(loop, 250); keepAwake(true); setRoutineRunning(true); }
    render();
  });
  $("#hSkip", root)?.addEventListener("click", () => { R.done[R.i] = true; advance(); persist(); render(); });
  $("#hReset", root).onclick = () => {
    if (R.practiced >= 30) { logProgress(); toast(`Guardé tus ${Math.max(1, Math.round(R.practiced / 60))} minutos. Rutina nueva lista.`); }
    resetRoutine(); render();
  };
  $("#hSave", root)?.addEventListener("click", () => { resetRoutine(); render(); });
  root.querySelectorAll("[data-min]").forEach(btn => btn.onclick = () => {
    if (R.run || R.practiced > 0) { toast("Reinicia la rutina para cambiar la duración"); return; }
    data.ajustes.rutinaMin = +btn.dataset.min; save(); resetRoutine(); render();
  });
  const q = $("#qMin", root);
  $("#qMinus", root).onclick = () => q.value = Math.max(1, (+q.value || 0) - 5);
  $("#qPlus", root).onclick = () => q.value = (+q.value || 0) + 5;
  $("#qLog", root).onclick = () => { const m = +q.value; if (m > 0) { logSession(m, "libre"); toast(m + " minutos registrados"); } };
}

function advance() {
  if (R.i < R.blocks.length - 1) { R.i++; R.left = R.blocks[R.i].min * 60; }
  else { R.run = false; R.left = 0; R.finished = true; clearInterval(R.tick); keepAwake(false); setRoutineRunning(false); logProgress(); toast("Rutina terminada. ¡Sigue la racha!"); }
}
function loop() {
  const t = performance.now(), dt = (t - R.last) / 1000; R.last = t; R.left -= dt; R.practiced += dt;
  if (R.left <= 0) { chime(); R.done[R.i] = true; advance(); persist(); render(); return; }
  if (t - R.beat > 15000) { R.beat = t; logProgress(); }
  if (!root.hidden) {
    const big = root.querySelector("#hBig"), bar = root.querySelector("#hBar");
    if (big) big.textContent = fmt(Math.ceil(R.left));
    if (bar) bar.style.width = (100 * (1 - R.left / (R.blocks[R.i].min * 60))) + "%";
  }
  updateMini();
}
function updateMini() {
  const show = R.run && root.closest(".view").hidden;
  mini.hidden = !show;
  if (show) mini.innerHTML = `<span>Rutina · ${esc(R.blocks[R.i].n)}</span><span class="num">${fmt(Math.ceil(R.left))}</span>`;
}

export function onShow() { render(); }
export function onHide() { setTimeout(updateMini, 0); }
export function refresh() { if (!root.hidden && !R.run) render(); }
