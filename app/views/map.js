/**
 * Mapa do dicionário (proposta): resultado da revisão completa do dicionário de
 * trabalho — áreas → tabelas lógicas com grão → conceitos, catálogos, derivados e
 * moldura comum; vocabulários harmonizados; decisões pendentes; rastreabilidade.
 * O mapa é somente leitura: nada aqui é conceito do banco nem definição aprovada.
 * A única escrita é a resposta humana às decisões pendentes (com autoria e histórico).
 * Fonte: /api/mapa (dicionario/mapa/). Documentação: docs/MAPA-CANONICO.md.
 */
import {
  Alert, Badge, Button, DataTable, Disclosure, EmptyState, Field, ItemRef, KeyValueList, PageHeader, Panel, SearchInput, Section, Select,
  Stat, StatGrid, Tabs, TextArea, Toolbar, debounce, formDialog, h, toast,
} from '/design-system/components.js';
import { KINDS } from '/shared/semantic-model.js';
import { api } from '../api.js';
import { formatActor, formatDateTime, formatNumber, plural } from '../format.js';
import { isReadOnly } from '../leitura/modo.js';
import {
  KindBadge, MAP_TABLE_KINDS, MapClassificationBadge, MapTableKindBadge, MapTierBadge, MapValueType, OriginBadge, QuestionStatusBadge,
  conceptHref, mapAreaHref, mapDecisionsHref, mapTableHref, mapVocabularyHref,
} from '../components/domain.js';

const MAP_HOME = { label: 'Mapa do dicionário', href: '#/mapa' };
const MAX_ROWS = 300;
const VOCAB_KINDS = { booleano: 'Sim/Não', presenca: 'Presença', lista: 'Lista', ordinal: 'Ordinal', catalogo: 'Catálogo' };
const norm = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const proposalAlert = () => Alert({
  tone: 'accent',
  title: 'Proposta da IA para revisão humana',
  children: [h('p', {}, 'O mapa organiza todo o dicionário de trabalho para guiar a reconstrução, uma tabela por vez. Nenhum item dele é conceito do dicionário nem definição aprovada: cada tabela só entra no dicionário quando for autorizada, revisada e aprovada por pessoas.')],
});

function unavailable(ctx) {
  ctx.setTitle('Mapa do dicionário');
  return h('div', { class: 'stack stack--lg' },
    PageHeader({ title: 'Mapa do dicionário' }),
    EmptyState({ title: 'Mapa não encontrado', message: 'Os arquivos de dicionario/mapa/ não estão presentes nesta instalação.', icon: 'grid' }));
}

// ------------------------------------------------------------------ visão geral

