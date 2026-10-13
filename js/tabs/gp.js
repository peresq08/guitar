// Importa archivos de Guitar Pro (.gp, .gp3, .gp4, .gp5, .gpx) y MusicXML con alphaTab
// (https://alphatab.net, licencia MPL-2.0). La biblioteca se descarga solo la primera vez que importas un archivo
// y después queda guardada para usarse sin conexión. El archivo se lee en tu dispositivo: no se sube a ningún lado.
import { stdTuning } from "./texto.js";

export const ALPHATAB = "https://cdn.jsdelivr.net/npm/@coderline/alphatab@1.8.4/dist/alphaTab.core.min.mjs";
let lib = null;
export async function loadAlphaTab(url = ALPHATAB) {
  if (!lib) lib = import(url).then(m => { try { m.Logger.logLevel = m.LogLevel.None; } catch (e) {} return m; }).catch(e => { lib = null; throw e; });
  return lib;
}

export async function readScore(bytes, at) {
  at = at || await loadAlphaTab();
  const settings = new at.Settings();
  try { settings.importer.encoding = "windows-1252"; } catch (e) {}
  return at.importer.ScoreLoader.loadScoreFromBytes(bytes, settings);
}

// Pistas que se pueden practicar (con cuerdas y notas), con un resumen para elegir.
export function listTracks(score) {
  return score.tracks.map((tr, i) => {
    const st = tr.staves[0];
    if (!st || st.isPercussion || !st.tuning || !st.tuning.length) return null;
    let notas = 0;
    for (const bar of st.bars) for (const v of bar.voices) for (const b of v.beats) if (!b.isRest) notas += b.notes.filter(n => !n.isTieDestination).length;
    if (!notas) return null;
    const cuerdas = st.tuning.length;
    const std = stdTuning(cuerdas).every((m, k) => m === st.tuning[k]);
    return { i, nombre: fixText(tr.name) || `Pista ${i + 1}`, cuerdas, notas, afinacion: std ? "Estándar" : (st.tuningName || tuningLabel(st.tuning)), capo: st.capo || 0 };
  }).filter(Boolean);
}
const NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
export const tuningLabel = afin => afin.slice().reverse().map(m => NAMES[((m % 12) + 12) % 12]).join(" ");

// Sugiere la pista de guitarra principal: la primera que dice guitarra/lead/solo (suele ser la del riff).
export function guessTrack(tracks) {
  const g = tracks.filter(t => t.cuerdas >= 6 && /(guit|gtr|lead|solo|riff|guitarra)/i.test(t.nombre));
  return g[0] || tracks.filter(t => t.cuerdas >= 6).sort((a, b) => b.notas - a.notas)[0] || tracks[0];
}

export function trackToTab(score, i) {
  const tr = score.tracks[i], st = tr.staves[0];
  const afin = st.tuning.slice(), cuerdas = afin.length;
  let bpm = score.tempo || 120;
  const compases = score.masterBars.map(mb => {
    const a = mb.tempoAutomations && mb.tempoAutomations.length ? mb.tempoAutomations[mb.tempoAutomations.length - 1].value : null;
    const c = { s: mb.start, n: mb.timeSignatureNumerator, d: mb.timeSignatureDenominator };
    if (mb.section && mb.section.text) c.sec = String(mb.section.text).trim().slice(0, 40);
    if (a && Math.round(a) !== Math.round(bpm)) { c.bpm = Math.round(a); }
    if (a) bpm = a;
    if (mb.isRepeatStart) c.rep = 1;
    if (mb.repeatCount > 1) c.x = mb.repeatCount;
    return c;
  });
  const ev = [];
  st.bars.forEach((bar, bi) => {
    const at = new Map();
    for (const v of bar.voices) for (const b of v.beats) {
      if (b.isRest || !b.notes.length) continue;
      const t = b.absolutePlaybackStart;
      const ns = b.notes.filter(n => !n.isTieDestination && n.fret >= 0).map(n => {
        let fl = "";
        if (n.isHammerPullOrigin) fl += "h";
        if (n.isHammerPullDestination || n.isLeftHandTapped) fl += "H";
        if (n.slideOutType) fl += "/";
        if (n.slideOrigin) fl += "S";
        if (n.hasBend) fl += "b";
        if (n.isDead) fl += "x";
        if (n.isPalmMute) fl += "m";
        if (n.vibrato) fl += "~";
        if (n.harmonicType) fl += "*";
        if (b.graceType) fl += "g";
        const s = cuerdas - n.string;
        return [s, n.fret, n.isDead ? afin[s] : n.realValueWithoutHarmonic ?? n.realValue, fl];
      });
      if (!ns.length) continue;
      const e = at.get(t);
      if (e) { for (const n of ns) if (!e.n.some(x => x[0] === n[0])) e.n.push(n); e.d = Math.max(e.d, b.playbackDuration); }
      else at.set(t, { c: bi, t, d: b.playbackDuration, n: ns });
    }
    [...at.values()].sort((a, b) => a.t - b.t).forEach(e => { e.n.sort((a, b) => a[0] - b[0]); ev.push(e); });
  });
  return {
    fuente: "gp", titulo: score.title || "", artista: score.artist || "", pista: tr.name || `Pista ${i + 1}`,
    afin, cuerdas, capo: st.capo || 0, tempo: Math.round(score.tempo || 120), compases, ev,
    notas: ev.reduce((a, e) => a + e.n.length, 0),
  };
}

