// UM COMBO DE R$ 299,99 FECHOU COMANDA EM R$ 32.998,90.
//
// O print dela: Mesa 1, "1 item · R$ 32.998,90". Um item só.
//
// A CONTA QUE DENUNCIA:
//
//     32.998,90 ÷ 1,10 (taxa de serviço) = 29.999,00 = "299.99" sem o ponto
//
// O preço do combo estava guardado como "299.99" — do teclado do iPad, que só
// tem ponto. A TELA lia certo: `num` entende ponto com duas casas como
// decimal, e mostrava R$ 299,99 na lista. O SERVIDOR lia com uma régua
// própria, escrita à mão, que apagava TODO ponto antes de ler — e via 29999.
//
// Duas réguas pro mesmo preço, uma em cada ponta do mesmo toque. O garçom via
// trezentos reais, tocava, e a conta da mesa virava trinta mil.
//
// O QUE ESTE TESTE GUARDA:
//
//   - preço com PONTO (299.99) vale o mesmo que com VÍRGULA (299,99);
//   - o que a tela mostra é o que a comanda cobra — a mesma régua nas duas
//     pontas, que é a única garantia que não depende de eu lembrar;
//   - e milhar de verdade continua milhar: "1.500" é mil e quinhentos, não
//     um e meio. Consertar pro lado errado trocaria um erro de 100× por outro.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
const por = (chave, valor) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}${chave}`, valor }]) });
const limpa = (s) => String(s || '').replace(/ /g, ' ');

// Os quatro combos do print, com o preço guardado do jeito que o iPad deixa.
const p0 = await painel();
await gravar({ ...p0,
  estoque: [], fichas: [], compras: [], receitas: [], despesas: [], diario: [],
  cardapio: [
    // PONTO como decimal — o caso dela.
    { id: 'k1', nome: '00 da Favela', categoria: 'Combos', preco: '299.99', ativo: true },
    // VÍRGULA — o mesmo preço escrito do outro jeito. Tem que dar igual.
    { id: 'k2', nome: 'Gin Lovers', categoria: 'Combos', preco: '299,99', ativo: true },
    // MILHAR DE VERDADE: "1.500" é mil e quinhentos. Consertar pro lado errado
    // faria virar R$ 1,50 — um erro de 100× trocado por outro.
    { id: 'k3', nome: 'Balde da Casa', categoria: 'Combos', preco: '1.500', ativo: true },
  ],
});
await por('comanda:m1', { id: 'm1', mesa: '1', status: 'aberta', pessoas: 2, itens: [], abertaEm: new Date().toISOString() });

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, serviceWorkers: 'block' });
const pg = await ctx.newPage();
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
pg.on('console', (m) => { const x = m.text(); if (m.type() === 'error' && !/status of 40/.test(x)) { console.log('[console]', x.slice(0, 160)); ruim++; } });

await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1600);
await pg.locator('button:text-is("Dona")').first().click();
await pg.locator('input[type="password"]').first().fill('Teste@123');
await pg.locator('button:has-text("Entrar")').first().click();
await pg.waitForTimeout(3800);

const texto = async () => limpa(await pg.locator('body').innerText());
const irPara = async (rot) => {
  const achou = await pg.evaluate((r) => {
    const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === r);
    if (x) { x.click(); return true; }
    return false;
  }, rot);
  await pg.waitForTimeout(1600);
  cobra(`achou o caminho "${rot}"`, achou);
};
// Manda o pedido pelo mesmo caminho que o toque do garçom usa.
const adicionar = async (cardapioId) => {
  const r = await pg.evaluate(async (id) => {
    const res = await fetch('/api/comandas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'add', comandaId: 'm1', cardapioId: id }),
    });
    return { ok: res.ok, corpo: await res.json().catch(() => ({})) };
  }, cardapioId);
  await pg.waitForTimeout(700);
  return r;
};
const comanda = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}comanda:m1`)).json())[0]?.valor || {};
const limparItens = async () => { const c = await comanda(); await por('comanda:m1', { ...c, itens: [] }); };

await irPara('Central de Operações');
await irPara('Comandas');
await pg.waitForTimeout(900);

