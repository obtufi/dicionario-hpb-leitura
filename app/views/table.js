/**
 * Visão da tabela lógica: conceitos (os da tabela e os que ela usa de outras tabelas)
 * e decisões pendentes.
 */
import {
  Alert, Badge, Button, Checkbox, DataTable, Disclosure, EmptyState, Field, ItemRef, KeyValueList, PageHeader, Panel, ProgressBar,
  SearchInput, Select, Stat, StatGrid, Tabs, TextArea, TextInput, Toolbar, confirmDialog, debounce, formDialog, h, toast,
} from '/design-system/components.js';
import { CONCEPT_STATUS, KINDS, emptyContent, suggestCode } from '/shared/semantic-model.js';
import { api } from '../api.js';
import { formatActor, formatDateTime } from '../format.js';
import { isReadOnly } from '../leitura/modo.js';
import {
  ConceptRef, ConceptStatusBadge, KindBadge, OriginBadge, QuestionStatusBadge, TableStatusBadge, ValueDomain, conceptHref, tableHref,
} from '../components/domain.js';

const TABS = ['conceitos', 'decisoes'];
/** Motivo de uma possível duplicidade, com a nota de quem declarou a relação. */
const reasonText = (r) => (r.note ? `${r.label}: ${r.note}` : r.label);

export async function render(ctx, { tableId, tab }) {
  const [{ table, area }, concepts, questions, allConcepts] = await Promise.all([
    api.get(`/api/tables/${encodeURIComponent(tableId)}`),
    api.get(`/api/tables/${encodeURIComponent(tableId)}/concepts?descartados=1`),
    api.get(`/api/tables/${encodeURIComponent(tableId)}/questions`),
    api.get('/api/concepts'),
  ]);
  ctx.setTitle(table.name);
  const s = table.stats;
  const used = concepts.filter((c) => c.reused && c.status !== 'descartado').length;

  const header = PageHeader({
    breadcrumbs: [{ label: 'Visão geral', href: '#/' }, { label: area.name, href: `#/area/${area.area_id}` }, { label: table.name }],
    eyebrow: `Tabela lógica · ${table.table_id}`,
    title: table.name,
    meta: [TableStatusBadge(table.status)],
    actions: isReadOnly() ? [] : table.status === 'futura'
      ? [Button({ label: 'Iniciar tabela', icon: 'flag', variant: 'primary', onClick: () => startTable(ctx, table) })]
      : [Button({ label: 'Novo conceito', icon: 'plus', variant: 'primary', onClick: () => createConcept(ctx, table) })],
    description: table.description,
  });

  if (table.status === 'futura') {
    // A carga pode trazer a proposta antes do início, que é decisão humana.
    return h('div', { class: 'stack stack--lg' }, header,
      Alert({ tone: 'neutral', title: 'Estrutura futura', children: [h('p', {}, s.concepts.total > 0
        ? `Há uma proposta carregada (${s.concepts.total} conceitos), que aparece para revisão quando a tabela for iniciada.`
        : 'Ela será revisada em etapa posterior; não há conceitos nem propostas nesta etapa.')] }),
      EmptyState({ title: 'Tabela ainda não iniciada', message: 'A reconstrução avança uma tabela por vez, com autorização explícita para cada nova tabela.', icon: 'layers' }));
  }

  const stats = StatGrid([
    Stat({ label: 'Conceitos da tabela', value: s.concepts.total, hint: `${s.concepts.aprovado} aprovados · ${s.concepts.em_revisao} em revisão · ${s.concepts.rascunho} rascunhos` }),
    Stat({ label: 'Usados de outras tabelas', value: used, hint: 'Definidos uma vez em outra tabela e usados aqui' }),
    Stat({ label: 'Propostas IA a avaliar', value: s.concepts.propostas_ia, tone: 'accent', hint: 'Rascunhos de IA ainda não aceitos' }),
    Stat({ label: 'Decisões pendentes', value: s.questions.aberta, tone: 'warning', hint: `${s.questions.resolvida} resolvidas` }),
  ]);

  const progress = ProgressBar({ value: s.concepts.aprovado, max: s.concepts.total || 1, label: 'Conceitos da tabela aprovados por pessoa', valueText: `${s.concepts.aprovado} de ${s.concepts.total}` });

  const refresh = async () => {
    ctx.refreshNav();
    await ctx.rerender({ keepScroll: true });
  };

  const tabs = Tabs({
    label: 'Seções da tabela',
    active: TABS.includes(tab) ? tab : 'conceitos',
    onChange: (id) => history.replaceState(null, '', tableHref(table.table_id, id === 'conceitos' ? null : id)),
    tabs: [
      { id: 'conceitos', label: 'Conceitos', count: concepts.filter((c) => c.status !== 'descartado').length, render: () => ConceptsTab({ concepts, ctx }) },
      { id: 'decisoes', label: 'Decisões pendentes', count: questions.filter((q) => q.status === 'aberta').length, render: () => QuestionsTab({ table, questions, allConcepts, ctx, onChange: refresh }) },
    ],
  });

  return h('div', { class: 'stack stack--lg' }, header, stats, progress, tabs);
}

