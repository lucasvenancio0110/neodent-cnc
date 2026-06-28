# Neodent CNC

**Neodent CNC** é um painel vivo da linha, alimentado pela ronda do preparador.

O objetivo do sistema é transformar a leitura de tempo das máquinas em decisão operacional: previsão de encerramento, solicitação de preset, setup planejado, atividade assumida, histórico e relatório automático.

> Fluxo oficial: **Ronda calcula → decisão vira card → preparador assume → conclui → histórico e relatório saem sozinhos.**

---

## Estado atual do projeto

Base já criada e funcionando:

- GitHub Pages com telas HTML/CSS/JS.
- Worker Cloudflare publicado.
- Banco Cloudflare D1 conectado.
- Login operacional.
- Admin operacional.
- Cadastro de usuários.
- Worker V5 Core publicado.
- Documento mestre do fluxo oficial em `docs/NEODENT-CNC-DOCUMENTO-MESTRE.md`.
- Primeira versão da tela **Ronda** criada.

---

## Conceito principal

O app não é um formulário de pedido de ajuda.

O preparador abre o app, faz a ronda das máquinas, tira o tempo e o sistema calcula:

- Se a máquina vai encerrar.
- Quando vai encerrar.
- Se encerra neste turno, próximo turno ou se está estável.
- Se o motivo é meta da OP ou falta de matéria-prima.
- Se precisa solicitar preset.
- Qual será a próxima ação: sequência, setup azul, setup verde, setup vermelho, falta MP, manutenção ou aguardando definição.

Quando existe uma ação relevante, o sistema gera um card vivo para a liderança.

---

## Fluxograma oficial

```text
LOGIN
  ↓
COCKPIT DO TURNO
  ↓
RONDA DO PREPARADOR
  ↓
TIRA TEMPO DA MÁQUINA
  ↓
SISTEMA CALCULA ENCERRAMENTO
  ↓
┌─────────────────────────┬─────────────────────────────┐
│ NÃO ENCERRA             │ ENCERRA EM MENOS DE 16H      │
│ ↓                       │ ↓                            │
│ Salva leitura estável   │ Escolhe próxima ação         │
│ ↓                       │ ↓                            │
│ Histórico               │ Preset já trouxe?            │
│                         │ ↓                            │
│                         │ Gera card no painel          │
└─────────────────────────┴─────────────────────────────┘
                            ↓
                       PAINEL VIVO
                            ↓
                 Preparador assume atividade
                            ↓
                    Executa ajuste/setup
                            ↓
                         Conclui
                            ↓
                       Histórico
                            ↓
                       Relatório
```

---

## Telas oficiais

### `index.html` — Cockpit
Entrada do sistema. Deve priorizar o fluxo correto: Ronda, Painel Vivo, Minha Atividade, Liberar Setup, Histórico, Relatório e Admin.

### `login.html` — Login
Autenticação dos usuários pelo Worker e D1.

### `admin.html` — Admin
Cadastro de usuários, funções e permissões.

Funções principais:

- `PREPARADOR`
- `TECNICO`
- `LIDER`
- `GERENCIA`
- `ADMIN`

### `ronda.html` — Ronda / Tempo da Linha
Tela principal do preparador.

O preparador informa:

- Máquina / TNL.
- Ciclo.
- Matéria-prima.
- Barras inteiras.
- Meta da OP.
- Peça em mm.
- Produzidas, quando necessário.

O sistema calcula:

- Previsão de encerramento.
- Tempo restante.
- Saldo da OP.
- Capacidade com MP.
- Motivo do encerramento.
- Status operacional.

Se a máquina vai encerrar em menos de 16h, a tela abre a decisão:

- Sequência.
- Setup azul.
- Setup verde.
- Setup vermelho.
- Falta MP.
- Manutenção.
- Aguardando definição.

Também registra preset:

- Ainda não trouxe.
- Preset já trouxe.
- Item da próxima OP.
- Hora para solicitar.

### `painel.html` — Painel Vivo
Visão da liderança.

Deve agrupar os cards por prioridade:

- Encerra neste turno.
- Próximo turno.
- Aguardando ação.
- Em atendimento.
- Concluídos recentes.

### `apoio.html` — Minha Atividade
Esta tela deve evoluir para “Minha Atividade”.

Serve para o preparador:

- Ver fila de cards sem dono.
- Assumir ajuste/setup/atividade.
- Pausar quando necessário.
- Concluir atividade com observação.

### `setup.html` — Liberar Setup
Registro técnico de setup liberado.

Campos previstos:

- TNL.
- Item.
- Ciclo 100%.
- Tipo de setup.
- Observação.

Responsável e horário vêm do login.

### `historico.html` — Histórico
Linha do tempo por TNL, item, evento e responsável.

Deve responder:

- Quem mexeu?
- Quando mexeu?
- Qual item?
- Qual ciclo?
- Por que encerrou?
- Preset trouxe?
- Quem assumiu?
- Quem concluiu?

### `relatorio.html` — Relatório Automático
Saída final do turno a partir dos eventos e cards.

Blocos esperados:

- Encerra neste turno.
- Próximo turno.
- Preset pendente.
- Preset já trouxe.
- Atividades em andamento.
- Atividades concluídas.
- Setups liberados.
- Pendências.

---

## Motor da Ronda

