import { data, onChange, streak, practiceDays, dayKey, applyLane, $, $$ } from "./store.js";
import { currentLevel, ensureSongs } from "./plan.js";
import * as A from "./audio.js";
import { startRecording, stopRecording, isRecording, onRecState, fmtDur } from "./recorder.js";
import { recLabel } from "./views/practicar.js";
import * as hoy from "./views/hoy.js";
import * as practicar from "./views/practicar.js";
import * as afinador from "./views/afinador.js";
import * as acordes from "./views/acordes.js";
import * as progreso from "./views/progreso.js";

const VIEWS = { hoy, practicar, afinador, acordes, progreso };
let current = "hoy";

function header() {
  const l = currentLevel();
  $("#topLevel").textContent = "Nivel " + l.id + " · " + l.name;
  const days = practiceDays(), n = streak();
  let w = ""; for (let i = 6; i >= 0; i--) { const x = new Date(); x.setDate(x.getDate() - i); w += `<i class="${days.has(dayKey(x)) ? "on" : ""}"></i>`; }
  $("#topStreak").innerHTML = `<span>${n} ${n === 1 ? "día" : "días"}</span><span class="week" aria-label="Práctica de los últimos 7 días">${w}</span>`;
}

export function go(view, opts = {}) {
  if (!VIEWS[view]) return;
  if (view !== current) VIEWS[current].onHide?.();
  current = view;
  $$(".tabbar button").forEach(b => b.dataset.view === view ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
  $$(".view").forEach(v => v.hidden = v.id !== "v-" + view);
  $("#viewTools").hidden = view !== "practicar";
  if (view !== "practicar") setFocus(false);
  VIEWS[view].onShow?.(opts);
  try { sessionStorage.setItem("riff-view", view); } catch (e) {}
  window.scrollTo({ top: 0 });
}
window.addEventListener("riff:go", e => go(e.detail.view, e.detail.opts || {}));

$$(".tabbar button[data-view]").forEach(b => b.addEventListener("click", () => go(b.dataset.view)));

/* Menú contraído, panel derecho oculto y pantalla completa para practicar (en computadora) */
const root = document.documentElement, pref = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} };
function setNavMini(on) { root.classList.toggle("nav-mini", on); pref("riff-nav-mini", on ? "1" : ""); const b = $("#navToggle"); b.setAttribute("aria-label", on ? "Expandir el menú" : "Contraer el menú"); b.title = b.getAttribute("aria-label"); window.dispatchEvent(new Event("resize")); }
function setSideHidden(on) { root.classList.toggle("side-hidden", on); pref("riff-side-hidden", on ? "1" : ""); $("#tgSide").setAttribute("aria-pressed", on); }
function setFocus(on) {
  if (on === root.classList.contains("focus")) return;
  root.classList.toggle("focus", on); $("#focusExit").hidden = !on;
  try {
    if (on && document.fullscreenEnabled && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  } catch (e) {}
  window.scrollTo({ top: 0 });
}
$$("[data-rec]").forEach(b => b.onclick = () => isRecording() ? stopRecording() : startRecording(recLabel()));
onRecState(st => $$("[data-rec]").forEach(b => {
  b.classList.toggle("on", st.on);
  b.querySelector(".rec-l").textContent = st.on ? `${fmtDur(st.secs)} · Detener` : "Grabar";
  b.title = st.on ? `Grabando: ${st.label}` : "Grabar lo que tocas para escucharte después";
}));
$("#navToggle").onclick = () => setNavMini(!root.classList.contains("nav-mini"));
$("#tgSide").onclick = () => setSideHidden(!root.classList.contains("side-hidden"));
$("#tgFocus").onclick = () => setFocus(true);
$("#focusExit").onclick = () => setFocus(false);
document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && root.classList.contains("focus")) setFocus(false); });
setNavMini(pref("riff-nav-mini") === "1"); setSideHidden(pref("riff-side-hidden") === "1");

// Atajos de teclado (útiles en laptop): Espacio inicia o pausa lo principal de la vista; 1–5 cambian de sección.
document.addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target, tag = t && t.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || t?.isContentEditable) return;
  const order = ["hoy", "practicar", "afinador", "acordes", "progreso"];
  if (/^[1-5]$/.test(e.key)) { go(order[+e.key - 1]); e.preventDefault(); return; }
  if ((e.key === "r" || e.key === "R") && current === "practicar") { isRecording() ? stopRecording() : startRecording(recLabel()); e.preventDefault(); return; }
  if ((e.key === "f" || e.key === "F") && current === "practicar") { setFocus(!root.classList.contains("focus")); e.preventDefault(); return; }
  if (e.key === "Escape" && root.classList.contains("focus") && !document.querySelector(".sheet-wrap")) { setFocus(false); return; }
  if (e.code === "Space" && !(tag === "BUTTON" || tag === "A" || tag === "SUMMARY")) {
    const btn = [...document.querySelectorAll("#v-" + current + " [data-primary]")].find(b => b.offsetParent !== null && !b.disabled);
    if (btn) { e.preventDefault(); btn.click(); }
  }
});

ensureSongs(); applyLane();
A.mic.echo = data.ajustes.eco !== false; A.setSensitivity(data.ajustes.micSens || "media");
for (const [k, v] of Object.entries(VIEWS)) v.mount($("#v-" + k));
header();
onChange(() => { header(); for (const v of Object.values(VIEWS)) v.refresh?.(); });

let start = "hoy";
try { start = sessionStorage.getItem("riff-view") || "hoy"; } catch (e) {}
const hash = location.hash.slice(1); if (VIEWS[hash]) start = hash;
go(start);

// Actualizaciones: busca versión nueva al abrir y al volver a la app; si llega una, recarga sola
// (salvo que estés en plena práctica: entonces espera a que vuelvas a la app).
if ("serviceWorker" in navigator && location.protocol === "https:") {
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloading) return;
    const busy = document.querySelector('[data-primary]') && [...document.querySelectorAll('.stage.live')].length > 0;
    if (busy) { document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && !reloading) { reloading = true; location.reload(); } }, { once: true }); return; }
    reloading = true; location.reload();
  });
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(reg => {
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
  }).catch(() => {});
}