export async function renderOverview(ctx) {
  const data = await api.get('/api/mapa');
  if (!data.disponivel) return unavailable(ctx);
  ctx.setTitle('Mapa do dicionário');
  const { antes, depois } = data.estatisticas;
  const open = data.decisoes - data.decisoes_respondidas;

  const header = PageHeader({
    eyebrow: `Revisão completa · ${formatNumber(data.meta.linhas_da_fonte)} linhas do dicionário de trabalho · ${data.meta.gerado_em ?? ''}`,
    title: 'Mapa do dicionário',
    meta: [OriginBadge({ origin: 'ia' })],
    description: 'O dicionário de trabalho foi revisado por inteiro e reorganizado em áreas, tabelas lógicas com grão explícito e conceitos definidos uma única vez. Momento, contexto e local viraram dimensões; atributos comuns a todos os registros ficam numa moldura única; listas homogêneas viraram catálogos. Cada linha antiga tem destino rastreável.',
    actions: [
      Button({ label: 'Vocabulários', icon: 'list', href: '#/mapa/vocabularios' }),
      Button({ label: `Decisões pendentes (${open})`, icon: 'help-circle', href: mapDecisionsHref() }),
      // Na versão de leitura não há servidor: o CSV sai dos dados já abertos, como arquivo baixado.
      isReadOnly()
        ? Button({ label: 'Rastreabilidade (CSV)', icon: 'download', onClick: () => downloadTrace(ctx) })
        : Button({ label: 'Rastreabilidade (CSV)', icon: 'download', href: '/api/mapa/rastreabilidade.csv' }),
    ],
  });

  const stats = StatGrid([
    Stat({ label: 'Antes: variáveis', value: formatNumber(antes.variaveis_dicionario), hint: `+ ${formatNumber(antes.conceitos_reexpressos_formulario_antigo)} conceitos reexpressos e ${formatNumber(antes.opcoes)} opções em ${formatNumber(antes.listas_por_variavel)} listas` }),
    Stat({ label: 'Tabelas lógicas', value: formatNumber(depois.tabelas), hint: `em ${depois.areas} áreas, cada uma com grão explícito`, tone: 'info' }),
    Stat({ label: 'Conceitos', value: formatNumber(depois.conceitos), hint: `+ ${formatNumber(depois.derivados)} definições derivadas`, tone: 'accent' }),
    Stat({ label: 'Entradas de catálogo', value: formatNumber(depois.entradas_de_catalogo), hint: 'analitos e parâmetros homogêneos, definidos uma vez' }),
    Stat({ label: 'Vocabulários', value: formatNumber(depois.vocabularios), hint: `de ${formatNumber(antes.listas_por_variavel)} listas por variável (${formatNumber(antes.listas_distintas)} distintas)` }),
    Stat({ label: 'Decisões pendentes', value: formatNumber(open), hint: `${formatNumber(data.decisoes_respondidas)} de ${formatNumber(data.decisoes)} já resolvidas · só pessoas decidem`, tone: 'warning' }),
  ]);

  const howTo = Panel({
    title: 'Como ler o mapa',
    icon: 'book',
    children: [h('ul', { class: 'stack stack--sm' },
      h('li', {}, h('strong', {}, 'Moldura comum. '), 'Data, precisão, etapa do percurso, documento-fonte, evidência e estados de ausência são definidos uma vez para todas as observações e eventos — não há “data do exame”, “fonte do laudo” ou “documentado?” por variável.'),
      h('li', {}, h('strong', {}, 'Momento, contexto e local são dimensões. '), 'Creatinina pré-operatória, na alta e no D1 é um conceito só (creatinina), observado em momentos diferentes; “última creatinina antes da cirurgia” é uma definição derivada.'),
      h('li', {}, h('strong', {}, 'Tabelas com grão. '), 'Cada tabela diz o que é uma linha: uma operação, uma lesão por exame, um resultado de um analito numa coleta. Listas de sim/não independentes viraram catálogo + presença.'),
      h('li', {}, h('strong', {}, 'Nada se perde. '), 'Cada linha do arquivo de origem tem destino na rastreabilidade (preservada, reescrita, unificada, derivada, estrutural ou descontinuada com motivo). Nada do formulário antigo entra na estrutura.')),
    ],
  });

  const phases = data.fases.map((f) => Panel({
    title: f.fase,
    icon: 'layers',
    flush: true,
    children: [DataTable({
      rows: f.areas,
      rowKey: (a) => a.area,
      onRowClick: (a) => ctx.navigate(mapAreaHref(a.area)),
      dense: true,
      columns: [
        { key: 'nome', label: 'Área', render: (a) => h('span', { class: 'cell-title' }, h('a', { class: 'cell-title__main', href: mapAreaHref(a.area) }, a.nome), h('span', { class: 'cell-title__sub' }, a.descricao)) },
        { key: 'tabelas', label: 'Tabelas', className: 'cell-num', headerClass: 'cell-num' },
        { key: 'conceitos', label: 'Conceitos', className: 'cell-num', headerClass: 'cell-num' },
        { key: 'entradas', label: 'Catálogo', className: 'cell-num', headerClass: 'cell-num', render: (a) => (a.entradas ? formatNumber(a.entradas) : '—') },
        { key: 'itens_origem', label: 'Itens de origem', className: 'cell-num', headerClass: 'cell-num', render: (a) => formatNumber(a.itens_origem) },
        { key: 'ordem_reconstrucao', label: 'Ordem', className: 'cell-num', headerClass: 'cell-num', render: (a) => (a.ordem_reconstrucao ? `${a.ordem_reconstrucao}ª` : '—') },
      ],
    })],
  }));

  const frame = Panel({
    title: 'Moldura comum (definida uma vez, usada por todas as tabelas)',
    icon: 'database',
    flush: true,
    children: [DataTable({
      rows: data.moldura_comum,
      rowKey: (m) => m.atributo,
      dense: true,
      columns: [
        { key: 'atributo', label: 'Atributo', render: (m) => h('span', { class: 'mono nowrap' }, m.atributo) },
        { key: 'descricao', label: 'Significado' },
        { key: 'usado_em', label: 'Tabelas que o usam', className: 'cell-num', headerClass: 'cell-num', render: (m) => String(m.usado_em.length) },
      ],
    })],
  });

  return h('div', { class: 'stack stack--lg' }, header, proposalAlert(), stats, howTo, ...phases, frame,
    Panel({ title: 'Buscar no mapa', icon: 'search', children: [MapSearchBox(ctx)] }));
}

function MapSearchBox(ctx, value = '') {
  return SearchInput({
    value,
    placeholder: 'Tabela, conceito, analito ou vocabulário…',
    ariaLabel: 'Buscar no mapa do dicionário',
    onSubmit: (q) => {
      if (q.trim()) ctx.navigate(`#/mapa/busca?q=${encodeURIComponent(q.trim())}`);
    },
  });
}

// ------------------------------------------------------------------ área

export async function renderArea(ctx, { areaKey }) {
  const area = await api.get(`/api/mapa/areas/${encodeURIComponent(areaKey)}`);
  ctx.setTitle(`${area.nome} · mapa`);
  const header = PageHeader({
    breadcrumbs: [MAP_HOME, { label: area.nome }],
    eyebrow: `Área · fase ${area.fase}${area.ordem_reconstrucao ? ` · ${area.ordem_reconstrucao}ª na ordem de reconstrução proposta` : ''}`,
    title: area.nome,
    meta: [OriginBadge({ origin: 'ia' })],
    description: area.descricao,
  });
  const tables = area.tabelas.length
    ? DataTable({
      rows: area.tabelas,
      rowKey: (t) => t.tabela,
      onRowClick: (t) => ctx.navigate(mapTableHref(t.tabela)),
      columns: [
        {
          key: 'nome',
          label: 'Tabela lógica',
          render: (t) => h('span', { class: 'cell-title' },
            h('span', { class: 'cell-title__main' }, t.profundidade ? h('span', { class: 'text-subtle' }, `${'· '.repeat(t.profundidade)}↳ `) : null, h('a', { href: mapTableHref(t.tabela) }, t.nome)),
            h('span', { class: 'cell-title__sub mono' }, t.tabela)),
        },
        { key: 'tipo', label: 'Tipo', render: (t) => MapTableKindBadge(t.tipo) },
        { key: 'grao', label: 'Grão (o que é uma linha)', render: (t) => h('span', { class: 'text-sm' }, t.grao) },
        { key: 'conceitos', label: 'Conceitos', className: 'cell-num', headerClass: 'cell-num', render: (t) => String(t.conceitos + t.reutilizados) },
        { key: 'entradas', label: 'Catálogo', className: 'cell-num', headerClass: 'cell-num', render: (t) => (t.entradas ? `${formatNumber(t.entradas)} (${formatNumber(t.nucleo)} núcleo)` : '—') },
        { key: 'derivados', label: 'Derivados', className: 'cell-num', headerClass: 'cell-num', render: (t) => (t.derivados ? String(t.derivados) : '—') },
        { key: 'itens_origem', label: 'Itens de origem', className: 'cell-num', headerClass: 'cell-num', render: (t) => formatNumber(t.itens_origem) },
      ],
    })
    : EmptyState({ title: 'Nenhuma tabela proposta nesta área', message: 'A área é estrutura comum ou ainda não recebeu itens do dicionário de trabalho.', icon: 'layers' });
  const answered = area.decisoes.filter((d) => d.status === 'resolvida').length;
  const decisions = area.decisoes.length
    ? Section({
      title: `Decisões da área (${answered} de ${area.decisoes.length} resolvidas)`,
      description: 'Só pessoas decidem. A resposta fica registrada com autoria e orienta a reconstrução das tabelas; o mapa não muda sozinho.',
      actions: [Button({ label: 'Todas as decisões', icon: 'help-circle', size: 'sm', href: mapDecisionsHref({ area: area.area }) })],
      children: [DecisionList(area.decisoes, { ctx, onChange: () => ctx.rerender({ keepScroll: true }) })],
    })
    : null;
  return h('div', { class: 'stack stack--lg' }, header,
    Panel({ title: 'Tabelas lógicas', subtitle: 'Tabelas-filhas aparecem recuadas sob a tabela-mãe.', icon: 'grid', flush: area.tabelas.length > 0, children: [tables] }),
    decisions);
}

