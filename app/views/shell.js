/**
 * Casca da aplicação: cabeçalho (marca, busca, autoria) e navegação lateral
 * hierárquica área → tabela, com indicadores de progresso e filtro.
 */
import {
  Button, Field, Icon, ProgressBar, SearchInput, TextInput, clear, formDialog, h,
} from '/design-system/components.js';
import { AREA_STATUS } from '/shared/semantic-model.js';
import { api } from '../api.js';
import { formatDateTime } from '../format.js';
import { isExcludedInReadOnly, isReadOnly, readOnlySource } from '../leitura/modo.js';
import { isReservedActor, session } from '../session.js';
import { tableHref } from '../components/domain.js';

const GENERAL_LINKS = [
  { href: '#/', path: '/', label: 'Visão geral', icon: 'home' },
  { href: '#/mapa', path: '/mapa', label: 'Mapa do dicionário', icon: 'grid' },
  { href: '#/mapa-mental', path: '/mapa-mental', label: 'Mapa mental', icon: 'share-2' },
  { href: '#/publicado', path: '/publicado', label: 'Dicionário publicado', icon: 'book' },
  { href: '#/auditoria', path: '/auditoria', label: 'Auditoria', icon: 'clock' },
  { href: '#/design-system', path: '/design-system', label: 'Design System', icon: 'pen-tool' },
];

