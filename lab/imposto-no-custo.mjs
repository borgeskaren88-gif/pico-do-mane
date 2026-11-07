// A NOTA DO CHOPP DELA, E OS 23% QUE SUMIAM DO CUSTO.
//
// Ela mandou a nota da Cervejaria Blumenau pra eu conferir o CMV do chopp:
//
//   BLUMENAU PILSEN · 30,00 LT · V.UNIT 8,86297 · V. TOTAL PRODUTOS 265,89
//   ICMS ST 72,89 · IPI 6,22 · V. TOTAL DA NOTA 345,00
//
// O litro que a nota imprime é R$ 8,86. O litro que ela PAGA é 345 ÷ 30 =
// R$ 11,50. A diferença é ICMS ST e IPI — que num bar do Simples não volta
// como crédito nenhum: é dinheiro dela, gasto, naquele chopp.
//
// O app guardava o imposto como UMA LINHA A MAIS da nota. O boleto fechava
// certo e o DRE também — mas o custo do litro no estoque ficava em 8,86. E é
// esse custo que vai pra ficha técnica, pro CMV e pro Preço Certo. Resultado:
// o CMV do chopp saía 23% melhor do que é, e o preço sugerido saía baixo.
// Tudo calado, que é o pior jeito de um número errar.
//
// O QUE ESTE TESTE GUARDA:
//
//   - a tela mostra o custo real ANTES de ela decidir (8,86 → 11,50);
//   - rateando, o TOTAL PAGO não muda em um centavo — muda só onde o dinheiro
//     é contado. Se mudasse, o boleto deixaria de fechar e ela perderia a
//     única conferência que tem;
//   - o rateio é por VALOR, que é como a distribuidora cobra o ST: quem custa
//     mais carrega mais imposto;
//   - e fica o rastro de onde veio, porque na conferência com a nota o preço
//     do app NÃO vai bater com o V.UNIT impresso.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
const limpa = (s) => String(s || '').replace(/ /g, ' ');

const p0 = await painel();
await gravar({ ...p0,
  negocio: { nome: 'Pico do Mané', cidade: 'Florianópolis', dona: 'Karen', papeis: { dona: 'Karen' } },
  estoque: [
    { id: 'chp', nome: 'Chopp Blumenau Pilsen', custo: '8,86', unidade: 'L', saldo: '0', categoria: 'Bebidas' },
    { id: 'gel', nome: 'Gelo saco 5kg', custo: '6', unidade: 'un', saldo: '10', categoria: 'Bebidas' },
  ],
  cardapio: [], fichas: [], compras: [], receitas: [], despesas: [], diario: [],
});

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, serviceWorkers: 'block' });
const pg = await ctx.newPage();
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
pg.on('console', (m) => { const x = m.text(); if (m.type() === 'error' && !/status of 40/.test(x)) { console.log('[console]', x.slice(0, 160)); ruim++; } });

