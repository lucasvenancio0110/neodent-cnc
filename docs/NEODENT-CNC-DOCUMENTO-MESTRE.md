# NEODENT CNC - Documento Mestre do Fluxo Oficial

**Versão:** 1.0  
**Data:** 28/06/2026  
**Frase-mestra:** O Neodent CNC é um painel vivo da linha, alimentado pela ronda do preparador.

Este documento é a memória oficial do projeto. Toda tela, rota, regra de banco e decisão visual deve respeitar este fluxo.

---

## 1. Visão definitiva

O aplicativo não é um sistema de pedido de ajuda. Também não é apenas um relatório bonito. Ele é um sistema operacional de turno para prever encerramento de máquinas, organizar preset, mostrar setups/ajustes em andamento e gerar histórico/relatório automaticamente.

Fluxo-mestre:

```text
Ronda calcula -> decisão vira card -> preparador assume -> conclui -> histórico e relatório saem sozinhos.
```

O preparador faz só três coisas principais:

1. Tira tempo da máquina.
2. Informa a próxima ação quando a máquina vai encerrar.
3. Assume e conclui ajuste/setup/atividade.

O sistema faz o resto:

1. Calcula previsão.
2. Classifica prioridade.
3. Cria card vivo.
4. Mostra para liderança.
5. Salva histórico.
6. Monta relatório.

---

## 2. Papéis

### Preparador
- Faz a ronda das máquinas.
- Atualiza ciclo, OP, matéria-prima e produção.
- Informa próxima ação: sequência, setup azul, setup verde, setup vermelho, falta MP, manutenção ou aguardando definição.
- Informa se o preset já trouxe ou se ainda precisa solicitar.
- Assume ajuste/setup/atividade.
- Conclui atividade e libera setup.

### Técnico / Liderança
- Vê o painel vivo.
- Entende o que encerra neste turno, o que fica para o próximo turno, quem está em atividade e o que está sem dono.
- Usa a informação para priorizar preset, preparador, setup e manutenção.

### Gerência
- Consulta histórico e relatório.
- Enxerga gargalos, recorrências por máquina, turno e responsável.

### Admin
- Gerencia usuários, funções, permissões e configurações.

---

## 3. Fluxograma oficial

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

## 4. Tela principal: Ronda / Tempo da Linha

A Ronda é a tela principal do preparador. Ela substitui a ideia errada de “pedido de apoio”.

### Campos por máquina
- TNL / máquina.
- Ciclo.
- Meta da OP.
- Produzidas.
- Matéria-prima disponível.
- Comprimento da peça em mm.
- Gabaritos, se necessário.

### Modos de matéria-prima
- Barra cheia.
- Parcial em mm.
- Peças restantes.
- Barras inteiras no alimentador.

### O sistema calcula
- Saldo da OP.
- Peças disponíveis com MP.
- Tempo restante.
- Previsão de encerramento.
- Turno de encerramento.
- Motivo do encerramento: meta da OP ou falta de matéria-prima.

Exemplo de resultado:

```text
TNL 093
Vai encerrar neste turno
Previsão: 18:55
Restante: 4h05min
Motivo: Falta de matéria-prima
Saldo OP: 665
MP: 33
```

---

## 5. Regras de cálculo que não podem ser esquecidas

### Parser de ciclo
O parser precisa aceitar:

- `1,20` = 1 minuto e 20 segundos.
- `1:20` = 1 minuto e 20 segundos.
- `90` = 90 segundos.
- `2,05` = 2 minutos e 5 segundos.
- Segundos após vírgula/dois pontos não podem ser maiores ou iguais a 60.

Não usar `parseFloat` direto para ciclo.

### Turnos reais
- 1º turno: 06:30 até 14:40.
- 2º turno: 14:40 até 22:40.
- 3º turno: 22:40 até 06:30.

### Status
- Menos de 8h: NESTE TURNO.
- Menos de 16h: PRÓXIMO TURNO.
- Acima de 16h: ESTÁVEL.

