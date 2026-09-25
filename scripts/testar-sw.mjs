// Confere o public/sw.js sozinho, sem navegador: o que ele responde quando a
// rede falha. Roda com `node scripts/testar-sw.mjs` e não precisa de nada
// instalado.
//
// POR QUE ISTO EXISTE.
//
// O sw.js é o programinha que guarda o app no aparelho — é ele que faz o PicoOS
// abrir rápido e aguentar internet ruim. E ele tinha um defeito caro: quando
// QUALQUER coisa faltava, ele devolvia `caches.match('/')`, ou seja, a PÁGINA.
// Um pedaço do programa (/_next/static/...js) que não chegasse recebia HTML de
// volta, onde o navegador esperava JavaScript — e o app inteiro caía com
// "Application error: a client-side exception has occurred".
//
// O defeito não aparece em nenhum teste de tela: só aparece com a rede caindo no
// momento exato em que falta um arquivo. Então ele tem teste próprio, aqui.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const codigo = fs.readFileSync(path.join(raiz, 'public', 'sw.js'), 'utf8');

let ruim = 0;
const cobra = (r, ok) => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}`); };

// Um cache de mentira com só a página guardada dentro.
const GUARDADO = new Map([['http://app/', { corpo: '<!DOCTYPE html>', tipo: 'text/html' }]]);
const caches = {
  open: async () => ({ put: async () => {} }),
  keys: async () => ['picoos-v4'],
  delete: async () => true,
  match: async (req) => {
    const url = typeof req === 'string' ? new URL(req, 'http://app/').href : req.url;
    return GUARDADO.get(url) || undefined;
  },
};

const ouvintes = {};
const self = {
  addEventListener: (n, f) => { ouvintes[n] = f; },
  skipWaiting: () => {},
  clients: { claim: () => {} },
  location: { origin: 'http://app' },
  registration: {},
};

const ERRO_DE_REDE = { __erroDeRede: true };
const ctx = {
  self, caches, console, URL, Promise, Map, Set, setTimeout,
  Response: { error: () => ERRO_DE_REDE },
  fetch: async () => { throw new Error('rede caiu'); }, // sempre offline
};
vm.createContext(ctx);
vm.runInContext(codigo, ctx);

async function pedir(url, extra = {}) {
  let resposta;
  const ev = {
    request: { url, method: 'GET', mode: 'no-cors', destination: 'script', ...extra },
    respondWith: (p) => { resposta = p; },
  };
  ouvintes.fetch(ev);
  return resposta === undefined ? 'nao interveio' : await resposta;
}

console.log('\n### o que o service worker responde com a rede caida');

const pedaco = await pedir('http://app/_next/static/chunks/pedaco-novo.js');
cobra('pedaco do app que falta NAO recebe a pagina HTML', pedaco !== 'nao interveio' && pedaco?.tipo !== 'text/html');
cobra('pedaco do app que falta recebe erro de rede honesto', pedaco === ERRO_DE_REDE);

const pagina = await pedir('http://app/outra-tela', { mode: 'navigate', destination: 'document' });
cobra('abrir o app sem internet ainda serve a pagina guardada', !!pagina && pagina.tipo === 'text/html');

const dados = await pedir('http://app/api/estoque', { destination: '' });
cobra('chamada de dados (/api/) segue direto pra rede, sem cache', dados === 'nao interveio');

const defora = await pedir('https://outro-site/coisa.js');
cobra('recurso de fora nao e mexido', defora === 'nao interveio');

console.log(ruim === 0 ? '\nTUDO OK\n' : `\n${ruim} COISA(S) RUIM(NS)\n`);
process.exit(ruim === 0 ? 0 : 1);
