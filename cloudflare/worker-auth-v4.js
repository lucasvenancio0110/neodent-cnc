const VERSION = "worker-v4-1-auth-neodent-cnc";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const LEVELS = { PREPARADOR: 10, TECNICO: 20, LIDER: 30, GERENCIA: 40, ADMIN: 99 };

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";

    try {
      if (path === "/") return ok({ ok: true, version: VERSION, rotas: ["/status", "/auth/bootstrap-admin-setup", "/auth/login", "/admin/usuarios"] });
      if (path === "/status") return ok({ ok: true, version: VERSION, now: new Date().toISOString() });
      if (path === "/auth/bootstrap-admin-setup" && request.method === "GET") return bootstrapPage();
      if (path === "/auth/bootstrap-admin" && request.method === "POST") return bootstrapAdmin(request, env);
      if (path === "/auth/login" && request.method === "POST") return login(request, env);
      if (path === "/auth/me" && request.method === "GET") {
        const auth = await requireAuth(request, env, "PREPARADOR");
        return ok({ usuario: publicUser(auth.user) });
      }
      if (path === "/auth/logout" && request.method === "POST") {
        const auth = await requireAuth(request, env, "PREPARADOR");
        await env.DB.prepare("UPDATE app_sessoes SET ativo = 0 WHERE id = ?").bind(auth.session.id).run();
        await log(env, auth.user, "LOGOUT", "/auth/logout", "Sessao encerrada");
        return ok({ ok: true });
      }
      if (path === "/admin/usuarios" && request.method === "GET") {
        const auth = await requireAuth(request, env, "ADMIN");
        const rows = await env.DB.prepare("SELECT id,nome,login,funcao,nivel_acesso,linha_padrao,celula_padrao,ativo,precisa_trocar_senha,criado_em,atualizado_em FROM app_usuarios ORDER BY nome").all();
        await log(env, auth.user, "LISTAR_USUARIOS", "/admin/usuarios", "Consulta de usuarios");
        return ok({ usuarios: rows.results || [] });
      }
      if (path === "/admin/usuarios" && request.method === "POST") {
        const auth = await requireAuth(request, env, "ADMIN");
        return criarUsuario(request, env, auth.user);
      }
      if (path.startsWith("/admin/usuarios/") && request.method === "PATCH") {
        const auth = await requireAuth(request, env, "ADMIN");
        const id = path.split("/").pop();
        return atualizarUsuario(request, env, auth.user, id);
      }
      return fail("Rota nao encontrada", 404);
    } catch (err) {
      if (wantsHtml(request)) return htmlMessage("Erro", err.message || "Erro interno", true);
      return fail(err.message || "Erro interno", err.status || 500);
    }
  },
};

