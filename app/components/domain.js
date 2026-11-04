/**
 * Componentes de domínio canônicos: traduzem vocabulários do dicionário
 * (estado, natureza, situação…) para componentes do Design System.
 * Toda área nova deve reutilizá-los — não criar indicadores equivalentes.
 * Documentação: docs/DESIGN-SYSTEM.md § Componentes de domínio.
 */
import { Badge, ItemRef, Select, h } from '/design-system/components.js';
import {
  CONCEPT_STATUS, KINDS, QUESTION_STATUS, REVISION_STATUS, TABLE_STATUS, VALUE_TYPES,
} from '/shared/semantic-model.js';
import { formatActor } from '../format.js';

export const CONCEPT_STATUS_TONE = { rascunho: 'neutral', em_revisao: 'warning', aprovado: 'success', obsoleto: 'danger', descartado: 'neutral' };
export const REVISION_STATUS_TONE = { rascunho: 'neutral', em_revisao: 'warning', aprovado: 'success', substituido: 'neutral', descartado: 'neutral' };
export const KIND_ICON = { entidade: 'user', identificador: 'link', estrutural: 'database', observavel: 'eye', evento: 'flag', derivado: 'git-merge', vocabulario: 'list' };

export function ConceptStatusBadge(status, { pending = null } = {}) {
  const def = CONCEPT_STATUS[status] ?? { label: status };
  const badge = Badge({ label: def.label, tone: CONCEPT_STATUS_TONE[status] ?? 'neutral', dot: true, muted: status === 'descartado', title: def.description });
  if (!pending) return badge;
  return h('span', { class: 'cluster' }, badge, Badge({ label: pending === 'em_revisao' ? 'alteração em revisão' : 'alteração em rascunho', tone: pending === 'em_revisao' ? 'warning' : 'neutral', variant: 'outline' }));
}

export function RevisionStatusBadge(status) {
  const def = REVISION_STATUS[status] ?? { label: status };
  return Badge({ label: def.label, tone: REVISION_STATUS_TONE[status] ?? 'neutral', dot: true, title: def.description });
}

export function KindBadge(kind) {
  const def = KINDS[kind];
  return Badge({ label: def?.label ?? kind ?? '—', variant: 'outline', square: true, icon: KIND_ICON[kind], title: def?.description });
}

export function OriginBadge({ origin, accepted = false }) {
  if (origin !== 'ia') return null;
  return accepted
    ? Badge({ label: 'IA · aceita', tone: 'accent', variant: 'outline', icon: 'cpu', title: 'Proposta de IA aceita por uma pessoa como base de trabalho' })
    : Badge({ label: 'Proposta IA', tone: 'accent', icon: 'cpu', title: 'Gerada por IA: não é definição oficial até aprovação humana' });
}

export function QuestionStatusBadge(status) {
  return Badge({ label: QUESTION_STATUS[status]?.label ?? status, tone: status === 'aberta' ? 'warning' : 'success', dot: true });
}

export function TableStatusBadge(status) {
  const tone = { em_trabalho: 'info', futura: 'neutral', concluida: 'success' }[status] ?? 'neutral';
  return Badge({ label: TABLE_STATUS[status]?.label ?? status, tone, variant: status === 'futura' ? 'outline' : 'soft' });
}

export function SensitivityBadge(sensitivity, vocabulary) {
  if (!sensitivity) return null;
  const tone = { identificador_direto: 'danger', pseudonimo: 'warning', codigo_vinculavel: 'warning', quase_identificador: 'info' }[sensitivity] ?? 'neutral';
  return Badge({ label: vocabulary[sensitivity]?.label ?? sensitivity, tone, icon: 'shield', title: vocabulary[sensitivity]?.description });
}

export const conceptHref = (id) => `#/conceito/${encodeURIComponent(id)}`;
export const tableHref = (id, tab = null) => `#/tabela/${encodeURIComponent(id)}${tab ? `/${tab}` : ''}`;

/** Link para conceito: identificador estável + nome + estado. */
export function ConceptRef(summary, { showStatus = true, showKind = false } = {}) {
  if (!summary) return h('span', { class: 'text-subtle' }, '—');
  return h('span', { class: 'ref-list__item' },
    ItemRef({ id: summary.concept_id, label: summary.label || '(sem nome)', href: conceptHref(summary.concept_id) }),
    showKind ? KindBadge(summary.kind) : null,
    showStatus && summary.status ? ConceptStatusBadge(summary.status) : null);
}

/** Domínio de valores resumido (tipo, unidade, vocabulário, padrão). */
export function ValueDomain(domain) {
  if (!domain) return h('span', { class: 'text-subtle' }, '—');
  if (domain.kind === 'vocabulario') return h('span', {}, `${domain.option_count} opções`);
  if (!domain.value_type) return h('span', { class: 'text-subtle' }, 'não se aplica');
  const parts = [VALUE_TYPES[domain.value_type]?.label ?? domain.value_type];
  if (domain.unit) parts.push(domain.unit);
  if (domain.min != null || domain.max != null) parts.push(`[${domain.min ?? '…'}; ${domain.max ?? '…'}]`);
  const children = [h('span', {}, parts.join(' · '))];
  if (domain.value_set) {
    children.push(h('span', { class: 'cell-title__sub' }, ItemRef({ id: domain.value_set.concept_id, label: `${domain.value_set.label} (${domain.value_set.option_count})`, href: conceptHref(domain.value_set.concept_id) })));
  }
  if (domain.pattern) children.push(h('span', { class: 'cell-title__sub mono' }, domain.pattern));
  return h('span', { class: 'cell-title' }, ...children);
}

/**
 * Seletor de conceito com grupos por natureza.
 * concepts: [{ concept_id, label, kind, status }]
 */
