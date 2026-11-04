/**
 * Comparação entre revisões de um conceito (servidor e interface).
 * Listas com identidade (relações, opções, vínculos…) são comparadas por chave,
 * para que a inclusão de um item não pareça alterar todos os seguintes.
 */
import { FIELD_LABELS, stableStringify } from './semantic-model.js';

const LIST_IDENTITY = {
  synonyms: (v) => v,
  references: (v) => v,
  absence: (v) => v.state,
  relations: (v) => `${v.type}→${v.target}`,
  bindings: (v) => `${v.system}|${v.code}`,
  implementation: (v) => v.object,
  'derived.inputs': (v) => `${v.role}:${v.concept}`,
  'vocabulary.options': (v) => v.code || v.label,
  'deprecation.replaced_by': (v) => v,
};

function describe(item) {
  if (item === null || typeof item !== 'object') return item;
  return Object.entries(item)
    .filter(([, v]) => v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? stableStringify(v) : v}`)
    .join(' · ');
}

function walk(value, path, out) {
  if (path && LIST_IDENTITY[path]) {
    (Array.isArray(value) ? value : []).forEach((item, index) => {
      const key = LIST_IDENTITY[path](item) || `#${index + 1}`;
      out.set(`${path}[${key}]`, describe(item));
    });
    return;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k, out);
    return;
  }
  out.set(path, value);
}

/** Mapa caminho → valor apresentável. */
export function flattenContent(content) {
  const out = new Map();
  if (content) walk(content, '', out);
  return out;
}

const isBlank = (v) => v === undefined || v === null || v === '' || v === false || (Array.isArray(v) && v.length === 0);

export function labelForPath(path) {
  const base = path.replace(/\[[^\]]*\]$/, '');
  const item = path.match(/\[([^\]]*)\]$/)?.[1];
  const label = FIELD_LABELS[base] ?? base;
  return item ? `${label} — ${item}` : label;
}

/**
 * Diferenças entre dois conteúdos.
 * Retorna [{ path, label, type: 'adicionado'|'removido'|'alterado', before, after }].
 */
export function diffContents(before, after) {
  const a = flattenContent(before);
  const b = flattenContent(after);
  const paths = [...new Set([...a.keys(), ...b.keys()])];
  const changes = [];
  for (const path of paths) {
    const va = a.get(path);
    const vb = b.get(path);
    if (isBlank(va) && isBlank(vb)) continue;
    if (stableStringify(va ?? null) === stableStringify(vb ?? null)) continue;
    const type = isBlank(va) ? 'adicionado' : isBlank(vb) ? 'removido' : 'alterado';
    changes.push({ path, label: labelForPath(path), type, before: va ?? null, after: vb ?? null });
  }
  return changes;
}

/**
 * Diferença palavra a palavra (LCS) para textos longos.
 * Retorna [{ type: 'igual'|'inserido'|'removido', text }].
 */
export function wordDiff(before, after) {
  const a = String(before ?? '').split(/(\s+)/).filter((t) => t !== '');
  const b = String(after ?? '').split(/(\s+)/).filter((t) => t !== '');
  if (a.length * b.length > 400_000) {
    return [
      { type: 'removido', text: a.join('') },
      { type: 'inserido', text: b.join('') },
    ];
  }
  const dp = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  const push = (type, text) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push('igual', a[i]);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push('removido', a[i]);
      i += 1;
    } else {
      push('inserido', b[j]);
      j += 1;
    }
  }
  while (i < a.length) push('removido', a[i++]);
  while (j < b.length) push('inserido', b[j++]);
  return out;
}
