const VERSION = "worker-v4-5-operacional-preparadores";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

const LEVELS = {
  PREPARADOR: 10,
  TECNICO: 20,
  LIDER: 30,
  GERENCIA: 40,
  ADMIN: 99
};

export default {
  async fetch(request, env) {
    try {
      if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

      const url = new URL(request.url);
      const path = url.pathname.replace(/\/$/, "") || "/";

      if (path === "/" || path === "/status") {
        return json({
          ok: true,
          version: VERSION,
          hasDB: !!env.DB,
          routes: [
            "/status",
            "/debug-db",
            "/auth/login",
            "/auth/me",
            "/admin/usuarios",
            "/abrir-ocorrencia",
            "/painel-geral",
            "/assumir-ocorrencia",
            "/concluir-ocorrencia"
          ]
        });
      }

      if (path === "/debug-db") return debugDb(env);
      if (path === "/auth/bootstrap-admin-setup" && request.method === "GET") return bootstrapPage();
      if (path === "/auth/bootstrap-admin" && request.method === "POST") return bootstrapAdmin(request, env);
      if (path === "/auth/login" && request.method === "POST") return login(request, env);

      if (path === "/auth/me" && request.method === "GET") {
        const auth = await requireAuth(request, env, "PREPARADOR");
        return json({ ok: true, usuario: publicUser(auth.user) });
      }

      if (path === "/admin/usuarios" && request.method === "GET") {
        const auth = await requireAuth(request, env, "ADMIN");
        const rows = await env.DB.prepare(
          "SELECT id,nome,login,funcao,nivel_acesso,linha_padrao,celula_padrao,ativo,precisa_trocar_senha,criado_em,atualizado_em FROM app_usuarios ORDER BY nome"
        ).all();
        await log(env, auth.user, "LISTAR_USUARIOS", "/admin/usuarios", "Consulta de usuarios");
        return json({ ok: true, usuarios: rows.results || [] });
      }

      if (path === "/admin/usuarios" && request.method === "POST") {
        const auth = await requireAuth(request, env, "ADMIN");
        return criarUsuario(request, env, auth.user);
      }

      if (path === "/abrir-ocorrencia" && request.method === "POST") {
        const auth = await requireAuth(request, env, "PREPARADOR");
        return abrirOcorrencia(request, env, auth.user);
      }

      if (path === "/painel-geral" && request.method === "GET") {
        await requireAuth(request, env, "PREPARADOR");
        return painelGeral(env, url);
      }

      if (path === "/assumir-ocorrencia" && request.method === "POST") {
        const auth = await requireAuth(request, env, "PREPARADOR");
        return assumirOcorrencia(request, env, auth.user);
      }

      if (path === "/concluir-ocorrencia" && request.method === "POST") {
        const auth = await requireAuth(request, env, "PREPARADOR");
        return concluirOcorrencia(request, env, auth.user);
      }

      return json({ ok: false, error: "Rota nao encontrada", path }, 404);
    } catch (err) {
      return json({ ok: false, version: VERSION, error: String(err && err.message ? err.message : err) }, err.status || 500);
    }
  }
};

async function debugDb(env) {
  if (!env.DB) return json({ ok: false, error: "Binding DB nao encontrado. Configure o D1 com nome DB." }, 500);
  const test = await env.DB.prepare("SELECT 1 AS teste").first();
  let usuariosTable = false;
  let usuariosCount = null;
  let ocorrenciasTable = false;
  let ocorrenciasCount = null;
  let tableError = null;
  try {
    const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM app_usuarios").first();
    usuariosTable = true;
    usuariosCount = count.total;
  } catch (err) {
    tableError = String(err.message || err);
  }
  try {
    const count2 = await env.DB.prepare("SELECT COUNT(*) AS total FROM ocorrencias").first();
    ocorrenciasTable = true;
    ocorrenciasCount = count2.total;
  } catch (err) {
    tableError = (tableError || "") + " " + String(err.message || err);
  }
  return json({ ok: true, version: VERSION, bindingDB: true, select1: test, app_usuarios_existe: usuariosTable, app_usuarios_total: usuariosCount, ocorrencias_existe: ocorrenciasTable, ocorrencias_total: ocorrenciasCount, tableError });
}

