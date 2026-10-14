// Editor para crear tus propios acordes: tocas los trastes en un diapasón, la app sugiere el nombre y los dedos,
// y al guardarlo queda disponible en toda la app.
import { esc } from "../store.js";
import { CHORDS, diagram } from "../chords.js";
import * as A from "../audio.js";
import { sheet, close as closeSheet } from "./calib.js";
import { nameChord, suggestFingers, noteNames, isValidName, saveCustomChord, deleteCustomChord } from "../customchords.js";

const SNAME = ["6ª", "5ª", "4ª", "3ª", "2ª", "1ª"], OPEN = ["E", "A", "D", "G", "B", "e"];
const FCOL = { 1: "#f2a33a", 2: "#41d184", 3: "#5fb4ff", 4: "#ff7aa8" };

export function openChordEditor({ name = null, onDone } = {}) {
  const src = name && CHORDS[name];
  const st = {
    f: src ? [...src.f].map(String) : ["x", "x", "x", "x", "x", "x"],
    d: src ? [...(src.d || "------")] : ["-", "-", "-", "-", "-", "-"],
    autoD: !src, name: src ? name : "", autoName: !src, start: 1,
  };
  const pressed = st.f.filter(x => x !== "x" && +x > 0).map(Number);
  if (pressed.length && Math.max(...pressed) > 5) st.start = Math.min(...pressed);
  const { body } = sheet(src ? `Editar ${name}` : "Crear acorde", () => onDone?.());
  body.closest(".sheet").classList.add("ced");

  const paint = () => {
    if (st.autoD) st.d = [...suggestFingers(st.f)];
    const nm = nameChord(st.f);
    if (st.autoName) st.name = nm.name.replace("?", "");
    const rows = [0, 1, 2, 3, 4].map(r => st.start + r);
    body.innerHTML = `
      <p class="sheet-lead">Toca el traste de cada cuerda. Toca arriba de una cuerda para alternar entre ✕ (no suena) y ○ (al aire).</p>
      <div class="ced-main">
        <div class="ced-board">
          <div class="ced-pos"><span class="note">Traste inicial</span><button class="icon-btn" data-pos="-1" aria-label="Bajar">−</button><b>${st.start}</b><button class="icon-btn" data-pos="1" aria-label="Subir">+</button></div>
          <div class="ced-grid" role="grid" aria-label="Diapasón">
            ${st.f.map((v, s) => `<button class="ced-top" data-top="${s}" aria-label="Cuerda ${SNAME[s]}: ${v === "x" ? "no suena" : v === "0" ? "al aire" : "traste " + v}">${v === "x" ? "✕" : v === "0" ? "○" : ""}</button>`).join("")}
            ${rows.map(fr => st.f.map((v, s) => {
              const on = v !== "x" && +v === fr, fg = st.d[s];
              return `<button class="ced-cell ${on ? "on" : ""} ${st.start === 1 && fr === 1 ? "nut" : ""}" data-s="${s}" data-fr="${fr}" aria-label="Cuerda ${SNAME[s]}, traste ${fr}">${on ? `<i style="background:${FCOL[fg] || "#eef1f5"}">${/[1-4]/.test(fg) ? fg : ""}</i>` : ""}</button>`;
            }).join("")).join("")}
            ${OPEN.map(n => `<span class="ced-sn">${n}</span>`).join("")}
          </div>
          <div class="ced-frets">${rows.map(fr => `<span>${fr}</span>`).join("")}</div>
        </div>
        <div class="ced-side">
          <label class="field">Nombre<input type="text" id="cedName" value="${esc(st.name)}" maxlength="15" spellcheck="false" autocomplete="off"></label>
          <div class="ced-sugg">${nm.name && !nm.name.endsWith("?") ? `<span class="note">La app lo reconoce como</span> ${[nm.name, ...nm.alts].map(n => `<button class="chip" data-nm="${esc(n)}">${esc(n)}</button>`).join(" ")}` : `<span class="note">Marca al menos dos cuerdas para reconocerlo.</span>`}</div>
          <div class="ced-notes"><span class="note">Notas</span> <b>${noteNames(st.f).join(" · ") || "–"}</b></div>
          <div class="ced-fingers"><span class="note">Dedos</span>${st.f.map((v, s) => v === "x" || v === "0" ? `<span class="ced-fx">${v === "x" ? "✕" : "○"}</span>` : `<button class="ced-fg" data-fg="${s}" style="border-color:${FCOL[st.d[s]] || "var(--line)"}" title="Cambiar dedo de la cuerda ${SNAME[s]}">${/[1-4]/.test(st.d[s]) ? st.d[s] : "·"}</button>`).join("")}
            ${st.autoD ? `<span class="note">automáticos</span>` : `<button class="btn small ghost" id="cedAuto">Sugerir</button>`}</div>
          <p class="note">1 índice · 2 medio · 3 anular · 4 meñique. Toca un número para cambiarlo.</p>
          <p class="ced-err" id="cedErr" role="alert"></p>
          <div class="row" style="gap:8px;flex-wrap:wrap">
            <button class="btn" id="cedPlay">▶ Escuchar</button>
            ${src ? `<button class="btn ghost" id="cedDel">Borrar</button>` : ""}
            <button class="btn primary" id="cedSave" style="margin-left:auto">Guardar acorde</button>
          </div>
        </div>
      </div>`;
    body.querySelectorAll("[data-top]").forEach(b => b.onclick = () => { const s = +b.dataset.top; st.f[s] = st.f[s] === "x" ? "0" : "x"; paint(); });
    body.querySelectorAll("[data-s]").forEach(b => b.onclick = () => {
      const s = +b.dataset.s, fr = +b.dataset.fr;
      st.f[s] = st.f[s] !== "x" && +st.f[s] === fr ? "0" : String(fr);
      A.pluck([40, 45, 50, 55, 59, 64][s] + +st.f[s], 0, .3, 1.2);
      paint();
    });
    body.querySelectorAll("[data-pos]").forEach(b => b.onclick = () => { st.start = Math.max(1, Math.min(15, st.start + +b.dataset.pos)); paint(); });
    body.querySelectorAll("[data-fg]").forEach(b => b.onclick = () => { const s = +b.dataset.fg, cur = +st.d[s] || 0; st.d[s] = String(cur % 4 + 1); st.autoD = false; paint(); });
    body.querySelectorAll("[data-nm]").forEach(b => b.onclick = () => { st.name = b.dataset.nm; st.autoName = false; paint(); });
    const ni = body.querySelector("#cedName");
    ni.oninput = () => { st.name = ni.value.trim(); st.autoName = false; body.querySelector("#cedErr").textContent = ""; };
    body.querySelector("#cedAuto")?.addEventListener("click", () => { st.autoD = true; paint(); });
    body.querySelector("#cedPlay").onclick = () => A.strum(st.f, 0, { vol: .3 });
    body.querySelector("#cedDel")?.addEventListener("click", e => {
      const b = e.currentTarget; if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "¿Seguro? Toca otra vez"; return; }
      deleteCustomChord(name); closeSheet();
    });
    body.querySelector("#cedSave").onclick = () => {
      const err = body.querySelector("#cedErr"), nm2 = st.name.replace(/\s+/g, "");
      const sounding = st.f.filter(x => x !== "x").length;
      if (sounding < 2) { err.textContent = "Marca al menos dos cuerdas que suenen."; return; }
      if (!isValidName(nm2)) { err.textContent = "El nombre debe empezar con la nota (A a G) y no llevar espacios, por ejemplo Bbsus2 o C/G."; return; }
      if (CHORDS[nm2] && !CHORDS[nm2].custom) { err.textContent = `${nm2} ya existe en la biblioteca. Ponle otro nombre, por ejemplo ${nm2}-2.`; return; }
      if (CHORDS[nm2] && CHORDS[nm2].custom && nm2 !== name) { err.textContent = `Ya tienes un acorde llamado ${nm2}.`; return; }
      const d = st.f.map((v, s) => v === "x" || v === "0" ? "-" : (/[1-4]/.test(st.d[s]) ? st.d[s] : "-")).join("");
      saveCustomChord(nm2, st.f, d, name);
      closeSheet(); onDone?.(nm2);
    };
  };
  paint();
}
export { diagram };
