// "NO FINAL DAS CONTAS EU NÃO SEI QUANTO EU DEVERIA TER EM CAIXA."
//
// "Mês passado estava com saldo final de 300,00, aí virou o mês e fica tudo
// zerado no Dashboard, e eu acho isso ótimo, porém no final das contas eu não
// sei quanto eu deveria ter em caixa. Não queria que mudasse o Dashboard."
//
// O Dashboard conta o MÊS, e tem que contar. Mas o dinheiro não zera na
// virada: os R$ 300 de outubro continuaram na gaveta no dia 1º de novembro.
//
// O QUE ESTE TESTE GUARDA:
//
//   - O DASHBOARD NÃO MUDOU. Ela pediu isso com todas as letras, e é a
//     primeira coisa que eu quebraria sem perceber: o número de lá continua
//     sendo só o do mês corrente.
//   - A CONTA PARTE DA CONFERÊNCIA, não do começo dos tempos. Somar tudo desde
//     sempre só daria certo se cada centavo da vida do bar estivesse lançado —
//     e um número errado com cara de certo é pior que número nenhum.
//   - O MOVIMENTO DO DIA DA CONFERÊNCIA NÃO ENTRA DUAS VEZES. Quem conta o
//     dinheiro conta o que já aconteceu; somar o dia de novo inflaria o saldo
//     e ela passaria a procurar um dinheiro que nunca existiu.
//   - AQUI ENTRA TUDO que mexeu no dinheiro, inclusive o que o DRE deixa de
//     fora (empréstimo, investimento, distribuição de lucros).
//   - E A DIFERENÇA FICA GUARDADA. Uma conferência que fecha é alívio; três
//     seguidas faltando R$ 50 é problema com nome e endereço.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
const limpa = (s) => String(s || '').replace(/ /g, ' ');

// Relógio parado em 03/11/2026.
const HOJE = new Date('2026-11-03T15:00:00Z');

// A CONTA FEITA NA MÃO.
//
// Conferência em 31/10: ela contou R$ 300,00 (o "saldo final" do mês passado
// de que ela falou). Depois disso:
//   entrou  1.000 (vendas 02/11) + 2.000 (empréstimo 02/11)       = 3.000
//   saiu      400 (fornecedor 02/11) + 1.500 (freezer 03/11)      = 1.900
//   deveria ter  300 + 3.000 − 1.900                              = 1.400
//
// O empréstimo e o freezer são a prova de que aqui não é o DRE: nenhum dos
// dois é resultado da operação, e os dois mexeram no dinheiro.
//
// O movimento de 31/10 (R$ 9.000 de venda) NÃO pode entrar: já estava contado
// quando ela contou a gaveta naquele dia.
const ESPERADO = 'R$ 1.400,00';
const SE_SOMASSE_O_DIA_DA_CONFERENCIA = 'R$ 10.400,00';

const p0 = await painel();
await gravar({ ...p0,
  negocio: { nome: 'Pico do Mané', cidade: 'Florianópolis', dona: 'Karen', papeis: { dona: 'Karen' } },
  receitas: [
    { id: 'r0', data: '2026-10-31', valor: '9000', categoria: 'Caixa', descricao: 'Vendas de outubro' },
    { id: 'r1', data: '2026-11-02', valor: '1000', categoria: 'Caixa', descricao: 'Sábado' },
    { id: 'r2', data: '2026-11-02', valor: '2000', categoria: 'Empréstimo/Aporte', descricao: 'Empréstimo do banco' },
  ],
  despesas: [
    { id: 'd0', data: '2026-10-30', valor: '2000', categoria: 'Salários', descricao: 'equipe de outubro' },
    { id: 'd1', data: '2026-11-02', valor: '400', categoria: 'Fornecedores de insumo', descricao: 'Ambev' },
    { id: 'd2', data: '2026-11-03', valor: '1500', categoria: 'Investimento', descricao: 'Freezer novo' },
  ],
  conferenciasCaixa: [
    { id: 'c1', data: '2026-10-31', valor: 300, esperado: 300, criadoEm: '2026-10-31T22:00:00.000Z' },
  ],
  cardapio: [], fichas: [], estoque: [], compras: [], diario: [],
});

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const pg = await ctx.newPage();
await pg.clock.setFixedTime(HOJE);
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
pg.on('console', (m) => { const x = m.text(); if (m.type() === 'error' && !/status of 40/.test(x)) { console.log('[console]', x.slice(0, 160)); ruim++; } });