async function bootstrapAdmin(request, env) {
  const body = await readBody(request);
  const html = wantsHtml(request);
  const total = await env.DB.prepare("SELECT COUNT(*) AS total FROM app_usuarios WHERE funcao = 'ADMIN'").first();
  if (Number(total?.total || 0) > 0) return html ? htmlMessage("Bloqueado", "Ja existe um ADMIN no banco. Use login.html.", true) : fail("Bootstrap bloqueado: ja existe ADMIN", 403);

  const nome = clean(body.nome || "Administrador");
  const login = clean(body.login || "admin").toLowerCase();
  const senha = String(body.senha || "");
  if (senha.length < 6) return html ? htmlMessage("Senha invalida", "Senha inicial precisa ter pelo menos 6 caracteres.", true) : fail("Senha inicial precisa ter pelo menos 6 caracteres", 400);

  const salt = randomId();
  const senhaHash = await hashPassword(senha, salt);
  const id = randomId();
  const now = new Date().toISOString();

  await env.DB.prepare("INSERT INTO app_usuarios (id,nome,login,senha_hash,senha_salt,funcao,nivel_acesso,ativo,precisa_trocar_senha,criado_em,atualizado_em,criado_por) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id, nome, login, senhaHash, salt, "ADMIN", 99, 1, 0, now, now, "bootstrap")
    .run();

  await log(env, { id, login, nome }, "BOOTSTRAP_ADMIN", "/auth/bootstrap-admin", "Primeiro admin criado");
  if (html) return htmlMessage("ADMIN criado", "Agora abra login.html no GitHub Pages e entre com o usuario criado.", false);
  return ok({ ok: true, usuario: { id, nome, login, funcao: "ADMIN", nivel_acesso: 99 } });
}

async function login(request, env) {
  const body = await readBody(request);
  const login = clean(body.login || "").toLowerCase();
  const senha = String(body.senha || "");
  if (!login || !senha) return fail("Informe login e senha", 400);
  const user = await env.DB.prepare("SELECT * FROM app_usuarios WHERE login = ? AND ativo = 1").bind(login).first();
  if (!user) return fail("Login ou senha invalido", 401);
  const senhaHash = await hashPassword(senha, user.senha_salt);
  if (senhaHash !== user.senha_hash) return fail("Login ou senha invalido", 401);
  const token = randomId() + randomId();
  const tokenHash = await sha256(token);
  const now = new Date();
  const expires = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14).toISOString();
  const sessionId = randomId();
  await env.DB.prepare("INSERT INTO app_sessoes (id,usuario_id,token_hash,criado_em,expira_em,ultimo_uso_em,ativo,user_agent) VALUES (?,?,?,?,?,?,?,?)")
    .bind(sessionId, user.id, tokenHash, now.toISOString(), expires, now.toISOString(), 1, request.headers.get("User-Agent") || "")
    .run();
  await log(env, user, "LOGIN", "/auth/login", "Login efetuado");
  return ok({ token, usuario: publicUser(user) });
}

async function criarUsuario(request, env, admin) {
  const body = await readBody(request);
  const nome = clean(body.nome);
  const login = clean(body.login).toLowerCase();
  const senha = String(body.senha || "");
  const funcao = clean(body.funcao || "PREPARADOR").toUpperCase();
  const linha = clean(body.linha_padrao || "");
  const celula = clean(body.celula_padrao || "");
  if (!nome || !login || !senha) return fail("Nome, login e senha sao obrigatorios", 400);
  if (!LEVELS[funcao]) return fail("Funcao invalida", 400);
  if (senha.length < 6) return fail("Senha precisa ter pelo menos 6 caracteres", 400);
  const id = randomId();
  const salt = randomId();
  const senhaHash = await hashPassword(senha, salt);
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT INTO app_usuarios (id,nome,login,senha_hash,senha_salt,funcao,nivel_acesso,linha_padrao,celula_padrao,ativo,precisa_trocar_senha,criado_em,atualizado_em,criado_por) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id, nome, login, senhaHash, salt, funcao, LEVELS[funcao], linha, celula, 1, 1, now, now, admin.login)
    .run();
  await log(env, admin, "CRIAR_USUARIO", "/admin/usuarios", `Usuario ${login} criado`);
  return ok({ ok: true, usuario: { id, nome, login, funcao, nivel_acesso: LEVELS[funcao], linha_padrao: linha, celula_padrao: celula, ativo: 1 } });
}

async function atualizarUsuario(request, env, admin, id) {
  const body = await readBody(request);
  const atual = await env.DB.prepare("SELECT * FROM app_usuarios WHERE id = ?").bind(id).first();
  if (!atual) return fail("Usuario nao encontrado", 404);
  const nome = clean(body.nome ?? atual.nome);
  const funcao = clean(body.funcao ?? atual.funcao).toUpperCase();
  const linha = clean(body.linha_padrao ?? atual.linha_padrao ?? "");
  const celula = clean(body.celula_padrao ?? atual.celula_padrao ?? "");
  const ativo = body.ativo === undefined ? atual.ativo : Number(body.ativo ? 1 : 0);
  const now = new Date().toISOString();
  if (!LEVELS[funcao]) return fail("Funcao invalida", 400);
  await env.DB.prepare("UPDATE app_usuarios SET nome=?, funcao=?, nivel_acesso=?, linha_padrao=?, celula_padrao=?, ativo=?, atualizado_em=? WHERE id=?")
    .bind(nome, funcao, LEVELS[funcao], linha, celula, ativo, now, id)
    .run();
  await log(env, admin, "ATUALIZAR_USUARIO", "/admin/usuarios", `Usuario ${atual.login} atualizado`);
  return ok({ ok: true });
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
  if (type.includes("application/json")) return request.json().catch(() => ({}));
  if (type.includes("form")) return Object.fromEntries(await request.formData());
  return {};
}

