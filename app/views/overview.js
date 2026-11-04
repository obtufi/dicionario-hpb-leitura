/**
 * Visão geral: progresso da reconstrução por área (tabelas e conceitos),
 * situação dos conceitos e atividade recente.
 */
import {
  Alert, Button, DataTable, PageHeader, Panel, ProgressBar, Stat, StatGrid, Timeline, h,
} from '/design-system/components.js';
import { api } from '../api.js';
import { formatActor, formatDateTime, formatNumber } from '../format.js';
import { isReadOnly } from '../leitura/modo.js';
import { TableStatusBadge, tableHref } from '../components/domain.js';

export async function render(ctx) {
  ctx.setTitle('Visão geral');
  const [data, map] = await Promise.all([api.get('/api/overview'), api.get('/api/mapa')]);
  const t = data.totals;

  const stats = StatGrid([
    Stat({ label: 'Tabelas lógicas', value: formatNumber(t.tables), hint: `${formatNumber(t.tables_started)} iniciadas, uma por vez`, tone: 'info' }),
    Stat({ label: 'Conceitos', value: formatNumber(t.concepts), hint: `${formatNumber(t.ai_proposals_pending)} propostas de IA não avaliadas`, tone: 'accent' }),
    Stat({ label: 'Aprovados', value: formatNumber(t.aprovado), hint: `${formatNumber(t.em_revisao)} em revisão · ${formatNumber(t.rascunho)} em rascunho`, tone: 'success' }),
    Stat({ label: 'Decisões pendentes', value: formatNumber(t.questions_open), hint: `${formatNumber(t.questions_resolved)} já resolvidas`, tone: 'warning' }),
  ]);

  const areaRows = data.areas.map((a) => ({ ...a, approved: a.stats.concepts.aprovado, concepts: a.stats.concepts.total, started: a.stats.tables.em_trabalho }));
  const areasTable = DataTable({
    caption: 'Progresso por área: tabelas em trabalho e conceitos aprovados por pessoa.',
    rows: areaRows,
    rowKey: (r) => r.area_id,
    onRowClick: (r) => ctx.navigate(`#/area/${r.area_id}`),
    columns: [
      { key: 'name', label: 'Área', sortable: true, render: (r) => h('a', { href: `#/area/${r.area_id}` }, r.name) },
      { key: 'status', label: 'Situação', sortable: true, render: (r) => TableStatusBadge(r.status === 'ativa' ? 'em_trabalho' : 'futura') },
      { key: 'started', label: 'Tabelas', sortable: true, render: (r) => `${r.started} de ${r.stats.tables.total}` },
      {
        key: 'approved',
        label: 'Conceitos aprovados',
        sortable: true,
        render: (r) => ProgressBar({ value: r.approved, max: r.concepts || 1, label: 'Aprovados', valueText: `${r.approved} de ${formatNumber(r.concepts)}`, tone: r.status === 'ativa' ? 'info' : 'neutral' }),
      },
      { key: 'concepts', label: 'Conceitos', sortable: true, className: 'cell-num', headerClass: 'cell-num' },
    ],
  });

  const active = data.areas.flatMap((a) => a.tables).filter((tb) => tb.status === 'em_trabalho');
  const recent = data.recent.map((e) => ({
    title: e.summary,
    meta: `${formatDateTime(e.occurred_at)} · ${formatActor(e.actor)}`,
    tone: e.action.includes('aprovada') || e.action.includes('aceita') ? 'success' : e.action.includes('rejeitada') || e.action.includes('descartada') ? 'danger' : e.actor.startsWith('ia:') ? 'accent' : 'info',
  }));

  return h('div', { class: 'stack stack--lg' },
    PageHeader({
      title: 'Reconstrução do dicionário semântico',
      description: 'O dicionário define cada conceito uma única vez; observações, eventos e definições derivadas referenciam esses conceitos. A reconstrução segue o mapa do dicionário, tabela a tabela, e cada conceito só vale depois de aprovado por pessoa.',
    }),
    Alert({
      tone: 'accent',
      title: 'Propostas de IA não são definições oficiais',
      children: [h('p', {}, 'Rascunhos e decisões sugeridos pela IA aparecem marcados como “Proposta IA”. Somente pessoas aceitam, editam, rejeitam, enviam para revisão e aprovam. O dicionário publicado contém exclusivamente revisões aprovadas.')],
    }),
    stats,
    map.disponivel
      ? Panel({
        title: 'Mapa do dicionário (revisão completa, proposta)',
        icon: 'grid',
        actions: [Button({ label: 'Abrir o mapa', icon: 'chevron-right', href: '#/mapa', size: 'sm' })],
        children: [h('p', {}, `Todo o dicionário de trabalho (${formatNumber(map.estatisticas.antes.variaveis_dicionario)} variáveis, ${formatNumber(map.estatisticas.antes.opcoes)} opções de resposta) foi revisado e reorganizado em ${map.estatisticas.depois.areas} áreas e ${formatNumber(map.estatisticas.depois.tabelas)} tabelas lógicas com grão explícito, ${formatNumber(map.estatisticas.depois.conceitos)} conceitos e ${formatNumber(map.estatisticas.depois.entradas_de_catalogo)} entradas de catálogo. É o guia da reconstrução, tabela a tabela; nada dele é definição aprovada.`)],
      })
      : null,
    active.length
      ? Panel({
        title: 'Em trabalho agora',
        icon: 'edit',
        children: [h('ul', { class: 'ref-list' }, ...active.map((tb) => h('li', { class: 'ref-list__item' },
          h('a', { href: tableHref(tb.table_id) }, tb.name),
          TableStatusBadge(tb.status),
          h('span', { class: 'text-muted text-sm' }, `${tb.stats.concepts.total} conceitos · ${tb.stats.concepts.aprovado} aprovados · ${tb.stats.questions.aberta} decisões pendentes`))))],
      })
      : null,
    Panel({ title: 'Áreas', icon: 'layers', flush: true, children: [areasTable] }),
    Panel({
      title: 'Atividade recente',
      icon: 'clock',
      actions: isReadOnly() ? [] : [h('a', { href: '#/auditoria', class: 'text-sm' }, 'Ver auditoria completa')],
      children: [recent.length ? Timeline(recent) : h('p', { class: 'text-muted' }, 'Sem atividade registrada.')],
    }),
  );
}
