/**
 * Desenho do mapa mental em canvas: ligações e nós agrupados por cor (um caminho por grupo),
 * rótulos conforme o zoom, destaque da vizinhança do nó sob o cursor ou selecionado e anel nos
 * conceitos com revisão em curso. As cores vêm dos tokens do Design System (--color-graph-*),
 * lidas pela tela e passadas em `palette`. Tamanho dos nós, espessura das ligações e zoom a
 * partir do qual aparecem os rótulos são ajustáveis (setDisplay), como no grafo do Obsidian.
 */

export const NODE_RADIUS = { raiz: 16, area: 10, tabela: 5.5, conceito: 2.4 };
const KIND_SCALE = { entidade: 1.8, evento: 1.6, vocabulario: 0.9 };
const LABEL_ZOOM = { raiz: 0, area: 0, tabela: 0.42, conceito: 1.7 };

/**
 * Ajustes de exibição: nodeSize e linkWidth multiplicam o raio dos nós e a espessura das
 * ligações; labelZoom é o zoom a partir do qual aparecem os rótulos dos conceitos (o das
 * tabelas acompanha na mesma proporção; raiz e áreas têm rótulo sempre).
 */
// Padrões escolhidos pelo pesquisador em 03/11/2026: nós maiores, ligações finas e rótulos dos
// conceitos a partir de 190% de zoom.
export const DISPLAY_DEFAULTS = Object.freeze({ nodeSize: 1.25, linkWidth: 0.35, labelZoom: 1.9 });
export const DISPLAY_LIMITS = Object.freeze({ nodeSize: [0.5, 2.5], linkWidth: [0.25, 4], labelZoom: [0.4, 4] });

/** Ajustes válidos: números dentro dos limites; o que faltar ou vier inválido fica no padrão. */
export function normalizeDisplay(input = {}, base = DISPLAY_DEFAULTS) {
  const out = { ...base };
  for (const [key, [min, max]] of Object.entries(DISPLAY_LIMITS)) {
    const value = input?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = Math.min(max, Math.max(min, value));
  }
  return out;
}
const FONT = { raiz: 15, area: 13, tabela: 11, conceito: 10.5 };
const LINK_STYLE = {
  estrutura: { key: 'link', width: 1.1 },
  origem: { key: 'link', width: 0.6 },
  uso: { key: 'linkUse', width: 0.7 },
  vocabulario: { key: 'linkVocabulary', width: 0.6 },
};
const MAX_LABELS = 450;

export function radiusOf(node) {
  const base = NODE_RADIUS[node.type] ?? 2;
  return node.type === 'conceito' ? base * (KIND_SCALE[node.kind] ?? 1) : base;
}

