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
      { id: "l1-rasgueo", t: "Rasgueo abajo-abajo-arriba-arriba-abajo-arriba a 70 BPM sin perder el tiempo" },
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
      { id: "l3-palm", t: "Corcheas con palm mute a 100 BPM durante un minuto" },
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
export function ensureSongs() {
  if (!Array.isArray(data.canciones)) {
    data.canciones = SEED_SONGS.map((s, i) => ({ id: "s" + i, titulo: s.titulo, artista: s.artista, nivel: s.nivel, bpmMeta: s.bpm, tip: s.tip, estado: "pendiente", notas: "" }));
    save();
  }
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
    { n: "Cambios en un minuto", w: 5, tip: `Haz dos o tres retos con ${pair}. Tu récord actual es ${bestFor(pair)}.`, tool: "cambios", pair: l.pair },
    l.scale
      ? { n: "Improvisación", w: 7, tip: "Abre Jam, elige Rock en Mi menor o Blues en La e improvisa con la pentatónica. Busca frases cortas y deja silencios.", tool: "jam" }
      : l.power
        ? { n: "Power chords y palm mute", w: 7, tip: "Corcheas con palm mute en E5; cambia a G5 y A5. Usa el metrónomo progresivo de 80 a 110 BPM.", chords: ["E5", "G5", "A5"], tool: "metro" }
        : { n: "Ritmo", w: 7, tip: "Rasgueo abajo-abajo-arriba-arriba-abajo-arriba con los acordes del nivel. Mantén el brazo en movimiento aunque no toques las cuerdas.", tool: "metro" },
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
