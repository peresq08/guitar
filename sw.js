// Funciona sin conexión: guarda la app y las fuentes en caché.
const VERSION = "riff-v2.3.0";
const FILES = [
  "./", "index.html", "css/app.css", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png",
  "js/main.js", "js/detect.js", "js/store.js", "js/audio.js", "js/chords.js", "js/plan.js",
  "js/views/hoy.js", "js/views/practicar.js", "js/views/secuencias.js", "js/views/rasgueo.js", "js/views/afinador.js", "js/views/acordes.js", "js/views/progreso.js",
];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // Red primero, preguntando siempre al servidor si hay versión nueva (sin usar la copia del navegador);
    // la caché propia solo se usa sin conexión.
    e.respondWith(fetch(req, { cache: "no-cache" }).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return r; }).catch(() => caches.match(req, { ignoreSearch: true })));
  } else if (url.host.includes("fonts.g")) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return r; })));
  }
});
