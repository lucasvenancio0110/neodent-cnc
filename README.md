# Neodent CNC

Cockpit operacional CNC modular para cards vivos de maquina, tempo da linha, preparadores, apoio, setup, historico e relatorio automatico.

## Paginas

- `index.html` — Portal
- `login.html` — Login
- `admin.html` — Administracao de usuarios e permissoes
- `painel.html` — Painel geral por cards
- `tempo-linha.html` — Tempo da Linha
- `preparadores.html` — Atualizacoes operacionais
- `apoio.html` — Pedidos de ajuda
- `setup.html` — Setups e liberacao com ciclo 100%
- `historico.html` — Historico por TNL
- `relatorio.html` — Relatorio automatico

## Estrutura

CSS e JS ficam separados em `assets/`.

## API

A API base fica em `assets/js/core/config.js`.

## Cloudflare / D1

Arquivos criados para a proxima etapa:

- `sql/auth-v1.sql` — tabelas de usuarios, sessoes e logs
- `cloudflare/worker-auth-v4.js` — Worker com login, bootstrap admin e permissoes
- `docs/ORDEM-DE-INSTALACAO.md` — passo a passo de instalacao

## Ordem recomendada

1. Executar `sql/auth-v1.sql` no D1.
2. Publicar `cloudflare/worker-auth-v4.js` no Worker.
3. Testar `/status`.
4. Criar primeiro admin em `/auth/bootstrap-admin`.
5. Ligar `login.html` e `admin.html` nas rotas reais.
