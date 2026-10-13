// Camino de aprendizaje: niveles, metas y la rutina que se arma según tu nivel.
import { data, bestFor, streak, bestStreak, save } from "./store.js";

// Metas: auto() devuelve true cuando los datos ya demuestran que se cumplió.
export const LEVELS = [
  {
    id: 1, name: "Fundamentos", lema: "Cuatro acordes y un rasgueo parejo",
    chords: ["G", "C", "D", "Em"], pair: ["G", "C"], power: false,
    goals: [
      { id: "l1-acordes", t: "Tocar G, C, D y Em con todas las cuerdas limpias" },
      { id: "l1-cambio", t: "30 cambios G ↔ C en un minuto", auto: () => bestFor("G ↔ C") >= 30, prog: () => [bestFor("G ↔ C"), 30] },
      { id: "l1-rasgueo", t: "Rasgueo Pop básico limpio a 70 BPM", auto: () => rasgueoBest("pop") >= 70, prog: () => [rasgueoBest("pop"), 70] },
      { id: "l1-cancion", t: "Tocar una canción completa de principio a fin" },
    ],
  },
  {
    id: 2, name: "Acordes abiertos", lema: "Todo el vocabulario de las canciones populares",
    chords: ["Am", "E", "Dm", "A", "F (mini)"], pair: ["Am", "E"], power: false,
    goals: [
      { id: "l2-acordes", t: "Tocar Am, E, Dm, A y F (mini) limpios" },
      { id: "l2-cambio", t: "40 cambios Am ↔ E en un minuto", auto: () => bestFor("Am ↔ E") >= 40, prog: () => [bestFor("Am ↔ E"), 40] },
      { id: "l2-cambio2", t: "30 cambios C ↔ F (mini) en un minuto", auto: () => bestFor("C ↔ F (mini)") >= 30, prog: () => [bestFor("C ↔ F (mini)"), 30] },
      { id: "l2-racha", t: "Practicar 7 días seguidos", auto: () => bestStreak() >= 7, prog: () => [Math.max(streak(), bestStreak()), 7] },
      { id: "l2-cancion", t: "Every Rose Has Its Thorn completa con la grabación" },
    ],
  },
  {
    id: 3, name: "Rock y power chords", lema: "Distorsión, palm mute y riffs",
    chords: ["E5", "A5", "G5", "D5"], pair: ["E5", "A5"], power: true,
    goals: [
      { id: "l3-power", t: "Power chords E5, A5, G5 y D5 sin que suenen cuerdas de más" },
      { id: "l3-cambio", t: "50 cambios E5 ↔ A5 en un minuto", auto: () => bestFor("E5 ↔ A5") >= 50, prog: () => [bestFor("E5 ↔ A5"), 50] },
      { id: "l3-palm", t: "Corcheas abajo con palm mute limpias a 100 BPM", auto: () => rasgueoBest("rapido") >= 100, prog: () => [rasgueoBest("rapido"), 100] },
      { id: "l3-riff", t: "Riff de Breaking the Law a velocidad original" },
      { id: "l3-bib", t: "Riff de Back in Black con sus silencios" },
    ],
  },
  {
    id: 4, name: "Pentatónica y solos", lema: "La escala de casi todos los solos de rock",
    chords: ["Em", "Am", "A5", "E5"], pair: ["Am", "Em"], power: true, scale: true,
    goals: [
      { id: "l4-caja", t: "Pentatónica menor caja 1 en La (traste 5), subiendo y bajando a 80 BPM en corcheas" },
      { id: "l4-jam", t: "Improvisar 3 minutos sobre una pista de Jam sin detenerte", auto: () => (data.jams || []).some(s => s.min >= 3) },
      { id: "l4-tec", t: "Bends de un tono afinados y vibrato controlado" },
      { id: "l4-solo", t: "Aprender un solo corto (por ejemplo, el de Breaking the Law)" },
    ],
  },
  {
    id: 5, name: "Cejilla", lema: "Acordes en cualquier lugar del mástil",
    chords: ["F", "Bm", "B", "F#m"], pair: ["C", "F"], power: false,
    goals: [
      { id: "l5-f", t: "F con cejilla completa, las seis cuerdas limpias" },
      { id: "l5-cambio", t: "30 cambios C ↔ F en un minuto", auto: () => bestFor("C ↔ F") >= 30, prog: () => [bestFor("C ↔ F"), 30] },
      { id: "l5-bm", t: "Bm limpio y cambio G ↔ Bm fluido" },
      { id: "l5-cancion", t: "Summer of '69 completa" },
    ],
  },
];