// ------------------------------------------------------------------ tabela

export async function renderTable(ctx, { tableKey, tab }) {
  const t = await api.get(`/api/mapa/tabelas/${encodeURIComponent(tableKey)}`);
  ctx.setTitle(`${t.nome} · mapa`);
  const kind = MAP_TABLE_KINDS[t.tipo];
  const header = PageHeader({
    breadcrumbs: [MAP_HOME, { label: t.area.nome, href: mapAreaHref(t.area.area) }, { label: t.nome }],
    eyebrow: `Tabela lógica proposta · ${t.tabela}`,
    title: t.nome,
    meta: [MapTableKindBadge(t.tipo), OriginBadge({ origin: 'ia' })],
    description: t.descricao,
  });
  const frameAttrs = Object.entries(t.moldura ?? {});
  const facts = Panel({
    title: 'Estrutura',
    icon: 'columns',
    children: [KeyValueList([
      { key: 'Grão', value: t.grao },
      { key: 'Tipo', value: kind ? `${kind.label} — ${kind.description}` : t.tipo },
      { key: 'Tabela-mãe', value: t.pai_resumo ? h('a', { href: mapTableHref(t.pai_resumo.tabela) }, t.pai_resumo.nome) : (t.pai || '—') },
      { key: 'Tabelas-filhas', value: t.filhos.length ? h('span', { class: 'cluster' }, ...t.filhos.map((f) => h('a', { href: mapTableHref(f.tabela) }, f.nome))) : '—' },
      { key: 'Moldura comum usada', value: frameAttrs.length ? h('span', { class: 'cluster' }, ...frameAttrs.map(([k, v]) => Badge({ label: `${k} (${v.length})`, variant: 'outline', square: true, title: `${v.length} itens de origem mapeados para ${k}` }))) : 'atributos-padrão da moldura' },
      { key: 'Itens de origem', value: `${formatNumber(t.itens_origem)} linhas do dicionário de trabalho` },
      { key: 'Conceitos reutilizados por', value: t.reutilizado_por.length ? h('span', { class: 'cluster' }, ...t.reutilizado_por.map((r) => h('a', { href: mapTableHref(r.tabela), class: 'mono text-sm' }, `${r.tabela}.${r.conceito}`))) : '—' },
    ])],
  });

  const concepts = t.conceitos.filter((c) => !c.reutiliza);
  const reused = t.conceitos.filter((c) => c.reutiliza);
  const tabs = [
    { id: 'conceitos', label: 'Conceitos', count: concepts.length + reused.length, render: () => ConceptsTab(concepts, reused) },
  ];
  if (t.catalogo) tabs.push({ id: 'catalogo', label: 'Catálogo', count: t.catalogo.entradas.length, render: () => CatalogTab(t.catalogo) });
  if (t.derivados.length) tabs.push({ id: 'derivados', label: 'Derivados', count: t.derivados.length, render: () => DerivedTab(t.derivados) });
  tabs.push({ id: 'origem', label: 'Origem', count: t.origem.length, render: () => OriginTab(t.origem) });
  const active = tabs.some((x) => x.id === tab) ? tab : (concepts.length || reused.length || !t.catalogo ? 'conceitos' : 'catalogo');
  return h('div', { class: 'stack stack--lg' }, header, facts,
    Tabs({ label: 'Seções da tabela', active, tabs, onChange: (id) => history.replaceState(null, '', mapTableHref(t.tabela, id === 'conceitos' ? null : id)) }));
}

