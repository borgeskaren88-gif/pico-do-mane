// "HOJE AQUI FICAMOS GRITANDO" — e depois: "FICA APARECENDO EM TODAS AS TELAS,
// MEIO CHATO."
//
// Os dois pedidos puxam pra lados opostos, e é isso que este teste guarda:
//
//   - o AVISO tem que alcançar ela em qualquer tela, senão volta o grito;
//   - o BOTÃO não tem o que fazer na tela de Marketing nem na de Pasta.
//
// Quem errar pra um lado traz o grito de volta. Quem errar pro outro faz ela
// pedir pra tirar tudo.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const gravar = (k, v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}${k}`, valor: v }]) });
const lerChave = async (k) => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}${k}`)).json())[0]?.valor ?? null;

await gravar('comanda:m9', { id: 'm9', mesa: '9', status: 'aberta', pessoas: 2, itens: [], abertaEm: new Date().toISOString() });
await gravar('prontos', []);

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 950 }, serviceWorkers: 'block' });
const pg = await ctx.newPage();
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
pg.on('console', (m) => { const x = m.text(); if (m.type() === 'error' && !/status of 40/.test(x)) { console.log('[console]', x.slice(0, 160)); ruim++; } });

const ROTULO = { dona: 'Dona', garcom: 'Atendimento', cozinha: 'Cozinha' };
const SENHA = { dona: 'Teste@123', garcom: '1234', cozinha: '1234' };
const entrar = async (papel) => {
  await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(async () => { await fetch('/api/logout', { method: 'POST' }); });
  await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1800);
  await pg.locator(`button:text-is("${ROTULO[papel]}")`).first().click();
  await pg.locator('input[type="password"]').first().fill(SENHA[papel]);
  await pg.locator('button:has-text("Entrar")').first().click();
  await pg.waitForTimeout(3500);
};
const pedir = (corpo) => pg.evaluate(async (c) => {
  const r = await fetch('/api/pronto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) });
  return { status: r.status, j: await r.json() };
}, corpo);
const temBotao = async () => (await pg.locator('button:has-text("Avisar que o pedido está pronto")').count()) > 0;
const texto = async () => (await pg.locator('body').innerText()).replace(/ /g, ' ');
const irPara = async (rot) => {
  await pg.evaluate((r) => {
    const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === r);
    if (x) x.click();
  }, rot);
  await pg.waitForTimeout(1800);
};

console.log('\n### o BOTÃO mora onde a ação acontece');
await entrar('dona');
cobra('no Hoje (onde ela cai ao entrar) o botão está lá', await temBotao());
for (const tela of ['Marketing', 'Pasta']) {
  await irPara(tela);
  cobra(`em ${tela} o botão NÃO aparece`, !(await temBotao()));
}

console.log('\n### mas o AVISO alcança ela em qualquer tela — senão volta o grito');
// Ela está no Marketing/Pasta agora, longe do botão. A tarja tem que chegar.
await pedir({ mesa: '9' });
await pg.waitForTimeout(2500);
cobra('a tarja aparece fora do Hoje', /Mesa 9 pronta/.test(await texto()), (await texto()).slice(0, 70).replace(/\n/g, ' | '));
cobra('com o botão de pegar junto', (await pg.locator('button:has-text("Peguei")').count()) > 0);

console.log('\n### "Peguei" tira de TODO MUNDO, não só da tela de quem tocou');
await pg.locator('button:has-text("Peguei")').first().click();
await pg.waitForTimeout(1500);
cobra('sumiu da tela', !/Mesa 9 pronta/.test(await texto()));
cobra('e saiu do banco', (await lerChave('prontos') || []).length === 0);

console.log('\n### na COZINHA o botão está sempre à mão — é o trabalho dela');
await entrar('cozinha');
cobra('o botão está lá', await temBotao());
const r1 = await pedir({ mesa: '9' });
cobra('e ela avisa', r1.j.ok, r1.j.erro || '');
cobra('carimbado como cozinha', r1.j.evento?.por === 'cozinha', r1.j.evento?.por);

console.log('\n### a cozinha não vê dinheiro por essa porta');
const g = await pg.evaluate(async () => (await (await fetch('/api/pronto', { cache: 'no-store' })).json()));
const cru = JSON.stringify(g);
cobra('nenhum total, preço ou nome de cliente', !/total|preco|preço|valor|fiado/i.test(cru), cru.slice(0, 110));

console.log('\n### no ATENDIMENTO o botão fica nas Comandas, não em Ponto ou Caixa');
await entrar('garcom');
await irPara('Comandas');
cobra('em Comandas o botão está lá', await temBotao());
await irPara('Ponto');
cobra('em Ponto NÃO aparece', !(await temBotao()));
// E a tarja continua alcançando, mesmo na aba errada.
cobra('mas a tarja da mesa 9 está lá', /Mesa 9 pronta/.test(await texto()));

console.log('\n### dedo duplo não toca o celular de todo mundo duas vezes');
const r2 = await pedir({ mesa: '9' });
cobra('o segundo aperto é ignorado', r2.j.repetido === true, JSON.stringify(r2.j).slice(0, 70));

console.log('\n### mesa vazia recusada, e deslogado não avisa nada');
cobra('mesa vazia', !(await pedir({ mesa: '' })).j.ok);
await pg.evaluate(async () => { await fetch('/api/logout', { method: 'POST' }); });
cobra('deslogado: 401', (await pedir({ mesa: '9' })).status === 401);

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