const rasgueoBest = id => ((data.rasgueos || {}).prog || {})[id]?.best || 0;
export const goalDone = g => !!data.metas[g.id] || (g.auto ? g.auto() : false);
export function toggleGoal(id) { if (data.metas[id]) delete data.metas[id]; else data.metas[id] = new Date().toISOString(); save(); }
export function currentLevel() { return LEVELS.find(l => !l.goals.every(goalDone)) || LEVELS[LEVELS.length - 1]; }
export function levelProgress(l) { const d = l.goals.filter(goalDone).length; return [d, l.goals.length]; }
export function nextGoal(l = currentLevel()) { return l.goals.find(g => !goalDone(g)); }

/* ---- Repertorio inicial ---- */
export const SEED_SONGS = [
  { titulo: "Every Rose Has Its Thorn", artista: "Poison", nivel: 1, bpm: 68, tip: "G, Cadd9 y D. Cambios sin pausa y rasgueo suave." },
  { titulo: "Here I Go Again", artista: "Whitesnake", nivel: 2, bpm: 90, tip: "Acordes abiertos con ritmo constante; toca junto a la grabación." },
  { titulo: "Patience", artista: "Guns N' Roses", nivel: 2, bpm: 120, tip: "Dinámica: suave en estrofas, fuerte en el coro." },
  { titulo: "Summer of '69", artista: "Bryan Adams", nivel: 5, bpm: 139, tip: "Te presenta el Bm con cejilla; usa la versión parcial al inicio." },
  { titulo: "Breaking the Law", artista: "Judas Priest", nivel: 3, bpm: 164, tip: "Riff en Mi menor con palm mute. Empieza a 100 BPM." },
  { titulo: "Back in Black", artista: "AC/DC", nivel: 3, bpm: 94, tip: "E5, D5 y A5; los silencios son parte del riff." },
  { titulo: "Livin' on a Prayer", artista: "Bon Jovi", nivel: 3, bpm: 123, tip: "Riff en Em con palm mute y coro con power chords." },
  { titulo: "Seek & Destroy", artista: "Metallica", nivel: 3, bpm: 140, tip: "Palm mute rápido; usa el metrónomo progresivo." },
  { titulo: "Every Breath You Take", artista: "The Police", nivel: 4, bpm: 117, tip: "Arpegios con estiramientos de dedos." },
  { titulo: "Sweet Child O' Mine", artista: "Guns N' Roses", nivel: 4, bpm: 125, tip: "Intro de arpegios cruzando cuerdas; meta de largo plazo." },
];
// Biblioteca de canciones: progresiones conocidas, marcadas como simplificadas o aproximadas cuando lo son.
// El tempo es el aproximado de la grabación original. "rasgueo" apunta a un patrón del entrenador de rasgueo.
export const LIBRARY = [
  { titulo: "Every Rose Has Its Thorn", artista: "Poison", anio: 1988, rasgueo: "balada", secuencias: [{ nombre: "estrofa (simplificada)", acordes: "G Cadd9 G Cadd9 D Cadd9 G G" }] },
  { titulo: "Here I Go Again", artista: "Whitesnake", anio: 1987, rasgueo: "rock8" },
  { titulo: "Patience", artista: "Guns N' Roses", anio: 1988, rasgueo: "balada" },
  { titulo: "Summer of '69", artista: "Bryan Adams", anio: 1984, rasgueo: "rock8", secuencias: [{ nombre: "estrofa", acordes: "D A" }] },
  { titulo: "Breaking the Law", artista: "Judas Priest", anio: 1980, rasgueo: "rapido" },
  { titulo: "Back in Black", artista: "AC/DC", anio: 1980 },
  { titulo: "Livin' on a Prayer", artista: "Bon Jovi", anio: 1986, rasgueo: "rapido" },
  { titulo: "Seek & Destroy", artista: "Metallica", anio: 1983, rasgueo: "galope" },
  { titulo: "Every Breath You Take", artista: "The Police", anio: 1983, secuencias: [{ nombre: "estrofa", acordes: "G Em C D" }] },
  { titulo: "Sweet Child O' Mine", artista: "Guns N' Roses", anio: 1987, secuencias: [{ nombre: "estrofa", acordes: "D C G D" }, { nombre: "coro", acordes: "A C D D" }] },
  { titulo: "Don't Stop Believin'", artista: "Journey", anio: 1981, nivel: 5, bpm: 119, rasgueo: "pop", tip: "Cuatro acordes con cejilla en B, C#m y G#m. Si cuesta, empieza con el cambio E → B.", secuencias: [{ nombre: "estrofa", acordes: "E B C#m A E B G#m A" }] },
  { titulo: "With or Without You", artista: "U2", anio: 1987, nivel: 5, bpm: 110, rasgueo: "rock8", tip: "Los mismos cuatro acordes toda la canción: perfecta para afianzar Bm.", secuencias: [{ nombre: "toda la canción", acordes: "D A Bm G" }] },
  { titulo: "Knockin' on Heaven's Door", artista: "Guns N' Roses", anio: 1991, nivel: 2, bpm: 68, rasgueo: "balada", tip: "Dos frases casi iguales: la primera termina en Am y la segunda en C.", secuencias: [{ nombre: "toda la canción", acordes: "G D Am:8 G D C:8" }] },
  { titulo: "Zombie", artista: "The Cranberries", anio: 1994, nivel: 1, bpm: 84, rasgueo: "rock8", tip: "Versión simplificada: C en lugar de Cmaj7 y D en lugar de D/F#.", secuencias: [{ nombre: "toda la canción (simplificada)", acordes: "Em C G D" }] },
  { titulo: "Creep", artista: "Radiohead", anio: 1992, nivel: 5, bpm: 92, rasgueo: "pop", tip: "B y Cm con cejilla. De C a Cm solo cambian dos dedos.", secuencias: [{ nombre: "toda la canción", acordes: "G B C Cm" }] },
  { titulo: "Hotel California", artista: "Eagles", anio: 1976, nivel: 5, bpm: 74, rasgueo: "pop", tip: "Ocho acordes con varias cejillas; practícala por mitades.", secuencias: [{ nombre: "estrofa", acordes: "Bm F# A E G D Em F#" }] },
  { titulo: "Stand by Me", artista: "Ben E. King", anio: 1961, nivel: 5, bpm: 118, rasgueo: "pop", tip: "La progresión más clásica: A, F#m, D y E.", secuencias: [{ nombre: "estrofa", acordes: "A:8 F#m:8 D:4 E:4 A:8" }] },
  { titulo: "Sweet Home Alabama", artista: "Lynyrd Skynyrd", anio: 1974, nivel: 1, bpm: 98, rasgueo: "rock8", tip: "D, C y G toda la canción; en la grabación es un riff con esos acordes.", secuencias: [{ nombre: "toda la canción", acordes: "D:2 C:2 G:4" }] },
  { titulo: "I Love Rock 'n' Roll", artista: "Joan Jett & the Blackhearts", anio: 1981, nivel: 3, bpm: 94, rasgueo: "negras", tip: "Power chords con golpes firmes en cada tiempo.", secuencias: [{ nombre: "coro (simplificado)", acordes: "E5 A5 B5 B5" }] },
  { titulo: "Smoke on the Water", artista: "Deep Purple", anio: 1972, nivel: 3, bpm: 112, tip: "El riff más famoso del rock, con power chords en la 4ª y 5ª cuerda.", secuencias: [{ nombre: "riff (aprox.)", acordes: "G5:1 Bb5:1 C5:2 G5:1 Bb5:1 C#5:1 C5:1 G5:1 Bb5:1 C5:2 Bb5:1 G5:3" }] },
  { titulo: "Iron Man", artista: "Black Sabbath", anio: 1970, nivel: 3, bpm: 76, tip: "Riff lento y pesado con power chords; ideal para practicar cambios por el mástil.", secuencias: [{ nombre: "riff (aprox.)", acordes: "B5:2 D5:2 E5:4 G5:1 F#5:1 G5:1 F#5:1 G5:1 F#5:1 D5:2 E5:4" }] },
  { titulo: "Should I Stay or Should I Go", artista: "The Clash", anio: 1982, nivel: 1, bpm: 113, rasgueo: "rock8", tip: "D y G con ataque punk.", secuencias: [{ nombre: "riff", acordes: "D:2 G:2 D:4" }] },
  { titulo: "Wonderful Tonight", artista: "Eric Clapton", anio: 1977, nivel: 1, bpm: 96, rasgueo: "balada", tip: "Balada lenta con G, D y C: buena para un rasgueo suave y parejo.", secuencias: [{ nombre: "estrofa", acordes: "G D C D" }] },
  { titulo: "Have You Ever Seen the Rain", artista: "Creedence Clearwater Revival", anio: 1970, nivel: 2, bpm: 116, rasgueo: "pop", tip: "El coro es una buena práctica para F (mini).", secuencias: [{ nombre: "coro", acordes: "F (mini) G C Am F (mini) G C:8" }] },
  { titulo: "Brown Eyed Girl", artista: "Van Morrison", anio: 1967, nivel: 1, bpm: 150, rasgueo: "pop", tip: "G, C y D a buen ritmo.", secuencias: [{ nombre: "estrofa", acordes: "G C G D" }] },
  { titulo: "Get Lucky", artista: "Daft Punk ft. Pharrell Williams", anio: 2013, nivel: 5, bpm: 116, rasgueo: "funk1", tip: "Guitarra funk en semicorcheas con la mano siempre en movimiento.", secuencias: [{ nombre: "toda la canción", acordes: "Bm D F#m E" }] },
  { titulo: "Uptown Funk", artista: "Mark Ronson ft. Bruno Mars", anio: 2014, nivel: 2, bpm: 115, rasgueo: "funk2", tip: "Dos acordes con golpes cortos y apagados.", secuencias: [{ nombre: "riff (simplificado)", acordes: "Dm7 G7" }] },
];
export function ensureSongs() {
  let changed = false;
  if (!Array.isArray(data.canciones)) {
    data.canciones = SEED_SONGS.map((s, i) => ({ id: "s" + i, titulo: s.titulo, artista: s.artista, nivel: s.nivel, bpmMeta: s.bpm, tip: s.tip, estado: "pendiente", notas: "" }));
    changed = true;
  }
  // Registro de lo que ya se agregó, para no duplicar ni volver a agregar lo que hayas borrado
  if (!data.agregado) { data.agregado = { canciones: SEED_SONGS.map(s => s.titulo), secuencias: [] }; changed = true; }
  LIBRARY.forEach((L, i) => {
    let song = data.canciones.find(s => s.titulo === L.titulo);
    if (!song && !data.agregado.canciones.includes(L.titulo) && L.nivel) {
      song = { id: "b" + i, titulo: L.titulo, artista: L.artista, nivel: L.nivel, bpmMeta: L.bpm, tip: L.tip, estado: "pendiente", notas: "" };
      data.canciones.push(song); changed = true;
    }
    if (!data.agregado.canciones.includes(L.titulo)) { data.agregado.canciones.push(L.titulo); changed = true; }
    if (song) {
      if (L.anio && !song.anio) { song.anio = L.anio; changed = true; }
      if (L.rasgueo && !song.rasgueo) { song.rasgueo = L.rasgueo; changed = true; }
    }
  });
  if (changed) save();
}
export function songOfDay(l = currentLevel()) {
  const songs = data.canciones || [];
  const practicing = songs.filter(s => s.estado === "practicando");
  const pool = practicing.length ? practicing : songs.filter(s => s.estado !== "dominada" && (s.nivel || 1) <= l.id);
  const list = pool.length ? pool : songs;
  if (!list.length) return null;
  const d = new Date(), k = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
  return list[k % list.length];
}

