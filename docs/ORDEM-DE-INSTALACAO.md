# Ordem de instalacao - Neodent CNC

## 1. Banco D1

No Cloudflare D1, execute primeiro:

```txt
sql/auth-v1.sql
```

Esse arquivo cria as tabelas:

```txt
app_usuarios
app_sessoes
app_logs
```

## 2. Worker

Depois abra o Worker da API e substitua o codigo pelo arquivo:

```txt
cloudflare/worker-auth-v4.js
```

O binding do D1 precisa continuar como:

```txt
DB
```

## 3. Teste de status

Depois de publicar o Worker, abra:

```txt
/status
```

A resposta esperada contem:

```txt
worker-v4-auth-neodent-cnc
```

## 4. Criar primeiro admin

Depois execute uma chamada POST para:

```txt
/auth/bootstrap-admin
```

Body exemplo:

```json
{
  "nome": "Lucas Venancio",
  "login": "lucas",
  "senha": "trocar123"
}
```

Essa rota so funciona enquanto nao existir nenhum ADMIN.

## 5. Login normal

Depois use:

```txt
/auth/login
```

Body exemplo:

```json
{
  "login": "lucas",
  "senha": "trocar123"
}
```

A API retorna um token. As proximas chamadas usam:

```txt
Authorization: Bearer TOKEN_AQUI
```

## 6. Admin de usuarios

Com token de ADMIN, use:

```txt
GET /admin/usuarios
POST /admin/usuarios
PATCH /admin/usuarios/:id
```

Funcoes oficiais:

```txt
PREPARADOR
TECNICO
LIDER
GERENCIA
ADMIN
```