function ConceptsTab(concepts, reused) {
  const state = { q: '', kind: '' };
  const slot = h('div', {});
  const count = h('p', { class: 'text-sm text-muted', role: 'status' });
  const update = () => {
    const rows = concepts.filter((c) => (!state.kind || c.natureza === state.kind)
      && (!state.q || norm(`${c.conceito} ${c.rotulo} ${c.definicao}`).includes(norm(state.q))));
    count.textContent = `${rows.length} de ${concepts.length} conceitos definidos aqui`;
    slot.replaceChildren(DataTable({
      rows,
      rowKey: (c) => c.conceito,
      dense: true,
      emptyState: EmptyState({ title: 'Nenhum conceito encontrado', message: 'Ajuste a busca ou o filtro.', icon: 'search' }),
      columns: [
        {
          key: 'rotulo',
          label: 'Conceito',
          sortable: true,
          render: (c) => h('span', { class: 'cell-title' },
            h('span', { class: 'cell-title__main' }, c.rotulo),
            h('span', { class: 'cell-title__sub mono' }, c.conceito),
            c.id_dicionario ? h('span', { class: 'cell-title__sub' }, 'Já no dicionário: ', ItemRef({ id: c.id_dicionario, href: conceptHref(c.id_dicionario) })) : null,
            h('span', { class: 'cell-title__sub' }, c.definicao)),
        },
        { key: 'natureza', label: 'Natureza', sortable: true, render: (c) => KindBadge(c.natureza) },
        { key: 'tipo_valor', label: 'Valor', render: (c) => MapValueType(c) },
        { key: 'classificacao', label: 'Origem', sortable: true, render: (c) => h('span', { class: 'cell-title' }, MapClassificationBadge(c.classificacao), h('span', { class: 'cell-title__sub' }, plural(c.itens.length, 'item', 'itens')), h('span', { class: 'cell-title__sub text-muted' }, c.justificativa)) },
      ],
    }));
  };
  const toolbar = Toolbar({
    items: [
      SearchInput({ placeholder: 'Buscar conceito…', ariaLabel: 'Buscar conceitos da tabela', onInput: debounce((v) => { state.q = v; update(); }, 150) }),
      Select({ placeholder: 'Todas as naturezas', ariaLabel: 'Filtrar por natureza', options: Object.entries(KINDS).map(([value, def]) => ({ value, label: def.label })), onChange: (v) => { state.kind = v; update(); } }),
    ],
  });
  update();
  const reusedPanel = reused.length
    ? Panel({ title: 'Conceitos reutilizados de outras tabelas', icon: 'link', children: [h('ul', { class: 'ref-list' }, ...reused.map((c) => h('li', { class: 'ref-list__item' }, h('a', { href: mapTableHref(c.reutiliza), class: 'mono text-sm' }, `${c.reutiliza}.${c.conceito}`))))] })
    : null;
  return h('div', { class: 'stack' }, toolbar, count, slot, reusedPanel);
}

function CatalogTab(cat) {
  const tiers = new Set(cat.subconjuntos.filter((s) => s.nivel).map((s) => s.subconjunto));
  const groups = cat.subconjuntos.filter((s) => !s.nivel);
  const state = { q: '', group: '', tier: '' };
  const slot = h('div', {});
  const count = h('p', { class: 'text-sm text-muted', role: 'status' });
  const update = () => {
    const all = cat.entradas.filter((e) => (!state.group || e.subconjuntos.includes(state.group))
      && (!state.tier || e.subconjuntos.includes(state.tier))
      && (!state.q || norm(`${e.codigo} ${e.rotulo} ${e.loinc}`).includes(norm(state.q))));
    const rows = all.slice(0, MAX_ROWS);
    count.textContent = all.length > MAX_ROWS ? `${formatNumber(all.length)} entradas; mostrando as ${MAX_ROWS} primeiras — refine a busca ou os filtros` : `${formatNumber(all.length)} de ${formatNumber(cat.entradas.length)} entradas`;
    slot.replaceChildren(DataTable({
      rows,
      rowKey: (e) => e.codigo,
      dense: true,
      emptyState: EmptyState({ title: 'Nenhuma entrada encontrada', message: 'Ajuste a busca ou os filtros.', icon: 'search' }),
      columns: [
        { key: 'rotulo', label: 'Entrada', sortable: true, render: (e) => h('span', { class: 'cell-title' }, h('span', { class: 'cell-title__main' }, e.rotulo), h('span', { class: 'cell-title__sub mono' }, e.codigo), ...(e.correcoes ?? []).map((c) => h('span', { class: 'cell-title__sub text-muted' }, `Correção proposta: ${c}`))) },
        { key: 'tipo_valor', label: 'Valor', render: (e) => MapValueType({ tipo_valor: e.tipo_valor, unidade: e.unidade, vocabulario: e.vocabulario, multiplo: e.multiplo }) },
        { key: 'loinc', label: 'LOINC', sortable: true, render: (e) => (e.loinc ? h('span', { class: 'mono nowrap' }, e.loinc) : h('span', { class: 'text-subtle' }, '—')) },
        { key: 'nivel', label: 'Nível', render: (e) => MapTierBadge(e.subconjuntos.find((s) => tiers.has(s))) },
      ],
    }));
  };
  const toolbar = Toolbar({
    items: [
      SearchInput({ placeholder: 'Buscar analito, código ou LOINC…', ariaLabel: 'Buscar entradas do catálogo', onInput: debounce((v) => { state.q = v; update(); }, 200) }),
      Select({ placeholder: 'Todos os painéis', ariaLabel: 'Filtrar por painel', options: groups.map((s) => ({ value: s.subconjunto, label: `${s.rotulo} (${s.entradas})` })), onChange: (v) => { state.group = v; update(); } }),
      Select({ placeholder: 'Núcleo e estendido', ariaLabel: 'Filtrar por nível', options: cat.subconjuntos.filter((s) => s.nivel).map((s) => ({ value: s.subconjunto, label: `${s.rotulo} (${s.entradas})` })), onChange: (v) => { state.tier = v; update(); } }),
    ],
  });
  const rules = Panel({
    title: 'Regras escritas uma vez para todas as entradas',
    icon: 'file-text',
    children: [KeyValueList([
      { key: 'Natureza das entradas', value: KINDS[cat.natureza_entradas]?.label ?? cat.natureza_entradas },
      { key: 'Como as entradas foram geradas', value: cat.regra_entradas },
      { key: 'Definição-modelo', value: cat.definicao_modelo || '—' },
      { key: 'Regra de extração', value: cat.regra_modelo || '—' },
    ], { stacked: true })],
  });
  const repeated = cat.codigos_repetidos?.length
    ? Alert({ tone: 'warning', title: 'Códigos repetidos no catálogo', children: [h('p', { class: 'mono text-sm' }, cat.codigos_repetidos.join(', '))] })
    : null;
  update();
  return h('div', { class: 'stack' }, rules, repeated, toolbar, count, slot);
}

