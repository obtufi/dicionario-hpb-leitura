/**
 * Editor semântico de um conceito.
 *
 * - Formulário da definição humana (editável apenas em rascunho), com campos
 *   específicos por natureza, domínio de valores, restrições, estados de
 *   ausência, relações, terminologias, privacidade e implementação física.
 * - Painéis laterais separados: metadados técnicos (somente leitura),
 *   tabelas que usam o conceito, possíveis duplicidades e referências recebidas.
 * - Fluxo: salvar rascunho → enviar para revisão → aprovar | devolver; descarte;
 *   nova revisão a partir da aprovada; obsolescência; versões e comparação.
 */
import {
  Alert, Badge, Button, Checkbox, DataTable, DiffView, EditableList, EmptyState, Field, Fieldset, KeyValueList, PageHeader, Panel,
  SaveStatus, Section, Select, Tabs, TextArea, TextInput, Timeline, confirmDialog, formDialog, h, toast,
} from '/design-system/components.js';
import {
  ABSENCE_STATES, AGGREGATIONS, BINDING_MATCH, CARDINALITIES, FIELD_LABELS, IDENTIFIER_ASSIGNMENT, IDENTIFIER_ROLES, INPUT_ROLES, KINDS,
  RELATION_TYPES, REVISION_STATUS, SENSITIVITY, STRUCTURAL_APPLIES_TO, STRUCTURAL_MANAGED_BY, TEMPORAL_PRECISION, VALUE_TYPES,
  WINDOW_RELATIONS, normalizeContent, suggestCode, validateContent,
} from '/shared/semantic-model.js';
import { diffContents, wordDiff } from '/shared/diff.js';
import { api } from '../api.js';
import { isReadOnly } from '../leitura/modo.js';
import { session } from '../session.js';
import { formatActor, formatDateTime } from '../format.js';
import {
  ConceptRef, ConceptSelect, ConceptStatusBadge, KindBadge, OriginBadge, RevisionStatusBadge,
  SensitivityBadge, conceptHref, tableHref,
} from '../components/domain.js';

const enumOptions = (vocab) => Object.entries(vocab).map(([value, def]) => ({ value, label: def.label }));
const describedOptions = (vocab) => Object.entries(vocab).map(([value, def]) => ({ value, label: def.description ? `${def.label} — ${def.description}` : def.label }));
const TAB_IDS = ['definicao', 'versoes', 'historico'];

export async function render(ctx, { conceptId, tab }) {
  const [detail, concepts] = await Promise.all([
    api.get(`/api/concepts/${encodeURIComponent(conceptId)}`),
    api.get('/api/concepts'),
  ]);
  const root = h('div', { class: 'stack stack--lg' });
  createEditor(ctx, root, concepts, TAB_IDS.includes(tab) ? tab : 'definicao').load(detail);
  return root;
}

function errorLabel(path) {
  const base = path.replace(/\[\d+\].*$/, '');
  const index = /\[(\d+)\]/.exec(path)?.[1];
  const label = FIELD_LABELS[path] ?? FIELD_LABELS[base] ?? base;
  return index != null ? `${label} (linha ${Number(index) + 1})` : label;
}

