// Grabaciones de tu práctica: graba el micrófono mientras tocas y guarda el audio en este dispositivo
// (IndexedDB, no se sube a ningún lado). Cada grabación lleva qué estabas practicando y la fecha.
import * as A from "./audio.js";
import { toast } from "./store.js";

const DB = "riff-audio", STORE = "grabaciones", MAX_MIN = 20, KEEP = 60;
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => { const t = d.transaction(STORE, mode), st = t.objectStore(STORE); const out = fn(st); t.oncomplete = () => res(out?.result ?? out); t.onerror = () => rej(t.error); });
}
export async function listRecordings() {
  const all = await tx("readonly", st => st.getAll());
  return (all || []).sort((a, b) => b.t - a.t);
}
export const getRecording = id => tx("readonly", st => st.get(id));
export const deleteRecording = id => tx("readwrite", st => st.delete(id));
export async function renameRecording(id, label) { const r = await getRecording(id); if (r) { r.label = label; await tx("readwrite", st => st.put(r)); } }

const R = { rec: null, chunks: [], t0: 0, label: "", timer: null, listeners: new Set() };
export const isRecording = () => !!R.rec;
export const elapsed = () => R.rec ? (performance.now() - R.t0) / 1000 : 0;
export function onRecState(fn) { R.listeners.add(fn); }
const emit = () => R.listeners.forEach(fn => fn({ on: !!R.rec, secs: elapsed(), label: R.label }));

function pickMime() {
  const c = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return c.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported?.(m)) || "";
}
export async function startRecording(label) {
  if (R.rec) return true;
  if (!window.MediaRecorder) { toast("Este navegador no puede grabar audio."); return false; }
  if (!(await A.micOn())) { toast(A.mic.error || "Sin permiso para el micrófono."); return false; }
  const mime = pickMime();
  let rec;
  try { rec = new MediaRecorder(A.mic.stream, mime ? { mimeType: mime, audioBitsPerSecond: 96000 } : undefined); }
  catch (e) { toast("No se pudo empezar a grabar."); return false; }
  Object.assign(R, { rec, chunks: [], t0: performance.now(), label: label || "Práctica" });
  rec.ondataavailable = e => { if (e.data && e.data.size) R.chunks.push(e.data); };
  rec.onstop = async () => {
    const secs = (performance.now() - R.t0) / 1000, blob = new Blob(R.chunks, { type: rec.mimeType || mime || "audio/webm" });
    const label = R.label; R.rec = null; R.chunks = []; clearInterval(R.timer); emit();
    if (secs < 2 || !blob.size) { toast("Grabación muy corta: no se guardó."); return; }
    try {
      await tx("readwrite", st => st.put({ id: "r" + Date.now().toString(36), t: Date.now(), dur: Math.round(secs), label, mime: blob.type, blob }));
      const all = await listRecordings();
      for (const old of all.slice(KEEP)) await deleteRecording(old.id);
      toast(`Grabación guardada (${fmtDur(secs)}). Escúchala en Progreso.`);
      window.dispatchEvent(new Event("riff:recordings"));
    } catch (e) { toast("No hay espacio para guardar la grabación."); }
  };
  rec.start(1000);
  R.timer = setInterval(() => { emit(); if (elapsed() > MAX_MIN * 60) stopRecording(); }, 500);
  emit();
  return true;
}
export function stopRecording() { if (R.rec && R.rec.state !== "inactive") R.rec.stop(); }
export const fmtDur = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
export const extOf = mime => /mp4/.test(mime) ? "m4a" : /ogg/.test(mime) ? "ogg" : "webm";
