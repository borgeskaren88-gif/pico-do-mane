// "SIM, POUPE FAZER O AVISO DO TETO" — ela é MEI e pediu pra ser avisada antes
// de bater no limite.
//
// Estourar o teto do MEI sem perceber é dos perrengues mais caros que existem
// pra quem é microempreendedor, e ele não avisa: chega como cobrança da Receita
// no ano seguinte. O sistema já tem toda a receita lançada, então ele pode
// somar o ano e dizer a única coisa que importa: NO RITMO DE AGORA, QUANDO?
//
// O QUE ESTE TESTE GUARDA:
//
//   - empréstimo e aporte NÃO são faturamento. Se entrarem na soma, o aviso
//     dispara antes da hora e ela paga contador por nada — ou pior, segura
//     venda achando que está perto do teto;
//   - as três situações da lei, que têm consequências MUITO diferentes:
//     dentro do teto, passou até 20% (sai dia 1º de janeiro do ano que vem) e
//     passou de 20% (desenquadramento RETROATIVO ao começo deste ano);
//   - a projeção, que é a parte útil: com 70 mil em outubro ela ainda está
//     "dentro", e é justamente aí que precisa ouvir que em dezembro acaba.
//
// O RELÓGIO É FIXADO em 18/10/2026 de propósito. A projeção depende de quantos
// dias do ano já passaram; sem fixar, os números mudariam a cada dia e o teste
// só poderia conferir coisas vagas. Com data fixa dá pra cobrar o centavo
// contra a conta feita na mão.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
const limpa = (s) => String(s || '').replace(/ /g, ' ');

// A CONTA FEITA NA MÃO, com o relógio parado em 18/10/2026:
//   dias corridos do ano ... 291 (31+28+31+30+31+30+31+31+30 = 273, +18)
//   dias do ano ............ 365 (2026 não é bissexto)
//   teto ................... R$ 81.000 · tolerância 20% → R$ 97.200
//
//   faturado 20.000 → 24,7% do teto · média 68,73/dia · projeção R$ 25.085,91
//   faturado 70.000 → 86,4% do teto · média 240,55/dia · projeção R$ 87.800,69
//                     bate no teto no dia 337 do ano = 3 de dezembro
const HOJE = new Date('2026-10-18T15:00:00Z'); // 12:00 em São Paulo

const receita = (id, dia, valor, categoria = 'Caixa') => ({ id, data: dia, valor: String(valor), categoria, desc: 'venda' });

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 950 }, serviceWorkers: 'block' });
const pg = await ctx.newPage();
await pg.clock.setFixedTime(HOJE);
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
pg.on('console', (m) => { const x = m.text(); if (m.type() === 'error' && !/status of 40/.test(x)) { console.log('[console]', x.slice(0, 160)); ruim++; } });

const p0 = await painel();
await gravar({ ...p0, receitas: [receita('r1', '2026-03-10', 20000)], despesas: [], compras: [], diario: [], mei: undefined });

await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1600);
await pg.locator('button:text-is("Dona")').first().click();
await pg.locator('input[type="password"]').first().fill('Teste@123');
await pg.locator('button:has-text("Entrar")').first().click();
await pg.waitForTimeout(3800);

const irPara = async (rot) => {
  const achou = await pg.evaluate((r) => {
    const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === r);
    if (x) { x.click(); return true; }
    return false;
  }, rot);
  await pg.waitForTimeout(1700);
  return achou;
};
// Só o card do teto — o resto do relatório tem dinheiro por toda parte e um
// match solto pegaria número de outro lugar.
const cartao = async () => limpa(await pg.evaluate(() => {
  const t = [...document.querySelectorAll('span')].find((d) => /^Teto do MEI/i.test((d.textContent || '').trim()));
  const card = t && t.closest('div[style*="border-radius"]');
  return card ? card.innerText : '';
}));
const abrirRelatorio = async () => {
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3600);
  await irPara('Finanças');
  await irPara('Relatórios');
  await pg.waitForTimeout(700);
};
const cenario = async (receitas, extra = {}) => {
  const p = await painel();
  await gravar({ ...p, receitas, ...extra });
  await abrirRelatorio();
  return cartao();
};

cobra('achou o caminho "Finanças"', await irPara('Finanças'));
cobra('achou o caminho "Relatórios"', await irPara('Relatórios'));
await pg.waitForTimeout(700);

console.log('\n### longe do teto: o aviso existe, mas fala baixo');
let c = await cartao();
// O título vem em CAIXA ALTA porque o CSS manda, e innerText obedece ao CSS.
cobra('o card do teto aparece', /Teto do MEI/i.test(c), c.split('\n').slice(0, 3).join(' | '));
cobra('mostra o faturado do ano (R$ 20.000,00)', c.includes('R$ 20.000,00'), (c.match(/[^\n]*20\.000[^\n]*/) || [''])[0]);
cobra('e a % do teto (25%)', /25% do teto/.test(c), (c.match(/[^\n]*% do teto[^\n]*/) || [''])[0]);
cobra('diz o limite de R$ 81.000,00', c.includes('R$ 81.000,00'));
cobra('projeta o fim do ano em R$ 25.085,91', c.includes('R$ 25.085,91'), (c.match(/[^\n]*fecha o ano[^\n]*/) || ['(não projetou)'])[0]);
cobra('e diz quanto ainda cabe (R$ 61.000,00)', c.includes('R$ 61.000,00'));
cobra('não fala em contador a esta altura', !/contador/i.test(c));