// ------------------------------------------------------------------ conceitos

function ConceptsTab({ concepts, ctx }) {
  const state = { q: '', kind: '', status: '', discarded: false };
  const resultSlot = h('div', {});
  const count = h('p', { class: 'text-sm text-muted', role: 'status' });

  const matches = (c) => {
    if (!state.discarded && c.status === 'descartado') return false;
    if (state.kind && c.kind !== state.kind) return false;
    if (state.status && c.status !== state.status) return false;
    if (!state.q) return true;
    const norm = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    return norm([c.concept_id, c.label, c.code, ...(c.synonyms ?? []), c.definition].join(' ')).includes(norm(state.q));
  };

  const update = () => {
    const rows = concepts.filter(matches);
    count.textContent = `${rows.length} de ${concepts.length} conceitos`;
    resultSlot.replaceChildren(ConceptTable(rows, ctx));
  };

  const toolbar = Toolbar({
    items: [
      SearchInput({ placeholder: 'Buscar por nome, código, sinônimo…', ariaLabel: 'Buscar conceitos da tabela', onInput: debounce((v) => { state.q = v; update(); }, 150) }),
      Select({ placeholder: 'Todas as naturezas', ariaLabel: 'Filtrar por natureza', options: Object.entries(KINDS).map(([value, def]) => ({ value, label: def.label })), onChange: (v) => { state.kind = v; update(); } }),
      Select({ placeholder: 'Todos os estados', ariaLabel: 'Filtrar por estado', options: Object.entries(CONCEPT_STATUS).map(([value, def]) => ({ value, label: def.label })), onChange: (v) => { state.status = v; update(); } }),
    ],
    fixed: [Checkbox({ label: 'Mostrar descartados', onChange: (v) => { state.discarded = v; update(); } })],
  });

  const pairs = [];
  const seen = new Set();
  for (const c of concepts) {
    for (const d of c.duplicates) {
      const key = [c.concept_id, d.concept_id].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ a: c, b: d });
    }
  }
  const duplicatesPanel = pairs.length
    ? Panel({
      title: `Possíveis duplicidades (${pairs.length} ${pairs.length === 1 ? 'par' : 'pares'})`,
      icon: 'alert-triangle',
      variant: 'attention',
      subtitle: 'Indícios para análise humana — nada é unificado automaticamente.',
      children: [h('ul', { class: 'ref-list' }, ...pairs.map(({ a, b }) => h('li', { class: 'ref-list__item' },
        ItemRef({ id: a.concept_id, label: a.label, href: conceptHref(a.concept_id) }),
        h('span', { class: 'text-muted' }, '×'),
        ItemRef({ id: b.concept_id, label: b.label, href: conceptHref(b.concept_id) }),
        h('span', { class: 'text-sm text-muted' }, `— ${b.reasons.map(reasonText).join('; ')}`))))],
    })
    : null;

  update();
  return h('div', { class: 'stack' }, toolbar, count, duplicatesPanel, resultSlot);
}

