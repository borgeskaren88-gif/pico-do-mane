// "ESTOU PAGANDO UNS BOLETOS ATRASADOS E QUERIA PÔR OS JUROS QUE ESTOU PAGANDO
// E NÃO TEMOS ESSA OPÇÃO."
//
// Não tinha mesmo. A baixa da conta lançava sempre o valor registrado, e o que
// o banco cobrou a mais saía do caixa dela sem aparecer em lugar nenhum.
//
// O ERRO FÁCIL AQUI É SOMAR O JUROS NO BOLETO. Dá o mesmo total e parece mais
// simples: R$ 1.200 de mercadoria + R$ 80 de juros = R$ 1.280 na linha do
// fornecedor. Só que aí o custo da mercadoria aparece maior do que é, bem no
// número que ela usa pra conferir preço de compra e pra olhar o CMV — e o
// juros, que é o que ela quer enxergar, some dentro de outra conta.
//
// O OUTRO ERRO, MAIS CARO, É DEIXAR O JUROS ENTRAR NO RATEIO. O rateio divide
// a despesa de casa pelas unidades vendidas pra dizer quanto cobrar no prato.
// Aluguel e salário são o preço de manter a casa aberta pra vender; juros de
// atraso é o preço de ter pago uma conta fora do prazo. Se entrasse, a tela de
// preço mandaria ela SUBIR O CARDÁPIO porque ela pagou um boleto tarde — e
// meses depois ninguém saberia de onde veio o aumento.
//
// Este teste guarda as duas separações, e mais: que desfazer a baixa leve o
// juros junto (senão a conta volta pra aberta com o juros ainda lançado, ela
// paga de novo e o mês fica com juros em dobro).
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
const limpa = (s) => String(s || '').replace(/\u00a0/g, ' ');

// Relógio parado em 19/10/2026. O boleto da Ambev venceu dia 05 — 14 dias de
// atraso. O da energia vence dia 25, ainda no prazo.
const HOJE = new Date('2026-10-19T15:00:00Z');

const p0 = await painel();
await gravar({ ...p0,
  compras: [
    { id: 'c1', data: '2026-09-28', produto: 'Boleto da compra', fornecedor: 'Ambev', categoria: 'Bebidas',
      quantidade: '1', valorUnit: '1200', formaPagto: 'Prazo', vencimento: '2026-10-05', pago: 'Não',
      tipoConta: 'Fornecedores de insumo' },
    { id: 'c2', data: '2026-10-01', produto: 'Conta de luz', fornecedor: 'Celesc', categoria: 'Outros',
      quantidade: '1', valorUnit: '500', formaPagto: 'Prazo', vencimento: '2026-10-25', pago: 'Não',
      tipoConta: 'Energia elétrica' },
  ],
  // Setembro, pro rateio: casa = 6.000 + 3.000 = 9.000. O juros de 1.000 está
  // lá dentro do mês de propósito — e NÃO pode entrar na conta.
  despesas: [
    { id: 'd1', data: '2026-09-05', valor: '6000', categoria: 'Salários', desc: 'equipe' },
    { id: 'd2', data: '2026-09-05', valor: '3000', categoria: 'Aluguel', desc: 'aluguel' },
    { id: 'd3', data: '2026-09-15', valor: '1000', categoria: 'Juros e multas por atraso', desc: 'boleto atrasado' },
  ],
  estoque: [{ id: 'bat', nome: 'Batata congelada', custo: '20', unidade: 'kg', saldo: '40', categoria: 'Cozinha' }],
  cardapio: [{ id: 'cp1', nome: 'Batata Frita Clássica', categoria: 'Porções', preco: '29,99', ativo: true }],
  fichas: [{ cardapioId: 'cp1', itens: [{ estoqueId: 'bat', qtd: '0,4', unidade: 'kg' }] }],
  receitas: [], diario: [],
  precoBase: { impostos: '0', cartao: '3,15', comissao: '', delivery: '', margem: '65' },
});
// 3.000 unidades em setembro: 9.000 ÷ 3.000 = R$ 3,00 por unidade.
await fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify([{ chave: `${MARCA}venda:s1`, valor: { id: 's1', data: '2026-09-10', total: 1, itens: [{ cardapioId: 'cp1', nome: 'Batata Frita Clássica', qtd: 3000, preco: '29,99' }] } }]) });

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
// O botão daquele cartão, e não o de outro: sobe pelos pais até achar o
// cartão que fala do fornecedor certo.
const botaoDoCartao = (dono, rotulo) => pg.evaluate(([d, r]) => {
  const lim = (s) => String(s || '').replace(/\u00a0/g, ' ').trim();
  const bts = [...document.querySelectorAll('button')].filter((x) => lim(x.innerText) === r);
  const alvo = bts.find((x) => {
    let n = x.parentElement;
    for (let i = 0; i < 6 && n; i++, n = n.parentElement) if ((n.innerText || '').includes(d)) return true;
    return false;
  });
  if (alvo) { alvo.click(); return true; }
  return false;
}, [dono, rotulo]);
const escreverJuros = (v) => pg.evaluate((valor) => {
  const lab = [...document.querySelectorAll('div')].find((x) => /^juros e multa/i.test((x.innerText || '').trim()));
  const campo = lab && lab.parentElement ? lab.parentElement.querySelector('input') : null;
  if (!campo) return false;
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(campo, valor);
  campo.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}, v);
