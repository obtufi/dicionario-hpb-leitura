/**
 * Entrada da versão de leitura (index.html gerado por scripts/exportar-leitura.js): pede a
 * senha, abre os dados cifrados e só então carrega a aplicação (../main.js), que passa a ler
 * pela fonte da versão de leitura (./modo.js). A chave derivada fica só nesta aba
 * (sessionStorage), para recarregar a página sem pedir a senha de novo; fechar a aba a apaga.
 */
import { Alert, Button, Field, Icon, TextInput, h } from '/design-system/components.js';
import { WrongPasswordError, fromBase64, toBase64 } from './cripto.js';
import { openReadOnlySource } from './fonte.js';

const KEY_STORAGE = 'hpb.leitura.chave';
const DATA_URL = new URL('../../dados/', import.meta.url);

const mount = document.getElementById('leitura-entrada');
const app = document.getElementById('app');

function storedKey() {
  try {
    const value = sessionStorage.getItem(KEY_STORAGE);
    return value ? fromBase64(value) : null;
  } catch {
    return null;
  }
}

function storeKey(raw) {
  try {
    sessionStorage.setItem(KEY_STORAGE, toBase64(raw));
  } catch {
    // Sem armazenamento: a senha será pedida de novo ao recarregar.
  }
}

function forgetKey() {
  try {
    sessionStorage.removeItem(KEY_STORAGE);
  } catch {
    // nada a apagar
  }
}

async function start(source) {
  globalThis.HPB_LEITURA = source;
  mount.remove();
  app.hidden = false;
  await import('../main.js');
}

function renderForm() {
  const input = TextInput({ type: 'password', placeholder: 'Senha recebida com o link' });
  input.setAttribute('autocomplete', 'current-password');
  const field = Field({ label: 'Senha', control: input, required: true, hint: 'Peça a senha a quem lhe enviou o link.' });
  const status = h('p', { class: 'leitura-entrada__status', role: 'status' });
  const problem = h('div', {});
  const submit = Button({ label: 'Abrir o dicionário', icon: 'lock', variant: 'primary', type: 'submit' });

  const form = h('form', {
    class: 'stack',
    novalidate: true,
    onSubmit: async (event) => {
      event.preventDefault();
      field.setError(null);
      problem.replaceChildren();
      if (!input.value) {
        field.setError('Digite a senha.');
        input.focus();
        return;
      }
      submit.disabled = true;
      status.textContent = 'Abrindo os dados…';
      try {
        const source = await openReadOnlySource({ baseUrl: DATA_URL, password: input.value });
        storeKey(source.rawKey);
        await start(source);
      } catch (error) {
        submit.disabled = false;
        status.textContent = '';
        if (error instanceof WrongPasswordError) {
          field.setError('Senha incorreta. Confira e tente de novo.');
          input.select();
          input.focus();
        } else {
          problem.replaceChildren(Alert({ tone: 'danger', title: 'Não foi possível abrir o dicionário', children: [h('p', {}, error.message)], role: 'alert' }));
        }
      }
    },
  }, field, h('div', { class: 'cluster' }, submit), status, problem);

  mount.replaceChildren(h('main', { class: 'leitura-entrada' },
    h('div', { class: 'leitura-entrada__card stack' },
      h('p', { class: 'leitura-entrada__eyebrow' }, Icon('book', { size: 'sm' }), 'Registro HPB · Santa Casa de São Paulo'),
      h('h1', { class: 'leitura-entrada__title' }, 'Dicionário semântico'),
      h('p', { class: 'leitura-entrada__lead' }, 'Versão somente leitura: consulte áreas, tabelas, conceitos, o dicionário publicado, o mapa do dicionário e o mapa mental. Nada pode ser alterado aqui.'),
      form)));
  input.focus();
}

const raw = storedKey();
if (raw) {
  try {
    await start(await openReadOnlySource({ baseUrl: DATA_URL, rawKey: raw }));
  } catch {
    forgetKey();
    renderForm();
  }
} else {
  renderForm();
}
