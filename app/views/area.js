/**
 * Visão da área: tabelas lógicas e progresso pelos conceitos de cada tabela.
 * Áreas futuras exibem apenas estrutura — sem conceitos nem definições.
 */
import {
  Alert, DataTable, EmptyState, KeyValueList, PageHeader, Panel, ProgressBar, h,
} from '/design-system/components.js';
import { AREA_STATUS } from '/shared/semantic-model.js';
import { api } from '../api.js';
import { formatNumber } from '../format.js';
import { TableStatusBadge, tableHref } from '../components/domain.js';

export async function render(ctx, { areaId }) {
  const area = await api.get(`/api/areas/${encodeURIComponent(areaId)}`);
  ctx.setTitle(area.name);
  const future = area.status === 'futura';
  const { tables: t, concepts: c, questions: q } = area.stats;

  const header = PageHeader({
    breadcrumbs: [{ label: 'Visão geral', href: '#/' }, { label: area.name }],
    eyebrow: `Área · ${area.area_id}`,
    title: area.name,
    meta: [TableStatusBadge(future ? 'futura' : 'em_trabalho')],
    description: area.description,
  });

  const progressPanel = Panel({
    title: 'Andamento',
    icon: 'activity',
    children: [KeyValueList([
      { key: 'Tabelas em trabalho', value: `${t.em_trabalho} de ${t.total}` },
      { key: 'Conceitos', value: `${formatNumber(c.total)} (${formatNumber(c.aprovado)} aprovados · ${formatNumber(c.em_revisao)} em revisão · ${formatNumber(c.rascunho)} rascunhos)` },
      { key: 'Decisões pendentes', value: `${q.aberta} abertas · ${q.resolvida} resolvidas` },
    ]), ProgressBar({
      value: c.aprovado,
      max: c.total || 1,
      label: 'Conceitos aprovados por pessoa',
      valueText: `${c.aprovado} de ${formatNumber(c.total)}`,
      tone: future ? 'neutral' : 'info',
    })],
  });

  const tables = area.tables.length
    ? DataTable({
      rows: area.tables,
      rowKey: (x) => x.table_id,
      onRowClick: (x) => ctx.navigate(tableHref(x.table_id)),
      columns: [
        { key: 'name', label: 'Tabela lógica', sortable: true, render: (x) => h('a', { href: tableHref(x.table_id) }, x.name) },
        { key: 'status', label: 'Situação', render: (x) => TableStatusBadge(x.status) },
        { key: 'concepts', label: 'Conceitos', sortable: true, sortValue: (x) => x.stats.concepts.total, render: (x) => String(x.stats.concepts.total) },
        { key: 'progress', label: 'Aprovados', render: (x) => ProgressBar({ value: x.stats.concepts.aprovado, max: x.stats.concepts.total || 1, label: 'Aprovados', valueText: `${x.stats.concepts.aprovado} de ${x.stats.concepts.total}`, tone: x.status === 'futura' ? 'neutral' : 'info' }) },
      ],
    })
    : EmptyState({
      title: 'Nenhuma tabela lógica definida',
      message: 'As tabelas desta área serão propostas a partir do mapa quando a área entrar em revisão. Nada foi definido aqui nesta etapa.',
      icon: 'layers',
    });

  return h('div', { class: 'stack stack--lg' },
    header,
    future
      ? Alert({
        tone: 'neutral',
        title: AREA_STATUS.futura.label,
        children: [h('p', {}, 'Esta área aparece apenas para orientar a navegação e acompanhar o progresso. Não há conceitos, propostas ou definições aprovadas para ela nesta etapa.')],
      })
      : null,
    progressPanel,
    Panel({ title: 'Tabelas lógicas', icon: 'grid', flush: area.tables.length > 0, children: [tables] }),
  );
}
