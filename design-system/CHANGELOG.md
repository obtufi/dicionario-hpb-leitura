# Design System HPB — histórico de versões

Formato: [versionamento semântico](https://semver.org/lang/pt-BR/). Toda mudança em
`web/design-system/` atualiza este arquivo e o campo `version` de `design-system.json`.

- **MAJOR**: remove ou renomeia token, classe ou parâmetro de componente.
- **MINOR**: adiciona token, componente, variante ou parâmetro compatível.
- **PATCH**: corrige estilo ou comportamento sem mudar a API.

## 1.4.0 — 2026-11-03

- Tema escuro em escopo `[data-tema="escuro"]` (tokens.css): cores semânticas e tons sobre a
  paleta `--ink-*`, que ganha `-900`, `-700`, `-600`, `-500` e `-400`.
- Mapa mental na janela inteira: modificador `app--imersivo` da casca (sem cabeçalho e sem
  navegação lateral) e bloco `mindmap` refeito: palco em toda a área, `__overlay` com a barra
  `__toolbar` (`__title`, `__heading`, `__counts`) e o corpo `__body`, em que `__settings`
  (esquerda) e `__side` (direita) flutuam sobre o grafo.

## 1.3.0 — 2026-11-03

- Versão somente leitura: bloco de layout `leitura-entrada` (`__card`, `__eyebrow`, `__title`,
  `__lead`, `__status`) para a tela de senha, e variante `actor-chip--static` (aviso fixo no
  cabeçalho, sem ação), usada no lugar da autoria.

## 1.2.0 — 2026-11-03

- Componente `Slider({ label, value, min, max, step, format, hint, onInput, onChange, disabled })`:
  controle deslizante com rótulo, valor exibido ao lado (também em `aria-valuetext`) e dica;
  classes `slider`, `slider__header`, `slider__label`, `slider__value`, `slider__input` e
  `slider--disabled`.
- Mapa mental: painel de ajustes sobre o palco (`mindmap__settings`, `__settings-header`,
  `__settings-title`, `__settings-footer`), com velocidade da construção, forças e exibição.
- Ícone `sliders`.

## 1.1.0 — 2026-11-03

- Mapa mental (`#/mapa-mental`): tokens `--color-graph-*` (fundo escuro do palco, ligações
  com transparência própria, rótulos, destaque, anel de revisão em curso, raiz e
  `--color-graph-area-1` … `-15`, uma cor por área), apoiados na paleta crua nova
  `--ink-*` e `--hue-1` … `-15`; bloco de layout `mindmap` (barra, palco com canvas e
  indicador, painel do nó, legenda das áreas com `mindmap__swatch--1` … `-15`), que
  empilha abaixo de 1280px.
- Ícones `share-2`, `maximize`, `refresh-cw`, `pause` e `play`.

## 1.0.1 — 2026-11-02

- `html` ganha `scroll-padding-top` (altura do cabeçalho + `--space-4`): ao abrir um
  link com âncora ou usar `scrollIntoView`, o alvo para abaixo do cabeçalho fixo em
  vez de ficar escondido por ele. Usado pelo destaque de uma decisão do mapa
  (`#/mapa/decisoes?id=…`).

## 1.0.0 — 2026-10-28

Primeira versão, criada com a área Cadastro → Identificadores do registro.

- Tokens: paleta crua, cores semânticas (superfícies, texto, bordas, cabeçalho,
  painel humano × técnico, diferenças), tons `neutral`, `info`, `success`,
  `warning`, `danger`, `accent`, `teal`, tipografia, espaçamento, dimensões,
  raios, sombras, camadas e movimento.
- Layouts: casca `app` (cabeçalho, navegação lateral em gaveta < 960px),
  `nav`, `page-header`, `breadcrumbs`, `stack`, `cluster`, `grid`, `toolbar`,
  `split`, `compare`, `section`, `action-bar`.
- Componentes: `Icon`, `Button`, `Badge`, `Field`, `Fieldset`, `TextInput`,
  `TextArea`, `Select`, `Checkbox`, `SearchInput`, `EditableList`, `DataTable`,
  `Tabs`, `Toolbar`, `Panel` (variantes `human`, `technical`, `source`, `attention`),
  `PageHeader`, `Breadcrumbs`, `Section`, `Alert`, `toast`, `openModal`,
  `confirmDialog`, `formDialog`, `ProgressBar`, `Stat`, `StatGrid`,
  `EmptyState`, `LoadingBlock`, `Spinner`, `KeyValueList`, `DiffView`,
  `Timeline`, `Disclosure`, `ItemRef`, `SaveStatus`, `Swatch`.
