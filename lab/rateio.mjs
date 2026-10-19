// "MÃO DE OBRA NÃO SE PÕE TAMBÉM?"
//
// Na ficha não: a cozinheira ganha igual no sábado cheio e na terça parada,
// então salário não é custo DO prato. Mas a pergunta está certa no que importa
// — mão de obra num bar pesa MUITO mais que luz e gás, e ignorar isso na hora
// de pôr preço é bem pior que ignorar a conta de energia.
//
// O lugar disso é o rateio por unidade. E eu vinha mandando ela "preencher o
// rateio" sem nunca dizer com qual número — ou seja, não vinha ajudando nada.
// Agora o sistema faz a conta, porque conhece as duas pontas.
//
// AS DUAS ARMADILHAS QUE ESTE TESTE GUARDA:
//
//   - O MÊS. No meio de outubro o aluguel inteiro já foi lançado e só metade
//     das vendas aconteceu: o rateio sairia quase o dobro do real. Tem que
//     usar o último mês FECHADO.
//   - A MERCADORIA. Fornecedor de insumo NÃO entra neste rateio: o ingrediente
//     já está na ficha técnica. Somar aqui de novo faria o preço cobrar a
//     batata duas vezes.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
const limpa = (s) => String(s || '').replace(/ /g, ' ');

// Relógio parado em 19/10/2026 — o mês fechado anterior é setembro/2026.
const HOJE = new Date('2026-10-19T15:00:00Z');

// A CONTA FEITA NA MÃO (setembro):
//   despesa de casa .... Salários 6.000 + Aluguel 3.000 + Energia 900 = 9.900
//   NÃO entram ......... Fornecedores de insumo 5.000 (já está na ficha)
//                        Investimento 2.000 (não é operação)
//   unidades vendidas .. 3.000
//   rateio ............. 9.900 ÷ 3.000 = R$ 3,30 por unidade
//   batata ............. R$ 8,00 de ficha + R$ 3,30 = R$ 11,30
const RATEIO = 'R$ 3,30';
const COM_INSUMO_ERRADO = 'R$ 4,97'; // 14.900 ÷ 3.000, se somasse a mercadoria

const p0 = await painel();
await gravar({ ...p0,
  estoque: [{ id: 'bat', nome: 'Batata congelada', custo: '20', unidade: 'kg', saldo: '40', categoria: 'Cozinha' }],
  cardapio: [{ id: 'c1', nome: 'Batata Frita Clássica', categoria: 'Porções', preco: '29,99', ativo: true }],
  fichas: [{ cardapioId: 'c1', itens: [{ estoqueId: 'bat', qtd: '0,4', unidade: 'kg' }] }],
  despesas: [
    { id: 'd1', data: '2026-09-05', valor: '6000', categoria: 'Salários', desc: 'equipe' },
    { id: 'd2', data: '2026-09-05', valor: '3000', categoria: 'Aluguel', desc: 'aluguel' },
    { id: 'd3', data: '2026-09-12', valor: '900', categoria: 'Energia elétrica', desc: 'luz' },
    // Estes dois NÃO podem entrar no rateio:
    { id: 'd4', data: '2026-09-08', valor: '5000', categoria: 'Fornecedores de insumo', desc: 'mercadoria' },
    { id: 'd5', data: '2026-09-20', valor: '2000', categoria: 'Investimento', desc: 'freezer' },
    // Outubro, o mês corrente: se o sistema usar ESTE mês, o número explode.
    { id: 'd6', data: '2026-10-02', valor: '50000', categoria: 'Aluguel', desc: 'outubro' },
  ],
  receitas: [], compras: [], diario: [],
  precoBase: { impostos: '0', cartao: '3,15', comissao: '', delivery: '', margem: '65' },
  fritadeira: undefined,
});
// Setembro: 3.000 unidades. Outubro: 100 (mês ainda andando).
await fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify([{ chave: `${MARCA}venda:s1`, valor: { id: 's1', data: '2026-09-10', total: 1, itens: [{ cardapioId: 'c1', nome: 'Batata Frita Clássica', qtd: 3000, preco: '29,99' }] } }]) });
await fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify([{ chave: `${MARCA}venda:o1`, valor: { id: 'o1', data: '2026-10-05', total: 1, itens: [{ cardapioId: 'c1', nome: 'Batata Frita Clássica', qtd: 100, preco: '29,99' }] } }]) });

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, serviceWorkers: 'block' });
const pg = await ctx.newPage();
await pg.clock.setFixedTime(HOJE);
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
  await pg.waitForTimeout(1800);
  cobra(`achou o caminho "${rot}"`, achou);
};
const toque = async (t) => pg.evaluate((x) => {
  const lim = (s) => String(s || '').replace(/ /g, ' ').trim();
  const b2 = [...document.querySelectorAll('button')].find((e) => lim(e.innerText).startsWith(x));
  if (b2) { b2.click(); return true; }
  return false;
}, t);
const linhaCusto = async () => {
  const l = (await texto()).split('\n');
  const i = l.findIndex((x) => x.trim().startsWith('Custo de uma unidade'));
  return i < 0 ? '(não achou)' : `${l[i]} ⇢ ${l[i + 1] || ''}`;
};

