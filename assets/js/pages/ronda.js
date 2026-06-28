import "../core/config.js";
import { CELULAS, getCelulaFromUser, parseMaquina } from "../core/celulas.js";
import {
  RONDA_DEFAULT_SETTINGS,
  actionLabel,
  actionTone,
  calcRonda,
  fmtDate,
  fmtTime,
  formatMinutes,
  getShiftWindowFor,
  reasonLabel,
  shiftName
} from "../core/ronda-engine.js";

const API = window.NC_CONFIG.apiBase;
const token = localStorage.getItem("nc_token");
const user = JSON.parse(localStorage.getItem("nc_user") || "null");

if (!token || !user) window.location.href = "login.html";

const STORAGE_KEY = "nc_ronda_leituras_v2";
const CELL_KEY = "nc_ronda_celula_atual";

const form = document.getElementById("rondaForm");
const msg = document.getElementById("formMsg");
const modal = document.getElementById("machineModal");
const machineGrid = document.getElementById("machineGrid");
const celulaSelect = document.getElementById("celulaSelect");
const tituloCelula = document.getElementById("tituloCelula");
const rondaSummary = document.getElementById("rondaSummary");
const localCount = document.getElementById("localCount");
const cardCount = document.getElementById("cardCount");
const clockNow = document.getElementById("clockNow");
const turnoAtual = document.getElementById("turnoAtual");
const modalStepLabel = document.getElementById("modalStepLabel");
const modalTitle = document.getElementById("modalTitle");
const modalSub = document.getElementById("modalSub");
const prevStepBtn = document.getElementById("prevStepBtn");
const nextStepBtn = document.getElementById("nextStepBtn");
const saveStepBtn = document.getElementById("saveStepBtn");
const decisionBox = document.getElementById("decisionBox");
const decisionOriginalHtml = decisionBox.innerHTML;
const mpPiecesWrap = document.getElementById("mpPiecesWrap");
const mpMmWrap = document.getElementById("mpMmWrap");
const projectionBox = document.getElementById("projectionBox");
const stepDots = Array.from(document.querySelectorAll("#stepDots i"));

let currentCelula = localStorage.getItem(CELL_KEY) || getCelulaFromUser(user);
let currentStep = 1;
let currentMachine = null;
let latestCalc = null;

function readLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch (_) { return {}; }
}

function saveLocal(map) { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); }

function selected(name) {
  const checked = form.querySelector(`[name="${name}"]:checked`);
  if (checked) return checked.value;
  const field = form.elements[name];
  return field && typeof field.value === "string" ? field.value : "";
}

function setFieldValue(name, value) {
  const field = form.elements[name];
  if (!field) return;
  const radio = form.querySelector(`[name="${name}"][value="${value}"]`);
  if (radio) { radio.checked = true; return; }
  if (typeof field.value === "string") field.value = value ?? "";
}

function show(text, type = "") {
  msg.textContent = text || "";
  msg.className = `form-msg ${type}`.trim();
}

function currentTurnText() { const now = new Date(); return `${shiftName(getShiftWindowFor(now).id)} • ${fmtDate(now)}`; }

function getPayload() {
  const data = Object.fromEntries(new FormData(form).entries());
  return {
    tnl: String(data.tnl || "").trim(),
    ciclo: data.ciclo,
    mpModo: selected("mpModo") || "pieces",
    pecasRestantes: data.pecasRestantes,
    parcialMm: data.parcialMm,
    barrasInteiras: data.barrasInteiras,
    metaOp: data.metaOp,
    pecaMm: data.pecaMm,
    produzidas: data.produzidas || "0",
    acao: selected("acao") || "sequencia",
    preset: selected("preset") || "pendente",
    item: String(data.item || "").trim(),
    horaSolicitar: data.horaSolicitar
  };
}

function statusForAction(action) {
  if (action.startsWith("setup")) return "SETUP";
  if (action === "manutencao") return "MANUTENCAO";
  if (action === "falta_mp") return "SEM_ORDEM";
  return "OBSERVACAO";
}

function priorityFor(payload, calc) {
  if (payload.acao === "setup_vermelho" || payload.acao === "manutencao" || calc.status === "now") return "CRITICA";
  if (payload.acao === "falta_mp" || calc.status === "next") return "ALTA";
  return "NORMAL";
}

function serializableCalc(calc) {
  return {
    valid: calc.valid,
    status: calc.status,
    statusText: calc.statusText,
    severity: calc.severity,
    title: calc.title,
    reason: calc.reason,
    produced: calc.produced,
    remainingOP: calc.remainingOP,
    capacity: calc.capacity,
    perBar: calc.perBar,
    metaTurno: calc.metaTurno,
    restMin: calc.restMin,
    endAt: calc.endDT ? calc.endDT.toISOString() : null,
    showDecision: calc.showDecision
  };
}

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, ...(options.headers || {}) }
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || "Erro na API");
  return data;
}