function ConceptTable(rows, ctx) {
  return DataTable({
    rows,
    rowKey: (c) => c.concept_id,
    initialSort: { key: 'concept_id', dir: 'asc' },
    onRowClick: (c) => ctx.navigate(conceptHref(c.concept_id)),
    rowClass: (c) => (c.status === 'descartado' ? 'data-table__row--muted' : null),
    dense: true,
    emptyState: EmptyState({ title: 'Nenhum conceito encontrado', message: 'Ajuste a busca ou os filtros.', icon: 'search' }),
    columns: [
      { key: 'concept_id', label: 'ID', sortable: true, render: (c) => h('a', { class: 'mono nowrap', href: conceptHref(c.concept_id) }, c.concept_id) },
      {
        key: 'label',
        label: 'Nome',
        sortable: true,
        render: (c) => h('div', { class: 'cell-title' },
          h('a', { class: ['cell-title__main', c.status === 'descartado' && 'strike'], href: conceptHref(c.concept_id) }, c.label || '(sem nome)'),
          h('span', { class: 'cell-title__sub mono' }, c.code || 'sem nome canônico'),
          c.entity_label ? h('span', { class: 'cell-title__sub' }, `Entidade: ${c.entity_label}`) : null,
          c.reused ? h('span', { class: 'cell-title__sub' }, 'Usado de ', h('a', { href: tableHref(c.home_table_id) }, c.home_table_id)) : null),
      },
      { key: 'kind', label: 'Natureza', sortable: true, sortValue: (c) => KINDS[c.kind]?.label, render: (c) => KindBadge(c.kind) },
      { key: 'value_type', label: 'Domínio de valores', sortable: true, render: (c) => ValueDomain(c.value_domain) },
      {
        key: 'status',
        label: 'Estado',
        sortable: true,
        sortValue: (c) => CONCEPT_STATUS[c.status]?.label,
        render: (c) => h('div', { class: 'stack stack--sm' },
          ConceptStatusBadge(c.status, { pending: c.pending_status }),
          OriginBadge({ origin: c.display_revision.origin, accepted: c.display_revision.proposal_accepted }),
          h('span', { class: 'cell-title__sub' }, `rev. ${c.display_revision.revision_number}`)),
      },
      {
        key: 'duplicates',
        label: 'Alertas',
        sortable: true,
        sortValue: (c) => -c.duplicates.length,
        render: (c) => (c.duplicates.length
          ? h('div', { class: 'stack stack--sm' },
            Badge({ label: `${c.duplicates.length} possível${c.duplicates.length > 1 ? 'is' : ''} duplicidade${c.duplicates.length > 1 ? 's' : ''}`, tone: 'warning', icon: 'alert-triangle' }),
            ...c.duplicates.map((d) => h('a', { class: 'mono text-xs', href: conceptHref(d.concept_id), title: d.reasons.map(reasonText).join('; ') }, d.concept_id)))
          : h('span', { class: 'text-subtle text-sm' }, '—')),
      },
    ],
  });
}

/** Início de uma tabela futura: decisão humana, registrada na auditoria com o comentário. */
async function startTable(ctx, table) {
  if (!(await ctx.ensureActor())) return;
  const { confirmed, note } = await confirmDialog({
    title: `Iniciar a tabela "${table.name}"?`,
    message: 'A tabela passa a "Em trabalho" e as propostas carregadas para ela aparecem para revisão. Inicie só com autorização para esta tabela: quem iniciou e o comentário ficam na auditoria.',
    confirmLabel: 'Iniciar tabela',
    note: { label: 'Autorização', required: false, placeholder: 'Opcional: quem autorizou e quando' },
  });
  if (!confirmed) return;
  try {
    await api.post(`/api/tables/${encodeURIComponent(table.table_id)}/start`, { note });
    toast(`Tabela "${table.name}" iniciada.`);
    ctx.refreshNav();
    await ctx.rerender();
  } catch (error) {
    ctx.fail(error);
  }
}

