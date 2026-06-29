import "../core/config.js";

const API = window.NC_CONFIG.apiBase;
const token = localStorage.getItem("nc_token");
const user = JSON.parse(localStorage.getItem("nc_user") || "null");

if (!token || !user) window.location.href = "login.html";

const clock = document.getElementById("cockpitClock");
const els = {
  setup: document.getElementById("cockpitSetup"),
  ajuste: document.getElementById("cockpitAjuste"),
  manut: document.getElementById("cockpitManut"),
  apoio: document.getElementById("cockpitApoio")
};
const counts = {
  setup: document.getElementById("countSetup"),
  ajuste: document.getElementById("countAjuste"),
  manut: document.getElementById("countManut"),
  apoio: document.getElementById("countApoio")
};

function pad2(n) { return String(n).padStart(2, "0"); }
function tick() { const d = new Date(); clock.textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; }
tick();
setInterval(tick, 1000);

async function api(path) {
  const res = await fetch(API + path, { headers: { Authorization: "Bearer " + token } });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || "Erro na API");
  return data;
}

function textOf(o) { return `${o.status || ""} ${o.motivo || ""} ${o.detalhe || ""} ${o.observacao || ""}`.toLowerCase(); }
function upper(v) { return String(v || "").toUpperCase(); }
function tnl(o) { return String(o.tnl || "").padStart(3, "0"); }
function isSetup(o) { return upper(o.status).includes("SETUP") || textOf(o).includes("setup"); }
function isAjuste(o) { return upper(o.status).includes("AJUSTE") || textOf(o).includes("ajuste"); }
function isManut(o) { return upper(o.status).includes("MANUT") || upper(o.status).includes("FALTA") || textOf(o).includes("manutenção") || textOf(o).includes("manutencao"); }
function isApoio(o) { return upper(o.status).includes("APOIO") || Number(o.precisa_apoio || 0) === 1; }

function setupLevel(o) {
  const t = textOf(o);
  if (t.includes("setup vermelho")) return { emoji: "🔴", label: "Vermelho" };
  if (t.includes("setup verde")) return { emoji: "🟢", label: "Verde" };
  if (t.includes("setup azul")) return { emoji: "🔵", label: "Azul" };
  return { emoji: "🔵", label: "Setup" };
}

function shortLabel(o, kind) {
  if (kind === "setup") return setupLevel(o).label;
  if (kind === "ajuste") return "Ajuste";
  if (kind === "manut") return "Manut.";
  if (kind === "apoio") return "Apoio";
  return "Obs.";
}

function token(o, kind) {
  if (kind === "setup") return setupLevel(o).emoji;
  return tnl(o);
}

function tile(o, kind, index) {
  return `
    <a class="cockpit-tile ${kind}" href="./painel.html" style="--i:${index}">
      <span class="token">${token(o, kind)}</span>
      <strong>${tnl(o)}</strong>
      <em>${shortLabel(o, kind)}</em>
    </a>`;
}

function renderGroup(kind, items) {
  counts[kind].textContent = String(items.length);
  els[kind].innerHTML = items.length
    ? items.slice(0, 15).map((o, i) => tile(o, kind, i)).join("")
    : `<div class="cockpit-empty">Sem ${kind === "manut" ? "manutenção" : kind}.</div>`;
}

async function load() {
  try {
    const data = await api("/painel-geral");
    const items = data.ocorrencias || [];
    const groups = {
      setup: items.filter(isSetup),
      ajuste: items.filter(isAjuste),
      manut: items.filter(isManut),
      apoio: items.filter(isApoio)
    };
    renderGroup("setup", groups.setup);
    renderGroup("ajuste", groups.ajuste);
    renderGroup("manut", groups.manut);
    renderGroup("apoio", groups.apoio);
  } catch (err) {
    Object.values(els).forEach((el) => { el.innerHTML = `<div class="cockpit-empty">${err.message}</div>`; });
  }
}

load();
setInterval(load, 15000);
