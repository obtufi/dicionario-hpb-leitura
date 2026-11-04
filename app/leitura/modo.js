/**
 * Versão somente leitura: a aplicação aberta a partir da exportação estática protegida por senha
 * (scripts/exportar-leitura.js e ./entrada.js). Nela, a fonte de dados (./fonte.js) fica em
 * globalThis.HPB_LEITURA, nada é gravado e as telas escondem as ações de edição.
 */

export const readOnlySource = () => globalThis.HPB_LEITURA ?? null;
export const isReadOnly = () => Boolean(globalThis.HPB_LEITURA);

/** Telas de trabalho que a versão de leitura não traz: auditoria geral e catálogo do Design System. */
const EXCLUDED = [/^\/auditoria$/, /^\/design-system$/];

export const isExcludedInReadOnly = (path) => isReadOnly() && EXCLUDED.some((pattern) => pattern.test(path));