### Motivo da previsão
- Se a capacidade com MP acaba antes da meta: motivo = Falta de matéria-prima.
- Se a meta é atingida antes da MP acabar: motivo = Meta da OP atingida.

---

## 6. Decisão após a leitura

Quando a máquina vai encerrar neste turno ou no próximo turno, o sistema abre a decisão operacional.

Pergunta:

```text
Qual é a próxima ação?
```

Opções:
- Sequência normal.
- Setup azul.
- Setup verde.
- Setup vermelho.
- Falta matéria-prima.
- Manutenção.
- Aguardando definição.

Depois pergunta:

```text
Preset já trouxe?
```

Opções:
- Sim, preset já trouxe.
- Não, ainda precisa solicitar.

Se ainda não trouxe, pedir:
- Item da próxima OP.
- Hora para solicitar, calculada automaticamente pela previsão.

Se já trouxe, registrar:
- Tipo de preset/setup.
- Responsável pela leitura.
- Horário da leitura.

---

## 7. Como nasce um card vivo

Um card vivo nasce de uma leitura da ronda, não de um pedido manual solto.

Exemplo:

```text
Leitura:
TNL 092
Previsão: 05:55
Status: Próximo turno
Próxima ação: Setup vermelho
Preset: ainda não trouxe
Item: 326172
Responsável: Lucas

Card:
TNL 092 - SETUP VERMELHO
Próximo turno - previsão 05:55
Preset pendente
Item 326172
Lido por Lucas às 17:59
```

---

## 8. Painel Vivo da Liderança

O painel não deve ser uma lista solta. Ele deve agrupar por prioridade operacional.

Blocos oficiais:

1. Encerra neste turno.
2. Próximo turno.
3. Aguardando ação.
4. Em atendimento.
5. Concluídos recentes.

A liderança precisa entender em poucos segundos:

- O que vai encerrar.
- O que é setup vermelho.
- O que precisa de preset.
- Quem está em ajuste/setup.
- Quem está livre.
- O que está sem dono.

Card compacto:

```text
TNL 093 - SETUP VERMELHO
Encerra neste turno - 18:55
Preset pendente - Item 326172
Lucas tirou tempo às 17:59

[Assumir] [Concluir]
```

Quando assumido:

```text
TNL 093 - SETUP VERMELHO
Lucas assumiu às 18:05
Tempo em andamento: 12 min

[Concluir]
```

---

## 9. Minha Atividade

Tela do preparador após a ronda.

Quando livre:

```text
ATIVIDADES DISPONÍVEIS
TNL 085 - Setup vermelho - encerra 20:10
TNL 069 - Ajuste dimensional

[Assumir]
```

Quando em atividade:

```text
VOCÊ ESTÁ EM ATIVIDADE
TNL 085
Setup vermelho
Início: 18:05
Tempo em andamento: 12 min

[Pausar] [Concluir]
```

Ao concluir, pede observação curta e salva no histórico.

---

## 10. Liberar Setup

Tela técnica para registrar a liberação final do setup.

Campos:
- TNL.
- Item.
- Ciclo 100%.
- Tipo de setup: azul, verde ou vermelho.
- Observação.

Responsável e horário devem vir automáticos pelo login.

Evento gerado:

```text
TNL 112 - Setup vermelho liberado
Item 327161
Ciclo 06:37,2
Responsável Lucas
Horário 18:32
```

Este evento atualiza painel, histórico e relatório.

---

## 11. Histórico

Tudo precisa virar evento. O histórico por TNL deve ser uma linha do tempo.

Exemplo:

```text
TNL 093
17:59 - Lucas tirou tempo
18:00 - Sistema calculou: encerra neste turno
18:01 - Próxima ação: Setup vermelho
18:01 - Preset pendente
18:10 - Marcio assumiu setup
18:45 - Setup liberado
18:46 - Card concluído
```

O histórico precisa responder:
- Quem mexeu?
- Quando mexeu?
- Qual item?
- Qual ciclo?
- Por que encerrou?
- Preset trouxe?
- Quem assumiu?
- Quem concluiu?

---

