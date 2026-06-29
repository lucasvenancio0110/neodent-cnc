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

function textOf(item) {
  return `${item.status || ""} ${item.motivo || ""} ${item.detalhe || ""} ${item.observacao || ""}`.toLowerCase();
}

function isFaltaMp(item) {
  const s = String(item.status || "").toUpperCase();
  return s.includes("FALTA") || s.includes("SEM_ORDEM") || textOf(item).includes("falta mp") || textOf(item).includes("falta de matéria");
}

function setupLevel(item) {
  const t = textOf(item);
  if (t.includes("setup vermelho")) return { emoji: "🔴", label: "Setup vermelho", cls: "level-red" };
  if (t.includes("setup verde")) return { emoji: "🟢", label: "Setup verde", cls: "level-green" };
  if (t.includes("setup azul")) return { emoji: "🔵", label: "Setup azul", cls: "level-blue" };
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

function badgeClass(item) {
  const s = String(item.status || "").toUpperCase();
  if (s.includes("SETUP")) return "setup";
  if (s.includes("AJUSTE")) return "ajuste";
  if (s.includes("MANUT") || isFaltaMp(item)) return "manut";
  if (s.includes("APOIO") || Number(item.precisa_apoio || 0) === 1) return "apoio";
  return "obs";
}

function passaFiltro(item) {
  if (filtro === "TODAS") return true;
  const s = String(item.status || "").toUpperCase();
  if (filtro === "MANUTENCAO") return s.includes("MANUT");
  if (filtro === "APOIO") return s.includes("APOIO") || Number(item.precisa_apoio || 0) === 1;
  return s.includes(filtro);
}

function apoioTexto(item) {
  if (!Number(item.precisa_apoio || 0)) return "Sem apoio";
  return String(item.apoio_status || "AGUARDANDO").replace("_", " ");
}

function compactDetail(item) {
  const motivo = item.motivo || "Sem motivo";
  const detail = String(item.detalhe || item.observacao || "").split("\n").filter(Boolean).join(" • ");
  return { motivo, detail: detail || "Sem detalhe" };
}

function titleFor(item, tnl) {
  if (String(item.status || "").toUpperCase().includes("SETUP")) return `${setupLevel(item).emoji} TNL ${tnl}`;
  return `TNL ${tnl}`;
}

function tokenFor(item, tnl) {
  if (String(item.status || "").toUpperCase().includes("SETUP")) return setupLevel(item).emoji;
  return tnl;
}

function card(item) {
  const tnl = String(item.tnl || "").padStart(3, "0");
  const op = opClass(item);
  const detail = compactDetail(item);
  const level = setupLevel(item);
  const urgent = /neste turno|crítica|critica|falta|manut/i.test(`${item.motivo || ""} ${item.detalhe || ""}`);
  return `
    <article class="factory-card ${op} ${op === "op-setup" ? level.cls : ""} ${urgent ? "card-urgent" : ""}">
      <div class="factory-head">
        <div class="factory-title">
          <div class="factory-token">${tokenFor(item, tnl)}</div>
          <div class="factory-name">
            <strong>${titleFor(item, tnl)}</strong>
            <div class="factory-mini"><span>${item.status || "OBS"}</span><span>${item.aberto_por || "Sistema"}</span></div>
          </div>
        </div>
        <span class="factory-badge ${badgeClass(item)}">${apoioTexto(item)}</span>
      </div>
      <div class="factory-body">
        <div class="factory-detail"><b>${detail.motivo}</b>${detail.detail}</div>
        <div class="factory-actions">
          <button class="btn btn-ok" data-action="concluir" data-id="${item.id}">Concluir</button>
          ${Number(item.precisa_apoio || 0) ? `<button class="btn btn-warn" data-action="assumir" data-id="${item.id}">Assumir</button>` : ""}
        </div>
      </div>
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

board.addEventListener("click", async (event) => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;
  btn.disabled = true;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  try {
    if (action === "concluir") await api("/concluir-ocorrencia", { method: "POST", body: JSON.stringify({ id }) });
    if (action === "assumir") await api("/assumir-ocorrencia", { method: "POST", body: JSON.stringify({ id }) });
    await load();
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
});

load();
setInterval(load, 15000);
