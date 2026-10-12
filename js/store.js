// Datos del usuario: se guardan en este dispositivo (localStorage) y se pueden respaldar a un archivo.
const KEY = "riff-v2";
const OLD = "guitarra-practica-v1";

const DEFAULTS = () => ({
  version: 2,
  sesiones: [],      // {t, min, tipo}
  intentos: [],      // {par, n, t, modo, bpm?, limpios?}
  metas: {},         // id de meta -> fecha en que se marcó
  jams: [],          // {t, min, estilo}
  canciones: null,   // se siembra con la lista inicial la primera vez
  calibracion: {},   // acorde -> croma promedio
  ajustes: { rutinaMin: 30, a4: 440 },
});

const listeners = new Set();
export let data = load();

function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  if (!d) {
    d = DEFAULTS();
    try {
      const old = JSON.parse(localStorage.getItem(OLD) || "null");
      if (old) { d.sesiones = old.sesiones || []; d.intentos = old.intentos || []; }
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("cal:")) d.calibracion[k.slice(4)] = JSON.parse(localStorage.getItem(k));
      }
    } catch (e) {}
  }
  const base = DEFAULTS();
  d = Object.assign(base, d);
  d.ajustes = Object.assign(DEFAULTS().ajustes, d.ajustes || {});
  return d;
}

export function save() {
  data.intentos = data.intentos.slice(-1000);
  data.sesiones = data.sesiones.slice(-1500);
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
  listeners.forEach(fn => fn(data));
}
export function onChange(fn) { listeners.add(fn); }

export function exportJSON() {
  return JSON.stringify(Object.assign({ exportado: new Date().toISOString(), app: "Riff" }, data), null, 2);
}
export function importJSON(text) {
  const d = JSON.parse(text);
  if (!d || !Array.isArray(d.sesiones) || !Array.isArray(d.intentos)) throw new Error("El archivo no parece un respaldo de Riff.");
  delete d.exportado; delete d.app;
  data = Object.assign(DEFAULTS(), d);
  save();
}

// Utilidades de fecha
export const dayKey = (d) => { d = new Date(d); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
export function practiceDays() { return new Set(data.sesiones.map(s => dayKey(s.t))); }
export function streak() {
  const days = practiceDays(); let n = 0; const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export function bestStreak() {
  const ks = [...practiceDays()].sort(); let best = 0, cur = 0, prev = null;
  for (const k of ks) {
    const d = new Date(k + "T12:00:00");
    cur = prev && (d - prev) / 864e5 < 1.5 ? cur + 1 : 1; best = Math.max(best, cur); prev = d;
  }
  return best;
}
export function bestFor(par) { return data.intentos.filter(x => x.par === par).reduce((m, x) => Math.max(m, x.n), 0); }
export function minutesOn(k) { return data.sesiones.filter(s => dayKey(s.t) === k).reduce((a, s) => a + (s.min || 0), 0); }

export function logSession(min, tipo = "rutina") {
  data.sesiones.push({ t: new Date().toISOString(), min: Math.max(1, Math.round(min)), tipo });
  save();
}

// Mensajes breves
let tt = null;
export function toast(msg) {
  const el = document.getElementById("toast"); el.textContent = msg; el.classList.add("show");
  clearTimeout(tt); tt = setTimeout(() => el.classList.remove("show"), 2600);
}
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