export function ConceptSelect({ value = '', concepts = [], kinds = null, excludeId = null, onChange = null, disabled = false, ariaLabel = null, placeholder = 'Selecione um conceito…', size = null } = {}) {
  const options = concepts
    .filter((c) => c.concept_id !== excludeId && (!kinds || kinds.includes(c.kind)) && (c.status !== 'descartado' || c.concept_id === value))
    .sort((a, b) => a.concept_id.localeCompare(b.concept_id))
    .map((c) => ({
      value: c.concept_id,
      label: `${c.concept_id} — ${c.label || '(sem nome)'}${c.status === 'descartado' ? ' (descartado)' : ''}`,
      group: KINDS[c.kind]?.plural ?? 'Outros',
    }));
  return Select({ value: value ?? '', options, placeholder, onChange, disabled, ariaLabel, size });
}

export function ActorText(actor) {
  return h('span', { title: actor ?? '' }, formatActor(actor));
}

// ------------------------------------------------------------------ mapa canônico proposto (docs/MAPA-CANONICO.md)

export const mapAreaHref = (key) => `#/mapa/area/${encodeURIComponent(key)}`;
export const mapTableHref = (key, tab = null) => `#/mapa/tabela/${encodeURIComponent(key)}${tab ? `/${tab}` : ''}`;
export const mapVocabularyHref = (key) => `#/mapa/vocabulario/${encodeURIComponent(key)}`;
/** Decisões do mapa com filtros (área, situação) e, opcionalmente, a decisão a destacar. */
export const mapDecisionsHref = ({ area = '', situacao = '', id = '' } = {}) => {
  const query = new URLSearchParams(Object.entries({ area, situacao, id }).filter(([, v]) => v)).toString();
  return `#/mapa/decisoes${query ? `?${query}` : ''}`;
};

/** Tipo de tabela lógica do mapa: o que uma linha representa. */
export const MAP_TABLE_KINDS = {
  entidade: { label: 'Entidade', icon: 'user', description: 'Uma linha por indivíduo (ex.: paciente).' },
  evento: { label: 'Evento', icon: 'flag', description: 'Uma linha por acontecimento datado (internação, operação, exame, coleta…).' },
  observacoes: { label: 'Observações', icon: 'eye', description: 'Valores observados sobre o paciente ou sobre um evento, em linhas repetíveis.' },
  catalogo: { label: 'Catálogo', icon: 'list', description: 'Entradas homogêneas (ex.: analitos), cada uma definida uma vez.' },
  atribuicao: { label: 'Atribuição', icon: 'link', description: 'Identificadores atribuídos a uma entidade.' },
};

export function MapTableKindBadge(kind) {
  const def = MAP_TABLE_KINDS[kind];
  return Badge({ label: def?.label ?? kind ?? '—', variant: 'outline', square: true, icon: def?.icon, title: def?.description });
}

/** Como o mapa tratou cada linha do dicionário de trabalho (dicionario/mapa/rastreabilidade.csv). */
export const MAP_CLASSIFICATIONS = {
  preservar: { label: 'Preservar', tone: 'success', description: 'Significado mantido; ajustes apenas de redação.' },
  reescrever: { label: 'Reescrever', tone: 'info', description: 'Significado mantido, com definição, tipo, fonte ou regras refeitos.' },
  unificar: { label: 'Unificar', tone: 'accent', description: 'Fundida com outra(s) num único conceito.' },
  derivar: { label: 'Derivar', tone: 'teal', description: 'Passa a ser definição derivada de observações e eventos.' },
  estrutural: { label: 'Estrutural', tone: 'neutral', description: 'Atributo técnico ou estrutural, não conceito clínico.' },
  descontinuar: { label: 'Descontinuar', tone: 'danger', description: 'Não mantida; a justificativa diz por quê e para onde vai a informação.' },
};

export function MapClassificationBadge(classification) {
  if (!classification) return Badge({ label: 'Sem decisão', tone: 'neutral', variant: 'outline' });
  const def = MAP_CLASSIFICATIONS[classification];
  return Badge({ label: def?.label ?? classification, tone: def?.tone ?? 'neutral', square: true, title: def?.description });
}

/** Nível de uma entrada de catálogo: núcleo HPB ou catálogo estendido (proposta). */
export function MapTierBadge(tier) {
  if (tier === 'nucleo') return Badge({ label: 'Núcleo', tone: 'accent', square: true, title: 'Núcleo HPB proposto: coleta prioritária' });
  if (tier === 'estendido') return Badge({ label: 'Estendido', tone: 'neutral', variant: 'outline', square: true, title: 'Catálogo estendido: disponível, sem prioridade' });
  return null;
}

/** Tipo de valor de um conceito do mapa: tipo, unidade e vocabulário (com link). */
export function MapValueType(concept) {
  if (!concept?.tipo_valor) return h('span', { class: 'text-subtle' }, concept?.natureza === 'estrutural' ? 'conforme a entrada' : '—');
  const parts = [VALUE_TYPES[concept.tipo_valor]?.label ?? concept.tipo_valor];
  if (concept.unidade) parts.push(concept.unidade);
  if (concept.multiplo) parts.push('múltipla escolha');
  const vocab = String(concept.vocabulario ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  return h('span', { class: 'cell-title' },
    h('span', {}, parts.join(' · ')),
    ...vocab.map((v) => h('span', { class: 'cell-title__sub' }, ItemRef({ id: v, href: mapVocabularyHref(v), plain: true }))),
    concept.sugestao_tipo ? h('span', { class: 'cell-title__sub text-muted' }, `sugestão: ${VALUE_TYPES[concept.sugestao_tipo]?.label ?? concept.sugestao_tipo}`) : null);
}
