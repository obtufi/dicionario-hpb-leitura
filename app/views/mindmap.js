/**
 * Mapa mental do dicionário: grafo de áreas, tabelas e conceitos que cresce do centro para a
 * periferia (raiz → áreas → tabelas → conceitos), à maneira do grafo do Obsidian: zoom, arraste
 * de nós, busca, destaque da vizinhança e painel do nó selecionado. Desenho em canvas
 * (../graph/renderer.js) sobre a simulação de forças (../graph/simulation.js); as cores vêm dos
 * tokens --color-graph-* do Design System. O painel Ajustes, como o do Obsidian, muda na hora a
 * velocidade da construção, as forças e a exibição; os ajustes ficam guardados neste navegador.
 */
import { Button, Checkbox, Disclosure, EmptyState, SearchInput, Slider, clear, debounce, h, uid } from '/design-system/components.js';
import { KINDS } from '/shared/semantic-model.js';
import { api } from '../api.js';
import { formatNumber } from '../format.js';
import { ConceptStatusBadge, KindBadge, TableStatusBadge, conceptHref, tableHref } from '../components/domain.js';
import { FORCE_DEFAULTS, FORCE_LIMITS, GROWTH_SPEEDS, createGrowth, createSimulation, growthOrder, normalizeForces, sectorAngles } from '../graph/simulation.js';
import { DISPLAY_DEFAULTS, DISPLAY_LIMITS, createRenderer, normalizeDisplay } from '../graph/renderer.js';

const AREA_COLORS = 15;
const TYPE_LABEL = { raiz: 'Dicionário', area: 'Área', tabela: 'Tabela lógica', conceito: 'Conceito' };
const ZOOM_MIN = 0.04;
const ZOOM_MAX = 8;
const MAX_NEIGHBORS = 14;

const normalize = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const areaHref = (id) => `#/area/${encodeURIComponent(id)}`;

// ------------------------------------------------------------ ajustes (como no Obsidian)
const SETTINGS_KEY = 'hpb.mapa-mental.ajustes';
// Construção devagar por padrão (escolha do pesquisador em 03/11/2026), para ver o mapa crescer.
const DEFAULT_SPEED = 0.25;
const FORCE_CONTROLS = [
  { key: 'center', label: 'Força central', hint: 'Puxa cada nível para o seu anel em volta do centro.' },
  { key: 'repel', label: 'Repulsão', hint: 'Afasta os nós uns dos outros.' },
  { key: 'link', label: 'Força das ligações', hint: 'Aproxima os nós ligados.' },
  { key: 'distance', label: 'Distância das ligações', hint: 'Espaça as ligações e os anéis.' },
  { key: 'sector', label: 'Força dos setores', hint: 'Mantém cada área na sua fatia do mapa.' },
];
const DISPLAY_CONTROLS = [
  { key: 'nodeSize', label: 'Tamanho dos nós', step: 5 },
  { key: 'linkWidth', label: 'Espessura das ligações', step: 5 },
  { key: 'labelZoom', label: 'Zoom dos rótulos', step: 10, hint: 'A partir deste zoom aparecem os rótulos dos conceitos; os das tabelas acompanham.' },
];
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const formatSpeed = (speed) => `${decimal.format(speed)}×`;
const formatPercent = (value) => `${Math.round(value)}%`;
const toPercent = (multiplier) => Math.round(multiplier * 100);

/** Ajustes guardados neste navegador (conveniência de quem vê: podem faltar ou vir inválidos). */
function loadSettings() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null');
  } catch {
    saved = null;
  }
  return {
    speed: GROWTH_SPEEDS.includes(saved?.speed) ? saved.speed : DEFAULT_SPEED,
    forces: normalizeForces(saved?.forces),
    display: normalizeDisplay(saved?.display),
  };
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Sem armazenamento (janela privada, dados bloqueados): os ajustes valem só nesta visita.
  }
}

/** Como o vizinho se liga ao nó, visto a partir do nó (as ligações têm sentido). */
function relation(link, selfId, other) {
  const fromSelf = link.source === selfId;
  if (link.type === 'origem') return fromSelf ? 'conceito da tabela' : 'tabela de origem';
  if (link.type === 'uso') return fromSelf ? 'conceito de outra tabela, usado aqui' : 'tabela que usa o conceito';
  if (link.type === 'vocabulario') return fromSelf ? 'vocabulário do conceito' : 'conceito que usa o vocabulário';
  return TYPE_LABEL[other.type];
}

