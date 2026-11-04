/**
 * Padrão semântico canônico do Registro HPB — metamodelo.
 *
 * Fonte única, para servidor e interface, das naturezas de conceito, tipos de
 * valor, estados do fluxo de aprovação e regras de validação do conteúdo de uma
 * revisão. Documentação: docs/MODELO-SEMANTICO.md
 *
 * Este módulo não acessa banco nem DOM: é importado pelo Node (validação na
 * escrita) e pelo navegador (formulários, rótulos, pré-validação).
 * Apresentação (cores, ícones) não pertence a este arquivo — ver web/design-system.
 */

export const MODEL_VERSION = '1.0.0';

export const CONCEPT_ID_PATTERN = /^HPB-\d{5}$/;
export const CODE_PATTERN = /^[a-z][a-z0-9_]{1,62}$/;

export const AI_ACTOR_PREFIX = 'ia:';
export const SYSTEM_ACTOR_PREFIX = 'sistema:';

/** Pessoas aprovam; IA e processos automáticos apenas propõem ou registram. */
export function isHumanActor(actor) {
  return typeof actor === 'string'
    && actor.trim().length > 0
    && !actor.startsWith(AI_ACTOR_PREFIX)
    && !actor.startsWith(SYSTEM_ACTOR_PREFIX);
}

// ---------------------------------------------------------------------------
// Vocabulários do próprio metamodelo
// ---------------------------------------------------------------------------

const ALL_VALUE_TYPES = ['texto', 'inteiro', 'decimal', 'booleano', 'data', 'data_hora', 'duracao', 'codificado', 'identificador', 'uuid'];

/**
 * Naturezas de conceito. `section` é o bloco de conteúdo específico da natureza;
 * `valueTypes` vazio significa que a natureza não recebe valores diretamente.
 */
export const KINDS = {
  entidade: {
    label: 'Entidade',
    plural: 'Entidades',
    layer: 'estrutura',
    section: 'entity_spec',
    valueTypes: [],
    description: 'Algo do mundo sobre o qual o registro guarda dados (ex.: paciente). Tem identificadores e atributos estruturais; não recebe valores.',
  },
  identificador: {
    label: 'Identificador',
    plural: 'Identificadores',
    layer: 'estrutura',
    section: 'identifier',
    valueTypes: ['identificador', 'texto', 'inteiro', 'uuid'],
    description: 'Sistema de identificação atribuído a uma entidade por uma autoridade (ex.: número de prontuário). Não é conceito clínico.',
  },
  estrutural: {
    label: 'Atributo estrutural',
    plural: 'Atributos estruturais',
    layer: 'estrutura',
    section: 'structural',
    valueTypes: ALL_VALUE_TYPES,
    description: 'Atributo técnico gerido pelo sistema (chave, carimbo de auditoria, natureza do registro). Não é conceito clínico observável.',
  },
  observavel: {
    label: 'Conceito observável',
    plural: 'Conceitos observáveis',
    layer: 'clinico',
    section: 'observable',
    valueTypes: ALL_VALUE_TYPES.filter((t) => t !== 'uuid'),
    description: 'Propriedade clínica observada, medida ou avaliada (ex.: creatinina sérica). Cada valor é registrado como observação, com paciente, momento, fonte e contexto.',
  },
  evento: {
    label: 'Tipo de evento clínico',
    plural: 'Tipos de evento clínico',
    layer: 'clinico',
    section: 'event',
    valueTypes: [],
    description: 'Acontecimento ou marco temporal (ex.: diagnóstico, internação, cirurgia, transplante). Cada ocorrência é registrada como evento datado.',
  },
  derivado: {
    label: 'Definição derivada',
    plural: 'Definições derivadas',
    layer: 'clinico',
    section: 'derived',
    valueTypes: ALL_VALUE_TYPES.filter((t) => t !== 'uuid'),
    description: 'Regra explícita de seleção, interpretação ou cálculo sobre observações e eventos (ex.: última creatinina antes do transplante).',
  },
  vocabulario: {
    label: 'Vocabulário controlado',
    plural: 'Vocabulários controlados',
    layer: 'vocabulario',
    section: 'vocabulary',
    valueTypes: [],
    description: 'Conjunto fechado de opções codificadas e definidas, reutilizável por vários conceitos.',
  },
};