export function createRenderer(canvas, { display: initialDisplay = DISPLAY_DEFAULTS } = {}) {
  const ctx = canvas.getContext('2d');
  const view = { k: 0.35, x: 0, y: 0 };
  let display = normalizeDisplay(initialDisplay);
  let width = 0;
  let height = 0;
  let dpr = 1;

  const sizeOf = (n) => radiusOf(n) * display.nodeSize;
  const labelZoom = (n) => LABEL_ZOOM[n.type] * (display.labelZoom / LABEL_ZOOM.conceito);

  function resize(w, h) {
    dpr = window.devicePixelRatio || 1;
    width = Math.max(1, Math.round(w));
    height = Math.max(1, Math.round(h));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  const toScreen = (x, y) => [x * view.k + view.x, y * view.k + view.y];
  const toWorld = (sx, sy) => [(sx - view.x) / view.k, (sy - view.y) / view.k];

  /** Nó mais próximo do ponto da tela (dentro do raio de toque), entre os visíveis. */
  function pick(sim, sx, sy, visible) {
    const [wx, wy] = toWorld(sx, sy);
    let best = null;
    let bestD = Infinity;
    for (const n of sim.nodes) {
      if (!visible(n)) continue;
      const r = Math.max(sizeOf(n), 7 / view.k);
      const dx = n.x - wx;
      const dy = n.y - wy;
      const d = dx * dx + dy * dy;
      if (d <= r * r && d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  }

  /**
   * Enquadra os nós visíveis; devolve o enquadramento sem aplicar quando dryRun. `insets`
   * ({ top, right, bottom, left }, em pixels) descontam faixas cobertas por painéis flutuantes:
   * o grafo fica centrado na parte livre.
   */
  function fit(sim, visible, { padding = 40, maxZoom = 1.6, dryRun = false, insets = null } = {}) {
    const edge = { top: 0, right: 0, bottom: 0, left: 0, ...insets };
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const n of sim.nodes) {
      if (!visible(n)) continue;
      x0 = Math.min(x0, n.x);
      y0 = Math.min(y0, n.y);
      x1 = Math.max(x1, n.x);
      y1 = Math.max(y1, n.y);
    }
    if (!Number.isFinite(x0)) return { ...view };
    const freeWidth = Math.max(width - edge.left - edge.right, 80);
    const freeHeight = Math.max(height - edge.top - edge.bottom, 80);
    const k = Math.min(maxZoom, Math.max(freeWidth - padding * 2, 40) / Math.max(x1 - x0, 1), Math.max(freeHeight - padding * 2, 40) / Math.max(y1 - y0, 1));
    const cx = Math.min(edge.left, width - 80) + freeWidth / 2;
    const cy = Math.min(edge.top, height - 80) + freeHeight / 2;
    const target = { k, x: cx - ((x0 + x1) / 2) * k, y: cy - ((y0 + y1) / 2) * k };
    if (!dryRun) Object.assign(view, target);
    return target;
  }

  function draw(sim, { palette, visible, visibleLink, colorOf, focus = null, selected = null, hover = null, fontFamily = 'sans-serif' }) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, width, height);
    const highlight = focus ? neighborhood(sim, focus) : null;

    // ------------------------------------------------------------ ligações
    ctx.setTransform(dpr * view.k, 0, 0, dpr * view.k, dpr * view.x, dpr * view.y);
    ctx.lineCap = 'round';
    for (const [type, style] of Object.entries(LINK_STYLE)) {
      const batches = [[], []]; // [esmaecidas, destacadas]
      for (const l of sim.links) {
        if (l.type !== type || !visibleLink(l)) continue;
        const lit = !highlight || (highlight.has(l.source.id) && highlight.has(l.target.id) && (l.source === focus || l.target === focus || l.type === 'estrutura'));
        batches[lit ? 1 : 0].push(l);
      }
      for (const [i, batch] of batches.entries()) {
        if (!batch.length) continue;
        ctx.beginPath();
        for (const l of batch) {
          ctx.moveTo(l.source.x, l.source.y);
          ctx.lineTo(l.target.x, l.target.y);
        }
        // A transparência de base vem do token; o destaque só a reforça ou esmaece.
        ctx.globalAlpha = highlight ? (i ? 0.9 : 0.18) : 1;
        ctx.strokeStyle = highlight && i ? palette.highlight : palette[style.key];
        ctx.lineWidth = (style.width * display.linkWidth * (highlight && i ? 1.6 : 1)) / view.k;
        ctx.stroke();
      }
    }

    // ------------------------------------------------------------ nós
    const groups = new Map();
    for (const n of sim.nodes) {
      if (!visible(n)) continue;
      const lit = !highlight || highlight.has(n.id);
      const key = `${colorOf(n)}|${lit ? 1 : 0}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(n);
    }
    const minR = (1.3 * display.nodeSize) / view.k;
    for (const [key, list] of groups) {
      const [color, lit] = key.split('|');
      ctx.beginPath();
      for (const n of list) {
        const r = Math.max(sizeOf(n), minR);
        ctx.moveTo(n.x + r, n.y);
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      }
      ctx.globalAlpha = lit === '1' ? 1 : 0.16;
      ctx.fillStyle = color;
      ctx.fill();
    }
    // anel nos conceitos com revisão em curso e no selecionado
    ctx.globalAlpha = 1;
    ctx.beginPath();
    for (const n of sim.nodes) {
      if (!visible(n) || !(n.status === 'rascunho' || n.status === 'em_revisao' || n.pending)) continue;
      const r = Math.max(sizeOf(n), minR) + 1.4 / view.k;
      ctx.moveTo(n.x + r, n.y);
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    }
    ctx.strokeStyle = palette.draft;
    ctx.lineWidth = 1.2 / view.k;
    ctx.stroke();
    for (const n of [selected, hover]) {
      if (!n || !visible(n)) continue;
      ctx.beginPath();
      const r = Math.max(sizeOf(n), minR) + 3 / view.k;
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = palette.highlight;
      ctx.lineWidth = 1.6 / view.k;
      ctx.stroke();
    }

    // ------------------------------------------------------------ rótulos (em coordenadas da tela)
    // Os destacados entram primeiro, depois do centro para a periferia; um rótulo que colidiria
    // com outro já escrito tenta as posições alternativas e, sem lugar, fica de fora (o do nó em
    // foco e os da raiz e das áreas sempre aparecem).
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textBaseline = 'middle';
    const wanted = [];
    for (const n of sim.nodes) {
      if (!visible(n)) continue;
      const forced = n === selected || n === hover || n === focus || (highlight && highlight.has(n.id) && view.k >= 0.9);
      if (!forced && (view.k < labelZoom(n) || (highlight && !highlight.has(n.id)))) continue;
      const [sx, sy] = toScreen(n.x, n.y);
      if (sx < -200 || sy < -40 || sx > width + 200 || sy > height + 40) continue;
      wanted.push({ n, forced, sx, sy });
    }
    wanted.sort((a, b) => Number(b.forced) - Number(a.forced) || a.n.depth - b.n.depth);
    const placed = [];
    const free = (box) => !placed.some((p) => box.x < p.x + p.w && box.x + box.w > p.x && box.y < p.y + p.h && box.y + box.h > p.y);
    for (const { n, forced, sx, sy } of wanted.slice(0, MAX_LABELS)) {
      const size = FONT[n.type];
      ctx.font = `${n.depth <= 1 ? 600 : 400} ${size}px ${fontFamily}`;
      const text = n.label.length > 48 && !forced ? `${n.label.slice(0, 46)}…` : n.label;
      const w = ctx.measureText(text).width;
      const r = Math.max(sizeOf(n), minR) * view.k;
      const options = labelAnchors(n, sx, sy, r, size).map(([align, tx, ty]) => {
        const left = align === 'left' ? tx : align === 'right' ? tx - w : tx - w / 2;
        return { align, tx, ty, box: { x: left - 3, y: ty - size * 0.75, w: w + 6, h: size * 1.5 } };
      });
      const must = n === selected || n === hover || n === focus || n.depth <= 1;
      const spot = options.find((o) => free(o.box)) ?? (must ? options[0] : null);
      if (!spot) continue;
      placed.push(spot.box);
      ctx.textAlign = spot.align;
      if (forced) {
        ctx.globalAlpha = 0.86;
        ctx.fillStyle = palette.bg;
        ctx.fillRect(spot.box.x, spot.box.y, spot.box.w, spot.box.h);
      }
      ctx.globalAlpha = highlight && !highlight.has(n.id) ? 0.25 : 1;
      ctx.fillStyle = n.depth <= 1 || forced ? palette.label : palette.labelMuted;
      ctx.fillText(text, spot.tx, spot.ty);
    }
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  return {
    view,
    resize,
    draw,
    pick,
    fit,
    toWorld,
    toScreen,
    get size() {
      return { width, height };
    },
    /** Ajustes de exibição em vigor (cópia). */
    get display() {
      return { ...display };
    },
    /** Muda ajustes de exibição (os ausentes ou inválidos ficam como estão); redesenhe depois. */
    setDisplay(partial = {}) {
      display = normalizeDisplay(partial, display);
    },
  };
}

/**
 * Onde escrever o rótulo, em ordem de preferência. A raiz escreve abaixo de si; áreas e tabelas,
 * para fora do centro (à direita na metade direita do mapa, à esquerda na esquerda), o que
 * separa os rótulos em volta da raiz; os conceitos, à direita do nó. As demais posições servem
 * quando a preferida já está ocupada.
 */
function labelAnchors(n, sx, sy, r, size) {
  const right = ['left', sx + r + 4, sy];
  const left = ['right', sx - r - 4, sy];
  const above = ['center', sx, sy - (r + size * 0.9)];
  const below = ['center', sx, sy + (r + size * 0.9)];
  if (n.depth === 0) return [below, above, right, left];
  if (n.depth === 3) return [right, left, above, below];
  return n.x >= 0 ? [right, above, below, left] : [left, above, below, right];
}

/** O nó e os seus vizinhos imediatos (pelas ligações). */
export function neighborhood(sim, node) {
  const set = new Set([node.id]);
  for (const l of sim.links) {
    if (l.source === node) set.add(l.target.id);
    else if (l.target === node) set.add(l.source.id);
  }
  return set;
}