async function createConcept(ctx, table) {
  if (!(await ctx.ensureActor())) return;
  const kind = Select({ placeholder: 'Escolha a natureza…', options: Object.entries(KINDS).map(([value, def]) => ({ value, label: `${def.label} — ${def.description}` })) });
  const kindField = Field({ label: 'Natureza', control: kind, required: true, hint: 'Determina os campos do editor. Identificadores e atributos estruturais não são conceitos clínicos.' });
  const label = TextInput({ placeholder: 'Ex.: Número de prontuário institucional' });
  const labelField = Field({ label: 'Nome de exibição', control: label, required: true });
  const created = await formDialog({
    title: 'Novo conceito',
    description: `Será criado em "${table.name}" como rascunho (revisão 1), com identificador estável atribuído pelo sistema.`,
    submitLabel: 'Criar rascunho',
    body: [kindField, labelField],
    onSubmit: async () => {
      kindField.setError(null);
      labelField.setError(null);
      if (!kind.value) {
        kindField.setError('Escolha a natureza.');
        return false;
      }
      if (label.value.trim().length < 3) {
        labelField.setError('Informe ao menos 3 caracteres.');
        return false;
      }
      const content = { ...emptyContent(kind.value), label: label.value.trim(), code: suggestCode(label.value) };
      return api.post('/api/concepts', { table_id: table.table_id, content, change_summary: 'Criação manual.' });
    },
  });
  if (created) {
    toast(`Conceito ${created.concept.concept_id} criado como rascunho.`);
    ctx.refreshNav();
    ctx.navigate(conceptHref(created.concept.concept_id));
  }
}

// ------------------------------------------------------------------ decisões pendentes (questões)

function QuestionCard(q, { allConcepts, ctx, onChange, table }) {
  const byId = new Map(allConcepts.map((c) => [c.concept_id, c]));
  const actions = isReadOnly() ? null : q.status === 'aberta'
    ? [Button({ label: 'Registrar decisão', icon: 'check', variant: 'primary', size: 'sm', onClick: () => resolveQuestion(q, ctx, onChange) })]
    : [Button({ label: 'Reabrir', icon: 'undo', size: 'sm', onClick: () => reopenQuestion(q, ctx, onChange) })];
  return Panel({
    title: `${q.question_id} · ${q.title}`,
    icon: 'help-circle',
    variant: q.status === 'aberta' ? null : 'human',
    actions: [QuestionStatusBadge(q.status), OriginBadge({ origin: q.origin, accepted: q.status === 'resolvida' })].filter(Boolean),
    children: [h('div', { class: 'stack' },
      h('p', { class: 'prose preserve-lines' }, q.context),
      q.options.length ? h('div', { class: 'stack stack--sm' }, h('p', { class: 'field__label' }, 'Alternativas consideradas'), h('ol', {}, ...q.options.map((o) => h('li', {}, o)))) : null,
      KeyValueList([
        { key: 'Conceitos envolvidos', value: q.related_concepts.length ? h('ul', { class: 'ref-list' }, ...q.related_concepts.map((id) => h('li', {}, ConceptRef(byId.get(id) ?? { concept_id: id, label: '(inexistente)' })))) : null },
        { key: 'Registrada por', value: `${formatActor(q.created_by)} em ${formatDateTime(q.created_at)}` },
      ]),
      q.status === 'resolvida'
        ? Alert({ tone: 'success', title: `Decisão registrada por ${formatActor(q.resolved_by)} em ${formatDateTime(q.resolved_at)}`, children: [h('p', { class: 'preserve-lines' }, q.resolution)] })
        : null)],
    footer: actions,
  });
}