function DerivedTab(derived) {
  return h('div', { class: 'stack' }, ...derived.map((d) => Panel({
    title: d.rotulo,
    subtitle: d.conceito,
    icon: 'git-merge',
    children: [KeyValueList([
      { key: 'Regra', value: d.regra },
      { key: 'Entradas', value: (Array.isArray(d.entradas) ? d.entradas : [d.entradas]).filter(Boolean).join(', ') || '—' },
      { key: 'Evento-âncora', value: d.evento_ancora || '—' },
      { key: 'Janela', value: d.janela || '—' },
      { key: 'Agregação', value: d.agregacao || '—' },
      { key: 'Unidade', value: d.unidade || '—' },
      { key: 'Por quê', value: d.justificativa || '—' },
      { key: 'Itens de origem', value: d.itens.length ? h('span', { class: 'mono text-sm' }, d.itens.join(', ')) : 'nenhum (definição nova)' },
    ])],
  })));
}

function OriginTab(rows) {
  const state = { q: '' };
  const slot = h('div', {});
  const count = h('p', { class: 'text-sm text-muted', role: 'status' });
  const update = () => {
    const all = rows.filter((r) => !state.q || norm(`${r.id} ${r.nome} ${r.rotulo} ${r.destino}`).includes(norm(state.q)));
    count.textContent = all.length > MAX_ROWS ? `${formatNumber(all.length)} itens; mostrando os ${MAX_ROWS} primeiros — refine a busca` : `${formatNumber(all.length)} de ${formatNumber(rows.length)} itens de origem`;
    slot.replaceChildren(DataTable({
      rows: all.slice(0, MAX_ROWS),
      rowKey: (r) => `${r.id}|${r.destino}`,
      dense: true,
      emptyState: EmptyState({ title: 'Nenhum item encontrado', icon: 'search' }),
      columns: [
        { key: 'id', label: 'ID', sortable: true, render: (r) => h('span', { class: 'mono nowrap' }, r.id) },
        { key: 'rotulo', label: 'Item no dicionário de trabalho', render: (r) => h('span', { class: 'cell-title' }, h('span', { class: 'cell-title__main' }, r.rotulo), h('span', { class: 'cell-title__sub mono' }, r.nome)) },
        { key: 'classificacao', label: 'Decisão proposta', sortable: true, render: (r) => MapClassificationBadge(r.classificacao) },
        { key: 'destino', label: 'Destino', render: (r) => h('span', { class: 'mono text-sm' }, r.destino) },
      ],
    }));
  };
  update();
  return h('div', { class: 'stack' },
    h('p', { class: 'text-muted' }, 'Linhas do dicionário de trabalho que esta tabela absorve. A lista completa de todas as linhas, com justificativas, está na rastreabilidade (CSV).'),
    Toolbar({ items: [SearchInput({ placeholder: 'Buscar item de origem…', ariaLabel: 'Buscar itens de origem', onInput: debounce((v) => { state.q = v; update(); }, 150) })] }),
    count, slot);
}

// ------------------------------------------------------------------ vocabulários

export async function renderVocabularies(ctx) {
  const rows = await api.get('/api/mapa/vocabularios');
  ctx.setTitle('Vocabulários · mapa');
  const state = { q: '', kind: '' };
  const slot = h('div', {});
  const count = h('p', { class: 'text-sm text-muted', role: 'status' });
  const update = () => {
    const all = rows.filter((v) => (!state.kind || v.tipo === state.kind) && (!state.q || norm(`${v.vocabulario} ${v.rotulo}`).includes(norm(state.q))));
    count.textContent = all.length > MAX_ROWS ? `${formatNumber(all.length)} vocabulários; mostrando os ${MAX_ROWS} primeiros` : `${formatNumber(all.length)} de ${formatNumber(rows.length)} vocabulários`;
    slot.replaceChildren(DataTable({
      rows: all.slice(0, MAX_ROWS),
      rowKey: (v) => v.vocabulario,
      onRowClick: (v) => ctx.navigate(mapVocabularyHref(v.vocabulario)),
      dense: true,
      initialSort: { key: 'usado_por', dir: 'desc' },
      emptyState: EmptyState({ title: 'Nenhum vocabulário encontrado', icon: 'search' }),
      columns: [
        { key: 'rotulo', label: 'Vocabulário', sortable: true, render: (v) => h('span', { class: 'cell-title' }, h('a', { class: 'cell-title__main', href: mapVocabularyHref(v.vocabulario) }, v.rotulo), h('span', { class: 'cell-title__sub mono' }, v.vocabulario)) },
        { key: 'tipo', label: 'Tipo', sortable: true, render: (v) => Badge({ label: VOCAB_KINDS[v.tipo] ?? v.tipo, variant: 'outline', square: true }) },
        { key: 'codigos', label: 'Códigos', sortable: true, className: 'cell-num', headerClass: 'cell-num' },
        { key: 'listas_originais', label: 'Listas unificadas', sortable: true, className: 'cell-num', headerClass: 'cell-num' },
        { key: 'usado_por', label: 'Usado por', sortable: true, className: 'cell-num', headerClass: 'cell-num' },
      ],
    }));
  };
  update();
  return h('div', { class: 'stack stack--lg' },
    PageHeader({
      breadcrumbs: [MAP_HOME, { label: 'Vocabulários' }],
      eyebrow: 'Mapa do dicionário',
      title: 'Vocabulários harmonizados',
      meta: [OriginBadge({ origin: 'ia' })],
      description: 'As listas de opções foram deduplicadas por conteúdo: listas com os mesmos códigos viraram um vocabulário só; sim/não, presença, escalas ordinais e catálogos longos ficam identificados. Nenhum código foi perdido.',
    }),
    Toolbar({
      items: [
        SearchInput({ placeholder: 'Buscar vocabulário…', ariaLabel: 'Buscar vocabulários', onInput: debounce((v) => { state.q = v; update(); }, 150) }),
        Select({ placeholder: 'Todos os tipos', ariaLabel: 'Filtrar por tipo', options: Object.entries(VOCAB_KINDS).map(([value, label]) => ({ value, label })), onChange: (v) => { state.kind = v; update(); } }),
      ],
    }),
    count, slot);
}