export const VALUE_TYPES = {
  texto: { label: 'Texto', constraints: ['max_length', 'pattern'] },
  inteiro: { label: 'Número inteiro', constraints: ['min', 'max'], unit: true },
  decimal: { label: 'Número decimal', constraints: ['min', 'max', 'decimals'], unit: true, unitRequired: true },
  booleano: { label: 'Booleano (sim/não)', constraints: [] },
  data: { label: 'Data', constraints: [] },
  data_hora: { label: 'Data e hora', constraints: [] },
  duracao: { label: 'Duração', constraints: ['min', 'max'], unit: true, unitRequired: true },
  codificado: { label: 'Codificado (vocabulário controlado)', constraints: ['multiple'], valueSet: true },
  identificador: { label: 'Cadeia identificadora', constraints: ['max_length', 'pattern'] },
  uuid: { label: 'UUID (chave técnica)', constraints: [] },
};

export const ABSENCE_STATES = {
  ausente: {
    label: 'Ausente',
    description: 'Não há registro do valor na fonte consultada.',
  },
  desconhecido: {
    label: 'Desconhecido',
    description: 'A informação foi buscada, mas não é conhecida.',
  },
  nao_aplicavel: {
    label: 'Não aplicável',
    description: 'O conceito não se aplica ao sujeito ou ao contexto (ex.: número de prontuário em registro sintético).',
  },
};

export const RELATION_TYPES = {
  relacionado: { label: 'Relacionado a', inverse: 'Relacionado a' },
  sobreposicao: { label: 'Possível sobreposição com', inverse: 'Possível sobreposição com', flagsDuplicate: true },
  mesmo_significado: { label: 'Mesmo significado que', inverse: 'Mesmo significado que', flagsDuplicate: true },
  distinto_de: { label: 'Não confundir com', inverse: 'Não confundir com' },
  especializa: { label: 'É especialização de', inverse: 'Tem como especialização' },
  parte_de: { label: 'É parte de', inverse: 'Tem como parte' },
  substitui: { label: 'Substitui', inverse: 'Substituído por' },
};

export const SENSITIVITY = {
  identificador_direto: {
    label: 'Identificador direto',
    description: 'Identifica a pessoa sem informação adicional (ex.: nome, CPF, número de prontuário).',
    requiresPolicy: true,
  },
  codigo_vinculavel: {
    label: 'Código vinculável',
    description: 'Não identifica sozinho, mas a correspondência com a identidade está acessível à equipe ou a outro sistema.',
    requiresPolicy: true,
  },
  pseudonimo: {
    label: 'Pseudônimo',
    description: 'A correspondência com a identidade é mantida separadamente, em ambiente controlado e seguro (cofre de vinculação).',
    requiresPolicy: true,
  },
  quase_identificador: {
    label: 'Quase-identificador',
    description: 'Pode contribuir para reidentificação quando combinado a outros dados (ex.: datas, município).',
    requiresPolicy: false,
  },
  tecnico_interno: {
    label: 'Técnico interno',
    description: 'Chave ou carimbo sem significado fora do sistema.',
    requiresPolicy: false,
  },
  nao_pessoal: {
    label: 'Não pessoal',
    description: 'Não se refere a pessoa identificável.',
    requiresPolicy: false,
  },
};

export const IDENTIFIER_ROLES = {
  assistencial_institucional: { label: 'Assistencial institucional', description: 'Identifica a pessoa no prontuário e nos sistemas assistenciais da instituição.' },
  registro_interno: { label: 'Interno do registro', description: 'Código atribuído pelo próprio Registro HPB.' },
  pesquisa: { label: 'Pesquisa', description: 'Identifica a pessoa como participante de protocolo de pesquisa.' },
  proveniencia: { label: 'Proveniência', description: 'Identifica o registro correspondente em uma base ou sistema de origem.' },
  pseudonimo_vinculacao: { label: 'Pseudônimo de vinculação', description: 'Permite vincular dados da mesma pessoa sem expor sua identidade.' },
};

export const IDENTIFIER_ASSIGNMENT = {
  externo: { label: 'Atribuído externamente', description: 'Emitido por outra instituição ou sistema.' },
  gerado_sistema: { label: 'Gerado pelo sistema do registro', description: 'Gerado automaticamente pelo banco ou pela aplicação do registro.' },
  cofre: { label: 'Gerado pelo cofre de vinculação', description: 'Gerado e guardado pelo cofre institucional de vinculação.' },
};

export const CARDINALITIES = {
  '1': { label: 'Exatamente um por entidade' },
  '0..1': { label: 'No máximo um por entidade' },
  '1..n': { label: 'Um ou mais por entidade' },
  '0..n': { label: 'Zero ou mais por entidade' },
};

export const STRUCTURAL_MANAGED_BY = {
  banco: { label: 'Gerado pelo banco de dados' },
  aplicacao: { label: 'Atribuído pela aplicação' },
  usuario: { label: 'Informado por usuário no cadastro' },
};

