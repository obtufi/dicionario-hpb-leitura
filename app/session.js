/**
 * Identidade de quem edita (autoria). Não é autenticação: a aplicação é
 * local e o nome é gravado em cada revisão, decisão e evento de auditoria.
 * O localStorage guarda apenas essa conveniência; nenhum dado do dicionário.
 */
const KEY = 'hpb.dicionario.autor';
const listeners = new Set();

function read() {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

let current = read();

export const session = {
  actor: () => current,
  setActor(name) {
    current = String(name ?? '').trim();
    try {
      localStorage.setItem(KEY, current);
    } catch {
      // armazenamento indisponível: a identidade vale só para esta aba
    }
    for (const fn of listeners) fn(current);
  },
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

/** Nomes reservados para propostas automáticas e processos do sistema. */
export function isReservedActor(name) {
  const n = String(name ?? '').trim().toLowerCase();
  return n.startsWith('ia:') || n.startsWith('sistema:');
}
