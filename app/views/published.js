/**
 * Dicionário publicado: somente revisões aprovadas por pessoas.
 * É a única visão que futuros esquemas, contratos de API e formulários
 * poderão consumir (exportação JSON em /api/published).
 */
import { Alert, Button, EmptyState, KeyValueList, PageHeader, Panel, h } from '/design-system/components.js';
import { VALUE_TYPES } from '/shared/semantic-model.js';
import { api } from '../api.js';
import { formatActor, formatDateTime } from '../format.js';
import { isReadOnly } from '../leitura/modo.js';
import { ConceptStatusBadge, KindBadge, conceptHref, tableHref } from '../components/domain.js';

/** Na versão de leitura não há servidor: o JSON sai dos dados já abertos, como arquivo baixado. */
function downloadJson(data, fileName) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = h('a', { href: url, download: fileName, hidden: true });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function render(ctx) {
  ctx.setTitle('Dicionário publicado');
  const data = await api.get('/api/published');
  const byTable = new Map();
  for (const c of data.concepts) {
    const list = byTable.get(c.home_table_id) ?? [];
    list.push(c);
    byTable.set(c.home_table_id, list);
  }

  const groups = [...byTable.entries()].map(([tableId, items]) => Panel({
    title: items[0].home_table_name ?? tableId,
    icon: 'book',
    actions: [h('a', { href: tableHref(tableId), class: 'text-sm' }, 'Abrir tabela')],
    children: [h('div', { class: 'stack' }, ...items.sort((a, b) => a.concept_id.localeCompare(b.concept_id)).map((c) => h('article', { class: 'stack stack--sm' },
      h('div', { class: 'cluster' },
        h('a', { class: 'mono', href: conceptHref(c.concept_id) }, c.concept_id),
        h('strong', {}, c.content.label),
        KindBadge(c.content.kind),
        ConceptStatusBadge(c.status)),
      h('p', { class: 'prose' }, c.content.definition),
      KeyValueList([
        { key: 'Nome canônico', value: c.content.code, mono: true },
        c.content.value_type ? { key: 'Tipo de valor', value: VALUE_TYPES[c.content.value_type]?.label } : null,
        { key: 'Revisão publicada', value: `${c.revision_number} · aprovada por ${formatActor(c.approved_by)} em ${formatDateTime(c.approved_at)}` },
      ])))) ],
  }));

  return h('div', { class: 'stack stack--lg' },
    PageHeader({
      breadcrumbs: [{ label: 'Visão geral', href: '#/' }, { label: 'Dicionário publicado' }],
      title: 'Dicionário publicado',
      description: data.policy,
      actions: [isReadOnly()
        ? Button({ label: 'Exportar JSON', icon: 'download', onClick: () => downloadJson(data, 'dicionario-publicado.json') })
        : Button({ label: 'Exportar JSON', icon: 'download', href: '/api/published', target: '_blank' })],
    }),
    Alert({ tone: 'info', children: [h('p', {}, `Versão do metamodelo: ${data.model_version}. Esta visão é a fonte para derivações futuras (validação, contratos de API, formulários, consultas e ferramentas MCP).`)] }),
    ...(groups.length ? groups : [EmptyState({ title: 'Nenhuma definição aprovada ainda', message: 'As propostas e rascunhos só aparecem aqui depois de enviados para revisão e aprovados por uma pessoa.', icon: 'book' })]));
}
