# Neodent CNC

**Neodent CNC** sera reconstruido com foco no fluxo real dos **preparadores e tecnicos de turno**.

O objetivo agora e parar de remendar telas antigas e criar uma base limpa para:

```text
Login
  -> Escolher celula
  -> Linha
  -> Atividade
  -> Historico
```

> Regra de inicio: o desenvolvimento novo so deve comecar depois do OK explicito do Lucas.

---

## Decisao principal

O fluxo antigo com varias paginas soltas nao sera usado como base principal.

As telas antigas ficam congeladas enquanto o novo fluxo e criado em paralelo.

Telas antigas que nao devem guiar o novo desenvolvimento:

```text
ronda.html
apoio.html
setup.html
painel.html
relatorio.html
index.html
```

Novo fluxo oficial:

```text
login.html
preparador-celula.html
preparador-linha.html
preparador-atividade.html
preparador-historico.html
```

Menu apos escolher a celula:

```text
Linha | Atividade | Historico
```

Nao existe mais uma tela separada chamada **Passagem**. A propria tela **Atividade** sera a passagem viva do turno.

---

## Perfis de acesso

| Perfil | Acesso | Regra |
|---|---|---|
| Preparador | Janela do proprio turno | Nao ve Atividade do turno anterior antes do seu turno. |
| Tecnico | Janela do proprio turno | Mesma regra do preparador. |
| Lider | 24h | Ve todos os turnos, paineis e historicos. |
| Gerencia | 24h | Ve todos os turnos, paineis e historicos. |
| Admin | 24h | Gerencia usuarios, regras e parametros. |

---

## Turnos e janelas de acesso

| Turno | Horario do turno | Libera acesso | Fecha acesso |
|---|---:|---:|---:|
| 1ºT | 06:30 as 14:30 | 06:00 | 15:00 |
| 2ºT | 14:30 as 22:30 | 14:00 | 23:00 |
| 3ºT | 22:30 as 06:30 | 22:00 | 07:00 |

### Regra de sobreposicao

Pode existir sobreposicao de acesso entre turnos, mas cada usuario operacional fica preso ao painel do proprio turno.

Exemplo:

```text
14:10
1ºT ainda ve o Atividade do 1ºT.
2ºT entra em pre-turno, mas nao ve o Atividade do 1ºT.

14:30
2ºT inicia com painel proprio.
1ºT ainda pode acessar o proprio fechamento ate 15:00.
```

Lider e Gerencia ficam fora desse bloqueio.

---

## Login e pre-turno

Depois do login, o sistema verifica:

```text
usuario
cargo
turno
nivel de acesso
horario atual
janela de acesso
```

Antes da liberacao:

```text
Acesso bloqueado
Seu turno ainda nao foi liberado.
Libera as HH:MM.
```

Durante o pre-turno:

```text
Seu acesso ja esta liberado.
Seu turno inicia as HH:MM.

[Escolher celula]
[Historico]
```

Apos inicio do turno:

```text
Linha | Atividade | Historico
```

---

## Escolha da celula

Apos login e liberacao, preparador/tecnico escolhe a celula onde vai tirar tempo.

Tela:

```text
ESCOLHA A CELULA

[ 1 ] [ 2 ]
[ 3 ] [ 4 ]
[ 5 ] [ 6 ]
[ 7 ] [ 8 ]
[ 9 ] [10 ]
```

A escolha abre a Linha daquela celula. Deve ser possivel trocar de celula depois.

---

## Linha

A tela **Linha** e o monitor vivo da celula.

Objetivos:

- Tirar tempo das maquinas.
- Monitorar previsao de encerramento.
- Mostrar contador estimado de pecas.
- Mostrar pecas restantes.
- Ajudar o preparador a se programar para buscar materia-prima, vistoriar fluxo e antecipar setup.
- Enviar situacoes relevantes para a tela Atividade.

### Regra do clique na maquina

| Situacao | Clique | Resultado |
|---|---|---|
| Sem leitura | Abre tirar tempo | Formulario de ciclo, meta, produzidas, MP, item e acao. |
| Com leitura | Abre detalhe vivo | Mostra informacoes calculadas, previsao e contador. Nao abre formulario direto. |
| Precisa alterar | Botao Alterar dados | Abre configuracao da leitura da maquina. |

### Detalhe vivo da maquina

Exemplo:

```text
TNL 095
Item 465777

Producao estimada: 312 / 790
Faltam: 478 pecas
Ciclo: 2m46s
Previsao: 21:38
Tempo restante: 2h31
MP: suficiente / falta MP
Proxima acao: Setup vermelho / Sequencia / Ajuste

[Corrigir produzidas]
[Alterar dados]
[Adicionar observacao]
[Enviar/atualizar Atividade]
```

