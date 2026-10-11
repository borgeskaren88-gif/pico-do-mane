// "QUERO TER A OPÇÃO DE CRIAR CATEGORIAS NO CARDÁPIO, TIPO ALMOÇO."
//
// A lista era fixa no código: pra criar "Almoço" ela teria que me pedir e
// esperar um deploy. Agora é dela.
//
// Duas coisas este teste guarda, e a segunda é a que machuca se quebrar:
//
//   - criar, ordenar e apagar funciona, e a ordem vira a ordem das abas do
//     garçom (pôr "Almoço" na frente no dia do almoço é a diferença entre
//     achar e procurar);
//   - APAGAR CATEGORIA NÃO PODE SUMIR COM ITEM. Item sem aba fica no banco e
//     invisível na tela — pior que um erro, é um sumiço.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });

// Um cardápio com item em duas categorias de fábrica.
const p0 = await painel();
await gravar({ ...p0, cardapioCategorias: undefined, cardapio: [
  { id: 'c1', nome: 'Long neck', categoria: 'Chopp / Cerveja', preco: '10,00', ativo: true },
  { id: 'c2', nome: 'Caipirinha', categoria: 'Drinks / Doses', preco: '18,00', ativo: true },
] });

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 950 }, serviceWorkers: 'block' });
const pg = await ctx.newPage();
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
pg.on('console', (m) => { const x = m.text(); if (m.type() === 'error' && !/status of 40/.test(x)) { console.log('[console]', x.slice(0, 160)); ruim++; } });

const entrar = async (papel, senha) => {
  await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(async () => { await fetch('/api/logout', { method: 'POST' }); });
  await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1800);
  await pg.locator(`button:text-is("${papel}")`).first().click();
  await pg.locator('input[type="password"]').first().fill(senha);
  await pg.locator('button:has-text("Entrar")').first().click();
  await pg.waitForTimeout(3500);
};
const texto = async () => (await pg.locator('body').innerText()).replace(/ /g, ' ');
const irPara = async (rot) => {
  const achou = await pg.evaluate((r) => {
    const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === r);
    if (x) { x.click(); return true; }
    return false;
  }, rot);
  await pg.waitForTimeout(1600);
  cobra(`achou o caminho "${rot}"`, achou);
};

// MEXE NUMA LINHA DE CATEGORIA PELO NOME, não pela posição.
//
// A primeira versão deste teste procurava "a div cujo primeiro filho começa com
// o nome" — e o primeiro filho do CONTÊINER também começa com o nome da
// primeira categoria. O teste clicava no botão certo por sorte. Aqui a âncora é
// o rótulo da própria linha ("Almoço · 0 itens"), que só existe uma vez.
const tocarNaLinha = (nome, rotulo) => pg.evaluate(([n, r]) => {
  const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // "1 item" e "2 itens". Escrevi `iten?s?` na primeira versão e ele não casava
  // com "item" — o teste reprovava o app por não achar um botão que existia.
  const re = new RegExp(`^${esc} · \\d+ (item|itens)$`);
  const sp = [...document.querySelectorAll('span')].find((s) => re.test((s.textContent || '').replace(/ /g, ' ').trim()));
  if (!sp) return 'sem-linha';
  const b = [...sp.parentElement.querySelectorAll('button')].find((x) => x.textContent.trim() === r);
  if (!b) return 'sem-botao';
  if (b.disabled) return 'desabilitado';
  b.click();
  return 'ok';
}, [nome, rotulo]);

console.log('\n### a dona abre o Cardápio e vê as categorias');
await entrar('Dona', 'Teste@123');
await irPara('Central de Operações');
await irPara('Cardápio');
await pg.locator('button:has-text("Categorias do cardápio")').first().click();
await pg.waitForTimeout(900);
let txt = await texto();
cobra('o painel de categorias abre', /Categorias do cardápio/.test(txt));
cobra('mostra quantos itens cada uma tem', /Chopp \/ Cerveja[^\n]*1 item/.test(txt), (txt.match(/Chopp[^\n]*/) || [''])[0]);

console.log('\n### ela cria "Almoço"');
await pg.locator('input[placeholder="Ex.: Almoço"]').first().fill('Almoço');
await pg.locator('button:has-text("Criar")').first().click();
await pg.waitForTimeout(1800);
let cats = (await painel()).cardapioCategorias;
cobra('ficou guardada no banco', Array.isArray(cats) && cats.includes('Almoço'), JSON.stringify(cats));
cobra('e aparece na lista', /Almoço/.test(await texto()));

console.log('\n### e ela pode escolher "Almoço" ao cadastrar um item');
const opcoes = await pg.evaluate(() => {
  const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /Chopp/.test(o.textContent)));
  return s ? [...s.options].map((o) => o.textContent.trim()) : [];
});
cobra('está no seletor de categoria', opcoes.includes('Almoço'), JSON.stringify(opcoes.slice(-3)));

