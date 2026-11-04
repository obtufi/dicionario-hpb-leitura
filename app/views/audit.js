/**
 * Auditoria: trilha somente inserção de todas as alterações do dicionário.
 */
import { Button, DataTable, PageHeader, Panel, SearchInput, debounce, h } from '/design-system/components.js';
import { api } from '../api.js';
import { formatActor, formatDateTime } from '../format.js';
import { conceptHref, tableHref } from '../components/domain.js';

export async function render(ctx) {
  ctx.setTitle('Auditoria');
  let events = await api.get('/api/audit?limite=200');
  let filter = '';
  const slot = h('div', {});

  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const draw = () => {
    const rows = events.filter((e) => !filter || norm(`${e.summary} ${e.actor} ${e.action} ${e.concept_id ?? ''}`).includes(norm(filter)));
    slot.replaceChildren(DataTable({
      rows,
      rowKey: (e) => e.event_id,
      dense: true,
      columns: [
        { key: 'event_id', label: '#', sortable: true, render: (e) => h('span', { class: 'mono' }, String(e.event_id)) },
        { key: 'occurred_at', label: 'Quando', sortable: true, render: (e) => h('span', { class: 'nowrap' }, formatDateTime(e.occurred_at)) },
        { key: 'actor', label: 'Quem', sortable: true, render: (e) => formatActor(e.actor) },
        { key: 'action', label: 'Ação', sortable: true, render: (e) => h('span', { class: 'mono text-xs' }, e.action) },
        { key: 'summary', label: 'Descrição', render: (e) => e.summary },
        {
          key: 'concept_id',
          label: 'Referência',
          render: (e) => {
            if (e.concept_id) return h('a', { class: 'mono', href: conceptHref(e.concept_id) }, e.concept_id);
            if (e.table_id) return h('a', { class: 'mono', href: tableHref(e.table_id) }, e.table_id);
            return '—';
          },
        },
      ],
    }));
  };

  const more = Button({
    label: 'Carregar mais',
    size: 'sm',
    onClick: async () => {
      const last = events[events.length - 1];
      if (!last) return;
      const older = await api.get(`/api/audit?limite=200&antes_de=${last.event_id}`);
      if (older.length === 0) more.disabled = true;
      events = events.concat(older);
      draw();
    },
  });

  draw();
  return h('div', { class: 'stack stack--lg' },
    PageHeader({
      breadcrumbs: [{ label: 'Visão geral', href: '#/' }, { label: 'Auditoria' }],
      title: 'Auditoria',
      description: 'Cada criação, salvamento, envio, aprovação, devolução, descarte, questão e mudança de estrutura é registrado na mesma transação da alteração. O registro não pode ser alterado nem apagado.',
    }),
    SearchInput({ placeholder: 'Filtrar eventos carregados…', ariaLabel: 'Filtrar eventos', onInput: debounce((v) => { filter = v; draw(); }, 150) }),
    Panel({ title: 'Eventos', icon: 'clock', flush: true, children: [slot], footer: [more] }));
}