await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1800);
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

console.log('\n### O DASHBOARD CONTINUA CONTANDO SÓ O MÊS — ela pediu assim');
// Esta é a primeira coisa que eu quebraria sem perceber. Novembro tem R$ 3.000
// de entrada e R$ 1.900 de saída; os R$ 9.000 de outubro não podem aparecer.
let txt = await texto();
// O rótulo do quadradinho é maiúsculo na tela (innerText obedece o CSS), e o
// valor vem na linha de baixo. Procurar o valor solto no corpo inteiro não
// serviria: R$ 3.000,00 aparece em outros cantos e a asserção passaria à toa.
const kpi = (rot) => {
  const l = txt.split('\n');
  const i = l.findIndex((x) => x.trim().toUpperCase() === rot.toUpperCase());
  return i < 0 ? '(não achou)' : (l[i + 1] || '').trim();
};
// O Dashboard mede a OPERAÇÃO: o empréstimo de 2.000 e o freezer de 1.500
// ficam de fora dos dois primeiros quadradinhos, e está certo assim.
cobra('a receita do mês é só a operação de novembro', kpi('Receita do mês') === 'R$ 1.000,00', kpi('Receita do mês'));
cobra('a despesa do mês também', kpi('Despesas do mês') === 'R$ 400,00', kpi('Despesas do mês'));
// E o "Saldo Final" de lá é o do MÊS (600 de lucro + 2.000 de empréstimo −
// 1.500 do freezer = 1.100), não o acumulado. É exatamente a diferença que ela
// descreveu: esse zera na virada, o da tela nova não.
cobra('o "Saldo Final" de lá é o do mês, não o acumulado', kpi('Saldo Final') === 'R$ 1.100,00', kpi('Saldo Final'));
cobra('e não arrasta o faturamento de outubro', !/R\$ 12\.000,00/.test(txt));
cobra('nem mostra o saldo acumulado por lá', !new RegExp(ESPERADO.replace(/[.$]/g, '\\$&')).test(txt), (txt.match(/[^\n]*1\.400[^\n]*/) || [''])[0]);

console.log('\n### A TELA NOVA DIZ QUANTO DEVERIA TER');
await irPara('Finanças');
await irPara('Quanto eu tenho');
txt = await texto();
cobra('a tela abriu', /Quanto eu deveria ter/.test(txt), txt.slice(0, 90).replace(/\n/g, ' | '));
// O número GRANDE, não um "R$ 1.400,00" qualquer perdido na página: a lista
// mês a mês mostra valores parecidos, e procurar solto faz a asserção passar
// sozinha mesmo com a conta errada.
const deveriaTer = () => {
  const l = txt.split('\n');
  const i = l.findIndex((x) => /^deveria ter hoje$/i.test(x.trim()));
  return i < 0 ? '(não achou)' : (l[i + 1] || '').trim();
};
cobra(`deveria ter ${ESPERADO}`, deveriaTer() === ESPERADO, deveriaTer());
cobra('não somou o movimento do dia da conferência duas vezes', !txt.includes(SE_SOMASSE_O_DIA_DA_CONFERENCIA), (txt.match(/[^\n]*10\.400[^\n]*/) || [''])[0]);

console.log('\n### E MOSTRA DE ONDE VEM O NÚMERO');
// Conta que não mostra o caminho é conta que ela não usa.
cobra('diz quando ela contou', /Tu contou em 31\/10\/2026/.test(txt), (txt.match(/[^\n]*Tu contou[^\n]*/) || ['(não achou)'])[0]);
cobra('com o valor contado', /R\$ 300,00/.test(txt));
cobra('o que entrou depois', /\+ R\$ 3\.000,00/.test(txt), (txt.match(/[^\n]*Entrou depois[^\n]*\n[^\n]*/) || [''])[0]);
cobra('e o que saiu depois', /− R\$ 1\.900,00/.test(txt), (txt.match(/[^\n]*Saiu depois[^\n]*\n[^\n]*/) || [''])[0]);
cobra('avisa que é gaveta + banco', /gaveta/.test(txt) && /banco/.test(txt));