export async function renderVocabulary(ctx, { vocabKey }) {
  const v = await api.get(`/api/mapa/vocabularios/${encodeURIComponent(vocabKey)}`);
  ctx.setTitle(`${v.rotulo} · vocabulário`);
  const detailed = v.detalhes?.length > 0;
  const codes = DataTable({
    rows: detailed ? v.detalhes : v.codigos,
    rowKey: (c) => c.codigo,
    dense: true,
    columns: [
      { key: 'codigo', label: 'Código', render: (c) => h('span', { class: 'mono' }, c.codigo) },
      { key: 'rotulo', label: 'Rótulo' },
      ...(detailed ? [{ key: 'definicao', label: 'Definição e critério', render: (c) => h('span', { class: 'cell-title' }, h('span', {}, c.definicao), h('span', { class: 'cell-title__sub' }, c.criterio)) }] : []),
    ],
  });
  const transitions = v.transicoes?.length
    ? Panel({ title: `Transições possíveis (${v.transicoes.length})`, icon: 'git-merge', flush: true, children: [DataTable({ rows: v.transicoes, rowKey: (t) => `${t.de}>${t.para}`, dense: true, columns: [
      { key: 'de', label: 'De', render: (t) => h('span', { class: 'mono' }, t.de) },
      { key: 'para', label: 'Para', render: (t) => h('span', { class: 'mono' }, t.para) },
      { key: 'motivo', label: 'Motivo' },
    ] })] })
    : null;
  return h('div', { class: 'stack stack--lg' },
    PageHeader({
      breadcrumbs: [MAP_HOME, { label: 'Vocabulários', href: '#/mapa/vocabularios' }, { label: v.rotulo }],
      eyebrow: `Vocabulário · ${v.vocabulario}`,
      title: v.rotulo,
      meta: [Badge({ label: VOCAB_KINDS[v.tipo] ?? v.tipo, variant: 'outline', square: true }), OriginBadge({ origin: 'ia' })],
      description: v.descricao,
    }),
    Panel({ title: 'Resumo', icon: 'info', children: [KeyValueList([
      { key: 'Códigos', value: String(v.codigos.length) },
      { key: 'Listas originais unificadas', value: String(v.listas_originais) },
      { key: 'Estados de ausência retirados', value: v.estados_de_ausencia_retirados.length ? v.estados_de_ausencia_retirados.join(', ') : 'nenhum' },
      { key: 'Por quê', value: v.justificativa || '—' },
    ])] }),
    Panel({ title: 'Códigos', icon: 'list', flush: true, children: [codes] }),
    transitions,
    Panel({ title: `Usado por (${v.usado_em.length})`, icon: 'link', children: [v.usado_em.length
      ? h('ul', { class: 'ref-list' }, ...v.usado_em.slice(0, MAX_ROWS).map((u) => h('li', { class: 'ref-list__item' }, h('a', { href: mapTableHref(u.tabela, u.entrada ? 'catalogo' : null) }, u.rotulo), h('span', { class: 'mono text-sm text-muted' }, `${u.tabela}.${u.conceito}`))))
      : h('p', { class: 'text-muted' }, v.vocabulario === 'care_stage' ? 'Usado como contexto de todas as observações (moldura obs.stage).' : 'Nenhum conceito do mapa aponta para este vocabulário diretamente.')] }));
}

// ------------------------------------------------------------------ decisões pendentes

const DECISION_SITUATIONS = { abertas: 'Abertas', resolvidas: 'Resolvidas' };
const decisionAnchor = (id) => `decisao-${id}`;

function DecisionList(decisions, { ctx, onChange }) {
  return h('div', { class: 'stack' }, ...decisions.map((d) => DecisionCard(d, { ctx, onChange })));
}

/** Alternativa escolhida e o que a resposta acrescenta a ela (sem repetir o texto da alternativa). */
function AnswerBody(r) {
  const extra = r.option_chosen && r.answer.startsWith(r.option_chosen)
    ? r.answer.slice(r.option_chosen.length).replace(/^[\s.,;:—-]+/, '')
    : r.answer;
  return [
    r.option_chosen ? h('p', {}, h('strong', {}, 'Alternativa: '), r.option_chosen) : null,
    extra ? h('p', { class: 'preserve-lines' }, extra) : null,
  ];
}