export function createShell(root) {
  let areas = [];
  let currentPath = '/';
  let filter = '';
  let ctx = null;

  const actorName = h('span', { class: 'actor-chip__name' });
  const actorButton = h('button', { class: 'actor-chip', type: 'button', onClick: () => askIdentity() }, Icon('user'), actorName);
  // Versão de leitura: no lugar da autoria, o aviso de que nada se altera aqui e de quando foi gerada.
  const generatedAt = readOnlySource()?.generatedAt;
  const readOnlyChip = h('span', {
    class: 'actor-chip actor-chip--static',
    title: generatedAt ? `Versão somente leitura gerada em ${formatDateTime(generatedAt)}` : 'Versão somente leitura',
  }, Icon('eye'), h('span', { class: 'actor-chip__name' }, 'Somente leitura'));
  const menuButton = Button({ label: 'Abrir navegação', icon: 'menu', iconOnly: true, variant: 'header', onClick: () => toggleNav() });
  menuButton.classList.add('app__menu-button');
  menuButton.setAttribute('aria-controls', 'navegacao');
  menuButton.setAttribute('aria-expanded', 'false');

  const search = SearchInput({
    placeholder: 'Buscar conceitos e tabelas…',
    ariaLabel: 'Buscar no dicionário',
    variant: 'header',
    onSubmit: (q) => {
      if (q.trim()) location.hash = `#/busca?q=${encodeURIComponent(q.trim())}`;
    },
  });

  const header = h('header', { class: 'app__header' },
    menuButton,
    h('a', { class: 'app__brand', href: '#/' },
      h('span', { class: 'app__brand-title' }, 'Dicionário semântico'),
      h('span', { class: 'app__brand-subtitle' }, 'Registro HPB · Santa Casa de São Paulo')),
    h('div', { class: 'app__header-search', role: 'search' }, search),
    h('div', { class: 'app__header-actions' }, isReadOnly() ? readOnlyChip : actorButton));

  const navRoot = h('nav', { class: 'nav', 'aria-label': 'Navegação do dicionário' });
  const sidebar = h('aside', { class: 'app__sidebar', id: 'navegacao' }, navRoot);
  const scrim = h('div', { class: 'app__scrim', onClick: () => closeNav() });
  const content = h('div', { class: 'app__content' });
  const main = h('main', { class: 'app__main', id: 'conteudo', tabindex: '-1' }, content);

  function toggleNav(force = null) {
    const open = force ?? root.dataset.navOpen !== 'true';
    root.dataset.navOpen = String(open);
    menuButton.setAttribute('aria-expanded', String(open));
  }
  const closeNav = () => toggleNav(false);

  function renderActor() {
    const name = session.actor();
    actorName.textContent = name || 'Identificar-se';
    actorButton.setAttribute('aria-label', name ? `Autor das alterações: ${name}. Trocar` : 'Identificar-se como autor das alterações');
  }

  async function askIdentity() {
    const input = TextInput({ value: session.actor(), placeholder: 'Nome e sobrenome' });
    const field = Field({
      label: 'Seu nome',
      control: input,
      required: true,
      hint: 'Não é login: o nome fica registrado como autor de cada rascunho, aprovação e decisão, e aparece na auditoria.',
    });
    const result = await formDialog({
      title: 'Quem está editando?',
      description: 'Toda alteração do dicionário exige autoria identificada.',
      body: [field],
      submitLabel: 'Confirmar',
      onSubmit: () => {
        const name = input.value.trim();
        if (name.length < 3) {
          field.setError('Informe ao menos 3 caracteres.');
          return false;
        }
        if (isReservedActor(name)) {
          field.setError('Nomes iniciados por "ia:" ou "sistema:" são reservados.');
          return false;
        }
        session.setActor(name);
        return name;
      },
    });
    return result || null;
  }

  function isCurrent(path) {
    return currentPath === path;
  }

  function matchesFilter(text) {
    if (!filter) return true;
    const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    return norm(text).includes(norm(filter));
  }

  function areaProgress(area) {
    const { aprovado, total } = area.stats.concepts;
    return ProgressBar({
      value: aprovado,
      max: total || 1,
      label: `Conceitos aprovados em ${area.name}`,
      valueText: `${aprovado} de ${total} conceitos aprovados`,
      tone: area.status === 'futura' ? 'neutral' : 'info',
      showLabel: false,
    });
  }

  function renderNav() {
    clear(navRoot);
    navRoot.appendChild(h('div', { class: 'nav__section' },
      h('ul', { class: 'nav__list' }, ...GENERAL_LINKS.filter((l) => !isExcludedInReadOnly(l.path)).map((l) => h('li', {},
        h('a', { class: 'nav__link', href: l.href, 'aria-current': isCurrent(l.path) ? 'page' : null }, Icon(l.icon), h('span', { class: 'nav__link-text' }, l.label)))))));

    const filterInput = SearchInput({
      value: filter,
      placeholder: 'Filtrar áreas e tabelas',
      ariaLabel: 'Filtrar áreas e tabelas',
      onInput: (value) => {
        filter = value;
        renderAreaList(list);
      },
    });
    const list = h('div', {});
    navRoot.appendChild(h('div', { class: 'nav__section' },
      h('p', { class: 'nav__heading', id: 'nav-areas' }, 'Áreas do dicionário'),
      h('div', { class: 'nav__filter' }, filterInput),
      list));
    renderAreaList(list);
  }

  function renderAreaList(list) {
    clear(list);
    const visible = areas.filter((a) => matchesFilter(a.name) || a.tables.some((t) => matchesFilter(t.name)));
    if (visible.length === 0) {
      list.appendChild(h('p', { class: 'nav__meta' }, 'Nenhuma área corresponde ao filtro.'));
      return;
    }
    list.appendChild(h('ul', { class: 'nav__list', 'aria-labelledby': 'nav-areas' }, ...visible.map((area) => {
      const areaPath = `/area/${area.area_id}`;
      const meta = h('span', { class: 'nav__meta', title: 'Conceitos aprovados / conceitos da área' }, `${area.stats.concepts.aprovado}/${area.stats.concepts.total}`);
      const future = area.status === 'futura';
      if (area.tables.length === 0) {
        return h('li', { class: ['nav__area', future && 'nav__area--future'] },
          h('a', { class: 'nav__link nav__area-row', href: `#${areaPath}`, 'aria-current': isCurrent(areaPath) ? 'page' : null, title: future ? AREA_STATUS.futura.label : null },
            Icon('layers', { size: 'sm' }),
            h('span', { class: 'nav__area-name nav__link-text' }, area.name),
            meta,
            areaProgress(area)));
      }
      const containsCurrent = isCurrent(areaPath) || area.tables.some((t) => currentPath.startsWith(`/tabela/${t.table_id}`));
      const tables = area.tables.filter((t) => matchesFilter(t.name) || matchesFilter(area.name));
      return h('li', {},
        h('details', { class: ['nav__area', future && 'nav__area--future'], open: containsCurrent || Boolean(filter) || area.status === 'ativa' },
          h('summary', { class: 'nav__area-row' },
            h('span', { class: 'nav__chevron' }, Icon('chevron-right', { size: 'sm' })),
            h('span', { class: 'nav__area-name' }, area.name),
            meta,
            areaProgress(area)),
          h('ul', { class: 'nav__tables' },
            h('li', {}, h('a', { class: 'nav__link', href: `#${areaPath}`, 'aria-current': isCurrent(areaPath) ? 'page' : null }, h('span', { class: 'nav__link-text' }, 'Visão da área'))),
            ...tables.map((t) => {
              const href = tableHref(t.table_id);
              const current = currentPath.startsWith(`/tabela/${t.table_id}`);
              const tableMeta = t.status === 'futura'
                ? h('span', { class: 'nav__meta' }, 'futura')
                : h('span', { class: 'nav__meta', title: 'Conceitos aprovados / conceitos da tabela' }, `${t.stats.concepts.aprovado}/${t.stats.concepts.total}`);
              return h('li', {}, h('a', { class: 'nav__link', href, 'aria-current': current ? 'page' : null },
                h('span', { class: 'nav__link-text' }, t.name), tableMeta));
            }))));
    })));
  }

  async function refreshNav() {
    try {
      areas = await api.get('/api/nav');
      renderNav();
    } catch (error) {
      clear(navRoot).appendChild(h('p', { class: 'nav__meta' }, `Falha ao carregar a navegação: ${error.message}`));
    }
  }

  return {
    content,
    mount(context) {
      ctx = context;
      root.append(header, sidebar, scrim, main);
      document.querySelector('.skip-link')?.addEventListener('click', (event) => {
        event.preventDefault();
        main.focus();
      });
      renderActor();
      session.onChange(renderActor);
      refreshNav();
    },
    setCurrent(path) {
      currentPath = path;
      if (areas.length) renderNav();
    },
    closeNav,
    refreshNav,
    /** Garante que há autoria antes de escrever; pede o nome se necessário. */
    async ensureActor() {
      if (session.actor()) return session.actor();
      return askIdentity();
    },
    get context() {
      return ctx;
    },
  };
}
