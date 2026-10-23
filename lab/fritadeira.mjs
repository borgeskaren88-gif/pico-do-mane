// "EU PAGO ISSO EM ÓLEO PORÉM EU NÃO COLOCO ÓLEO NA FICHA TÉCNICA TIPO DA
// BATATA, ALI TA SÓ A BATATA."
//
// Ela mandou o print: Batata Frita Clássica, "1 ingrediente(s)". E mandou
// junto a cotação do óleo: galão de 14,5 L por R$ 189,09. Esse dinheiro não
// aparecia em custo nenhum — o CMV do mês saía melhor do que é e o preço de
// todo frito saía calculado por baixo.
//
// O QUE ESTE TESTE GUARDA:
//
//   - a conta do óleo: ninguém sabe quantos ml tem numa porção, mas todo mundo
//     sabe de quantos em quantos dias troca o galão. A conta sai por aí;
//   - a contagem das porções fritas vem das VENDAS dela, que é a parte que ela
//     não teria como calcular;
//   - aplicar põe o óleo em TODOS os fritos de uma vez — à mão, em doze
//     pratos, ela não faria;
//   - e o custo da batata sobe de verdade depois, até a calculadora de preço.
//     Se parar no meio do caminho, o número continua mentindo pra melhor.
//
//   - LUZ E GÁS NÃO ENTRAM NA FICHA, e a tela tem que dizer por quê. Ela pediu
//     os dois. Entrar calado com eles dobraria o mesmo dinheiro no resultado;
//     sair calado pareceria que eu ignorei o pedido.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
const limpa = (s) => String(s || '').replace(/ /g, ' ');

const diasAtras = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

// A CONTA FEITA NA MÃO:
//   galão .................. 14,5 L = 14.500 ml, R$ 189,09
//   troca .................. de 7 em 7 dias
//   porções fritas ......... 600 em 30 dias = 20 por dia
//   porções por galão ...... 7 × 20 = 140
//   ml por porção .......... 14.500 ÷ 140 = 103,6 → 104 ml
//   custo por porção ....... R$ 189,09 ÷ 140 = R$ 1,35
//   custo da batata ........ 0,4 kg × R$ 20 = R$ 8,00 + óleo = ~R$ 9,36
const p0 = await painel();
await gravar({ ...p0,
  estoque: [
    { id: 'oleo', nome: 'Óleo de algodão 14,5L Elogiata', custo: '189,09', unidade: 'un', saldo: '4', categoria: 'Cozinha' },
    { id: 'bat', nome: 'Batata congelada', custo: '20', unidade: 'kg', saldo: '40', categoria: 'Cozinha' },
  ],
  cardapio: [
    { id: 'c1', nome: 'Batata Frita Clássica', categoria: 'Porções', preco: '29,99', ativo: true },
    { id: 'c2', nome: 'Polenta Frita', categoria: 'Porções', preco: '24,00', ativo: true },
    { id: 'c3', nome: 'Chopp Pilsen', categoria: 'Chopp / Cerveja', preco: '12,00', ativo: true },
  ],
  fichas: [{ cardapioId: 'c1', itens: [{ estoqueId: 'bat', qtd: '0,4', unidade: 'kg' }] }],
  fritadeira: undefined,
  precoBase: { impostos: '0', cartao: '3,15', comissao: '', delivery: '', margem: '65' },
});
// 600 porções fritas em 30 dias: 300 de batata + 300 de polenta.
for (const [i, d] of [diasAtras(3), diasAtras(10), diasAtras(20)].entries()) {
  await fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ chave: `${MARCA}venda:v${i}`, valor: { id: `v${i}`, data: d, total: 100, itens: [
      { cardapioId: 'c1', nome: 'Batata Frita Clássica', qtd: 100, preco: '29,99' },
      { cardapioId: 'c2', nome: 'Polenta Frita', qtd: 100, preco: '24,00' },
      { cardapioId: 'c3', nome: 'Chopp Pilsen', qtd: 500, preco: '12,00' },
    ] } }]) });
}

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
  await pg.waitForTimeout(1800);
  cobra(`achou o caminho "${rot}"`, achou);
};
const campo = async (rotulo, valor) => {
  const ok = await pg.evaluate(([r, v]) => {
    const lim = (s) => String(s || '').replace(/ /g, ' ').trim();
    const lab = [...document.querySelectorAll('div')].find((d) => lim(d.textContent) === r && d.children.length === 0);
    const c = lab && lab.parentElement && lab.parentElement.querySelector('input');
    if (!c) return false;
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(c, v); c.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, [rotulo, valor]);
  cobra(`preencheu "${rotulo}"`, ok);
  await pg.waitForTimeout(500);
};
const marcar = async (nome) => pg.evaluate((n) => {
  const l = [...document.querySelectorAll('label')].find((x) => (x.textContent || '').includes(n));
  const cb = l && l.querySelector('input[type="checkbox"]');
  if (cb && !cb.checked) { cb.click(); return true; }
  return false;
}, nome);
const toque = async (t) => pg.evaluate((x) => {
  const lim = (s) => String(s || '').replace(/ /g, ' ').trim().toLowerCase();
  const b2 = [...document.querySelectorAll('button')].find((e) => lim(e.innerText).startsWith(x.toLowerCase()));
  if (b2) { b2.click(); return true; }
  return false;
}, t);

await irPara('Abastecimento');
await irPara('Estoque');
await irPara('Fichas técnicas');
await pg.waitForTimeout(900);

console.log('\n### o ajudante existe e diz logo qual é o problema');
let txt = await texto();
cobra('o ajudante da fritadeira aparece', /Ajudante da fritadeira/i.test(txt), (txt.match(/[^\n]*Ajudante da fritadeira[^\n]*/) || [''])[0]);
cobra('e nomeia o buraco', /não aparece em custo nenhum/i.test(txt));
await pg.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => /Ajudante da fritadeira/.test(e.innerText || '')); if (x) x.click(); });
await pg.waitForTimeout(900);

