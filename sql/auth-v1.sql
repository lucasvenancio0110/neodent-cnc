CREATE TABLE IF NOT EXISTS app_usuarios (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  login TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  senha_salt TEXT NOT NULL,
  funcao TEXT NOT NULL DEFAULT 'PREPARADOR',
  nivel_acesso INTEGER NOT NULL DEFAULT 10,
  linha_padrao TEXT,
  celula_padrao TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  precisa_trocar_senha INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  criado_por TEXT,
  payload_json TEXT
);

CREATE TABLE IF NOT EXISTS app_sessoes (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  criado_em TEXT NOT NULL,
  expira_em TEXT NOT NULL,
  ultimo_uso_em TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  user_agent TEXT,
  payload_json TEXT,
  FOREIGN KEY (usuario_id) REFERENCES app_usuarios(id)
);

CREATE TABLE IF NOT EXISTS app_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id TEXT,
  login TEXT,
  acao TEXT NOT NULL,
  recurso TEXT,
  detalhe TEXT,
  created_at TEXT NOT NULL,
  payload_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_app_usuarios_login ON app_usuarios(login);
CREATE INDEX IF NOT EXISTS idx_app_usuarios_funcao ON app_usuarios(funcao);
CREATE INDEX IF NOT EXISTS idx_app_sessoes_usuario ON app_sessoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_app_sessoes_token ON app_sessoes(token_hash);
CREATE INDEX IF NOT EXISTS idx_app_logs_usuario ON app_logs(usuario_id);
CREATE INDEX IF NOT EXISTS idx_app_logs_data ON app_logs(created_at);
