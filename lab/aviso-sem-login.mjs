// "ANTES DE PÔR O MEU LOGIN JÁ CHEGA AS NOTIFICAÇÕES DO MEU LOGIN."
//
// "Fui abrir o sistema no notebook do bar, onde todo mundo acessa, aí antes de
// pôr o meu login já chega as notificações do meu login, como o que tenho na
// agenda, ou como foi o caixa de ontem."
//
// Ela estava certa, e isto era grave. O aviso não é da PESSOA, é do APARELHO:
// quem liga as notificações num navegador faz o servidor passar a mandar pra
// aquele navegador — e continuava mandando depois que a pessoa saía. No celular
// dela está certo, o aparelho é dela. No notebook do balcão, que passa de mão
// em mão, virava a agenda dela e o caixa de ontem piscando pra quem chegasse,
// antes de qualquer senha.
//
// Tudo aqui é HTTP puro: o que se mede é quem está na lista de quem recebe.
const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
const SENHA = 'Teste@123';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };

const inscricoes = async () => {
  const r = await fetch(`${BANCO}?select=chave&chave=like.${MARCA}push:*`);
  return (await r.json()).map((x) => x.chave);
};

// Uma inscrição como o app grava, com a mesma chave que o servidor calcula.
const FALSA = { endpoint: 'https://exemplo.push/aparelho-do-balcao', keys: { p256dh: 'x', auth: 'y' } };
let h = 0; for (let i = 0; i < FALSA.endpoint.length; i++) h = (h * 31 + FALSA.endpoint.charCodeAt(i)) | 0;
const CHAVE = `push:${(h >>> 0).toString(36)}-${FALSA.endpoint.length.toString(36)}`;
const inscrever = () => fetch(BANCO, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify([{ chave: `${MARCA}${CHAVE}`, valor: { sub: FALSA, apelido: 'Notebook do bar', papel: 'dona' } }]),
});

const entrar = async () => {
  const r = await fetch(`${BASE}/api/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senha: SENHA, papel: 'dona', lembrar: false }),
  });
  const bruto = r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie') || ''];
  return { ok: r.ok, cookie: (bruto.find((c) => c && c.startsWith('pdm_')) || '').split(';')[0] };
};

console.log('\n### o notebook do bar está inscrito pra receber avisos da dona');
await inscrever();
let lista = await inscricoes();
cobra('a inscrição está no banco', lista.some((k) => k.endsWith(CHAVE)), JSON.stringify(lista));

console.log('\n### ela sai — e o aparelho deixa de estar na lista');
const ses = await entrar();
cobra('entrou pra poder sair', ses.ok, ses.ok);
const fora = await fetch(`${BASE}/api/push`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', cookie: ses.cookie },
  body: JSON.stringify({ acao: 'desinscrever', sub: FALSA }),
});
cobra('o pedido de desinscrever foi aceito', fora.ok, fora.status);
lista = await inscricoes();
cobra('o aparelho NÃO está mais na lista de quem recebe', !lista.some((k) => k.endsWith(CHAVE)), JSON.stringify(lista));

console.log('\n### e a ORDEM importa: deslogado, não dá pra desinscrever');
// Por isso o app desinscreve ANTES de derrubar a sessão. Invertido, o pedido
// seria recusado e o notebook continuaria recebendo a agenda dela pra sempre —
// e ninguém perceberia, porque falhar em silêncio é o jeito que isso falha.
await inscrever();
const semCracha = await fetch(`${BASE}/api/push`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ acao: 'desinscrever', sub: FALSA }),
});
cobra('sem crachá é recusado', semCracha.status === 401, semCracha.status);
lista = await inscricoes();
cobra('e o aparelho continuaria na lista — é o que a ordem certa evita', lista.some((k) => k.endsWith(CHAVE)));

console.log('\n### o app chama os dois na ordem certa');
// A prova de que a ordem está no código, não só na minha cabeça.
const fs = await import('fs');
const cli = fs.readFileSync(new URL('../lib/pushClient.js', import.meta.url), 'utf8');
const corpo = cli.slice(cli.indexOf('export async function sairDeVez'));
const iDes = corpo.indexOf('desativarPush');
const iSai = corpo.indexOf("'/api/logout'");
cobra('sairDeVez existe', iDes > -1 && iSai > -1);
cobra('desinscreve ANTES de deslogar', iDes > -1 && iSai > -1 && iDes < iSai, `desativar em ${iDes}, logout em ${iSai}`);

console.log('\n### e todos os caminhos de sair passam por ela');
// Cinco telas deslogam. Se uma esquecer, o aparelho dela continua recebendo —
// e seria justamente a que ninguém testa.
const telas = ['Dashboard', 'Garcom', 'Cozinha', 'Reservas', 'SaiSozinho'];
for (const tela of telas) {
  const src = fs.readFileSync(new URL(`../components/${tela}.js`, import.meta.url), 'utf8');
  const chamaDireto = /fetch\(['"]\/api\/logout['"]/.test(src);
  cobra(`${tela}: sai por sairDeVez, não por fetch solto`, src.includes('sairDeVez') && !chamaDireto,
    chamaDireto ? 'ainda chama /api/logout direto' : '');
}

console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