const despesasDo = async () => (await painel()).despesas || [];

console.log('\n### A CATEGORIA EXISTE PRA ELA LANÇAR NA MÃO');
// Boleto que nunca foi registrado no sistema ela paga e lança direto. Sem a
// categoria, o juros ia cair em "Despesas diversas" e sumir no meio.
await irPara('Despesa Rápida');
const temCategoria = await pg.evaluate(() => [...document.querySelectorAll('select')]
  .some((s) => [...s.options].some((o) => /Juros e multas por atraso/.test(o.textContent))));
cobra('"Juros e multas por atraso" está na lista de categorias', temCategoria);

console.log('\n### NO BOLETO VENCIDO, "MARCAR PAGO" PERGUNTA O JUROS');
await irPara('Finanças');
await irPara('Contas a Pagar');
cobra('tocou em "Marcar pago" da Ambev', await botaoDoCartao('Ambev', 'Marcar pago'));
await pg.waitForTimeout(700);
let txt = await texto();
cobra('abriu a confirmação em vez de pagar direto', /Venceu há/.test(txt), (txt.match(/[^\n]*Venceu há[^\n]*/) || ['(pagou sem perguntar)'])[0]);
cobra('diz quantos dias de atraso', /Venceu há 14 dia/.test(txt), (txt.match(/[^\n]*Venceu há[^\n]*/) || [''])[0]);
cobra('e diz que pode deixar em branco', /deixa em branco/.test(txt));

console.log('\n### E MOSTRA O QUE VAI SAIR DO CAIXA, ANTES DE CONFIRMAR');
cobra('escreveu 80 no campo', await escreverJuros('80'));
await pg.waitForTimeout(600);
txt = await texto();
cobra('o total sai 1.280,00', /Sai do caixa: R\$ 1\.280,00/.test(txt), (txt.match(/[^\n]*Sai do caixa[^\n]*/) || ['(não achou)'])[0]);
cobra('mostra a conta aberta: boleto + juros', /boleto R\$ 1\.200,00 \+ juros R\$ 80,00/.test(txt), (txt.match(/[^\n]*boleto R\$[^\n]*/) || [''])[0]);
// O quanto a mais em porcentagem é o que faz ela sentir o tamanho do atraso.
cobra('e diz quanto por cento isso é', /6,7% a mais/.test(txt), (txt.match(/[^\n]*% a mais[^\n]*/) || [''])[0]);

console.log('\n### CONFIRMADO: DUAS DESPESAS, CADA UMA NA SUA CATEGORIA');
cobra('tocou em "Confirmar pagamento"', await botaoDoCartao('Ambev', 'Confirmar pagamento'));
await pg.waitForTimeout(2600);
const d1 = await despesasDo();
const boleto = d1.find((d) => d.origem === 'conta-a-pagar');
const juros = d1.find((d) => d.origem === 'conta-a-pagar-juros');
cobra('lançou a despesa do boleto', !!boleto, JSON.stringify(boleto));
cobra('lançou a despesa do juros', !!juros, JSON.stringify(juros));
// A ASSERÇÃO QUE JUSTIFICA O TESTE: o boleto continua valendo o boleto.
cobra('o boleto continua R$ 1.200,00 — o juros NÃO foi somado nele', !!boleto && /^1\.200,00$/.test(String(boleto.valor)), String(boleto && boleto.valor));
cobra('e o boleto ficou na categoria da compra', !!boleto && boleto.categoria === 'Fornecedores de insumo', String(boleto && boleto.categoria));
cobra('o juros vale 80,00', !!juros && /^80,00$/.test(String(juros.valor)), String(juros && juros.valor));
cobra('e está na categoria de juros', !!juros && juros.categoria === 'Juros e multas por atraso', String(juros && juros.categoria));
cobra('o juros diz de qual boleto veio', !!juros && /Ambev/.test(String(juros.descricao)), String(juros && juros.descricao));
cobra('e quantos dias de atraso', !!juros && /14 dia/.test(String(juros.obs)), String(juros && juros.obs));

