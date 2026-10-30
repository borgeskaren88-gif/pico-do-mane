// "NO 'PRA OLHAR AGORA' DIZ QUE TENHO 16 CONTAS A PAGAR, MAS NO CONTAS A PAGAR
// NÃO MOSTRA ISSO." / "PODERIA CLICAR NA INFORMAÇÃO E ELE ME DIRECIONAR PRA
// PÁGINA CERTA, NÉ."
//
// As duas frases são o mesmo defeito visto de dois ângulos.
//
// O aviso das contas fica lá embaixo no Dashboard. Tocando nele, o app trocava
// de tela e o NAVEGADOR MANTINHA A ALTURA DA ROLAGEM — ela caía no meio do
// formulário de cadastro de Contas a Pagar, ou no fim da página quando a nova
// era mais curta. A lista das 16 contas estava logo acima, fora do campo de
// visão. Do lado de cá parecia que a tela não mostrava nada.
//
// E o alvo do toque era um "Ver" miúdo no canto; ela tocava no número grande,
// que era texto morto.
//
// O QUE ESTE TESTE GUARDA:
//
//   - tocar NA INFORMAÇÃO (o número, o título do cartão) troca de tela;
//   - e a tela nova começa NO COMEÇO. Esta é a asserção que pega o defeito de
//     verdade: sem ela, "trocou de tela" passa verde com a pessoa olhando pro
//     meio da página;
//   - e as duas telas contam o MESMO número de contas. Dois números na mesma
//     casa discordando sobre o mesmo dinheiro não servem nem um nem outro.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
const limpa = (s) => String(s || '').replace(/ /g, ' ');

const HOJE = new Date('2026-10-19T15:00:00Z');
const conta = (id, extra) => ({
  id, data: '2026-10-01', produto: `Item ${id}`, fornecedor: `Fornecedor ${id}`, categoria: 'Outros',
  quantidade: '1', valorUnit: '100', formaPagto: 'Prazo', vencimento: '2026-10-22', pago: 'Não', ...extra,
});

// Uma carteira parecida com a dela: nota com vários itens (uma conta só), nota
// parcelada (uma conta por vencimento), contas soltas, e duas já pagas que não
// podem entrar na conta.
const COMPRAS = [
  // Uma nota VENCIDA com três itens: é ela que separa quem conta boleto de
  // quem conta item. São 3 linhas de compra e UM papel com código de barras.
  conta('a1', { nota: '111', fornecedor: 'Ambev', vencimento: '2026-10-10' }),
  conta('a2', { nota: '111', fornecedor: 'Ambev', vencimento: '2026-10-10' }),
  conta('a3', { nota: '111', fornecedor: 'Ambev', vencimento: '2026-10-10' }),
  conta('b1', { nota: '222', fornecedor: 'Coca', vencimento: '2026-10-25' }),
  conta('b2', { nota: '222', fornecedor: 'Coca', vencimento: '2026-11-25' }),
  conta('b3', { nota: '222', fornecedor: 'Coca', vencimento: '2026-12-25' }),
  conta('s1', { fornecedor: 'Celesc', vencimento: '2026-10-05' }),
  conta('s2', { fornecedor: 'Casan', vencimento: '2026-10-08' }),
  conta('s3', { fornecedor: 'Aluguel', vencimento: '2026-10-30' }),
  conta('s4', { fornecedor: 'Internet', vencimento: '2026-11-02' }),
  conta('s5', { fornecedor: 'Gás', vencimento: '2026-11-05' }),
  conta('s6', { fornecedor: 'Sem data', vencimento: '' }),
  conta('s7', { fornecedor: 'Padaria', vencimento: '2026-10-28' }),
  conta('s8', { fornecedor: 'Contador', vencimento: '2026-11-10' }),
  conta('s9', { fornecedor: 'Seguro', vencimento: '2026-11-12' }),
  conta('s10', { fornecedor: 'Lixo', vencimento: '2026-11-14' }),
  // Compras antigas da tela de Compras que ninguém marcou como pagas: o campo
  // "pago" nem existe nelas, e "não é Sim" vale pra elas também.
  { id: 'v1', data: '2026-08-02', produto: 'Guardanapo', fornecedor: 'Mercado', quantidade: '2', valorUnit: '30' },
  { id: 'v2', data: '2026-08-02', produto: 'Detergente', fornecedor: 'Mercado', quantidade: '1', valorUnit: '18', pago: '' },
  conta('p1', { pago: 'Sim', dataPagamento: '2026-10-10', fornecedor: 'Já paga' }),
  conta('p2', { pago: 'Sim', dataPagamento: '2026-10-11', fornecedor: 'Já paga 2', nota: '999' }),
];
const ESPERADO = 16; // 1 (nota 111) + 3 (nota 222) + 10 soltas (s1..s10) + 2 compras antigas