console.log('\n### ela responde só o que sabe: qual óleo, o tamanho, de quanto em quanto troca');
await pg.evaluate(() => {
  const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /Óleo de algodão/.test(o.textContent)));
  const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  if (s) { set.call(s, 'oleo'); s.dispatchEvent(new Event('change', { bubbles: true })); }
});
await pg.waitForTimeout(700);
await campo('Quantos litros tem a embalagem?', '14,5');
await campo('Quantos dias dura UM GALÃO inteiro?', '7');

console.log('\n### O SISTEMA CONTA AS PORÇÕES FRITAS — é o que ela não saberia calcular');
cobra('marcou a Batata Frita Clássica', await marcar('Batata Frita Clássica'));
await pg.waitForTimeout(600);
cobra('marcou a Polenta Frita', await marcar('Polenta Frita'));
await pg.waitForTimeout(900);
txt = await texto();
cobra('contou 600 porções nos últimos 30 dias', /600 porções/.test(txt), (txt.match(/[^\n]*últimos 30 dias[^\n]*/) || ['(não contou)'])[0]);
cobra('e chegou em 20 por dia', /20 por dia/.test(txt));
cobra('o chopp NÃO entrou na conta (não é frito)', !/1100 porções|500 porções/.test(txt));

console.log('\n### a conta do óleo bate com a feita na mão');
txt = await texto();
cobra('104 ml por porção', /104 ml/.test(txt), (txt.match(/[^\n]*ml[^\n]*/) || [''])[0]);
cobra('R$ 1,35 de óleo em cada frito', /R\$ 1,35/.test(txt), (txt.match(/[^\n]*= R\$[^\n]*/) || [''])[0]);
cobra('140 porções por galão', /140<?\s*porções|140\b/.test(txt), (txt.match(/[^\n]*porções antes da troca[^\n]*/) || [''])[0]);
cobra('e avisa que é aproximação', /aproximação/i.test(txt));

console.log('\n### LUZ E GÁS: a tela explica por que NÃO entram');
// Ela pediu os dois. Entrar calado dobraria o dinheiro; sair calado pareceria
// que eu ignorei o pedido.
cobra('fala da luz e do gás', /E a luz da fritadeira, e o gás\?/.test(txt));
cobra('diz que já estão nas despesas', /já estão contados/.test(txt));
cobra('e aponta onde ver o custo com o fixo junto', /rateio de custo fixo/.test(txt));

