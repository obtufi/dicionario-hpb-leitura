/**
 * Cifra dos dados da versão de leitura (scripts/exportar-leitura.js): chave derivada da senha
 * por PBKDF2-SHA256, AES-GCM de 256 bits e compressão gzip antes de cifrar. Usa só Web Crypto
 * e CompressionStream, presentes no navegador e no Node: o que o Node gera, o navegador abre.
 * Cada arquivo cifrado: 1 byte de formato, 12 bytes de vetor de inicialização e o texto
 * cifrado com a etiqueta de autenticação (uma senha errada falha na autenticação).
 */

export const FORMAT = 1;
export const KDF_ITERATIONS = 600_000;
const IV_BYTES = 12;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class WrongPasswordError extends Error {
  constructor() {
    super('Senha incorreta.');
    this.name = 'WrongPasswordError';
  }
}

/** Chave AES-GCM derivada da senha; exportável, para a aba guardar e recarregar sem pedir de novo. */
export async function deriveKey(password, salt, iterations = KDF_ITERATIONS) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(String(password ?? '').normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

export const exportKey = async (key) => new Uint8Array(await crypto.subtle.exportKey('raw', key));
export const importKey = (raw) => crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);

async function transform(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** JSON → gzip → AES-GCM. */
export async function encryptJson(key, value) {
  const packed = await transform(encoder.encode(JSON.stringify(value)), new CompressionStream('gzip'));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, packed));
  const out = new Uint8Array(1 + IV_BYTES + sealed.length);
  out[0] = FORMAT;
  out.set(iv, 1);
  out.set(sealed, 1 + IV_BYTES);
  return out;
}

/** AES-GCM → gzip → JSON; senha (chave) errada → WrongPasswordError. */
export async function decryptJson(key, bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (data[0] !== FORMAT) throw new Error(`Formato de dados desconhecido (${data[0]}).`);
  let packed;
  try {
    packed = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.subarray(1, 1 + IV_BYTES) }, key, data.subarray(1 + IV_BYTES));
  } catch {
    throw new WrongPasswordError();
  }
  return JSON.parse(decoder.decode(await transform(new Uint8Array(packed), new DecompressionStream('gzip'))));
}

export function toBase64(bytes) {
  let text = '';
  for (const b of bytes) text += String.fromCharCode(b);
  return btoa(text);
}

export const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