function createEditor(ctx, root, concepts, initialTab) {
  const byId = new Map(concepts.map((c) => [c.concept_id, c]));
  const saveStatus = SaveStatus();
  let data = null;
  let viewing = null;
  let draft = null;
  let changeSummary = '';
  let dirty = false;
  let activeTab = initialTab;
  let fields = new Map();
  let formSlot = null;
  let errorSlot = null;
  let saveButton = null;

  const conceptId = () => data.concept.concept_id;
  const isWorkingView = () => Boolean(data.working) && viewing.revision_id === data.working.revision_id;
  const editable = () => !isReadOnly() && isWorkingView() && viewing.status === 'rascunho';

  // ------------------------------------------------------------ estado e carga

  function load(detail, { keepView = false } = {}) {
    data = detail;
    const previous = keepView && viewing ? data.revisions.find((r) => r.revision_id === viewing.revision_id) : null;
    viewing = previous ?? data.display;
    draft = structuredClone(viewing.content);
    changeSummary = viewing.change_summary ?? '';
    dirty = false;
    byId.set(data.concept.concept_id, { ...data.summary, concept_id: data.concept.concept_id });
    ctx.setTitle(`${data.concept.concept_id} · ${data.summary.label || 'sem nome'}`);
    ctx.setDirtyCheck(() => dirty);
    renderAll();
  }

  function markDirty() {
    if (!editable()) return;
    dirty = true;
    saveStatus.set('dirty');
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.classList.add('btn--primary');
    }
  }

  function getPath(path) {
    return path.split('.').reduce((obj, key) => (obj == null ? undefined : obj[key]), draft);
  }

  function setPath(path, value) {
    const keys = path.split('.');
    let obj = draft;
    for (const key of keys.slice(0, -1)) {
      if (obj[key] == null || typeof obj[key] !== 'object') obj[key] = {};
      obj = obj[key];
    }
    obj[keys[keys.length - 1]] = value;
    markDirty();
  }

  function lookup(id) {
    const c = byId.get(id);
    return c ? { kind: c.kind, status: c.status } : null;
  }

  // ------------------------------------------------------------ fábricas de campos ligados ao rascunho

  const register = (path, field) => {
    fields.set(path, field);
    return field;
  };

  function textField(path, { label, hint = null, required = false, optional = false, multiline = false, rows = 3, mono = false, placeholder = null }) {
    const readOnly = !editable();
    const value = getPath(path) ?? '';
    const control = multiline
      ? TextArea({ value, rows, readOnly, placeholder, onInput: (v) => setPath(path, v) })
      : TextInput({ value, mono, readOnly, placeholder, onInput: (v) => setPath(path, v) });
    return register(path, Field({ label, control, hint, required, optional }));
  }

  function selectField(path, { label, options, hint = null, required = false, placeholder = 'Selecione…', rerender = false }) {
    const control = Select({
      value: getPath(path) ?? '',
      options,
      placeholder,
      disabled: !editable(),
      onChange: (v) => {
        setPath(path, v || null);
        if (rerender) renderForm();
      },
    });
    return register(path, Field({ label, control, hint, required }));
  }

  function conceptField(path, { label, kinds, hint = null, required = false }) {
    const value = getPath(path) ?? '';
    const control = ConceptSelect({ value, concepts: [...byId.values()], kinds, excludeId: conceptId(), disabled: !editable(), onChange: (v) => setPath(path, v || null) });
    const field = Field({ label, control, hint, required });
    if (value && byId.get(value)) field.insertBefore(h('div', {}, ConceptRef(byId.get(value))), field.querySelector('.field__error'));
    return register(path, field);
  }

  function numberField(path, { label, hint = null }) {
    const value = getPath(path);
    const control = TextInput({
      value: value ?? '',
      inputMode: 'decimal',
      readOnly: !editable(),
      onInput: (v) => {
        const t = v.trim();
        if (t === '') return setPath(path, null);
        const n = Number(t.replace(',', '.'));
        return setPath(path, Number.isFinite(n) ? n : t);
      },
    });
    return register(path, Field({ label, control, hint, optional: true }));
  }

  function checkField(path, { label, hint = null, rerender = false }) {
    return Checkbox({
      checked: Boolean(getPath(path)),
      label,
      hint,
      disabled: !editable(),
      onChange: (v) => {
        setPath(path, v);
        if (rerender) renderForm();
      },
    });
  }

  function listField(path, { legend, hint = null, columns, createItem, addLabel = 'Adicionar', emptyLabel = 'Nenhum item.' }) {
    const list = EditableList({ items: getPath(path) ?? [], columns, createItem, readOnly: !editable(), addLabel, emptyLabel, ariaLabel: legend, onChange: (items) => setPath(path, items) });
    return register(path, Fieldset({ legend, hint, children: [list] }));
  }

  function stringListField(path, { legend, hint, itemLabel, addLabel }) {
    return listField(path, {
      legend,
      hint,
      addLabel,
      emptyLabel: 'Nenhum.',
      createItem: () => '',
      columns: [{ key: null, label: itemLabel, render: (value, update, row, i, o) => TextInput({ value, ariaLabel: o.ariaLabel, readOnly: o.readOnly, onInput: update }) }],
    });
  }

  // ------------------------------------------------------------ seções do formulário

  function identificationSection() {
    const kindSelect = Select({
      value: draft.kind,
      options: Object.entries(KINDS).map(([value, def]) => ({ value, label: def.label })),
      disabled: !editable(),
      onChange: async (newKind, el) => {
        const { confirmed } = await confirmDialog({
          title: 'Mudar a natureza do conceito?',
          message: `Os campos específicos de "${KINDS[draft.kind].label}" serão descartados deste rascunho. Definição, nomes, relações e demais campos comuns são mantidos.`,
          confirmLabel: 'Mudar natureza',
        });
        if (!confirmed) {
          el.value = draft.kind;
          return;
        }
        const next = normalizeContent({ ...draft, kind: newKind });
        if (next.value_type && !KINDS[newKind].valueTypes.includes(next.value_type)) next.value_type = null;
        draft = next;
        markDirty();
        renderForm();
      },
    });
    const kindField = register('kind', Field({ label: 'Natureza', control: kindSelect, required: true, hint: KINDS[draft.kind]?.description }));

    const codeField = textField('code', { label: 'Nome canônico', mono: true, required: true, hint: 'Identificador legível para esquemas e APIs (minúsculas, números e "_"). O identificador estável é o ID, não este nome.' });
    if (editable()) {
      const input = codeField.querySelector('input');
      codeField.insertBefore(h('div', {}, Button({
        label: 'Sugerir a partir do nome',
        size: 'sm',
        variant: 'ghost',
        icon: 'edit',
        onClick: () => {
          input.value = suggestCode(draft.label);
          setPath('code', input.value);
        },
      })), codeField.querySelector('.field__error'));
    }

    return Section({
      title: 'Identificação',
      headingLevel: 3,
      children: [h('div', { class: 'form-grid' },
        Field({ label: 'Identificador estável', control: TextInput({ value: conceptId(), mono: true, readOnly: true }), hint: 'Atribuído pelo sistema; nunca muda nem é reutilizado.' }),
        kindField,
        textField('label', { label: 'Nome de exibição', required: true }),
        codeField,
        h('div', { class: 'form-grid__full' }, stringListField('synonyms', { legend: 'Sinônimos e rótulos alternativos', hint: 'Inclui rótulos alternativos úteis para busca.', itemLabel: 'Sinônimo', addLabel: 'Adicionar sinônimo' })))],
    });
  }

  function definitionSection() {
    return Section({
      title: 'Definição',
      headingLevel: 3,
      description: 'Texto oficial após aprovação. Defina o significado, não a forma de armazenamento.',
      children: [
        textField('definition', { label: 'Definição', required: true, multiline: true, rows: 4 }),
        textField('usage_notes', { label: 'Notas de uso', optional: true, multiline: true, rows: 5, hint: 'Critérios de uso, exclusões, “não confundir com”, pendências.' }),
        stringListField('references', { legend: 'Referências', hint: 'Normas, legislação ou documentos que fundamentam a definição.', itemLabel: 'Referência', addLabel: 'Adicionar referência' }),
      ],
    });
  }

  function kindSection() {
    const kind = draft.kind;
    const def = KINDS[kind];
    const grid = (...children) => h('div', { class: 'form-grid' }, ...children);
    let body;
    switch (def.section) {
      case 'entity_spec':
        body = textField('entity_spec.identity_criterion', { label: 'Critério de identidade', required: true, multiline: true, rows: 4, hint: 'O que faz dois registros representarem a mesma entidade.' });
        break;
      case 'identifier':
        body = grid(
          conceptField('entity', { label: 'Entidade identificada', kinds: ['entidade'], required: true }),
          selectField('identifier.role', { label: 'Papel do identificador', options: describedOptions(IDENTIFIER_ROLES), required: true }),
          textField('identifier.issuer', { label: 'Emissor (autoridade)', required: true }),
          textField('identifier.scope', { label: 'Escopo de unicidade', required: true }),
          selectField('identifier.assignment', { label: 'Atribuição', options: describedOptions(IDENTIFIER_ASSIGNMENT), required: true }),
          selectField('identifier.cardinality', { label: 'Cardinalidade', options: enumOptions(CARDINALITIES), required: true }),
          h('div', { class: 'form-grid__full' }, textField('identifier.format_description', { label: 'Formato', optional: true, multiline: true, rows: 2 })),
        );
        break;
      case 'structural': {
        const all = draft.structural?.applies_to === 'todas_entidades';
        body = grid(
          selectField('structural.applies_to', { label: 'Abrangência', options: enumOptions(STRUCTURAL_APPLIES_TO), required: true, rerender: true }),
          all ? h('p', { class: 'text-sm text-muted' }, 'Atributo comum: vale para todas as entidades e não é repetido por tabela.') : conceptField('entity', { label: 'Entidade', kinds: ['entidade'], required: true }),
          selectField('structural.managed_by', { label: 'Quem atribui o valor', options: enumOptions(STRUCTURAL_MANAGED_BY), required: true }),
          h('div', { class: 'form-grid__full' }, textField('structural.analytic_use', { label: 'Uso analítico', optional: true, multiline: true, rows: 2, hint: 'Se e como o atributo pode ser usado em análises e exportações.' })),
        );
        break;
      }
      case 'observable':
        body = grid(
          conceptField('entity', { label: 'Entidade observada', kinds: ['entidade'], required: true }),
          textField('observable.method', { label: 'Método', optional: true }),
          textField('observable.specimen', { label: 'Amostra ou material', optional: true }),
        );
        break;
      case 'event':
        body = grid(
          conceptField('entity', { label: 'Entidade a que o evento se refere', kinds: ['entidade'], required: true }),
          selectField('event.temporal_precision', { label: 'Precisão temporal', options: enumOptions(TEMPORAL_PRECISION), required: true }),
          checkField('event.has_duration', { label: 'O evento tem duração (início e fim)' }),
        );
        break;
      case 'derived':
        body = h('div', { class: 'stack' },
          textField('derived.rule_text', { label: 'Regra em linguagem clara', required: true, multiline: true, rows: 3, hint: 'Ex.: “última creatinina sérica registrada antes da data do transplante”.' }),
          listField('derived.inputs', {
            legend: 'Entradas',
            hint: 'Observações, eventos ou outras definições usadas pela regra.',
            addLabel: 'Adicionar entrada',
            createItem: () => ({ concept: '', role: 'observacao' }),
            columns: [
              { key: 'concept', label: 'Conceito', render: (v, update, r, i, o) => ConceptSelect({ value: v, concepts: [...byId.values()], kinds: ['observavel', 'evento', 'derivado'], excludeId: conceptId(), disabled: o.readOnly, ariaLabel: o.ariaLabel, onChange: update, size: 'sm' }) },
              { key: 'role', label: 'Papel', render: (v, update, r, i, o) => Select({ value: v ?? '', options: enumOptions(INPUT_ROLES), disabled: o.readOnly, ariaLabel: o.ariaLabel, onChange: update, size: 'sm' }) },
            ],
          }),
          h('div', { class: 'form-grid' },
            conceptField('derived.anchor_event', { label: 'Evento-âncora', kinds: ['evento'] }),
            selectField('derived.window.relation', { label: 'Janela temporal', options: enumOptions(WINDOW_RELATIONS) }),
            numberField('derived.window.offset_from', { label: 'Início da janela (deslocamento)' }),
            numberField('derived.window.offset_to', { label: 'Fim da janela (deslocamento)' }),
            textField('derived.window.unit', { label: 'Unidade da janela', optional: true, placeholder: 'd, h, mo…' }),
            selectField('derived.aggregation', { label: 'Seleção ou agregação', options: enumOptions(AGGREGATIONS), required: true })),
          textField('derived.expression', { label: 'Expressão de cálculo', optional: true, multiline: true, rows: 2, mono: true }));
        break;
      case 'vocabulary':
        body = h('div', { class: 'stack' },
          checkField('vocabulary.extensible', { label: 'Extensível', hint: 'Permite incluir novas opções sem nova versão do vocabulário' }),
          listField('vocabulary.options', {
            legend: 'Opções permitidas',
            hint: 'Códigos estáveis; rótulos e definições em português.',
            addLabel: 'Adicionar opção',
            createItem: () => ({ code: '', label: '', definition: '', active: true }),
            columns: [
              { key: 'code', label: 'Código', render: (v, update, r, i, o) => TextInput({ value: v, mono: true, size: 'sm', readOnly: o.readOnly, ariaLabel: o.ariaLabel, onInput: update }) },
              { key: 'label', label: 'Rótulo', render: (v, update, r, i, o) => TextInput({ value: v, size: 'sm', readOnly: o.readOnly, ariaLabel: o.ariaLabel, onInput: update }) },
              { key: 'definition', label: 'Definição', render: (v, update, r, i, o) => TextInput({ value: v, size: 'sm', readOnly: o.readOnly, ariaLabel: o.ariaLabel, onInput: update }) },
              { key: 'active', label: 'Ativa', render: (v, update, r, i, o) => Checkbox({ checked: v !== false, label: h('span', { class: 'sr-only' }, o.ariaLabel), disabled: o.readOnly, onChange: update }) },
            ],
          }));
        break;
      default:
        body = h('p', {}, 'Natureza sem campos específicos.');
    }
    return Section({ title: `Especificação: ${def.label.toLowerCase()}`, headingLevel: 3, description: def.description, children: [body] });
  }

  function absenceFieldset() {
    const readOnly = !editable();
    const current = new Map((draft.absence ?? []).map((a) => [a.state, a.condition]));
    const sync = () => setPath('absence', Object.keys(ABSENCE_STATES).filter((s) => current.has(s)).map((s) => ({ state: s, condition: current.get(s) ?? '' })));
    const rows = Object.entries(ABSENCE_STATES).map(([state, def]) => {
      const condition = TextInput({ value: current.get(state) ?? '', placeholder: 'Quando este estado se aplica?', readOnly, ariaLabel: `Condição — ${def.label}`, onInput: (v) => { current.set(state, v); sync(); } });
      condition.hidden = !current.has(state);
      const box = Checkbox({
        checked: current.has(state),
        label: def.label,
        hint: def.description,
        disabled: readOnly,
        onChange: (on) => {
          if (on) current.set(state, condition.value);
          else current.delete(state);
          condition.hidden = !on;
          sync();
        },
      });
      return h('div', { class: 'stack stack--sm' }, box, condition);
    });
    return register('absence', Fieldset({ legend: 'Estados de ausência permitidos', hint: 'Distinguem valor ausente, desconhecido e não aplicável; ficam separados do valor.', children: [h('div', { class: 'stack' }, ...rows)] }));
  }

  function domainSection() {
    const kindDef = KINDS[draft.kind];
    if (kindDef.valueTypes.length === 0) return null;
    const type = draft.value_type;
    const typeDef = VALUE_TYPES[type];
    const constraints = typeDef?.constraints ?? [];
    const grid = h('div', { class: 'form-grid' },
      selectField('value_type', { label: 'Tipo de valor', options: kindDef.valueTypes.map((t) => ({ value: t, label: VALUE_TYPES[t].label })), required: true, rerender: true }),
      typeDef?.unit ? textField('unit', { label: 'Unidade (UCUM)', required: Boolean(typeDef.unitRequired), placeholder: 'mg/dL, kg, 1…', mono: true }) : null,
      typeDef?.valueSet ? conceptField('value_set', { label: 'Vocabulário controlado', kinds: ['vocabulario'], required: true }) : null,
      constraints.includes('min') ? numberField('constraints.min', { label: 'Valor mínimo' }) : null,
      constraints.includes('max') ? numberField('constraints.max', { label: 'Valor máximo' }) : null,
      constraints.includes('decimals') ? numberField('constraints.decimals', { label: 'Casas decimais' }) : null,
      constraints.includes('max_length') ? numberField('constraints.max_length', { label: 'Comprimento máximo' }) : null,
      constraints.includes('pattern') ? textField('constraints.pattern', { label: 'Padrão (expressão regular)', optional: true, mono: true }) : null);
    return Section({
      title: 'Domínio de valores e restrições',
      headingLevel: 3,
      children: [
        grid,
        h('div', { class: 'cluster' },
          checkField('constraints.required', { label: 'Obrigatório', hint: 'Exige valor ou um estado de ausência permitido' }),
          constraints.includes('multiple') ? checkField('constraints.multiple', { label: 'Múltipla escolha' }) : null),
        absenceFieldset(),
      ],
    });
  }

  function relationsSection() {
    const typed = [];
    if (draft.entity) typed.push(['Entidade', draft.entity]);
    if (draft.value_set) typed.push(['Vocabulário', draft.value_set]);
    for (const input of draft.derived?.inputs ?? []) if (input.concept) typed.push(['Entrada', input.concept]);
    if (draft.derived?.anchor_event) typed.push(['Evento-âncora', draft.derived.anchor_event]);
    return Section({
      title: 'Relações',
      headingLevel: 3,
      description: 'Relacione conceitos sem duplicá-los. Sobreposições declaradas aparecem como possíveis duplicidades para análise.',
      children: [
        typed.length ? KeyValueList(typed.map(([key, id]) => ({ key, value: ConceptRef(byId.get(id) ?? { concept_id: id, label: '(inexistente)' }) }))) : null,
        listField('relations', {
          legend: 'Relações semânticas',
          addLabel: 'Adicionar relação',
          createItem: () => ({ type: 'relacionado', target: '', note: '' }),
          columns: [
            { key: 'type', label: 'Tipo', render: (v, update, r, i, o) => Select({ value: v ?? '', options: enumOptions(RELATION_TYPES), disabled: o.readOnly, ariaLabel: o.ariaLabel, onChange: update, size: 'sm' }) },
            { key: 'target', label: 'Conceito', render: (v, update, r, i, o) => ConceptSelect({ value: v, concepts: [...byId.values()], excludeId: conceptId(), disabled: o.readOnly, ariaLabel: o.ariaLabel, onChange: update, size: 'sm' }) },
            { key: 'note', label: 'Observação', render: (v, update, r, i, o) => TextInput({ value: v, size: 'sm', readOnly: o.readOnly, ariaLabel: o.ariaLabel, onInput: update }) },
          ],
        }),
      ],
    });
  }

  function bindingsSection() {
    return Section({
      title: 'Terminologias externas',
      headingLevel: 3,
      description: 'Correspondências com padrões (HL7, LOINC, SNOMED CT, CID…). Verifique códigos na fonte oficial antes de aprovar.',
      children: [listField('bindings', {
        legend: 'Correspondências',
        addLabel: 'Adicionar correspondência',
        createItem: () => ({ system: '', code: '', display: '', match: 'equivalente' }),
        columns: [
          { key: 'system', label: 'Sistema', render: (v, update, r, i, o) => TextInput({ value: v, size: 'sm', readOnly: o.readOnly, ariaLabel: o.ariaLabel, onInput: update }) },
          { key: 'code', label: 'Código', render: (v, update, r, i, o) => TextInput({ value: v, size: 'sm', mono: true, readOnly: o.readOnly, ariaLabel: o.ariaLabel, onInput: update }) },
          { key: 'display', label: 'Termo', render: (v, update, r, i, o) => TextInput({ value: v, size: 'sm', readOnly: o.readOnly, ariaLabel: o.ariaLabel, onInput: update }) },
          { key: 'match', label: 'Correspondência', render: (v, update, r, i, o) => Select({ value: v ?? '', options: enumOptions(BINDING_MATCH), disabled: o.readOnly, ariaLabel: o.ariaLabel, onChange: update, size: 'sm' }) },
        ],
      })],
    });
  }

  function privacySection() {
    const sens = draft.sensitivity ? SENSITIVITY[draft.sensitivity] : null;
    return Section({
      title: 'Privacidade e acesso',
      headingLevel: 3,
      description: 'Classificação quanto à identificabilidade. Dados de saúde são sempre dados pessoais sensíveis (LGPD); esta classificação orienta quem pode ver cada valor.',
      children: [h('div', { class: 'form-grid' },
        selectField('sensitivity', { label: 'Sensibilidade', options: describedOptions(SENSITIVITY), placeholder: 'Não classificada', rerender: true }),
        h('div', { class: 'form-grid__full' }, textField('access_policy', { label: 'Política de acesso', required: Boolean(sens?.requiresPolicy), optional: !sens?.requiresPolicy, multiline: true, rows: 3 })))],
    });
  }

  function implementationSection() {
    return Section({
      title: 'Implementação física',
      headingLevel: 3,
      description: 'Vínculo, declarado por pessoas, entre o conceito e objetos do banco (tabela ou tabela.coluna). Os metadados descobertos aparecem no painel técnico, somente leitura.',
      children: [listField('implementation', {
        legend: 'Objetos físicos',
        addLabel: 'Adicionar objeto',
        createItem: () => ({ object: '', note: '' }),
        columns: [
          { key: 'object', label: 'Objeto', render: (v, update, r, i, o) => TextInput({ value: v, size: 'sm', mono: true, readOnly: o.readOnly, ariaLabel: o.ariaLabel, onInput: update, placeholder: 'tabela.coluna' }) },
          { key: 'note', label: 'Observação', render: (v, update, r, i, o) => TextInput({ value: v, size: 'sm', readOnly: o.readOnly, ariaLabel: o.ariaLabel, onInput: update }) },
        ],
      })],
    });
  }

  function deprecationSection() {
    if (!draft.deprecation) return null;
    return Section({
      title: 'Obsolescência',
      headingLevel: 3,
      description: 'Ao ser aprovada, esta revisão declara o conceito obsoleto.',
      actions: editable() ? [Button({ label: 'Remover obsolescência', icon: 'x', size: 'sm', onClick: () => { draft.deprecation = null; markDirty(); renderForm(); } })] : [],
      children: [
        textField('deprecation.reason', { label: 'Motivo', required: true, multiline: true, rows: 3 }),
        listField('deprecation.replaced_by', {
          legend: 'Substituído por',
          addLabel: 'Adicionar conceito',
          createItem: () => '',
          columns: [{ key: null, label: 'Conceito', render: (v, update, r, i, o) => ConceptSelect({ value: v, concepts: [...byId.values()], excludeId: conceptId(), disabled: o.readOnly, ariaLabel: o.ariaLabel, onChange: update, size: 'sm' }) }],
        }),
      ],
    });
  }

  function changeSummaryField() {
    if (!editable()) {
      return viewing.change_summary ? KeyValueList([{ key: 'Resumo da revisão', value: viewing.change_summary }]) : null;
    }
    const input = TextInput({ value: changeSummary, placeholder: 'O que muda nesta revisão e por quê', onInput: (v) => { changeSummary = v; markDirty(); } });
    return Field({ label: 'Resumo desta revisão', control: input, optional: true, hint: 'Aparece no histórico de versões.' });
  }

  function renderForm() {
    if (!formSlot) return;
    fields = new Map();
    formSlot.replaceChildren(
      identificationSection(),
      definitionSection(),
      kindSection(),
      domainSection(),
      relationsSection(),
      bindingsSection(),
      privacySection(),
      implementationSection(),
      deprecationSection(),
    );
  }

  function showErrors(errors = [], warnings = []) {
    for (const field of fields.values()) field.setError?.(null);
    const grouped = new Map();
    for (const e of errors) {
      let path = e.path;
      let prefix = '';
      const m = /^(.*?)\[(\d+)\]/.exec(path);
      if (!fields.has(path) && m) {
        path = m[1];
        prefix = `Linha ${Number(m[2]) + 1}: `;
      }
      if (!fields.has(path)) continue;
      grouped.set(path, [...(grouped.get(path) ?? []), prefix + e.message]);
    }
    for (const [path, messages] of grouped) fields.get(path).setError(messages.join(' '));
    errorSlot.replaceChildren(...[
      errors.length ? Alert({ tone: 'danger', title: `${errors.length} pendência${errors.length > 1 ? 's' : ''} impede${errors.length > 1 ? 'm' : ''} o envio para revisão`, list: errors.map((e) => `${errorLabel(e.path)}: ${e.message}`), role: 'alert' }) : null,
      warnings.length ? Alert({ tone: 'warning', title: 'Avisos', list: warnings.map((w) => `${errorLabel(w.path)}: ${w.message}`) }) : null,
    ].filter(Boolean));
    if (errors.length) errorSlot.scrollIntoView({ block: 'nearest' });
  }

  // ------------------------------------------------------------ ações do fluxo

  async function withActor() {
    const actor = await ctx.ensureActor();
    if (!actor) toast('Identifique-se para registrar alterações.', { tone: 'warning' });
    return actor;
  }

  async function act(promise, message, { tone = 'success' } = {}) {
    try {
      const updated = await promise;
      toast(message, { tone });
      load(updated);
      ctx.refreshNav();
      return true;
    } catch (error) {
      if (error.details?.errors) showErrors(error.details.errors, error.details.warnings ?? []);
      ctx.fail(error);
      return false;
    }
  }

  async function save({ silent = false } = {}) {
    if (!(await withActor())) return false;
    saveStatus.set('saving');
    const scroll = window.scrollY;
    try {
      const updated = await api.put(`/api/concepts/${encodeURIComponent(conceptId())}/draft`, { content: draft, row_version: viewing.row_version, change_summary: changeSummary });
      load(updated);
      window.scrollTo(0, scroll);
      if (!silent) toast('Rascunho salvo. Nada foi publicado.');
      ctx.refreshNav();
      return true;
    } catch (error) {
      saveStatus.set('error');
      if (error.details?.errors) showErrors(error.details.errors);
      if (error.code === 'conflito_de_edicao') {
        errorSlot.replaceChildren(Alert({
          tone: 'danger',
          title: 'Conflito de edição',
          children: [h('p', {}, error.message)],
          actions: [Button({ label: 'Recarregar (descarta suas alterações locais)', size: 'sm', onClick: async () => { dirty = false; await ctx.rerender(); } })],
          role: 'alert',
        }));
      }
      ctx.fail(error, 'Não foi possível salvar');
      return false;
    }
  }

  async function submit() {
    if (!(await withActor())) return;
    const content = normalizeContent(draft);
    const { errors, warnings } = validateContent(content, { mode: 'submissao', lookup, selfId: conceptId() });
    if (errors.length) {
      showErrors(errors, warnings);
      toast('Há pendências que impedem o envio para revisão.', { tone: 'danger' });
      return;
    }
    showErrors([], warnings);
    const { confirmed, note } = await confirmDialog({
      title: 'Enviar para revisão?',
      message: 'O conteúdo fica bloqueado até ser aprovado ou devolvido para rascunho. Enviar não publica a definição.',
      details: warnings.length ? Alert({ tone: 'warning', title: 'Avisos (não impedem o envio)', list: warnings.map((w) => `${errorLabel(w.path)}: ${w.message}`) }) : null,
      confirmLabel: 'Enviar para revisão',
      note: { label: 'Comentário para quem vai revisar', required: false },
    });
    if (!confirmed) return;
    if (dirty && !(await save({ silent: true }))) return;
    await act(api.post(`/api/revisions/${data.working.revision_id}/submit`, { row_version: data.working.row_version, note }), 'Revisão enviada para aprovação.');
  }

  async function approve() {
    if (!(await withActor())) return;
    const w = data.working;
    const self = [w.created_by, w.updated_by, w.submitted_by].includes(session.actor());
    const { confirmed, note } = await confirmDialog({
      title: `Aprovar e publicar a revisão ${w.revision_number}?`,
      message: `A revisão passa a ser a definição oficial publicada e torna-se imutável: mudanças futuras exigirão nova revisão.${data.published ? ` Substitui a revisão ${data.published.revision_number}.` : ''}${w.content.deprecation ? ' Esta revisão declara o conceito obsoleto.' : ''}`,
      details: self ? Alert({ tone: 'warning', title: 'Autoaprovação', children: [h('p', {}, 'Você também redigiu ou enviou esta revisão. A aprovação será registrada como autoaprovação na auditoria.')] }) : null,
      confirmLabel: 'Aprovar e publicar',
      tone: 'success',
      note: { label: 'Comentário da aprovação', required: false },
    });
    if (confirmed) await act(api.post(`/api/revisions/${w.revision_id}/approve`, { note }), `Revisão ${w.revision_number} aprovada e publicada.`);
  }

  async function returnToDraft() {
    if (!(await withActor())) return;
    const { confirmed, note } = await confirmDialog({
      title: 'Devolver para rascunho?',
      message: 'O conteúdo volta a ser editável. O motivo fica registrado na auditoria.',
      confirmLabel: 'Devolver',
      note: { label: 'Motivo da devolução', required: true, minLength: 5 },
    });
    if (confirmed) await act(api.post(`/api/revisions/${data.working.revision_id}/return`, { note }), 'Revisão devolvida para rascunho.', { tone: 'warning' });
  }

  async function discard() {
    if (!(await withActor())) return;
    const w = data.working;
    const proposal = w.origin === 'ia' && !w.proposal_accepted_by;
    const { confirmed, note } = await confirmDialog({
      title: proposal ? 'Rejeitar a proposta da IA?' : `Descartar a revisão ${w.revision_number}?`,
      message: data.published
        ? 'A versão aprovada continua publicada. A revisão descartada permanece no histórico.'
        : 'O conceito ficará como descartado (nunca apagado) e poderá ser reaberto. Decisões de mapeamento que o usam como alvo precisarão ser revistas.',
      confirmLabel: proposal ? 'Rejeitar proposta' : 'Descartar revisão',
      tone: 'danger',
      note: { label: 'Justificativa', required: true, minLength: 5 },
    });
    if (confirmed) await act(api.post(`/api/revisions/${w.revision_id}/discard`, { note }), proposal ? 'Proposta rejeitada.' : 'Revisão descartada.', { tone: 'warning' });
  }

  async function acceptProposal() {
    if (!(await withActor())) return;
    const { confirmed, note } = await confirmDialog({
      title: 'Aceitar a proposta como base de trabalho?',
      message: 'A proposta passa a ser um rascunho sob sua responsabilidade. Aceitar não aprova nem publica: a definição continua em rascunho até ser enviada e aprovada.',
      confirmLabel: 'Aceitar proposta',
      tone: 'success',
      note: { label: 'Comentário', required: false },
    });
    if (confirmed) await act(api.post(`/api/revisions/${data.working.revision_id}/accept-proposal`, { note }), 'Proposta aceita como base de trabalho.');
  }

  async function newRevision() {
    if (!(await withActor())) return;
    const base = data.published ?? data.revisions[data.revisions.length - 1];
    const { confirmed, note } = await confirmDialog({
      title: 'Criar nova revisão?',
      message: `Um novo rascunho será criado a partir da revisão ${base.revision_number} (${REVISION_STATUS[base.status].label.toLowerCase()}). A versão aprovada continua publicada até a nova ser aprovada.`,
      confirmLabel: 'Criar revisão',
      note: { label: 'Motivo da alteração', required: false },
    });
    if (confirmed) await act(api.post(`/api/concepts/${encodeURIComponent(conceptId())}/revisions`, { change_summary: note }), 'Nova revisão criada em rascunho.');
  }

  async function proposeDeprecation() {
    if (!(await withActor())) return;
    const reason = TextArea({ rows: 3 });
    const reasonField = Field({ label: 'Motivo', control: reason, required: true });
    const replaced = new Set();
    const select = ConceptSelect({ concepts: [...byId.values()], excludeId: conceptId(), placeholder: 'Adicionar conceito substituto…', onChange: (v, el) => { if (v) { replaced.add(v); chosen.textContent = [...replaced].join(', '); } el.value = ''; } });
    const chosen = h('p', { class: 'mono text-sm' });
    const result = await formDialog({
      title: 'Propor obsolescência',
      description: 'Cria uma nova revisão que declara o conceito obsoleto. Ela segue o fluxo normal: envio para revisão e aprovação humana.',
      body: [reasonField, Field({ label: 'Substituído por', control: select, optional: true }), chosen],
      submitLabel: 'Criar revisão de obsolescência',
      tone: 'danger',
      onSubmit: async () => {
        if (reason.value.trim().length < 10) {
          reasonField.setError('Escreva ao menos 10 caracteres.');
          return false;
        }
        return api.post(`/api/concepts/${encodeURIComponent(conceptId())}/deprecation`, { reason: reason.value.trim(), replaced_by: [...replaced] });
      },
    });
    if (result) {
      toast('Revisão de obsolescência criada em rascunho.');
      load(result);
      ctx.refreshNav();
    }
  }

  async function viewRevision(revisionId) {
    const rev = data.revisions.find((r) => r.revision_id === revisionId);
    if (!rev) return;
    if (dirty) {
      const { confirmed } = await confirmDialog({ title: 'Descartar alterações não salvas?', message: 'Visualizar outra revisão descarta as alterações locais deste rascunho.', confirmLabel: 'Descartar e visualizar', tone: 'danger' });
      if (!confirmed) return;
    }
    viewing = rev;
    draft = structuredClone(rev.content);
    changeSummary = rev.change_summary ?? '';
    dirty = false;
    activeTab = 'definicao';
    renderAll();
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------ cabeçalho, avisos e barra de ações

  function header() {
    const s = data.summary;
    return PageHeader({
      breadcrumbs: [
        { label: 'Visão geral', href: '#/' },
        { label: data.area.name, href: `#/area/${data.area.area_id}` },
        { label: data.table.name, href: tableHref(data.table.table_id) },
        { label: data.concept.concept_id },
      ],
      eyebrow: `${data.concept.concept_id} · ${s.code || 'sem nome canônico'}`,
      title: s.label || '(sem nome)',
      meta: [
        KindBadge(s.kind),
        ConceptStatusBadge(s.status, { pending: s.pending_status }),
        OriginBadge({ origin: data.display.origin, accepted: Boolean(data.display.proposal_accepted_by) }),
        SensitivityBadge(s.sensitivity, SENSITIVITY),
        data.published ? Badge({ label: `Publicada: revisão ${data.published.revision_number}`, tone: 'success', variant: 'outline', icon: 'book' }) : Badge({ label: 'Nunca publicada', variant: 'outline' }),
      ].filter(Boolean),
    });
  }

  function banners() {
    const out = [];
    const w = data.working;
    if (!isWorkingView() && viewing.revision_id !== data.display.revision_id) {
      out.push(Alert({
        tone: 'info',
        title: `Visualizando a revisão ${viewing.revision_number} (${REVISION_STATUS[viewing.status].label.toLowerCase()}) — somente leitura`,
        actions: [Button({ label: 'Voltar à revisão atual', size: 'sm', icon: 'undo', onClick: () => load(data) })],
      }));
    }
    if (data.concept.lifecycle === 'descartado') {
      const last = data.revisions[data.revisions.length - 1];
      out.push(Alert({ tone: 'neutral', title: 'Conceito descartado', children: [h('p', {}, `Descartado por ${formatActor(last.decided_by)} em ${formatDateTime(last.decided_at)}: ${last.decision_note ?? '—'}`)] }));
    } else if (data.concept.lifecycle === 'obsoleto') {
      const dep = data.published.content.deprecation;
      out.push(Alert({ tone: 'danger', title: 'Conceito obsoleto', children: [h('p', {}, dep?.reason ?? ''), dep?.replaced_by?.length ? h('p', {}, 'Substituído por: ', ...dep.replaced_by.map((id) => ConceptRef(byId.get(id) ?? { concept_id: id, label: '' }, { showStatus: false }))) : null] }));
    }
    if (isWorkingView() && w.origin === 'ia' && !w.proposal_accepted_by && w.status === 'rascunho') {
      out.push(Alert({
        tone: 'accent',
        title: 'Proposta gerada por IA — não é definição oficial',
        children: [h('p', {}, 'Revise o conteúdo com espírito crítico. Você pode aceitá-la como base de trabalho, editá-la livremente ou rejeitá-la. Nada é publicado sem envio para revisão e aprovação humana.')],
      }));
    }
    if (isWorkingView() && w.status === 'em_revisao') {
      out.push(Alert({ tone: 'warning', title: `Revisão ${w.revision_number} em revisão — conteúdo bloqueado`, children: [h('p', {}, `Enviada por ${formatActor(w.submitted_by)} em ${formatDateTime(w.submitted_at)}. Aprove para publicar ou devolva para rascunho com o motivo.`)] }));
    }
    if (!w && data.published && data.concept.lifecycle === 'ativo' && viewing.revision_id === data.published.revision_id) {
      out.push(Alert({ tone: 'success', title: `Definição aprovada (revisão ${data.published.revision_number})`, children: [h('p', {}, `Aprovada por ${formatActor(data.published.decided_by)} em ${formatDateTime(data.published.decided_at)}. Revisões aprovadas são imutáveis: para alterar, crie uma nova revisão.`)] }));
    }
    return out;
  }

  function actionBar() {
    const w = data.working;
    const actions = [];
    saveButton = null;
    if (isReadOnly()) {
      // Versão de leitura: só a navegação entre a revisão publicada e a revisão em curso.
      saveStatus.set('readonly', 'Somente leitura');
      if (w && !isWorkingView()) actions.push(Button({ label: `Ver a revisão em curso (${w.revision_number})`, icon: 'eye', onClick: () => load(data) }));
    } else if (editable()) {
      saveStatus.set(dirty ? 'dirty' : 'saved');
      saveButton = Button({ label: 'Salvar rascunho', icon: 'save', variant: dirty ? 'primary' : 'secondary', disabled: !dirty, onClick: () => save() });
      actions.push(saveButton, Button({ label: 'Enviar para revisão', icon: 'send', onClick: () => submit() }));
      if (w.origin === 'ia' && !w.proposal_accepted_by) actions.push(Button({ label: 'Aceitar proposta', icon: 'check', variant: 'success', onClick: () => acceptProposal() }));
      actions.push(Button({ label: w.origin === 'ia' && !w.proposal_accepted_by ? 'Rejeitar proposta' : 'Descartar', icon: 'x', variant: 'danger', onClick: () => discard() }));
    } else if (isWorkingView() && w.status === 'em_revisao') {
      saveStatus.set('readonly', 'Bloqueada para revisão');
      actions.push(
        Button({ label: 'Aprovar e publicar', icon: 'check', variant: 'success', onClick: () => approve() }),
        Button({ label: 'Devolver para rascunho', icon: 'undo', onClick: () => returnToDraft() }),
        Button({ label: 'Descartar', icon: 'x', variant: 'danger', onClick: () => discard() }),
      );
    } else {
      saveStatus.set('readonly');
      if (!w) {
        actions.push(Button({ label: data.concept.lifecycle === 'descartado' ? 'Reabrir como nova revisão' : 'Criar nova revisão', icon: 'copy', variant: 'primary', onClick: () => newRevision() }));
        if (data.published && data.concept.lifecycle === 'ativo') actions.push(Button({ label: 'Propor obsolescência', icon: 'archive', variant: 'danger', onClick: () => proposeDeprecation() }));
      } else {
        actions.push(Button({ label: `Ir para a revisão em curso (${w.revision_number})`, icon: 'edit', onClick: () => load(data) }));
      }
    }
    return h('div', { class: 'action-bar' },
      h('div', { class: 'action-bar__status' },
        RevisionStatusBadge(viewing.status),
        h('span', { class: 'text-sm' }, `Revisão ${viewing.revision_number} de ${data.revisions.length}`),
        saveStatus),
      h('div', { class: 'action-bar__actions' }, ...actions));
  }

  // ------------------------------------------------------------ painéis laterais

  function revisionInfoPanel() {
    const r = viewing;
    return Panel({
      title: 'Autoria desta revisão',
      icon: 'user',
      headingLevel: 2,
      children: [KeyValueList([
        { key: 'Revisão', value: `${r.revision_number} · ${REVISION_STATUS[r.status].label}` },
        { key: 'Origem', value: r.origin === 'ia' ? 'Proposta de IA' : 'Pessoa' },
        { key: 'Criada', value: `${formatActor(r.created_by)} · ${formatDateTime(r.created_at)}` },
        { key: 'Última alteração', value: `${formatActor(r.updated_by)} · ${formatDateTime(r.updated_at)}` },
        r.proposal_accepted_by ? { key: 'Proposta aceita', value: `${formatActor(r.proposal_accepted_by)} · ${formatDateTime(r.proposal_accepted_at)}` } : null,
        r.submitted_by ? { key: 'Enviada', value: `${formatActor(r.submitted_by)} · ${formatDateTime(r.submitted_at)}` } : null,
        r.decided_by ? { key: r.status === 'descartado' ? 'Descartada' : 'Aprovada', value: `${formatActor(r.decided_by)} · ${formatDateTime(r.decided_at)}${r.decision_note ? ` — ${r.decision_note}` : ''}` } : null,
        { key: 'Hash do conteúdo', value: r.content_hash.slice(0, 16), mono: true },
      ])],
    });
  }

  function technicalPanel() {
    const objects = (viewing.content.implementation ?? []).filter((m) => m.object);
    const yesNo = (v) => (v == null ? null : v ? 'sim' : 'não');
    const items = objects.map((m) => {
      const t = data.technical[m.object];
      if (!t) {
        return Alert({ tone: 'warning', title: m.object, children: [h('p', {}, 'Objeto não encontrado nos metadados técnicos descobertos.')] });
      }
      return h('div', { class: 'stack stack--sm' },
        h('p', { class: 'mono' }, t.object_key),
        KeyValueList([
          { key: 'Objeto', value: t.object_type },
          { key: 'Tipo físico', value: t.data_type, mono: true },
          t.allowed_values ? { key: 'Valores', value: t.allowed_values.join(', '), mono: true } : null,
          { key: 'Geração', value: t.generation },
          t.is_primary_key != null ? { key: 'Chave primária', value: yesNo(t.is_primary_key) } : null,
          t.is_unique != null ? { key: 'Único', value: yesNo(t.is_unique) } : null,
          t.nullable != null ? { key: 'Aceita nulo', value: yesNo(t.nullable) } : null,
          t.default_expression ? { key: 'Padrão', value: t.default_expression, mono: true } : null,
          { key: 'DDL', value: t.ddl_reference, mono: true },
          { key: 'Evidência', value: t.evidence },
        ]),
        t.snapshot ? h('div', { class: 'cluster' },
          Badge({ label: t.snapshot.verified ? 'Verificado no banco' : 'Não verificado no banco', tone: t.snapshot.verified ? 'success' : 'warning', icon: t.snapshot.verified ? 'check' : 'alert-triangle' }),
          h('span', { class: 'text-xs' }, t.snapshot.description)) : null);
    });
    return Panel({
      title: 'Metadados técnicos',
      subtitle: 'Descobertos automaticamente · somente leitura · armazenados em separado (tecnico.sqlite)',
      icon: 'database',
      variant: 'technical',
      headingLevel: 2,
      children: items.length ? [h('div', { class: 'stack' }, ...items)] : [h('p', { class: 'text-sm' }, 'Nenhum objeto físico vinculado nesta revisão.')],
    });
  }

  function usedByPanel() {
    if (!data.used_by.length) return null;
    return Panel({
      title: 'Usado também por',
      icon: 'grid',
      headingLevel: 2,
      subtitle: 'Tabelas que usam este conceito sem ser a sua tabela de origem.',
      children: [h('ul', { class: 'ref-list' }, ...data.used_by.map((u) => h('li', { class: 'stack stack--sm' },
        h('a', { href: tableHref(u.table_id) }, u.table_name ?? u.table_id),
        u.note ? h('span', { class: 'text-sm text-muted' }, u.note) : null)))],
    });
  }

  function duplicatesPanel() {
    if (!data.duplicates.length) return null;
    return Panel({
      title: 'Possíveis duplicidades',
      subtitle: 'Indícios para análise humana',
      icon: 'alert-triangle',
      variant: 'attention',
      headingLevel: 2,
      children: [h('ul', { class: 'ref-list' }, ...data.duplicates.map((d) => h('li', { class: 'stack stack--sm' },
        ConceptRef(d),
        h('span', { class: 'text-xs text-muted' }, d.reasons.map((r) => `${r.label}${r.note ? `: ${r.note}` : ''}`).join(' · ')))))],
    });
  }

  function incomingPanel() {
    if (!data.incoming.length) return null;
    const via = (v) => {
      if (v === 'entity') return 'tem este conceito como entidade';
      if (v === 'value_set') return 'usa este vocabulário';
      if (v === 'derived.input') return 'usa como entrada';
      if (v === 'derived.anchor_event') return 'usa como evento-âncora';
      if (v === 'deprecation.replaced_by') return 'é substituído por este conceito';
      if (v.startsWith('relation:')) return `${(RELATION_TYPES[v.slice(9)]?.label ?? v).toLowerCase()} este conceito`;
      return v;
    };
    return Panel({
      title: 'Referências recebidas',
      icon: 'link',
      headingLevel: 2,
      children: [h('ul', { class: 'ref-list' }, ...data.incoming.map((r) => h('li', { class: 'stack stack--sm' }, ConceptRef(r, { showStatus: false }), h('span', { class: 'text-xs text-muted' }, via(r.via)))))],
    });
  }

  // ------------------------------------------------------------ abas

  function definitionTab() {
    formSlot = h('div', {});
    errorSlot = h('div', { class: 'stack' });
    renderForm();
    const human = Panel({
      title: 'Definição humana',
      subtitle: editable() ? 'Rascunho editável · salvar não publica' : 'Somente leitura nesta revisão',
      icon: 'edit',
      variant: 'human',
      headingLevel: 2,
      children: [h('div', { class: 'stack' }, errorSlot, changeSummaryField(), formSlot)],
    });
    return h('div', { class: 'split' }, human, h('aside', { class: 'split__aside', 'aria-label': 'Contexto do conceito' },
      technicalPanel(), usedByPanel(), duplicatesPanel(), incomingPanel(), revisionInfoPanel()));
  }

  function versionsTab() {
    const revisions = [...data.revisions].reverse();
    const table = DataTable({
      rows: revisions,
      rowKey: (r) => r.revision_id,
      dense: true,
      columns: [
        { key: 'revision_number', label: 'Revisão', render: (r) => h('span', { class: 'mono' }, String(r.revision_number)) },
        { key: 'status', label: 'Estado', render: (r) => RevisionStatusBadge(r.status) },
        { key: 'origin', label: 'Origem', render: (r) => (r.origin === 'ia' ? OriginBadge({ origin: 'ia', accepted: Boolean(r.proposal_accepted_by) }) : 'Pessoa') },
        { key: 'created_by', label: 'Autoria', render: (r) => h('div', { class: 'cell-title' }, h('span', {}, formatActor(r.created_by)), h('span', { class: 'cell-title__sub' }, `criada ${formatDateTime(r.created_at)}`), h('span', { class: 'cell-title__sub' }, `alterada ${formatDateTime(r.updated_at)} por ${formatActor(r.updated_by)}`)) },
        { key: 'decided_by', label: 'Decisão', render: (r) => (r.decided_by ? h('div', { class: 'cell-title' }, h('span', {}, formatActor(r.decided_by)), h('span', { class: 'cell-title__sub' }, formatDateTime(r.decided_at)), r.decision_note ? h('span', { class: 'cell-title__sub' }, r.decision_note) : null) : '—') },
        { key: 'change_summary', label: 'Resumo', render: (r) => h('span', { class: 'text-sm' }, r.change_summary || '—') },
        { key: 'view', label: 'Ações', render: (r) => Button({ label: r.revision_id === viewing.revision_id ? 'Exibindo' : 'Ver', size: 'sm', icon: 'eye', disabled: r.revision_id === viewing.revision_id, onClick: () => viewRevision(r.revision_id) }) },
      ],
    });

    const options = revisions.map((r) => ({ value: String(r.revision_id), label: `Revisão ${r.revision_number} — ${REVISION_STATUS[r.status].label}` }));
    const defaultTo = data.display;
    const defaultFrom = data.published && data.published.revision_id !== defaultTo.revision_id
      ? data.published
      : data.revisions[data.revisions.findIndex((r) => r.revision_id === defaultTo.revision_id) - 1] ?? defaultTo;
    const diffSlot = h('div', {});
    const fromSelect = Select({ value: String(defaultFrom.revision_id), options, ariaLabel: 'Revisão de origem', onChange: () => updateDiff() });
    const toSelect = Select({ value: String(defaultTo.revision_id), options, ariaLabel: 'Revisão de destino', onChange: () => updateDiff() });
    function updateDiff() {
      const from = data.revisions.find((r) => String(r.revision_id) === fromSelect.value);
      const to = data.revisions.find((r) => String(r.revision_id) === toSelect.value);
      const changes = diffContents(from.content, to.content).map((c) => ({
        ...c,
        segments: c.type === 'alterado' && typeof c.before === 'string' && typeof c.after === 'string' && (c.before.length > 60 || c.after.length > 60) ? wordDiff(c.before, c.after) : null,
      }));
      diffSlot.replaceChildren(DiffView(changes, { beforeLabel: `Revisão ${from.revision_number}`, afterLabel: `Revisão ${to.revision_number}` }));
    }
    updateDiff();

    return h('div', { class: 'stack stack--lg' },
      Panel({ title: 'Revisões', icon: 'layers', flush: true, children: [table] }),
      Panel({
        title: 'Comparar versões',
        icon: 'columns',
        children: [h('div', { class: 'stack' },
          h('div', { class: 'form-grid' }, Field({ label: 'De', control: fromSelect }), Field({ label: 'Para', control: toSelect })),
          diffSlot)],
      }));
  }

  async function historyTab() {
    const events = await api.get(`/api/concepts/${encodeURIComponent(conceptId())}/history`);
    if (!events.length) return EmptyState({ title: 'Sem eventos', icon: 'clock' });
    return Panel({
      title: 'Histórico de alterações (auditoria)',
      subtitle: 'Registro somente inserção: quem fez o quê e quando.',
      icon: 'clock',
      children: [Timeline(events.map((e) => {
        const d = e.detail ?? {};
        const lines = [];
        if (d.changes?.length) lines.push(`Campos: ${[...new Set(d.changes.map((c) => c.label))].join(', ')}`);
        if (d.change_summary) lines.push(`Resumo: ${d.change_summary}`);
        if (d.note) lines.push(`Comentário: ${d.note}`);
        if (d.reason) lines.push(`Motivo: ${d.reason}`);
        if (d.self_approval) lines.push('Autoaprovação.');
        return {
          title: e.summary,
          meta: `${formatDateTime(e.occurred_at)} · ${formatActor(e.actor)} · ${e.action}`,
          body: lines.join('\n') || null,
          tone: e.action.includes('aprovada') ? 'success' : e.action.includes('rejeitada') || e.action.includes('descartada') || e.action.includes('obsoleto') ? 'danger' : e.action.includes('enviada') ? 'warning' : e.actor.startsWith('ia:') ? 'accent' : 'info',
        };
      }))],
    });
  }

  function renderAll() {
    const tabs = Tabs({
      label: 'Seções do conceito',
      active: activeTab,
      onChange: (id) => {
        activeTab = id;
        history.replaceState(null, '', `${conceptHref(conceptId())}${id === 'definicao' ? '' : `/${id}`}`);
      },
      tabs: [
        { id: 'definicao', label: 'Definição', render: () => definitionTab() },
        { id: 'versoes', label: 'Versões e comparação', count: data.revisions.length, render: () => versionsTab() },
        { id: 'historico', label: 'Histórico', render: () => historyTab() },
      ],
    });
    root.replaceChildren(header(), ...banners(), actionBar(), tabs);
  }

  return { load };
}
