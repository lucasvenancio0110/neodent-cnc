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
function textOf(o) { return `${o.status || ""} ${o.motivo || ""} ${o.detalhe || ""} ${o.observacao || ""}`.toLowerCase(); }
function tnlOf(o) { return clean(o.tnl).padStart(3, "0"); }
function hasApoio(o) { return upper(o.status).includes("APOIO") || Number(o.precisa_apoio || 0) === 1; }
function isSetup(o) { return upper(o.status).includes("SETUP") || textOf(o).includes("setup"); }
function isAjuste(o) { return upper(o.status).includes("AJUSTE") || textOf(o).includes("ajuste"); }
function isManut(o) { return upper(o.status).includes("MANUT") || upper(o.status).includes("FALTA") || textOf(o).includes("manutenção") || textOf(o).includes("manutencao") || textOf(o).includes("falta mp"); }
function isConcluido(o) { return upper(o.status).includes("CONCL") || upper(o.situacao).includes("CONCL") || clean(o.concluido_em); }
function detailText(o) { return clean(o.detalhe || o.observacao || o.motivo || "").split("\n").filter(Boolean).join(" • "); }

function person(o) {
  return clean(
    o.responsavel_nome ||
    o.responsavel ||
    o.assumido_por_nome ||
    o.aberto_por_nome ||
    o.aberto_por ||
    o.usuario ||
    "Sem dono"
  );
}

function setupLevel(o) {
  const t = textOf(o);
  if (t.includes("setup vermelho")) return { emoji: "🔴", label: "Vermelho" };
  if (t.includes("setup verde")) return { emoji: "🟢", label: "Verde" };
  if (t.includes("setup azul")) return { emoji: "🔵", label: "Azul" };
  return { emoji: "🔵", label: "Setup" };
}

function createdAt(o, index) {
  const raw = o.created_at || o.criado_em || o.aberto_em || o.atualizado_em || o.updated_at || "";
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? ts : Date.now() - index * 1000;
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

function groupKey(o) {
  if (isManut(o)) return "manut";
  if (hasApoio(o)) return "apoio";
  if (isSetup(o)) return "setup";
  if (isAjuste(o)) return "ajuste";
  return "obs";
}

function groupTitle(key) {
  return ({
    setup: "SETUP",
    ajuste: "AJUSTES",
    manut: "MANUTENÇÃO PARADA",
    apoio: "APOIO",
    obs: "OBSERVAÇÕES"
  })[key] || key;
}

function cardLabel(o, key) {
  if (key === "setup") return setupLevel(o).label;
  if (key === "ajuste") return isConcluido(o) ? "Concluído" : "Ajuste";
  if (key === "manut") return "Parada";
  if (key === "apoio") return upper(o.apoio_status || "AGUARDANDO").replace("_", " ");
  return "Obs.";
}

function cardToken(o, key) {
  if (key === "setup") return setupLevel(o).emoji;
  return tnlOf(o);
}

function sectorCard(o, key, index) {
  const done = isConcluido(o) ? "✅" : "";
  return `
    <button class="ao-card ${key}" type="button" data-id="${clean(o.id)}" style="--i:${index}">
      <span>${cardToken(o, key)}</span>
      <strong>${tnlOf(o)}</strong>
      <em>${person(o)}${done}</em>
      <small>${cardLabel(o, key)}</small>
    </button>`;
}

function renderGroups(items) {
  const groups = { setup: [], ajuste: [], manut: [], apoio: [], obs: [] };
  items.forEach((item) => groups[groupKey(item)].push(item));

  const order = ["setup", "ajuste", "manut", "apoio", "obs"];
  resumo.innerHTML = order
    .filter((key) => groups[key].length || key !== "obs")
    .map((key) => `
      <section class="ao-group ${key}">
        <div class="ao-group-title"><h3>${groupTitle(key)}</h3><span>${groups[key].length}</span></div>
        <div class="ao-grid">
          ${groups[key].length ? groups[key].map((item, index) => sectorCard(item, key, index)).join("") : `<div class="ao-empty">Sem ${groupTitle(key).toLowerCase()}.</div>`}
        </div>
      </section>`).join("");
}

function feedTone(o) { return groupKey(o); }
function feedTitle(o) {
  const who = person(o);
  const tnl = tnlOf(o);
  const level = setupLevel(o);
  if (isConcluido(o)) return `${who} concluiu TNL ${tnl}`;
  if (isSetup(o)) return `${who} iniciou ${level.emoji} setup TNL ${tnl}`;
  if (isAjuste(o)) return `${who} iniciou ajuste TNL ${tnl}`;
  if (isManut(o)) return `${who} colocou TNL ${tnl} em manutenção`;
  if (hasApoio(o)) return `Apoio solicitado na TNL ${tnl}`;
  return `${who} fez observação na TNL ${tnl}`;
}

function liveItem(o, index) {
  const key = feedTone(o);
  const level = setupLevel(o);
  return `
    <article class="live-item ${key}" style="--i:${index}">
      <div class="live-dot">${key === "setup" ? level.emoji : ""}</div>
      <div class="live-content">
        <strong>${feedTitle(o)}</strong>
        <span>${detailText(o) || "Sem detalhe"}</span>
        <em>${cardLabel(o, key)}</em>
      </div>
    </article>`;
}

function render(items) {
  eventCount.textContent = items.length;
  setupCount.textContent = items.filter(isSetup).length;
  ajusteCount.textContent = items.filter(isAjuste).length;
  apoioCount.textContent = items.filter(hasApoio).length;
  lastUpdate.textContent = timeNow();
  renderGroups(items);
  feed.innerHTML = items.length ? items.slice(0, 12).map(liveItem).join("") : `<div class="empty-state">Sem atualização no momento.</div>`;
}

async function load() {
  try {
    const [painelRes, apoioRes] = await Promise.allSettled([api("/painel-geral"), api("/apoio")]);
    const painelItems = painelRes.status === "fulfilled" ? (painelRes.value.ocorrencias || []) : [];
    const apoioItems = apoioRes.status === "fulfilled" ? (apoioRes.value.apoio || []) : [];
    render(uniqueItems([...painelItems, ...apoioItems]));
  } catch (err) {
    resumo.innerHTML = `<div class="empty-state">${err.message}</div>`;
    feed.innerHTML = "";
  }
}

load();
setInterval(load, 10000);
