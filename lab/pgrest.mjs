// Um PostgREST de mentira: guarda tudo numa memória só, fala o pedacinho do
// protocolo que o app usa (select/upsert/delete com eq e like) e conta o que
// passou por ele.
//
// Os contadores existem porque uma conta de nuvem cresce por leitura, e leitura
// que ninguém vê é a que aparece na fatura. Aqui elas aparecem.
import http from 'http';
import fs from 'fs';

const PORTA = Number(process.env.LAB_PORT || 54321);
const dados = new Map();
const saida = {};   // por consulta: quantas vezes e quantos bytes
let escritas = 0;

if (process.env.LAB_SEED && fs.existsSync(process.env.LAB_SEED)) {
  for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(process.env.LAB_SEED, 'utf8')))) dados.set(k, v);
}

const corpo = (req) => new Promise((r) => { let s = ''; req.on('data', (c) => { s += c; }); req.on('end', () => r(s)); });
// Arquivo é byte, não texto: juntar como string estraga PDF e foto.
const corpoBin = (req) => new Promise((r) => { const p = []; req.on('data', (c) => p.push(c)); req.on('end', () => r(Buffer.concat(p))); });
const baldes = new Set();
const arquivos = new Map(); // "<balde>/<caminho>" -> { bytes, tipo }
const marcar = (rotulo, bytes) => {
  const a = saida[rotulo] || { vezes: 0, bytes: 0 };
  a.vezes += 1; a.bytes += bytes; saida[rotulo] = a;
};

// `chave=eq.x` e `chave=like.pre*` — o suficiente pro que o app pede.
function filtrar(qs) {
  const f = qs.get('chave') || '';
  if (f.startsWith('eq.')) { const k = f.slice(3); return (ch) => ch === k; }
  if (f.startsWith('like.')) {
    const p = f.slice(5).replace(/[%*]$/, '');
    return (ch) => ch.startsWith(p);
  }
  return () => true;
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const responder = (obj, rotulo) => {
    const txt = JSON.stringify(obj);
    if (rotulo) marcar(rotulo, Buffer.byteLength(txt));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(txt);
  };

  // O DEPÓSITO DE ARQUIVOS DE MENTIRA.
  //
  // As fichas técnicas em PDF não cabem no painel, então elas vão pro Storage
  // do Supabase — que é outro protocolo, em outro endereço. Sem isto aqui, a
  // galeria só poderia ser testada contra a nuvem de verdade, ou seja: não
  // poderia ser testada.
  //
  // Fala o pedacinho que o app usa: criar o balde, subir, assinar link, baixar
  // pelo link e apagar. Guarda os bytes na memória, igual ao resto.
  if (u.pathname.startsWith('/storage/v1/')) {
    const resto = u.pathname.slice('/storage/v1/'.length);

    if (req.method === 'POST' && resto === 'bucket') {
      const b = JSON.parse((await corpo(req)) || '{}');
      baldes.add(b.id || b.name);
      return responder({ name: b.id || b.name });
    }

    // Assinar vários de uma vez: POST object/sign/<balde> com {paths}.
    if (req.method === 'POST' && resto.startsWith('object/sign/') && !resto.slice('object/sign/'.length).includes('/')) {
      const balde = resto.slice('object/sign/'.length);
      const b = JSON.parse((await corpo(req)) || '{}');
      const lista = (Array.isArray(b.paths) ? b.paths : []).map((p) => (
        arquivos.has(`${balde}/${p}`)
          ? { error: null, path: p, signedURL: `/object/sign/${balde}/${p}?token=lab` }
          : { error: 'not found', path: p, signedURL: null }
      ));
      return responder(lista, 'storage assinar');
    }

    // Baixar pelo link assinado.
    if (req.method === 'GET' && resto.startsWith('object/sign/')) {
      const chave = resto.slice('object/sign/'.length);
      const a = arquivos.get(chave);
      if (!a) { res.writeHead(404); return res.end('nao achou'); }
      marcar('storage baixar', a.bytes.length);
      res.writeHead(200, { 'Content-Type': a.tipo, 'Content-Length': a.bytes.length });
      return res.end(a.bytes);
    }

    if (req.method === 'POST' && resto.startsWith('object/')) {
      const chave = resto.slice('object/'.length);
      const bytes = await corpoBin(req);
      arquivos.set(chave, { bytes, tipo: req.headers['content-type'] || 'application/octet-stream' });
      escritas += 1;
      return responder({ Key: chave });
    }

    if (req.method === 'DELETE' && resto.startsWith('object/')) {
      const balde = resto.slice('object/'.length);
      const b = JSON.parse((await corpo(req)) || '{}');
      const fora = [];
      for (const p of (Array.isArray(b.prefixes) ? b.prefixes : [])) {
        if (arquivos.delete(`${balde}/${p}`)) fora.push({ name: p });
      }
      return responder(fora);
    }

    res.writeHead(404); return res.end('[]');
  }

  if (u.pathname === '/__lab/arquivos') return responder([...arquivos.keys()]);
  if (u.pathname === '/__lab/escritas') return responder({ escritas });
  if (u.pathname === '/__lab/saida') return responder(saida);
  if (u.pathname === '/__lab/zerar') { for (const k of Object.keys(saida)) delete saida[k]; escritas = 0; return responder({ ok: true }); }

  const rotulo = `${req.method} ${u.searchParams.get('chave') ? 'chave=' + u.searchParams.get('chave') : '(tudo)'}`;

  if (req.method === 'GET') {
    const passa = filtrar(u.searchParams);
    const linhas = [...dados.entries()].filter(([ch]) => passa(ch)).map(([chave, valor]) => ({ chave, valor }));
    return responder(linhas, rotulo);
  }

  if (req.method === 'POST') {
    const lista = JSON.parse((await corpo(req)) || '[]');
    for (const l of (Array.isArray(lista) ? lista : [lista])) { dados.set(l.chave, l.valor); escritas += 1; }
    return responder(lista, rotulo);
  }

  if (req.method === 'DELETE') {
    const passa = filtrar(u.searchParams);
    for (const ch of [...dados.keys()]) if (passa(ch)) dados.delete(ch);
    return responder([], rotulo);
  }

  if (req.method === 'PATCH') {
    const patch = JSON.parse((await corpo(req)) || '{}');
    const passa = filtrar(u.searchParams);
    for (const [ch, v] of dados.entries()) if (passa(ch)) { dados.set(ch, { ...v, ...patch.valor }); escritas += 1; }
    return responder([], rotulo);
  }

  res.writeHead(405); res.end();
}).listen(PORTA, () => console.log('pgrest falso em ' + PORTA));
