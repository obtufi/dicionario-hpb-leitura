/**
 * Inicialização e roteamento (hash) da interface do dicionário semântico.
 * Cada tela em ./views exporta render(ctx, params) → Node.
 */
import { Alert, Button, EmptyState, LoadingBlock, clear, confirmDialog, h, toast } from '/design-system/components.js';
import { ApiError } from './api.js';
import { isExcludedInReadOnly } from './leitura/modo.js';
import { createShell } from './views/shell.js';
import * as overview from './views/overview.js';
import * as area from './views/area.js';
import * as table from './views/table.js';
import * as concept from './views/concept.js';
import * as search from './views/search.js';
import * as published from './views/published.js';
import * as audit from './views/audit.js';
import * as styleguide from './views/styleguide.js';
import * as map from './views/map.js';
import * as mindmap from './views/mindmap.js';

const ROUTES = [
  { pattern: /^\/mapa$/, view: { render: map.renderOverview }, keys: [] },
  { pattern: /^\/mapa\/area\/([^/]+)$/, view: { render: map.renderArea }, keys: ['areaKey'] },
  { pattern: /^\/mapa\/tabela\/([^/]+)(?:\/([^/]+))?$/, view: { render: map.renderTable }, keys: ['tableKey', 'tab'] },
  { pattern: /^\/mapa\/vocabularios$/, view: { render: map.renderVocabularies }, keys: [] },
  { pattern: /^\/mapa\/vocabulario\/([^/]+)$/, view: { render: map.renderVocabulary }, keys: ['vocabKey'] },
  { pattern: /^\/mapa\/decisoes$/, view: { render: map.renderDecisions }, keys: [] },
  { pattern: /^\/mapa\/busca$/, view: { render: map.renderSearch }, keys: [] },
  // Imersiva: a tela ocupa a janela inteira, sem cabeçalho nem navegação lateral.
  { pattern: /^\/mapa-mental$/, view: mindmap, keys: [], immersive: true },
  { pattern: /^\/$/, view: overview, keys: [] },
  { pattern: /^\/area\/([^/]+)$/, view: area, keys: ['areaId'] },
  { pattern: /^\/tabela\/([^/]+)(?:\/([^/]+))?$/, view: table, keys: ['tableId', 'tab'] },
  { pattern: /^\/conceito\/([^/]+)(?:\/([^/]+))?$/, view: concept, keys: ['conceptId', 'tab'] },
  { pattern: /^\/busca$/, view: search, keys: [] },
  { pattern: /^\/publicado$/, view: published, keys: [] },
  { pattern: /^\/auditoria$/, view: audit, keys: [] },
  { pattern: /^\/design-system$/, view: styleguide, keys: [] },
];

const root = document.getElementById('app');
const shell = createShell(root);
let currentHash = null;
let dirtyCheck = null;
let renderToken = 0;

function parseHash() {
  const raw = location.hash.startsWith('#/') ? location.hash.slice(1) : '/';
  const [path, queryString = ''] = raw.split('?');
  return { path: path || '/', query: new URLSearchParams(queryString), raw };
}

const ctx = {
  shell,
  navigate(hash) {
    location.hash = hash;
  },
  refreshNav: () => shell.refreshNav(),
  ensureActor: () => shell.ensureActor(),
  /** Registra verificação de alterações não salvas (função → boolean) ou null. */
  setDirtyCheck(fn) {
    dirtyCheck = fn;
  },
  setTitle(text) {
    document.title = text ? `${text} · Dicionário semântico HPB` : 'Dicionário semântico · Registro HPB';
  },
  /** Mostra erro da API como notificação; retorna a mensagem. */
  fail(error, prefix = '') {
    const message = error instanceof ApiError || error?.message ? error.message : String(error);
    toast(prefix ? `${prefix}: ${message}` : message, { tone: 'danger' });
    return message;
  },
  /** Recarrega a tela atual; keepScroll preserva a posição (ex.: após decidir um item da lista). */
  async rerender({ keepScroll = false } = {}) {
    currentHash = null;
    pendingScroll = keepScroll ? window.scrollY : null;
    await route();
  },
};

let pendingScroll = null;

async function route() {
  const { path, query, raw } = parseHash();
  if (raw === currentHash) return;
  if (dirtyCheck?.()) {
    const previous = currentHash;
    const { confirmed } = await confirmDialog({
      title: 'Descartar alterações não salvas?',
      message: 'Há alterações neste rascunho que ainda não foram salvas. Se sair agora, elas serão perdidas.',
      confirmLabel: 'Sair sem salvar',
      cancelLabel: 'Continuar editando',
      tone: 'danger',
    });
    if (!confirmed) {
      if (previous) history.replaceState(null, '', `#${previous}`);
      return;
    }
  }
  dirtyCheck = null;
  currentHash = raw;
  const token = ++renderToken;
  const main = shell.content;
  const match = ROUTES.map((r) => ({ r, m: r.pattern.exec(path) })).find((x) => x.m);
  root.classList.toggle('app--imersivo', Boolean(match?.r.immersive) && !isExcludedInReadOnly(path));
  shell.setCurrent(path);
  shell.closeNav();
  const restoreScroll = pendingScroll;
  pendingScroll = null;
  if (restoreScroll === null) {
    clear(main).appendChild(LoadingBlock());
    window.scrollTo(0, 0);
  }
  try {
    let node;
    if (!match) {
      ctx.setTitle('Página não encontrada');
      node = EmptyState({ title: 'Página não encontrada', message: `Não há tela para "${path}".`, icon: 'help-circle', action: Button({ label: 'Ir para a visão geral', href: '#/' }) });
    } else if (isExcludedInReadOnly(path)) {
      ctx.setTitle('Fora da versão de leitura');
      node = EmptyState({
        title: 'Fora da versão de leitura',
        message: 'Esta tela faz parte do trabalho de edição do dicionário e não está na versão somente leitura.',
        icon: 'lock',
        action: Button({ label: 'Ir para a visão geral', href: '#/' }),
      });
    } else {
      const params = Object.fromEntries(match.r.keys.map((k, i) => [k, match.m[i + 1] ? decodeURIComponent(match.m[i + 1]) : null]));
      node = await match.r.view.render(ctx, { ...params, query });
    }
    if (token !== renderToken) return; // navegação mais recente em curso
    clear(main).appendChild(node);
    if (restoreScroll !== null) window.scrollTo(0, restoreScroll);
    else main.querySelector('h1')?.focus({ preventScroll: true });
  } catch (error) {
    if (token !== renderToken) return;
    console.error(error);
    clear(main).appendChild(Alert({
      tone: 'danger',
      title: error.status === 404 ? 'Item não encontrado' : 'Não foi possível carregar esta tela',
      children: [h('p', {}, error.message)],
      actions: [Button({ label: 'Tentar novamente', icon: 'undo', size: 'sm', onClick: () => ctx.rerender() })],
      role: 'alert',
    }));
  }
}

window.addEventListener('hashchange', route);
window.addEventListener('beforeunload', (event) => {
  if (dirtyCheck?.()) {
    event.preventDefault();
    event.returnValue = '';
  }
});

shell.mount(ctx);
if (!location.hash.startsWith('#/')) history.replaceState(null, '', '#/');
route();
