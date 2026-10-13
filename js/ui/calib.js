// Calibración guardada en el dispositivo:
// - Acordes: cómo suena cada acorde con tu guitarra y en tu cuarto (mejora la detección).
// - Ritmo: el retraso de tu micrófono, para que la calificación del rasgueo sea exacta desde el primer golpe.
import { data, save, toast, esc } from "../store.js";
import { CHORDS, diagram } from "../chords.js";
import * as A from "../audio.js";
import { theoTemplate } from "../detect.js";

const wait = ms => new Promise(r => setTimeout(r, ms));
let open = null;

function sheet(title, onClose) {
  close();
  const wrap = document.createElement("div"); wrap.className = "sheet-wrap";
  wrap.innerHTML = `<div class="sheet screen" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Cerrar">✕</button></div>
    <div class="sheet-body"></div></div>`;
  document.body.appendChild(wrap);
  const doClose = () => { onClose?.(); wrap.remove(); open = null; document.removeEventListener("keydown", esc_); };
  const esc_ = e => { if (e.key === "Escape") doClose(); };
  wrap.addEventListener("click", e => { if (e.target === wrap || e.target.closest("[data-close]")) doClose(); });
  document.addEventListener("keydown", esc_);
  open = { wrap, close: doClose, cancelled: false };
  setTimeout(() => wrap.querySelector("[data-close]").focus(), 30);
  return { body: wrap.querySelector(".sheet-body"), state: open };
}
export function close() { if (open) open.close(); }

async function ensureMic(say) {
  if (A.mic.an) return true;
  say("Silencia las cuerdas con la mano un segundo mientras mido el ruido del cuarto…");
  const ok = await A.micOn();
  if (!ok) say(A.mic.error);
  return ok;
}

/* ---------- Acordes ---------- */
export function openChordCalibration(chords, { title = "Calibrar acordes", onDone } = {}) {
  chords = [...new Set(chords)].filter(c => CHORDS[c]);
  const { body, state } = sheet(title, onDone);
  const render = (busy) => {
    const pending = chords.filter(c => !data.calibracion[c]);
    body.innerHTML = `
      <p class="sheet-lead">Rasguea cada acorde durante 4 segundos, con tu guitarra y donde sueles practicar. La app aprende cómo suena y lo distingue mejor de los demás. Se guarda en este dispositivo.</p>
      <div class="cal-stage" id="calStage" hidden>
        <div class="cal-chord"><span class="cal-name" id="calName"></span><span id="calDiag"></span></div>
        <div class="cal-info"><span class="cal-say" id="calSay"></span>
          <div class="bar lvlbar"><div id="calLvl" class="lvl"></div><i id="calGate"></i></div>
          <div class="bar"><div id="calProg"></div></div></div>
      </div>
      <ul class="cal-list">${chords.map(c => `<li>
        <span class="cal-c">${esc(c)}</span>
        <span class="chip ${data.calibracion[c] ? "good" : ""}">${data.calibracion[c] ? "Calibrado" : "Sin calibrar"}</span>
        <span class="row" style="gap:6px;margin-left:auto">
          <button class="btn small" data-cal="${esc(c)}" ${busy ? "disabled" : ""}>${data.calibracion[c] ? "Repetir" : "Calibrar"}</button>
          ${data.calibracion[c] ? `<button class="btn small ghost" data-del="${esc(c)}" ${busy ? "disabled" : ""}>Borrar</button>` : ""}
        </span></li>`).join("")}</ul>
      <div class="row sheet-foot">
        <button class="btn primary" id="calAll" ${busy || !pending.length ? "disabled" : ""}>${pending.length ? `Calibrar ${pending.length === chords.length ? "todos" : `los ${pending.length} pendientes`}` : "Todo calibrado"}</button>
        <button class="btn" data-close>Listo</button>
      </div>`;
    body.querySelectorAll("[data-cal]").forEach(b => b.onclick = () => run([b.dataset.cal]));
    body.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { delete data.calibracion[b.dataset.del]; save(); render(false); toast(`Calibración de ${b.dataset.del} borrada`); });
    body.querySelector("#calAll").onclick = () => run(chords.filter(c => !data.calibracion[c]));
  };
  const run = async (list) => {
    render(true);
    const st = body.querySelector("#calStage"), say = t => { const s = body.querySelector("#calSay"); if (s) s.textContent = t; };
    st.hidden = false;
    if (!(await ensureMic(say))) { render(false); body.querySelector("#calStage").hidden = false; say(A.mic.error); return; }
    window.dispatchEvent(new Event("riff:stop-audio")); window.dispatchEvent(new Event("riff:stop-seq")); window.dispatchEvent(new Event("riff:stop-rasgueo")); window.dispatchEvent(new Event("riff:stop-cambios"));
    for (const name of list) {
      if (state.cancelled || !open) return;
      body.querySelector("#calName").textContent = name; body.querySelector("#calDiag").innerHTML = diagram(name);
      const prog = body.querySelector("#calProg"); prog.style.width = "0%";
      for (let i = 3; i > 0; i--) { say(`Pon los dedos en ${name}… ${i}`); A.beep(800, .07); await wait(1000); if (!open) return; }
      A.beep(1200, .12); say(`Rasguea ${name} varias veces`);
      const frames = [], t0 = performance.now();
      await new Promise(res => {
        const iv = setInterval(() => {
          if (!open) { clearInterval(iv); res(); return; }
          const fr = A.chroma(); if (fr.on) frames.push(fr.chroma);
          const lvl = body.querySelector("#calLvl"), gate = body.querySelector("#calGate");
          if (lvl) { lvl.style.width = A.meterPos(fr.rms) * 100 + "%"; lvl.classList.toggle("win", fr.on); gate.style.left = A.meterPos(A.gate()) * 100 + "%"; }
          const p = (performance.now() - t0) / 4000; prog.style.width = Math.min(100, p * 100) + "%";
          if (p >= 1) { clearInterval(iv); res(); }
        }, 50);
      });
      if (!open) return;
      if (frames.length < 8) { A.beep(300, .2); say(`No escuché bien ${name}: la barra de volumen casi no pasó la línea. Acerca el micrófono o sube la sensibilidad en Cambios.`); await wait(2600); continue; }
      const avg = new Array(12).fill(0); frames.forEach(c => c.forEach((x, i) => avg[i] += x));
      const tpl = A.norm(avg);
      // Aviso si el resultado se parece demasiado a otro acorde de la lista (quizá se tocó el acorde equivocado)
      const own = A.cosSim(tpl, theoTemplate(name));
      const twin = chords.find(o => o !== name && A.cosSim(tpl, theoTemplate(o)) > own + .02);
      data.calibracion[name] = tpl; save(); A.chime();
      say(twin ? `${name} guardado, pero sonó muy parecido a ${twin}. Si te equivocaste de acorde, repítelo.` : `${name} guardado.`);
      await wait(twin ? 2600 : 1100);
    }
    if (open) { render(false); }
  };
  render(false);
}

