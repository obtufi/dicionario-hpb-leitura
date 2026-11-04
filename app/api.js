/**
 * Cliente da API do dicionário. Toda escrita leva a autoria (X-HPB-Actor). Na versão somente
 * leitura (./leitura/modo.js), as leituras vêm dos dados exportados e nenhuma escrita é aceita.
 */
import { readOnlySource } from './leitura/modo.js';
import { session } from './session.js';

export class ApiError extends Error {
  constructor(status, payload) {
    super(payload?.error?.message ?? `Erro ${status}`);
    this.status = status;
    this.code = payload?.error?.code ?? 'erro';
    this.details = payload?.error?.details ?? null;
  }
}

async function request(method, path, body) {
  const source = readOnlySource();
  if (source) {
    if (method !== 'GET') throw new ApiError(403, { error: { code: 'somente_leitura', message: 'Esta é uma versão somente leitura do dicionário: nada pode ser alterado aqui.' } });
    try {
      return await source.get(path);
    } catch (error) {
      throw new ApiError(error.status ?? 500, { error: { code: error.code ?? 'erro', message: error.message } });
    }
  }
  const headers = { Accept: 'application/json' };
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    const actor = session.actor();
    if (actor) headers['X-HPB-Actor'] = encodeURIComponent(actor);
  }
  let response;
  try {
    response = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, { error: { code: 'sem_conexao', message: 'Não foi possível contatar o servidor. Verifique se a aplicação está em execução.' } });
  }
  const isJson = response.headers.get('Content-Type')?.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();
  if (!response.ok) throw new ApiError(response.status, isJson ? payload : { error: { message: String(payload) } });
  return payload;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body = {}) => request('POST', path, body),
  put: (path, body = {}) => request('PUT', path, body),
};