export const STRUCTURAL_APPLIES_TO = {
  entidade: { label: 'Uma entidade específica' },
  todas_entidades: { label: 'Todas as entidades (atributo comum)' },
};

export const TEMPORAL_PRECISION = {
  data: { label: 'Data' },
  data_hora: { label: 'Data e hora' },
  periodo: { label: 'Período (início e fim)' },
};

export const AGGREGATIONS = {
  ultimo: { label: 'Último valor' },
  primeiro: { label: 'Primeiro valor' },
  maximo: { label: 'Maior valor' },
  minimo: { label: 'Menor valor' },
  media: { label: 'Média' },
  contagem: { label: 'Contagem' },
  existencia: { label: 'Existência (sim/não)' },
};

export const WINDOW_RELATIONS = {
  antes: { label: 'Antes do evento-âncora' },
  depois: { label: 'Depois do evento-âncora' },
  ao_redor: { label: 'Em torno do evento-âncora' },
};

export const INPUT_ROLES = {
  observacao: { label: 'Observações do conceito' },
  evento: { label: 'Ocorrências do evento' },
  definicao: { label: 'Resultado da definição' },
};

export const BINDING_MATCH = {
  equivalente: { label: 'Equivalente' },
  mais_amplo: { label: 'Termo externo mais amplo' },
  mais_restrito: { label: 'Termo externo mais restrito' },
  relacionado: { label: 'Relacionado' },
};

// ---------------------------------------------------------------------------
// Fluxo de aprovação e versionamento
// ---------------------------------------------------------------------------

/** Estado de cada revisão individual (versionamento por conceito). */
export const REVISION_STATUS = {
  rascunho: { label: 'Rascunho', description: 'Editável. Salvar não publica nada.' },
  em_revisao: { label: 'Em revisão', description: 'Conteúdo bloqueado aguardando aprovação ou devolução.' },
  aprovado: { label: 'Aprovada', description: 'Definição publicada. Imutável: mudanças exigem nova revisão.' },
  substituido: { label: 'Substituída', description: 'Aprovada anteriormente e substituída por revisão mais nova.' },
  descartado: { label: 'Descartada', description: 'Rejeitada ou abandonada; mantida para rastreabilidade.' },
};

export const REVISION_TRANSITIONS = {
  rascunho: ['em_revisao', 'descartado'],
  em_revisao: ['rascunho', 'aprovado', 'descartado'],
  aprovado: ['substituido'],
  substituido: [],
  descartado: [],
};

/** Estado do conceito, derivado das revisões. */
export const CONCEPT_STATUS = {
  rascunho: { label: 'Rascunho', description: 'Ainda sem definição aprovada.' },
  em_revisao: { label: 'Em revisão', description: 'Enviado para aprovação humana.' },
  aprovado: { label: 'Aprovado', description: 'Possui definição aprovada e publicada.' },
  obsoleto: { label: 'Obsoleto', description: 'A definição aprovada mais recente declara o conceito obsoleto.' },
  descartado: { label: 'Descartado', description: 'Proposta rejeitada sem nunca ter sido aprovada.' },
};

export const QUESTION_STATUS = {
  aberta: { label: 'Aberta' },
  resolvida: { label: 'Resolvida' },
};

export const AREA_STATUS = {
  ativa: { label: 'Ativa' },
  futura: { label: 'Estrutura futura' },
};

export const TABLE_STATUS = {
  em_trabalho: { label: 'Em trabalho' },
  futura: { label: 'Estrutura futura' },
  concluida: { label: 'Concluída' },
};

// ---------------------------------------------------------------------------
// Rótulos de campos (formulários, mensagens de erro e comparação de versões)
// ---------------------------------------------------------------------------