console.log('\n### um toque põe o óleo na ficha de TODOS os fritos');
const antes = (await painel()).fichas;
cobra('antes, a batata tinha só 1 ingrediente', antes.find((f) => f.cardapioId === 'c1').itens.length === 1, JSON.stringify(antes));
cobra('tocou em aplicar', await pg.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find((e) => /Pôr o óleo na ficha/.test(e.innerText || ''));
  if (x) { x.click(); return true; }
  return false;
}));
await pg.waitForTimeout(2600);
const dps = (await painel()).fichas;
const fBat = dps.find((f) => f.cardapioId === 'c1');
const fPol = dps.find((f) => f.cardapioId === 'c2');
cobra('a batata agora tem batata E óleo', fBat && fBat.itens.length === 2, JSON.stringify(fBat));
cobra('com 104 ml', fBat && fBat.itens.some((i) => i.estoqueId === 'oleo' && i.qtd === '104' && i.unidade === 'ml'), JSON.stringify(fBat && fBat.itens));
cobra('a polenta ganhou ficha de óleo também', fPol && fPol.itens.some((i) => i.estoqueId === 'oleo'), JSON.stringify(fPol));
cobra('o chopp NÃO foi tocado', !dps.some((f) => f.cardapioId === 'c3'), JSON.stringify(dps.map((f) => f.cardapioId)));
const oleoItem = (await painel()).estoque.find((e) => e.id === 'oleo');
cobra('e o estoque passou a saber que o galão tem 14.500 ml', Number(oleoItem.conteudo) === 14500 && oleoItem.conteudoUnid === 'ml', JSON.stringify({ c: oleoItem.conteudo, u: oleoItem.conteudoUnid }));

console.log('\n### e o custo da batata SOBE de verdade, até a calculadora de preço');
// Se parar no meio do caminho, o número continua mentindo pra melhor.
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3600);
await irPara('Abastecimento');
await irPara('Preço certo');
await pg.evaluate(() => {
  const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /Batata Frita Clássica/.test(o.textContent)));
  const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  if (s) { set.call(s, 'c1'); s.dispatchEvent(new Event('change', { bubbles: true })); }
});
await pg.waitForTimeout(1400);
txt = await texto();
const mCusto = txt.split('\n');
const iC = mCusto.findIndex((l) => l.trim().startsWith('Custo de uma unidade'));
const custoTela = iC >= 0 ? `${mCusto[iC]} ⇢ ${mCusto[iC + 1]}` : '(não achou)';
cobra('não é mais R$ 8,00 (só a batata)', !/⇢ R\$ 8,00/.test(custoTela), custoTela);
cobra('agora conta o óleo: ~R$ 9,36', /R\$ 9,3\d/.test(custoTela), custoTela);

console.log('\n### VENDA QUE GUARDOU SÓ O NOME TAMBÉM CONTA');
// Foi isto que apareceu na tela dela como "513 ml de óleo por porção".
// Contando só pelo cardapioId, venda antiga (ou de item recriado) sumia da
// conta: as porções por dia saíam pequenas, o galão era dividido por quase
// nada, e o óleo de cada batata ficou do tamanho de meia garrafa.
const pN = await painel();
await gravar({ ...pN, fritadeira: undefined, fichas: [{ cardapioId: 'c1', itens: [{ estoqueId: 'bat', qtd: '0,4', unidade: 'kg' }] }] });
// Uma venda SEM cardapioId, só com o nome do prato.
await fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify([{ chave: `${MARCA}venda:antiga`, valor: { id: 'antiga', data: diasAtras(5), total: 1, itens: [
    { nome: 'Batata Frita Clássica', qtd: 300, preco: '29,99' },
  ] } }]) });
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3600);
await irPara('Abastecimento');
await irPara('Estoque');
await irPara('Fichas técnicas');
await pg.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => /Ajudante da fritadeira/.test(e.innerText || '')); if (x) x.click(); });
await pg.waitForTimeout(800);
cobra('marcou a batata', await marcar('Batata Frita Clássica'));
await pg.waitForTimeout(1200);
txt = await texto();
// Só a BATATA está marcada agora: 300 porções vêm com cardapioId e 300 vêm
// só com o nome. Com o conserto dá 600; sem ele, 300 — e aí o galão seria
// dividido pela metade das porções e o óleo por porção sairia o dobro.
cobra('a venda sem código entrou na conta (600)', /600 porções/.test(txt), (txt.match(/[^\n]*últimos 30 dias[^\n]*/) || ['(não contou)'])[0]);
cobra('não ficou só com as que têm código (300)', !/300 porções/.test(txt));