console.log('\n### A CONTA NO PRAZO CONTINUA SENDO UM TOQUE SÓ');
// Perguntar juros em toda conta viraria um estorvo diário. Só vencida pergunta.
cobra('tocou em "Marcar pago" da Celesc', await botaoDoCartao('Celesc', 'Marcar pago'));
await pg.waitForTimeout(2600);
txt = await texto();
cobra('não abriu confirmação nenhuma', !/Venceu há/.test(txt), (txt.match(/[^\n]*Venceu há[^\n]*/) || [''])[0]);
const d2 = await despesasDo();
cobra('e a conta foi paga direto', d2.some((d) => /Celesc/.test(String(d.descricao))), JSON.stringify(d2.map((d) => d.descricao)));

console.log('\n### DESFAZER LEVA O JUROS JUNTO');
// Sem isto, a conta volta pra aberta com o juros ainda lançado: ela paga de
// novo e o mês fecha com juros em dobro, sem nada na tela indicando o erro.
const abriu = await pg.evaluate(() => {
  // innerText obedece o CSS: este resumo é maiúsculo na tela, então procurar
  // "Contas pagas" com letra certa não acha nada.
  const d = [...document.querySelectorAll('summary')].find((x) => /contas pagas/i.test(x.innerText || ''));
  if (!d) return 'nao achou a lista';
  d.click();
  return d.parentElement && d.parentElement.open ? 'abriu' : 'nao abriu';
});
cobra('a lista de contas pagas abre', abriu === 'abriu', abriu);
await pg.waitForTimeout(900);
cobra('tocou em "Desfazer" da Ambev', await botaoDoCartao('Ambev', 'Desfazer'));
await pg.waitForTimeout(2600);
const d3 = await despesasDo();
cobra('a despesa do boleto sumiu', !d3.some((d) => d.origem === 'conta-a-pagar' && /Ambev/.test(String(d.descricao))), JSON.stringify(d3.map((d) => d.descricao)));
cobra('a despesa do juros sumiu junto', !d3.some((d) => d.origem === 'conta-a-pagar-juros'), JSON.stringify(d3.map((d) => `${d.categoria}:${d.valor}`)));

console.log('\n### E O JUROS NÃO ENTRA NO RATEIO — não manda subir o cardápio');
// Setembro: Salários 6.000 + Aluguel 3.000 = 9.000 de casa, e 1.000 de juros
// que não é custo de fazer prato. 9.000 ÷ 3.000 unidades = R$ 3,00.
// Se o juros entrasse: 10.000 ÷ 3.000 = R$ 3,33, e o preço sugerido subiria.
await irPara('Abastecimento');
await irPara('Preço certo');
await pg.evaluate(() => {
  const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /Batata Frita/.test(o.textContent)));
  const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  if (s) { set.call(s, 'cp1'); s.dispatchEvent(new Event('change', { bubbles: true })); }
});
await pg.waitForTimeout(1600);
txt = await texto();
cobra('a despesa de casa deu R$ 9.000,00', /R\$ 9\.000,00/.test(txt), (txt.match(/[^\n]*despesas de casa[^\n]*/) || ['(não achou)'])[0]);
cobra('e NÃO R$ 10.000,00 (que seria com o juros dentro)', !/R\$ 10\.000,00/.test(txt));
cobra('o rateio deu R$ 3,00 por unidade', /R\$ 3,00/.test(txt), (txt.match(/[^\n]*de custo de casa[^\n]*/) || [''])[0]);
cobra('e NÃO R$ 3,33', !/R\$ 3,33/.test(txt));
cobra('o juros nem aparece no "o que mais pesou"', !/Juros e multas/.test(txt), (txt.match(/[^\n]*Juros[^\n]*/) || [''])[0]);

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