export const FIELD_LABELS = {
  kind: 'Natureza',
  code: 'Nome canônico',
  label: 'Nome de exibição',
  synonyms: 'Sinônimos',
  definition: 'Definição',
  usage_notes: 'Notas de uso',
  references: 'Referências',
  entity: 'Entidade',
  value_type: 'Tipo de valor',
  unit: 'Unidade',
  value_set: 'Vocabulário controlado',
  constraints: 'Restrições',
  'constraints.required': 'Obrigatório',
  'constraints.multiple': 'Múltipla escolha',
  'constraints.min': 'Valor mínimo',
  'constraints.max': 'Valor máximo',
  'constraints.decimals': 'Casas decimais',
  'constraints.max_length': 'Comprimento máximo',
  'constraints.pattern': 'Padrão (expressão regular)',
  absence: 'Estados de ausência',
  sensitivity: 'Sensibilidade',
  access_policy: 'Política de acesso',
  relations: 'Relações',
  bindings: 'Terminologias externas',
  implementation: 'Implementação física',
  'entity_spec.identity_criterion': 'Critério de identidade',
  'identifier.role': 'Papel do identificador',
  'identifier.issuer': 'Emissor',
  'identifier.scope': 'Escopo de unicidade',
  'identifier.assignment': 'Atribuição',
  'identifier.cardinality': 'Cardinalidade',
  'identifier.format_description': 'Formato',
  'structural.managed_by': 'Quem atribui o valor',
  'structural.applies_to': 'Abrangência',
  'structural.analytic_use': 'Uso analítico',
  'observable.method': 'Método',
  'observable.specimen': 'Amostra ou material',
  'event.temporal_precision': 'Precisão temporal',
  'event.has_duration': 'Tem duração',
  'derived.rule_text': 'Regra (descrição)',
  'derived.inputs': 'Entradas',
  'derived.anchor_event': 'Evento-âncora',
  'derived.window.relation': 'Janela temporal',
  'derived.window.offset_from': 'Início da janela',
  'derived.window.offset_to': 'Fim da janela',
  'derived.window.unit': 'Unidade da janela',
  'derived.aggregation': 'Seleção ou agregação',
  'derived.expression': 'Expressão de cálculo',
  'vocabulary.extensible': 'Extensível',
  'vocabulary.options': 'Opções',
  deprecation: 'Obsolescência',
  'deprecation.reason': 'Motivo da obsolescência',
  'deprecation.replaced_by': 'Substituído por',
};

// ---------------------------------------------------------------------------
// Forma canônica do conteúdo de uma revisão
// ---------------------------------------------------------------------------

const SECTION_DEFAULTS = {
  entity_spec: () => ({ identity_criterion: '' }),
  identifier: () => ({ role: null, issuer: '', scope: '', assignment: null, cardinality: null, format_description: '' }),
  structural: () => ({ managed_by: null, applies_to: 'entidade', analytic_use: '' }),
  observable: () => ({ method: '', specimen: '' }),
  event: () => ({ temporal_precision: null, has_duration: false }),
  derived: () => ({
    rule_text: '',
    inputs: [],
    anchor_event: null,
    window: { relation: null, offset_from: null, offset_to: null, unit: '' },
    aggregation: null,
    expression: '',
  }),
  vocabulary: () => ({ extensible: false, options: [] }),
};

export const SECTION_KEYS = Object.keys(SECTION_DEFAULTS);

const CONSTRAINT_DEFAULTS = () => ({
  required: false,
  multiple: false,
  min: null,
  max: null,
  decimals: null,
  max_length: null,
  pattern: '',
});

/** Conteúdo vazio, com a forma canônica, para uma natureza. */
export function emptyContent(kind) {
  const content = {
    kind,
    code: '',
    label: '',
    synonyms: [],
    definition: '',
    usage_notes: '',
    references: [],
    entity: null,
    value_type: null,
    unit: '',
    value_set: null,
    constraints: CONSTRAINT_DEFAULTS(),
    absence: [],
    sensitivity: null,
    access_policy: '',
    relations: [],
    bindings: [],
    implementation: [],
    deprecation: null,
  };
  const section = KINDS[kind]?.section;
  if (section) content[section] = SECTION_DEFAULTS[section]();
  return content;
}

const str = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
const strOrNull = (v) => {
  const s = str(v);
  return s === '' ? null : s;
};
const numOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : v; // valor inválido é preservado para a validação apontar o erro
};
const bool = (v) => v === true || v === 'true' || v === 1;
const arr = (v) => (Array.isArray(v) ? v : []);
const notAllEmpty = (obj) => Object.values(obj).some((v) => v !== '' && v !== null && v !== false && !(Array.isArray(v) && v.length === 0));

/**
 * Normaliza um conteúdo arbitrário para a forma canônica: remove campos
 * desconhecidos, apara textos e mantém só o bloco específico da natureza.
 * Linhas incompletas de listas são preservadas (o rascunho pode estar em
 * construção); só linhas totalmente vazias são descartadas.
 */