const p0 = await painel();
await gravar({ ...p0, compras: COMPRAS, despesas: [], receitas: [], diario: [], cardapio: [], fichas: [], tarefas: [],
  // Um item zerado faz nascer um aviso de ESTOQUE lá no topo — assim dá pra
  // cobrar que cada aviso vá pra SUA tela, e não todos pro mesmo lugar.
  // E um estoque que separa "acabou" de "nunca foi contado":
  //   x1  mínimo 10, saldo 0  -> zerado DE VERDADE, e abaixo do mínimo
  //   x2  mínimo  5, saldo 2  -> abaixo do mínimo, mas ainda tem
  //   x3  x4      sem mínimo, saldo 0 -> ela não pediu pro app vigiar isso;
  //                               saldo 0 aqui quer dizer "nunca contei"
  estoque: [
    { id: 'x1', nome: 'Cerveja Original', unidade: 'un', saldo: '0', minimo: '10', categoria: 'Bebidas' },
    { id: 'x2', nome: 'Limão', unidade: 'kg', saldo: '2', minimo: '5', categoria: 'Cozinha' },
    { id: 'x3', nome: 'Guardanapo', unidade: 'pct', saldo: '0', minimo: '', categoria: 'Descartáveis/Apoio' },
    { id: 'x4', nome: 'Palito', unidade: 'cx', saldo: '0', minimo: '', categoria: 'Descartáveis/Apoio' },
  ] });

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
// Tela de celular: a rolagem só atrapalha quando a tela é pequena, que é a
// dela. Num monitor de 1280 o cartão caberia na primeira dobra e o defeito
// nunca apareceria.
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const pg = await ctx.newPage();
await pg.clock.setFixedTime(HOJE);
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
pg.on('console', (m) => { const x = m.text(); if (m.type() === 'error' && !/status of 40/.test(x)) { console.log('[console]', x.slice(0, 160)); ruim++; } });

await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1800);
await pg.locator('button:text-is("Dona")').first().click();
await pg.locator('input[type="password"]').first().fill('Teste@123');
await pg.locator('button:has-text("Entrar")').first().click();
await pg.waitForTimeout(3800);

const texto = async () => limpa(await pg.locator('body').innerText());
// O botão que CONTÉM aquele texto — e não um "Ver" qualquer da página.
const tocarNa = (frase) => pg.evaluate((f) => {
  const lim = (s) => String(s || '').replace(/ /g, ' ');
  // innerText obedece o CSS: "Contas a pagar em aberto" chega aqui em
  // MAIÚSCULAS. Procurar com a letra certa não acha nada.
  const alvo = f.toLowerCase();
  const bt = [...document.querySelectorAll('button')].find((x) => lim(x.innerText).toLowerCase().includes(alvo));
  if (!bt) return '(não achou)';
  bt.click();
  return lim(bt.innerText).replace(/\n/g, ' | ').slice(0, 70);
}, frase);

console.log('\n### O DASHBOARD DIZ QUANTAS CONTAS SÃO');
let txt = await texto();
const noDash = (txt.match(/(\d+) conta\(s\)/) || [])[1];
cobra(`o Dashboard diz ${ESPERADO} conta(s)`, Number(noDash) === ESPERADO, `disse ${noDash}`);