/* ---------- Ritmo: retraso del micrófono ---------- */
export function openRhythmCalibration({ onDone } = {}) {
  const { body } = sheet("Calibrar ritmo", onDone);
  const BPM = 80, N = 8, IN = 4;
  const render = (msg) => {
    const L = data.ajustes.latenciaMic;
    body.innerHTML = `
      <p class="sheet-lead">Cada micrófono tarda un poco en entregar el sonido. Para medirlo, toca un golpe hacia abajo justo con cada clic: primero escucharás 4 de entrada y luego 8 para tocar.</p>
      <div class="rc-dots" id="rcDots">${Array.from({ length: N }, () => `<i></i>`).join("")}</div>
      <p class="cal-say" id="rcSay" aria-live="polite">${msg || (L != null ? `Retraso guardado: ${Math.round(L * 1000)} ms.` : "Aún no hay medición en este dispositivo.")}</p>
      <div class="row sheet-foot">
        <button class="btn primary" id="rcGo">${L != null ? "Medir otra vez" : "Empezar"}</button>
        ${L != null ? `<button class="btn ghost" id="rcDel">Borrar medición</button>` : ""}
        <button class="btn" data-close>Listo</button>
      </div>`;
    body.querySelector("#rcGo").onclick = go;
    body.querySelector("#rcDel")?.addEventListener("click", () => { delete data.ajustes.latenciaMic; save(); render("Medición borrada."); });
  };
  const go = async () => {
    const say = t => { const s = body.querySelector("#rcSay"); if (s) s.textContent = t; };
    body.querySelector("#rcGo").disabled = true;
    if (!(await ensureMic(say))) { body.querySelector("#rcGo").disabled = false; return; }
    window.dispatchEvent(new Event("riff:stop-audio")); window.dispatchEvent(new Event("riff:stop-seq")); window.dispatchEvent(new Event("riff:stop-rasgueo")); window.dispatchEvent(new Event("riff:stop-cambios"));
    const a = A.ctx(), beat = 60 / BPM, t0 = a.currentTime + .2, clicks = [], onsets = [];
    for (let i = 0; i < IN + N; i++) {
      const t = t0 + i * beat;
      if (i < IN) A.beep(i === 0 ? 1300 : 900, .05, t, .4); else { A.click(true, t); clicks.push(t); }
    }
    A.startOnsets(t => onsets.push(t));
    const dots = [...body.querySelectorAll("#rcDots i")];
    const iv = setInterval(() => {
      const now = A.now();
      if (now < clicks[0]) { say(`Prepárate: ${IN - Math.floor((now - t0) / beat)}`); return; }
      const k = Math.floor((now - clicks[0]) / beat); dots.forEach((d, i) => d.classList.toggle("on", i === k)); say("Toca un golpe con cada clic");
    }, 30);
    await wait((clicks[N - 1] - a.currentTime + .6) * 1000);
    clearInterval(iv); A.stopOnsets(); dots.forEach(d => d.classList.remove("on"));
    if (!open) return;
    // Desfase que alinea más golpes con los clics
    let best = { n: -1, err: Infinity, L: 0 };
    for (let L = -.1; L <= .45; L += .002) {
      let n = 0, err = 0;
      for (const c of clicks) { const d = Math.min(...onsets.map(o => Math.abs(o - (c + L)))); if (d < .09) { n++; err += d; } }
      if (n > best.n || (n === best.n && err < best.err)) best = { n, err, L };
    }
    const offs = clicks.map(c => onsets.map(o => o - c - best.L).sort((x, y) => Math.abs(x) - Math.abs(y))[0]).filter(x => x != null && Math.abs(x) < .09);
    const flags = clicks.map(c => onsets.some(o => Math.abs(o - c - best.L) < .09));
    const paint = () => body.querySelectorAll("#rcDots i").forEach((d, i) => d.classList.add(flags[i] ? "ok" : "miss"));
    if (best.n < 5) { render(`Solo escuché ${Math.max(0, best.n)} de ${N} golpes. Acerca el micrófono, toca un poco más fuerte e intenta otra vez.`); paint(); return; }
    const mean = offs.reduce((s, x) => s + x, 0) / offs.length, sd = Math.sqrt(offs.reduce((s, x) => s + (x - mean) ** 2, 0) / offs.length);
    data.ajustes.latenciaMic = Math.round((best.L + mean) * 1000) / 1000; save(); A.chime();
    render(`Listo: tu micrófono tarda ${Math.round(data.ajustes.latenciaMic * 1000)} ms. Escuché ${best.n} de ${N} golpes, con ±${Math.round(sd * 1000)} ms de variación.`);
    paint();
  };
  render();
}

