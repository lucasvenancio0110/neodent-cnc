# Design System Operacional — Neodent CNC

Este documento define o padrão visual global do app. Toda tela nova ou ajuste visual deve seguir este padrão.

## Objetivo

O app deve parecer uma ferramenta de fábrica: rápido, compacto, visual e direto. A interface não deve parecer site, relatório ou formulário gigante.

## Regra principal

Menos texto, mais decisão visual.

A tela precisa responder rápido:

- O que está tranquilo?
- O que precisa olhar depois?
- O que é ação agora?
- Quem assumiu?
- Qual máquina?

## Cores oficiais por tipo

```text
Setup       = azul
Ajuste      = laranja
Manutenção  = vermelho
Apoio       = roxo
Sequência   = cinza/neutro
Produzindo  = verde bem discreto
Sem leitura = cinza escuro apagado
```

## Setup por nível

Setup sempre precisa acompanhar o emoji do nível junto da máquina:

```text
🔴 TNL 094 = Setup vermelho
🟢 TNL 094 = Setup verde
🔵 TNL 094 = Setup azul
```

O card pode continuar azul por ser setup, mas o nível precisa aparecer no emoji e no detalhe.

## Ronda

A Ronda é uma grade de máquinas por célula. Não deve ser formulário aberto com rolagem.

Fluxo:

```text
Célula -> cards pequenos das TNLs -> clique na máquina -> modal central -> salvar -> card muda de estado
```

Cards da Ronda:

```text
Sem leitura  = apagado
Estável      = discreto
Próximo      = amarelo
Neste turno  = vermelho
Setup        = azul + emoji do nível
Manutenção   = vermelho
Apoio        = roxo
Ajuste       = laranja
```

## Modal da Ronda

O modal deve ser central, compacto e guiado.

Não usar sheet grudado no rodapé para fluxo principal da Ronda.

Etapas:

```text
1/4 OP
2/4 MP
3/4 Resultado
4/4 Decisão
```

Cada etapa deve ter poucos campos e quase nenhum texto explicativo.

## Painel da fábrica

O painel deve ser visão de liderança, não relatório.

Deve mostrar:

- Setup
- Ajuste
- Manutenção
- Apoio
- Cards vivos filtráveis

Card do painel deve ser curto:

```text
🔴 TNL 094
Setup vermelho
21:38 • Falta MP • Preset trouxe
Lucas
```

## Animações

Usar microinterações curtas:

- Entrada suave dos cards
- Modal central com escala curta
- Troca de etapa rápida
- Feedback de salvamento
- Pulso leve só para crítico

Sempre respeitar `prefers-reduced-motion`.

## Arquivos principais

```text
assets/css/components/ops-design.css
assets/css/pages/ronda-card-status.css
assets/css/pages/ronda-motion-polish.css
```

## Regra de manutenção

Antes de mudar uma tela, perguntar:

```text
Essa tela segue o mesmo padrão de cor?
Essa tela tem texto demais?
O card mostra prioridade sem precisar ler tudo?
O botão principal está claro?
O modal cabe no celular?
```