function DecisionCard(d, { ctx, onChange }) {
  const current = d.resposta;
  const earlier = d.historico.slice(1);
  return Panel({
    id: decisionAnchor(d.id),
    title: `${d.id} · ${d.titulo}`,
    icon: 'help-circle',
    variant: current ? 'human' : null,
    actions: [QuestionStatusBadge(d.status)],
    children: [h('div', { class: 'stack' },
      h('p', { class: 'prose' }, d.contexto),
      h('div', { class: 'stack stack--sm' }, h('p', { class: 'field__label' }, 'Alternativas propostas'), h('ol', {}, ...d.opcoes.map((o) => h('li', {}, o)))),
      d.itens ? h('p', { class: 'text-xs text-muted mono' }, `Itens de origem: ${d.itens}`) : null,
      current
        ? Alert({ tone: 'success', title: `Resolvida por ${formatActor(current.answered_by)} em ${formatDateTime(current.answered_at)}`, children: AnswerBody(current) })
        : null,
      earlier.length
        ? Disclosure({
          summary: `Respostas anteriores (${earlier.length})`,
          children: [h('ol', { class: 'stack stack--sm' }, ...earlier.map((r) => h('li', {},
            h('p', { class: 'text-sm text-muted' }, `${formatActor(r.answered_by)} em ${formatDateTime(r.answered_at)}`),
            ...AnswerBody(r))))],
        })
        : null)],
    footer: isReadOnly() ? null : [current
      ? Button({ label: 'Reconsiderar', icon: 'edit', size: 'sm', onClick: () => answerDecision(d, ctx, onChange) })
      : Button({ label: 'Responder', icon: 'check', variant: 'primary', size: 'sm', onClick: () => answerDecision(d, ctx, onChange) })],
  });
}

async function downloadTrace(ctx) {
  try {
    const csv = await api.get('/api/mapa/rastreabilidade.csv');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = h('a', { href: url, download: 'rastreabilidade-mapa-canonico.csv', hidden: true });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    ctx.fail(error, 'Não foi possível baixar a rastreabilidade');
  }
}

async function answerDecision(d, ctx, onChange) {
  if (!(await ctx.ensureActor())) return;
  const current = d.resposta;
  const text = TextArea({ rows: 5, value: current?.answer ?? '', placeholder: 'Descreva a decisão e o que ela muda no mapa.' });
  const textField = Field({
    label: 'Resposta',
    control: text,
    required: true,
    hint: 'Ao escolher uma alternativa, o texto dela vem para cá; complemente com a justificativa. Responder não altera o mapa: orienta a reconstrução das tabelas.',
  });
  const option = Select({
    placeholder: 'Outra resposta (descreva abaixo)',
    options: d.opcoes.map((o, i) => ({ value: o, label: `${i + 1}. ${o}` })),
    value: current?.option_chosen ?? '',
    // Troca o texto só enquanto ele ainda é o de uma alternativa (ou está vazio): o que a pessoa escreveu fica.
    onChange: (value) => {
      if (!text.value.trim() || d.opcoes.includes(text.value.trim())) text.value = value;
    },
  });
  const optionField = Field({ label: 'Alternativa', control: option, optional: true });
  const done = await formDialog({
    title: `${current ? 'Reconsiderar' : 'Responder'} — ${d.id}`,
    description: d.titulo,
    size: 'lg',
    body: [optionField, textField],
    submitLabel: current ? 'Registrar nova resposta' : 'Registrar resposta',
    onSubmit: async () => {
      textField.setError(null);
      const answer = text.value.trim();
      if (answer.length < 10) {
        textField.setError('Escreva ao menos 10 caracteres.');
        return false;
      }
      if (current && answer === current.answer && (option.value || null) === current.option_chosen) {
        textField.setError('A resposta é igual à vigente: mude a alternativa ou o texto.');
        return false;
      }
      return api.post(`/api/mapa/decisoes/${encodeURIComponent(d.id)}/respostas`, { opcao: option.value || null, resposta: answer });
    },
  });
  if (done) {
    toast(`Resposta registrada em ${d.id}.`);
    onChange();
  }
}

export async function renderDecisions(ctx, { query }) {
  const [initial, summary] = await Promise.all([api.get('/api/mapa/decisoes'), api.get('/api/mapa')]);
  ctx.setTitle('Decisões pendentes · mapa');
  const areaNames = new Map(summary.fases.flatMap((f) => f.areas.map((a) => [a.area, a.nome])));
  let decisions = initial;
  const param = (key) => query?.get(key) ?? '';
  const state = {
    area: areaNames.has(param('area')) ? param('area') : '',
    situacao: DECISION_SITUATIONS[param('situacao')] ? param('situacao') : '',
    q: '',
  };
  const slot = h('div', { class: 'stack stack--lg' });
  const count = h('p', { class: 'text-sm text-muted', role: 'status' });
  const onChange = async () => {
    decisions = await api.get('/api/mapa/decisoes');
    update();
  };
  const setFilter = (key, value) => {
    state[key] = value;
    history.replaceState(null, '', mapDecisionsHref({ area: state.area, situacao: state.situacao }));
    update();
  };
  function update() {
    const rows = decisions.filter((d) => (!state.area || d.areas.includes(state.area))
      && (!state.situacao || (state.situacao === 'resolvidas') === (d.status === 'resolvida'))
      && (!state.q || norm(`${d.id} ${d.titulo} ${d.contexto} ${d.itens} ${d.opcoes.join(' ')} ${d.resposta?.answer ?? ''}`).includes(norm(state.q))));
    const answered = decisions.filter((d) => d.status === 'resolvida').length;
    count.textContent = `${rows.length} de ${decisions.length} decisões nesta seleção · ${plural(answered, 'resolvida', 'resolvidas')} no total`;
    // Agrupadas pela área de origem, na ordem do mapa.
    const groups = new Map([...areaNames.keys()].map((a) => [a, []]));
    for (const d of rows) {
      const key = d.area ?? d.areas[0] ?? 'geral';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(d);
    }
    slot.replaceChildren(...(rows.length
      ? [...groups].filter(([, list]) => list.length).map(([area, list]) => Section({
        title: areaNames.get(area) ?? 'Gerais',
        description: `${plural(list.length, 'decisão', 'decisões')} · ${plural(list.filter((d) => d.status === 'resolvida').length, 'resolvida', 'resolvidas')}`,
        actions: areaNames.has(area) ? [Button({ label: 'Ver a área', icon: 'layers', size: 'sm', href: mapAreaHref(area) })] : [],
        children: [DecisionList(list, { ctx, onChange })],
      }))
      : [EmptyState({ title: 'Nenhuma decisão nesta seleção', message: 'Ajuste a busca ou os filtros.', icon: 'search' })]));
  }
  update();
  if (param('id')) requestAnimationFrame(() => document.getElementById(decisionAnchor(param('id')))?.scrollIntoView({ block: 'start' }));
  return h('div', { class: 'stack stack--lg' },
    PageHeader({
      breadcrumbs: [MAP_HOME, { label: 'Decisões pendentes' }],
      eyebrow: 'Mapa do dicionário',
      title: 'Decisões pendentes',
      meta: [OriginBadge({ origin: 'ia' })],
      description: 'Questões que a revisão encontrou e que só pessoas podem decidir: fusões possíveis, escopo, catálogos externos e ambiguidades clínicas. Nada foi decidido automaticamente. Cada resposta fica registrada com autoria; reconsiderar cria uma nova resposta e mantém a anterior no histórico.',
    }),
    Toolbar({
      items: [
        SearchInput({ placeholder: 'Buscar decisão…', ariaLabel: 'Buscar decisões', onInput: debounce((v) => { state.q = v; update(); }, 150) }),
        Select({
          placeholder: 'Todas as áreas',
          ariaLabel: 'Filtrar por área',
          value: state.area,
          options: [...areaNames]
            .map(([value, label]) => ({ value, label, n: decisions.filter((d) => d.areas.includes(value)).length }))
            .filter((a) => a.n)
            .map(({ value, label, n }) => ({ value, label: `${label} (${n})` })),
          onChange: (v) => setFilter('area', v),
        }),
        Select({
          placeholder: 'Abertas e resolvidas',
          ariaLabel: 'Filtrar por situação',
          value: state.situacao,
          options: Object.entries(DECISION_SITUATIONS).map(([value, label]) => ({ value, label })),
          onChange: (v) => setFilter('situacao', v),
        }),
      ],
    }),
    count, slot);
}

