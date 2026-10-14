// Todas las pistas de un archivo de Guitar Pro, para cambiar la que aprendes sin volver a importar.
// Se guardan en IndexedDB (pueden pesar más que el resto de tus datos) y solo en este dispositivo.
const DB = "riff-tabs-pistas", STORE = "pistas";
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
function run(mode, fn) {
  return db().then(d => new Promise((res, rej) => { const t = d.transaction(STORE, mode), st = t.objectStore(STORE), req = fn(st); t.oncomplete = () => res(req?.result); t.onerror = () => rej(t.error); }));
}
// models: [{ i, pista, afin, cuerdas, capo, ev, notas }]
export async function savePistas(tabId, models) { for (const m of models) await run("readwrite", st => st.put(m, `${tabId}:${m.i}`)); }
export const loadPista = (tabId, i) => run("readonly", st => st.get(`${tabId}:${i}`));
export async function deletePistas(tabId, idx = []) { for (const i of idx) await run("readwrite", st => st.delete(`${tabId}:${i}`)); }