await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1700);
await pg.locator('button:text-is("Karen")').first().click();
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
const campo = async (rotulo, valor) => {
  const ok = await pg.evaluate(([r, v]) => {
    const lim = (s) => String(s || '').replace(/ /g, ' ').trim();
    const lab = [...document.querySelectorAll('div')].find((d) => d.children.length === 0 && lim(d.textContent) === r);
    const c = lab && lab.parentElement && lab.parentElement.querySelector('input');
    if (!c) return false;
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(c, v); c.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, [rotulo, valor]);
  cobra(`preencheu "${rotulo}"`, ok);
  await pg.waitForTimeout(350);
};
const toque = async (t) => pg.evaluate((x) => {
  const lim = (s) => String(s || '').replace(/ /g, ' ').trim().toLowerCase();
  const b2 = [...document.querySelectorAll('button')].find((e) => lim(e.innerText).startsWith(x.toLowerCase()));
  if (b2) { b2.click(); return true; }
  return false;
}, t);

const abrirImposto = async () => {
  await pg.evaluate(() => {
    const d = [...document.querySelectorAll('summary')].find((x) => /veio com imposto/i.test(x.innerText || ''));
    const det = d && d.parentElement;
    if (det && !det.open) d.click();
  });
  await pg.waitForTimeout(600);
};

await irPara('Abastecimento');
await irPara('Compras');
await pg.waitForTimeout(1200);

console.log('\n### A NOTA DELA, DIGITADA COMO ELA DIGITARIA');
await campo('Produto', 'Chopp Blumenau Pilsen');
await campo('Qtd', '30');
await campo('Valor un. (R$)', '8,86297');
cobra('pôs no carrinho', await toque('+ Adicionar ao carrinho'));
await pg.waitForTimeout(800);
let txt = await texto();
cobra('o carrinho soma os produtos da nota', /R\$ 265,89/.test(txt), (txt.match(/[^\n]*265,89[^\n]*/) || ['(não achou)'])[0]);

console.log('\n### O IMPOSTO QUE A NOTA COBRA POR CIMA');
await abrirImposto();
await campo('ICMS ST (R$)', '72,89');
await campo('IPI (R$)', '6,22');
await pg.waitForTimeout(700);
txt = await texto();
cobra('a soma fecha com o boleto: R$ 345,00', /R\$ 345,00/.test(txt), (txt.match(/[^\n]*345,00[^\n]*/) || ['(não fechou)'])[0]);

console.log('\n### E A TELA MOSTRA O CUSTO REAL ANTES DE ELA DECIDIR');
// É o número que ela nunca viu: o litro que ela PAGA.
cobra('pergunta se o imposto é custo da mercadoria', /imposto é custo da mercadoria/i.test(txt), (txt.match(/[^\n]*custo da mercadoria[^\n]*/i) || ['(não pergunta)'])[0]);
cobra('mostra o litro indo de 8,86 pra 11,50', /R\$\s8,86 → R\$\s11,50 cada/.test(txt), (txt.match(/[^\n]*→[^\n]*/) || ['(não mostra)'])[0]);
cobra('explica que esse custo vai pra ficha e pro preço', /ficha técnica, pro CMV e pro preço/.test(txt));

console.log('\n### RATEANDO: O CUSTO SOBE, O TOTAL NÃO MEXE');
// Se o total mudasse, o boleto deixaria de fechar — e o "fecha com o boleto"
// é a única conferência que ela tem contra o papel.
cobra('tocou em pôr o imposto no custo', await toque('Pôr o imposto no custo'));
await pg.waitForTimeout(900);
txt = await texto();
cobra('o total continua R$ 345,00', /R\$ 345,00/.test(txt), (txt.match(/[^\n]*345,00[^\n]*/) || ['(o boleto deixou de fechar)'])[0]);
cobra('e os 265,89 de antes sumiram do carrinho', !/R\$ 265,89/.test(txt), (txt.match(/[^\n]*265,89[^\n]*/) || [''])[0]);
cobra('o campo de ICMS ST ficou vazio', await pg.evaluate(() => {
  const lim = (s) => String(s || '').trim();
  const lab = [...document.querySelectorAll('div')].find((d) => d.children.length === 0 && lim(d.textContent) === 'ICMS ST (R$)');
  const c = lab && lab.parentElement && lab.parentElement.querySelector('input');
  return !!c && c.value === '';
}));
// O rastro: na conferência com a nota, o preço do app NÃO vai bater com o
// V.UNIT impresso, e ela precisa saber por quê.
cobra('ficou escrito de onde veio o preço novo', /na nota \+ R\$\s79,11 de imposto rateado/.test(txt), (txt.match(/[^\n]*imposto rateado[^\n]*/) || ['(sem rastro)'])[0]);

console.log('\n### COM DOIS ITENS, QUEM CUSTA MAIS CARREGA MAIS IMPOSTO');
// É como a distribuidora cobra o ST. Rateio por valor, em centavos exatos:
//   chopp 265,89 de 325,89 → R$ 64,54  →  (265,89 + 64,54) ÷ 30 = R$ 11,01
//   gelo   60,00 de 325,89 → R$ 14,57  →  ( 60,00 + 14,57) ÷ 10 = R$  7,46
//   soma ................... R$ 79,11, no tostão — o centavo que sobra da
//   divisão vai pro maior resto, que aqui é o gelo.
// O carrinho é guardado como rascunho — recarregar a página NÃO limpa, e é
// bom que não limpe: ela não perde meia compra digitada. Então esvazio no ×.
const esvaziou = await pg.evaluate(() => {
  let n = 0;
  for (let i = 0; i < 10; i++) {
    const x = [...document.querySelectorAll('button')].find((b) => (b.getAttribute('title') || '') === 'Remover');
    if (!x) break;
    x.click(); n++;
  }
  return n;
});
cobra('esvaziou o carrinho da parte anterior', esvaziou > 0, `tirou ${esvaziou}`);
await pg.waitForTimeout(900);
await campo('Produto', 'Chopp Blumenau Pilsen');
await campo('Qtd', '30');
await campo('Valor un. (R$)', '8,86297');
await toque('+ Adicionar ao carrinho');
await pg.waitForTimeout(700);
await campo('Produto', 'Gelo saco 5kg');
await campo('Qtd', '10');
await campo('Valor un. (R$)', '6');
await toque('+ Adicionar ao carrinho');
await pg.waitForTimeout(700);
// Abre SÓ se estiver fechado: <details> guarda o estado, e um segundo clique
// fecharia de novo. O campo ainda se deixa preencher escondido — o que some é
// o texto da tela, e aí o teste mede o próprio descuido.
await abrirImposto();
await campo('ICMS ST (R$)', '72,89');
await campo('IPI (R$)', '6,22');
await pg.waitForTimeout(800);
txt = await texto();
cobra('o chopp sobe pra R$ 11,01 o litro', /R\$\s8,86 → R\$\s11,01 cada/.test(txt), (txt.match(/[^\n]*Chopp[^\n]*→[^\n]*/) || ['(não calculou)'])[0]);
cobra('e o gelo pra R$ 7,46 cada', /R\$\s6,00 → R\$\s7,46 cada/.test(txt), (txt.match(/[^\n]*Gelo[^\n]*→[^\n]*/) || ['(não calculou)'])[0]);
cobra('o total da nota fecha em R$ 405,00', /R\$ 405,00/.test(txt), (txt.match(/[^\n]*405,00[^\n]*/) || ['(não fechou)'])[0]);
cobra('tocou em pôr no custo', await toque('Pôr o imposto no custo'));
await pg.waitForTimeout(900);
txt = await texto();
cobra('e o total segue R$ 405,00 depois do rateio', /R\$ 405,00/.test(txt), (txt.match(/[^\n]*405,00[^\n]*/) || ['(o boleto deixou de fechar)'])[0]);

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
