import "../core/config.js";

const API = window.NC_CONFIG.apiBase;
const token = localStorage.getItem("nc_token");
const user = JSON.parse(localStorage.getItem("nc_user") || "null");
const form = document.getElementById("setupForm");
const msg = document.getElementById("setupMsg");
const board = document.getElementById("setupBoard");
const countEl = document.getElementById("setupCount");

if (!token || !user) window.location.href = "login.html";

function show(text, bad = false) {
  msg.textContent = text;
  msg.style.color = bad ? "var(--bad)" : "var(--ok)";
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
  return `
    <article class="machine-card status-setup">
      <div class="machine-head">
        <div class="machine-main">
          <div class="machine-token">${tnl}</div>
          <div class="machine-name">
            <strong>TNL ${tnl}</strong>
            <div class="machine-mini"><span>${o.aberto_por || "Sistema"}</span><span>${o.celula || "Sem célula"}</span><span>${o.prioridade || "NORMAL"}</span></div>
          </div>
        </div>
        <span class="badge setup">SETUP</span>
      </div>
      <div class="machine-body">
        <div class="machine-detail"><b>${o.motivo || "Setup"}</b><br>${o.detalhe || o.observacao || "Sem detalhe"}</div>
      </div>
    </article>
  `;
}

async function loadSetups() {
  try {
    const data = await api("/setup");
    const items = data.setups || [];
    countEl.textContent = items.length;
    board.innerHTML = items.length ? items.map(card).join("") : `<div class="empty-state">Nenhum setup aberto.</div>`;
  } catch (err) {
    board.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  show("Liberando setup...");
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  button.textContent = "Salvando...";
  const data = Object.fromEntries(new FormData(form).entries());
  try {
    const res = await api("/setup/liberar", { method: "POST", body: JSON.stringify(data) });
    form.reset();
    show(`Setup liberado. TNL ${res.setup.tnl} | Item ${res.setup.item} | Ciclo ${res.setup.ciclo_100}`);
    await loadSetups();
  } catch (err) {
    show(err.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "Liberar setup";
  }
});

loadSetups();
setInterval(loadSetups, 20000);
