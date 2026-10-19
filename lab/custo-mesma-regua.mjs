// "PAGO 48 E POUCO NO QUILO DA CARNE E ESSA TÁBUA VAI 300G DE CARNE (...)
//  POR QUE PARECE QUE EU GASTO TÃO POUCO?"
//
// Ela olhou A Favorita: custo R$ 12,39 pra um prato com 300 g de carne,
// mussarela, batata frita e anéis de cebola. Só a carne, a R$ 48 o quilo, já
// seriam R$ 14,40 — mais que a ficha inteira. Ela conhece o próprio custo e
// viu na hora que o número era mentira.
//
// E era. A causa:
//
//   "Carne 300g" é SACO PORCIONADO — ninguém compra saco de 300 g, compra
//   carne em quilo e ensaca. O custo desse saco não é um dado próprio: é uma
//   fatia do quilo comprado, e só é recalculado no caminho que reconstrói
//   custo pelas NOTAS DE COMPRA.
//
//   O relatório usava esse caminho. As três telas de preço (Preço certo,
//   Margem e Raio-X) liam o custo congelado no item — que pode ser zero, ou de
//   quando alguém digitou pela última vez.
//
// Duas réguas pro mesmo prato é pior que uma régua torta: ela confere, vê
// números diferentes e para de confiar nos dois.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
const limpa = (s) => String(s || '').replace(/ /g, ' ');

const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const diasAtras = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

// A CONTA FEITA NA MÃO:
//   carne comprada a R$ 48,00 o quilo
//   "Carne 300g" é saco de 300 g do mesmo item  →  0,3 × 48 = R$ 14,40 o saco
//   a ficha da Favorita leva 1 saco             →  R$ 14,40 só de carne
//   + queijo 100 g a R$ 40/kg                   →  R$  4,00
//   = R$ 18,40
// O custo GUARDADO no saco é zero, de propósito: é o estado real dela.
const p0 = await painel();
await gravar({ ...p0,
  estoque: [
    { id: 'carne', nome: 'Carne', custo: '0', unidade: 'kg', saldo: '20', categoria: 'Cozinha' },
    { id: 'carne300', nome: 'Carne 300g', custo: '0', unidade: 'un', saldo: '10', categoria: 'Cozinha', separar: { brutoId: 'carne', gramas: 300, unidade: 'g' } },
    { id: 'queijo', nome: 'Mussarela', custo: '40', unidade: 'kg', saldo: '5', categoria: 'Cozinha' },
  ],
  cardapio: [{ id: 'c1', nome: 'A Favorita', categoria: 'Porções', preco: '79,99', ativo: true }],
  fichas: [{ cardapioId: 'c1', itens: [
    { estoqueId: 'carne300', qtd: '1', unidade: 'un' },
    { estoqueId: 'queijo', qtd: '100', unidade: 'g' },
  ] }],
  // A NOTA DE COMPRA é a única fonte que sabe quanto custa a carne.
  compras: [{ id: 'nota', data: diasAtras(10), produto: 'Carne', quantidade: '20', valorUnit: '48', tipoConta: 'Fornecedores de insumo' }],
  despesas: [], receitas: [], diario: [], fritadeira: undefined,
  precoBase: { impostos: '0', cartao: '3,15', comissao: '', delivery: '', margem: '65' },
});

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
  await pg.waitForTimeout(1700);
  cobra(`achou o caminho "${rot}"`, achou);
};
const linha = async (rotulo) => {
  const l = (await texto()).split('\n');
  const i = l.findIndex((x) => x.trim().startsWith(rotulo));
  return i < 0 ? '(não achou)' : `${l[i]} ⇢ ${l[i + 1] || ''}`;
};

console.log('\n### o PREÇO CERTO usa o custo da nota, não o zero guardado no saco');
await irPara('Abastecimento');
await irPara('Preço certo');
await pg.evaluate(() => {
  const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /A Favorita/.test(o.textContent)));
  const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  if (s) { set.call(s, 'c1'); s.dispatchEvent(new Event('change', { bubbles: true })); }
});
await pg.waitForTimeout(1500);
const l = await linha('Custo de uma unidade');
cobra('não é R$ 4,00 (só o queijo, com a carne sumindo)', !/⇢ R\$ 4,00/.test(l), l);
cobra('a carne entrou a R$ 14,40 → total R$ 18,40', /⇢ R\$ 18,40/.test(l), l);

console.log('\n### e a MARGEM conta a mesma história');
await irPara('Margem');
await pg.waitForTimeout(1200);
let txt = await texto();
// preço 79,99 − 18,40 = 61,59 de lucro
cobra('mostra custo R$ 18,40', /custo R\$ 18,40/.test(txt), (txt.match(/[^\n]*A Favorita[\s\S]{0,120}/) || [''])[0].replace(/\n/g, ' · '));
cobra('e lucro R$ 61,59', /R\$ 61,59/.test(txt));