/* ---------- Ajustes del micrófono (en un solo lugar) ---------- */
export function openMicSettings({ chords = null, rhythm = false, title = "Micrófono", onDone } = {}) {
  const { body } = sheet(title, () => { clearInterval(meter); onDone?.(); });
  let meter = null;
  const ecoMsg = () => data.ajustes.ecoOk === true ? `<span class="chip good">Bocinas probadas: el micrófono no escucha la app</span>`
    : data.ajustes.ecoOk === false ? `<span class="chip bad">El micrófono escucha las bocinas: usa audífonos con el sonido guía</span>` : `<span class="chip">Bocinas sin probar</span>`;
  body.innerHTML = `
    <p class="sheet-lead">Ajustes guardados en este dispositivo. Toca un acorde y mira la barra: debe pasar la línea cuando tocas y quedar debajo en silencio.</p>
    <div class="ms-meter"><span>Volumen</span><div class="bar lvlbar"><div id="msLvl" class="lvl"></div><i id="msGate"></i></div></div>
    <div class="row" style="gap:10px;align-items:flex-end">
      <label class="field" for="msSens" style="flex:1">Sensibilidad<select id="msSens"><option value="alta">Alta (cuarto silencioso)</option><option value="media">Media</option><option value="baja">Baja (cuarto con ruido)</option></select></label>
      <button class="btn small" id="msNoise">Medir ruido</button>
    </div>
    <div class="ms-block">
      <label class="chip-toggle" style="align-self:flex-start"><input type="checkbox" id="msEcho"> Ignorar el sonido de la app (cancelación de eco)</label>
      <p class="note">Si practicas con bocinas, el micrófono puede escuchar el clic y el sonido guía y tomarlos como si fueras tú. La cancelación de eco del navegador los resta, igual que en una videollamada. La prueba toca un rasgueo corto: no toques la guitarra mientras suena.</p>
      <div class="row" style="gap:10px"><button class="btn small" id="msTest">Probar bocinas</button><span id="msEco">${ecoMsg()}</span></div>
    </div>
    ${chords ? `<div class="ms-block"><b>Acordes</b><p class="note">${chords.filter(c => data.calibracion[c]).length} de ${chords.length} calibrados.</p><button class="btn small" id="msCal" style="align-self:flex-start">Calibrar acordes</button></div>` : ""}
    ${rhythm ? `<div class="ms-block"><b>Ritmo</b><p class="note">${data.ajustes.latenciaMic != null ? `Retraso medido: ${Math.round(data.ajustes.latenciaMic * 1000)} ms.` : "Retraso del micrófono sin medir."}</p><button class="btn small" id="msRhythm" style="align-self:flex-start">Calibrar ritmo</button></div>` : ""}
    <div class="row sheet-foot"><button class="btn" data-close>Listo</button></div>`;
  const say = t => { body.querySelector("#msEco").innerHTML = `<span class="chip">${esc(t)}</span>`; };
  const sens = body.querySelector("#msSens"); sens.value = data.ajustes.micSens || "media";
  sens.onchange = () => { data.ajustes.micSens = sens.value; A.setSensitivity(sens.value); save(); };
  const echo = body.querySelector("#msEcho"); echo.checked = data.ajustes.eco !== false;
  echo.onchange = async () => {
    data.ajustes.eco = echo.checked; A.mic.echo = echo.checked; delete data.ajustes.ecoOk; save();
    if (A.mic.an) { say("Reiniciando el micrófono…"); await A.micRestart(); }
    body.querySelector("#msEco").innerHTML = ecoMsg();
  };
  body.querySelector("#msNoise").onclick = async () => { if (!(await ensureMic(say))) return; say("Silencia las cuerdas…"); await A.measureNoise(1200); say("Ruido de fondo medido"); };
  body.querySelector("#msTest").onclick = async e => {
    const b = e.target; b.disabled = true;
    if (!(await ensureMic(say))) { b.disabled = false; return; }
    window.dispatchEvent(new Event("riff:stop-audio")); window.dispatchEvent(new Event("riff:stop-seq")); window.dispatchEvent(new Event("riff:stop-rasgueo")); window.dispatchEvent(new Event("riff:stop-cambios"));
    say("Escuchando la prueba… no toques"); const leak = await A.echoTest(); b.disabled = false;
    if (leak == null) { say("No se pudo hacer la prueba"); return; }
    data.ajustes.ecoOk = leak < .15; save();
    body.querySelector("#msEco").innerHTML = ecoMsg() + (data.ajustes.ecoOk ? "" : `<p class="note" style="margin-top:6px">${echo.checked ? "Aun con la cancelación de eco, el micrófono capta el" : "Activa la cancelación de eco y prueba otra vez. Hoy el micrófono capta el"} ${Math.round(leak * 100)}% de la prueba. Con audífonos se resuelve por completo; si no, desactiva el sonido guía cuando califiques.</p>`);
  };
  body.querySelector("#msCal")?.addEventListener("click", () => openChordCalibration(chords, { onDone }));
  body.querySelector("#msRhythm")?.addEventListener("click", () => openRhythmCalibration({ onDone }));
  meter = setInterval(() => {
    if (!A.mic.an || !body.isConnected) return;
    const fr = A.chroma(), lvl = body.querySelector("#msLvl"), gate = body.querySelector("#msGate");
    if (lvl) { lvl.style.width = A.meterPos(fr.rms) * 100 + "%"; lvl.classList.toggle("win", fr.on); gate.style.left = A.meterPos(A.gate()) * 100 + "%"; }
  }, 60);
  ensureMic(say);
}
// Aviso (una vez por sesión) cuando se califica con sonido guía y las bocinas no están probadas
let guideWarned = false;
export function warnGuideEcho() {
  if (guideWarned || data.ajustes.ecoOk === true) return;
  guideWarned = true;
  toast(data.ajustes.ecoOk === false ? "Ojo: tu micrófono escucha las bocinas. Usa audífonos con el sonido guía." : "Con sonido guía por bocinas, prueba el micrófono (botón Micrófono) o usa audífonos.");
}