console.log('\n### e o número absurdo não passa calado');
// Galão de 14,5 L dividido por pouca porção dá centenas de ml por porção.
// A tela dela mostrou 513 ml sem dizer nada, e isso virou ficha, CMV e preço.
const pS = await painel();
await gravar({ ...pS, fritadeira: { oleoId: 'oleo', litros: '14,5', dias: '10', pratos: ['c1'], porDiaManual: '3' } });
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3600);
await irPara('Abastecimento');
await irPara('Estoque');
await irPara('Fichas técnicas');
await pg.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => /Ajudante da fritadeira/.test(e.innerText || '')); if (x) x.click(); });
await pg.waitForTimeout(1000);
txt = await texto();
cobra('avisa que o número é grande demais', /parece grande demais/i.test(txt), (txt.match(/[^\n]*grande demais[^\n]*/) || ['(passou calado)'])[0]);
cobra('diz a faixa normal (10 a 30 ml)', /10 a 30 ml/.test(txt));
cobra('e lembra que é o GALÃO, não a fritadeira', /não de quanto em quanto tempo tu troca a fritadeira/i.test(txt));

console.log('\n### E VIRA A CONTA DO AVESSO: o óleo diz quantas porções saem de verdade');
// "Troco o óleo a cada 10 dias, porém um galão de 14,5 L rende uns 30 dias."
// Com a duração resolvida, o óleo que ela QUEIMA no mês vira fato — vem da
// compra. Se cada porção leva os 25 ml de sempre, dá pra dizer quantas porções
// esse óleo implica, e comparar com o que o app contou.
//
// A CONTA FEITA NA MÃO (cenário deste teste: galão 14,5 L, 10 dias, 3/dia):
//   14.500 ml ÷ 25 ml = 580 porções por galão
//   580 ÷ 10 dias ..... 58 porções por dia
//   o app contou ...... 3 por dia  →  19,3× menos
cobra('diz quantas porções o óleo implica', /58 porções fritas por dia/.test(txt), (txt.match(/[^\n]*porções fritas por dia[^\n]*/) || ['(não vira a conta)'])[0]);
cobra('e quantas vezes é o que o app contou', /19\.3× o que o app contou/.test(txt), (txt.match(/[^\n]*o que o app contou[^\n]*/) || [''])[0]);
cobra('aponta pra venda que não passa pelo app', /sem passar pelo app/.test(txt));
cobra('e diz o que fazer com esse número', /põe ele no campo de cima/.test(txt));

console.log('\n### mostra DE ONDE vem a contagem, prato a prato');
// Ela olhou "2,73 por dia" e não tinha como julgar — mas sabe de cor que num
// sábado saem 20 a 30 batatas. Com a lista aberta ela vê num segundo o que eu
// não vejo daqui: prato marcado que nunca vendeu.
cobra('tem a lista "de onde vem essa conta"', /De onde vem essa conta/i.test(txt), (txt.match(/[^\n]*De onde vem[^\n]*/i) || ['(não mostra)'])[0]);
cobra('com a batata e quanto saiu dela', /Batata Frita Clássica[\s\S]{0,40}em 30 dias/.test(txt), (txt.match(/[^\n]*em 30 dias[^\n]*/) || [''])[0]);