async function bootstrapAdmin(request, env) {
  if (!env.DB) return htmlMessage("Erro", "Binding DB nao encontrado. Configure o D1 com nome DB.", true);
  try {
    const body = await readBody(request);
    const total = await env.DB.prepare("SELECT COUNT(*) AS total FROM app_usuarios WHERE funcao = 'ADMIN'").first();
    if (Number(total.total || 0) > 0) return htmlMessage("Bloqueado", "Ja existe um ADMIN no banco. Use a tela de login.", true);

    const nome = clean(body.nome || "Administrador");
    const loginUser = clean(body.login || "admin").toLowerCase();
    const senha = String(body.senha || "");
    if (!nome || !loginUser || !senha) return htmlMessage("Erro", "Nome, login e senha sao obrigatorios.", true);
    if (senha.length < 6) return htmlMessage("Erro", "A senha precisa ter pelo menos 6 caracteres.", true);

    const id = randomId();
    const salt = randomId();
    const senhaHash = await hashPassword(senha, salt);
    const now = new Date().toISOString();

    await env.DB.prepare(
      "INSERT INTO app_usuarios (id,nome,login,senha_hash,senha_salt,funcao,nivel_acesso,ativo,precisa_trocar_senha,criado_em,atualizado_em,criado_por) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(id, nome, loginUser, senhaHash, salt, "ADMIN", 99, 1, 0, now, now, "bootstrap").run();

    await log(env, { id, login: loginUser, nome }, "BOOTSTRAP_ADMIN", "/auth/bootstrap-admin", "Primeiro admin criado");
    return htmlMessage("ADMIN criado", "Agora abra o login do app e entre com esse usuario.", false);
  } catch (err) {
    return htmlMessage("Erro ao criar ADMIN", String(err.message || err), true);
  }
}

async function login(request, env) {
  const body = await readBody(request);
  const loginUser = clean(body.login || "").toLowerCase();
  const senha = String(body.senha || "");
  if (!loginUser || !senha) return json({ ok: false, error: "Informe login e senha" }, 400);

  const user = await env.DB.prepare("SELECT * FROM app_usuarios WHERE login = ? AND ativo = 1").bind(loginUser).first();
  if (!user) return json({ ok: false, error: "Login ou senha invalido" }, 401);

  const senhaHash = await hashPassword(senha, user.senha_salt);
  if (senhaHash !== user.senha_hash) return json({ ok: false, error: "Login ou senha invalido" }, 401);

  const token = randomId() + randomId();
  const tokenHash = await sha256(token);
  const now = new Date();
  const expira = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14).toISOString();
  const sessionId = randomId();

  await env.DB.prepare(
    "INSERT INTO app_sessoes (id,usuario_id,token_hash,criado_em,expira_em,ultimo_uso_em,ativo,user_agent) VALUES (?,?,?,?,?,?,?,?)"
  ).bind(sessionId, user.id, tokenHash, now.toISOString(), expira, now.toISOString(), 1, request.headers.get("User-Agent") || "").run();

  await log(env, user, "LOGIN", "/auth/login", "Login efetuado");
  return json({ ok: true, token, usuario: publicUser(user) });
}