console.log('\n### E O AVISO INTEIRO É TOCÁVEL — não só um "Ver" no canto');
// O alvo óbvio num celular é a informação grande, não a palavra miúda do lado.
const souBotao = await pg.evaluate(() => {
  const lim = (s) => String(s || '').replace(/ /g, ' ');
  const alvo = [...document.querySelectorAll('button')].find((x) => /Contas a pagar em aberto/i.test(lim(x.innerText)));
  if (!alvo) return null;
  const r = alvo.getBoundingClientRect();
  return { largura: Math.round(r.width), altura: Math.round(r.height) };
});
cobra('o cartão das contas é um botão', souBotao !== null, JSON.stringify(souBotao));
// Alvo de dedo: a linha toda, não os poucos milímetros do "Ver".
cobra('e tem a largura do cartão', !!souBotao && souBotao.largura > 250, JSON.stringify(souBotao));

console.log('\n### ROLANDO ATÉ O AVISO E TOCANDO NELE');
// É assim que acontece na vida dela: o aviso mora lá embaixo.
await pg.evaluate(() => {
  const lim = (s) => String(s || '').replace(/ /g, ' ');
  const alvo = [...document.querySelectorAll('button')].find((x) => /Contas a pagar em aberto/i.test(lim(x.innerText)));
  if (alvo) alvo.scrollIntoView({ block: 'center' });
});
await pg.waitForTimeout(600);
const alturaAntes = await pg.evaluate(() => Math.round(window.scrollY));
cobra('a página estava rolada pra baixo', alturaAntes > 200, `scrollY ${alturaAntes}`);
const tocou1 = await tocarNa('Contas a pagar em aberto');
cobra('tocou no cartão das contas a pagar', tocou1 !== '(não achou)', tocou1);
await pg.waitForTimeout(1800);

console.log('\n### CHEGOU EM CONTAS A PAGAR');
txt = await texto();
cobra('a tela é a de Contas a Pagar', /Boletos e contas em aberto/.test(txt), txt.slice(0, 100).replace(/\n/g, ' | '));

console.log('\n### E COMEÇOU NO COMEÇO DA TELA');
// A asserção que pega o defeito. Sem ela, "trocou de tela" passa verde com a
// pessoa olhando pro meio da página e jurando que o sistema não mostra nada.
const alturaDepois = await pg.evaluate(() => Math.round(window.scrollY));
cobra('a página subiu pro topo', alturaDepois <= 2, `scrollY ${alturaDepois} (antes ${alturaAntes})`);
const veTitulo = await pg.evaluate(() => {
  const t = [...document.querySelectorAll('*')].find((x) => x.children.length === 0 && /Contas a Pagar/.test(x.textContent || ''));
  if (!t) return null;
  const r = t.getBoundingClientRect();
  return { topo: Math.round(r.top), naTela: r.top >= 0 && r.top < window.innerHeight };
});
cobra('e o título da tela está à vista', !!veTitulo && veTitulo.naTela, JSON.stringify(veTitulo));

console.log('\n### O NÚMERO DAQUI BATE COM O DE LÁ');
const noTopo = (txt.match(/(\d+) conta\(s\)/) || [])[1];
cobra(`o topo diz ${ESPERADO} conta(s)`, Number(noTopo) === ESPERADO, `disse ${noTopo}`);
cobra('e bate com o que o Dashboard dizia', noTopo === noDash, `${noDash} vs ${noTopo}`);
const noTitulo = (txt.match(/contas em aberto \((\d+)\)/i) || [])[1];
cobra(`o título da lista diz ${ESPERADO}`, Number(noTitulo) === ESPERADO, `disse ${noTitulo}`);
// Título certo com lista curta é justamente o que ela descreveu. Conta os
// cartões de verdade.
const cartoes = await pg.evaluate(() => [...document.querySelectorAll('button')]
  .filter((x) => (x.innerText || '').trim() === 'Marcar pago').length);