## 12. Relatório automático

O relatório deve ser consequência dos eventos, não preenchimento manual.

Blocos:
- Encerra neste turno.
- Próximo turno.
- Preset pendente.
- Preset já trouxe.
- Atividades em andamento.
- Atividades concluídas.
- Setups liberados.
- Pendências.

Exemplo:

```text
2º TURNO - SITUAÇÃO DA LINHA

ENCERRA NESTE TURNO
TNL 093 - Setup Vermelho - 18:55 - Preset pendente
TNL 067 - Falta MP - 20:10

PRÓXIMO TURNO
TNL 092 - Setup Verde - 05:55 - Preset já trouxe

EM ATENDIMENTO
Lucas - Ajuste TNL 069 - desde 18:02

SETUPS LIBERADOS
TNL 112 - Item 327161 - Ciclo 06:37,2 - Lucas
```

Botão final:

```text
Copiar para WhatsApp
```

---

## 13. Eventos oficiais do banco

Cada ação importante deve salvar um evento.

Tipos principais:
- leitura_tempo.
- previsao_calculada.
- card_criado.
- preset_pendente.
- preset_trouxe.
- setup_planejado.
- atividade_assumida.
- atividade_pausada.
- atividade_concluida.
- setup_liberado.
- card_concluido.
- relatorio_gerado.

A máquina tem uma vida dentro do turno. O sistema deve conseguir reconstruir essa vida a partir dos eventos.

---

## 14. Estrutura de telas definitiva

1. Cockpit do turno.
2. Ronda.
3. Painel Vivo.
4. Minha Atividade.
5. Liberar Setup.
6. Histórico.
7. Relatório.
8. Admin.

Telas antigas que devem ser absorvidas:
- Preparadores vira Ronda.
- Apoio vira Minha Atividade.
- Tempo Linha vira motor da Ronda.
- Setup continua, mas conectado à atividade e histórico.
- Relatório puxa tudo automaticamente.

---

## 15. Regras de UX/UI

O app precisa ter cara de ferramenta de fábrica, não de site.

Deve ter:
- Mobile-first.
- Topo pequeno e fixo.
- Navegação inferior: Ronda, Painel, Atividade, Setup, Mais.
- Cards compactos.
- Botões grandes para ação.
- Poucos campos por etapa.
- Informação principal em destaque.
- Cores por prioridade.

Não deve ter:
- Hero gigante em toda tela.
- Textão explicativo na operação.
- Formulário longo sem necessidade.
- Card branco enorme sem hierarquia.
- Pergunta inútil de célula/linha na abertura.
- Tela travada em “carregando”.
- Botão escondido atrás da barra do navegador.

Regra sobre linha/célula:
- Linha e célula podem ser a mesma referência operacional.
- Não perguntar isso ao preparador quando não for necessário.
- Se precisar, usar cadastro padrão do usuário ou da máquina.

---

## 16. Implementação no GitHub

O novo `neodent-cnc` deve usar o `tempodalinha` como base conceitual e técnica da Ronda.

Etapas:
1. Criar `ronda.html`.
2. Extrair motor de cálculo do Tempo da Linha para um módulo JS reaproveitável.
3. Salvar leituras no Worker/D1.
4. Quando a leitura indicar encerramento em menos de 16h, gerar card vivo.
5. Refazer Painel Vivo com grupos por prioridade.
6. Criar Minha Atividade para assumir/concluir.
7. Conectar Liberar Setup ao card e ao histórico.
8. Gerar relatório automático a partir dos eventos.

---

## 17. Pergunta obrigatória antes de criar qualquer tela

Antes de criar ou alterar qualquer módulo, validar:

```text
Essa tela ajuda a ronda virar decisão?
Essa decisão vira card?
Esse card pode ser assumido?
Essa ação vai para histórico?
Esse histórico alimenta o relatório?
```

Se a resposta for não, a função provavelmente está fora do fluxo principal.

**Frase definitiva:**

```text
Neodent CNC é um painel vivo da linha, alimentado pela ronda do preparador.
```
