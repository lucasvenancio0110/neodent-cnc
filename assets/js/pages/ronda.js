import "../core/config.js";
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

if (!token || !user) {
  window.location.href = "login.html";
}

const STORAGE_KEY = "nc_ronda_leituras_v1";
const form = document.getElementById("rondaForm");
const msg = document.getElementById("formMsg");
const decisionBox = document.getElementById("decisionBox");
const mpPiecesWrap = document.getElementById("mpPiecesWrap");
const mpMmWrap = document.getElementById("mpMmWrap");
const horaSolicitar = document.getElementById("horaSolicitar");
const projectionBox = document.getElementById("projectionBox");
const recentList = document.getElementById("recentList");
const localCount = document.getElementById("localCount");
const cardCount = document.getElementById("cardCount");
const clockNow = document.getElementById("clockNow");
const turnoAtual = document.getElementById("turnoAtual");
let latestCalc = null;

function show(text, type = "") {
  msg.textContent = text;
  msg.className = `form-msg ${type}`.trim();
}

function nowBase() {
  return new Date();
}

function currentTurnText() {
  const now = nowBase();
  return `${shiftName(getShiftWindowFor(now).id)} • ${fmtDate(now)}`;
}

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch (_) {
    return [];
  }
}

function saveLocal(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 50)));
}

function selected(name) {
  return form.querySelector(`[name="${name}"]:checked`)?.value || "";
}

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

function updateMpVisibility() {
  const mode = selected("mpModo") || "pieces";
  mpPiecesWrap.classList.toggle("hidden", mode !== "pieces");
  mpMmWrap.classList.toggle("hidden", mode !== "partialMm");
}

function renderProjection() {
  updateMpVisibility();
  const payload = getPayload();
  latestCalc = calcRonda(payload, RONDA_DEFAULT_SETTINGS, nowBase());
  projectionBox.className = `projection ${latestCalc.severity || "idle"}`;
  document.getElementById("projectionTitle").textContent = latestCalc.title;
  document.getElementById("projectionEnd").textContent = latestCalc.endDT ? fmtTime(latestCalc.endDT) : "--:--";
  document.getElementById("projectionRest").textContent = latestCalc.restMin != null ? formatMinutes(latestCalc.restMin) : "-";
  document.getElementById("projectionReason").textContent = reasonLabel(latestCalc.reason);
  document.getElementById("projectionSaldo").textContent = String(latestCalc.remainingOP || 0);
  document.getElementById("projectionMp").textContent = String(latestCalc.capacity || 0);
  document.getElementById("projectionPerBar").textContent = String(latestCalc.perBar || 0);

  decisionBox.classList.toggle("hidden", !latestCalc.showDecision);
  if (latestCalc.endDT) horaSolicitar.value = fmtTime(latestCalc.endDT);
}

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
      ...(options.headers || {})
    }
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
    `Leitura: ${user.login || user.nome || "usuário"}`
  ].join("\n");

  return api("/abrir-ocorrencia", {
    method: "POST",
    body: JSON.stringify({
      tnl: payload.tnl,
      status: statusForAction(payload.acao),
      motivo: `${acao} - ${calc.statusText}`,
      detalhe,
      prioridade: priorityFor(payload, calc),
      precisa_apoio: 0,
      origem: "ronda",
      payload_ronda: { payload, calcResumo: serializableCalc(calc) }
    })
  });
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

function renderRecent() {
  const items = readLocal();
  localCount.textContent = String(items.length);
  cardCount.textContent = String(items.filter((item) => item.cardGerado).length);
  if (!items.length) {
    recentList.innerHTML = `<div class="empty-state">Nenhuma leitura salva ainda.</div>`;
    return;
  }

  recentList.innerHTML = items.slice(0, 8).map((item) => {
    const calc = item.calc || {};
    const payload = item.payload || {};
    const acao = item.acaoLabel || "Leitura estável";
    const cls = item.tone || calc.severity || "ok";
    const end = calc.endAt ? new Date(calc.endAt) : null;
    return `
      <article class="recent-card ${cls}">
        <strong>TNL ${payload.tnl || "--"} — ${acao}</strong>
        <span>${calc.statusText || "Sem status"} ${end ? "• previsão " + fmtTime(end) : ""}</span>
        <span>${item.cardGerado ? "Card vivo gerado" : "Leitura salva"} • ${item.createdLabel}</span>
      </article>
    `;
  }).join("");
}

function tick() {
  const now = new Date();
  clockNow.textContent = `${fmtTime(now)}:${String(now.getSeconds()).padStart(2, "0")}`;
  turnoAtual.textContent = currentTurnText();
}

form.addEventListener("input", renderProjection);
form.addEventListener("change", renderProjection);

form.querySelectorAll(".step-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = form.elements.barrasInteiras;
    const next = Math.max(0, Number(input.value || 0) + Number(btn.dataset.step));
    input.value = String(next);
    renderProjection();
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = getPayload();
  const calc = calcRonda(payload, RONDA_DEFAULT_SETTINGS, nowBase());

  if (!payload.tnl) return show("Informe a máquina.", "bad");
  if (!calc.valid) return show("Preencha ciclo, meta da OP e peça em mm antes de salvar.", "bad");

  const created = new Date();
  const localItem = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    payload,
    calc: serializableCalc(calc),
    acaoLabel: calc.showDecision ? actionLabel(payload.acao) : "Leitura estável",
    tone: calc.showDecision ? actionTone(payload.acao) : calc.severity,
    cardGerado: false,
    createdAt: created.toISOString(),
    createdLabel: `${fmtDate(created)} ${fmtTime(created)}`
  };

  try {
    if (calc.showDecision) {
      show("Salvando leitura e gerando card vivo...");
      await gerarCard(payload, calc);
      localItem.cardGerado = true;
      show("Leitura salva e card vivo gerado no painel.", "ok");
    } else {
      show("Leitura estável salva localmente.", "ok");
    }

    const items = [localItem, ...readLocal()];
    saveLocal(items);
    renderRecent();
  } catch (err) {
    const items = [localItem, ...readLocal()];
    saveLocal(items);
    renderRecent();
    show(`Leitura salva localmente, mas o card não subiu: ${err.message}`, "bad");
  }
});

document.getElementById("clearLocalBtn").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  renderRecent();
  show("Leituras locais limpas.");
});

tick();
setInterval(tick, 1000);
renderProjection();
renderRecent();
