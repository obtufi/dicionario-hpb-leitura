/**
 * Design System HPB — componentes de interface (fábricas DOM, sem framework).
 *
 * Documentação canônica: docs/DESIGN-SYSTEM.md · Catálogo vivo: #/design-system
 *
 * Regras:
 *  - Toda tela é montada com estas fábricas; não há marcação nem estilo ad hoc.
 *  - Estilos inline são proibidos (o servidor aplica CSP style-src 'self').
 *    Só componentes deste arquivo podem ajustar propriedades CSS customizadas
 *    via CSSOM (ex.: largura da barra de progresso).
 *  - O Design System não conhece o domínio (conceitos, status do dicionário):
 *    o mapeamento domínio → tom/ícone fica em web/app/components/domain.js.
 */

export const DS_VERSION = '1.4.0';

// ---------------------------------------------------------------- utilitários

let uidCounter = 0;
export function uid(prefix = 'ds') {
  uidCounter += 1;
  return `${prefix}-${uidCounter}`;
}

function appendChildren(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === true) continue;
    el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Cria um elemento. `class` aceita string ou lista; `on*` registra eventos. */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') {
        const cls = Array.isArray(value) ? value.filter(Boolean).join(' ') : value;
        if (cls) el.className = cls;
      } else if (key === 'style') {
        throw new Error('Estilos inline são proibidos: use classes do Design System.');
      } else if (key === 'dataset') {
        Object.assign(el.dataset, value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'value') {
        el.value = value;
      } else if (typeof value === 'boolean') {
        if (key in el) el[key] = value;
        else el.setAttribute(key, '');
      } else {
        el.setAttribute(key, String(value));
      }
    }
  }
  appendChildren(el, children);
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function debounce(fn, wait = 200) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

// ---------------------------------------------------------------- ícones (geometria Feather, licença MIT)

