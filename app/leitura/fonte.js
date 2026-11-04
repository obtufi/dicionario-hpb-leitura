/**
 * Fonte de dados da versão de leitura: responde aos mesmos caminhos GET da API a partir dos
 * arquivos cifrados de scripts/exportar-leitura.js. O arquivo base (navegação, visão geral,
 * áreas, tabelas) abre junto com a senha; os grandes (conceitos das tabelas, dicionário
 * publicado, grafo, índice de busca e fichas de conceito, 100 por arquivo) só quando uma tela
 * pede. Cada resposta é uma cópia, como numa chamada à API.
 */
import { decryptJson, deriveKey, exportKey, fromBase64, importKey } from './cripto.js';

export const DATA_FILES = Object.freeze({
  header: 'chave.json',
  base: 'base.bin',
  tables: 'tabelas.bin',
  published: 'publicado.bin',
  graph: 'grafo.bin',
  search: 'busca.bin',
  map: 'mapa.bin',
  mapSearch: 'mapa-busca.bin',
  trace: 'rastreabilidade.bin',
});
export const CONCEPTS_PER_FILE = 100;

/** Arquivo do grupo do conceito: HPB-04367 → conceitos/043.bin (100 conceitos por arquivo). */
export function conceptFile(conceptId) {
  const match = /^HPB-(\d+)$/.exec(String(conceptId));
  if (!match) return null;
  return `conceitos/${String(Math.floor(Number(match[1]) / CONCEPTS_PER_FILE)).padStart(3, '0')}.bin`;
}

export class SourceError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const notFound = (what) => new SourceError(404, 'nao_encontrado', `${what} não está nesta versão de leitura.`);

/** Mesma normalização da busca da API (sem acentos, minúsculas). */
export const normalizeText = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Busca da versão de leitura, com a regra de /api/search: o trecho procurado no texto normalizado. */
export function searchIndex(index, query) {
  const needle = normalizeText(query).trim();
  if (needle.length < 2) return { query, concepts: [], tables: [] };
  return {
    query,
    concepts: index.concepts.filter((c) => c.text.includes(needle)).map((c) => structuredClone(c.hit)),
    tables: index.tables.filter((t) => t.text.includes(needle)).map((t) => structuredClone(t.hit)),
  };
}

/**
 * Índice da busca do mapa do dicionário, a partir de searchData() do leitor do mapa
 * (server/domain/map.js), com os mesmos textos e a mesma ordem da busca do servidor.
 * Os textos usam interpolação como lá (um campo ausente vira "undefined" nos dois lados).
 */
export function buildMapSearchIndex({ tables, vocabularios, vocabUse }) {
  return {
    tables: tables.map((t) => ({
      text: normalizeText(`${t.tabela} ${t.nome} ${t.descricao} ${t.grao}`),
      hit: { tabela: t.tabela, nome: t.nome, tipo: t.tipo, grao: t.grao },
      concepts: t.conceitos.filter((cc) => !cc.reutiliza).map((cc) => ({
        text: normalizeText(`${cc.conceito} ${cc.rotulo} ${cc.definicao}`),
        hit: { tabela: t.tabela, conceito: cc.conceito, rotulo: cc.rotulo, natureza: cc.natureza, tipo_valor: cc.tipo_valor },
      })),
      entries: (t.catalogo?.entradas ?? []).map((e) => ({
        text: normalizeText(`${e.codigo} ${e.rotulo} ${e.loinc}`),
        hit: { tabela: t.tabela, codigo: e.codigo, rotulo: e.rotulo, unidade: e.unidade, loinc: e.loinc },
      })),
    })),
    vocabularies: vocabularios.map((v) => ({
      text: normalizeText(`${v.vocabulario} ${v.rotulo} ${v.codigos.map((x) => x.rotulo).join(' ')}`),
      hit: { vocabulario: v.vocabulario, rotulo: v.rotulo, tipo: v.tipo, codigos: v.codigos.length, listas_originais: v.listas_originais, usado_por: (vocabUse[v.vocabulario] ?? []).length },
    })),
  };
}

/** Busca do mapa com a regra de /api/mapa/busca: tabelas, conceitos (até 300), entradas (até 200) e vocabulários (até 100). */
export function searchMapIndex(index, query) {
  const q = normalizeText(query).trim();
  if (q.length < 2) return { query, tabelas: [], conceitos: [], entradas: [], vocabularios: [] };
  const tabelas = [];
  const conceitos = [];
  const entradas = [];
  for (const t of index.tables) {
    if (t.text.includes(q)) tabelas.push(structuredClone(t.hit));
    for (const c of t.concepts) if (c.text.includes(q)) conceitos.push(structuredClone(c.hit));
    for (const e of t.entries) if (entradas.length < 200 && e.text.includes(q)) entradas.push(structuredClone(e.hit));
  }
  // Como no servidor, o filtro dos vocabulários usa o texto sem aparar as pontas.
  const vq = normalizeText(query);
  const vocabularios = index.vocabularies.filter((v) => !vq || v.text.includes(vq)).slice(0, 100).map((v) => structuredClone(v.hit));
  return { query, tabelas, conceitos: conceitos.slice(0, 300), entradas, vocabularios };
}

