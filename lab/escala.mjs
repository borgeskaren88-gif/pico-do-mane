// "NO SÁBADO É UM DIA QUE UMA PESSOA SOZINHA NÃO DÁ CONTA."
//
// Ela já sabia disso — sente no salão. O que faltava era o número pra decidir
// o TAMANHO do reforço, e é aí que some dinheiro dos dois lados: contratar um
// turno inteiro quando o aperto são três horas, ou não contratar e perder mesa
// na porta.
//
// A tela de Movimento já dizia a que horas o bar enche. Isso não responde:
// encher é bom. A pergunta é quanto salão cada pessoa segura SOZINHA.
//
// O QUE ESTE TESTE GUARDA:
//
//   - a conta certa: mesas abertas AO MESMO TEMPO ÷ gente do salão de plantão;
//   - a cozinha NÃO conta como salão — somar ela faria o sábado parecer
//     coberto justamente quando o garçom estava sozinho;
//   - hora sem ninguém de plantão não vira "aperto infinito" nem "hora
//     tranquila": vira hora que não dá pra julgar, e a tela diz isso;
//   - dia com venda e sem ponto nenhum fica FORA da média. Senão o começo do
//     uso, quando ninguém batia ponto, viraria "zero garçom" e envergaria
//     todas as contas;
//   - e a tela termina em custo, que é o que decide. "Tá apertado" ela já
//     sabia.
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

// Relógio parado num domingo, pra janela pegar os sábados e quintas de trás.
const HOJE = new Date('2026-10-18T15:00:00Z');

// Florianópolis é UTC-3: 20h daqui são 23h em UTC.
const iso = (dia, horaLocal, min = 0) => {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCHours(horaLocal + 3, min, 0, 0);
  return d.toISOString();
};

// A CONTA FEITA NA MÃO:
//
//   SÁBADO (4 sábados iguais no período), UM garçom de plantão das 18h às 00h:
//     6 mesas abrem às 20h e ficam até as 23h  →  às 20h, 21h, 22h e 23h há 6
//     mesas abertas, com 1 pessoa em campo     →  6 mesas por pessoa
//
//   QUINTA (4 quintas), DOIS garçons das 18h às 00h:
//     2 mesas abrem às 20h e ficam até as 22h  →  2 mesas ÷ 2 pessoas = 1
//
//   A média das horas com movimento fica entre 1 e 6, então o sábado das 20h
//   às 23h sai como o aperto — e a quinta não.
const SABADOS = ['2026-09-26', '2026-10-03', '2026-10-10', '2026-10-17'];
const QUINTAS = ['2026-09-24', '2026-10-01', '2026-10-08', '2026-10-15'];

const vendas = [];
let n = 0;
for (const d of SABADOS) {
  for (let i = 0; i < 6; i++) {
    vendas.push({ id: `s${n}`, data: d, pessoas: 2, total: 180,
      abertaEm: iso(d, 20), fechadaEm: iso(d, 23) });
    n += 1;
  }
}
for (const d of QUINTAS) {
  for (let i = 0; i < 2; i++) {
    vendas.push({ id: `q${n}`, data: d, pessoas: 2, total: 150,
      abertaEm: iso(d, 20), fechadaEm: iso(d, 22) });
    n += 1;
  }
}

const pontos = [];
for (const d of SABADOS) {
  pontos.push({ id: `ps${d}`, nome: 'Bruna', papel: 'garcom', data: d, entrada: iso(d, 18), saida: iso(d, 24) });
  // A COZINHA NÃO É SALÃO. Se entrar na conta, o sábado vira 3 por pessoa e o
  // aperto some — justamente no dia em que o garçom estava sozinho.
  pontos.push({ id: `pc${d}`, nome: 'Seu Zé', papel: 'cozinha', data: d, entrada: iso(d, 18), saida: iso(d, 24) });
}
for (const d of QUINTAS) {
  pontos.push({ id: `pq1${d}`, nome: 'Bruna', papel: 'garcom', data: d, entrada: iso(d, 18), saida: iso(d, 24) });
  pontos.push({ id: `pq2${d}`, nome: 'Carla', papel: 'garcom', data: d, entrada: iso(d, 18), saida: iso(d, 24) });
}
// UM DIA COM VENDA E SEM PONTO NENHUM: é o começo do uso, quando a equipe
// ainda não batia ponto. Não pode virar "zero garçom" e envergar a média.
vendas.push({ id: 'velho', data: '2026-09-19', pessoas: 2, total: 400, abertaEm: iso('2026-09-19', 20), fechadaEm: iso('2026-09-19', 23) });