console.log('\n### EMPRÉSTIMO NÃO É FATURAMENTO');
// Se entrar na soma, o aviso dispara antes da hora — e ela segura venda ou
// paga contador por nada.
c = await cenario([receita('r1', '2026-03-10', 20000), receita('r2', '2026-04-02', 50000, 'Empréstimo/Aporte')]);
cobra('os R$ 50.000 de aporte ficam de fora', c.includes('R$ 20.000,00') && !c.includes('R$ 70.000,00'), (c.match(/[^\n]*% do teto[^\n]*/) || [''])[0]);

console.log('\n### no ritmo de dezembro: avisa ANTES, com data');
// É este o caso que justifica a feature. Ela ainda está "dentro" e por isso
// não desconfia de nada — mas o ano não acaba antes do teto.
c = await cenario([receita('r1', '2026-03-10', 70000)]);
cobra('mostra 86% do teto', /86% do teto/.test(c), (c.match(/[^\n]*% do teto[^\n]*/) || [''])[0]);
cobra('projeta R$ 87.800,69 pro fim do ano', c.includes('R$ 87.800,69'), (c.match(/[^\n]*ritmo de agora[^\n]*/) || [''])[0]);
cobra('e diz que bate no teto em 3 de dezembro', /3 de dezembro/.test(c), (c.match(/[^\n]*dezembro[^\n]*/) || ['(não disse quando)'])[0]);
cobra('sugere o que fazer (segurar ou virar ME)', /contador|ME\b/.test(c));

console.log('\n### passou do teto, mas dentro dos 20%: sai em 1º de janeiro');
c = await cenario([receita('r1', '2026-03-10', 85000)]);
cobra('aponta o excesso de R$ 4.000,00', c.includes('R$ 4.000,00'), (c.match(/[^\n]*passou o teto[^\n]*/) || [''])[0]);
cobra('cita a tolerância de R$ 97.200,00', c.includes('R$ 97.200,00'));
cobra('explica o DAS complementar', /DAS complementar/i.test(c));
cobra('e que o desenquadramento é em 1º de janeiro de 2027', /1º de janeiro de 2027/.test(c), (c.match(/[^\n]*2027[^\n]*/) || [''])[0]);
// A primeira versão cobrava que a palavra "retroativo" nem aparecesse aqui —
// e o app estava MAIS certo que o teste: ele avisa que vira retroativo SE ela
// continuar, que é o recado que faz ela agir a tempo. O que não pode é dizer
// que já aconteceu. A diferença entre as duas frases é o ano inteiro de
// imposto, então é essa distinção que o teste cobra.
cobra('avisa o risco de virar retroativo SE continuar', /se o ritmo continuar/i.test(c));
cobra('mas NÃO diz que já é retroativo a 1º de janeiro deste ano', !/retroativo a 1º de janeiro/i.test(c), (c.match(/[^\n]*retroativ[^\n]*/) || [''])[0]);

console.log('\n### passou de 20%: aí é RETROATIVO, e o recado muda de tom');
c = await cenario([receita('r1', '2026-03-10', 100000)]);
cobra('diz que passou mais de 20%', /mais de 20%/.test(c), (c.match(/[^\n]*20%[^\n]*/) || [''])[0]);
cobra('e que é retroativo a 1º de janeiro de 2026', /retroativo a 1º de janeiro de 2026/.test(c), (c.match(/[^\n]*retroativ[^\n]*/) || ['(não avisou)'])[0]);
cobra('manda procurar contador esta semana', /contador esta semana/i.test(c));

console.log('\n### o teto é editável — a lei muda e o número não pode ficar velho');
c = await cenario([receita('r1', '2026-03-10', 85000)], { mei: { ativo: true, teto: '110000' } });
cobra('com teto de 110 mil, 85 mil está dentro', c.includes('R$ 110.000,00') && !/passou o teto/.test(c), (c.match(/[^\n]*% do teto[^\n]*/) || [''])[0]);
cobra('e a % acompanha (77%)', /77% do teto/.test(c), (c.match(/[^\n]*% do teto[^\n]*/) || [''])[0]);

console.log('\n### quem não é MEI desliga, e fica desligado');
c = await cenario([receita('r1', '2026-03-10', 85000)], { mei: { ativo: false, teto: '81000' } });
cobra('o card some', c === '', c.slice(0, 60));
const txt = limpa(await pg.locator('body').innerText());
cobra('e sobra só a linha pra religar', /aviso de teto do MEI está desligado/.test(txt));

console.log('\n### ano sem faturamento não inventa aviso');
c = await cenario([receita('r1', '2025-03-10', 40000)], { mei: { ativo: true, teto: '81000' } });
cobra('receita de outro ano não conta', c === '', c.slice(0, 80));

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