/**
 * Busca de arquivo de dados sempre conferida com o servidor (cache: 'no-cache'): depois de uma
 * nova publicação (senha nova, dados novos), o navegador não mistura arquivos guardados da
 * versão anterior com os novos, o que faria a senha certa parecer errada. Sem mudança, o
 * servidor responde 304 e o arquivo guardado é reaproveitado.
 */
const freshFetch = (url) => globalThis.fetch(url, { cache: 'no-cache' });

/**
 * Abre a versão de leitura com a senha (ou com a chave já derivada nesta aba). Senha errada →
 * WrongPasswordError (de ./cripto.js) ao abrir o arquivo base.
 */
export async function openReadOnlySource({ baseUrl, password = null, rawKey = null, fetchImpl = freshFetch }) {
  const fetchBytes = async (name) => {
    let response;
    try {
      response = await fetchImpl(new URL(name, baseUrl));
    } catch {
      throw new SourceError(0, 'sem_conexao', 'Não foi possível baixar os dados. Verifique a conexão e tente de novo.');
    }
    if (!response.ok) throw new SourceError(response.status === 404 ? 404 : 502, 'arquivo_indisponivel', `Arquivo de dados indisponível: ${name}.`);
    return new Uint8Array(await response.arrayBuffer());
  };

  const header = JSON.parse(new TextDecoder().decode(await fetchBytes(DATA_FILES.header)));
  const key = rawKey ? await importKey(rawKey) : await deriveKey(password, fromBase64(header.sal), header.iteracoes);
  const base = await decryptJson(key, await fetchBytes(DATA_FILES.base));

  const opened = new Map();
  const open = (name) => {
    if (!opened.has(name)) {
      opened.set(name, fetchBytes(name).then((bytes) => decryptJson(key, bytes)).catch((error) => {
        opened.delete(name);
        throw error;
      }));
    }
    return opened.get(name);
  };

  async function conceptEntry(conceptId) {
    const file = conceptFile(conceptId);
    if (!file || !base.grupos_de_conceitos.includes(file)) throw notFound(`O conceito ${conceptId}`);
    const entry = (await open(file))[conceptId];
    if (!entry) throw notFound(`O conceito ${conceptId}`);
    return entry;
  }

  async function get(path) {
    const [pathname, queryString = ''] = String(path).split('?');
    if (pathname === '/api/search') return searchIndex(await open(DATA_FILES.search), new URLSearchParams(queryString).get('q') ?? '');
    if (pathname === '/api/mapa/busca') return searchMapIndex(await open(DATA_FILES.mapSearch), new URLSearchParams(queryString).get('q') ?? '');
    if (pathname === '/api/mapa/rastreabilidade.csv') return (await open(DATA_FILES.trace)).csv;
    if (pathname.startsWith('/api/mapa/')) {
      const map = await open(DATA_FILES.map);
      if (Object.hasOwn(map, path)) return structuredClone(map[path]);
      throw notFound(`O conteúdo pedido do mapa (${pathname})`);
    }
    if (pathname === '/api/published') return structuredClone(await open(DATA_FILES.published));
    if (pathname === '/api/grafo') return structuredClone(await open(DATA_FILES.graph));
    const concept = /^\/api\/concepts\/([^/]+)(\/history)?$/.exec(pathname);
    if (concept) {
      const entry = await conceptEntry(decodeURIComponent(concept[1]));
      return structuredClone(concept[2] ? entry.history : entry.detail);
    }
    if (/^\/api\/tables\/[^/]+\/concepts$/.test(pathname)) {
      const tables = await open(DATA_FILES.tables);
      if (Object.hasOwn(tables, path)) return structuredClone(tables[path]);
      throw notFound('Esta lista de conceitos');
    }
    if (Object.hasOwn(base.paths, path)) return structuredClone(base.paths[path]);
    throw notFound(`O conteúdo pedido (${pathname})`);
  }

  return {
    get,
    /** Data e hora em que a versão de leitura foi gerada (ISO). */
    generatedAt: base.gerado_em,
    /** Chave derivada, para a aba reabrir sem pedir a senha de novo. */
    rawKey: await exportKey(key),
  };
}