async function criarUsuario(request, env, admin) {
  const body = await readBody(request);
  const nome = clean(body.nome);
  const loginUser = clean(body.login).toLowerCase();
  const senha = String(body.senha || "");
  const funcao = clean(body.funcao || "PREPARADOR").toUpperCase();
  const linha = clean(body.linha_padrao || "");
  const celula = clean(body.celula_padrao || "");
  if (!nome || !loginUser || !senha) return json({ ok: false, error: "Nome, login e senha sao obrigatorios" }, 400);
  if (!LEVELS[funcao]) return json({ ok: false, error: "Funcao invalida" }, 400);
  if (senha.length < 6) return json({ ok: false, error: "Senha precisa ter pelo menos 6 caracteres" }, 400);

  const id = randomId();
  const salt = randomId();
  const senhaHash = await hashPassword(senha, salt);
  const now = new Date().toISOString();

  await env.DB.prepare(
    "INSERT INTO app_usuarios (id,nome,login,senha_hash,senha_salt,funcao,nivel_acesso,linha_padrao,celula_padrao,ativo,precisa_trocar_senha,criado_em,atualizado_em,criado_por) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
  ).bind(id, nome, loginUser, senhaHash, salt, funcao, LEVELS[funcao], linha, celula, 1, 1, now, now, admin.login).run();

  await log(env, admin, "CRIAR_USUARIO", "/admin/usuarios", "Usuario " + loginUser + " criado");
  return json({ ok: true, usuario: { id, nome, login: loginUser, funcao, nivel_acesso: LEVELS[funcao], linha_padrao: linha, celula_padrao: celula, ativo: 1 } });
}

async function abrirOcorrencia(request, env, user) {
  const body = await readBody(request);
  const tnl = normalizeTnl(body.tnl);
  const status = normalizeStatus(body.status || "OBSERVACAO");
  const motivo = clean(body.motivo || "");
  const detalhe = clean(body.detalhe || "");
  const celula = clean(body.celula || user.celula_padrao || user.linha_padrao || "");
  const prioridade = normalizePriority(body.prioridade || "NORMAL");
  const precisaApoio = Number(body.precisa_apoio || 0) ? 1 : 0;
  const apoioStatus = precisaApoio ? "AGUARDANDO" : "NAO_PRECISA";

  if (!tnl) return json({ ok: false, error: "Informe a TNL" }, 400);
  if (!motivo) return json({ ok: false, error: "Informe o motivo" }, 400);

  const id = randomId();
  const now = new Date().toISOString();
  const payload = JSON.stringify(body || {});

  await env.DB.prepare(
    "INSERT INTO ocorrencias (id,tnl,celula,status,sub_status,motivo,detalhe,prioridade,precisa_apoio,apoio_status,aberto_por,aberto_em,atualizado_em,origem,observacao,ativa,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
  ).bind(id, tnl, celula, status, "ABERTO", motivo, detalhe, prioridade, precisaApoio, apoioStatus, user.login, now, now, "preparadores", detalhe, 1, payload).run();

  await addOcorrenciaEvento(env, id, tnl, "ABERTURA", null, status, motivo, detalhe, user.login, user.login, now, payload);
  await log(env, user, "ABRIR_OCORRENCIA", "/abrir-ocorrencia", "TNL " + tnl + " - " + status);

  return json({ ok: true, ocorrencia: { id, tnl, celula, status, motivo, detalhe, prioridade, precisa_apoio: precisaApoio, apoio_status: apoioStatus, aberto_por: user.login, aberto_em: now } });
}

async function painelGeral(env, url) {
  const status = clean(url.searchParams.get("status") || "").toUpperCase();
  const celula = clean(url.searchParams.get("celula") || "");
  let sql = "SELECT * FROM ocorrencias WHERE ativa = 1";
  const params = [];
  if (status) {
    sql += " AND status = ?";
    params.push(normalizeStatus(status));
  }
  if (celula) {
    sql += " AND celula = ?";
    params.push(celula);
  }
  sql += " ORDER BY CASE prioridade WHEN 'CRITICA' THEN 1 WHEN 'ALTA' THEN 2 ELSE 3 END, atualizado_em DESC LIMIT 200";
  const stmt = env.DB.prepare(sql);
  const rows = params.length ? await stmt.bind(...params).all() : await stmt.all();
  return json({ ok: true, ocorrencias: rows.results || [] });
}