// ------------------------------------------------------------------ busca

export async function renderSearch(ctx, { query }) {
  const q = query?.get('q') ?? '';
  const res = q ? await api.get(`/api/mapa/busca?q=${encodeURIComponent(q)}`) : { tabelas: [], conceitos: [], entradas: [], vocabularios: [] };
  ctx.setTitle(`Busca no mapa: ${q}`);
  const total = res.tabelas.length + res.conceitos.length + res.entradas.length + res.vocabularios.length;
  const section = (title, rows, columns, key) => (rows.length
    ? Panel({ title: `${title} (${rows.length})`, flush: true, children: [DataTable({ rows, rowKey: key, dense: true, columns })] })
    : null);
  return h('div', { class: 'stack stack--lg' },
    PageHeader({ breadcrumbs: [MAP_HOME, { label: 'Busca' }], eyebrow: 'Mapa do dicionário', title: q ? `Resultados para “${q}”` : 'Buscar no mapa' }),
    MapSearchBox(ctx, q),
    q && !total ? EmptyState({ title: 'Nada encontrado', message: 'Tente outro termo (ao menos 2 letras).', icon: 'search' }) : null,
    section('Tabelas', res.tabelas, [
      { key: 'nome', label: 'Tabela', render: (t) => h('span', { class: 'cell-title' }, h('a', { class: 'cell-title__main', href: mapTableHref(t.tabela) }, t.nome), h('span', { class: 'cell-title__sub mono' }, t.tabela)) },
      { key: 'tipo', label: 'Tipo', render: (t) => MapTableKindBadge(t.tipo) },
      { key: 'grao', label: 'Grão' },
    ], (t) => t.tabela),
    section('Conceitos', res.conceitos, [
      { key: 'rotulo', label: 'Conceito', render: (c) => h('span', { class: 'cell-title' }, h('span', { class: 'cell-title__main' }, c.rotulo), h('span', { class: 'cell-title__sub mono' }, c.conceito)) },
      { key: 'natureza', label: 'Natureza', render: (c) => KindBadge(c.natureza) },
      { key: 'tabela', label: 'Tabela', render: (c) => h('a', { class: 'mono text-sm', href: mapTableHref(c.tabela) }, c.tabela) },
    ], (c) => `${c.tabela}.${c.conceito}`),
    section('Entradas de catálogo', res.entradas, [
      { key: 'rotulo', label: 'Entrada', render: (e) => h('span', { class: 'cell-title' }, h('span', { class: 'cell-title__main' }, e.rotulo), h('span', { class: 'cell-title__sub mono' }, e.codigo)) },
      { key: 'unidade', label: 'Unidade' },
      { key: 'loinc', label: 'LOINC', render: (e) => h('span', { class: 'mono' }, e.loinc || '—') },
      { key: 'tabela', label: 'Tabela', render: (e) => h('a', { class: 'mono text-sm', href: mapTableHref(e.tabela, 'catalogo') }, e.tabela) },
    ], (e) => `${e.tabela}.${e.codigo}`),
    section('Vocabulários', res.vocabularios, [
      { key: 'rotulo', label: 'Vocabulário', render: (v) => h('span', { class: 'cell-title' }, h('a', { class: 'cell-title__main', href: mapVocabularyHref(v.vocabulario) }, v.rotulo), h('span', { class: 'cell-title__sub mono' }, v.vocabulario)) },
      { key: 'tipo', label: 'Tipo', render: (v) => VOCAB_KINDS[v.tipo] ?? v.tipo },
      { key: 'codigos', label: 'Códigos', className: 'cell-num', headerClass: 'cell-num' },
    ], (v) => v.vocabulario));
}