const p0 = await painel();
await gravar({ ...p0, cardapio: [], fichas: [], estoque: [], compras: [], receitas: [], despesas: [], diario: [] });
for (const v of vendas) await por(`venda:${v.id}`, v);
for (const r of pontos) await por(`ponto:${r.id}`, r);
// Salário do Atendimento, pra tela conseguir dizer o custo do reforço.
// 6h por turno × 2 dias por semana ≈ a escala; o número exato sai da conta do
// próprio sistema — aqui só se confere que ele APARECE e não fica no vazio.
await fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify([{ chave: `${MARCA}jornadas`, valor: {
    garcom: { nome: 'Atendimento', dias: [4, 6], entrada: '18:00', saida: '00:00', salarioMes: '1800' },
  } }]) });

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 }, serviceWorkers: 'block' });
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

await irPara('Log Operacional');
await irPara('Movimento');
await pg.waitForTimeout(2200);

console.log('\n### A TELA EXISTE E RESPONDE A PERGUNTA DELA');
let txt = await texto();
cobra('tem a seção "Quanta gente o salão precisa"', /Quanta gente o salão precisa/i.test(txt), (txt.match(/[^\n]*Quanta gente[^\n]*/i) || ['(não achou)'])[0]);
cobra('aponta o SÁBADO como o aperto', /O aperto é[\s\S]{0,30}sábado/i.test(txt), (txt.match(/[^\n]*O aperto é[^\n]*/i) || ['(não apontou)'])[0]);
cobra('e a faixa certa: das 20h às 00h', /O aperto é sábado, das 20h às 00h/.test(txt), (txt.match(/[^\n]*O aperto é[^\n]*/) || [''])[0]);
cobra('NÃO aponta a quinta, que estava coberta', !/O aperto é[\s\S]{0,30}quinta/i.test(txt));

console.log('\n### A CONTA: 6 MESAS PRA UMA PESSOA SÓ');
cobra('diz 6 mesas por pessoa', /segurou 6 mesas ao mesmo tempo/.test(txt), (txt.match(/[^\n]*Nessas horas[^\n]*/) || ['(não achou a frase)'])[0]);
cobra('com 1 pessoa em campo', /com 1 pessoa/.test(txt), (txt.match(/[^\n]*pessoa\(s\) em campo[^\n]*/) || [''])[0]);
// A COZINHA NÃO É SALÃO. Contando ela, seriam 2 pessoas e daria 3 por pessoa.
cobra('a cozinha não entrou na conta (não seria 3)', !/3 mesas\b[\s\S]{0,30}ao mesmo tempo/.test(txt));

console.log('\n### E TERMINA EM DINHEIRO, QUE É O QUE DECIDE');
// "Tá apertado" ela já sabia. O que ela não tem é o preço de resolver.
cobra('diz o custo de cobrir só essas horas', /Cobrir só essas/.test(txt), (txt.match(/[^\n]*Cobrir só essas[^\n]*/) || ['(não diz o custo)'])[0]);
cobra('com valor por sábado e por mês', /por sábado[\s\S]{0,40}no mês/.test(txt), (txt.match(/[^\n]*no mês[^\n]*/) || [''])[0]);
cobra('e quanto teria que entrar pra empatar', /Pra empatar, teria que entrar/.test(txt));
// Honestidade: garçom não gera venda sozinho, evita perder. Prometer retorno
// seria vender uma conta que não existe.
cobra('não promete que o reforço se paga', /Ninguém garante que o reforço se paga/.test(txt));

console.log('\n### O QUE NÃO DÁ PRA JULGAR, A TELA NÃO PINTA DE VERDE');
cobra('explica o quadrado vazio', /não é hora tranquila/.test(txt), (txt.match(/[^\n]*hora tranquila[^\n]*/) || [''])[0]);
cobra('e diz quantos dias entraram na conta', /Conta com \d+ dia\(s\)/.test(txt), (txt.match(/[^\n]*Conta com[^\n]*/) || [''])[0]);
// 8 dias (4 sábados + 4 quintas). O dia sem ponto NÃO entra — senão viraria
// "zero garçom" e envergaria tudo.
cobra('o dia sem ponto ficou de fora (8, não 9)', /Conta com 8 dia\(s\)/.test(txt), (txt.match(/[^\n]*Conta com[^\n]*/) || [''])[0]);