// Las demás pistas del archivo, simplificadas para tocarlas como acompañamiento:
// { nombre, tipo: guitarra | bajo | bateria | voz | teclado, vol (0–1), ev: [[tick, duración, [midi…]], …] }
export function tracksForBacking(score) {
  return score.tracks.map((tr, i) => {
    const st = tr.staves[0]; if (!st) return null;
    const prog = tr.playbackInfo?.program ?? 0, name = tr.name || `Pista ${i + 1}`;
    const tipo = st.isPercussion ? "bateria"
      : (prog >= 32 && prog <= 39) || /bass|bajo/i.test(name) ? "bajo"
      : (prog >= 52 && prog <= 54) || (prog >= 80 && prog <= 87) || /voice|voz|vocal|voc\b/i.test(name) ? "voz"
      : prog <= 7 || (prog >= 16 && prog <= 23) ? "teclado" : "guitarra";
    const ev = [];
    for (const bar of st.bars) for (const v of bar.voices) for (const b of v.beats) {
      if (b.isRest || !b.notes.length) continue;
      const ms = b.notes.filter(n => !n.isTieDestination && !(n.isDead && !st.isPercussion)).map(n => n.realValue).filter(m => m > 0 && m < 128);
      if (ms.length) ev.push([b.absolutePlaybackStart, b.playbackDuration, ms]);
    }
    if (!ev.length) return null;
    ev.sort((a, b) => a[0] - b[0]);
    return { i, nombre: name, tipo, vol: Math.max(.2, Math.min(1, (tr.playbackInfo?.volume ?? 13) / 16)), ev };
  }).filter(Boolean);
}

// Algunos archivos guardan los textos en UTF-8 aunque el formato espera Windows-1252; entonces "VIOLÃO" se lee
// "VIOLÃƒO". Si el texto vuelve a armarse como UTF-8 válido, se corrige; si no, se deja igual.
const CP1252 = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F };
export function fixText(s) {
  if (typeof s !== "string" || !/[ÃÂÅÆÐÑ][\u0080-¿Œ-™]/.test(s)) return s;
  const bytes = [];
  for (const ch of s) { const c = ch.codePointAt(0); if (c < 256) bytes.push(c); else if (CP1252[c]) bytes.push(CP1252[c]); else return s; }
  try { return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes)); } catch (e) { return s; }
}
export function fixTabTexts(t) {
  let changed = false;
  const f = v => { const r = fixText(v); if (r !== v) changed = true; return r; };
  t.titulo = f(t.titulo); t.artista = f(t.artista); t.pista = f(t.pista);
  (t.compases || []).forEach(c => { if (c.sec) c.sec = f(c.sec); });
  (t.acomp || []).forEach(x => x.nombre = f(x.nombre));
  return changed;
}
