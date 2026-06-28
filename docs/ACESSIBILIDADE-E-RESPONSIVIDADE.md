# Acessibilidade e Responsividade

Este documento registra uma regra técnica importante do Neodent CNC: o app deve respeitar o tamanho de fonte e zoom que o usuário usa no dispositivo.

## Regra principal

Não criar tela com medidas fixas que quebram quando a pessoa usa letra grande no iPhone, Android ou navegador.

O sistema deve usar:

- `rem` para fonte, espaçamento e boa parte das medidas.
- `clamp()` para escala fluida.
- `auto-fit` e `minmax()` para grids que se reorganizam sozinhos.
- `min-height: var(--touch-min)` para botões e inputs com área de toque mínima.
- `env(safe-area-inset-bottom)` para não esconder botões atrás da barra do iPhone.
- `100dvh` quando fizer sentido para altura real da tela móvel.

## Evitar

- Fonte fixa em `px`.
- Grid fixo que força duas colunas em tela estreita.
- Botão fixo atrás da barra do navegador.
- Texto com `nowrap` quando pode quebrar a tela.
- Card com largura fixa.
- Layout que depende de um único tamanho de iPhone.

## Padrão visual

A base global está em:

```text
assets/css/tokens.css
assets/css/reset.css
assets/css/layout.css
assets/css/components/forms.css
assets/css/components/buttons.css
```

A Ronda usa a mesma regra em:

```text
assets/css/pages/ronda.css
```

## Escala de fonte

A escala oficial fica em `tokens.css`:

```text
--font-xs
--font-sm
--font-md
--font-lg
--font-xl
--font-2xl
```

Todas usam `rem` e `clamp()`. Assim, quando o usuário aumenta a fonte do dispositivo/navegador, o app acompanha melhor.

## Regra de teste

Toda tela nova precisa ser testada em pelo menos três situações:

1. iPhone com fonte normal.
2. iPhone com fonte grande.
3. Android ou Chrome mobile com zoom/fonte maior.

A tela está correta quando:

- Não corta texto importante.
- Não joga botão para trás da barra inferior.
- Não obriga rolagem horizontal.
- Campos continuam tocáveis.
- Cards continuam entendíveis.
- O layout pode empilhar colunas quando não couber.