console.log('\n### SEM PONTO NENHUM, ELA DIZ ISSO — não inventa grade');
for (const r of pontos) await fetch(`${BANCO}?chave=eq.${MARCA}ponto:${r.id}`, { method: 'DELETE' });
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3800);
await irPara('Log Operacional');
await irPara('Movimento');
await pg.waitForTimeout(2200);
txt = await texto();
cobra('avisa que ainda não dá pra fazer a conta', /Ainda não dá pra fazer esta conta/.test(txt), (txt.match(/[^\n]*Ainda não dá[^\n]*/) || ['(fingiu que dava)'])[0]);
cobra('e diz o que falta: bater ponto', /precisa bater ponto/.test(txt));
cobra('sem apontar aperto nenhum', !/O aperto é/.test(txt));

console.log('\n### O CENÁRIO DO PRINT DELA: metade das comandas sem hora, e um dia só');
// A tela dela disse "O aperto é domingo" em negrito — e lá no rodapé, em letra
// clara, que 208 comandas tinham ficado de fora. Quem lê decide pelo negrito.
// Pior: a frase do custo terminava em "quem olha o salão no SÁBADO é que
// sabe", escrito na mão por mim, brigando com o domingo do título logo acima.
for (const r of pontos) await por(`ponto:${r.id}`, r);
// Em metade dos sábados as comandas não guardaram a hora de abertura.
for (const d of [SABADOS[0], SABADOS[1]]) {
  for (let i = 0; i < 6; i++) {
    await fetch(`${BANCO}?chave=eq.${MARCA}venda:s${SABADOS.indexOf(d) * 6 + i}`, { method: 'DELETE' });
    await por(`venda:cega-${d}-${i}`, { id: `cega-${d}-${i}`, data: d, pessoas: 2, total: 180, fechadaEm: iso(d, 23) });
  }
}
// E um DOMINGO mais apertado que o sábado, de propósito: com o aperto caindo
// noutro dia, um nome de dia escrito na mão na tela fica visivelmente errado.
// Sem isto o teste não distingue "{aperto.dia}" de "sábado" chumbado.
const DOMINGOS = ['2026-09-27', '2026-10-04', '2026-10-11'];
for (const d of DOMINGOS) {
  for (let i = 0; i < 10; i++) {
    await por(`venda:d${d}-${i}`, { id: `d${d}-${i}`, data: d, pessoas: 2, total: 90, abertaEm: iso(d, 17), fechadaEm: iso(d, 20) });
  }
  // E comandas cegas também no domingo, pra a proporção continuar ruim: o
  // aviso de "estou vendo pouco" tem que seguir aparecendo.
  for (let i = 0; i < 9; i++) {
    await por(`venda:dc${d}-${i}`, { id: `dc${d}-${i}`, data: d, pessoas: 2, total: 90, fechadaEm: iso(d, 20) });
  }
  await por(`ponto:pd${d}`, { id: `pd${d}`, nome: 'Bruna', papel: 'garcom', data: d, entrada: iso(d, 16), saida: iso(d, 23) });
}
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3800);
await irPara('Log Operacional');
await irPara('Movimento');
await pg.waitForTimeout(2200);
txt = await texto();
cobra('o aperto mudou pro domingo, que está pior', /O aperto é domingo/.test(txt), (txt.match(/[^\n]*O aperto é[^\n]*/) || ['(sem título)'])[0]);
cobra('avisa ANTES que está vendo pouco', /Esta conta está vendo pouco do teu salão/.test(txt), (txt.match(/[^\n]*vendo pouco[^\n]*/) || ['(só avisou no rodapé)'])[0]);
cobra('diz quantos atendimentos entraram e quantos não', /só \d+ guardaram a hora/.test(txt), (txt.match(/[^\n]*Dos \d+ atendimentos[^\n]*/) || ['(não achou a minha frase)'])[0]);
cobra('e manda usar como pista, não como decisão', /pista, não como decisão/.test(txt));

console.log('\n### E A FRASE DO CUSTO FALA DO MESMO DIA DO TÍTULO');
// Duas frases brigando na mesma tela é o que eu passei o dia tirando daqui.
const dia = (txt.match(/O aperto é ([^,\n]+),/) || [])[1] || '';
cobra('achou o dia do título', !!dia, dia || '(sem título)');
cobra(`a frase do custo também diz "${dia}"`, new RegExp(`quem olha o salão no ${dia} é que sabe`).test(txt), (txt.match(/[^\n]*quem olha o salão[^\n]*/) || [''])[0]);
cobra('e não um dia escrito na mão', !/quem olha o salão no sábado é que sabe/.test(txt) || dia === 'sábado');

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