export function normalizeContent(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const kind = str(input.kind) || null;
  const out = emptyContent(kind);
  out.code = str(input.code);
  out.label = str(input.label);
  out.synonyms = arr(input.synonyms).map(str).filter(Boolean);
  out.definition = str(input.definition);
  out.usage_notes = str(input.usage_notes);
  out.references = arr(input.references).map(str).filter(Boolean);
  out.entity = strOrNull(input.entity);
  out.value_type = strOrNull(input.value_type);
  out.unit = str(input.unit);
  out.value_set = strOrNull(input.value_set);

  const c = input.constraints && typeof input.constraints === 'object' ? input.constraints : {};
  out.constraints = {
    required: bool(c.required),
    multiple: bool(c.multiple),
    min: numOrNull(c.min),
    max: numOrNull(c.max),
    decimals: numOrNull(c.decimals),
    max_length: numOrNull(c.max_length),
    pattern: str(c.pattern),
  };

  out.absence = arr(input.absence)
    .map((a) => ({ state: str(a?.state), condition: str(a?.condition) }))
    .filter((a) => a.state);
  out.sensitivity = strOrNull(input.sensitivity);
  out.access_policy = str(input.access_policy);
  out.relations = arr(input.relations)
    .map((r) => ({ type: str(r?.type), target: str(r?.target), note: str(r?.note) }))
    .filter(notAllEmpty);
  out.bindings = arr(input.bindings)
    .map((b) => ({ system: str(b?.system), code: str(b?.code), display: str(b?.display), match: strOrNull(b?.match) }))
    .filter(notAllEmpty);
  out.implementation = arr(input.implementation)
    .map((i) => ({ object: str(i?.object), note: str(i?.note) }))
    .filter(notAllEmpty);

  if (input.deprecation && typeof input.deprecation === 'object') {
    out.deprecation = {
      reason: str(input.deprecation.reason),
      replaced_by: arr(input.deprecation.replaced_by).map(str).filter(Boolean),
    };
  }

  const section = KINDS[kind]?.section;
  if (section) {
    const s = input[section] && typeof input[section] === 'object' ? input[section] : {};
    out[section] = normalizeSection(section, s);
  }
  if (KINDS[kind] && KINDS[kind].valueTypes.length === 0) {
    out.value_type = null;
    out.unit = '';
    out.value_set = null;
  }
  return out;
}

function normalizeSection(section, s) {
  switch (section) {
    case 'entity_spec':
      return { identity_criterion: str(s.identity_criterion) };
    case 'identifier':
      return {
        role: strOrNull(s.role),
        issuer: str(s.issuer),
        scope: str(s.scope),
        assignment: strOrNull(s.assignment),
        cardinality: strOrNull(s.cardinality),
        format_description: str(s.format_description),
      };
    case 'structural':
      return {
        managed_by: strOrNull(s.managed_by),
        applies_to: strOrNull(s.applies_to) ?? 'entidade',
        analytic_use: str(s.analytic_use),
      };
    case 'observable':
      return { method: str(s.method), specimen: str(s.specimen) };
    case 'event':
      return { temporal_precision: strOrNull(s.temporal_precision), has_duration: bool(s.has_duration) };
    case 'derived': {
      const w = s.window && typeof s.window === 'object' ? s.window : {};
      return {
        rule_text: str(s.rule_text),
        inputs: arr(s.inputs)
          .map((i) => ({ concept: str(i?.concept), role: strOrNull(i?.role) }))
          .filter(notAllEmpty),
        anchor_event: strOrNull(s.anchor_event),
        window: {
          relation: strOrNull(w.relation),
          offset_from: numOrNull(w.offset_from),
          offset_to: numOrNull(w.offset_to),
          unit: str(w.unit),
        },
        aggregation: strOrNull(s.aggregation),
        expression: str(s.expression),
      };
    }
    case 'vocabulary':
      return {
        extensible: bool(s.extensible),
        options: arr(s.options)
          .map((o) => ({
            code: str(o?.code),
            label: str(o?.label),
            definition: str(o?.definition),
            active: o?.active === undefined ? true : bool(o.active),
          }))
          .filter((o) => o.code || o.label || o.definition),
      };
    default:
      return {};
  }
}

