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
function safe(value) { return String(value ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[m])); }
function parseJson(value) { if (!value) return null; if (typeof value === "object") return value; try { return JSON.parse(value); } catch (_) { return null; } }
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

function rondaData(o) {
  return parseJson(o.payload_ronda) || parseJson(o.payloadRonda) || parseJson(o.payload) || {};
}

function forecastOf(o) {
  const data = rondaData(o);
  const live = data.previsaoViva || data.previsao_viva || data.liveProjection || o.liveProjection || {};
  const calc = data.calcResumo || data.calc || o.calcResumo || o.calc || {};
  const end = live.previsao_fim || live.endAt || calc.endAt || o.previsao_fim || o.fim_previsto || o.endAt || "";
  if (!end) return null;
  const ts = Date.parse(end);
  if (!Number.isFinite(ts)) return null;
  return { end, ts, live, calc };
}

function formatDuration(mins) {
  const value = Math.max(0, Math.round(Math.abs(mins)));
  if (value >= 60) {
    const h = Math.floor(value / 60);
    const m = value % 60;
    return m ? `${h}h${pad2(m)}` : `${h}h`;
  }
  return `${value}min`;
}

function countdownInfo(o, now = Date.now()) {
  if (isConcluido(o)) return { text: "Concluído", state: "done", end: "" };
  const forecast = forecastOf(o);
  if (!forecast) return { text: "", state: "none", end: "" };
  const diffMin = Math.ceil((forecast.ts - now) / 60000);
  if (diffMin < 0) return { text: `Atrasado ${formatDuration(diffMin)}`, state: "late", end: forecast.end };
  if (diffMin === 0) return { text: "Acaba agora", state: "critical", end: forecast.end };
  if (diffMin <= 15) return { text: `Acaba em ${formatDuration(diffMin)}`, state: "critical", end: forecast.end };
  if (diffMin <= 60) return { text: `Acaba em ${formatDuration(diffMin)}`, state: "alert", end: forecast.end };
  if (diffMin <= 240) return { text: `Acaba em ${formatDuration(diffMin)}`, state: "warn", end: forecast.end };
  return { text: `Acaba em ${formatDuration(diffMin)}`, state: "ok", end: forecast.end };
}

function updateLiveCountdowns() {
  document.querySelectorAll("[data-end]").forEach((node) => {
    const end = node.getAttribute("data-end");
    const info = countdownInfo({ payload_ronda: { previsaoViva: { previsao_fim: end } } });
    node.textContent = info.text;
    node.className = `${node.dataset.baseClass || "ao-countdown"} ${info.state}`.trim();
    const card = node.closest(".ao-card");
    if (card) {
      card.classList.remove("clock-ok", "clock-warn", "clock-alert", "clock-critical", "clock-late");
      if (info.state !== "none" && info.state !== "done") card.classList.add(`clock-${info.state}`);
    }
  });
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
  const count = countdownInfo(o);
  const countHtml = count.end
    ? `<small class="ao-countdown ${count.state}" data-base-class="ao-countdown" data-end="${safe(count.end)}">${safe(count.text)}</small>`
    : `<small>${safe(cardLabel(o, key))}</small>`;
  const clockClass = count.end && count.state !== "none" && count.state !== "done" ? ` clock-${count.state}` : "";
  return `
    <button class="ao-card ${key}${clockClass}" type="button" data-id="${safe(clean(o.id))}" style="--i:${index}">
      <span>${safe(cardToken(o, key))}</span>
      <strong>${safe(tnlOf(o))}</strong>
      <em>${safe(person(o))}${done}</em>
      ${countHtml}
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
  updateLiveCountdowns();
}

function feedTone(o) { return groupKey(o); }
function feedTitle(o) {
  const who = person(o);
  const tnl = tnlOf(o);
  const level = setupLevel(o);
  if (isConcluido(o)) return `${who} concluiu TNL ${tnl}`;
  if (isSetup(o)) return `${who} programou ${level.emoji} setup TNL ${tnl}`;
  if (isAjuste(o)) return `${who} registrou ajuste TNL ${tnl}`;
  if (isManut(o)) return `${who} colocou TNL ${tnl} em manutenção`;
  if (hasApoio(o)) return `Apoio solicitado na TNL ${tnl}`;
  return `${who} fez observação na TNL ${tnl}`;
}

function liveItem(o, index) {
  const key = feedTone(o);
  const level = setupLevel(o);
  const count = countdownInfo(o);
  const badge = count.end ? count.text : cardLabel(o, key);
  return `
    <article class="live-item ${key}" style="--i:${index}">
      <div class="live-dot">${key === "setup" ? level.emoji : ""}</div>
      <div class="live-content">
        <strong>${safe(feedTitle(o))}</strong>
        <span>${safe(detailText(o) || "Sem detalhe")}</span>
        <em class="live-count ${count.state}" ${count.end ? `data-base-class="live-count" data-end="${safe(count.end)}"` : ""}>${safe(badge)}</em>
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
  updateLiveCountdowns();
}

async function load() {
  try {
    const [painelRes, apoioRes] = await Promise.allSettled([api("/painel-geral"), api("/apoio")]);
    const painelItems = painelRes.status === "fulfilled" ? (painelRes.value.ocorrencias || []) : [];
    const apoioItems = apoioRes.status === "fulfilled" ? (apoioRes.value.apoio || []) : [];
    render(uniqueItems([...painelItems, ...apoioItems]));
  } catch (err) {
    resumo.innerHTML = `<div class="empty-state">${safe(err.message)}</div>`;
    feed.innerHTML = "";
  }
}

load();
setInterval(load, 10000);
setInterval(updateLiveCountdowns, 1000);