async function resolveQuestion(q, ctx, onChange) {
  if (!(await ctx.ensureActor())) return;
  const text = TextArea({ rows: 5, placeholder: 'Descreva a decisão e o que deve mudar nos conceitos.' });
  const field = Field({ label: 'Decisão tomada', control: text, required: true, hint: 'Resolver a questão não altera conceitos automaticamente: aplique as mudanças pelos rascunhos dos conceitos.' });
  const done = await formDialog({
    title: `Registrar decisão — ${q.question_id}`,
    description: q.title,
    body: [field],
    submitLabel: 'Registrar decisão',
    onSubmit: async () => {
      if (text.value.trim().length < 10) {
        field.setError('Escreva ao menos 10 caracteres.');
        return false;
      }
      return api.post(`/api/questions/${encodeURIComponent(q.question_id)}/resolve`, { resolution: text.value.trim() });
    },
  });
  if (done) {
    toast(`Decisão registrada em ${q.question_id}.`);
    onChange();
  }
}

async function reopenQuestion(q, ctx, onChange) {
  if (!(await ctx.ensureActor())) return;
  const text = TextArea({ rows: 3 });
  const field = Field({ label: 'Motivo da reabertura', control: text, required: true });
  const done = await formDialog({
    title: `Reabrir ${q.question_id}?`,
    description: 'A decisão anterior permanece na auditoria.',
    body: [field],
    submitLabel: 'Reabrir',
    onSubmit: async () => {
      if (text.value.trim().length < 5) {
        field.setError('Escreva ao menos 5 caracteres.');
        return false;
      }
      return api.post(`/api/questions/${encodeURIComponent(q.question_id)}/reopen`, { note: text.value.trim() });
    },
  });
  if (done) {
    toast(`${q.question_id} reaberta.`, { tone: 'warning' });
    onChange();
  }
}

async function createQuestion(table, ctx, onChange) {
  if (!(await ctx.ensureActor())) return;
  const title = TextInput({});
  const titleField = Field({ label: 'Título', control: title, required: true });
  const context = TextArea({ rows: 5 });
  const contextField = Field({ label: 'Contexto e análise', control: context, required: true });
  const options = TextArea({ rows: 3, placeholder: 'Uma alternativa por linha' });
  const optionsField = Field({ label: 'Alternativas', control: options, optional: true });
  const done = await formDialog({
    title: 'Nova decisão pendente',
    description: `Questão semântica a ser decidida por pessoas em "${table.name}".`,
    body: [titleField, contextField, optionsField],
    submitLabel: 'Registrar questão',
    onSubmit: async () => {
      titleField.setError(null);
      contextField.setError(null);
      if (title.value.trim().length < 5) {
        titleField.setError('Escreva ao menos 5 caracteres.');
        return false;
      }
      if (context.value.trim().length < 10) {
        contextField.setError('Escreva ao menos 10 caracteres.');
        return false;
      }
      return api.post(`/api/tables/${encodeURIComponent(table.table_id)}/questions`, {
        title: title.value.trim(),
        context: context.value.trim(),
        options: options.value.split('\n').map((l) => l.trim()).filter(Boolean),
      });
    },
  });
  if (done) {
    toast(`Questão ${done.question_id} registrada.`);
    onChange();
  }
}

function QuestionsTab({ table, questions, allConcepts, ctx, onChange }) {
  const open = questions.filter((q) => q.status === 'aberta');
  const resolved = questions.filter((q) => q.status === 'resolvida');
  return h('div', { class: 'stack' },
    h('div', { class: 'cluster cluster--spread' },
      h('p', { class: 'text-sm text-muted' }, 'Decisões semânticas que exigem validação humana. A IA aponta a questão; só pessoas a resolvem.'),
      isReadOnly() ? null : Button({ label: 'Nova questão', icon: 'plus', onClick: () => createQuestion(table, ctx, onChange) })),
    open.length
      ? h('div', { class: 'stack' }, ...open.map((q) => QuestionCard(q, { allConcepts, ctx, onChange, table })))
      : EmptyState({ title: 'Nenhuma decisão pendente', icon: 'check-circle' }),
    resolved.length
      ? Disclosure({ summary: `Resolvidas (${resolved.length})`, children: [h('div', { class: 'stack' }, ...resolved.map((q) => QuestionCard(q, { allConcepts, ctx, onChange, table })))] })
      : null);
}
