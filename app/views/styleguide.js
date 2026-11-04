/**
 * Catálogo vivo do Design System: tokens, componentes e componentes de domínio,
 * renderizados com as mesmas fábricas usadas pelas telas. Os exemplos usam
 * dados neutros — nenhum conteúdo aqui é definição do dicionário.
 */
import {
  Alert, Badge, Button, Checkbox, DataTable, DiffView, Disclosure, EditableList, EmptyState, Field, ICON_NAMES, Icon, ItemRef,
  KeyValueList, PageHeader, Panel, ProgressBar, SaveStatus, SearchInput, Section, Select, Slider, Spinner, Stat, StatGrid, Swatch, Tabs,
  TextArea, TextInput, Timeline, confirmDialog, formDialog, h, toast,
} from '/design-system/components.js';
import { CONCEPT_STATUS, KINDS, REVISION_STATUS } from '/shared/semantic-model.js';
import { wordDiff } from '/shared/diff.js';
import {
  ConceptStatusBadge, KindBadge, MAP_CLASSIFICATIONS, MapClassificationBadge, OriginBadge, RevisionStatusBadge,
} from '../components/domain.js';

const COLOR_TOKENS = [
  ['--color-bg', 'Fundo da aplicação'], ['--color-surface', 'Superfícies (painéis, tabelas)'], ['--color-surface-muted', 'Superfície discreta'],
  ['--color-surface-sunken', 'Superfície rebaixada'], ['--color-border', 'Borda padrão'], ['--color-border-strong', 'Borda de controles'],
  ['--color-text', 'Texto'], ['--color-text-muted', 'Texto secundário'], ['--color-text-subtle', 'Texto discreto'],
  ['--color-primary', 'Ação principal'], ['--color-danger', 'Ação destrutiva'], ['--color-focus', 'Anel de foco'],
  ['--color-header-bg', 'Cabeçalho'], ['--color-human-accent', 'Definição humana'], ['--color-technical-bg', 'Metadado técnico'],
  ['--color-diff-added-bg', 'Diferença: inclusão'], ['--color-diff-removed-bg', 'Diferença: remoção'],
  ['--color-graph-bg', 'Mapa mental: fundo'], ['--color-graph-area-1', 'Mapa mental: cor de uma área (1 a 15)'], ['--color-graph-draft', 'Mapa mental: revisão em curso'],
];
const TONES = ['neutral', 'info', 'success', 'warning', 'danger', 'accent', 'teal'];

function Example(title, description, ...children) {
  return Section({ title, description, headingLevel: 3, children: [h('div', { class: 'stack' }, ...children)] });
}

