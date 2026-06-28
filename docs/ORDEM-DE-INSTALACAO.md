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

## 4. Criar primeiro admin pelo app

Abra a pagina:

```txt
bootstrap-admin.html
```

Preencha:

```txt
Nome
Login
Senha inicial
```

Essa tela chama a rota:

```txt
/auth/bootstrap-admin
```

Ela so funciona enquanto nao existir nenhum ADMIN no banco.

## 5. Login normal

Depois abra:

```txt
login.html
```

Entre com o login e senha criados no bootstrap.

A API retorna um token e o app salva no navegador.

## 6. Admin de usuarios

Depois abra:

```txt
admin.html
```

Com usuario ADMIN, a tela consegue:

```txt
listar usuarios
criar usuarios
salvar funcao, linha e celula
```

Funcoes oficiais:

```txt
PREPARADOR
TECNICO
LIDER
GERENCIA
ADMIN
```