/* ---- Rutina ---- */
export function buildRoutine(total = data.ajustes.rutinaMin || 30, l = currentLevel()) {
  const song = songOfDay(l);
  const pair = l.pair.join(" ↔ ");
  const blocks = [
    { n: "Calentamiento", w: 3, tip: l.scale
        ? "Pentatónica menor caja 1 en La (traste 5), subiendo y bajando con púa alternada. Empieza a 60 BPM."
        : "Ejercicio cromático 1-2-3-4 en cada cuerda, trastes 1 al 4 y de regreso. Lento, limpio y con púa alternada.", tool: l.scale ? null : "metro" },
    { n: "Acordes del nivel", w: 5, tip: "Arma cada acorde, toca cuerda por cuerda y corrige las que suenen apagadas. Luego cuatro rasgueos de cada uno.", chords: l.chords },
    bestFor(pair)
      ? { n: "Cambios con tempo", w: 5, tip: `Dos o tres rondas de ${pair} con el clic. El tempo sube solo cuando tus cambios salen limpios. Récord actual: ${bestFor(pair)}.`, tool: "cambios", pair: l.pair, mode: "guia" }
      : { n: "Cambios en un minuto", w: 5, tip: `Haz un reto libre con ${pair} para medir tu punto de partida; luego el entrenador con clic ajustará el tempo por ti.`, tool: "cambios", pair: l.pair, mode: "libre" },
    l.scale
      ? { n: "Improvisación", w: 7, tip: "Abre Jam, elige Rock en Mi menor o Blues en La e improvisa con la pentatónica. Busca frases cortas y deja silencios.", tool: "jam" }
      : l.power
        ? { n: "Power chords y palm mute", w: 7, tip: "Corcheas abajo con palm mute en E5, G5 y A5 en el entrenador de rasgueo. Cuando salga parejo, prueba el galope.", chords: ["E5", "G5", "A5"], tool: "rasgueo", pattern: "rapido" }
        : { n: "Ritmo", w: 7, tip: l.id === 1 ? "Patrón Pop básico en el entrenador de rasgueo. Mantén el brazo en movimiento aunque no toques las cuerdas." : "Un patrón de rasgueo con los acordes del nivel. Cuando el Pop básico salga limpio, prueba Rock en corcheas o Funk 1.", tool: "rasgueo", pattern: l.id === 1 ? "pop" : "rock8" },
    { n: "Canción del día", w: 10, song },
  ];
  const W = blocks.reduce((a, b) => a + b.w, 0);
  let acc = 0;
  blocks.forEach((b, i) => {
    b.min = i === blocks.length - 1 ? Math.max(1, total - acc) : Math.max(1, Math.round(b.w / W * total));
    acc += b.min;
  });
  return blocks;
}