function readPalette(el) {
  const css = getComputedStyle(el);
  const v = (name) => css.getPropertyValue(name).trim();
  return {
    bg: v('--color-graph-bg'),
    link: v('--color-graph-link'),
    linkUse: v('--color-graph-link-use'),
    linkVocabulary: v('--color-graph-link-vocabulary'),
    label: v('--color-graph-label'),
    labelMuted: v('--color-graph-label-muted'),
    highlight: v('--color-graph-highlight'),
    draft: v('--color-graph-draft'),
    root: v('--color-graph-root'),
    areas: Array.from({ length: AREA_COLORS }, (_, i) => v(`--color-graph-area-${i + 1}`)),
    font: v('--font-sans') || 'sans-serif',
  };
}

export async function render(ctx) {
  ctx.setTitle('Mapa mental');
  const data = await api.get('/api/grafo');
  if (!data.nodes.length) return EmptyState({ title: 'Dicionário vazio', message: 'Não há áreas nem conceitos para desenhar.', icon: 'share-2' });

  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const angles = sectorAngles(data.nodes);
  for (const n of data.nodes) n.angle = angles.get(n.id) ?? null;
  const areaNodes = data.nodes.filter((n) => n.type === 'area');
  const areaColor = new Map(areaNodes.map((n) => [n.area, n.order % AREA_COLORS]));
  const order = growthOrder(data.nodes, (id) => byId.get(id).parent);
  const linksOf = new Map();
  for (const l of data.links) {
    for (const end of [l.source, l.target]) {
      if (!linksOf.has(end)) linksOf.set(end, []);
      linksOf.get(end).push(l);
    }
  }
  const searchIndex = data.nodes.map((node) => ({ node, text: normalize(`${node.label} ${node.code ?? ''}`), code: normalize(node.code ?? '') }));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------ estado
  const options = { concepts: true, uses: true, vocabulary: false };
  let settings = loadSettings();
  const persist = debounce(() => saveSettings(settings), 300);
  const growth = createGrowth(settings.speed);
  let sim = null;
  let renderer = null;
  let palette = null;
  let queue = [];
  let running = false;
  let paused = false;
  let settling = false; // movimento reduzido: assenta sem desenhar e mostra o resultado
  let fitAfterSettle = false;
  let follow = true; // a câmera acompanha o crescimento até a primeira interação
  let hover = null;
  let selected = null;
  let drag = null;

  const visible = (n) => options.concepts || n.depth < 3;
  const visibleLink = (l) => visible(l.source) && visible(l.target)
    && (l.type !== 'uso' || options.uses) && (l.type !== 'vocabulario' || options.vocabulary);
  const colorOf = (n) => (n.type === 'raiz' ? palette.root : palette.areas[areaColor.get(n.area) ?? 0]);

  // ------------------------------------------------------------ elementos
  const canvas = h('canvas', {
    class: 'mindmap__canvas',
    tabindex: '0',
    role: 'img',
    'aria-label': `Mapa mental do dicionário: ${formatNumber(data.totals.areas)} áreas, ${formatNumber(data.totals.tables)} tabelas e ${formatNumber(data.totals.concepts)} conceitos ligados a partir do centro. Use a busca, a legenda e o painel ao lado para navegar pelo teclado.`,
  });
  const hud = h('p', { class: 'mindmap__hud', 'aria-live': 'polite' });

  // Painel de ajustes: velocidade da construção, forças e exibição, aplicados na hora.
  const speedControl = Slider({
    label: 'Velocidade da construção',
    min: 0,
    max: GROWTH_SPEEDS.length - 1,
    value: GROWTH_SPEEDS.indexOf(settings.speed),
    format: (i) => formatSpeed(GROWTH_SPEEDS[i]),
    hint: reducedMotion
      ? 'O sistema pede movimento reduzido: o mapa é montado de uma vez.'
      : 'Ritmo em que os nós entram. Use Reconstruir para ver o mapa crescer de novo.',
    disabled: reducedMotion,
    onInput: (i) => {
      settings.speed = GROWTH_SPEEDS[i];
      growth.speed = settings.speed;
      persist();
    },
  });
  const forceControls = FORCE_CONTROLS.map(({ key, label, hint }) => ({
    key,
    el: Slider({
      label,
      hint,
      min: toPercent(FORCE_LIMITS[key][0]),
      max: toPercent(FORCE_LIMITS[key][1]),
      step: 5,
      value: toPercent(settings.forces[key]),
      format: formatPercent,
      onInput: (v) => setForce(key, v / 100),
    }),
  }));
  const displayControls = DISPLAY_CONTROLS.map(({ key, label, hint = null, step }) => ({
    key,
    el: Slider({
      label,
      hint,
      min: toPercent(DISPLAY_LIMITS[key][0]),
      max: toPercent(DISPLAY_LIMITS[key][1]),
      step,
      value: toPercent(settings.display[key]),
      format: formatPercent,
      onInput: (v) => setDisplay(key, v / 100),
    }),
  }));
  const settingsId = uid('ajustes');
  const settingsToggle = Button({ label: 'Ajustes', icon: 'sliders', size: 'sm', onClick: () => toggleSettings() });
  settingsToggle.setAttribute('aria-expanded', 'false');
  settingsToggle.setAttribute('aria-controls', settingsId);
  const settingsPanel = h('section', { class: 'mindmap__settings', id: settingsId, 'aria-label': 'Ajustes do mapa mental', hidden: true },
    h('div', { class: 'mindmap__settings-header' },
      h('h2', { class: 'mindmap__settings-title' }, 'Ajustes do mapa'),
      Button({ label: 'Fechar ajustes', icon: 'x', iconOnly: true, variant: 'ghost', size: 'sm', onClick: () => toggleSettings(false) })),
    Disclosure({ summary: 'Construção', open: true, children: [speedControl] }),
    Disclosure({ summary: 'Forças', open: true, children: forceControls.map((c) => c.el) }),
    Disclosure({ summary: 'Exibição', children: displayControls.map((c) => c.el) }),
    h('div', { class: 'mindmap__settings-footer' },
      Button({ label: 'Restaurar padrões', icon: 'undo', variant: 'ghost', size: 'sm', onClick: () => resetSettings() })));
  settingsPanel.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    toggleSettings(false);
    settingsToggle.focus();
  });

  const stage = h('div', { class: 'mindmap__stage' }, canvas, hud);
  const panel = h('aside', { class: 'mindmap__panel', 'aria-label': 'Nó selecionado' });
  const results = h('div', { class: 'mindmap__results', role: 'listbox', 'aria-label': 'Resultados da busca' });

  const search = SearchInput({
    placeholder: 'Buscar área, tabela ou conceito…',
    ariaLabel: 'Buscar no mapa mental',
    onInput: (q) => showResults(q),
    onSubmit: (q) => {
      const first = matches(q)[0];
      if (first) pick(first.id);
    },
  });
  search.input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') clear(results);
  });

  const conceptsToggle = Checkbox({ label: 'Conceitos', checked: options.concepts, onChange: (v) => setOption('concepts', v) });
  const toggles = h('div', { class: 'mindmap__toggles' },
    conceptsToggle,
    Checkbox({ label: 'Usos entre tabelas', checked: options.uses, onChange: (v) => setOption('uses', v) }),
    Checkbox({ label: 'Ligações com vocabulários', checked: options.vocabulary, onChange: (v) => setOption('vocabulary', v) }));

  const pauseButton = () => Button({ label: paused ? 'Retomar' : 'Pausar', icon: paused ? 'play' : 'pause', size: 'sm', onClick: () => togglePause() });
  let pauseControl = pauseButton();

  // Painel do nó e legenda: coluna flutuante à direita; em telas estreitas começa recolhida.
  const sideId = uid('painel');
  const sideToggle = Button({ label: 'Detalhes', icon: 'list', size: 'sm', onClick: () => toggleSide() });
  sideToggle.setAttribute('aria-controls', sideId);

  const actions = h('div', { class: 'mindmap__actions' },
    Button({ label: 'Reconstruir', icon: 'refresh-cw', size: 'sm', onClick: () => start() }),
    Button({ label: 'Ajustar à tela', icon: 'maximize', size: 'sm', onClick: () => fitView() }),
    pauseControl,
    settingsToggle,
    sideToggle,
    Button({ label: 'Sair do mapa', icon: 'x', size: 'sm', href: '#/' }));

  const legend = h('ul', { class: 'mindmap__legend', 'aria-label': 'Áreas do dicionário' },
    ...areaNodes.map((n) => h('li', {},
      h('button', { type: 'button', class: 'mindmap__legend-item', onClick: () => pick(n.id) },
        h('span', { class: ['mindmap__swatch', `mindmap__swatch--${areaColor.get(n.area) + 1}`], 'aria-hidden': 'true' }),
        h('span', {}, n.label)))));
  const side = h('div', { class: 'mindmap__side', id: sideId }, panel, legend);

  const toolbar = h('div', { class: 'mindmap__toolbar' },
    h('div', { class: 'mindmap__title' },
      h('h1', { class: 'mindmap__heading', tabindex: '-1' }, 'Mapa mental'),
      h('p', { class: 'mindmap__counts' }, [
        `${formatNumber(data.totals.areas)} áreas`,
        `${formatNumber(data.totals.tables)} tabelas`,
        `${formatNumber(data.totals.concepts)} conceitos`,
        `${formatNumber(data.totals.links)} ligações`,
      ].join(' · '))),
    h('div', { class: 'mindmap__search' }, search, results),
    toggles,
    actions);

  // O palco ocupa a janela inteira (rota imersiva em main.js); os controles flutuam por cima,
  // no tema escuro em escopo do Design System.
  const page = h('div', { class: 'mindmap', 'data-tema': 'escuro' },
    h('div', { class: 'mindmap__overlay' }, toolbar, h('div', { class: 'mindmap__body' }, settingsPanel, side)),
    stage);
  setSide(matchMedia('(min-width: 960px)').matches);

  // ------------------------------------------------------------ painel do nó
  function renderPanel() {
    clear(panel);
    const n = selected ?? byId.get('raiz');
    panel.append(
      h('p', { class: 'mindmap__panel-eyebrow' }, TYPE_LABEL[n.type]),
      h('h2', { class: 'mindmap__panel-title' }, n.label));
    if (n.type === 'conceito') {
      const table = byId.get(`tabela:${n.table}`);
      panel.append(
        h('p', { class: 'mindmap__panel-meta' }, h('code', {}, n.code), ` · ${n.id}`),
        h('div', { class: 'cluster' }, KindBadge(n.kind), ConceptStatusBadge(n.status, { pending: n.pending ?? null })));
      if (table) panel.append(h('p', { class: 'mindmap__panel-meta' }, 'Tabela de origem: ', h('a', { href: tableHref(n.table) }, table.label)));
      panel.append(h('div', { class: 'cluster' }, Button({ label: 'Abrir conceito', icon: 'external-link', size: 'sm', variant: 'primary', href: conceptHref(n.id) })));
    } else if (n.type === 'tabela') {
      panel.append(
        h('div', { class: 'cluster' }, TableStatusBadge(n.status)),
        h('p', { class: 'mindmap__panel-meta' }, `${formatNumber(n.approved)} de ${formatNumber(n.concepts)} conceitos aprovados.`),
        h('div', { class: 'cluster' }, Button({ label: 'Abrir tabela', icon: 'external-link', size: 'sm', variant: 'primary', href: tableHref(n.table) })));
    } else if (n.type === 'area') {
      panel.append(
        h('p', { class: 'mindmap__panel-meta' }, `${formatNumber(n.tables)} tabelas · ${formatNumber(n.approved)} de ${formatNumber(n.concepts)} conceitos aprovados.`),
        h('div', { class: 'cluster' }, Button({ label: 'Abrir área', icon: 'external-link', size: 'sm', variant: 'primary', href: areaHref(n.area) })));
    } else {
      panel.append(
        h('p', { class: 'mindmap__panel-meta' }, `${formatNumber(data.totals.areas)} áreas, ${formatNumber(data.totals.tables)} tabelas lógicas e ${formatNumber(data.totals.concepts)} conceitos, da raiz (no centro) à periferia. Os anéis âmbar marcam conceitos com revisão em curso.`),
        h('p', { class: 'mindmap__panel-meta' }, 'Arraste para mover, use a roda do mouse para aproximar, clique num nó (ou numa área da legenda) para ver os detalhes e dê dois cliques para abri-lo. Em Ajustes, mude a velocidade da construção, as forças e a exibição.'));
      return;
    }
    const neighbors = (linksOf.get(n.id) ?? [])
      .map((l) => {
        const other = byId.get(l.source === n.id ? l.target : l.source);
        return other && other.type !== 'raiz' ? { other, rel: relation(l, n.id, other) } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.other.depth - b.other.depth || a.other.label.localeCompare(b.other.label, 'pt-BR'));
    if (!neighbors.length) return;
    const shown = neighbors.slice(0, MAX_NEIGHBORS);
    panel.append(
      h('h3', { class: 'mindmap__panel-subtitle' }, `Ligações (${formatNumber(neighbors.length)})`),
      h('ul', { class: 'mindmap__links' }, ...shown.map(({ other, rel }) => h('li', {},
        h('button', { type: 'button', class: 'mindmap__link', onClick: () => pick(other.id) },
          h('span', { class: 'mindmap__link-label' }, other.label),
          h('span', { class: 'mindmap__link-type' }, other.type === 'conceito' ? `${KINDS[other.kind]?.label ?? 'Conceito'} · ${rel}` : rel))))));
    if (neighbors.length > shown.length) panel.append(h('p', { class: 'mindmap__panel-meta' }, `… e mais ${formatNumber(neighbors.length - shown.length)}.`));
  }

  // ------------------------------------------------------------ busca
  function matches(q) {
    const term = normalize(q.trim());
    if (term.length < 2) return [];
    const starts = [];
    const contains = [];
    for (const { node, text, code } of searchIndex) {
      if (!visible(node)) continue;
      if (text.startsWith(term) || code.startsWith(term)) starts.push(node);
      else if (text.includes(term)) contains.push(node);
    }
    const byRank = (a, b) => a.depth - b.depth || a.label.length - b.label.length;
    return [...starts.sort(byRank), ...contains.sort(byRank)].slice(0, 8);
  }

  function showResults(q) {
    clear(results);
    for (const n of matches(q)) {
      const where = n.type === 'conceito' ? `${n.code} · ${byId.get(`tabela:${n.table}`)?.label ?? ''}` : TYPE_LABEL[n.type];
      results.appendChild(h('button', {
        type: 'button',
        role: 'option',
        class: 'mindmap__result',
        onClick: () => {
          clear(results);
          pick(n.id);
        },
      }, h('span', { class: 'mindmap__link-label' }, n.label), h('span', { class: 'mindmap__link-type' }, where)));
    }
  }

  // ------------------------------------------------------------ simulação e quadros
  function start() {
    sim = createSimulation({ seed: 7, forces: settings.forces });
    queue = [...order];
    growth.reset();
    hover = null;
    selected = null;
    drag = null;
    follow = true;
    renderPanel();
    setPaused(false);
    if (reducedMotion) {
      while (queue.length) spawn(Infinity);
      settling = true;
      fitAfterSettle = true;
    }
    loop();
  }

  /** Põe na simulação até `limit` nós da fila (sempre de um único nível). */
  function spawn(limit) {
    if (!queue.length) return;
    const depth = byId.get(queue[0]).depth;
    const batch = [];
    while (queue.length && batch.length < limit && byId.get(queue[0]).depth === depth) batch.push(byId.get(queue.shift()));
    sim.add(batch, batch.flatMap((b) => linksOf.get(b.id) ?? []));
  }

  // ------------------------------------------------------------ painéis flutuantes
  function toggleSettings(open = settingsPanel.hidden) {
    settingsPanel.hidden = !open;
    settingsToggle.setAttribute('aria-expanded', String(open));
  }

  function setSide(open) {
    side.hidden = !open;
    sideToggle.setAttribute('aria-expanded', String(open));
  }

  function toggleSide() {
    setSide(side.hidden);
  }

  /**
   * Faixas do palco cobertas pelos painéis flutuantes (barra, ajustes, painel do nó), para
   * enquadrar e centralizar o grafo na parte livre. Cada painel conta para o lado a que está
   * encostado: coluna estreita → esquerda ou direita; faixa larga → em cima ou embaixo.
   */
  function insets() {
    const s = stage.getBoundingClientRect();
    const out = { top: 0, right: 0, bottom: 0, left: 0 };
    for (const el of [toolbar, settingsPanel, side]) {
      if (el.hidden) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.width < s.width * 0.6) {
        if (r.left - s.left < s.right - r.right) out.left = Math.max(out.left, r.right - s.left);
        else out.right = Math.max(out.right, s.right - r.left);
      } else if (r.top - s.top < s.bottom - r.bottom) {
        out.top = Math.max(out.top, r.bottom - s.top);
      } else {
        out.bottom = Math.max(out.bottom, s.bottom - r.top);
      }
    }
    return out;
  }

  /** Muda uma força na hora: o mapa se reorganiza (sem animação, com movimento reduzido). */
  function setForce(key, value) {
    settings.forces[key] = value;
    persist();
    if (!sim) return;
    sim.setForces({ [key]: value });
    if (reducedMotion) settling = true;
    loop();
  }

  function setDisplay(key, value) {
    settings.display[key] = value;
    persist();
    renderer.setDisplay({ [key]: value });
    redraw();
  }

  function resetSettings() {
    settings = { speed: DEFAULT_SPEED, forces: { ...FORCE_DEFAULTS }, display: { ...DISPLAY_DEFAULTS } };
    saveSettings(settings);
    speedControl.setValue(GROWTH_SPEEDS.indexOf(DEFAULT_SPEED));
    for (const c of forceControls) c.el.setValue(toPercent(FORCE_DEFAULTS[c.key]));
    for (const c of displayControls) c.el.setValue(toPercent(DISPLAY_DEFAULTS[c.key]));
    growth.speed = DEFAULT_SPEED;
    renderer.setDisplay(DISPLAY_DEFAULTS);
    if (sim) {
      sim.setForces(FORCE_DEFAULTS);
      if (reducedMotion) settling = true;
      loop();
    }
    redraw();
  }

  function loop() {
    if (running) return;
    running = true;
    const frame = (now) => {
      if (!canvas.isConnected || paused) {
        running = false;
        return;
      }
      if (settling) {
        let moving = true;
        for (let i = 0; i < 6 && moving; i += 1) moving = sim.tick();
        if (moving) {
          hud.textContent = `Organizando ${formatNumber(sim.nodes.length)} nós…`;
          requestAnimationFrame(frame);
          return;
        }
        settling = false;
        running = false;
        if (fitAfterSettle) fitView();
        else redraw();
        fitAfterSettle = false;
        return;
      }
      if (queue.length) {
        const count = growth.take(byId.get(queue[0]).depth, now);
        if (count > 0) spawn(count);
      }
      const moving = sim.tick();
      if (follow) {
        const target = renderer.fit(sim, visible, { dryRun: true, maxZoom: 1.2, insets: insets() });
        const v = renderer.view;
        v.k += (target.k - v.k) * 0.12;
        v.x += (target.x - v.x) * 0.12;
        v.y += (target.y - v.y) * 0.12;
      }
      draw();
      if (queue.length || moving || drag) requestAnimationFrame(frame);
      else running = false;
    };
    requestAnimationFrame(frame);
  }

  function setPaused(value) {
    paused = value;
    const next = pauseButton();
    const focused = document.activeElement === pauseControl;
    pauseControl.replaceWith(next);
    pauseControl = next;
    if (focused) next.focus();
  }

  function togglePause() {
    setPaused(!paused);
    if (!paused) loop();
  }

  function draw() {
    if (!sim || !renderer || settling) return;
    renderer.draw(sim, { palette, visible, visibleLink, colorOf, focus: hover ?? selected, selected, hover, fontFamily: palette.font });
    hud.textContent = queue.length
      ? `Construindo do centro para a periferia… ${formatNumber(sim.nodes.length)} de ${formatNumber(data.nodes.length)} nós`
      : `${formatNumber(sim.nodes.filter(visible).length)} nós visíveis · zoom ${Math.round(renderer.view.k * 100)}%`;
  }

  const redraw = () => {
    if (!running) draw();
  };

  function fitView() {
    if (!sim) return;
    follow = false;
    renderer.fit(sim, visible, { insets: insets() });
    redraw();
  }

  function setOption(key, value) {
    options[key] = value;
    if (selected && !visible(selected)) selected = null;
    renderPanel();
    redraw();
  }

  /** Seleciona um nó e leva a câmera até ele (completa o crescimento se ele ainda não entrou). */
  function pick(id) {
    if (!sim) return;
    if (!sim.byId.has(id)) while (queue.length) spawn(Infinity);
    const n = sim.byId.get(id);
    if (!n) return;
    if (!visible(n)) {
      options.concepts = true;
      conceptsToggle.querySelector('input').checked = true;
    }
    selected = n;
    setSide(true);
    renderPanel();
    follow = false;
    // Centraliza o nó na parte do palco que os painéis flutuantes não cobrem.
    const v = renderer.view;
    const { width, height } = renderer.size;
    const free = insets();
    v.k = Math.max(v.k, n.depth === 3 ? 2.2 : n.depth === 2 ? 0.9 : 0.45);
    v.x = free.left + (width - free.left - free.right) / 2 - n.x * v.k;
    v.y = free.top + (height - free.top - free.bottom) / 2 - n.y * v.k;
    redraw();
  }

  // ------------------------------------------------------------ interação
  const point = (event) => {
    const rect = canvas.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };

  const zoomAt = (sx, sy, factor) => {
    follow = false;
    const v = renderer.view;
    const [wx, wy] = renderer.toWorld(sx, sy);
    v.k = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.k * factor));
    v.x = sx - wx * v.k;
    v.y = sy - wy * v.k;
    redraw();
  };

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    zoomAt(...point(event), Math.exp(-delta * 0.0015));
  }, { passive: false });

  canvas.addEventListener('pointerdown', (event) => {
    if (!sim) return;
    canvas.setPointerCapture(event.pointerId);
    const [sx, sy] = point(event);
    drag = { node: renderer.pick(sim, sx, sy, visible), sx, sy, vx: renderer.view.x, vy: renderer.view.y, moved: false };
    canvas.classList.add('mindmap__canvas--dragging');
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!sim) return;
    const [sx, sy] = point(event);
    if (drag) {
      if (Math.hypot(sx - drag.sx, sy - drag.sy) > 3) drag.moved = true;
      if (!drag.moved) return;
      follow = false;
      if (drag.node && drag.node.depth > 0) {
        [drag.node.fx, drag.node.fy] = renderer.toWorld(sx, sy);
        sim.reheat(0.25);
        loop();
      } else {
        renderer.view.x = drag.vx + (sx - drag.sx);
        renderer.view.y = drag.vy + (sy - drag.sy);
        redraw();
      }
      return;
    }
    const node = renderer.pick(sim, sx, sy, visible);
    if (node !== hover) {
      hover = node;
      canvas.classList.toggle('mindmap__canvas--pointer', Boolean(node));
      redraw();
    }
  });

  const endDrag = () => {
    if (!drag) return;
    if (drag.moved && drag.node && drag.node.depth > 0) {
      drag.node.fx = null;
      drag.node.fy = null;
    }
    if (!drag.moved) {
      selected = drag.node;
      if (selected) setSide(true);
      renderPanel();
    }
    drag = null;
    canvas.classList.remove('mindmap__canvas--dragging');
    redraw();
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => {
    if (hover && !drag) {
      hover = null;
      redraw();
    }
  });

  canvas.addEventListener('dblclick', (event) => {
    const n = sim && renderer.pick(sim, ...point(event), visible);
    if (n?.type === 'conceito') ctx.navigate(conceptHref(n.id));
    else if (n?.type === 'tabela') ctx.navigate(tableHref(n.table));
    else if (n?.type === 'area') ctx.navigate(areaHref(n.area));
  });

  canvas.addEventListener('keydown', (event) => {
    if (!sim) return;
    const { width, height } = renderer.size;
    if (event.key === '+' || event.key === '=') zoomAt(width / 2, height / 2, 1.25);
    else if (event.key === '-') zoomAt(width / 2, height / 2, 0.8);
    else if (event.key === '0') fitView();
    else if (event.key === 'Escape') {
      selected = null;
      renderPanel();
      redraw();
    } else return;
    event.preventDefault();
  });

  // ------------------------------------------------------------ montagem
  renderer = createRenderer(canvas, { display: settings.display });
  const observer = new ResizeObserver(([entry]) => {
    if (!canvas.isConnected) {
      observer.disconnect();
      return;
    }
    palette = palette ?? readPalette(stage);
    renderer.resize(entry.contentRect.width, entry.contentRect.height);
    if (!sim) {
      renderer.view.x = entry.contentRect.width / 2;
      renderer.view.y = entry.contentRect.height / 2;
      start();
    } else redraw();
  });
  observer.observe(stage);
  renderPanel();
  return page;
}