await irPara('Abastecimento');
await irPara('Preço certo');
await pg.evaluate(() => {
  const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /Batata Frita/.test(o.textContent)));
  const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  if (s) { set.call(s, 'c1'); s.dispatchEvent(new Event('change', { bubbles: true })); }
});
await pg.waitForTimeout(1400);

console.log('\n### o sistema calcula o rateio sozinho, do último mês FECHADO');
let txt = await texto();
cobra('usa Set/2026, não o outubro pela metade', /Em Set\/2026/.test(txt), (txt.match(/[^\n]*Em Set[^\n]*/) || ['(não calculou)'])[0]);
cobra('não usou o aluguel gigante de outubro', !/R\$ 50\.000,00/.test(txt));
cobra(`chegou em ${RATEIO} por unidade`, txt.includes(RATEIO), (txt.match(/[^\n]*de custo de casa[^\n]*/) || [''])[0]);

console.log('\n### a MERCADORIA fica de fora — ela já está na ficha técnica');
cobra('somou só a despesa de casa (R$ 9.900,00)', /R\$ 9\.900,00/.test(txt), (txt.match(/[^\n]*despesas de casa[^\n]*/) || [''])[0]);
cobra(`e NÃO ${COM_INSUMO_ERRADO} (que seria somando os insumos)`, !txt.includes(COM_INSUMO_ERRADO));
cobra('nem contou o investimento', !/R\$ 11\.900,00/.test(txt));

console.log('\n### mostra DE ONDE vem o número, em vez de pedir fé');
cobra('lista o que mais pesou', /O que mais pesou/.test(txt), (txt.match(/[^\n]*mais pesou[^\n]*/) || [''])[0]);
cobra('com o salário na frente', /Salários R\$ 6\.000,00/.test(txt), (txt.match(/[^\n]*Salários[^\n]*/) || [''])[0]);

console.log('\n### e avisa que a divisão é grosseira');
cobra('diz que é média por cabeça', /média por cabeça/.test(txt));
cobra('dando o exemplo do chopp e do camarão', /chopp e um camarão/.test(txt));

console.log('\n### um toque põe o número no campo e o custo sobe');
cobra('antes, o custo é só a ficha (R$ 8,00)', /⇢ R\$ 8,00/.test(await linhaCusto()), await linhaCusto());
cobra('tocou em "Usar R$ 3,30"', await toque('Usar R$ 3,30'));
await pg.waitForTimeout(900);
cobra('agora o custo é R$ 11,30', /⇢ R\$ 11,30/.test(await linhaCusto()), await linhaCusto());

console.log('\n### "ESSA MARGEM É SAUDÁVEL?" — a tela responde com o alvo do mês');
// A pergunta não tem resposta em faixa de revista: 65% só é saudável se o
// faturamento cobrir o fixo. O sistema conhece as duas pontas, então em vez de
// opinar ele dá o alvo.
//   despesa de casa de setembro .... R$ 9.900,00
//   margem pedida .................. 65%
//   faturamento pra empatar ........ 9.900 ÷ 0,65 = R$ 15.230,77
txt = await texto();
cobra('pergunta se a margem paga a casa', /Essa margem paga a casa/i.test(txt), (txt.match(/[^\n]*paga a casa[^\n]*/i) || ['(não responde)'])[0]);
cobra('usa a despesa real de setembro', /R\$ 9\.900,00/.test(txt));
cobra('e diz o faturamento pra empatar: R$ 15.230,77', /R\$ 15\.230,77/.test(txt), (txt.match(/[^\n]*só pra empatar[^\n]*/) || [''])[0]);
cobra('deixando claro que acima disso é lucro', /O que passar disso é lucro/.test(txt));
cobra('e que a resposta não é faixa de revista', /faixa de revista/.test(txt));

console.log('\n### e dá pra tirar, que o rateio é opcional');
cobra('tocou em "Tirar"', await toque('Tirar'));
await pg.waitForTimeout(900);
cobra('voltou pra R$ 8,00', /⇢ R\$ 8,00/.test(await linhaCusto()), await linhaCusto());

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