console.log('\n### AQUI ENTRA TUDO QUE MEXEU NO DINHEIRO, não só a operação');
// No DRE o empréstimo e o freezer ficam fora do lucro. No bolso, não ficam.
// Se esta tela usasse a régua do DRE, daria R$ 900 — e ela procuraria R$ 500
// que nunca existiram.
cobra('o empréstimo entrou na conta', /R\$ 3\.000,00/.test(txt));
cobra('o freezer saiu da conta', /R\$ 1\.900,00/.test(txt));
cobra('e NÃO deu R$ 900,00 (que seria a régua do DRE)', !/R\$ 900,00/.test(txt), (txt.match(/[^\n]*900,00[^\n]*/) || [''])[0]);

console.log('\n### MÊS A MÊS, SEM ZERAR');
// innerText obedece o CSS: o título da seção é maiúsculo na tela.
cobra('tem a linha do tempo acumulada', /mês a mês, sem zerar/i.test(txt), (txt.match(/[^\n]*[Mm]ês a mês[^\n]*/i) || ['(não achou)'])[0]);
cobra('com novembro acumulando em cima do que sobrou', /Nov\/2026/.test(txt), (txt.match(/[^\n]*Nov\/2026[^\n]*\n[^\n]*/) || [''])[0]);

console.log('\n### CONFERINDO: ELA CONTA E O APP DIZ A DIFERENÇA');
// É aqui que a tela ganha o dinheiro dela. A diferença não é fracasso: é a
// despesa que ninguém lançou aparecendo.
await pg.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find((e) => /Conferir agora/i.test(e.innerText || ''));
  if (x) x.click();
});
await pg.waitForTimeout(700);
await pg.evaluate(() => {
  const campo = [...document.querySelectorAll('input')].find((i) => i.inputMode === 'decimal');
  if (!campo) return;
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(campo, '1350');
  campo.dispatchEvent(new Event('input', { bubbles: true }));
});
await pg.waitForTimeout(600);
txt = await texto();
cobra('antes de salvar já mostra a diferença', /Faltam R\$ 50,00/.test(txt), (txt.match(/[^\n]*Faltam[^\n]*/) || ['(não achou)'])[0]);

await pg.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find((e) => /Salvar a conferência/i.test(e.innerText || ''));
  if (x) x.click();
});
await pg.waitForTimeout(2600);
txt = await texto();
cobra('depois de salvar, explica o que a falta costuma ser', /despesa paga e não lançada/.test(txt), (txt.match(/[^\n]*despesa paga[^\n]*/) || [''])[0]);
cobra('e o saldo passa a partir do valor contado', deveriaTer() === 'R$ 1.350,00', deveriaTer());

const p1 = await painel();
const confs = (p1.conferenciasCaixa || []);
cobra('a conferência ficou guardada', confs.length === 2, JSON.stringify(confs.map((c) => `${c.data}:${c.valor}`)));
const nova = confs.find((c) => Number(c.valor) === 1350);
// Guardar o esperado da ÉPOCA é o que faz o histórico valer: recalcular depois
// daria outro número, porque a âncora mudou.
cobra('e guardou o que o app esperava naquele dia', nova && Number(nova.esperado) === 1400, JSON.stringify(nova));

console.log('\n### O HISTÓRICO GUARDA O PADRÃO');
cobra('a conferência de hoje está na lista', /faltou R\$ 50,00/.test(txt), (txt.match(/[^\n]*faltou[^\n]*/) || ['(não achou)'])[0]);
cobra('e a primeira, que bateu, também', /bateu/.test(txt));

console.log('\n### SEM NENHUMA CONFERÊNCIA, O APP AVISA QUE É CHUTE');
// Número com cara de certeza e base de chute é como ela perde a confiança na
// tela inteira — inclusive quando ela estiver certa.
const p2 = await painel();
await gravar({ ...p2, conferenciasCaixa: [] });
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3800);
await irPara('Finanças');
await irPara('Quanto eu tenho');
txt = await texto();
cobra('diz com todas as letras que ainda é chute', /ainda é um chute/i.test(txt), (txt.match(/[^\n]*chute[^\n]*/) || ['(não achou)'])[0]);
cobra('e ensina o que fazer pra virar verdade', /Conta hoje quanto tu tem/.test(txt));
// Sem âncora ele soma tudo: 12.000 − 3.900 = 8.100.
cobra('somando tudo o que está lançado', deveriaTer() === 'R$ 8.100,00', deveriaTer());

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