let txt = await texto();

console.log('\n### PREÇO COM PONTO: 299.99 vale R$ 299,99, não R$ 29.999,00');
await limparItens();
cobra('o garçom tocou no combo', (await adicionar('k1')).ok);
let c = await comanda();
let item = (c.itens || [])[0];
cobra('entrou um item só', (c.itens || []).length === 1, JSON.stringify((c.itens || []).map((i) => i.preco)));
cobra('ao preço de R$ 299,99', item && Math.abs(Number(item.preco) - 299.99) < 0.005, JSON.stringify(item && { preco: item.preco }));
cobra('e NÃO R$ 29.999,00 (o ponto apagado)', item && Number(item.preco) !== 29999, JSON.stringify(item && { preco: item.preco }));

console.log('\n### COM VÍRGULA DÁ EXATAMENTE O MESMO');
// A mesma régua nas duas escritas é a única garantia que não depende de eu
// lembrar qual tela grava com ponto e qual grava com vírgula.
await limparItens();
await adicionar('k2');
c = await comanda();
item = (c.itens || [])[0];
cobra('R$ 299,99 também pela vírgula', item && Math.abs(Number(item.preco) - 299.99) < 0.005, JSON.stringify(item && { preco: item.preco }));

console.log('\n### E MILHAR DE VERDADE CONTINUA MILHAR');
// Consertar pro lado errado trocaria um erro de 100× por outro: "1.500"
// viraria R$ 1,50 e o balde sairia de graça.
await limparItens();
await adicionar('k3');
c = await comanda();
item = (c.itens || [])[0];
cobra('"1.500" vale R$ 1.500,00', item && Math.abs(Number(item.preco) - 1500) < 0.005, JSON.stringify(item && { preco: item.preco }));
cobra('e não R$ 1,50', item && Number(item.preco) !== 1.5);

console.log('\n### A CONTA DA MESA FECHA NO VALOR CERTO');
// Era aqui que ela via o estrago: "1 item · R$ 32.998,90".
await limparItens();
await adicionar('k1');
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3600);
await irPara('Central de Operações');
await irPara('Comandas');
await pg.waitForTimeout(1200);
txt = await texto();
cobra('não aparece R$ 32.998,90 em lugar nenhum', !/32\.998,90/.test(txt), (txt.match(/[^\n]*32\.998[^\n]*/) || [''])[0]);
cobra('nem R$ 29.999,00', !/29\.999,00/.test(txt));
// 299,99 + 10% de serviço = R$ 329,99
cobra('a conta fecha em R$ 329,99 (com os 10%)', /R\$ 329,99/.test(txt), (txt.match(/[^\n]*329,99[^\n]*/) || ['(não achou o total)'])[0]);

console.log('\n### E A LISTA DE PRODUTOS MOSTRA O MESMO PREÇO QUE COBRA');
// Era o que ela lia antes de tocar: "R$ 299,99" na lista. Com as duas pontas
// lendo pelo mesmo `num`, o que está escrito é o que entra na conta.
const abriu = await pg.evaluate(() => {
  const mesa = [...document.querySelectorAll('button')].find((e) => /^ocupada/i.test((e.innerText || '').trim()));
  if (mesa) { mesa.click(); return true; }
  return false;
});
cobra('abriu a Mesa 1', abriu);
await pg.waitForTimeout(1400);
const abriuPicker = await pg.evaluate(() => {
  const b2 = [...document.querySelectorAll('button')].find((e) => /Adicionar produtos/.test(e.innerText || ''));
  if (b2) { b2.click(); return true; }
  return false;
});
cobra('abriu a lista de produtos', abriuPicker);
await pg.waitForTimeout(1400);
await pg.evaluate(() => {
  const cat = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === 'Combos');
  if (cat) cat.click();
});
await pg.waitForTimeout(1000);
txt = await texto();
cobra('a lista mostra R$ 299,99', /R\$ 299,99/.test(txt), (txt.match(/[^\n]*299,99[^\n]*/) || ['(não mostra)'])[0]);
cobra('e não R$ 29.999,00', !/29\.999,00/.test(txt));

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