console.log('\n### "almoco" sem acento não cria uma segunda');
// Duas abas iguais na tela do garçom é o tipo de coisa que ninguém entende.
await pg.locator('input[placeholder="Ex.: Almoço"]').first().fill('almoco');
await pg.locator('button:has-text("Criar")').first().click();
await pg.waitForTimeout(1200);
cobra('avisa que já existe', /já existe/i.test(await texto()), (await texto()).match(/[^\n]*já existe[^\n]*/)?.[0] || '(não avisou)');
cats = (await painel()).cardapioCategorias;
cobra('e não duplicou', cats.filter((c) => /almo/i.test(c)).length === 1, JSON.stringify(cats.filter((c) => /almo/i.test(c))));

console.log('\n### APAGAR categoria com item dentro é barrado');
// Item sem aba fica no banco e invisível na tela. Sumiço é pior que erro.
const antes = JSON.stringify((await painel()).cardapioCategorias);
cobra('achou o × da Chopp / Cerveja', (await tocarNaLinha('Chopp / Cerveja', '×')) === 'ok');
await pg.waitForTimeout(1200);
txt = await texto();
cobra('avisa que tem item dentro', /tem 1 item/i.test(txt), (txt.match(/[^\n]*tem 1 item[^\n]*/) || ['(não avisou)'])[0]);
cobra('e NÃO apagou', JSON.stringify((await painel()).cardapioCategorias) === antes);

console.log('\n### apagar uma categoria VAZIA funciona');
cobra('achou o × da Tabacaria', (await tocarNaLinha('Tabacaria', '×')) === 'ok');
await pg.waitForTimeout(1500);
cats = (await painel()).cardapioCategorias;
cobra('Tabacaria saiu', Array.isArray(cats) && !cats.includes('Tabacaria'), JSON.stringify(cats));

console.log('\n### a ordem que ela escolhe é a ordem das abas do GARÇOM');
// Põe Almoço no topo, do jeito que ela faria no dia do almoço.
for (let i = 0; i < 20; i++) {
  const r = await tocarNaLinha('Almoço', '↑');
  if (r !== 'ok') { if (r !== 'desabilitado') cobra(`subir Almoço (passo ${i})`, false, r); break; }
  await pg.waitForTimeout(600);
}
cats = (await painel()).cardapioCategorias;
cobra('Almoço virou a primeira', cats[0] === 'Almoço', JSON.stringify(cats.slice(0, 3)));

// Um item no Almoço, pra a aba existir na tela do garçom. E uma mesa já aberta,
// porque a aba de categoria só existe dentro de "+ Adicionar produtos".
const pA = await painel();
await gravar({ ...pA, cardapio: [...pA.cardapio, { id: 'c3', nome: 'Prato feito', categoria: 'Almoço', preco: '25,00', ativo: true }] });
await fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}comanda:m9`, valor: { id: 'm9', mesa: '9', status: 'aberta', pessoas: 2, itens: [], abertaEm: new Date().toISOString() } }]) });

console.log('\n### e o garçom vê na mesma ordem');
await entrar('Atendimento', '1234');
await irPara('Comandas');
await pg.waitForTimeout(1500);
// Toca na mesa 9 (já ocupada) e abre a lista de produtos.
const naMesa = await pg.evaluate(() => {
  // O botão da mesa é empilhado: "OCUPADA / 9 / R$ … / 2 pessoas". Vem em
  // maiúscula porque o CSS manda, e innerText obedece ao CSS — compara sem
  // ligar pra caixa.
  const m = [...document.querySelectorAll('button')].find((b) => {
    const l = (b.innerText || '').split('\n').map((x) => x.trim());
    return /^ocupada$/i.test(l[0] || '') && l[1] === '9';
  });
  if (m) { m.click(); return true; }
  return false;
});
cobra('achou a mesa 9 aberta', naMesa);
await pg.waitForTimeout(1800);
await irPara('+ Adicionar produtos');
await pg.waitForTimeout(1200);
const abas = await pg.evaluate(() => [...document.querySelectorAll('button')].map((b) => (b.innerText || '').trim()));
cobra('o garçom enxerga a aba Almoço', abas.includes('Almoço'), JSON.stringify(abas.filter((a) => /Almoço|Chopp|Drinks/.test(a))));
// A ORDEM é o que ela escolheu: Almoço na frente de Chopp.
const iAlm = abas.indexOf('Almoço');
const iChopp = abas.findIndex((a) => a.startsWith('Chopp'));
cobra('e Almoço vem ANTES de Chopp / Cerveja', iAlm >= 0 && iChopp > iAlm, `Almoço=${iAlm} Chopp=${iChopp}`);

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
