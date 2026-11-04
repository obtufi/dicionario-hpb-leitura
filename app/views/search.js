/**
 * Busca global: conceitos (todas as naturezas) e tabelas.
 */
import { DataTable, EmptyState, PageHeader, Panel, SearchInput, h } from '/design-system/components.js';
import { api } from '../api.js';
import { ConceptRef, ConceptStatusBadge, KindBadge, TableStatusBadge, conceptHref, tableHref } from '../components/domain.js';

export async function render(ctx, { query }) {
  const q = query.get('q') ?? '';
  ctx.setTitle(q ? `Busca: ${q}` : 'Busca');
  const result = q ? await api.get(`/api/search?q=${encodeURIComponent(q)}`) : { concepts: [], tables: [] };
  const total = result.concepts.length + result.tables.length;

  const searchBox = SearchInput({
    value: q,
    placeholder: 'Buscar conceitos e tabelas…',
    ariaLabel: 'Termo de busca',
    onSubmit: (value) => ctx.navigate(`#/busca?q=${encodeURIComponent(value.trim())}`),
  });

  const sections = [];
  if (result.concepts.length) {
    sections.push(Panel({
      title: `Conceitos (${result.concepts.length})`,
      icon: 'book',
      flush: true,
      children: [DataTable({
        rows: result.concepts,
        rowKey: (c) => c.concept_id,
        onRowClick: (c) => ctx.navigate(conceptHref(c.concept_id)),
        columns: [
          { key: 'concept_id', label: 'Conceito', sortable: true, render: (c) => ConceptRef(c, { showStatus: false }) },
          { key: 'kind', label: 'Natureza', render: (c) => KindBadge(c.kind) },
          { key: 'status', label: 'Estado', render: (c) => ConceptStatusBadge(c.status, { pending: c.pending_status }) },
          { key: 'home_table_name', label: 'Tabela', render: (c) => h('a', { href: tableHref(c.home_table_id) }, c.home_table_name ?? c.home_table_id) },
        ],
      })],
    }));
  }
  if (result.tables.length) {
    sections.push(Panel({
      title: `Tabelas lógicas (${result.tables.length})`,
      icon: 'grid',
      children: [h('ul', { class: 'ref-list' }, ...result.tables.map((t) => h('li', { class: 'ref-list__item' }, h('a', { href: tableHref(t.table_id) }, t.name), TableStatusBadge(t.status))))],
    }));
  }

  return h('div', { class: 'stack stack--lg' },
    PageHeader({ breadcrumbs: [{ label: 'Visão geral', href: '#/' }, { label: 'Busca' }], title: q ? `Resultados para “${q}”` : 'Busca', description: q ? `${total} resultado(s). A busca considera identificador, nome canônico, nome de exibição, sinônimos e definição.` : null }),
    searchBox,
    ...(sections.length ? sections : [EmptyState({ title: q ? 'Nada encontrado' : 'Digite um termo para buscar', message: q ? 'Tente outro termo ou verifique a grafia.' : null, icon: 'search' })]));
}