### Contador estimado

Ao salvar uma leitura, o sistema guarda:

```text
produzidas_inicial
horario_leitura
ciclo_segundos
meta_op
pecas_mp
previsao_fim
```

A tela calcula em tempo real:

```text
pecas_estimadas = tempo_passado / ciclo
produzidas_agora = produzidas_inicial + pecas_estimadas
faltam = meta_op - produzidas_agora
tempo_restante = faltam * ciclo
```

O preparador pode corrigir as produzidas reais quando a maquina nao estiver fluindo conforme o previsto.

---

## Atividade

A tela **Atividade** e o painel geral da fabrica para o turno.

Ela substitui o modelo manual de passagem do WhatsApp.

Ordem oficial dos blocos:

```text
MAQUINAS EM SETUP
MAQUINAS EM AJUSTES
PROXIMOS SETUPS
SETUPS 3ºT
MAQUINAS EM MANUTENCAO
-----------------------
ULTIMAS MOVIMENTACOES
-----------------------
PRECISANDO DE APOIO
-----------------------
CONCLUIDAS (minimizado)
```

### Maquinas em setup

Mostra setups acontecendo agora.

O card deve exibir:

```text
numero da TNL
cor do setup
quem esta fazendo
status
```

Exemplo:

```text
Setup vermelho - TNL 044 - NATTAN
Setup vermelho - TNL 057 - EVERSON
Setup vermelho - TNL 096 - MARCIO
```

### Maquinas em ajustes

Mostra ajustes acontecendo agora.

Exemplo:

```text
TNL 031 - CHRISTOFFER
TNL 037 - LUCAS V
TNL 052 - WILLIANS
```

Se alguem aceitou apoio em um ajuste, o nome aparece normalmente em **Maquinas em ajustes**.

Nao existe categoria de apoio concluido.

### Proximos setups

Mostra setups previstos para o turno atual, ordenados pelo horario previsto.

Exemplo:

```text
Setup vermelho - TNL 112 - Setup 2ºT (18:20)
Setup vermelho - TNL 093 - Setup 2ºT (18:30)
Setup azul - TNL 074 - Setup 2ºT (19:30)
```

Quando iniciar, sai de **Proximos setups** e entra em **Maquinas em setup**.

### Setups 3ºT

Mostra setups que ficarao para o proximo turno.

No 2ºT, o bloco aparece como:

```text
SETUPS 3ºT
```

No futuro, o nome pode ser calculado conforme o turno atual.

### Maquinas em manutencao

Manutencao nao e feita pela equipe de preparacao.

A preparacao registra apenas o parecer/chamado para outro setor.

Nao deve ter:

```text
Assumir
Iniciar
Indicar preparador
```

Campos previstos:

```text
TNL
Descricao
Chamado aberto? Sim/Nao
Numero do chamado opcional
Observacao
```

---

## Apoio

Apoio nao e tipo de atividade independente.

Apoio e uma condicao de uma atividade de **setup** ou **ajuste**.

Manutencao nao pergunta apoio.

Fluxo:

```text
Escolhe Setup ou Ajuste
Preenche TNL e informacoes principais
Pergunta: Precisa de apoio?

Se NAO:
  - Eu mesmo
  - Indicar nome

Se SIM:
  - Escreve mensagem de apoio
  - Aparece no bloco Precisando de apoio
  - Alguem aceita e vira responsavel do setup/ajuste
```

Bloco Precisando de apoio:

```text
PRECISANDO DE APOIO

TNL 087
Setup vermelho - Quebrando bedame. alguem disponivel?
Solicitado por Lucas V

[Estou indo]
```

Depois que alguem aceita:

- Se era ajuste, aparece em **Maquinas em ajustes** com o nome de quem aceitou/faz.
- Se era setup, aparece em **Maquinas em setup** com o nome de quem aceitou/faz.
- Ao concluir, vai para **Concluidas** dentro da categoria principal.
- Nao existe categoria **Apoios** em Concluidas.

---

## Concluidas

**Concluidas** deve aparecer na tela, mas sempre minimizado por padrao.

Ao abrir, separa por categoria principal:

```text
CONCLUIDAS 12 [fechado]

Ao abrir:

MAQUINAS EM SETUP
OK - Setup vermelho - TNL 096 - MARCIO
OK - Setup vermelho - TNL 044 - NATTAN

MAQUINAS EM AJUSTES
OK - TNL 087 - WENDEL
OK - TNL 037 - LUCAS V

MAQUINAS EM MANUTENCAO
OK - TNL 055 - Manutencao liberada
```

Nao existe categoria de apoio nas concluidas.

---

## Ultimas movimentacoes

Fica abaixo da situacao do setor e acima de Precisando de apoio.

