/**
 * Simulação de forças do mapa mental, sem dependências: repulsão entre nós (Barnes-Hut),
 * molas nas ligações, atração radial por nível — raiz no centro, depois áreas, tabelas e
 * conceitos em anéis cada vez mais largos — e atração angular para o setor de cada área
 * (sectorAngles), que mantém o mapa equilibrado mesmo com tabelas muito maiores que as outras.
 * Os nós entram aos poucos (crescimento do centro para a periferia): cada um nasce junto do
 * nó-pai, já na direção do seu setor, e a simulação o leva para o seu anel.
 * Como no grafo do Obsidian, as forças são ajustáveis na tela (multiplicadores em
 * FORCE_DEFAULTS, aplicados na hora por setForces) e o ritmo do crescimento também
 * (createGrowth, com as velocidades de GROWTH_SPEEDS).
 * Módulo puro (sem DOM), testado em tests/graph.test.js.
 */

/** Gerador pseudoaleatório determinístico (mulberry32). */
export function seededRandom(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Raio do anel de cada nível. */
export const RING = [0, 460, 740, 1020];
const CHARGE = [-900, -420, -140, -14];
// Tabelas com muito mais conceitos que isto têm conceitos de carga menor: o aglomerado fica
// denso em vez de ocupar o mapa inteiro (o Laboratório tem milhares de exames).
const CLUSTER_SIZE = 60;
// Nas ligações de estrutura (raiz → área → tabela) a distância é a dos anéis.
const LINK = {
  estrutura: { distance: null, strength: 0.6 },
  origem: { distance: 34, strength: 0.7 },
  uso: { distance: 220, strength: 0.006 },
  vocabulario: { distance: 60, strength: 0.04 },
};
const RADIAL_STRENGTH = [0.9, 0.5, 0.2, 0.05];
const ANGULAR_STRENGTH = [0, 0.5, 0.15, 0.02];
const THETA2 = 0.81;
const DISTANCE_MIN2 = 4;

/**
 * Multiplicadores das forças, como no painel do grafo do Obsidian (1 = força de base da
 * simulação): center — atração de cada nível para o seu anel em volta do centro; repel —
 * repulsão entre os nós; link — força das ligações; distance — distância das ligações e raio dos
 * anéis (espaça o mapa inteiro); sector — atração de cada área para a sua fatia do mapa.
 * Os padrões são os escolhidos pelo pesquisador em 03/11/2026: anéis firmes, pouca repulsão,
 * ligações e setores soltos.
 */
export const FORCE_DEFAULTS = Object.freeze({ center: 1.35, repel: 0.3, link: 0, distance: 0.9, sector: 0 });
export const FORCE_LIMITS = Object.freeze({ center: [0, 2], repel: [0, 3], link: [0, 3], distance: [0.5, 2], sector: [0, 2] });

function clampForce(key, value) {
  if (!FORCE_LIMITS[key] || typeof value !== 'number' || !Number.isFinite(value)) return null;
  const [min, max] = FORCE_LIMITS[key];
  return Math.min(max, Math.max(min, value));
}

/** Multiplicadores válidos: números dentro dos limites; o que faltar ou vier inválido fica no padrão. */
export function normalizeForces(input = {}) {
  const out = { ...FORCE_DEFAULTS };
  for (const key of Object.keys(FORCE_LIMITS)) {
    const value = clampForce(key, input?.[key]);
    if (value !== null) out[key] = value;
  }
  return out;
}

/** Ritmo do crescimento a 1×: nós que entram por quadro em cada nível e intervalo entre áreas. */
export const GROWTH_PER_FRAME = Object.freeze([1, 1, 5, 48]);
export const AREA_INTERVAL_MS = 70;
/** Velocidades oferecidas na tela (multiplicam o ritmo do crescimento). */
export const GROWTH_SPEEDS = Object.freeze([0.05, 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5]);

/**
 * Compasso do crescimento: quantos nós entram a cada quadro, conforme o nível do próximo nó e a
 * velocidade (1 = ritmo padrão; a propriedade `speed` pode mudar durante o crescimento). As
 * frações se acumulam de um quadro para o outro, o que permite menos de um nó por quadro. A
 * raiz entra de imediato; as áreas, uma por vez, com intervalo de AREA_INTERVAL_MS / velocidade.
 */
export function createGrowth(speed = 1) {
  let credit = 0;
  let lastArea = -Infinity;
  return {
    speed,
    reset() {
      credit = 0;
      lastArea = -Infinity;
    },
    /** Quantos nós do nível `depth` entram no quadro do instante `now` (ms). */
    take(depth, now) {
      if (depth === 0) return 1;
      if (depth === 1) {
        if (now - lastArea < AREA_INTERVAL_MS / this.speed) return 0;
        lastArea = now;
        return 1;
      }
      credit += (GROWTH_PER_FRAME[depth] ?? 50) * this.speed;
      const count = Math.floor(credit);
      credit -= count;
      return count;
    },
  };
}

/**
 * Ângulo do setor de cada nó: a volta completa é dividida entre as áreas (na ordem delas, a
 * partir do alto, em sentido horário) e o setor de cada área entre as suas tabelas, com peso
 * (conceitos + 1)^0,35 + 4 — áreas e tabelas enormes ganham mais espaço sem engolir o mapa, e
 * as pequenas não ficam espremidas. Os conceitos ficam no ângulo da tabela de origem.
 * Devolve Map id → ângulo (radianos); a raiz fica de fora.
 */
export function sectorAngles(nodes, { start = -Math.PI / 2 } = {}) {
  const children = new Map();
  for (const n of nodes) {
    if (!n.parent) continue;
    if (!children.has(n.parent)) children.set(n.parent, []);
    children.get(n.parent).push(n);
  }
  const weight = (n) => ((n.concepts ?? 0) + 1) ** 0.35 + 4;
  const angles = new Map();
  const assign = (parentId, a0, a1) => {
    const kids = [...(children.get(parentId) ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));
    if (!kids.length) return;
    if (kids[0].depth >= 3) {
      for (const k of kids) angles.set(k.id, (a0 + a1) / 2);
      return;
    }
    const total = kids.reduce((sum, k) => sum + weight(k), 0);
    let a = a0;
    for (const k of kids) {
      const span = ((a1 - a0) * weight(k)) / total;
      angles.set(k.id, a + span / 2);
      assign(k.id, a, a + span);
      a += span;
    }
  };
  for (const root of nodes.filter((n) => n.depth === 0)) assign(root.id, start, start + Math.PI * 2);
  return angles;
}

/**
 * Ordem de entrada dos nós: raiz, áreas, tabelas e conceitos, agrupados pelo pai, para o
 * mapa crescer do centro para a periferia. parentOf(id) → id do pai (ou null).
 */
export function growthOrder(nodes, parentOf) {
  const order = [...nodes].sort((a, b) => a.depth - b.depth || (parentOf(a.id) ?? '').localeCompare(parentOf(b.id) ?? '') || a.id.localeCompare(b.id));
  return order.map((n) => n.id);
}

export function createSimulation({ seed = 1, forces: initialForces = FORCE_DEFAULTS } = {}) {
  const random = seededRandom(seed);
  const forces = normalizeForces(initialForces);
  const nodes = [];
  const byId = new Map();
  const links = [];
  const linkKeys = new Set();
  const degree = new Map();
  let alpha = 1;
  const alphaMin = 0.003;
  const alphaDecay = 1 - alphaMin ** (1 / 300);
  const velocityDecay = 0.42;

  function place(node, parent) {
    if (!parent) {
      node.x = (random() - 0.5) * 2;
      node.y = (random() - 0.5) * 2;
      return;
    }
    // Nasce junto do pai, um pouco para fora: na direção do seu setor ou, sem setor, na
    // direção oposta ao centro.
    const angle = (node.angle ?? Math.atan2(parent.y, parent.x)) + (random() - 0.5) * (node.angle === null ? 1.6 : 0.5);
    const step = 6 + random() * 14;
    node.x = parent.x + Math.cos(angle) * step;
    node.y = parent.y + Math.sin(angle) * step;
  }

  /**
   * Acrescenta nós (com depth e parent) e as ligações cujos dois lados já existem; uma ligação
   * recebida de novo (pelos dois lados, por exemplo) entra uma vez só.
   */
  function add(newNodes, newLinks = []) {
    for (const n of newNodes) {
      if (byId.has(n.id)) continue;
      const node = { ...n, angle: n.angle ?? null, x: 0, y: 0, vx: 0, vy: 0, fx: null, fy: null };
      const parent = n.parent ? byId.get(n.parent) : null;
      const crowd = node.depth === 3 && parent?.concepts > CLUSTER_SIZE ? Math.sqrt(CLUSTER_SIZE / parent.concepts) : 1;
      node.baseCharge = CHARGE[node.depth] * crowd;
      node.charge = node.baseCharge * forces.repel;
      place(node, parent);
      if (node.depth === 0) {
        // A raiz fica fixa no centro: o mapa cresce a partir dela.
        node.x = 0;
        node.y = 0;
        node.fx = 0;
        node.fy = 0;
      }
      nodes.push(node);
      byId.set(node.id, node);
    }
    for (const l of newLinks) {
      const source = byId.get(l.source);
      const target = byId.get(l.target);
      if (!source || !target) continue;
      const key = `${l.type}|${l.source}|${l.target}`;
      if (linkKeys.has(key)) continue;
      linkKeys.add(key);
      const spec = LINK[l.type] ?? LINK.uso;
      const distance = spec.distance ?? Math.max(40, RING[target.depth] - RING[source.depth]);
      links.push({ source, target, type: l.type, distance, strength: spec.strength });
      degree.set(source.id, (degree.get(source.id) ?? 0) + 1);
      degree.set(target.id, (degree.get(target.id) ?? 0) + 1);
    }
    alpha = Math.max(alpha, 0.55);
  }

  // ---------------------------------------------------------------- forças
  // As ligações guardam a distância e a força de base; os multiplicadores entram aqui. As
  // forças efetivas ficam limitadas a 1, acima do que a simulação passaria do ponto e oscilaria.
  function applyLinks() {
    for (const l of links) {
      const { source: s, target: t } = l;
      let x = t.x + t.vx - s.x - s.vx || (random() - 0.5) * 1e-6;
      let y = t.y + t.vy - s.y - s.vy || (random() - 0.5) * 1e-6;
      let d = Math.sqrt(x * x + y * y);
      d = ((d - l.distance * forces.distance) / d) * alpha * Math.min(1, l.strength * forces.link);
      x *= d;
      y *= d;
      const ds = degree.get(s.id) ?? 1;
      const dt = degree.get(t.id) ?? 1;
      const bias = ds / (ds + dt);
      t.vx -= x * bias;
      t.vy -= y * bias;
      s.vx += x * (1 - bias);
      s.vy += y * (1 - bias);
    }
  }

  function applyRadial() {
    for (const n of nodes) {
      const r = Math.sqrt(n.x * n.x + n.y * n.y) || 1e-6;
      const k = ((RING[n.depth] * forces.distance - r) * Math.min(1, RADIAL_STRENGTH[n.depth] * forces.center) * alpha) / r;
      n.vx += n.x * k;
      n.vy += n.y * k;
      if (n.angle === null) continue;
      // Puxa na tangente, em direção ao ângulo do setor (diferença levada a [-π, π]).
      let d = n.angle - Math.atan2(n.y, n.x);
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const t = d * Math.min(1, ANGULAR_STRENGTH[n.depth] * forces.sector) * alpha;
      n.vx -= n.y * t;
      n.vy += n.x * t;
    }
  }

  // Barnes-Hut: árvore quaternária com o centro de carga de cada quadrante.
  function buildTree() {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const n of nodes) {
      if (n.x < x0) x0 = n.x;
      if (n.y < y0) y0 = n.y;
      if (n.x > x1) x1 = n.x;
      if (n.y > y1) y1 = n.y;
    }
    const size = Math.max(x1 - x0, y1 - y0, 1);
    const root = { x0, y0, size, children: null, point: null, charge: 0, cx: 0, cy: 0 };
    for (const n of nodes) insert(root, n, 0);
    accumulate(root);
    return root;
  }

  function insert(quad, node, depth) {
    if (!quad.children && !quad.point) {
      quad.point = [node];
      return;
    }
    if (!quad.children) {
      if (depth > 24) {
        quad.point.push(node); // pontos coincidentes
        return;
      }
      const pts = quad.point;
      quad.point = null;
      quad.children = [null, null, null, null];
      for (const p of pts) insertChild(quad, p, depth);
    }
    insertChild(quad, node, depth);
  }

  function insertChild(quad, node, depth) {
    const half = quad.size / 2;
    const right = node.x >= quad.x0 + half ? 1 : 0;
    const bottom = node.y >= quad.y0 + half ? 1 : 0;
    const i = right + bottom * 2;
    if (!quad.children[i]) {
      quad.children[i] = { x0: quad.x0 + right * half, y0: quad.y0 + bottom * half, size: half, children: null, point: null, charge: 0, cx: 0, cy: 0 };
    }
    insert(quad.children[i], node, depth + 1);
  }

  function accumulate(quad) {
    let charge = 0;
    let weight = 0;
    let cx = 0;
    let cy = 0;
    if (quad.point) {
      for (const p of quad.point) {
        const c = p.charge;
        const w = Math.abs(c);
        charge += c;
        weight += w;
        cx += p.x * w;
        cy += p.y * w;
      }
    } else {
      for (const child of quad.children) {
        if (!child) continue;
        accumulate(child);
        const w = Math.abs(child.charge);
        charge += child.charge;
        weight += w;
        cx += child.cx * w;
        cy += child.cy * w;
      }
    }
    quad.charge = charge;
    quad.cx = weight ? cx / weight : 0;
    quad.cy = weight ? cy / weight : 0;
  }

  function applyCharge(quad, node) {
    const dx = quad.cx - node.x;
    const dy = quad.cy - node.y;
    let l = dx * dx + dy * dy;
    const w = quad.size;
    if (!quad.point && (w * w) / THETA2 < l) {
      if (l < DISTANCE_MIN2) l = Math.sqrt(DISTANCE_MIN2 * l);
      node.vx += (dx * quad.charge * alpha) / l;
      node.vy += (dy * quad.charge * alpha) / l;
      return;
    }
    if (quad.point) {
      for (const p of quad.point) {
        if (p === node) continue;
        let px = p.x - node.x;
        let py = p.y - node.y;
        if (px === 0 && py === 0) {
          px = (random() - 0.5) * 1e-3;
          py = (random() - 0.5) * 1e-3;
        }
        let pl = px * px + py * py;
        if (pl < DISTANCE_MIN2) pl = Math.sqrt(DISTANCE_MIN2 * pl);
        const c = p.charge;
        node.vx += (px * c * alpha) / pl;
        node.vy += (py * c * alpha) / pl;
      }
      return;
    }
    for (const child of quad.children) if (child) applyCharge(child, node);
  }

  /** Um passo da simulação; devolve false quando ela já assentou. */
  function tick() {
    if (alpha < alphaMin) return false;
    alpha += -alpha * alphaDecay;
    applyLinks();
    if (nodes.length > 1) {
      const tree = buildTree();
      for (const n of nodes) applyCharge(tree, n);
    }
    applyRadial();
    for (const n of nodes) {
      if (n.fx !== null) {
        n.x = n.fx;
        n.y = n.fy;
        n.vx = 0;
        n.vy = 0;
        continue;
      }
      n.vx *= 1 - velocityDecay;
      n.vy *= 1 - velocityDecay;
      n.x += n.vx;
      n.y += n.vy;
    }
    return true;
  }

  return {
    nodes,
    links,
    byId,
    add,
    tick,
    get alpha() {
      return alpha;
    },
    /** Reaquece a simulação (ao arrastar um nó, por exemplo). */
    reheat(value = 0.3) {
      alpha = Math.max(alpha, value);
    },
    /** Multiplicadores em vigor (cópia). */
    get forces() {
      return { ...forces };
    },
    /**
     * Muda multiplicadores na hora (os ausentes ou inválidos ficam como estão) e reaquece a
     * simulação para o mapa se reorganizar.
     */
    setForces(partial = {}) {
      for (const key of Object.keys(FORCE_LIMITS)) {
        const value = clampForce(key, partial?.[key]);
        if (value !== null) forces[key] = value;
      }
      for (const n of nodes) n.charge = n.baseCharge * forces.repel;
      alpha = Math.max(alpha, 0.5);
    },
    degreeOf: (id) => degree.get(id) ?? 0,
  };
}