function publicUser(user) {
  return { id: user.id, nome: user.nome, login: user.login, funcao: user.funcao, nivel_acesso: user.nivel_acesso, linha_padrao: user.linha_padrao, celula_padrao: user.celula_padrao, precisa_trocar_senha: user.precisa_trocar_senha };
}

async function log(env, user, acao, recurso, detalhe) {
  await env.DB.prepare("INSERT INTO app_logs (usuario_id,login,acao,recurso,detalhe,created_at) VALUES (?,?,?,?,?,?)")
    .bind(user?.id || null, user?.login || null, acao, recurso, detalhe, new Date().toISOString())
    .run();
}

function wantsHtml(request) {
  return (request.headers.get("Accept") || "").includes("text/html");
}

function bootstrapPage() {
  return html(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Primeiro ADMIN</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1117;font-family:Arial,sans-serif}.card{width:min(420px,calc(100% - 28px));background:white;border-radius:22px;padding:22px;color:#12212a}label{display:block;font-weight:800;margin:12px 0 6px}input{width:100%;box-sizing:border-box;border:1px solid #cbd5da;border-radius:12px;padding:14px;font-size:16px}button{width:100%;border:0;border-radius:12px;background:#56d5c7;padding:15px;margin-top:16px;font-weight:900;font-size:16px}.hint{border:1px dashed #cbd5da;border-radius:12px;padding:12px;color:#60717c;font-weight:700}</style></head><body><main class="card"><h1>Primeiro ADMIN</h1><p class="hint">Cria o primeiro administrador. So funciona se ainda nao existir ADMIN.</p><form method="post" action="/auth/bootstrap-admin"><label>Nome</label><input name="nome" required placeholder="Lucas Venancio"><label>Login</label><input name="login" required placeholder="lucas"><label>Senha inicial</label><input name="senha" type="password" required placeholder="minimo 6 caracteres"><button type="submit">Criar primeiro ADMIN</button></form></main></body></html>`);
}

function htmlMessage(title, message, bad) {
  return html(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1117;font-family:Arial,sans-serif}.card{width:min(420px,calc(100% - 28px));background:white;border-radius:22px;padding:22px;color:#12212a}.msg{border:1px dashed #cbd5da;border-radius:12px;padding:12px;color:${bad ? "#ad303b" : "#167647"};font-weight:800}a{display:block;margin-top:14px;color:#0b766c;font-weight:900}</style></head><body><main class="card"><h1>${escapeHtml(title)}</h1><div class="msg">${escapeHtml(message)}</div><a href="https://lucasvenancio0110.github.io/neodent-cnc/login.html">Ir para login</a><a href="/auth/bootstrap-admin-setup">Voltar ao bootstrap</a></main></body></html>`);
}

function html(content) {
  return new Response(content, { status: 200, headers: { ...CORS, "Content-Type": "text/html; charset=utf-8" } });
}

function clean(v) { return String(v || "").trim(); }
function ok(data) { return new Response(JSON.stringify(data), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }); }
function fail(message, status = 400) { return new Response(JSON.stringify({ ok: false, error: message }), { status, headers: { ...CORS, "Content-Type": "application/json" } }); }
function httpError(message, status) { const err = new Error(message); err.status = status; return err; }
function escapeHtml(s) { return String(s || "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[c])); }
function randomId() { const bytes = new Uint8Array(16); crypto.getRandomValues(bytes); return [...bytes].map(b => b.toString(16).padStart(2, "0")).join(""); }
async function sha256(text) { const data = new TextEncoder().encode(text); const hash = await crypto.subtle.digest("SHA-256", data); return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join(""); }
async function hashPassword(password, salt) { const enc = new TextEncoder(); const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]); const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(salt), iterations: 120000, hash: "SHA-256" }, key, 256); return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, "0")).join(""); }
