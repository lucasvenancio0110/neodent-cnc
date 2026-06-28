import "../core/config.js";

const API = window.NC_CONFIG.apiBase;
const token = localStorage.getItem("nc_token");
const user = JSON.parse(localStorage.getItem("nc_user") || "null");
const board = document.getElementById("apoioBoard");
const aguardandoCount = document.getElementById("aguardandoCount");
const atendimentoCount = document.getElementById("atendimentoCount");
const totalCount = document.getElementById("totalCount");
const lastUpdate = document.getElementById("lastUpdate");

if (!token || !user) window.location.href = "login.html";

function nowText() {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
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

function card(o) {
  const tnl = String(o.tnl || "").padStart(3, "0");
  const statusApoio = o.apoio_status || "AGUARDANDO";
  const aguardando = statusApoio === "AGUARDANDO";
  return `
    <article class="machine-card status-apoio">
      <div class="machine-head">
        <div class="machine-main">
          <div class="machine-token">${tnl}</div>
          <div class="machine-name">
            <strong>TNL ${tnl}</strong>
            <div class="machine-mini"><span>${o.status || "STATUS"}</span><span>${o.aberto_por || "Sistema"}</span><span>${o.celula || "Sem célula"}</span></div>
          </div>
        </div>
        <span class="badge apoio">${statusApoio}</span>
      </div>
      <div class="machine-body">
        <div class="machine-detail"><b>${o.motivo || "Sem motivo"}</b><br>${o.detalhe || o.observacao || "Sem detalhe"}</div>
        <div class="machine-actions">
          ${aguardando ? `<button class="btn btn-warn" data-action="assumir" data-id="${o.id}">Vou atender</button>` : ""}
          <button class="btn btn-ok" data-action="concluir" data-id="${o.id}">Concluir</button>
        </div>
      </div>
    </article>
  `;
}

async function load() {
  try {
    const data = await api("/apoio");
    const items = data.apoio || [];
    const aguardando = items.filter(x => (x.apoio_status || "AGUARDANDO") === "AGUARDANDO").length;
    const atendimento = items.filter(x => (x.apoio_status || "") === "EM_ATENDIMENTO").length;
    aguardandoCount.textContent = aguardando;
    atendimentoCount.textContent = atendimento;
    totalCount.textContent = items.length;
    lastUpdate.textContent = nowText();
    board.innerHTML = items.length ? items.map(card).join("") : `<div class="empty-state">Nenhum pedido de apoio aberto.</div>`;
  } catch (err) {
    board.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

board.addEventListener("click", async (event) => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;
  btn.disabled = true;
  try {
    const id = btn.dataset.id;
    if (btn.dataset.action === "assumir") await api(`/ocorrencias/${id}/assumir`, { method: "POST", body: JSON.stringify({}) });
    if (btn.dataset.action === "concluir") await api(`/ocorrencias/${id}/concluir`, { method: "POST", body: JSON.stringify({ observacao: "Concluído pela fila de apoio" }) });
    await load();
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
});

load();
setInterval(load, 15000);