console.log('\n### e NÃO comemora um número que ela mesma reprovou');
// Ela aplicou com o aviso aberto e apareceu um ✓ verde dizendo "agora o CMV
// conta o óleo", como se estivesse tudo certo. Duas mensagens opostas na mesma
// tela: a de baixo é a última que se lê, e é a que fica.
cobra('tocou em aplicar com o número suspeito', await pg.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find((e) => /Pôr o óleo na ficha/.test(e.innerText || ''));
  if (x) { x.click(); return true; }
  return false;
}));
await pg.waitForTimeout(2400);
txt = await texto();
cobra('não diz "agora o CMV conta o óleo"', !/agora o CMV do relatório conta o óleo/.test(txt), (txt.match(/[^\n]*CMV do relatório[^\n]*/) || [''])[0]);
cobra('avisa que aplicou fora da faixa', /Apliquei, mas com o número fora da faixa/.test(txt), (txt.match(/[^\n]*fora da faixa[^\n]*/) || ['(comemorou assim mesmo)'])[0]);
cobra('diz que a ficha é substituída se refizer', /a ficha é substituída/.test(txt));
cobra('e manda não decidir preço com isso', /não usa o preço desses pratos/.test(txt));

console.log('\n### QUANTO DURA O GALÃO: AS NOTAS RESPONDEM, NÃO A MEMÓRIA');
// Ela respondeu 10 duas vezes — é de quanto em quanto tempo troca a
// FRITADEIRA, não quanto dura o galão. Reescrevi o rótulo, pus a explicação
// embaixo, mandei olhar em Compras: respondeu 10 de novo. Quando a pessoa erra
// a mesma pergunta duas vezes, o problema é a pergunta — e a resposta estava
// nas notas o tempo todo.
//
// A CONTA FEITA NA MÃO:
//   comprou 1 galão em 01/08, 1 em 31/08 e 1 em 30/09
//   janela ................. 01/08 → 30/09 = 60 dias
//   gastos nessa janela .... os dois primeiros (o terceiro ainda está em uso)
//   um galão dura .......... 60 ÷ 2 = 30 dias
// Com dias=10 (a resposta dela) o sistema achava 3 galões por mês. É um.
const DURACAO = '30 dias';
const diaISO = (d) => d.toISOString().slice(0, 10);
const hojeD = new Date();
const d1 = new Date(hojeD); d1.setDate(d1.getDate() - 60);
const d2 = new Date(hojeD); d2.setDate(d2.getDate() - 30);
const d3 = new Date(hojeD);
const dP2 = new Date(hojeD); dP2.setDate(dP2.getDate() - 20);
const dP3 = new Date(hojeD); dP3.setDate(dP3.getDate() - 10);
const pD = await painel();
await gravar({ ...pD,
  fritadeira: { oleoId: 'oleo', litros: '14,5', dias: '10', pratos: ['c1'] },
  fichas: [{ cardapioId: 'c1', itens: [{ estoqueId: 'bat', qtd: '0,4', unidade: 'kg' }] }],
  compras: [
    { id: 'k1', data: diaISO(d1), produto: 'Óleo de algodão 14,5L Elogiata', estoqueId: 'oleo', quantidade: '1', valorUnit: '189,09', categoria: 'Fornecedores de insumo' },
    // SEM estoqueId: casa pelo NOME, que é como a maior parte das notas dela
    // entra — ela digita o produto e não liga a mão no item do estoque.
    { id: 'k2', data: diaISO(d2), produto: 'Óleo de algodão 14,5L Elogiata', estoqueId: '', quantidade: '1', valorUnit: '189,09', categoria: 'Fornecedores de insumo' },
    // Parcelas 2/3 e 3/3 da MESMA nota: datas diferentes, estoqueId 'nenhum'.
    // Se entrassem, uma compra viraria três e o galão "duraria" um terço.
    { id: 'k2b', data: diaISO(dP2), produto: 'Óleo de algodão 14,5L Elogiata', estoqueId: 'nenhum', quantidade: '1', valorUnit: '63,03', parcela: '2/3', categoria: 'Fornecedores de insumo' },
    { id: 'k2c', data: diaISO(dP3), produto: 'Óleo de algodão 14,5L Elogiata', estoqueId: 'nenhum', quantidade: '1', valorUnit: '63,03', parcela: '3/3', categoria: 'Fornecedores de insumo' },
    { id: 'k3', data: diaISO(d3), produto: 'Óleo de algodão 14,5L Elogiata', estoqueId: 'oleo', quantidade: '1', valorUnit: '189,09', categoria: 'Fornecedores de insumo' },
    // Compra de OUTRA coisa no meio: não pode entrar na conta do óleo.
    { id: 'k4', data: diaISO(d2), produto: 'Batata congelada', estoqueId: 'bat', quantidade: '10', valorUnit: '20', categoria: 'Fornecedores de insumo' },
  ],
});
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3600);
await irPara('Abastecimento');
await irPara('Estoque');
await irPara('Fichas técnicas');
await pg.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => /Ajudante da fritadeira/.test(e.innerText || '')); if (x) x.click(); });
await pg.waitForTimeout(1200);
txt = await texto();
cobra(`descobriu sozinho que o galão dura ${DURACAO}`, /um galão dura 30 dias/i.test(txt), (txt.match(/[^\n]*Pelas tuas notas[^\n]*/i) || ['(não calculou)'])[0]);
cobra('mostra de onde tirou: 3 compras', /3 compras de óleo/.test(txt), (txt.match(/[^\n]*compras de óleo[^\n]*/) || [''])[0]);
cobra('e que foram 2 galões gastos em 60 dias', /2 galões gastos em 60 dias/.test(txt));
cobra('não contou a compra de batata como óleo', !/4 compras de óleo/.test(txt));
cobra('nem contou a parcela 2/3 como outra compra', !/[456] compras de óleo/.test(txt), (txt.match(/[^\n]*compras de óleo[^\n]*/) || [''])[0]);
cobra('e pegou a nota que não tinha ligação com o estoque', /3 compras de óleo/.test(txt));
const valorDoCampo = async (rotulo) => pg.evaluate((r) => {
  const lim = (x) => String(x || '').replace(/\u00A0/g, ' ').trim();
  const lab = [...document.querySelectorAll('div')].find((d) => lim(d.textContent) === r && d.children.length === 0);
  const c = lab && lab.parentElement && lab.parentElement.querySelector('input');
  return c ? c.value : '(não achou o campo)';
}, rotulo);
cobra('o campo ainda está com os 10 que ela digitou', (await valorDoCampo('Quantos dias dura UM GALÃO inteiro?')) === '10', await valorDoCampo('Quantos dias dura UM GALÃO inteiro?'));
cobra('tocou em "Usar 30 dias"', await toque('Usar 30 dias'));
await pg.waitForTimeout(1000);
txt = await texto();
cobra('o campo recebeu os 30 dias', (await valorDoCampo('Quantos dias dura UM GALÃO inteiro?')) === '30', await valorDoCampo('Quantos dias dura UM GALÃO inteiro?'));
cobra('e o galão passa a render 30 dias de fritura', /\(30 dias × 20 por dia\)/.test(txt), (txt.match(/[^\n]*porções antes da troca[^\n]*/) || [''])[0]);
cobra('e o óleo por porção caiu pra faixa normal', !/parece grande demais/i.test(txt), (txt.match(/[^\n]*ml[^\n]*/) || [''])[0]);
cobra('sumiu o botão de usar, que o número já está lá', !(await toque('Usar 30 dias')));