Deve ser simples, curto e sem excesso de informacao.

Exemplo:

```text
Luciano iniciou setup na TNL 098
Wendel aceitou apoio na TNL 087
Lucas V concluiu ajuste na TNL 037
Lucas V abriu chamado de manutencao na TNL 055
```

---

## Botao + Adicionar no Atividade

No topo da tela Atividade deve existir um botao:

```text
+ Adicionar
```

Opcoes principais:

```text
Setup
Ajuste
Manutencao
```

| Tipo | Campos | Pergunta apoio? | Destino |
|---|---|---|---|
| Setup | TNL, cor, status, responsavel ou apoio, horario previsto quando aplicavel | Sim | Maquinas em setup, Proximos setups ou Setups 3ºT |
| Ajuste | TNL, responsavel ou apoio, detalhe opcional | Sim | Maquinas em ajustes |
| Manutencao | TNL, descricao, chamado aberto, numero do chamado opcional | Nao | Maquinas em manutencao |

---

## Historico

O Historico salva somente como terminou a tela **Atividade** do turno.

Salva:

```text
Maquinas em setup
Maquinas em ajustes
Proximos setups
Setups 3ºT / proximo turno
Maquinas em manutencao
Ultimas movimentacoes
Precisando de apoio
Concluidas
```

Nao salva:

```text
tempo das linhas
contador estimado de pecas
leitura individual da celula
detalhes internos de cada tomada de tempo
```

Exemplo:

```text
HISTORICO

30/06/2026 - 2ºT - Ver fechamento
30/06/2026 - 1ºT - Ver fechamento
29/06/2026 - 3ºT - Ver fechamento
```

---

## Dados base

### Atividade

```json
{
  "id": "atividade_001",
  "turno": "2T",
  "data_operacional": "2026-06-30",
  "tipo": "SETUP",
  "grupo": "MAQUINAS_EM_SETUP",
  "tnl": "087",
  "setup_nivel": "vermelho",
  "responsavel_nome": "WENDEL",
  "status": "EM_ANDAMENTO",
  "precisa_apoio": false,
  "apoio_mensagem": "",
  "descricao": "",
  "horario_previsto": "18:20",
  "concluido": false,
  "criado_por_nome": "Lucas V",
  "criado_em": "2026-06-30T14:45:00"
}
```

### Leitura da Linha

```json
{
  "id": "leitura_001",
  "turno": "2T",
  "celula": "5",
  "tnl": "095",
  "item": "465777",
  "ciclo_segundos": 166,
  "meta_op": 790,
  "produzidas_inicial": 312,
  "horario_leitura": "2026-06-30T15:00:00",
  "pecas_mp": 520,
  "previsao_fim": "2026-06-30T21:38:00",
  "acao": "SETUP_VERMELHO"
}
```

### Fechamento de Historico

```json
{
  "id": "fechamento_2026-06-30_2T",
  "turno": "2T",
  "data_operacional": "2026-06-30",
  "fechado_em": "2026-06-30T23:00:00",
  "snapshot_atividade": {
    "maquinas_em_setup": [],
    "maquinas_em_ajustes": [],
    "proximos_setups": [],
    "setups_3t": [],
    "maquinas_em_manutencao": [],
    "ultimas_movimentacoes": [],
    "precisando_apoio": [],
    "concluidas": []
  }
}
```

---

## Estrutura nova sugerida

```text
preparador-celula.html
preparador-linha.html
preparador-atividade.html
preparador-historico.html

assets/css/preparador.css

assets/js/preparador/session.js
assets/js/preparador/store.js
assets/js/preparador/celula.js
assets/js/preparador/linha.js
assets/js/preparador/atividade.js
assets/js/preparador/historico.js
```

---

## Ordem de desenvolvimento

1. Login + guard de turno.
2. Escolha da celula.
3. Linha nova com tirar tempo, detalhe vivo e alterar dados.
4. Store local para prototipo.
5. Atividade nova com blocos oficiais.
6. Apoio como condicao de setup/ajuste.
7. Concluidas minimizado por categoria.
8. Historico com snapshot do Atividade.
9. Migrar para Worker/D1 depois do fluxo aprovado.

---

## Pontos a validar antes de codar

- Lista oficial de TNLs por celula 1 a 10.
- Nomes oficiais dos preparadores/tecnicos.
- Se o bloco Setups 3ºT deve mudar automaticamente conforme o turno.
- Se o fechamento no Historico sera automatico, manual por Lider/Gerencia, ou os dois.
- Cargos exatos no login: Preparador, Tecnico, Lider, Gerencia e Admin.

---

## Status

```text
Documento PDF gerado para analise.
README atualizado com a arquitetura nova.
Aguardando OK do Lucas para iniciar o desenvolvimento.
```
