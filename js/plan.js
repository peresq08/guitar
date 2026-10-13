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
  { titulo: "Back in Black", artista: "AC/DC", anio: 1980, rasgueo: "negras" },
  { titulo: "Livin' on a Prayer", artista: "Bon Jovi", anio: 1986, rasgueo: "rapido" },
  { titulo: "Seek & Destroy", artista: "Metallica", anio: 1983, rasgueo: "galope" },
  { titulo: "Every Breath You Take", artista: "The Police", anio: 1983, rasgueo: "pop", secuencias: [{ nombre: "estrofa", acordes: "G Em C D" }] },
  { titulo: "Sweet Child O' Mine", artista: "Guns N' Roses", anio: 1987, rasgueo: "rock8", secuencias: [{ nombre: "estrofa", acordes: "D C G D" }, { nombre: "coro", acordes: "A C D D" }] },
  { titulo: "Don't Stop Believin'", artista: "Journey", anio: 1981, nivel: 5, bpm: 119, rasgueo: "pop", tip: "Cuatro acordes con cejilla en B, C#m y G#m. Si cuesta, empieza con el cambio E → B.", secuencias: [{ nombre: "estrofa", acordes: "E B C#m A E B G#m A" }] },
  { titulo: "With or Without You", artista: "U2", anio: 1987, nivel: 5, bpm: 110, rasgueo: "rock8", tip: "Los mismos cuatro acordes toda la canción: perfecta para afianzar Bm.", secuencias: [{ nombre: "toda la canción", acordes: "D A Bm G" }] },
  { titulo: "Knockin' on Heaven's Door", artista: "Guns N' Roses", anio: 1991, nivel: 2, bpm: 68, rasgueo: "balada", tip: "Dos frases casi iguales: la primera termina en Am y la segunda en C.", secuencias: [{ nombre: "toda la canción", acordes: "G D Am:8 G D C:8" }] },
  { titulo: "Zombie", artista: "The Cranberries", anio: 1994, nivel: 1, bpm: 84, rasgueo: "rock8", tip: "Versión simplificada: C en lugar de Cmaj7 y D en lugar de D/F#.", secuencias: [{ nombre: "toda la canción (simplificada)", acordes: "Em C G D" }] },
  { titulo: "Creep", artista: "Radiohead", anio: 1992, nivel: 5, bpm: 92, rasgueo: "pop", tip: "B y Cm con cejilla. De C a Cm solo cambian dos dedos.", secuencias: [{ nombre: "toda la canción", acordes: "G B C Cm" }] },
  { titulo: "Hotel California", artista: "Eagles", anio: 1976, nivel: 5, bpm: 74, rasgueo: "pop", tip: "Ocho acordes con varias cejillas; practícala por mitades.", secuencias: [{ nombre: "estrofa", acordes: "Bm F# A E G D Em F#" }] },
  { titulo: "Stand by Me", artista: "Ben E. King", anio: 1961, nivel: 5, bpm: 118, rasgueo: "pop", tip: "La progresión más clásica: A, F#m, D y E.", secuencias: [{ nombre: "estrofa", acordes: "A:8 F#m:8 D:4 E:4 A:8" }] },
  { titulo: "Sweet Home Alabama", artista: "Lynyrd Skynyrd", anio: 1974, nivel: 1, bpm: 98, rasgueo: "rock8", tip: "D, C y G toda la canción; en la grabación es un riff con esos acordes.", secuencias: [{ nombre: "toda la canción", acordes: "D:2 C:2 G:4" }] },
  { titulo: "I Love Rock 'n' Roll", artista: "Joan Jett & the Blackhearts", anio: 1981, nivel: 3, bpm: 94, rasgueo: "negras", tip: "Power chords con golpes firmes en cada tiempo.", secuencias: [{ nombre: "coro (simplificado)", acordes: "E5 A5 B5 B5" }] },
  { titulo: "Smoke on the Water", artista: "Deep Purple", anio: 1972, nivel: 3, bpm: 112, rasgueo: "negras", tip: "El riff más famoso del rock, con power chords en la 4ª y 5ª cuerda.", secuencias: [{ nombre: "riff (aprox.)", acordes: "G5:1 Bb5:1 C5:2 G5:1 Bb5:1 C#5:1 C5:1 G5:1 Bb5:1 C5:2 Bb5:1 G5:3" }] },
  { titulo: "Iron Man", artista: "Black Sabbath", anio: 1970, nivel: 3, bpm: 76, rasgueo: "negras", tip: "Riff lento y pesado con power chords; ideal para practicar cambios por el mástil.", secuencias: [{ nombre: "riff (aprox.)", acordes: "B5:2 D5:2 E5:4 G5:1 F#5:1 G5:1 F#5:1 G5:1 F#5:1 D5:2 E5:4" }] },
  { titulo: "Should I Stay or Should I Go", artista: "The Clash", anio: 1982, nivel: 1, bpm: 113, rasgueo: "rock8", tip: "D y G con ataque punk.", secuencias: [{ nombre: "riff", acordes: "D:2 G:2 D:4" }] },
  { titulo: "Wonderful Tonight", artista: "Eric Clapton", anio: 1977, nivel: 1, bpm: 96, rasgueo: "balada", tip: "Balada lenta con G, D y C: buena para un rasgueo suave y parejo.", secuencias: [{ nombre: "estrofa", acordes: "G D C D" }] },
  { titulo: "Have You Ever Seen the Rain", artista: "Creedence Clearwater Revival", anio: 1970, nivel: 2, bpm: 116, rasgueo: "pop", tip: "El coro es una buena práctica para F (mini).", secuencias: [{ nombre: "coro", acordes: "F (mini) G C Am F (mini) G C:8" }] },
  { titulo: "Brown Eyed Girl", artista: "Van Morrison", anio: 1967, nivel: 1, bpm: 150, rasgueo: "pop", tip: "G, C y D a buen ritmo.", secuencias: [{ nombre: "estrofa", acordes: "G C G D" }] },
  { titulo: "Get Lucky", artista: "Daft Punk ft. Pharrell Williams", anio: 2013, nivel: 5, bpm: 116, rasgueo: "funk1", tip: "Guitarra funk en semicorcheas con la mano siempre en movimiento.", secuencias: [{ nombre: "toda la canción", acordes: "Bm D F#m E" }] },
  // Segunda tanda: rock, grunge, metal y clásicas para tocar con amigos
  { titulo: "Wonderwall", artista: "Oasis", anio: 1995, nivel: 2, bpm: 87, rasgueo: "pop", tip: "Versión sin cejilla. La original usa capo en el traste 2 y A7sus4 en lugar de A7.", secuencias: [{ nombre: "estrofa (simplificada)", acordes: "Em7 G Dsus4 A7" }] },
  { titulo: "Boulevard of Broken Dreams", artista: "Green Day", anio: 2004, nivel: 2, bpm: 83, rasgueo: "rock8", tip: "Cuatro acordes con un rasgueo firme y parejo.", secuencias: [{ nombre: "estrofa", acordes: "Em G D A" }] },
  { titulo: "Good Riddance (Time of Your Life)", artista: "Green Day", anio: 1997, nivel: 1, bpm: 95, rasgueo: "pop", tip: "G, Cadd9 y D: los dedos 3 y 4 se quedan fijos entre los tres acordes.", secuencias: [{ nombre: "estrofa", acordes: "G G Cadd9 D" }] },
  { titulo: "Smells Like Teen Spirit", artista: "Nirvana", anio: 1991, nivel: 3, bpm: 117, rasgueo: "rock8", tip: "Cuatro power chords. En la grabación hay golpes apagados entre acordes; empieza sin ellos.", secuencias: [{ nombre: "riff", acordes: "F5 Bb5 Ab5 C#5" }] },
  { titulo: "Paranoid", artista: "Black Sabbath", anio: 1970, nivel: 3, bpm: 163, rasgueo: "rapido", tip: "Corcheas abajo con palm mute sobre E5 y un remate rápido. Empieza lento.", secuencias: [{ nombre: "riff (aprox.)", acordes: "E5:4 D5:1 G5:1 D5:1 E5:1" }] },
  { titulo: "You Really Got Me", artista: "The Kinks", anio: 1964, nivel: 3, bpm: 136, rasgueo: "rock8", tip: "El riff es solo F5 y G5; la canción lo repite subiendo de tono.", secuencias: [{ nombre: "riff", acordes: "F5 G5" }] },
  { titulo: "Rockin' in the Free World", artista: "Neil Young", anio: 1989, nivel: 1, bpm: 125, rasgueo: "rock8", tip: "Em, D y C con fuerza: ideal para el rasgueo de rock.", secuencias: [{ nombre: "estrofa", acordes: "Em D C C" }] },
  { titulo: "Losing My Religion", artista: "R.E.M.", anio: 1991, nivel: 2, bpm: 125, rasgueo: "pop", tip: "Am y Em se alternan; el cambio a Dm y G cierra la frase.", secuencias: [{ nombre: "estrofa", acordes: "Am Em Am Em Am Em Dm G" }] },
  { titulo: "Wish You Were Here", artista: "Pink Floyd", anio: 1975, nivel: 2, bpm: 60, rasgueo: "pop", tip: "Versión simplificada sin bajos alternos (D/F# y Am/G).", secuencias: [{ nombre: "estrofa (simplificada)", acordes: "C D Am G D C Am G" }] },
  { titulo: "Let It Be", artista: "The Beatles", anio: 1970, nivel: 2, bpm: 72, rasgueo: "balada", tip: "La progresión pop clásica, con F (mini) para no usar cejilla.", secuencias: [{ nombre: "estrofa", acordes: "C G Am F (mini) C G F (mini) C" }] },
  { titulo: "Twist and Shout", artista: "The Beatles", anio: 1963, nivel: 2, bpm: 124, rasgueo: "rock8", tip: "D, G y A una y otra vez, con energía.", secuencias: [{ nombre: "toda la canción", acordes: "D G A A" }] },
  { titulo: "No Woman, No Cry", artista: "Bob Marley & The Wailers", anio: 1974, nivel: 2, bpm: 78, rasgueo: "reggae", tip: "Golpe corto en 2 y 4: el silencio entre golpes es lo que da el estilo.", secuencias: [{ nombre: "toda la canción", acordes: "C G Am F (mini) C F (mini) C G" }] },
  { titulo: "Riptide", artista: "Vance Joy", anio: 2014, nivel: 2, bpm: 102, rasgueo: "pop", tip: "Am, G y C con un rasgueo alegre; en la grabación es un ukulele.", secuencias: [{ nombre: "toda la canción", acordes: "Am G C C" }] },
  { titulo: "Wild Thing", artista: "The Troggs", anio: 1966, nivel: 2, bpm: 105, rasgueo: "rock8", tip: "A, D y E: tres acordes de rock garage.", secuencias: [{ nombre: "riff", acordes: "A D E D" }] },
  { titulo: "Louie Louie", artista: "The Kingsmen", anio: 1963, nivel: 2, bpm: 120, rasgueo: "rock8", tip: "El riff 1-2-3, 1-2 sobre A, D y Em.", secuencias: [{ nombre: "riff (simplificado)", acordes: "A D Em D" }] },
  { titulo: "La Bamba", artista: "Ritchie Valens", anio: 1958, nivel: 2, bpm: 150, rasgueo: "pop", tip: "C, F y G rápido; usa F (mini).", secuencias: [{ nombre: "toda la canción", acordes: "C F (mini) G G" }] },
  { titulo: "Bad Moon Rising", artista: "Creedence Clearwater Revival", anio: 1969, nivel: 2, bpm: 90, rasgueo: "rock8", tip: "D, A y G con rasgueo de country-rock.", secuencias: [{ nombre: "estrofa", acordes: "D A G D" }] },
  { titulo: "Heart of Gold", artista: "Neil Young", anio: 1972, nivel: 1, bpm: 85, rasgueo: "pop", tip: "Acústica y sencilla: Em, C, D y G.", secuencias: [{ nombre: "estrofa", acordes: "Em C D G" }] },
  { titulo: "Take Me Home, Country Roads", artista: "John Denver", anio: 1971, nivel: 1, bpm: 82, rasgueo: "country", tip: "La de fogata por excelencia.", secuencias: [{ nombre: "coro", acordes: "G D Em C G D C G" }] },
  // Fáciles: dos a cuatro acordes abiertos
  { titulo: "Love Me Do", artista: "The Beatles", anio: 1962, nivel: 1, bpm: 148, rasgueo: "rock8", tip: "Solo G y C en la estrofa: ideal para tus primeros cambios.", secuencias: [{ nombre: "estrofa", acordes: "G C G C G C G G" }] },
  { titulo: "Blowin' in the Wind", artista: "Bob Dylan", anio: 1963, nivel: 1, bpm: 88, rasgueo: "pop", tip: "G, C y D a ritmo tranquilo.", secuencias: [{ nombre: "estrofa", acordes: "G C D G G C G G" }] },
  { titulo: "Leaving on a Jet Plane", artista: "John Denver", anio: 1969, nivel: 1, bpm: 86, rasgueo: "pop", tip: "G, C y D con rasgueo suave de folk.", secuencias: [{ nombre: "estrofa", acordes: "G C G C G C D D" }] },
  { titulo: "Perfect", artista: "Ed Sheeran", anio: 2017, nivel: 1, bpm: 63, rasgueo: "balada", tip: "G, Em, C y D, lenta. La original usa capo en el traste 1.", secuencias: [{ nombre: "estrofa", acordes: "G Em C D" }] },
  { titulo: "Hallelujah", artista: "Leonard Cohen", anio: 1984, nivel: 2, bpm: 56, rasgueo: "balada", tip: "C, Am, F (mini) y G. Lenta, para afianzar el F.", secuencias: [{ nombre: "estrofa", acordes: "C Am C Am F (mini) G C G" }] },
  { titulo: "Imagine", artista: "John Lennon", anio: 1971, nivel: 2, bpm: 75, rasgueo: "balada", tip: "Versión simplificada: C y F en lugar de C, Cmaj7 y F.", secuencias: [{ nombre: "estrofa (simplificada)", acordes: "C F (mini) C F (mini)" }] },
  // Intermedias: cejillas, séptimas y rasgueos con más trabajo
  { titulo: "Despacito", artista: "Luis Fonsi ft. Daddy Yankee", anio: 2017, nivel: 5, bpm: 89, rasgueo: "pop", tip: "Bm, G, D y A toda la canción: excelente para dominar Bm.", secuencias: [{ nombre: "toda la canción", acordes: "Bm G D A" }] },
  { titulo: "Someone Like You", artista: "Adele", anio: 2011, nivel: 5, bpm: 67, rasgueo: "balada", tip: "A, E, F#m y D. En la grabación es piano arpegiado; aquí, rasgueo lento.", secuencias: [{ nombre: "estrofa", acordes: "A E F#m D" }] },
  { titulo: "Californication", artista: "Red Hot Chili Peppers", anio: 1999, nivel: 5, bpm: 96, rasgueo: "rock8", tip: "La estrofa es Am y F con cejilla; el coro cambia a C, G, Dm y Am.", secuencias: [{ nombre: "estrofa", acordes: "Am:8 F:8" }, { nombre: "coro", acordes: "C G Dm Am" }] },
  { titulo: "More Than Words", artista: "Extreme", anio: 1990, nivel: 4, bpm: 92, rasgueo: "funk2", tip: "Rasgueo percusivo con golpes apagados: ideal después de Funk 2.", secuencias: [{ nombre: "estrofa (simplificada)", acordes: "G Cadd9 Am7 C D Dsus4" }] },
  { titulo: "Hey There Delilah", artista: "Plain White T's", anio: 2006, nivel: 5, bpm: 104, rasgueo: "pop", tip: "D y F#m se alternan; luego Bm, G y A.", secuencias: [{ nombre: "estrofa", acordes: "D F#m D F#m Bm G A Bm" }] },
  // Country clásico y moderno
  { titulo: "Folsom Prison Blues", artista: "Johnny Cash", anio: 1955, nivel: 2, bpm: 104, rasgueo: "boomchicka", tip: "El ritmo de tren: bajo y golpe. E, A y B7.", secuencias: [{ nombre: "estrofa", acordes: "E:8 A:4 E:4 B7:4 E:4" }] },
  { titulo: "Ring of Fire", artista: "Johnny Cash", anio: 1963, nivel: 1, bpm: 105, rasgueo: "country", tip: "G, C y D con bajo y rasgueo.", secuencias: [{ nombre: "estrofa (simplificada)", acordes: "G C G G D G" }] },
  { titulo: "Jambalaya (On the Bayou)", artista: "Hank Williams", anio: 1952, nivel: 2, bpm: 100, rasgueo: "country", tip: "Solo dos acordes: C y G7. Perfecta para soltar el bajo y rasgueo.", secuencias: [{ nombre: "toda la canción", acordes: "C:8 G7:8 G7:8 C:8" }] },
  { titulo: "Jolene", artista: "Dolly Parton", anio: 1973, nivel: 2, bpm: 110, rasgueo: "pop", tip: "Am, C, G y Em. En la grabación es un arpegio rápido; aquí, rasgueado.", secuencias: [{ nombre: "estrofa", acordes: "Am C G Am G Em Am Am" }] },
  { titulo: "Achy Breaky Heart", artista: "Billy Ray Cyrus", anio: 1992, nivel: 2, bpm: 120, rasgueo: "country", tip: "A y E toda la canción.", secuencias: [{ nombre: "estrofa", acordes: "A:8 E:8 E:8 A:8" }] },
  { titulo: "Wagon Wheel", artista: "Old Crow Medicine Show", anio: 2004, nivel: 1, bpm: 76, rasgueo: "country", tip: "G, D, Em y C: la de fogata del country moderno.", secuencias: [{ nombre: "toda la canción", acordes: "G D Em C G D C C" }] },
  { titulo: "Tennessee Whiskey", artista: "Chris Stapleton", anio: 2015, nivel: 5, bpm: 48, rasgueo: "balada", tip: "Solo A y Bm, muy lento y con sentimiento: buena para afianzar Bm.", secuencias: [{ nombre: "toda la canción", acordes: "A:6 Bm:6" }] },
  { titulo: "Uptown Funk", artista: "Mark Ronson ft. Bruno Mars", anio: 2014, nivel: 2, bpm: 115, rasgueo: "funk2", tip: "Dos acordes con golpes cortos y apagados.", secuencias: [{ nombre: "riff (simplificado)", acordes: "Dm7 G7" }] },
  // Tercera tanda: country y americana, pop y rock de los 80 (guitarras con chorus) y rock en español.
  // Progresiones revisadas contra hojas de acordes públicas; las marcadas "simplificada" cambian algún acorde por uno más fácil.
  { titulo: "Jersey Giant", artista: "Tyler Childers", anio: 2017, nivel: 1, bpm: 80, rasgueo: "country", cat: "country", tip: "G, D, Am y C toda la canción; el puente pasa por A.", secuencias: [{ nombre: "estrofa", acordes: "G D Am C" }, { nombre: "puente", acordes: "A C A D" }] },
  { titulo: "Shake the Frost", artista: "Tyler Childers", anio: 2017, nivel: 2, bpm: 82, rasgueo: "balada", cat: "country", tip: "Capo en el traste 2, con formas de Am, C, G y F (mini). La original usa bajos que caminan entre acordes.", secuencias: [{ nombre: "estrofa", acordes: "Am:4 C:4 G:4 F (mini):2 C:2" }, { nombre: "coro", acordes: "F (mini) G C G Am C G C" }] },
  { titulo: "Feathered Indians", artista: "Tyler Childers", anio: 2017, nivel: 2, bpm: 120, rasgueo: "country", cat: "country", tip: "D, A y G en la estrofa; el coro mete Bm (usa la versión parcial si aún no tienes la cejilla).", secuencias: [{ nombre: "estrofa", acordes: "D A G G" }, { nombre: "coro", acordes: "G Bm A G" }] },
  { titulo: "Broken Window Serenade", artista: "Whiskey Myers", anio: 2011, nivel: 1, bpm: 70, rasgueo: "balada", cat: "country", tip: "Solo Cadd9 y Em: los dedos 3 y 4 se quedan fijos en la 1ª y 2ª cuerda.", secuencias: [{ nombre: "toda la canción", acordes: "Cadd9:4 Em:4" }] },
  { titulo: "Stone", artista: "Whiskey Myers", anio: 2016, nivel: 2, bpm: 72, rasgueo: "balada", cat: "country", tip: "Am, F y C en la estrofa; el coro suma G. Usa F (mini).", secuencias: [{ nombre: "estrofa", acordes: "Am F (mini) C C" }, { nombre: "coro", acordes: "F (mini) C G Am" }] },
  { titulo: "Something in the Orange", artista: "Zach Bryan", anio: 2022, nivel: 1, bpm: 64, rasgueo: "balada", cat: "country", tip: "Em, G, D y Cadd9. En la grabación el D es D/F#: bajo en la 6ª cuerda, traste 2.", secuencias: [{ nombre: "estrofa", acordes: "Em G D Em" }, { nombre: "coro", acordes: "Cadd9 G D Em" }] },
  { titulo: "Cover Me Up", artista: "Jason Isbell", anio: 2013, nivel: 5, bpm: 70, rasgueo: "balada", cat: "country", tip: "E y A con C#m y F#m (cejilla) en las frases que suben.", secuencias: [{ nombre: "estrofa", acordes: "E A E E C#m A E E" }, { nombre: "coro", acordes: "E A E E F#m A C#m E" }] },
  { titulo: "Boot Scootin' Boogie", artista: "Brooks & Dunn", anio: 1992, nivel: 2, bpm: 140, rasgueo: "shuffle", cat: "country", tip: "Shuffle de honky-tonk en E con A y B; el G es un paso rápido de regreso a E.", secuencias: [{ nombre: "estrofa (aprox.)", acordes: "E:8 A:4 E:4 B:2 A:2 G:2 E:2" }] },
  { titulo: "Neon Moon", artista: "Brooks & Dunn", anio: 1992, nivel: 2, bpm: 100, rasgueo: "country", cat: "country", tip: "A, D y E7: balada de honky-tonk para soltar el rasgueo.", secuencias: [{ nombre: "estrofa", acordes: "A D A D A E7 A A" }, { nombre: "coro", acordes: "D E D E D E A A" }] },
  { titulo: "Friends in Low Places", artista: "Garth Brooks", anio: 1990, nivel: 5, bpm: 80, rasgueo: "country", cat: "country", tip: "Versión simplificada del coro, sin el acorde disminuido: A, Bm y E.", secuencias: [{ nombre: "coro (simplificado)", acordes: "A:8 Bm:4 E:4 A:4 A7:4 Bm:4 E:4" }] },
  { titulo: "Chattahoochee", artista: "Alan Jackson", anio: 1993, nivel: 2, bpm: 112, rasgueo: "boomchicka", cat: "country", tip: "C y G con bajo y rasgueo; el pre-coro pasa por F (mini) y D.", secuencias: [{ nombre: "pre-coro", acordes: "F (mini) C G C F (mini) D G G" }, { nombre: "coro", acordes: "C G C G C:8" }] },
  { titulo: "Amarillo by Morning", artista: "George Strait", anio: 1982, nivel: 5, bpm: 90, cat: "country", tip: "Vals en 3/4: cuenta 1-2-3 por acorde. Lleva F#m con cejilla.", secuencias: [{ nombre: "estrofa", acordes: "D:3 F#m:3 G:3 D:3 F#m:3 G:3 A7:6" }] },
  { titulo: "Sex on Fire", artista: "Kings of Leon", anio: 2008, nivel: 5, bpm: 153, rasgueo: "rock8", cat: "alt", tip: "E y C#m (cejilla) en corcheas; el coro agrega A.", secuencias: [{ nombre: "estrofa", acordes: "E:8 C#m:8" }, { nombre: "coro", acordes: "E C#m A A" }] },
  { titulo: "Use Somebody", artista: "Kings of Leon", anio: 2008, nivel: 3, bpm: 137, rasgueo: "rock8", cat: "alt", tip: "Power chords C5, E5, F5 y A5 en corcheas parejas.", secuencias: [{ nombre: "toda la canción", acordes: "C5 E5 F5 A5" }] },
  { titulo: "Time After Time", artista: "Cyndi Lauper", anio: 1984, nivel: 2, bpm: 130, rasgueo: "balada", cat: "rock80", tip: "Usa F (mini). En la grabación la guitarra arpegia con chorus; tócala suave.", secuencias: [{ nombre: "intro", acordes: "F (mini) G Em F (mini)" }, { nombre: "coro", acordes: "G Am F (mini) G C:8" }] },
  { titulo: "Just Like Heaven", artista: "The Cure", anio: 1987, nivel: 5, bpm: 150, rasgueo: "pop", cat: "rock80", tip: "A, E, Bm y D; el riff con chorus va encima de estos acordes.", secuencias: [{ nombre: "estrofa", acordes: "A E Bm D" }, { nombre: "coro", acordes: "F#m G F#m G D E" }] },
  { titulo: "Boys Don't Cry", artista: "The Cure", anio: 1979, nivel: 5, bpm: 160, rasgueo: "rock8", cat: "rock80", tip: "A, Bm, C#m y D subiendo por el mástil, y de regreso.", secuencias: [{ nombre: "estrofa", acordes: "A Bm C#m D" }, { nombre: "coro", acordes: "D C#m Bm A" }] },
  { titulo: "Friday I'm in Love", artista: "The Cure", anio: 1992, nivel: 5, bpm: 136, rasgueo: "pop", cat: "rock80", tip: "La grabación está medio tono abajo; en afinación estándar suena medio tono más agudo.", secuencias: [{ nombre: "estrofa", acordes: "D G D A Bm G D A" }, { nombre: "coro", acordes: "G A Bm G D A" }] },
  { titulo: "Down Under", artista: "Men at Work", anio: 1981, nivel: 5, bpm: 108, rasgueo: "ska", cat: "rock80", tip: "Bm, A y G con el golpe a contratiempo.", secuencias: [{ nombre: "estrofa", acordes: "Bm A Bm G A" }, { nombre: "coro", acordes: "D A Bm G A" }] },
  { titulo: "Don't Dream It's Over", artista: "Crowded House", anio: 1986, nivel: 5, bpm: 82, rasgueo: "balada", cat: "rock80", tip: "Capo en el traste 1. Simplificada: D en lugar de D9.", secuencias: [{ nombre: "estrofa (simplificada)", acordes: "D Bm G F#" }, { nombre: "coro", acordes: "G A D Bm" }] },
  { titulo: "There Is a Light That Never Goes Out", artista: "The Smiths", anio: 1986, nivel: 2, bpm: 135, rasgueo: "pop", cat: "rock80", tip: "Am, F, C y G con F (mini). El original lleva Am/G (bajo en G).", secuencias: [{ nombre: "estrofa (simplificada)", acordes: "Am F (mini) C G" }, { nombre: "coro", acordes: "C Am F (mini) G" }] },
  { titulo: "Never Tear Us Apart", artista: "INXS", anio: 1987, nivel: 2, bpm: 98, rasgueo: "balada", cat: "rock80", tip: "Lenta, en 6/8: Am, F (mini), Dm y Em.", secuencias: [{ nombre: "estrofa", acordes: "Am F (mini) Dm F (mini)" }, { nombre: "coro", acordes: "C F (mini) C F (mini) G" }] },
  { titulo: "Don't You (Forget About Me)", artista: "Simple Minds", anio: 1985, nivel: 2, bpm: 112, rasgueo: "rock8", cat: "rock80", tip: "E, D y A toda la canción.", secuencias: [{ nombre: "toda la canción", acordes: "E D A D" }] },
  { titulo: "Sunday Bloody Sunday", artista: "U2", anio: 1983, nivel: 5, bpm: 102, rasgueo: "rock8", cat: "rock80", tip: "Bm, D y G (en la grabación, G6). The Edge arpegia con eco.", secuencias: [{ nombre: "estrofa", acordes: "Bm D G G" }] },
  { titulo: "Lucha de gigantes", artista: "Nacha Pop", anio: 1987, nivel: 5, bpm: 125, rasgueo: "pop", cat: "espanol", tip: "G, A, D y Em; la parte central agrega Bm y F#m.", secuencias: [{ nombre: "estrofa", acordes: "G A D Em" }, { nombre: "parte central", acordes: "Bm F#m G F#m Em" }] },
  { titulo: "De música ligera", artista: "Soda Stereo", anio: 1990, nivel: 5, bpm: 130, rasgueo: "rock8", cat: "espanol", tip: "Bm, G, D y A toda la canción: guitarra con chorus al estilo Cerati.", secuencias: [{ nombre: "toda la canción", acordes: "Bm G D A" }] },
  { titulo: "Persiana americana", artista: "Soda Stereo", anio: 1986, nivel: 5, bpm: 120, rasgueo: "rock8", cat: "espanol", tip: "Estrofa con D, G, C y Bm.", secuencias: [{ nombre: "estrofa", acordes: "D G D G C Bm" }] },
  { titulo: "Lamento boliviano", artista: "Enanitos Verdes", anio: 1994, nivel: 5, bpm: 95, rasgueo: "pop", cat: "espanol", tip: "Em, Bm, Am y B7.", secuencias: [{ nombre: "estrofa", acordes: "Em Bm Am Em" }, { nombre: "coro", acordes: "Em Bm Am Am Em B7" }] },
  { titulo: "Devuélveme a mi chica", artista: "Hombres G", anio: 1985, nivel: 5, bpm: 150, rasgueo: "rock8", cat: "espanol", tip: "Estrofa en Am y Dm; el coro sube con Bb y F con cejilla.", secuencias: [{ nombre: "estrofa (simplificada)", acordes: "Am Dm Am Dm" }, { nombre: "coro", acordes: "Bb F Bb F Bb F G A" }] },
  { titulo: "Tren al sur", artista: "Los Prisioneros", anio: 1990, nivel: 2, bpm: 125, rasgueo: "rock8", cat: "espanol", tip: "Am y F casi toda la canción; usa F (mini).", secuencias: [{ nombre: "estrofa", acordes: "Am F (mini)" }, { nombre: "segunda parte", acordes: "G C Am Em F (mini) G" }] },
  { titulo: "Entre dos tierras", artista: "Héroes del Silencio", anio: 1990, nivel: 5, bpm: 120, rasgueo: "rock8", cat: "espanol", tip: "Bm, F#m, Em y G; el estribillo cambia a D.", secuencias: [{ nombre: "estrofa", acordes: "Bm F#m Em G" }, { nombre: "estribillo", acordes: "Bm D G Bm" }] },
  { titulo: "La célula que explota", artista: "Caifanes", anio: 1990, nivel: 5, bpm: 90, rasgueo: "pop", cat: "espanol", tip: "F#m, G, A y Bm.", secuencias: [{ nombre: "estrofa", acordes: "F#m G F#m G A Bm A Bm" }] },
  // Cuarta tanda
  { titulo: "Lady May", artista: "Tyler Childers", anio: 2017, nivel: 2, bpm: 72, rasgueo: "balada", cat: "country", tip: "Simplificada: C, F (mini) y Am. La original usa C/G (bajo en la 6ª cuerda, traste 3).", secuencias: [{ nombre: "estrofa (simplificada)", acordes: "C F (mini) C F (mini) C Am C C" }] },
  { titulo: "Nose on the Grindstone", artista: "Tyler Childers", anio: 2017, nivel: 2, bpm: 76, rasgueo: "balada", cat: "country", tip: "Dm, F, C y G; usa F (mini).", secuencias: [{ nombre: "estrofa", acordes: "Dm F (mini) C G" }, { nombre: "coro", acordes: "F (mini) C G Dm" }] },
  { titulo: "Follow You to Virgie", artista: "Tyler Childers", anio: 2019, nivel: 1, bpm: 92, rasgueo: "country", tip: "G y C casi toda la canción; D y D7 cierran el coro.", secuencias: [{ nombre: "estrofa", acordes: "G C G C" }, { nombre: "coro", acordes: "G C G C G C D D7" }] },
  { titulo: "Heading South", artista: "Zach Bryan", anio: 2019, nivel: 2, bpm: 84, rasgueo: "pop", cat: "country", tip: "Am, F (mini), C y G toda la canción, con mucha fuerza en el rasgueo.", secuencias: [{ nombre: "toda la canción", acordes: "Am F (mini) C G" }] },
  { titulo: "My Maria", artista: "Brooks & Dunn", anio: 1996, nivel: 1, bpm: 124, rasgueo: "rock8", cat: "country", tip: "D, A y G con bajos que caminan entre acordes.", secuencias: [{ nombre: "estrofa", acordes: "D A G G" }] },
  { titulo: "The Dance", artista: "Garth Brooks", anio: 1990, nivel: 5, bpm: 66, rasgueo: "balada", cat: "country", tip: "G, C, D y Em en la estrofa; el coro mete Bm. Simplificada: Bm en lugar de Bm7.", secuencias: [{ nombre: "estrofa", acordes: "G C G C C D G D" }, { nombre: "coro (simplificado)", acordes: "C D Bm C D G" }] },
  { titulo: "Remember When", artista: "Alan Jackson", anio: 2003, nivel: 1, bpm: 70, rasgueo: "balada", cat: "country", tip: "G, Em7, Cadd9 y D: formas que comparten dedos.", secuencias: [{ nombre: "estrofa", acordes: "G Em7 Cadd9 D" }] },
  { titulo: "Fast Car", artista: "Luke Combs", anio: 2023, nivel: 1, bpm: 104, rasgueo: "pop", cat: "country", tip: "Versión de Tracy Chapman. Simplificada: C en lugar de Cmaj7. El riff original es un arpegio.", secuencias: [{ nombre: "estrofa (simplificada)", acordes: "C G Em D" }, { nombre: "coro", acordes: "D C G Em D C Em D" }] },
  { titulo: "Starting Over", artista: "Chris Stapleton", anio: 2020, nivel: 1, bpm: 92, rasgueo: "country", tip: "G, C y D en la estrofa; el coro pasa por Em.", secuencias: [{ nombre: "estrofa", acordes: "G C D C" }, { nombre: "coro", acordes: "Em D G C D G D G" }] },
  { titulo: "Ballad of a Southern Man", artista: "Whiskey Myers", anio: 2008, nivel: 1, bpm: 80, rasgueo: "balada", cat: "country", tip: "G, D, C y Em: acordes abiertos con aire sureño.", secuencias: [{ nombre: "estrofa", acordes: "G D C G Em D C G" }] },
  { titulo: "Under the Milky Way", artista: "The Church", anio: 1988, nivel: 2, bpm: 80, rasgueo: "balada", cat: "rock80", tip: "Simplificada: Am, F (mini) y G en lugar de Am7sus4 y Fmaj7. Guitarra de 12 cuerdas con chorus en la grabación.", secuencias: [{ nombre: "estrofa (simplificada)", acordes: "Am Am F (mini) G" }, { nombre: "coro", acordes: "G F (mini) G F (mini)" }] },
  { titulo: "Everybody Wants to Rule the World", artista: "Tears for Fears", anio: 1985, nivel: 5, bpm: 112, rasgueo: "pop", cat: "rock80", tip: "Simplificada: D y G en lugar de Dmaj7 y G/D. El coro sube con Em, F#m, G y A.", secuencias: [{ nombre: "estrofa (simplificada)", acordes: "D G D G" }, { nombre: "coro", acordes: "Em F#m G A" }] },
  { titulo: "I Still Haven't Found What I'm Looking For", artista: "U2", anio: 1987, nivel: 1, bpm: 101, rasgueo: "pop", cat: "rock80", tip: "Capo en el traste 2. G y Cadd9 en la estrofa; D, Cadd9 y G en el coro.", secuencias: [{ nombre: "estrofa", acordes: "G:8 Cadd9:4 G:4" }, { nombre: "coro", acordes: "D Cadd9 G G" }] },
  { titulo: "Where the Streets Have No Name", artista: "U2", anio: 1987, nivel: 5, bpm: 126, rasgueo: "rapido", cat: "rock80", tip: "D, G, Bm y A; la guitarra de The Edge es un arpegio con eco.", secuencias: [{ nombre: "intro", acordes: "D G D G Bm A" }, { nombre: "coro", acordes: "D D G G Bm A D D" }] },
  { titulo: "Pictures of You", artista: "The Cure", anio: 1989, nivel: 5, bpm: 128, rasgueo: "pop", cat: "rock80", tip: "D, A, Bm y G: la progresión de casi toda la canción.", secuencias: [{ nombre: "estrofa", acordes: "D A Bm G A D" }] },
  { titulo: "Jessie's Girl", artista: "Rick Springfield", anio: 1981, nivel: 5, bpm: 132, rasgueo: "rock8", cat: "rock80", tip: "A y D en la estrofa; el coro alterna E y D y cierra con Bm.", secuencias: [{ nombre: "estrofa", acordes: "A D A D" }, { nombre: "coro (simplificado)", acordes: "E D E D E D Bm A" }] },
  { titulo: "Africa", artista: "Toto", anio: 1982, nivel: 5, bpm: 93, rasgueo: "pop", cat: "rock80", tip: "El coro: F#m, D, A y E. La estrofa original es más compleja.", secuencias: [{ nombre: "coro", acordes: "F#m D A E" }] },
  { titulo: "Cuando pase el temblor", artista: "Soda Stereo", anio: 1985, nivel: 2, bpm: 110, rasgueo: "pop", cat: "espanol", tip: "Am, G, F (mini) y Em bajando.", secuencias: [{ nombre: "intro y estrofa", acordes: "Am G F (mini) Em" }] },
  { titulo: "En la ciudad de la furia", artista: "Soda Stereo", anio: 1988, nivel: 5, bpm: 96, rasgueo: "rock8", cat: "espanol", tip: "Bm, Em y E; el coro usa F# (en la grabación, F#7).", secuencias: [{ nombre: "estrofa", acordes: "Bm Em E E" }, { nombre: "coro (simplificado)", acordes: "Bm Em F# F# G A Bm Bm" }] },
  { titulo: "Venezia", artista: "Hombres G", anio: 1985, nivel: 1, bpm: 150, rasgueo: "rock8", cat: "espanol", tip: "Em, G y D; el estribillo pasa por Am y C.", secuencias: [{ nombre: "estrofa", acordes: "Em G D Em" }, { nombre: "estribillo", acordes: "G D Am C" }] },
  { titulo: "En algún lugar", artista: "Duncan Dhu", anio: 1987, nivel: 2, bpm: 140, rasgueo: "pop", cat: "espanol", tip: "G, Em, C y D; el coro agrega F (mini) y Dsus4.", secuencias: [{ nombre: "estrofa", acordes: "G Em C D" }, { nombre: "coro", acordes: "C D C D G Em C F (mini) Dsus4 D" }] },
  { titulo: "Déjame", artista: "Los Secretos", anio: 1981, nivel: 5, bpm: 150, rasgueo: "rock8", cat: "espanol", tip: "Dm, Am, Bb, F y C; el coro cambia a D, F#m, G y A (en la grabación, F#m7).", secuencias: [{ nombre: "estrofa", acordes: "Dm Am Bb F C" }, { nombre: "coro (simplificado)", acordes: "D F#m G A" }] },
  { titulo: "La chispa adecuada", artista: "Héroes del Silencio", anio: 1993, nivel: 5, bpm: 76, rasgueo: "balada", cat: "espanol", tip: "En Dm, con Gm y Bb (cejilla) y A7.", secuencias: [{ nombre: "estrofa", acordes: "Dm Gm Dm Gm F A7 Dm C Bb A7" }, { nombre: "estribillo", acordes: "Dm Am Dm Am Bb Dm Gm Dm" }] },
];
// Categorías y dificultad para ordenar el repertorio
export const CATS = {
  rock80: "Pop y rock de los 80", espanol: "Rock en español", country: "Country y americana", metal: "Hard rock y metal",
  clasico: "Rock clásico", alt: "Alternativo, grunge e indie", pop: "Pop y baladas", folk: "Folk y fogata", reggae: "Reggae y funk", otras: "Otras",
};
const CAT_OF = {
  metal: ["Every Rose Has Its Thorn", "Here I Go Again", "Patience", "Breaking the Law", "Back in Black", "Livin' on a Prayer", "Seek & Destroy", "Sweet Child O' Mine", "Knockin' on Heaven's Door", "Paranoid", "Iron Man"],
  rock80: ["Summer of '69", "Every Breath You Take", "Don't Stop Believin'", "With or Without You", "I Love Rock 'n' Roll", "Should I Stay or Should I Go", "Rockin' in the Free World"],
  clasico: ["Hotel California", "Sweet Home Alabama", "Smoke on the Water", "You Really Got Me", "Wild Thing", "Louie Louie", "La Bamba", "Twist and Shout", "Let It Be", "Love Me Do", "Brown Eyed Girl", "Bad Moon Rising", "Have You Ever Seen the Rain", "Wonderful Tonight", "Imagine", "Stand by Me", "Wish You Were Here"],
  alt: ["Zombie", "Creep", "Wonderwall", "Boulevard of Broken Dreams", "Good Riddance (Time of Your Life)", "Smells Like Teen Spirit", "Losing My Religion", "Californication", "More Than Words"],
  pop: ["Perfect", "Someone Like You", "Despacito", "Hey There Delilah", "Riptide"],
  folk: ["Blowin' in the Wind", "Leaving on a Jet Plane", "Heart of Gold", "Hallelujah"],
  country: ["Follow You to Virgie", "Starting Over", "Folsom Prison Blues", "Ring of Fire", "Jambalaya (On the Bayou)", "Jolene", "Achy Breaky Heart", "Wagon Wheel", "Tennessee Whiskey", "Take Me Home, Country Roads"],
  reggae: ["No Woman, No Cry", "Get Lucky", "Uptown Funk"],
};
LIBRARY.forEach(L => { if (!L.cat) L.cat = Object.keys(CAT_OF).find(k => CAT_OF[k].includes(L.titulo)) || "otras"; });
// Dificultad a partir del nivel del camino: 1–2 fácil (acordes abiertos), 3–4 intermedia (power chords, arpegios), 5 avanzada (cejilla)
export const difficulty = nivel => (nivel || 1) <= 2 ? "facil" : nivel <= 4 ? "intermedia" : "avanzada";
export const DIFF = { facil: "Fácil", intermedia: "Intermedia", avanzada: "Avanzada" };
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
      song = { id: "b" + i, titulo: L.titulo, artista: L.artista, nivel: L.nivel, bpmMeta: L.bpm, tip: L.tip, cat: L.cat, estado: "pendiente", notas: "" };
      data.canciones.push(song); changed = true;
    }
    if (!data.agregado.canciones.includes(L.titulo)) { data.agregado.canciones.push(L.titulo); changed = true; }
    if (song) {
      if (L.anio && !song.anio) { song.anio = L.anio; changed = true; }
      if (L.rasgueo && !song.rasgueo) { song.rasgueo = L.rasgueo; changed = true; }
      if (L.cat && !song.cat) { song.cat = L.cat; changed = true; }
      if (L.tip && !song.tip) { song.tip = L.tip; changed = true; }
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