Arquivo principal:

```text
assets/js/core/ronda-engine.js
```

Responsável por:

- Parser seguro de ciclo.
- Cálculo de turnos reais.
- Cálculo de matéria-prima.
- Cálculo de saldo OP.
- Cálculo de previsão.
- Classificação operacional.

### Parser de ciclo

Não usar `parseFloat` direto para ciclo.

O parser deve aceitar:

```text
1,20 = 1m20s
1:20 = 1m20s
90   = 90s
2,05 = 2m05s
```

Segundos após vírgula ou dois pontos não podem ser maiores ou iguais a 60.

### Turnos reais

```text
1º turno: 06:30 até 14:40
2º turno: 14:40 até 22:40
3º turno: 22:40 até 06:30
```

### Status operacional

```text
< 8h   = Neste turno
< 16h  = Próximo turno
>= 16h = Estável
```

### Motivo da previsão

```text
Se a capacidade com MP acaba antes da meta → Falta de matéria-prima
Se a meta é atingida antes da MP acabar   → Meta da OP atingida
```

---

## Cards vivos

Um card vivo nasce da leitura da Ronda.

Exemplo:

```text
TNL 093 — SETUP VERMELHO
Encerra neste turno — previsão 18:55
Preset pendente — Item 326172
Lido por Lucas às 17:59
```

Card assumido:

```text
TNL 093 — SETUP VERMELHO
Lucas assumiu às 18:05
Tempo em andamento: 12 min
```

Card concluído:

```text
TNL 093 — SETUP VERMELHO
Concluído por Lucas às 18:45
Observação: setup liberado, ciclo 100% OK
```

---

## Eventos oficiais

Cada ação importante deve virar evento.

Tipos previstos:

- `leitura_tempo`
- `previsao_calculada`
- `card_criado`
- `preset_pendente`
- `preset_trouxe`
- `setup_planejado`
- `atividade_assumida`
- `atividade_pausada`
- `atividade_concluida`
- `setup_liberado`
- `card_concluido`
- `relatorio_gerado`

O sistema deve conseguir reconstruir a vida da máquina no turno a partir desses eventos.

---

## Backend / API

API base:

```text
assets/js/core/config.js
```

Worker atual publicado em Cloudflare:

```text
https://neodent-cnc-api.lucassantanals0110.workers.dev
```

Rotas principais previstas/necessárias:

```text
/auth/login
/auth/me
/auth/logout
/admin/usuarios
/painel-geral
/abrir-ocorrencia
/assumir-ocorrencia
/concluir-ocorrencia
```

Rotas que devem evoluir para o fluxo final:

```text
/ronda/leituras
/ronda/gerar-card
/atividades
/atividades/:id/assumir
/atividades/:id/concluir
/setup/liberar
/historico/tnl/:tnl
/relatorio/turno
```

---

## Cloudflare / D1

Arquivos relevantes:

```text
sql/auth-v1.sql
cloudflare/worker-auth-v4.js
docs/ORDEM-DE-INSTALACAO.md
```

O Worker já foi consolidado em uma versão core maior durante o desenvolvimento. Evitar ficar criando Worker picado; novas telas devem usar rotas genéricas sempre que possível.

---

## Estrutura atual

```text
index.html
login.html
admin.html
ronda.html
painel.html
tempo-linha.html
preparadores.html
apoio.html
setup.html
historico.html
relatorio.html

assets/css/
assets/js/
assets/js/core/ronda-engine.js
assets/js/pages/ronda.js

docs/NEODENT-CNC-DOCUMENTO-MESTRE.md
```

---

## Regras de UX/UI

O app precisa ter cara de ferramenta de fábrica, não de site.

Deve ter:

- Mobile-first.
- Topo pequeno e fixo.
- Navegação inferior.
- Cards compactos.
- Botões grandes para ação.
- Poucos campos por etapa.
- Informação principal em destaque.
- Cores por prioridade.

Não deve ter:

- Hero gigante em toda tela.
- Textão operacional.
- Formulário longo sem necessidade.
- Card branco enorme sem hierarquia.
- Pergunta inútil de célula/linha na abertura.
- Tela travada em “carregando”.
- Botão escondido atrás da barra do navegador.

---

## Ordem de desenvolvimento daqui para frente

1. Finalizar `ronda.html` como tela principal do preparador.
2. Garantir que leitura salva gere card vivo corretamente.
3. Refazer `painel.html` para agrupar cards por prioridade.
4. Transformar `apoio.html` em `Minha Atividade`.
5. Conectar `setup.html` ao card assumido e ao histórico.
6. Criar histórico real por TNL/evento.
7. Fazer relatório automático puxando os eventos do turno.
8. Melhorar testes Playwright para cobrir Ronda → Painel → Atividade → Relatório.

---

## Pergunta obrigatória antes de criar qualquer função

```text
Essa tela ajuda a ronda virar decisão?
Essa decisão vira card?
Esse card pode ser assumido?
Essa ação vai para histórico?
Esse histórico alimenta o relatório?
```

Se a resposta for não, a função provavelmente está fora do fluxo principal.

---

## Documentação mestre

O documento oficial de memória do projeto está em:

```text
docs/NEODENT-CNC-DOCUMENTO-MESTRE.md
```

Ele deve ser usado como referência antes de qualquer alteração grande no app.