console.log('\n### ingrediente sem custo é NOMEADO, não "algum"');
// Tira a nota de compra: aí nem o caminho novo sabe o preço da carne, e a tela
// tem que dizer QUAL item está furado — não só que "algum" está.
const pS = await painel();
await gravar({ ...pS, compras: [] });
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3600);
await irPara('Abastecimento');
await irPara('Preço certo');
await pg.evaluate(() => {
  const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /A Favorita/.test(o.textContent)));
  const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  if (s) { set.call(s, 'c1'); s.dispatchEvent(new Event('change', { bubbles: true })); }
});
await pg.waitForTimeout(1500);
txt = await texto();
cobra('diz QUAL ingrediente está sem custo', /sem custo no estoque: .*Carne 300g/.test(txt), (txt.match(/[^\n]*sem custo no estoque[^\n]*/) || ['(só disse "algum")'])[0]);
cobra('e avisa que o preço sai por baixo', /sai por baixo/.test(txt));

console.log('\n### SACO PORCIONADO CUJO PACOTE NÃO CONVERTE: não inventa custo');
// O caso real dela: "Batata 400g" é saco de 400 g tirado de um pacote
// cadastrado em SACO — sem dizer quantos gramas tem o saco. A conversão de
// "400 g" pra "saco" cai no chute do fim da função e devolve 400. O saco
// porcionado passava a custar 400 SACOS, e a Batata Frita Clássica apareceu
// com R$ 2.484,36 de ingrediente numa porção de R$ 29,99.
//
// Quando não dá pra converter, o certo é NÃO derivar: fica o custo que o saco
// já tinha. Velho é consertável; mil vezes maior não é.
const pB = await painel();
await gravar({ ...pB,
  estoque: [
    // Pacote em SACO, sem conteúdo — não dá pra saber quantos gramas tem.
    { id: 'pacote', nome: 'Batata pacote', custo: '6,20', unidade: 'saco', saldo: '10', categoria: 'Cozinha' },
    { id: 'bat400', nome: 'Batata 400g', custo: '3,22', unidade: 'un', saldo: '20', categoria: 'Cozinha', separar: { brutoId: 'pacote', gramas: 400, unidade: 'g' } },
  ],
  cardapio: [{ id: 'c2', nome: 'Batata Frita Clássica', categoria: 'Porções', preco: '29,99', ativo: true }],
  fichas: [{ cardapioId: 'c2', itens: [{ estoqueId: 'bat400', qtd: '1', unidade: 'un' }] }],
  compras: [],
});
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3600);
await irPara('Abastecimento');
await irPara('Preço certo');
await pg.evaluate(() => {
  const s2 = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /Batata Frita/.test(o.textContent)));
  const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  if (s2) { set.call(s2, 'c2'); s2.dispatchEvent(new Event('change', { bubbles: true })); }
});
await pg.waitForTimeout(1500);
const l2 = await linha('Custo de uma unidade');
cobra('NÃO virou 400 sacos (R$ 2.480,00)', !/2\.480|2\.484/.test(l2), l2);
cobra('ficou com o custo que o saco já tinha: R$ 3,22', /⇢ R\$ 3,22/.test(l2), l2);

console.log('\n### e a tela mostra o custo LINHA A LINHA');
// Um número só não dá pra conferir. Com a lista, o ingrediente absurdo salta
// aos olhos — foram 40 minutos de caça pra achar o que isto mostra num relance.
txt = await texto();
cobra('tem a lista "de onde vem esse custo"', /De onde vem esse custo/i.test(txt), (txt.match(/[^\n]*De onde vem esse custo[^\n]*/i) || ['(não mostra)'])[0]);
cobra('com o ingrediente e o quanto ele pesa', /Batata 400g[\s\S]{0,60}R\$ 3,22/.test(txt), (txt.match(/[^\n]*Batata 400g[^\n]*/) || [''])[0]);

console.log('\n### conversão no chute é apontada em vermelho');
// Ficha pedindo "300 g" de um item cadastrado em pote, sem dizer quantos
// gramas tem o pote: o sistema usaria 300 POTES.
const pC = await painel();
await gravar({ ...pC,
  estoque: [{ id: 'pote', nome: 'Molho pote', custo: '18', unidade: 'pote', saldo: '5', categoria: 'Cozinha' }],
  fichas: [{ cardapioId: 'c2', itens: [{ estoqueId: 'pote', qtd: '300', unidade: 'g' }] }],
});
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3600);
await irPara('Abastecimento');
await irPara('Preço certo');
await pg.evaluate(() => {
  const s3 = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /Batata Frita/.test(o.textContent)));
  const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  if (s3) { set.call(s3, 'c2'); s3.dispatchEvent(new Event('change', { bubbles: true })); }
});
await pg.waitForTimeout(1500);
txt = await texto();
cobra('avisa "conversão no chute"', /Conversão no chute/i.test(txt), (txt.match(/[^\n]*onversão no chute[^\n]*/) || ['(passou calado)'])[0]);
cobra('e nomeia o ingrediente', /Molho pote/.test(txt));
cobra('explicando o conserto (preencher o conteúdo)', /preenche o conteúdo da embalagem/.test(txt));

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
