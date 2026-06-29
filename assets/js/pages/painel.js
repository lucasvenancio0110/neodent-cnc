import "../core/config.js";

const API = window.NC_CONFIG.apiBase;
const token = localStorage.getItem("nc_token");
const user = JSON.parse(localStorage.getItem("nc_user") || "null");
const board = document.getElementById("painelBoard");
const metrics = document.getElementById("panelMetrics");
const clock = document.getElementById("panelClock");
const chips = Array.from(document.querySelectorAll(".filter-chip"));
let filtro = "TODAS";
let cache = [];

if (!token || !user) window.location.href = "login.html";

function pad2(n) { return String(n).padStart(2, "0"); }
function fmtNow() { const d = new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; }
function tick() { if (clock) clock.textContent = fmtNow(); }
tick();
setInterval(tick, 1000);

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, ...(options.headers || {}) }
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || "Erro na API");
  return data;
}

function safe(value) {
  return String(value || "").replace(/[&<>'"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch]));
}

function textOf(item) {
  return `${item.status || ""} ${item.motivo || ""} ${item.detalhe || ""} ${item.observacao || ""}`.toLowerCase();
}

function isFaltaMp(item) {
  const s = String(item.status || "").toUpperCase();
  return s.includes("FALTA") || s.includes("SEM_ORDEM") || textOf(item).includes("falta mp") || textOf(item).includes("falta de matéria");
}

function setupLevel(item) {
  const t = textOf(item);
  if (t.includes("setup vermelho")) return { emoji: "🔴", label: "Vermelho", cls: "level-red" };
  if (t.includes("setup verde")) return { emoji: "🟢", label: "Verde", cls: "level-green" };
  if (t.includes("setup azul")) return { emoji: "🔵", label: "Azul", cls: "level-blue" };
  return { emoji: "🔵", label: "Setup", cls: "level-blue" };
}

function opClass(item) {
  const s = String(item.status || "").toUpperCase();
  if (s.includes("SETUP")) return "op-setup";
  if (s.includes("AJUSTE")) return "op-ajuste";
  if (s.includes("MANUT") || isFaltaMp(item)) return "op-manut";
  if (s.includes("APOIO") || Number(item.precisa_apoio || 0) === 1) return "op-apoio";
  return "op-obs";
}

function passaFiltro(item) {
  if (filtro === "TODAS") return true;
  const s = String(item.status || "").toUpperCase();
  if (filtro === "MANUTENCAO") return s.includes("MANUT");
  if (filtro === "APOIO") return s.includes("APOIO") || Number(item.precisa_apoio || 0) === 1;
  return s.includes(filtro);
}

function shortLabel(item) {
  const s = String(item.status || "").toUpperCase();
  if (s.includes("SETUP")) return setupLevel(item).label;
  if (s.includes("AJUSTE")) return "Ajuste";
  if (s.includes("MANUT") || isFaltaMp(item)) return "Manut.";
  if (s.includes("APOIO") || Number(item.precisa_apoio || 0) === 1) return "Apoio";
  return "Obs.";
}

function card(item, index) {
  const tnl = String(item.tnl || "").padStart(3, "0");
  const op = opClass(item);
  const level = setupLevel(item);
  const isSetup = op === "op-setup";
  const urgent = /neste turno|critica|falta|manut/i.test(`${item.motivo || ""} ${item.detalhe || ""}`);
  return `
    <article class="factory-tile ${op} ${isSetup ? level.cls : ""} ${urgent ? "urgent" : ""}" style="--i:${index}">
      <span>${isSetup ? level.emoji : safe(tnl)}</span>
      <strong>${safe(tnl)}</strong>
      <em>${safe(shortLabel(item))}</em>
    </article>`;
}

function renderMetrics() {
  const counts = { setup: 0, ajuste: 0, manut: 0, apoio: 0 };
  cache.forEach((item) => {
    const s = String(item.status || "").toUpperCase();
    if (s.includes("SETUP")) counts.setup++;
    if (s.includes("AJUSTE")) counts.ajuste++;
    if (s.includes("MANUT")) counts.manut++;
    if (s.includes("APOIO") || Number(item.precisa_apoio || 0) === 1) counts.apoio++;
  });
  metrics.innerHTML = `
    <div class="setup"><span>Setup</span><strong>${counts.setup}</strong></div>
    <div class="ajuste"><span>Ajuste</span><strong>${counts.ajuste}</strong></div>
    <div class="manut"><span>Manut.</span><strong>${counts.manut}</strong></div>
    <div class="apoio"><span>Apoio</span><strong>${counts.apoio}</strong></div>`;
}

function render() {
  const items = cache.filter(passaFiltro);
  renderMetrics();
  board.innerHTML = items.length ? items.map(card).join("") : `<div class="empty-state">Nenhum card nesse filtro.</div>`;
}

async function load() {
  board.innerHTML = `<div class="empty-state">Carregando...</div>`;
  try {
    const data = await api("/painel-geral");
    cache = data.ocorrencias || [];
    render();
  } catch (err) {
    board.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    filtro = chip.dataset.filter || "TODAS";
    render();
  });
});

load();
setInterval(load, 15000);