async function gerarCard(payload, calc) {
  const acao = actionLabel(payload.acao);
  const preset = payload.preset === "trouxe" ? "Preset já trouxe" : "Preset pendente";
  const item = payload.item ? ` • Item ${payload.item}` : "";
  const detalhe = [
    `${calc.statusText} • previsão ${calc.endDT ? fmtDate(calc.endDT) + " às " + fmtTime(calc.endDT) : "sem previsão"}`,
    `${reasonLabel(calc.reason)} • ${preset}${item}`,
    `${currentCelula} • Leitura: ${user.login || user.nome || "usuário"}`
  ].join("\n");

  return api("/abrir-ocorrencia", {
    method: "POST",
    body: JSON.stringify({
      tnl: payload.tnl,
      celula: currentCelula,
      status: statusForAction(payload.acao),
      motivo: `${acao} - ${calc.statusText}`,
      detalhe,
      prioridade: priorityFor(payload, calc),
      precisa_apoio: 0,
      origem: "ronda",
      payload_ronda: { payload, calcResumo: serializableCalc(calc), celula: currentCelula }
    })
  });
}

function setupCellOptions() {
  celulaSelect.innerHTML = Object.keys(CELULAS).map((name) => `<option value="${name}">${name}</option>`).join("");
  if (!CELULAS[currentCelula]) currentCelula = "CÉLULA 05";
  celulaSelect.value = currentCelula;
}

function localForCell() { return readLocal()[currentCelula] || {}; }
function writeMachineReading(machineId, item) { const map = readLocal(); map[currentCelula] = map[currentCelula] || {}; map[currentCelula][machineId] = item; saveLocal(map); }
function clearCellReadings() { const map = readLocal(); map[currentCelula] = {}; saveLocal(map); renderAll(); }
function machineTone(reading) { if (!reading) return "empty"; if (reading.tone === "bad") return "bad"; if (reading.tone === "warn") return "warn"; return "ok"; }
function cardMeta(reading) { if (!reading) return "Sem leitura"; const calc = reading.calc || {}; const end = calc.endAt ? new Date(calc.endAt) : null; return `${calc.statusText || "Lida"} • ${end ? fmtTime(end) : "--:--"}`; }

function renderSummary(readings, machines) {
  const values = machines.map((m) => readings[m.id]).filter(Boolean);
  const now = values.filter((r) => r.calc?.status === "now").length;
  const next = values.filter((r) => r.calc?.status === "next").length;
  const ok = values.filter((r) => r.calc?.status === "ok" || r.calc?.status === "done").length;
  const pending = machines.length - values.length;
  rondaSummary.innerHTML = `<div><span>Sem leitura</span><strong>${pending}</strong></div><div><span>Neste turno</span><strong>${now}</strong></div><div><span>Próximo</span><strong>${next}</strong></div><div><span>Estáveis</span><strong>${ok}</strong></div>`;
}

function renderMachines() {
  const readings = localForCell();
  const machines = (CELULAS[currentCelula] || []).map(parseMaquina);
  tituloCelula.textContent = currentCelula;
  localCount.textContent = `${Object.keys(readings).length}/${machines.length}`;
  cardCount.textContent = String(Object.values(readings).filter((item) => item.cardGerado).length);
  renderSummary(readings, machines);
  machineGrid.innerHTML = machines.map((machine, index) => {
    const reading = readings[machine.id];
    return `<button type="button" class="machine-tile ${machineTone(reading)}" data-machine-id="${machine.id}" style="--tile-index:${index}"><strong>${machine.tnl}</strong><span>${cardMeta(reading)}</span><em>${reading?.acaoLabel || "Tirar tempo"}</em></button>`;
  }).join("");
}

function renderAll() { setupCellOptions(); renderMachines(); }
function updateMpVisibility() { const mode = selected("mpModo") || "pieces"; mpPiecesWrap.classList.toggle("hidden", mode !== "pieces"); mpMmWrap.classList.toggle("hidden", mode !== "partialMm"); }

function renderProjection() {
  updateMpVisibility();
  const payload = getPayload();
  latestCalc = calcRonda(payload, RONDA_DEFAULT_SETTINGS, new Date());
  projectionBox.className = `projection ${latestCalc.severity || "idle"}`;
  document.getElementById("projectionTitle").textContent = latestCalc.title;
  document.getElementById("projectionEnd").textContent = latestCalc.endDT ? fmtTime(latestCalc.endDT) : "--:--";
  document.getElementById("projectionRest").textContent = latestCalc.restMin != null ? formatMinutes(latestCalc.restMin) : "-";
  document.getElementById("projectionReason").textContent = reasonLabel(latestCalc.reason);
  document.getElementById("projectionSaldo").textContent = String(latestCalc.remainingOP || 0);
  document.getElementById("projectionMp").textContent = String(latestCalc.capacity || 0);
  document.getElementById("projectionPerBar").textContent = String(latestCalc.perBar || 0);
  const horaInput = document.getElementById("horaSolicitar");
  if (latestCalc.endDT && horaInput) horaInput.value = fmtTime(latestCalc.endDT);
}

