export const RONDA_DEFAULT_SETTINGS = {
  barLength: 3600,
  kerfWidth: 2,
  turnMinutes: 480
};

export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function parseNumber(value) {
  if (value === "" || value == null) return NaN;
  return Number(String(value).replace(",", "."));
}

export function parseInteger(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

export function parseTempoToSeconds(input) {
  if (input == null) return NaN;
  const s = String(input).trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return NaN;

  const separated = s.match(/^(\d+)[,:](\d{1,2})$/);
  if (separated) {
    const minutes = Number(separated[1]);
    const seconds = Number(separated[2]);
    if (seconds >= 60) return NaN;
    return minutes * 60 + seconds;
  }

  const secondsOnly = s.match(/^(\d+(?:[.,]\d+)?)s$/);
  if (secondsOnly) return Number(secondsOnly[1].replace(",", "."));

  const minutesAndSeconds = s.match(/^(\d+)m(?:(\d{1,2})s?)?$/);
  if (minutesAndSeconds) {
    const minutes = Number(minutesAndSeconds[1]);
    const seconds = Number(minutesAndSeconds[2] || 0);
    if (seconds >= 60) return NaN;
    return minutes * 60 + seconds;
  }

  if (/^\d+$/.test(s)) return Number(s);

  const decimalMinutes = s.match(/^(\d+)\.(\d+)$/);
  if (decimalMinutes) return Number(s) * 60;

  return NaN;
}

export function parseTempoToMinutes(input) {
  const seconds = parseTempoToSeconds(input);
  return Number.isFinite(seconds) ? seconds / 60 : NaN;
}

export function fmtDate(d) {
  if (!d) return "-";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function fmtTime(d) {
  if (!d) return "-";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatMinutes(totalMin) {
  if (totalMin == null || !Number.isFinite(totalMin)) return "-";
  const min = Math.max(0, Math.floor(totalMin));
  return `${Math.floor(min / 60)}h ${pad2(min % 60)}min`;
}

export function getShiftWindowFor(date) {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const mk = (h, m, plus = 0) => {
    const d = new Date(base);
    d.setDate(d.getDate() + plus);
    d.setHours(h, m, 0, 0);
    return d;
  };
  const minutes = date.getHours() * 60 + date.getMinutes();
  const m0630 = 6 * 60 + 30;
  const m1440 = 14 * 60 + 40;
  const m2240 = 22 * 60 + 40;
  if (minutes < m0630) return { id: 3, startDT: mk(22, 40, -1), endDT: mk(6, 30, 0) };
  if (minutes < m1440) return { id: 1, startDT: mk(6, 30, 0), endDT: mk(14, 40, 0) };
  if (minutes < m2240) return { id: 2, startDT: mk(14, 40, 0), endDT: mk(22, 40, 0) };
  return { id: 3, startDT: mk(22, 40, 0), endDT: mk(6, 30, 1) };
}

export function nextShiftWindow(prevEnd, prevId) {
  const nextId = prevId === 3 ? 1 : prevId + 1;
  const base = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), prevEnd.getDate(), 0, 0, 0, 0);
  const map = { 1: [6, 30, 14, 40], 2: [14, 40, 22, 40], 3: [22, 40, 6, 30] };
  const s = new Date(base);
  s.setHours(map[nextId][0], map[nextId][1], 0, 0);
  const e = new Date(base);
  e.setHours(map[nextId][2], map[nextId][3], 0, 0);
  if (nextId === 3 || e <= s) e.setDate(e.getDate() + 1);
  if (s < prevEnd) s.setTime(prevEnd.getTime());
  return { id: nextId, startDT: s, endDT: e };
}

export function shiftName(id) {
  return `${id}º turno`;
}

export function getOperationalStatus(restMin) {
  if (!Number.isFinite(restMin)) return "idle";
  if (restMin < 8 * 60) return "now";
  if (restMin < 16 * 60) return "next";
  return "ok";
}

export function calcRonda(machine, settings = RONDA_DEFAULT_SETTINGS, baseDT = new Date()) {
  const tempoMin = parseTempoToMinutes(machine.ciclo);
  const pieceLength = parseNumber(machine.pecaMm);
  const targetRaw = parseNumber(machine.metaOp);
  const target = Number.isFinite(targetRaw) ? Math.max(0, Math.floor(targetRaw)) : NaN;
  const produced = Math.max(0, parseInteger(machine.produzidas));
  const remainingOP = Number.isFinite(target) ? Math.max(0, target - produced) : 0;
  const barLength = Math.max(0, parseNumber(settings.barLength) || RONDA_DEFAULT_SETTINGS.barLength);
  const kerfWidth = Math.max(0, parseNumber(settings.kerfWidth) || 0);
  const step = pieceLength + kerfWidth;
  const valid = Number.isFinite(tempoMin) && tempoMin > 0 && Number.isFinite(pieceLength) && pieceLength > 0 && Number.isFinite(target) && target > 0;
  const perBar = valid && step > 0 ? Math.floor(barLength / step) : 0;
  let currentBar = 0;

  if (valid) {
    if (machine.mpModo === "full") currentBar = perBar;
    if (machine.mpModo === "partialMm") currentBar = Math.floor(Math.max(0, parseNumber(machine.parcialMm) || 0) / step);
    if (machine.mpModo === "pieces") currentBar = Math.max(0, parseInteger(machine.pecasRestantes));
  }

  const fullBars = Math.max(0, parseInteger(machine.barrasInteiras));
  const capacity = Math.max(0, fullBars * perBar + currentBar);
  const producible = Math.min(remainingOP, capacity);
  const metaTurno = Number.isFinite(tempoMin) && tempoMin > 0 ? Math.floor((parseInteger(settings.turnMinutes) || 480) / tempoMin) : 0;

  if (!valid) {
    return { valid: false, status: "idle", statusText: "Aguardando dados", severity: "idle", title: "Preencha ciclo, meta da OP e peça em mm.", reason: "dados", produced, remainingOP, capacity, perBar, metaTurno, showDecision: false };
  }

  if (remainingOP === 0) {
    return { valid: true, status: "done", statusText: "OP finalizada", severity: "ok", title: "A OP já atingiu a meta informada.", reason: "meta", produced, remainingOP, capacity, perBar, metaTurno, endDT: baseDT, restMin: 0, showDecision: false };
  }

  if (capacity <= 0) {
    return { valid: true, status: "now", statusText: "Neste turno", severity: "bad", title: "Sem matéria-prima disponível para continuar.", reason: "mp", produced, remainingOP, capacity, perBar, metaTurno, endDT: baseDT, restMin: 0, showDecision: true };
  }

  let remainingMin = producible * tempoMin;
  let endDT = new Date(baseDT);
  let win = getShiftWindowFor(baseDT);
  let safety = 0;

  while (remainingMin > 0 && safety < 1000) {
    const start = endDT > win.startDT ? endDT : win.startDT;
    const available = Math.max(0, (win.endDT - start) / 60000);
    const use = Math.min(remainingMin, available);
    endDT = new Date(start.getTime() + use * 60000);
    remainingMin -= use;
    if (remainingMin <= 0) break;
    win = nextShiftWindow(win.endDT, win.id);
    safety += 1;
  }

  const restMin = Math.max(0, Math.floor((endDT - baseDT) / 60000));
  const reason = producible < remainingOP ? "mp" : "meta";
  const status = getOperationalStatus(restMin);
  const labels = {
    now: ["Neste turno", "bad", "Vai encerrar neste turno."],
    next: ["Próximo turno", "warn", "Vai encerrar no próximo turno."],
    ok: ["Estável", "ok", "Não encerra no turno atual nem no próximo."]
  };
  const [statusText, severity, title] = labels[status];

  return { valid: true, status, statusText, severity, title, reason, produced, remainingOP, capacity, producible, perBar, metaTurno, endDT, restMin, showDecision: restMin < 16 * 60 };
}

export function reasonLabel(reason) {
  if (reason === "mp") return "Falta de matéria-prima";
  if (reason === "meta") return "Meta da OP atingida";
  return "Dados incompletos";
}

export function actionLabel(value) {
  const map = {
    sequencia: "Sequência normal",
    setup_azul: "🔵 Setup azul",
    setup_verde: "🟢 Setup verde",
    setup_vermelho: "🔴 Setup vermelho",
    falta_mp: "Falta matéria-prima",
    manutencao: "Manutenção",
    aguardando: "Aguardando definição"
  };
  return map[value] || "Aguardando definição";
}

export function actionTone(value) {
  if (value === "falta_mp" || value === "manutencao") return "bad";
  if (value === "setup_vermelho" || value === "setup_verde" || value === "setup_azul" || value === "aguardando") return "warn";
  return "ok";
}
