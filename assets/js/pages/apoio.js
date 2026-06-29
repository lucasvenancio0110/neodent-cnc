import "../core/config.js";

const API = window.NC_CONFIG.apiBase;
const token = localStorage.getItem("nc_token");
const user = JSON.parse(localStorage.getItem("nc_user") || "null");

const feed = document.getElementById("tempoRealFeed");
const resumo = document.getElementById("setorResumo");
const eventCount = document.getElementById("eventCount");
const setupCount = document.getElementById("setupCount");
const ajusteCount = document.getElementById("ajusteCount");
const apoioCount = document.getElementById("apoioCount");
const lastUpdate = document.getElementById("lastUpdate");
const clock = document.getElementById("tempoRealClock");

if (!token || !user) window.location.href = "login.html";

function pad2(n) { return String(n).padStart(2, "0"); }
function timeNow() { const d = new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function tick() { if (clock) clock.textContent = timeNow(); }
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

function clean(value) { return String(value || "").trim(); }
function upper(value) { return clean(value).toUpperCase(); }
function tnlOf(o) { return clean(o.tnl).padStart(3, "0"); }
function textOf(o) { return `${o.status || ""} ${o.motivo || ""} ${o.detalhe || ""} ${o.observacao || ""}`.toLowerCase(); }
function person(o) { return clean(o.aberto_por || o.responsavel || o.usuario || "Sistema"); }
function hasApoio(o) { return upper(o.status).includes("APOIO") || Number(o.precisa_apoio || 0) === 1; }
function isSetup(o) { return upper(o.status).includes("SETUP") || textOf(o).includes("setup"); }
function isAjuste(o) { return upper(o.status).includes("AJUSTE") || textOf(o).includes("ajuste"); }
function isManut(o) { return upper(o.status).includes("MANUT") || textOf(o).includes("manutenção") || textOf(o).includes("manutencao"); }
function isConcluido(o) { return upper(o.status).includes("CONCL") || upper(o.situacao).includes("CONCL") || clean(o.concluido_em); }
function mainText(o) { return clean(o.motivo || o.observacao || o.detalhe || "Atualização operacional"); }
function detailText(o) { return clean(o.detalhe || o.observacao || "").split("\n").filter(Boolean).join(" • "); }

function setupLevel(o) {
  const t = textOf(o);
  if (t.includes("setup vermelho")) return { emoji: "🔴", label: "Setup vermelho", cls: "setup-red" };
  if (t.includes("setup verde")) return { emoji: "🟢", label: "Setup verde", cls: "setup-green" };
  if (t.includes("setup azul")) return { emoji: "🔵", label: "Setup azul", cls: "setup-blue" };
  return { emoji: "🔵", label: "Setup", cls: "setup-blue" };
}

function tone(o) {
  if (isManut(o)) return "manut";
  if (hasApoio(o)) return "apoio";
  if (isAjuste(o)) return "ajuste";
  if (isSetup(o)) return "setup";
  return "obs";
}

function createdAt(o, index) {
  const raw = o.created_at || o.criado_em || o.aberto_em || o.atualizado_em || o.updated_at || "";
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? ts : Date.now() - index * 1000;
}

function feedTitle(o) {
  const tnl = tnlOf(o);
  const who = person(o);
  const level = setupLevel(o);
  if (isConcluido(o)) return `${who} concluiu TNL ${tnl}`;
  if (isSetup(o)) return `${who} iniciou ${level.emoji} setup TNL ${tnl}`;
  if (isAjuste(o)) return `${who} iniciou ajuste TNL ${tnl}`;
  if (isManut(o)) return `${who} colocou TNL ${tnl} em manutenção`;
  if (hasApoio(o)) return `Operador pediu apoio na TNL ${tnl}`;
  return `${who} fez observação na TNL ${tnl}`;
}

function feedLine(o) {
  const d = detailText(o);
  return d || mainText(o);
}

function uniqueItems(raw) {
  const map = new Map();
  raw.forEach((item, index) => {
    if (!item) return;
    const id = clean(item.id || `${item.tnl}-${item.status}-${index}`);
    map.set(id, { ...item, _sort: createdAt(item, index) });
  });
  return Array.from(map.values()).sort((a, b) => b._sort - a._sort);
}

function liveItem(o, index) {
  const t = tone(o);
  const level = setupLevel(o);
  const badge = isSetup(o) ? level.label : (o.status || "OBS");
  return `
    <article class="live-item ${t}" style="--i:${index}">
      <div class="live-dot">${isSetup(o) ? level.emoji : ""}</div>
      <div class="live-content">
        <strong>${feedTitle(o)}</strong>
        <span>${feedLine(o)}</span>
        <em>${badge}</em>
      </div>
    </article>`;
}

function groupTitle(key) {
  const titles = {
    manut: "Máquinas em manutenção parada",
    setup: "Setup",
    proximo: "Próximos setups",
    ajuste: "Máquinas em ajustes",
    apoio: "Pedidos de apoio",
    obs: "Observações"
  };
  return titles[key] || key;
}

function groupLine(o) {
  const tnl = tnlOf(o);
  const level = setupLevel(o);
  const who = person(o);
  const done = isConcluido(o) ? "✅" : "";
  if (isSetup(o)) return `${level.emoji} TNL ${tnl} - ${who}${done}`;
  return `TNL ${tnl} - ${who}${done}`;
}

function groupKey(o) {
  const tx = textOf(o);
  if (isManut(o)) return "manut";
  if (hasApoio(o)) return "apoio";
  if (isSetup(o) && (tx.includes("próximo") || tx.includes("proximo"))) return "proximo";
  if (isSetup(o)) return "setup";
  if (isAjuste(o)) return "ajuste";
  return "obs";
}

function renderReport(items) {
  const groups = { manut: [], setup: [], proximo: [], ajuste: [], apoio: [], obs: [] };
  items.forEach((o) => groups[groupKey(o)].push(o));
  const html = Object.entries(groups)
    .filter(([, list]) => list.length)
    .map(([key, list]) => `
      <section class="sector-block ${key}">
        <h3>${groupTitle(key)}</h3>
        <div>${list.map((o) => `<p>${groupLine(o)}</p>`).join("")}</div>
      </section>`).join("");
  resumo.innerHTML = html || `<div class="empty-state">Nenhuma ocorrência aberta.</div>`;
}

function render(items) {
  const setup = items.filter(isSetup).length;
  const ajuste = items.filter(isAjuste).length;
  const apoio = items.filter(hasApoio).length;
  eventCount.textContent = items.length;
  setupCount.textContent = setup;
  ajusteCount.textContent = ajuste;
  apoioCount.textContent = apoio;
  lastUpdate.textContent = timeNow();
  feed.innerHTML = items.length ? items.slice(0, 30).map(liveItem).join("") : `<div class="empty-state">Sem atualização no momento.</div>`;
  renderReport(items);
}

async function load() {
  try {
    const [painelRes, apoioRes] = await Promise.allSettled([api("/painel-geral"), api("/apoio")]);
    const painelItems = painelRes.status === "fulfilled" ? (painelRes.value.ocorrencias || []) : [];
    const apoioItems = apoioRes.status === "fulfilled" ? (apoioRes.value.apoio || []) : [];
    render(uniqueItems([...painelItems, ...apoioItems]));
  } catch (err) {
    feed.innerHTML = `<div class="empty-state">${err.message}</div>`;
    resumo.innerHTML = "";
  }
}

load();
setInterval(load, 10000);