/** Serialização determinística (chaves ordenadas) para hash e comparação. */
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    .join(',')}}`;
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

/**
 * Valida o conteúdo de uma revisão.
 *
 * mode 'rascunho'  — apenas forma e vocabulários (permite conteúdo incompleto).
 * mode 'submissao' — completude exigida para enviar à revisão ou aprovar.
 * lookup(id)       — opcional; devolve { kind, status } de outro conceito, ou null.
 *                    Quando informado, verifica a integridade das referências.
 * selfId           — identificador do próprio conceito (impede autorreferência).
 *
 * Retorna { errors: [{ path, message }], warnings: [{ path, message }] }.
 */
export function validateContent(content, { mode = 'rascunho', lookup = null, selfId = null } = {}) {
  const errors = [];
  const warnings = [];
  const err = (path, message) => errors.push({ path, message });
  const warn = (path, message) => warnings.push({ path, message });
  const full = mode === 'submissao';

  if (!content || typeof content !== 'object') {
    err('', 'Conteúdo ausente.');
    return { errors, warnings };
  }
  const kindDef = KINDS[content.kind];
  if (!kindDef) {
    err('kind', 'Natureza inválida.');
    return { errors, warnings };
  }

  // Forma
  if (content.code && !CODE_PATTERN.test(content.code)) {
    err('code', 'Use letras minúsculas sem acento, números e "_", começando por letra (2 a 63 caracteres).');
  }
  if (content.value_type !== null && content.value_type !== undefined) {
    if (!VALUE_TYPES[content.value_type]) err('value_type', 'Tipo de valor inválido.');
    else if (!kindDef.valueTypes.includes(content.value_type)) {
      err('value_type', `Tipo de valor não permitido para ${kindDef.label.toLowerCase()}.`);
    }
  }
  checkEnum(content.sensitivity, SENSITIVITY, 'sensitivity', err);
  validateConstraints(content.constraints ?? {}, err);

  const seenStates = new Set();
  (content.absence ?? []).forEach((a, i) => {
    if (!ABSENCE_STATES[a.state]) err(`absence[${i}].state`, 'Estado de ausência inválido.');
    else if (seenStates.has(a.state)) err(`absence[${i}].state`, 'Estado de ausência repetido.');
    seenStates.add(a.state);
  });

  (content.relations ?? []).forEach((r, i) => {
    if (r.type && !RELATION_TYPES[r.type]) err(`relations[${i}].type`, 'Tipo de relação inválido.');
    if (r.target && !CONCEPT_ID_PATTERN.test(r.target)) err(`relations[${i}].target`, 'Identificador de conceito inválido.');
    if (selfId && r.target === selfId) err(`relations[${i}].target`, 'Um conceito não pode se relacionar consigo mesmo.');
  });
  (content.bindings ?? []).forEach((b, i) => {
    if (b.match && !BINDING_MATCH[b.match]) err(`bindings[${i}].match`, 'Tipo de correspondência inválido.');
  });
  for (const field of ['entity', 'value_set']) {
    if (content[field] && !CONCEPT_ID_PATTERN.test(content[field])) err(field, 'Identificador de conceito inválido.');
  }

  const section = kindDef.section;
  const s = content[section] ?? {};
  switch (section) {
    case 'identifier':
      checkEnum(s.role, IDENTIFIER_ROLES, 'identifier.role', err);
      checkEnum(s.assignment, IDENTIFIER_ASSIGNMENT, 'identifier.assignment', err);
      checkEnum(s.cardinality, CARDINALITIES, 'identifier.cardinality', err);
      break;
    case 'structural':
      checkEnum(s.managed_by, STRUCTURAL_MANAGED_BY, 'structural.managed_by', err);
      checkEnum(s.applies_to, STRUCTURAL_APPLIES_TO, 'structural.applies_to', err);
      break;
    case 'event':
      checkEnum(s.temporal_precision, TEMPORAL_PRECISION, 'event.temporal_precision', err);
      break;
    case 'derived':
      checkEnum(s.aggregation, AGGREGATIONS, 'derived.aggregation', err);
      checkEnum(s.window?.relation, WINDOW_RELATIONS, 'derived.window.relation', err);
      (s.inputs ?? []).forEach((input, i) => {
        checkEnum(input.role, INPUT_ROLES, `derived.inputs[${i}].role`, err);
        if (input.concept && !CONCEPT_ID_PATTERN.test(input.concept)) err(`derived.inputs[${i}].concept`, 'Identificador de conceito inválido.');
      });
      for (const key of ['offset_from', 'offset_to']) {
        const v = s.window?.[key];
        if (v !== null && v !== undefined && !Number.isFinite(v)) err(`derived.window.${key}`, 'Informe um número.');
      }
      break;
    case 'vocabulary': {
      const codes = new Set();
      (s.options ?? []).forEach((o, i) => {
        if (o.code && codes.has(o.code)) err(`vocabulary.options[${i}].code`, 'Código de opção repetido.');
        if (o.code) codes.add(o.code);
      });
      break;
    }
    default:
      break;
  }

  if (content.deprecation) {
    (content.deprecation.replaced_by ?? []).forEach((id, i) => {
      if (!CONCEPT_ID_PATTERN.test(id)) err(`deprecation.replaced_by[${i}]`, 'Identificador de conceito inválido.');
    });
  }

  if (full) validateCompleteness(content, kindDef, err, warn);
  if (lookup) validateReferences(content, { lookup, selfId, err, warn, full });

  return { errors, warnings };
}

function checkEnum(value, vocabulary, path, err) {
  if (value !== null && value !== undefined && value !== '' && !vocabulary[value]) err(path, 'Valor fora do vocabulário permitido.');
}

function validateConstraints(c, err) {
  for (const key of ['min', 'max', 'decimals', 'max_length']) {
    const v = c[key];
    if (v !== null && v !== undefined && !Number.isFinite(v)) err(`constraints.${key}`, 'Informe um número.');
  }
  if (Number.isFinite(c.min) && Number.isFinite(c.max) && c.min > c.max) err('constraints.max', 'O máximo deve ser maior ou igual ao mínimo.');
  if (Number.isFinite(c.decimals) && (!Number.isInteger(c.decimals) || c.decimals < 0 || c.decimals > 10)) {
    err('constraints.decimals', 'Use um inteiro entre 0 e 10.');
  }
  if (Number.isFinite(c.max_length) && (!Number.isInteger(c.max_length) || c.max_length < 1)) {
    err('constraints.max_length', 'Use um inteiro positivo.');
  }
  if (c.pattern) {
    try {
      new RegExp(c.pattern); // eslint-disable-line no-new
    } catch {
      err('constraints.pattern', 'Expressão regular inválida.');
    }
  }
}

function validateCompleteness(content, kindDef, err, warn) {
  if (!content.label || content.label.length < 3) err('label', 'Informe o nome de exibição (mínimo de 3 caracteres).');
  if (!content.code) err('code', 'Informe o nome canônico.');
  if (!content.definition || content.definition.length < 20) err('definition', 'Escreva a definição (mínimo de 20 caracteres).');

  const usesValues = kindDef.valueTypes.length > 0;
  if (usesValues && !content.value_type) err('value_type', 'Escolha o tipo de valor.');
  if (content.value_type && VALUE_TYPES[content.value_type]?.unitRequired && !content.unit) {
    err('unit', 'Informe a unidade (use "1" para grandezas adimensionais).');
  }
  if (content.value_type === 'codificado' && !content.value_set) err('value_set', 'Escolha o vocabulário controlado.');

  const sens = content.sensitivity ? SENSITIVITY[content.sensitivity] : null;
  if (sens?.requiresPolicy && !content.access_policy) err('access_policy', 'Descreva a política de acesso exigida por esta sensibilidade.');

  (content.relations ?? []).forEach((r, i) => {
    if (!r.type) err(`relations[${i}].type`, 'Escolha o tipo de relação.');
    if (!r.target) err(`relations[${i}].target`, 'Escolha o conceito relacionado.');
  });
  (content.bindings ?? []).forEach((b, i) => {
    if (!b.system) err(`bindings[${i}].system`, 'Informe o sistema terminológico.');
    if (!b.code) err(`bindings[${i}].code`, 'Informe o código.');
    if (!b.match) err(`bindings[${i}].match`, 'Informe o tipo de correspondência.');
  });
  (content.implementation ?? []).forEach((m, i) => {
    if (!m.object) err(`implementation[${i}].object`, 'Informe o objeto físico (tabela ou tabela.coluna).');
  });
  (content.absence ?? []).forEach((a, i) => {
    if (!a.condition) warn(`absence[${i}].condition`, 'Descreva quando este estado se aplica.');
  });

  const s = content[kindDef.section] ?? {};
  switch (kindDef.section) {
    case 'entity_spec':
      if (!s.identity_criterion) err('entity_spec.identity_criterion', 'Descreva o critério de identidade da entidade.');
      break;
    case 'identifier':
      if (!content.entity) err('entity', 'Escolha a entidade identificada.');
      if (!s.role) err('identifier.role', 'Escolha o papel do identificador.');
      if (!s.issuer) err('identifier.issuer', 'Informe o emissor.');
      if (!s.scope) err('identifier.scope', 'Informe o escopo de unicidade.');
      if (!s.assignment) err('identifier.assignment', 'Informe como o identificador é atribuído.');
      if (!s.cardinality) err('identifier.cardinality', 'Informe a cardinalidade.');
      if (!content.sensitivity) err('sensitivity', 'Classifique a sensibilidade do identificador.');
      break;
    case 'structural':
      if (!s.managed_by) err('structural.managed_by', 'Informe quem atribui o valor.');
      if (!s.applies_to) err('structural.applies_to', 'Informe a abrangência.');
      if (s.applies_to === 'entidade' && !content.entity) err('entity', 'Escolha a entidade a que o atributo pertence.');
      if ((content.implementation ?? []).length === 0) warn('implementation', 'Atributo estrutural sem vínculo com metadados técnicos.');
      break;
    case 'observable':
      if (!content.entity) err('entity', 'Escolha a entidade observada (ex.: paciente).');
      if (!content.sensitivity) warn('sensitivity', 'Sensibilidade não classificada.');
      break;
    case 'event':
      if (!content.entity) err('entity', 'Escolha a entidade a que o evento se refere.');
      if (!s.temporal_precision) err('event.temporal_precision', 'Informe a precisão temporal.');
      break;
    case 'derived':
      if (!s.rule_text || s.rule_text.length < 20) err('derived.rule_text', 'Descreva a regra em linguagem clara (mínimo de 20 caracteres).');
      if ((s.inputs ?? []).length === 0) err('derived.inputs', 'Informe ao menos uma entrada (observação ou evento).');
      (s.inputs ?? []).forEach((input, i) => {
        if (!input.concept) err(`derived.inputs[${i}].concept`, 'Escolha o conceito de entrada.');
        if (!input.role) err(`derived.inputs[${i}].role`, 'Informe o papel da entrada.');
      });
      if (s.window?.relation && !s.anchor_event) err('derived.anchor_event', 'Janela temporal exige evento-âncora.');
      if (!s.aggregation) err('derived.aggregation', 'Informe a seleção ou agregação aplicada.');
      break;
    case 'vocabulary': {
      const options = s.options ?? [];
      if (options.length < 2) err('vocabulary.options', 'Um vocabulário precisa de ao menos duas opções.');
      options.forEach((o, i) => {
        if (!o.code) err(`vocabulary.options[${i}].code`, 'Informe o código da opção.');
        if (!o.label) err(`vocabulary.options[${i}].label`, 'Informe o rótulo da opção.');
        if (!o.definition) warn(`vocabulary.options[${i}].definition`, 'Opção sem definição.');
      });
      break;
    }
    default:
      break;
  }

  if (content.deprecation) {
    if (!content.deprecation.reason || content.deprecation.reason.length < 10) err('deprecation.reason', 'Explique o motivo da obsolescência (mínimo de 10 caracteres).');
  }
}

function validateReferences(content, { lookup, selfId, err, warn, full }) {
  const check = (id, path, { kind = null, kindLabel = '' } = {}) => {
    if (!id || !CONCEPT_ID_PATTERN.test(id)) return;
    if (id === selfId) {
      err(path, 'Um conceito não pode referenciar a si mesmo.');
      return;
    }
    const target = lookup(id);
    if (!target) {
      (full ? err : warn)(path, `Conceito ${id} não existe.`);
      return;
    }
    if (kind && target.kind !== kind) (full ? err : warn)(path, `${id} não é ${kindLabel}.`);
    if (target.status === 'descartado') (full ? err : warn)(path, `${id} foi descartado.`);
    else if (target.status === 'obsoleto') warn(path, `${id} está obsoleto.`);
  };
  check(content.entity, 'entity', { kind: 'entidade', kindLabel: 'uma entidade' });
  check(content.value_set, 'value_set', { kind: 'vocabulario', kindLabel: 'um vocabulário controlado' });
  (content.relations ?? []).forEach((r, i) => check(r.target, `relations[${i}].target`));
  if (content.derived) {
    (content.derived.inputs ?? []).forEach((input, i) => check(input.concept, `derived.inputs[${i}].concept`));
    check(content.derived.anchor_event, 'derived.anchor_event', { kind: 'evento', kindLabel: 'um tipo de evento' });
  }
  (content.deprecation?.replaced_by ?? []).forEach((id, i) => check(id, `deprecation.replaced_by[${i}]`));
}

/** Todas as referências a outros conceitos presentes em um conteúdo. */
export function referencedConcepts(content) {
  const refs = [];
  if (!content) return refs;
  if (content.entity) refs.push({ target: content.entity, via: 'entity' });
  if (content.value_set) refs.push({ target: content.value_set, via: 'value_set' });
  for (const r of content.relations ?? []) if (r.target) refs.push({ target: r.target, via: `relation:${r.type}`, note: r.note });
  for (const input of content.derived?.inputs ?? []) if (input.concept) refs.push({ target: input.concept, via: 'derived.input' });
  if (content.derived?.anchor_event) refs.push({ target: content.derived.anchor_event, via: 'derived.anchor_event' });
  for (const id of content.deprecation?.replaced_by ?? []) refs.push({ target: id, via: 'deprecation.replaced_by' });
  return refs;
}

/** Sugestão de nome canônico a partir do nome de exibição. */
export function suggestCode(label) {
  return String(label ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, 'c_$1')
    .slice(0, 63);
}