export async function render(ctx) {
  ctx.setTitle('Design System');
  let meta = { version: '?', updated: '' };
  try {
    meta = await (await fetch('/design-system/design-system.json')).json();
  } catch {
    // catálogo segue funcionando sem o arquivo de versão
  }

  const tokens = Panel({
    title: 'Tokens',
    icon: 'pen-tool',
    children: [h('div', { class: 'stack stack--lg' },
      Example('Cores semânticas', 'Use sempre tokens semânticos; a paleta crua existe só em tokens.css.',
        h('div', { class: 'grid grid--auto' }, ...COLOR_TOKENS.map(([token, description]) => Swatch({ token, description })))),
      Example('Tons', 'Estados e categorias usam tons — nunca cores avulsas. O texto do indicador sempre acompanha a cor.',
        h('div', { class: 'cluster' }, ...TONES.map((tone) => Badge({ label: tone, tone, dot: true }))),
        h('div', { class: 'cluster' }, ...TONES.map((tone) => Badge({ label: tone, tone, variant: 'outline' })))),
      Example('Tipografia', 'Escala: --text-xs 12 · sm 13 · md 14 (corpo) · lg 16 · xl 20 · 2xl 24 · 3xl 30.',
        h('h1', {}, 'Título de página (2xl)'), h('h2', {}, 'Título de seção (xl)'), h('h3', {}, 'Subtítulo (lg)'),
        h('p', {}, 'Texto corrente (md) com ', h('a', { href: '#/design-system' }, 'link'), ' e ', h('code', {}, 'código mono'), '.'),
        h('p', { class: 'text-muted text-sm' }, 'Texto secundário (sm, muted).')),
      Example('Espaçamento, raios e dimensões', 'Base de 4px: --space-1 (4) · 2 (8) · 3 (12) · 4 (16) · 5 (20) · 6 (24) · 8 (32) · 10 (40) · 12 (48). Raios: sm 4 · md 6 · lg 10 · pill. Controles: 34px (sm 28px). Breakpoints: 640 · 960 · 1280px.'))],
  });

  const tableRows = [
    { id: 'EX-001', name: 'Exemplo A', kind: 'identificador', n: 3 },
    { id: 'EX-002', name: 'Exemplo B', kind: 'estrutural', n: 12 },
    { id: 'EX-003', name: 'Exemplo C', kind: 'observavel', n: 7 },
  ];

  const invalidField = Field({ label: 'Campo com erro', control: TextInput({ value: 'valor inválido' }), required: true });
  invalidField.setError('Mensagem de erro específica e acionável.');
  const saveStatus = SaveStatus();

  const components = Panel({
    title: 'Componentes',
    icon: 'grid',
    children: [h('div', { class: 'stack stack--lg' },
      Example('Button', 'Variantes: primary (uma por contexto), secondary, success (aprovar), danger (descartar, rejeitar), ghost; tamanhos md e sm; somente ícone com rótulo acessível.',
        h('div', { class: 'cluster' },
          Button({ label: 'Primário', variant: 'primary', icon: 'save' }), Button({ label: 'Secundário' }), Button({ label: 'Sucesso', variant: 'success', icon: 'check' }),
          Button({ label: 'Perigo', variant: 'danger', icon: 'x' }), Button({ label: 'Discreto', variant: 'ghost' }), Button({ label: 'Desabilitado', disabled: true }),
          Button({ label: 'Pequeno', size: 'sm' }), Button({ label: 'Somente ícone', icon: 'plus', iconOnly: true }))),
      Example('Field + controles', 'Todo controle fica dentro de Field (rótulo, dica e erro ligados por aria-describedby). Somente leitura usa borda tracejada.',
        h('div', { class: 'form-grid' },
          Field({ label: 'Texto', control: TextInput({ placeholder: 'Digite…' }), required: true, hint: 'Dica curta.' }),
          Field({ label: 'Seleção', control: Select({ placeholder: 'Selecione…', options: [{ value: 'a', label: 'Opção A' }, { value: 'b', label: 'Opção B' }] }) }),
          Field({ label: 'Somente leitura', control: TextInput({ value: 'HPB-00000', mono: true, readOnly: true }) }),
          invalidField,
          h('div', { class: 'form-grid__full' }, Field({ label: 'Texto longo', control: TextArea({ rows: 2 }), optional: true })),
          Checkbox({ label: 'Caixa de seleção', hint: 'com dica' }),
          SearchInput({ placeholder: 'Busca' }),
          Slider({ label: 'Controle deslizante', value: 60, step: 5, format: (v) => `${v}%`, hint: 'O valor aparece ao lado do rótulo.' }))),
      Example('EditableList', 'Linhas repetíveis; editar não redesenha (foco preservado).',
        EditableList({ items: [{ a: 'x', b: 'y' }], createItem: () => ({ a: '', b: '' }), columns: [
          { key: 'a', label: 'Coluna A', render: (v, update, r, i, o) => TextInput({ value: v, size: 'sm', ariaLabel: o.ariaLabel, onInput: update }) },
          { key: 'b', label: 'Coluna B', render: (v, update, r, i, o) => TextInput({ value: v, size: 'sm', ariaLabel: o.ariaLabel, onInput: update }) },
        ] })),
      Example('DataTable', 'Ordenação acessível (aria-sort), rolagem horizontal em telas estreitas, linhas clicáveis opcionais.',
        DataTable({ rows: tableRows, initialSort: { key: 'id', dir: 'asc' }, columns: [
          { key: 'id', label: 'ID', sortable: true, render: (r) => h('span', { class: 'mono' }, r.id) },
          { key: 'name', label: 'Nome', sortable: true },
          { key: 'kind', label: 'Natureza', render: (r) => KindBadge(r.kind) },
          { key: 'n', label: 'Quantidade', sortable: true, className: 'cell-num', headerClass: 'cell-num' },
        ] })),
      Example('Tabs', 'Setas, Home e End navegam entre abas; painéis são preservados.',
        Tabs({ tabs: [
          { id: 'a', label: 'Primeira', count: 2, render: () => h('p', {}, 'Conteúdo da primeira aba.') },
          { id: 'b', label: 'Segunda', render: () => h('p', {}, 'Conteúdo da segunda aba.') },
        ] })),
      Example('Panel', 'human = definição canônica · technical = metadado descoberto (somente leitura) · source = documento de origem · attention = requer análise.',
        h('div', { class: 'grid grid--2' },
          Panel({ title: 'Definição humana', variant: 'human', icon: 'edit', headingLevel: 4, children: [h('p', {}, 'Conteúdo editável em rascunho.')] }),
          Panel({ title: 'Metadados técnicos', variant: 'technical', icon: 'database', headingLevel: 4, subtitle: 'Somente leitura', children: [h('p', { class: 'mono' }, 'tabela.coluna · uuid')] }),
          Panel({ title: 'Documento de origem', variant: 'source', icon: 'file-text', headingLevel: 4, children: [h('p', {}, 'Transcrição literal.')] }),
          Panel({ title: 'Atenção', variant: 'attention', icon: 'alert-triangle', headingLevel: 4, children: [h('p', {}, 'Indício para revisão.')] }))),
      Example('Alert e toast', 'Alertas explicam o estado da tela; toasts confirmam ações (erros ficam o dobro do tempo).',
        ...['info', 'success', 'warning', 'danger', 'accent', 'neutral'].map((tone) => Alert({ tone, title: `Alerta ${tone}`, children: [h('p', {}, 'Mensagem curta e acionável.')] })),
        h('div', { class: 'cluster' },
          Button({ label: 'Toast de sucesso', size: 'sm', onClick: () => toast('Ação concluída.') }),
          Button({ label: 'Toast de erro', size: 'sm', onClick: () => toast('Falha ao salvar.', { tone: 'danger' }) }))),
      Example('Diálogos', 'confirmDialog para ações com consequência (com justificativa obrigatória quando a ação é irreversível ou de decisão); formDialog para formulários curtos.',
        h('div', { class: 'cluster' },
          Button({ label: 'confirmDialog', size: 'sm', onClick: async () => { const r = await confirmDialog({ title: 'Confirmar ação?', message: 'Explica a consequência.', note: { label: 'Justificativa', required: true, minLength: 5 }, tone: 'danger', confirmLabel: 'Confirmar' }); toast(r.confirmed ? `Confirmado: ${r.note}` : 'Cancelado', { tone: r.confirmed ? 'success' : 'info' }); } }),
          Button({ label: 'formDialog', size: 'sm', onClick: async () => { const input = TextInput({}); const field = Field({ label: 'Nome', control: input, required: true }); const r = await formDialog({ title: 'Formulário', body: [field], onSubmit: () => { if (!input.value.trim()) { field.setError('Obrigatório.'); return false; } return input.value; } }); if (r) toast(`Enviado: ${r}`); } }))),
      Example('Progresso e estatísticas', null,
        ProgressBar({ value: 3, max: 8, label: 'Progresso', valueText: '3 de 8' }),
        StatGrid([Stat({ label: 'Total', value: 42 }), Stat({ label: 'Aprovados', value: 7, tone: 'success' }), Stat({ label: 'Pendentes', value: 3, tone: 'warning', hint: 'dica' })])),
      Example('Estado de salvamento e carregamento', 'SaveStatus comunica rascunho salvo, alterado, salvando, erro ou somente leitura (aria-live).',
        h('div', { class: 'cluster' }, saveStatus,
          Button({ label: 'alterado', size: 'sm', onClick: () => saveStatus.set('dirty') }),
          Button({ label: 'salvando', size: 'sm', onClick: () => saveStatus.set('saving') }),
          Button({ label: 'erro', size: 'sm', onClick: () => saveStatus.set('error') }),
          Button({ label: 'salvo', size: 'sm', onClick: () => saveStatus.set('saved') }),
          Spinner({ label: 'Carregando…' }))),
      Example('Conteúdo', 'KeyValueList, Timeline, Disclosure, ItemRef, EmptyState.',
        KeyValueList([{ key: 'Chave', value: 'Valor' }, { key: 'Código', value: 'exemplo_codigo', mono: true }, { key: 'Vazio', value: null }]),
        Timeline([{ title: 'Evento mais recente', meta: 'data · autor', tone: 'success' }, { title: 'Evento anterior', meta: 'data · autor', body: 'Detalhe opcional.' }]),
        Disclosure({ summary: 'Mais detalhes', children: [h('p', {}, 'Conteúdo recolhível.')] }),
        h('div', { class: 'cluster' }, ItemRef({ id: 'EX-001', label: 'Referência com link', href: '#/design-system' }), ItemRef({ id: 'EX-002', label: 'Referência sem link' })),
        EmptyState({ title: 'Estado vazio', message: 'Explica por que não há conteúdo e o que fazer.', icon: 'info' })),
      Example('DiffView', 'Comparação de versões: lado a lado ou palavra a palavra (segments).',
        DiffView([
          { label: 'Campo curto', type: 'alterado', before: 'antes', after: 'depois' },
          { label: 'Texto longo', type: 'alterado', segments: wordDiff('Texto original com algumas palavras que mudam ao longo da revisão.', 'Texto revisado com outras palavras que mudam ao longo da revisão aprovada.') },
          { label: 'Item incluído', type: 'adicionado', before: null, after: 'novo valor' },
        ])),
      Example('Ícones', 'Geometria Feather (MIT). Ícones decorativos ficam ocultos para leitores de tela; só ícones isolados recebem rótulo.',
        h('div', { class: 'cluster' }, ...ICON_NAMES.map((name) => h('span', { class: 'badge badge--outline', title: name }, Icon(name), name)))))],
  });

  const domain = Panel({
    title: 'Componentes de domínio',
    icon: 'book',
    subtitle: 'web/app/components/domain.js — mapeiam vocabulários do dicionário para o Design System',
    children: [h('div', { class: 'stack stack--lg' },
      Example('ConceptStatusBadge', null, h('div', { class: 'cluster' }, ...Object.keys(CONCEPT_STATUS).map((s) => ConceptStatusBadge(s)), ConceptStatusBadge('aprovado', { pending: 'rascunho' }))),
      Example('RevisionStatusBadge', null, h('div', { class: 'cluster' }, ...Object.keys(REVISION_STATUS).map((s) => RevisionStatusBadge(s)))),
      Example('KindBadge', null, h('div', { class: 'cluster' }, ...Object.keys(KINDS).map((k) => KindBadge(k)))),
      Example('OriginBadge', null, h('div', { class: 'cluster' }, OriginBadge({ origin: 'ia' }), OriginBadge({ origin: 'ia', accepted: true }))),
      Example('MapClassificationBadge', 'Como o mapa tratou cada linha do dicionário de trabalho.', h('div', { class: 'cluster' }, ...Object.keys(MAP_CLASSIFICATIONS).map((c) => MapClassificationBadge(c)))))],
  });

  return h('div', { class: 'stack stack--lg' },
    PageHeader({
      breadcrumbs: [{ label: 'Visão geral', href: '#/' }, { label: 'Design System' }],
      eyebrow: `Versão ${meta.version} · ${meta.updated}`,
      title: 'Design System HPB',
      description: 'Padrão canônico de interface: tokens, layouts e componentes definidos uma única vez em web/design-system e reutilizados por todas as áreas. Novas áreas não criam estilos nem componentes próprios.',
      actions: [Button({ label: 'Documentação', icon: 'book', href: '/docs/DESIGN-SYSTEM.md', target: '_blank' })],
    }),
    tokens,
    components,
    domain);
}