function setStep(step) {
  currentStep = Math.max(1, Math.min(4, step));
  form.querySelectorAll(".wizard-step").forEach((section) => { section.hidden = Number(section.dataset.step) !== currentStep; });
  modalStepLabel.textContent = `${currentStep}/4`;
  stepDots.forEach((dot, index) => dot.classList.toggle("active", index < currentStep));
  prevStepBtn.hidden = currentStep === 1;
  nextStepBtn.hidden = currentStep === 4;
  saveStepBtn.hidden = currentStep !== 4;
  if (currentStep === 3 || currentStep === 4) renderProjection();
  if (currentStep === 4 && latestCalc && !latestCalc.showDecision) {
    decisionBox.innerHTML = `<div class="stable-save"><strong>Estável</strong><span>Salve para marcar como lida.</span></div>`;
  } else if (!decisionBox.querySelector("[name='acao']")) {
    decisionBox.innerHTML = decisionOriginalHtml;
    renderProjection();
  }
}

function openMachine(machineId) {
  currentMachine = parseMaquina(machineId);
  const reading = localForCell()[machineId];
  form.reset();
  decisionBox.innerHTML = decisionOriginalHtml;
  form.elements.tnl.value = currentMachine.tnl;
  setFieldValue("mpModo", "pieces");
  form.elements.barrasInteiras.value = "0";
  if (reading?.payload) Object.entries(reading.payload).forEach(([key, value]) => setFieldValue(key, value));
  modalTitle.textContent = `TNL ${currentMachine.tnl}`;
  modalSub.textContent = `${currentCelula.replace("CÉLULA ", "C")} • Pat. ${currentMachine.patrimonio || "--"}`;
  modal.hidden = false;
  document.body.classList.add("modal-open");
  show("");
  renderProjection();
  setStep(1);
  setTimeout(() => form.querySelector("[name='ciclo']")?.focus(), 120);
}

function closeModal() { modal.hidden = true; document.body.classList.remove("modal-open"); currentMachine = null; }
function canAdvance() { if (currentStep === 1 && (!form.elements.ciclo.value || !form.elements.metaOp.value)) { show("Informe ciclo e meta.", "bad"); return false; } if (currentStep === 2 && !form.elements.pecaMm.value) { show("Informe peça mm.", "bad"); return false; } show(""); return true; }

form.addEventListener("input", renderProjection);
form.addEventListener("change", renderProjection);
form.querySelectorAll(".step-btn").forEach((btn) => { btn.addEventListener("click", () => { const input = form.elements.barrasInteiras; input.value = String(Math.max(0, Number(input.value || 0) + Number(btn.dataset.stepChange))); renderProjection(); }); });
machineGrid.addEventListener("click", (event) => { const tile = event.target.closest(".machine-tile"); if (tile) openMachine(tile.dataset.machineId); });
modal.addEventListener("click", (event) => { if (event.target.closest("[data-close-modal]")) closeModal(); });
prevStepBtn.addEventListener("click", () => setStep(currentStep - 1));
nextStepBtn.addEventListener("click", () => { if (canAdvance()) setStep(currentStep + 1); });
celulaSelect.addEventListener("change", () => { currentCelula = celulaSelect.value; localStorage.setItem(CELL_KEY, currentCelula); renderAll(); });
document.getElementById("resetRondaBtn").addEventListener("click", clearCellReadings);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = getPayload();
  const calc = calcRonda(payload, RONDA_DEFAULT_SETTINGS, new Date());
  if (!payload.tnl) return show("Máquina não encontrada.", "bad");
  if (!calc.valid) return show("Complete os dados.", "bad");
  const created = new Date();
  const machineId = currentMachine?.id || payload.tnl;
  const localItem = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), machineId, celula: currentCelula, payload, calc: serializableCalc(calc), acaoLabel: calc.showDecision ? actionLabel(payload.acao) : "Leitura estável", tone: calc.showDecision ? actionTone(payload.acao) : calc.severity, cardGerado: false, createdAt: created.toISOString(), createdLabel: `${fmtDate(created)} ${fmtTime(created)}` };
  try {
    if (calc.showDecision) { show("Salvando...", "ok"); await gerarCard(payload, calc); localItem.cardGerado = true; }
    writeMachineReading(machineId, localItem);
    renderAll();
    const updated = machineGrid.querySelector(`[data-machine-id="${machineId}"]`);
    if (updated) updated.classList.add("just-updated");
    show(localItem.cardGerado ? "Card gerado." : "Salvo.", "ok");
    setTimeout(closeModal, 520);
  } catch (err) {
    writeMachineReading(machineId, localItem);
    renderAll();
    const updated = machineGrid.querySelector(`[data-machine-id="${machineId}"]`);
    if (updated) updated.classList.add("just-updated");
    show(`Salvou local. Card falhou: ${err.message}`, "bad");
  }
});

function tick() { const now = new Date(); clockNow.textContent = `${fmtTime(now)}:${String(now.getSeconds()).padStart(2, "0")}`; turnoAtual.textContent = currentTurnText(); }
tick();
setInterval(tick, 1000);
renderAll();
