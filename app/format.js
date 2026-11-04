/**
 * Formatação de valores para exibição (datas, autores, números).
 * Rótulos de vocabulários vêm de /shared/semantic-model.js.
 */
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' });
const number = new Intl.NumberFormat('pt-BR');

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateTime.format(d);
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : dateOnly.format(d);
}

export function formatNumber(n) {
  return number.format(n ?? 0);
}

export function formatPercent(part, total) {
  if (!total) return '0%';
  const pct = (part / total) * 100;
  return `${pct < 1 && pct > 0 ? pct.toFixed(2).replace('.', ',') : Math.round(pct)}%`;
}

/** Autor legível: propostas de IA e processos do sistema são identificados como tal. */
export function formatActor(actor) {
  if (!actor) return '—';
  if (actor.startsWith('ia:')) return 'IA (proposta automática)';
  if (actor.startsWith('sistema:')) return 'Sistema (carga inicial)';
  return actor;
}

export function plural(n, singular, pluralForm) {
  return `${formatNumber(n)} ${n === 1 ? singular : pluralForm}`;
}