async function assumirOcorrencia(request, env, user) {
  const body = await readBody(request);
  const id = clean(body.id || body.ocorrencia_id || "");
  if (!id) return json({ ok: false, error: "Informe o id da ocorrencia" }, 400);
  const atual = await env.DB.prepare("SELECT * FROM ocorrencias WHERE id = ? AND ativa = 1").bind(id).first();
  if (!atual) return json({ ok: false, error: "Ocorrencia nao encontrada" }, 404);
  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE ocorrencias SET assumido_por=?, assumido_em=?, apoio_status=?, atualizado_em=? WHERE id=?").bind(user.login, now, "EM_ATENDIMENTO", now, id).run();
  await addOcorrenciaEvento(env, id, atual.tnl, "ASSUMIR", atual.status, atual.status, atual.motivo, "Assumido por " + user.login, user.login, user.login, now, null);
  return json({ ok: true });
}

async function concluirOcorrencia(request, env, user) {
  const body = await readBody(request);
  const id = clean(body.id || body.ocorrencia_id || "");
  const observacao = clean(body.observacao || "");
  if (!id) return json({ ok: false, error: "Informe o id da ocorrencia" }, 400);
  const atual = await env.DB.prepare("SELECT * FROM ocorrencias WHERE id = ? AND ativa = 1").bind(id).first();
  if (!atual) return json({ ok: false, error: "Ocorrencia nao encontrada" }, 404);
  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE ocorrencias SET status=?, sub_status=?, concluido_por=?, concluido_em=?, atualizado_em=?, ativa=0, observacao=? WHERE id=?").bind("CONCLUIDO", "CONCLUIDO", user.login, now, now, observacao || atual.observacao || "", id).run();
  await addOcorrenciaEvento(env, id, atual.tnl, "CONCLUSAO", atual.status, "CONCLUIDO", atual.motivo, observacao || "Concluido", user.login, user.login, now, null);
  await log(env, user, "CONCLUIR_OCORRENCIA", "/concluir-ocorrencia", "TNL " + atual.tnl);
  return json({ ok: true });
}

async function addOcorrenciaEvento(env, ocorrenciaId, tnl, tipo, statusAnterior, statusNovo, motivo, detalhe, responsavel, criadoPor, now, payload) {
  try {
    await env.DB.prepare(
      "INSERT INTO ocorrencia_eventos (ocorrencia_id,tnl,tipo_evento,status_anterior,status_novo,motivo,detalhe,responsavel,criado_por,created_at,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(ocorrenciaId, tnl, tipo, statusAnterior, statusNovo, motivo, detalhe, responsavel, criadoPor, now, payload).run();
  } catch (err) {}
}

async function requireAuth(request, env, requiredRole) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw httpError("Sessao obrigatoria", 401);
  const tokenHash = await sha256(token);
  const session = await env.DB.prepare("SELECT * FROM app_sessoes WHERE token_hash = ? AND ativo = 1").bind(tokenHash).first();
  if (!session) throw httpError("Sessao invalida", 401);
  if (new Date(session.expira_em).getTime() < Date.now()) throw httpError("Sessao expirada", 401);
  const user = await env.DB.prepare("SELECT * FROM app_usuarios WHERE id = ? AND ativo = 1").bind(session.usuario_id).first();
  if (!user) throw httpError("Usuario inativo", 401);
  if ((LEVELS[user.funcao] || 0) < (LEVELS[requiredRole] || 0)) throw httpError("Sem permissao", 403);
  await env.DB.prepare("UPDATE app_sessoes SET ultimo_uso_em = ? WHERE id = ?").bind(new Date().toISOString(), session.id).run();
  return { user, session };
}

async function readBody(request) {
  const type = request.headers.get("Content-Type") || "";
  if (type.includes("application/json")) return await request.json().catch(() => ({}));
  if (type.includes("form")) return Object.fromEntries((await request.formData()).entries());
  return {};
}

function publicUser(user) {
  return { id: user.id, nome: user.nome, login: user.login, funcao: user.funcao, nivel_acesso: user.nivel_acesso, linha_padrao: user.linha_padrao, celula_padrao: user.celula_padrao, precisa_trocar_senha: user.precisa_trocar_senha };
}

async function log(env, user, acao, recurso, detalhe) {
  try {
    await env.DB.prepare("INSERT INTO app_logs (usuario_id,login,acao,recurso,detalhe,created_at) VALUES (?,?,?,?,?,?)").bind(user && user.id ? user.id : null, user && user.login ? user.login : null, acao, recurso, detalhe, new Date().toISOString()).run();
  } catch (err) {}
}

