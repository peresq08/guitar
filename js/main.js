import { data, onChange, streak, practiceDays, dayKey, $, $$ } from "./store.js";
import { currentLevel, ensureSongs } from "./plan.js";
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
  VIEWS[view].onShow?.(opts);
  try { sessionStorage.setItem("riff-view", view); } catch (e) {}
  window.scrollTo({ top: 0 });
}
window.addEventListener("riff:go", e => go(e.detail.view, e.detail.opts || {}));

$$(".tabbar button").forEach(b => b.addEventListener("click", () => go(b.dataset.view)));

ensureSongs();
for (const [k, v] of Object.entries(VIEWS)) v.mount($("#v-" + k));
header();
onChange(() => { header(); for (const v of Object.values(VIEWS)) v.refresh?.(); });

let start = "hoy";
try { start = sessionStorage.getItem("riff-view") || "hoy"; } catch (e) {}
const hash = location.hash.slice(1); if (VIEWS[hash]) start = hash;
go(start);

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