cobra(`e a lista desenha ${ESPERADO} contas`, cartoes === ESPERADO, `desenhou ${cartoes}`);

console.log('\n### E O "PRA OLHAR AGORA" TAMBÉM LEVA — era ele que não levava');
// Este é o defeito que ela descreveu. O aviso do topo só abria um parágrafo
// cinza: ela lia "16 contas a pagar", tocava, e continuava no Dashboard.
await pg.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === 'Dashboard');
  if (x) x.click();
});
await pg.waitForTimeout(1800);
txt = await texto();
cobra('o "PRA OLHAR AGORA" está na tela', /PRA OLHAR AGORA/i.test(txt), txt.slice(0, 60).replace(/\n/g, ' | '));
const tocou2 = await tocarNa('vencida');
cobra('tocou no aviso das contas vencidas', tocou2 !== '(não achou)', tocou2);
await pg.waitForTimeout(1800);
txt = await texto();
cobra('e foi parar em Contas a Pagar', /Boletos e contas em aberto/.test(txt), txt.replace(/\n/g, ' | ').slice(0, 200));
cobra('começando no topo', (await pg.evaluate(() => Math.round(window.scrollY))) <= 2);

console.log('\n### CADA AVISO VAI PRA SUA TELA, não todos pro mesmo lugar');
await pg.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === 'Dashboard');
  if (x) x.click();
});
await pg.waitForTimeout(1800);
const tocou3 = await tocarNa('zerado');
cobra('tocou no aviso de item zerado', tocou3 !== '(não achou)', tocou3);
await pg.waitForTimeout(1800);
txt = await texto();
// Procuro a frase que SÓ existe na tela de Estoque. "Cerveja Original" não
// serve: o nome do item também aparece no aviso do Dashboard, então a
// asserção passaria sem ninguém ter saído do lugar.
cobra('e foi parar no Estoque, não em Contas a Pagar',
  /Quanto você tem, o que está acabando/.test(txt) && !/Boletos e contas em aberto/.test(txt),
  txt.replace(/\n/g, ' | ').slice(0, 200));

console.log('\n### O "POR QUÊ" CONTINUA A UM TOQUE — e não troca de tela');
// Quem quer entender abre o botãozinho; quem quer resolver vai direto. Se o
// "?" navegasse junto, a explicação teria sumido do sistema.
await pg.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === 'Dashboard');
  if (x) x.click();
});
await pg.waitForTimeout(1800);
const abriuPorque = await pg.evaluate(() => {
  const bt = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || '').startsWith('Por que'));
  if (!bt) return '(não tem o botão)';
  bt.click();
  return 'tocou';
});
cobra('o botão do "por quê" existe', abriuPorque === 'tocou', abriuPorque);
await pg.waitForTimeout(900);
txt = await texto();
cobra('abriu a explicação', /Juro corre todo dia|Venda perdida é a mais cara/.test(txt), (txt.match(/[^\n]*(Juro corre|Venda perdida)[^\n]*/) || ['(não abriu)'])[0]);
cobra('e continuou no Dashboard', !/Boletos e contas em aberto/.test(txt));

console.log('\n### E OS TRÊS LUGARES CONTAM A MESMA COISA');
// "Ali diz que tem 16 boletos a pagar, porém no A Pagar diz que tem 4."
//
// Os dois estavam certos e contando coisas diferentes: o Darci contava ITEM
// DE NOTA, as telas contavam BOLETO. A nota da Ambev tem 3 itens vencidos e é
// UM boleto; com Celesc e Casan dá 3 contas vencidas, nunca 5.
await pg.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === 'Dashboard');
  if (x) x.click();
});
await pg.waitForTimeout(1800);
const linhaDarci = await pg.evaluate(() => {
  const lim = (s) => String(s || '').replace(/\u00a0/g, ' ');
  const bt = [...document.querySelectorAll('button')].find((x) => /contas? vencidas?/i.test(lim(x.innerText)));
  return bt ? lim(bt.innerText).replace(/\n/g, ' | ') : '(não achou)';
});
cobra('o "Pra olhar agora" diz 3 contas vencidas', /\b3 contas vencidas\b/.test(linhaDarci), linhaDarci);
cobra('e NÃO 5 (que é contar item de nota)', !/\b5 contas vencidas\b/.test(linhaDarci), linhaDarci);