function bootstrapPage() {
  const page = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Primeiro ADMIN</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1117;font-family:Arial,sans-serif;"><main style="width:min(420px,calc(100% - 28px));background:white;border-radius:22px;padding:22px;color:#12212a;"><h1>Primeiro ADMIN</h1><p style="border:1px dashed #cbd5da;border-radius:12px;padding:12px;color:#60717c;font-weight:700;">Cria o primeiro administrador. So funciona se ainda nao existir ADMIN.</p><form method="post" action="/auth/bootstrap-admin"><label style="display:block;font-weight:800;margin:12px 0 6px;">Nome</label><input style="width:100%;box-sizing:border-box;border:1px solid #cbd5da;border-radius:12px;padding:14px;font-size:16px;" name="nome" required placeholder="Lucas Venancio"><label style="display:block;font-weight:800;margin:12px 0 6px;">Login</label><input style="width:100%;box-sizing:border-box;border:1px solid #cbd5da;border-radius:12px;padding:14px;font-size:16px;" name="login" required placeholder="lucasvenancio"><label style="display:block;font-weight:800;margin:12px 0 6px;">Senha inicial</label><input style="width:100%;box-sizing:border-box;border:1px solid #cbd5da;border-radius:12px;padding:14px;font-size:16px;" name="senha" type="password" required placeholder="minimo 6 caracteres"><button style="width:100%;border:0;border-radius:12px;background:#56d5c7;padding:15px;margin-top:16px;font-weight:900;font-size:16px;" type="submit">Criar primeiro ADMIN</button></form></main></body></html>';
  return html(page);
}

function htmlMessage(title, message, bad) {
  const color = bad ? "#ad303b" : "#167647";
  const page = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + escapeHtml(title) + '</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1117;font-family:Arial,sans-serif;"><main style="width:min(420px,calc(100% - 28px));background:white;border-radius:22px;padding:22px;color:#12212a;"><h1>' + escapeHtml(title) + '</h1><div style="border:1px dashed #cbd5da;border-radius:12px;padding:12px;color:' + color + ';font-weight:800;white-space:pre-wrap;">' + escapeHtml(message) + '</div><a style="display:block;margin-top:14px;color:#0b766c;font-weight:900;" href="https://lucasvenancio0110.github.io/neodent-cnc/login.html">Ir para login</a><a style="display:block;margin-top:14px;color:#0b766c;font-weight:900;" href="/auth/bootstrap-admin-setup">Voltar ao bootstrap</a></main></body></html>';
  return html(page);
}

function html(content) {
  return new Response(content, { status: 200, headers: { ...CORS, "Content-Type": "text/html; charset=utf-8" } });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function clean(v) { return String(v || "").trim(); }
function normalizeTnl(v) { const n = String(v || "").replace(/\D/g, ""); return n ? n.padStart(3, "0").slice(-3) : ""; }
function normalizeStatus(v) { const s = clean(v).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_"); if (s === "MANUTENCAO") return "MANUTENCAO"; if (s === "OBSERVACAO") return "OBSERVACAO"; if (s === "SEM_ORDEM") return "SEM_ORDEM"; if (s === "SETUP") return "SETUP"; if (s === "AJUSTE") return "AJUSTE"; if (s === "CONCLUIDO") return "CONCLUIDO"; return s || "OBSERVACAO"; }
function normalizePriority(v) { const s = clean(v).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); return ["NORMAL", "ALTA", "CRITICA"].includes(s) ? s : "NORMAL"; }
function escapeHtml(v) { return String(v || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function httpError(message, status) { const err = new Error(message); err.status = status; return err; }
function randomId() { const bytes = new Uint8Array(16); crypto.getRandomValues(bytes); return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(""); }
async function sha256(text) { const data = new TextEncoder().encode(text); const hash = await crypto.subtle.digest("SHA-256", data); return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join(""); }
async function hashPassword(password, salt) { const enc = new TextEncoder(); const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]); const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" }, key, 256); return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join(""); }