console.log('\n### NOVENTA E DOIS PRATOS NUMA CAIXA DE 260 PIXELS');
// No print dela o ajudante abriu em "Shot / Tilápia ao Molho de Laranja /
// Parmegiana de Carne", todos desmarcados — e os nove pratos que ela marcou
// estavam lá embaixo, fora da vista. Sem ver o que escolheu ela não consegue
// conferir nem corrigir: só marcar de novo e torcer.
const pL = await painel();
const enche = [];
for (let i = 1; i <= 40; i++) enche.push({ id: `x${i}`, nome: `Prato de Enchimento ${i}`, categoria: 'Porções', preco: '10,00', ativo: true });
await gravar({ ...pL,
  cardapio: [...enche,
    { id: 'c1', nome: 'Batata Frita Clássica', categoria: 'Porções', preco: '29,99', ativo: true },
    { id: 'c2', nome: 'Polenta Frita', categoria: 'Porções', preco: '24,00', ativo: true },
  ],
  fichas: [{ cardapioId: 'c1', itens: [{ estoqueId: 'bat', qtd: '0,4', unidade: 'kg' }] }],
  fritadeira: { oleoId: 'oleo', litros: '14,5', dias: '7', pratos: ['c1', 'c2'] },
});
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3600);
await irPara('Abastecimento');
await irPara('Estoque');
await irPara('Fichas técnicas');
await pg.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => /Ajudante da fritadeira/.test(e.innerText || '')); if (x) x.click(); });
await pg.waitForTimeout(1200);