const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONS = {
  search: [['circle', { cx: 11, cy: 11, r: 8 }], ['line', { x1: 21, y1: 21, x2: 16.65, y2: 16.65 }]],
  plus: [['line', { x1: 12, y1: 5, x2: 12, y2: 19 }], ['line', { x1: 5, y1: 12, x2: 19, y2: 12 }]],
  check: [['polyline', { points: '20 6 9 17 4 12' }]],
  'check-circle': [['path', { d: 'M22 11.08V12a10 10 0 1 1-5.93-9.14' }], ['polyline', { points: '22 4 12 14.01 9 11.01' }]],
  x: [['line', { x1: 18, y1: 6, x2: 6, y2: 18 }], ['line', { x1: 6, y1: 6, x2: 18, y2: 18 }]],
  'alert-triangle': [['path', { d: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' }], ['line', { x1: 12, y1: 9, x2: 12, y2: 13 }], ['line', { x1: 12, y1: 17, x2: 12.01, y2: 17 }]],
  'alert-octagon': [['polygon', { points: '7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2' }], ['line', { x1: 12, y1: 8, x2: 12, y2: 12 }], ['line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }]],
  info: [['circle', { cx: 12, cy: 12, r: 10 }], ['line', { x1: 12, y1: 16, x2: 12, y2: 12 }], ['line', { x1: 12, y1: 8, x2: 12.01, y2: 8 }]],
  'help-circle': [['circle', { cx: 12, cy: 12, r: 10 }], ['path', { d: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3' }], ['line', { x1: 12, y1: 17, x2: 12.01, y2: 17 }]],
  'chevron-right': [['polyline', { points: '9 18 15 12 9 6' }]],
  'chevron-down': [['polyline', { points: '6 9 12 15 18 9' }]],
  'arrow-up-down': [['polyline', { points: '7 15 12 20 17 15' }], ['polyline', { points: '7 9 12 4 17 9' }]],
  'arrow-up': [['line', { x1: 12, y1: 19, x2: 12, y2: 5 }], ['polyline', { points: '5 12 12 5 19 12' }]],
  'arrow-down': [['line', { x1: 12, y1: 5, x2: 12, y2: 19 }], ['polyline', { points: '19 12 12 19 5 12' }]],
  'external-link': [['path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }], ['polyline', { points: '15 3 21 3 21 9' }], ['line', { x1: 10, y1: 14, x2: 21, y2: 3 }]],
  'file-text': [['path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }], ['polyline', { points: '14 2 14 8 20 8' }], ['line', { x1: 16, y1: 13, x2: 8, y2: 13 }], ['line', { x1: 16, y1: 17, x2: 8, y2: 17 }]],
  clock: [['circle', { cx: 12, cy: 12, r: 10 }], ['polyline', { points: '12 6 12 12 16 14' }]],
  link: [['path', { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' }], ['path', { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' }]],
  user: [['path', { d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' }], ['circle', { cx: 12, cy: 7, r: 4 }]],
  layers: [['polygon', { points: '12 2 2 7 12 12 22 7 12 2' }], ['polyline', { points: '2 17 12 22 22 17' }], ['polyline', { points: '2 12 12 17 22 12' }]],
  edit: [['path', { d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' }], ['path', { d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' }]],
  save: [['path', { d: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z' }], ['polyline', { points: '17 21 17 13 7 13 7 21' }], ['polyline', { points: '7 3 7 8 15 8' }]],
  send: [['line', { x1: 22, y1: 2, x2: 11, y2: 13 }], ['polygon', { points: '22 2 15 22 11 13 2 9 22 2' }]],
  undo: [['polyline', { points: '1 4 1 10 7 10' }], ['path', { d: 'M3.51 15a9 9 0 1 0 2.13-9.36L1 10' }]],
  trash: [['polyline', { points: '3 6 5 6 21 6' }], ['path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }]],
  archive: [['polyline', { points: '21 8 21 21 3 21 3 8' }], ['rect', { x: 1, y: 3, width: 22, height: 5 }], ['line', { x1: 10, y1: 12, x2: 14, y2: 12 }]],
  copy: [['rect', { x: 9, y: 9, width: 13, height: 13, rx: 2, ry: 2 }], ['path', { d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' }]],
  database: [['ellipse', { cx: 12, cy: 5, rx: 9, ry: 3 }], ['path', { d: 'M21 12c0 1.66-4 3-9 3s-9-1.34-9-3' }], ['path', { d: 'M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5' }]],
  book: [['path', { d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20' }], ['path', { d: 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' }]],
  grid: [['rect', { x: 3, y: 3, width: 7, height: 7 }], ['rect', { x: 14, y: 3, width: 7, height: 7 }], ['rect', { x: 14, y: 14, width: 7, height: 7 }], ['rect', { x: 3, y: 14, width: 7, height: 7 }]],
  download: [['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }], ['polyline', { points: '7 10 12 15 17 10' }], ['line', { x1: 12, y1: 15, x2: 12, y2: 3 }]],
  menu: [['line', { x1: 3, y1: 12, x2: 21, y2: 12 }], ['line', { x1: 3, y1: 6, x2: 21, y2: 6 }], ['line', { x1: 3, y1: 18, x2: 21, y2: 18 }]],
  shield: [['path', { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' }]],
  columns: [['path', { d: 'M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18' }]],
  lock: [['rect', { x: 3, y: 11, width: 18, height: 11, rx: 2, ry: 2 }], ['path', { d: 'M7 11V7a5 5 0 0 1 10 0v4' }]],
  cpu: [['rect', { x: 4, y: 4, width: 16, height: 16, rx: 2, ry: 2 }], ['rect', { x: 9, y: 9, width: 6, height: 6 }], ['line', { x1: 9, y1: 1, x2: 9, y2: 4 }], ['line', { x1: 15, y1: 1, x2: 15, y2: 4 }], ['line', { x1: 9, y1: 20, x2: 9, y2: 23 }], ['line', { x1: 15, y1: 20, x2: 15, y2: 23 }], ['line', { x1: 20, y1: 9, x2: 23, y2: 9 }], ['line', { x1: 20, y1: 14, x2: 23, y2: 14 }], ['line', { x1: 1, y1: 9, x2: 4, y2: 9 }], ['line', { x1: 1, y1: 14, x2: 4, y2: 14 }]],
  list: [['line', { x1: 8, y1: 6, x2: 21, y2: 6 }], ['line', { x1: 8, y1: 12, x2: 21, y2: 12 }], ['line', { x1: 8, y1: 18, x2: 21, y2: 18 }], ['line', { x1: 3, y1: 6, x2: 3.01, y2: 6 }], ['line', { x1: 3, y1: 12, x2: 3.01, y2: 12 }], ['line', { x1: 3, y1: 18, x2: 3.01, y2: 18 }]],
  'git-merge': [['circle', { cx: 18, cy: 18, r: 3 }], ['circle', { cx: 6, cy: 6, r: 3 }], ['path', { d: 'M6 21V9a9 9 0 0 0 9 9' }]],
  flag: [['path', { d: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z' }], ['line', { x1: 4, y1: 22, x2: 4, y2: 15 }]],
  'message-square': [['path', { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' }]],
  eye: [['path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' }], ['circle', { cx: 12, cy: 12, r: 3 }]],
  home: [['path', { d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }], ['polyline', { points: '9 22 9 12 15 12 15 22' }]],
  'pen-tool': [['path', { d: 'M12 19l7-7 3 3-7 7-3-3z' }], ['path', { d: 'M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z' }], ['path', { d: 'M2 2l7.586 7.586' }], ['circle', { cx: 11, cy: 11, r: 2 }]],
  'share-2': [['circle', { cx: 18, cy: 5, r: 3 }], ['circle', { cx: 6, cy: 12, r: 3 }], ['circle', { cx: 18, cy: 19, r: 3 }], ['line', { x1: 8.59, y1: 13.51, x2: 15.42, y2: 17.49 }], ['line', { x1: 15.41, y1: 6.51, x2: 8.59, y2: 10.49 }]],
  maximize: [['path', { d: 'M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3' }]],
  'refresh-cw': [['polyline', { points: '23 4 23 10 17 10' }], ['polyline', { points: '1 20 1 14 7 14' }], ['path', { d: 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15' }]],
  pause: [['rect', { x: 6, y: 4, width: 4, height: 16 }], ['rect', { x: 14, y: 4, width: 4, height: 16 }]],
  play: [['polygon', { points: '5 3 19 12 5 21 5 3' }]],
  sliders: [
    ['line', { x1: 4, y1: 21, x2: 4, y2: 14 }], ['line', { x1: 4, y1: 10, x2: 4, y2: 3 }],
    ['line', { x1: 12, y1: 21, x2: 12, y2: 12 }], ['line', { x1: 12, y1: 8, x2: 12, y2: 3 }],
    ['line', { x1: 20, y1: 21, x2: 20, y2: 16 }], ['line', { x1: 20, y1: 12, x2: 20, y2: 3 }],
    ['line', { x1: 1, y1: 14, x2: 7, y2: 14 }], ['line', { x1: 9, y1: 8, x2: 15, y2: 8 }], ['line', { x1: 17, y1: 16, x2: 23, y2: 16 }],
  ],
};

export const ICON_NAMES = Object.keys(ICONS);

export function Icon(name, { size = null, label = null } = {}) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', size === 'sm' ? 'icon icon--sm' : 'icon');
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
  }
  for (const [tag, attrs] of ICONS[name] ?? ICONS.info) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    svg.appendChild(node);
  }
  return svg;
}

// ---------------------------------------------------------------- ações

/** variant: secondary (padrão) | primary | success | danger | ghost | header */
export function Button({ label, variant = 'secondary', size = 'md', icon = null, iconOnly = false, onClick = null, type = 'button', disabled = false, title = null, href = null, ariaLabel = null, target = null } = {}) {
  const classes = ['btn', variant !== 'secondary' && `btn--${variant}`, size === 'sm' && 'btn--sm', iconOnly && 'btn--icon'];
  const content = [icon && Icon(icon, { size: size === 'sm' ? 'sm' : null }), iconOnly ? h('span', { class: 'sr-only' }, label) : label];
  if (href) {
    return h('a', { class: classes, href, title: title ?? (iconOnly ? label : null), 'aria-label': ariaLabel, target, rel: target === '_blank' ? 'noopener' : null }, ...content);
  }
  return h('button', { class: classes, type, disabled, title: title ?? (iconOnly ? label : null), 'aria-label': ariaLabel, onClick }, ...content);
}

// ---------------------------------------------------------------- indicadores

/** tone: neutral | info | success | warning | danger | accent | teal */
export function Badge({ label, tone = 'neutral', variant = 'soft', dot = false, icon = null, title = null, muted = false, square = false } = {}) {
  return h(
    'span',
    { class: ['badge', tone !== 'neutral' && `badge--${tone}`, variant === 'outline' && 'badge--outline', muted && 'badge--muted', square && 'badge--square'], title },
    dot && h('span', { class: 'badge__dot', 'aria-hidden': 'true' }),
    icon && Icon(icon, { size: 'sm' }),
    label,
  );
}

export function ProgressBar({ value = 0, max = 100, label = null, valueText = null, tone = 'info', showLabel = true } = {}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const bar = h('div', { class: 'progress__bar' });
  bar.style.setProperty('--progress-value', pct.toFixed(2));
  const text = valueText ?? `${value} de ${max}`;
  const track = h('div', {
    class: 'progress__track',
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-valuemax': String(max),
    'aria-valuenow': String(value),
    'aria-valuetext': text,
    'aria-label': label ?? 'Progresso',
  }, bar);
  return h('div', { class: ['progress', tone !== 'info' && `progress--${tone}`] },
    label && showLabel ? h('div', { class: 'progress__label' }, h('span', {}, label), h('span', {}, text)) : null,
    track);
}

export function Stat({ label, value, hint = null, tone = null } = {}) {
  return h('div', { class: ['stat', tone && `stat--${tone}`] },
    h('span', { class: 'stat__label' }, label),
    h('span', { class: 'stat__value' }, String(value)),
    hint && h('span', { class: 'stat__hint' }, hint));
}

export function StatGrid(stats) {
  return h('div', { class: 'stat-grid' }, ...stats);
}

/** Estado de salvamento do editor: saved | dirty | saving | error */
export function SaveStatus() {
  const el = h('span', { class: 'save-status', role: 'status', 'aria-live': 'polite' });
  const states = {
    saved: { label: 'Alterações salvas', tone: 'success', icon: 'check' },
    dirty: { label: 'Alterações não salvas', tone: 'warning', icon: 'edit' },
    saving: { label: 'Salvando…', tone: 'info', icon: 'clock' },
    error: { label: 'Falha ao salvar', tone: 'danger', icon: 'alert-triangle' },
    readonly: { label: 'Somente leitura', tone: 'neutral', icon: 'lock' },
  };
  el.set = (state, label = null) => {
    const s = states[state] ?? states.saved;
    clear(el).appendChild(Badge({ label: label ?? s.label, tone: s.tone, icon: s.icon }));
    el.dataset.state = state;
  };
  el.set('saved');
  return el;
}

export function Spinner({ label = 'Carregando…' } = {}) {
  return h('span', { class: 'spinner', role: 'status' }, h('span', { class: 'spinner__ring', 'aria-hidden': 'true' }), h('span', {}, label));
}

export function LoadingBlock(label = 'Carregando…') {
  return h('div', { class: 'loading-block' }, Spinner({ label }));
}

export function EmptyState({ title, message = null, icon = 'info', action = null } = {}) {
  return h('div', { class: 'empty-state' },
    Icon(icon),
    h('p', { class: 'empty-state__title' }, title),
    message && h('p', { class: 'empty-state__message' }, message),
    action);
}

// ---------------------------------------------------------------- formulários

/**
 * Campo com rótulo, dica e erro acessíveis. `control` é o elemento de entrada
 * (ou um contêiner que o inclua). Retorna o elemento com o método setError(msg).
 */
export function Field({ label, control, hint = null, error = null, required = false, optional = false, full = false } = {}) {
  const target = control.matches?.('input, select, textarea') ? control : control.querySelector?.('input, select, textarea') ?? control;
  if (!target.id) target.id = uid('campo');
  const hintId = hint ? uid('dica') : null;
  const errorId = uid('erro');
  const errorEl = h('p', { class: 'field__error', id: errorId, hidden: true });
  target.setAttribute('aria-describedby', [hintId, errorId].filter(Boolean).join(' '));
  const el = h('div', { class: ['field', full && 'form-grid__full'] },
    h('label', { class: 'field__label', for: target.id },
      label,
      required && h('span', { class: 'field__required', 'aria-hidden': 'true' }, '*'),
      required && h('span', { class: 'sr-only' }, '(obrigatório)'),
      optional && h('span', { class: 'field__optional' }, '(opcional)')),
    control,
    hint && h('p', { class: 'field__hint', id: hintId }, hint),
    errorEl);
  el.setError = (message) => {
    errorEl.textContent = message ?? '';
    errorEl.hidden = !message;
    el.classList.toggle('field--invalid', Boolean(message));
    if (message) target.setAttribute('aria-invalid', 'true');
    else target.removeAttribute('aria-invalid');
  };
  el.focusControl = () => target.focus();
  if (error) el.setError(error);
  return el;
}

/** Grupo de controles sem entrada única (listas editáveis, conjuntos de caixas). */
export function Fieldset({ legend, hint = null, children = [], full = true, required = false } = {}) {
  const errorEl = h('p', { class: 'field__error', hidden: true });
  const el = h('fieldset', { class: ['field', 'fieldset', full && 'form-grid__full'] },
    h('legend', { class: 'field__label' }, legend, required && h('span', { class: 'field__required', 'aria-hidden': 'true' }, '*')),
    hint && h('p', { class: 'field__hint' }, hint),
    ...[].concat(children),
    errorEl);
  el.setError = (message) => {
    errorEl.textContent = message ?? '';
    errorEl.hidden = !message;
    el.classList.toggle('field--invalid', Boolean(message));
  };
  el.focusControl = () => el.querySelector('input, select, textarea, button')?.focus();
  return el;
}

export function TextInput({ value = '', onInput = null, onChange = null, placeholder = null, type = 'text', mono = false, readOnly = false, disabled = false, maxLength = null, ariaLabel = null, size = null, id = null, inputMode = null } = {}) {
  const el = h('input', {
    class: ['input', mono && 'input--mono', size === 'sm' && 'input--sm'],
    type,
    placeholder,
    readOnly,
    disabled,
    maxlength: maxLength,
    'aria-label': ariaLabel,
    id,
    autocomplete: 'off',
    inputmode: inputMode,
    spellcheck: mono ? 'false' : null,
  });
  el.value = value ?? '';
  if (onInput) el.addEventListener('input', () => onInput(el.value, el));
  if (onChange) el.addEventListener('change', () => onChange(el.value, el));
  return el;
}

export function TextArea({ value = '', onInput = null, rows = 3, placeholder = null, readOnly = false, disabled = false, ariaLabel = null, id = null } = {}) {
  const el = h('textarea', { class: 'textarea', rows, placeholder, readOnly, disabled, 'aria-label': ariaLabel, id });
  el.value = value ?? '';
  if (onInput) el.addEventListener('input', () => onInput(el.value, el));
  return el;
}

/** options: [{ value, label, group?, disabled? }] */
export function Select({ value = '', options = [], placeholder = null, onChange = null, disabled = false, ariaLabel = null, size = null, id = null } = {}) {
  const el = h('select', { class: ['select', size === 'sm' && 'select--sm'], disabled, 'aria-label': ariaLabel, id });
  if (placeholder !== null) el.appendChild(h('option', { value: '' }, placeholder));
  const groups = new Map();
  for (const opt of options) {
    const node = h('option', { value: opt.value, disabled: opt.disabled }, opt.label);
    if (opt.group) {
      let group = groups.get(opt.group);
      if (!group) {
        group = h('optgroup', { label: opt.group });
        groups.set(opt.group, group);
        el.appendChild(group);
      }
      group.appendChild(node);
    } else {
      el.appendChild(node);
    }
  }
  const wanted = value ?? '';
  if (wanted !== '' && !options.some((o) => String(o.value) === String(wanted))) {
    el.appendChild(h('option', { value: wanted }, `${wanted} (valor fora da lista)`));
  }
  el.value = wanted;
  if (onChange) el.addEventListener('change', () => onChange(el.value, el));
  return el;
}

export function Checkbox({ checked = false, label, onChange = null, disabled = false, hint = null } = {}) {
  const input = h('input', { type: 'checkbox', disabled });
  input.checked = Boolean(checked);
  if (onChange) input.addEventListener('change', () => onChange(input.checked, input));
  return h('label', { class: ['checkbox', disabled && 'checkbox--disabled'] }, input, h('span', {}, label, hint && h('span', { class: 'field__hint' }, ` — ${hint}`)));
}

/**
 * Controle deslizante (input range) com rótulo, valor exibido ao lado e dica opcional.
 * `format(valor)` escreve o valor exibido, que também é lido pelos leitores de tela
 * (aria-valuetext). `onInput` dispara enquanto o controle se move; `onChange`, ao soltar.
 * Retorna o elemento com `.input` e `.setValue(valor)` (sem disparar os eventos).
 */
export function Slider({ label, value = 0, min = 0, max = 100, step = 1, onInput = null, onChange = null, format = (v) => String(v), hint = null, disabled = false, id = null } = {}) {
  const inputId = id ?? uid('controle');
  const hintId = hint ? uid('dica') : null;
  const input = h('input', { type: 'range', class: 'slider__input', id: inputId, min, max, step, disabled, 'aria-describedby': hintId });
  const output = h('output', { class: 'slider__value', for: inputId, 'aria-hidden': 'true' });
  const sync = () => {
    const text = format(Number(input.value));
    output.textContent = text;
    input.setAttribute('aria-valuetext', text);
  };
  input.value = String(value);
  sync();
  input.addEventListener('input', () => {
    sync();
    if (onInput) onInput(Number(input.value), input);
  });
  if (onChange) input.addEventListener('change', () => onChange(Number(input.value), input));
  const el = h('div', { class: ['slider', disabled && 'slider--disabled'] },
    h('div', { class: 'slider__header' }, h('label', { class: 'slider__label', for: inputId }, label), output),
    input,
    hint && h('p', { class: 'field__hint', id: hintId }, hint));
  el.input = input;
  el.setValue = (next) => {
    input.value = String(next);
    sync();
  };
  return el;
}

export function SearchInput({ value = '', placeholder = 'Buscar…', onInput = null, onSubmit = null, ariaLabel = null, variant = null } = {}) {
  const input = TextInput({ value, placeholder, type: 'search', ariaLabel: ariaLabel ?? placeholder, onInput });
  const wrap = h('div', { class: ['search-input', variant === 'header' && 'search-input--header'] }, Icon('search'), input);
  if (onSubmit) {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onSubmit(input.value);
      }
    });
  }
  wrap.input = input;
  return wrap;
}

/**
 * Lista editável de linhas (relações, opções de vocabulário, vínculos…).
 * columns: [{ key, label, render(value, update, row, index, { ariaLabel }) → Node }]
 * Edições não redesenham a lista (o foco é preservado); incluir/remover redesenha.
 */
export function EditableList({ items = [], columns, createItem, onChange = null, addLabel = 'Adicionar', emptyLabel = 'Nenhum item.', readOnly = false, ariaLabel = null } = {}) {
  const rows = items.map((item) => (item && typeof item === 'object' ? { ...item } : item));
  const root = h('div', { class: 'editable-list' });
  const emit = () => onChange?.(rows.map((r) => (r && typeof r === 'object' ? { ...r } : r)));

  function render(focusLast = false) {
    clear(root);
    if (rows.length === 0) {
      root.appendChild(h('p', { class: 'editable-list__empty' }, emptyLabel));
    } else {
      const body = h('tbody', {}, ...rows.map((row, index) => h('tr', {},
        ...columns.map((col) => h('td', {}, col.render(
          col.key ? row[col.key] : row,
          (v) => {
            if (col.key) rows[index][col.key] = v;
            else rows[index] = v;
            emit();
          },
          row,
          index,
          { ariaLabel: `${col.label} — linha ${index + 1}`, readOnly },
        ))),
        readOnly ? null : h('td', {}, Button({
          label: `Remover linha ${index + 1}`,
          icon: 'x',
          iconOnly: true,
          variant: 'ghost',
          size: 'sm',
          onClick: () => {
            rows.splice(index, 1);
            emit();
            render();
          },
        })))));
      root.appendChild(h('table', { class: 'editable-list__table', 'aria-label': ariaLabel },
        h('thead', {}, h('tr', {}, ...columns.map((c) => h('th', { scope: 'col' }, c.label)), readOnly ? null : h('th', {}, h('span', { class: 'sr-only' }, 'Ações')))),
        body));
      if (focusLast) body.lastElementChild?.querySelector('input, select, textarea')?.focus();
    }
    if (!readOnly) {
      root.appendChild(h('div', {}, Button({
        label: addLabel,
        icon: 'plus',
        size: 'sm',
        onClick: () => {
          rows.push(createItem());
          emit();
          render(true);
        },
      })));
    }
  }
  render();
  return root;
}

// ---------------------------------------------------------------- tabela de dados

function compareValues(a, b) {
  const empty = (v) => v === null || v === undefined || v === '';
  if (empty(a) && empty(b)) return 0;
  if (empty(a)) return 1;
  if (empty(b)) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
}

/**
 * columns: [{ key, label, render?(row) → Node|string, sortable?, sortValue?(row), className?, headerClass? }]
 * Linhas são clicáveis se `onRowClick` for informado (cliques em links e botões são preservados).
 */
export function DataTable({ columns, rows, rowKey = null, onRowClick = null, emptyState = null, initialSort = null, caption = null, dense = false, rowClass = null } = {}) {
  if (rows.length === 0 && emptyState) return emptyState;
  let sort = initialSort;
  const wrap = h('div', { class: 'table-wrap' });

  function sorted() {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    const value = col?.sortValue ?? ((r) => r[sort.key]);
    const dir = sort.dir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => compareValues(value(a), value(b)) * dir);
  }

  function header(col) {
    if (!col.sortable) return h('th', { scope: 'col', class: col.headerClass }, col.label);
    const active = sort?.key === col.key;
    const ariaSort = active ? (sort.dir === 'desc' ? 'descending' : 'ascending') : 'none';
    return h('th', { scope: 'col', class: col.headerClass, 'aria-sort': ariaSort },
      h('button', {
        class: 'data-table__sort',
        type: 'button',
        onClick: () => {
          sort = { key: col.key, dir: active && sort.dir === 'asc' ? 'desc' : 'asc' };
          render();
          wrap.querySelector(`[data-sort-key="${col.key}"]`)?.focus();
        },
        dataset: { sortKey: col.key },
      }, col.label, h('span', { class: 'data-table__sort-indicator' }, Icon(active ? (sort.dir === 'desc' ? 'arrow-down' : 'arrow-up') : 'arrow-up-down', { size: 'sm' }))));
  }

  function render() {
    clear(wrap);
    const body = h('tbody', {}, ...sorted().map((row, i) => {
      const tr = h('tr', {
        class: [onRowClick && 'data-table__row--clickable', rowClass?.(row)],
        dataset: rowKey ? { key: String(rowKey(row, i)) } : null,
      }, ...columns.map((col) => h('td', { class: col.className }, col.render ? col.render(row) : (row[col.key] ?? '—'))));
      if (onRowClick) {
        tr.addEventListener('click', (event) => {
          if (event.target.closest('a, button, input, select, textarea, label, summary')) return;
          onRowClick(row);
        });
      }
      return tr;
    }));
    wrap.appendChild(h('table', { class: ['data-table', dense && 'data-table--dense'] },
      caption && h('caption', {}, caption),
      h('thead', {}, h('tr', {}, ...columns.map(header))),
      body));
  }
  render();
  return wrap;
}

// ---------------------------------------------------------------- abas

/**
 * tabs: [{ id, label, count?, render() → Node }]. Painéis são criados na
 * primeira exibição e mantidos (estado de formulário preservado).
 */
export function Tabs({ tabs, active = null, onChange = null, label = 'Seções' } = {}) {
  const prefix = uid('abas');
  const list = h('div', { class: 'tabs__list', role: 'tablist', 'aria-label': label });
  const panels = h('div', { class: 'tabs__panels' });
  const root = h('div', { class: 'tabs' }, list, panels);
  const rendered = new Map();
  const buttons = new Map();

  function select(id, { focus = false, user = false } = {}) {
    for (const tab of tabs) {
      const selected = tab.id === id;
      const btn = buttons.get(tab.id);
      btn.setAttribute('aria-selected', String(selected));
      btn.tabIndex = selected ? 0 : -1;
      let panel = rendered.get(tab.id);
      if (selected && !panel) {
        panel = h('div', { class: 'tabs__panel', role: 'tabpanel', id: `${prefix}-painel-${tab.id}`, 'aria-labelledby': `${prefix}-aba-${tab.id}`, tabindex: '0' });
        const content = tab.render();
        if (content instanceof Promise) {
          panel.appendChild(LoadingBlock());
          content.then((node) => clear(panel).appendChild(node)).catch((error) => clear(panel).appendChild(Alert({ tone: 'danger', title: 'Falha ao carregar', children: [h('p', {}, error.message)] })));
        } else if (content) {
          panel.appendChild(content);
        }
        rendered.set(tab.id, panel);
        panels.appendChild(panel);
      }
      if (panel) panel.hidden = !selected;
      if (selected && focus) btn.focus();
    }
    root.dataset.active = id;
    if (user) onChange?.(id);
  }

  tabs.forEach((tab, index) => {
    const btn = h('button', {
      class: 'tabs__tab',
      role: 'tab',
      type: 'button',
      id: `${prefix}-aba-${tab.id}`,
      'aria-controls': `${prefix}-painel-${tab.id}`,
      onClick: () => select(tab.id, { user: true }),
      onKeydown: (event) => {
        const delta = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
        if (event.key === 'Home' || event.key === 'End' || delta) {
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + delta + tabs.length) % tabs.length;
          select(tabs[next].id, { focus: true, user: true });
        }
      },
    }, tab.label, tab.count != null ? h('span', { class: 'tabs__count' }, String(tab.count)) : null);
    buttons.set(tab.id, btn);
    list.appendChild(btn);
  });

  select(active && tabs.some((t) => t.id === active) ? active : tabs[0].id);
  root.select = (id) => select(id, { user: false });
  /** Descarta o painel renderizado para que seja recriado na próxima exibição. */
  root.invalidate = (id) => {
    const panel = rendered.get(id);
    if (!panel) return;
    const wasVisible = !panel.hidden;
    panel.remove();
    rendered.delete(id);
    if (wasVisible) select(id);
  };
  return root;
}

// ---------------------------------------------------------------- estrutura de página

/** variant: human | technical | source | attention */
export function Panel({ title = null, subtitle = null, icon = null, actions = [], variant = null, children = [], footer = null, flush = false, headingLevel = 2, id = null } = {}) {
  const hasHeader = title || actions.length;
  return h('section', { class: ['panel', variant && `panel--${variant}`], id, 'aria-label': typeof title === 'string' ? title : null },
    hasHeader && h('div', { class: 'panel__header' },
      h('div', { class: 'panel__titles' },
        title && h(`h${headingLevel}`, { class: 'panel__title' }, icon && Icon(icon), title),
        subtitle && h('p', { class: 'panel__subtitle' }, subtitle)),
      actions.length ? h('div', { class: 'cluster' }, ...actions) : null),
    h('div', { class: ['panel__body', flush && 'panel__body--flush'] }, ...[].concat(children)),
    footer && h('div', { class: 'panel__footer' }, ...[].concat(footer)));
}

/** Barra de busca e filtros. `fixed` são itens que não esticam (caixas de seleção, botões). */
export function Toolbar({ items = [], fixed = [] } = {}) {
  return h('div', { class: 'toolbar' }, ...items, ...fixed.map((node) => h('div', { class: 'toolbar__fixed' }, node)));
}

export function Breadcrumbs(items) {
  return h('nav', { 'aria-label': 'Trilha de navegação' },
    h('ol', { class: 'breadcrumbs' }, ...items.map((item, i) => {
      const last = i === items.length - 1;
      return h('li', {}, item.href && !last ? h('a', { href: item.href }, item.label) : h('span', { 'aria-current': last ? 'page' : null }, item.label));
    })));
}

export function PageHeader({ breadcrumbs = [], eyebrow = null, title, meta = [], actions = [], description = null } = {}) {
  return h('header', { class: 'page-header' },
    breadcrumbs.length ? Breadcrumbs(breadcrumbs) : null,
    h('div', { class: 'page-header__top' },
      h('div', { class: 'page-header__titles' },
        eyebrow && h('span', { class: 'page-header__eyebrow' }, eyebrow),
        h('h1', { class: 'page-header__title', tabindex: '-1' }, title)),
      actions.length ? h('div', { class: 'page-header__actions' }, ...actions) : null),
    meta.length ? h('div', { class: 'page-header__meta' }, ...meta) : null,
    description && h('p', { class: 'page-header__description' }, description));
}

export function Section({ title, description = null, actions = [], children = [], headingLevel = 2, id = null } = {}) {
  const headingId = uid('secao');
  return h('section', { class: 'section', 'aria-labelledby': headingId, id },
    h('div', { class: 'section__header' },
      h('div', { class: 'stack stack--sm' },
        h(`h${headingLevel}`, { class: 'section__title', id: headingId }, title),
        description && h('p', { class: 'section__description' }, description)),
      actions.length ? h('div', { class: 'cluster' }, ...actions) : null),
    ...[].concat(children));
}

// ---------------------------------------------------------------- mensagens

const TONE_ICONS = { info: 'info', success: 'check-circle', warning: 'alert-triangle', danger: 'alert-octagon', accent: 'cpu', neutral: 'info' };

/** tone: info | success | warning | danger | accent | neutral */
export function Alert({ tone = 'info', title = null, children = [], icon = null, actions = [], list = null, role = null } = {}) {
  return h('div', { class: ['alert', tone !== 'info' && `alert--${tone}`], role },
    h('span', { class: 'alert__icon' }, Icon(icon ?? TONE_ICONS[tone] ?? 'info')),
    h('div', { class: 'alert__body' },
      title && h('p', { class: 'alert__title' }, title),
      ...[].concat(children),
      list?.length ? h('ul', { class: 'alert__list' }, ...list.map((item) => h('li', {}, item))) : null,
      actions.length ? h('div', { class: 'alert__actions' }, ...actions) : null));
}

let toastRegion = null;

/** Notificação transitória. tone: success | info | warning | danger */
export function toast(message, { tone = 'success', timeout = 4500 } = {}) {
  if (!toastRegion || !toastRegion.isConnected) {
    toastRegion = h('div', { class: 'toast-region', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(toastRegion);
  }
  const el = h('div', { class: ['toast', `toast--${tone}`], role: tone === 'danger' ? 'alert' : null },
    Icon(TONE_ICONS[tone] ?? 'info'),
    h('p', { class: 'toast__message' }, message),
    Button({ label: 'Fechar notificação', icon: 'x', iconOnly: true, variant: 'ghost', size: 'sm', onClick: () => el.remove() }));
  toastRegion.appendChild(el);
  if (timeout) setTimeout(() => el.remove(), tone === 'danger' ? timeout * 2 : timeout);
  return el;
}

// ---------------------------------------------------------------- diálogos

/** Modal sobre <dialog> nativo (foco preso, Esc fecha). Retorna { element, close }. */
export function openModal({ title, description = null, body = [], actions = [], size = null, onClose = null, dismissible = true } = {}) {
  const titleId = uid('modal-titulo');
  const descId = description ? uid('modal-desc') : null;
  const dialog = h('dialog', { class: ['modal', size === 'lg' && 'modal--lg'], 'aria-labelledby': titleId, 'aria-describedby': descId });
  const opener = document.activeElement;
  let closed = false;
  const close = (result = null) => {
    if (closed) return;
    closed = true;
    if (dialog.open) dialog.close();
    dialog.remove();
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    onClose?.(result);
  };
  dialog.appendChild(h('div', { class: 'modal__frame' },
    h('div', { class: 'modal__header' },
      h('div', {}, h('h2', { class: 'modal__title', id: titleId }, title), description && h('p', { class: 'modal__description', id: descId }, description)),
      dismissible ? Button({ label: 'Fechar', icon: 'x', iconOnly: true, variant: 'ghost', size: 'sm', onClick: () => close(null) }) : null),
    h('div', { class: 'modal__body' }, ...[].concat(body)),
    actions.length ? h('div', { class: 'modal__footer' }, ...actions) : null));
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    if (dismissible) close(null);
  });
  document.body.appendChild(dialog);
  dialog.showModal();
  return { element: dialog, close };
}

/**
 * Confirmação de ação. `note` pede justificativa: { label, required, minLength, placeholder, hint }.
 * Resolve { confirmed, note }.
 */
export function confirmDialog({ title, message = null, details = null, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', tone = 'primary', note = null } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    let noteInput = null;
    let noteField = null;
    const body = [];
    if (message) body.push(h('p', {}, message));
    if (details) body.push(details);
    if (note) {
      noteInput = TextArea({ rows: 3, placeholder: note.placeholder ?? null });
      noteField = Field({ label: note.label, control: noteInput, hint: note.hint ?? null, required: Boolean(note.required), optional: !note.required });
      body.push(noteField);
    }
    const confirmButton = Button({
      label: confirmLabel,
      variant: tone,
      onClick: () => {
        const text = noteInput ? noteInput.value.trim() : '';
        const min = note?.minLength ?? 1;
        if (note?.required && text.length < min) {
          noteField.setError(min > 1 ? `Escreva ao menos ${min} caracteres.` : 'Campo obrigatório.');
          noteInput.focus();
          return;
        }
        settled = true;
        modal.close();
        resolve({ confirmed: true, note: text });
      },
    });
    const modal = openModal({
      title,
      body,
      actions: [Button({ label: cancelLabel, onClick: () => modal.close() }), confirmButton],
      onClose: () => {
        if (!settled) resolve({ confirmed: false, note: '' });
      },
    });
    (noteInput ?? confirmButton).focus();
  });
}

/**
 * Formulário em modal. `onSubmit` pode lançar erro: a mensagem aparece no
 * próprio modal (com `error.details.errors` listados) e ele permanece aberto.
 */
export function formDialog({ title, description = null, body = [], submitLabel = 'Salvar', tone = 'primary', size = null, onSubmit } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const errorSlot = h('div', {});
    const submit = Button({
      label: submitLabel,
      variant: tone,
      onClick: async () => {
        submit.disabled = true;
        clear(errorSlot);
        try {
          const result = await onSubmit();
          if (result === false) return;
          settled = true;
          modal.close();
          resolve(result ?? true);
        } catch (error) {
          errorSlot.appendChild(Alert({
            tone: 'danger',
            title: error.message || 'Não foi possível salvar.',
            list: (error.details?.errors ?? []).map((e) => e.message),
            role: 'alert',
          }));
        } finally {
          submit.disabled = false;
        }
      },
    });
    const modal = openModal({
      title,
      description,
      size,
      body: [errorSlot, ...[].concat(body)],
      actions: [Button({ label: 'Cancelar', onClick: () => modal.close() }), submit],
      onClose: () => {
        if (!settled) resolve(null);
      },
    });
    modal.element.querySelector('.modal__body input, .modal__body select, .modal__body textarea')?.focus();
  });
}

// ---------------------------------------------------------------- conteúdo

/** items: [{ key, value, mono? }] */
export function KeyValueList(items, { stacked = false } = {}) {
  return h('dl', { class: ['kv', stacked && 'kv--stacked'] },
    ...items.filter(Boolean).flatMap((item) => [
      h('dt', { class: 'kv__key' }, item.key),
      h('dd', { class: ['kv__value', item.mono && 'mono'] }, item.value === null || item.value === undefined || item.value === '' ? h('span', { class: 'text-subtle' }, '—') : item.value),
    ]));
}

/** items: [{ title, meta?, body?, tone? }] */
export function Timeline(items) {
  return h('ol', { class: 'timeline' }, ...items.map((item) => h('li', { class: ['timeline__item', item.tone && `timeline__item--${item.tone}`] },
    h('span', { class: 'timeline__marker', 'aria-hidden': 'true' }),
    h('p', { class: 'timeline__title' }, item.title),
    item.meta && h('p', { class: 'timeline__meta' }, item.meta),
    item.body && h('div', { class: 'timeline__body' }, item.body))));
}

const DIFF_TYPES = {
  adicionado: { label: 'Adicionado', tone: 'success' },
  removido: { label: 'Removido', tone: 'danger' },
  alterado: { label: 'Alterado', tone: 'warning' },
};

function formatDiffValue(value) {
  if (value === null || value === undefined || value === '') return h('span', { class: 'text-subtle' }, '—');
  if (value === true) return 'Sim';
  if (value === false) return 'Não';
  return String(value);
}

/**
 * changes: [{ label, type: adicionado|removido|alterado, before, after, segments? }]
 * `segments` ([{ type: igual|inserido|removido, text }]) ativa a visão palavra a palavra.
 */
export function DiffView(changes, { beforeLabel = 'Antes', afterLabel = 'Depois' } = {}) {
  if (changes.length === 0) {
    return EmptyState({ title: 'Sem diferenças', message: 'As versões comparadas têm o mesmo conteúdo.', icon: 'check' });
  }
  return h('div', { class: 'diff' }, ...changes.map((change) => {
    const type = DIFF_TYPES[change.type] ?? DIFF_TYPES.alterado;
    const label = h('div', { class: 'diff__label' }, h('span', {}, change.label), Badge({ label: type.label, tone: type.tone }));
    if (change.segments) {
      return h('div', { class: 'diff__item' }, label, h('div', { class: 'diff__inline' }, ...change.segments.map((s) => {
        if (s.type === 'inserido') return h('ins', { class: 'diff__ins' }, s.text);
        if (s.type === 'removido') return h('del', { class: 'diff__del' }, s.text);
        return s.text;
      })));
    }
    return h('div', { class: 'diff__item' }, label, h('div', { class: 'diff__sides' },
      h('div', { class: 'diff__side' }, h('span', { class: 'diff__side-label' }, beforeLabel), formatDiffValue(change.before)),
      h('div', { class: 'diff__side' }, h('span', { class: 'diff__side-label' }, afterLabel), formatDiffValue(change.after))));
  }));
}

export function Disclosure({ summary, children = [], open = false } = {}) {
  return h('details', { class: 'disclosure', open },
    h('summary', {}, Icon('chevron-right', { size: 'sm' }), summary),
    h('div', { class: 'disclosure__body' }, ...[].concat(children)));
}

/** Referência a um item com identificador estável (conceito, tabela…). */
export function ItemRef({ id, label = null, href = null, plain = false, title = null } = {}) {
  const content = [h('span', { class: 'ref__id' }, id), label && h('span', { class: 'ref__label' }, label)];
  if (!href) return h('span', { class: ['ref', 'ref--plain'], title }, ...content);
  return h('a', { class: ['ref', plain && 'ref--plain'], href, title }, ...content);
}

/** Amostra de token de cor (usada no catálogo do Design System). */
export function Swatch({ token, description = null } = {}) {
  const chip = h('span', { class: 'swatch__chip', 'aria-hidden': 'true' });
  chip.style.setProperty('--swatch-color', `var(${token})`);
  return h('div', { class: 'swatch' }, chip, h('span', { class: 'swatch__name' }, token), description && h('span', { class: 'text-muted' }, description));
}