txt = await texto();
const noAviso = (txt.match(/(\d+) contas? vencidas?/) || [])[1];
cobra('o "Avisos de hoje" diz o mesmo 3', noAviso === '3', `disse ${noAviso}`);
const noCartao = (txt.match(/· (\d+) vencida\(s\)/) || [])[1];
cobra('e o cartão de contas a pagar também', noCartao === '3', `disse ${noCartao}`);

await pg.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === 'Finanças');
  if (x) x.click();
});
await pg.waitForTimeout(1500);
await pg.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === 'Contas a Pagar');
  if (x) x.click();
});
await pg.waitForTimeout(1800);
txt = await texto();
const noKPI = (txt.match(/(\d+) vencida\(s\)/) || [])[1];
cobra('e a tela de Contas a Pagar fecha com o mesmo 3', noKPI === '3', `disse ${noKPI}`);

console.log('\n### E O ESTOQUE CONTA IGUAL EM TODA TELA');
// "Ali fala que tem 34 itens faltantes, entro no estoque e diz que tem 18."
//
// "Zerado" era qualquer item com saldo 0, inclusive os sem mínimo — os que
// ela nem pediu pro app vigiar. Saldo 0 num item sem mínimo quase sempre quer
// dizer "nunca foi contado", não "acabou". Aqui, só a Cerveja está zerada de
// verdade; Guardanapo e Palito nunca foram contados.
await pg.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === 'Dashboard');
  if (x) x.click();
});
await pg.waitForTimeout(1800);
const linhaEstoque = await pg.evaluate(() => {
  const lim = (s) => String(s || '').replace(/\u00a0/g, ' ');
  const bt = [...document.querySelectorAll('button')].find((x) => /\d+ ite(?:m|ns) zerad/i.test(lim(x.innerText)));
  return bt ? lim(bt.innerText).replace(/\n/g, ' | ') : '(não achou)';
});
cobra('o aviso diz 1 item zerado', /\b1 item zerado\b/.test(linhaEstoque), linhaEstoque);
cobra('e NÃO 3 (que é contar o que nunca foi contado)', !/\b3 itens zerados\b/.test(linhaEstoque), linhaEstoque);

txt = await texto();
const linhaMin = (txt.match(/[^\n]*no estoque mínimo[^\n]*/) || ['(não achou)'])[0];
const noMinimo = (linhaMin.match(/(\d+) iten?s? /) || [])[1];
cobra('e os "Avisos de hoje" dizem 2 abaixo do mínimo', noMinimo === '2', linhaMin);
// "item" faz plural "itens". O app escrevia "2 items".
cobra('e escreve "itens", não "items"', !/\bitems\b/.test(txt), linhaMin);
// Guardanapo e Palito não podem estar na lista de quem falta.
cobra('Guardanapo não entra na lista do que falta', !/Guardanapo/.test(txt), (txt.match(/[^\n]*Guardanapo[^\n]*/) || [''])[0]);

await pg.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === 'Abastecimento');
  if (x) x.click();
});
await pg.waitForTimeout(2000);
txt = await texto();
cobra('a tela de Estoque abriu', /Quanto você tem, o que está acabando/.test(txt), txt.replace(/\n/g, ' | ').slice(0, 120));
// O cartão "Acabando" é a lista que ela usa pra repor. Ele e o aviso do topo
// têm que estar falando do mesmo conjunto de itens.
const noAcabando = (txt.match(/Acabando \((\d+)\)/i) || [])[1];
cobra('o "Acabando" do Estoque diz os mesmos 2', noAcabando === '2', `disse ${noAcabando}`);

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