// A caixa da lista, achada pelo próprio jeito dela: rolagem com 260px de teto.
const caixa = async () => pg.evaluate(() => {
  const el = [...document.querySelectorAll('div')].find((d) => {
    const s = getComputedStyle(d);
    return s.overflowY === 'auto' && s.maxHeight === '260px';
  });
  if (!el) return { txt: '(não achou a caixa da lista)', n: -1 };
  return { txt: String(el.innerText || '').replace(/ /g, ' '), n: el.querySelectorAll('input[type="checkbox"]').length };
});
const buscar = async (v) => pg.evaluate((x) => {
  const i = [...document.querySelectorAll('input')].find((e) => /Buscar prato/.test(e.placeholder || ''));
  if (!i) return false;
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(i, x); i.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}, v);

txt = await texto();
let cx = await caixa();
cobra('a lista tem os 42 pratos', cx.n === 42, JSON.stringify({ n: cx.n }));
cobra('diz quantos estão marcados: 2', /\b2 marcados\b/i.test(txt), (txt.match(/[^\n]*marcados?[^\n]*/) || ['(não conta)'])[0]);

console.log('\n### "ver só os marcados" mostra o que ela escolheu, sem rolar 42 linhas');
cobra('tocou no filtro', await toque('ver só os marcados'));
await pg.waitForTimeout(700);
cx = await caixa();
cobra('sobraram só os 2 marcados', cx.n === 2, JSON.stringify({ n: cx.n, txt: cx.txt.slice(0, 120) }));
cobra('com a batata', /Batata Frita Clássica/.test(cx.txt), cx.txt.slice(0, 120));
cobra('e a polenta', /Polenta Frita/.test(cx.txt));
cobra('e nenhum enchimento no meio', !/Prato de Enchimento/.test(cx.txt));
cobra('o botão diz que o filtro está ligado', /vendo só os marcados/i.test(await texto()));
cobra('tocou de novo pra desligar', await toque('vendo só os marcados'));
await pg.waitForTimeout(700);
cx = await caixa();
cobra('voltaram os 42', cx.n === 42, JSON.stringify({ n: cx.n }));

console.log('\n### e dá pra achar prato pelo nome');
cobra('digitou "polenta"', await buscar('polenta'));
await pg.waitForTimeout(700);
cx = await caixa();
cobra('achou só a Polenta Frita', cx.n === 1 && /Polenta Frita/.test(cx.txt), JSON.stringify({ n: cx.n, txt: cx.txt.slice(0, 80) }));
cobra('digitou um nome que não existe', await buscar('zzzz'));
await pg.waitForTimeout(700);
cobra('e avisa em vez de mostrar caixa vazia', /Nenhum prato com esse nome/i.test(await texto()), (await caixa()).txt.slice(0, 80));

console.log('\n### marcar de dentro da busca funciona, e o item NÃO foge do dedo');
// Se a lista reordenasse no clique, o prato pularia debaixo do dedo e o toque
// seguinte desmarcaria o vizinho sem querer.
cobra('buscou "Enchimento 7"', await buscar('Enchimento 7'));
await pg.waitForTimeout(700);
cobra('marcou ele', await marcar('Prato de Enchimento 7'));
await pg.waitForTimeout(900);
cx = await caixa();
cobra('agora são 3 marcados', /\b3 marcados\b/i.test(await texto()), (((await texto()).match(/[^\n]*marcados?[^\n]*/)) || [''])[0]);
cobra('e ele continua ali, na mesma linha', cx.n === 1 && /Prato de Enchimento 7/.test(cx.txt), JSON.stringify({ n: cx.n, txt: cx.txt.slice(0, 80) }));
cobra('com a caixinha marcada', await pg.evaluate(() => {
  const l = [...document.querySelectorAll('label')].find((x) => /Prato de Enchimento 7/.test(x.textContent || ''));
  const cb = l && l.querySelector('input[type="checkbox"]');
  return !!(cb && cb.checked);
}));

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
