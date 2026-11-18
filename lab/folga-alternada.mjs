// "A SARAH TRABALHA DE QUARTA A DOMINGO, 16h ÀS 00h, E FOLGA DOIS SÁBADOS NO
// MÊS: UM SIM, UM NÃO."
//
// O Ponto só sabia dia fixo da semana. Com o sábado marcado, os sábados de
// folga viravam FALTA (ela apareceria devendo 16h todo mês); sem ele, os
// sábados de trabalho viravam HORA EXTRA. Os dois erram o saldo e o valor da
// hora — e o saldo é o que a Sarah vê na tela dela.
//
// O que este teste guarda:
//   - a conta do mês: outubro de 2026 tem 21 dias de escala dela (e não 23);
//   - o sábado de folga não é falta, e trabalhado vira hora extra;
//   - o valor da hora sai dos 21 dias (R$ 1.500 ÷ 168h);
//   - na tela da dona: escolher "Sábados: um sim, um não", um sábado em que
//     ela trabalha, e ver os próximos sábados dela antes de salvar;
//   - o servidor não guarda uma regra torta (data que não cai no sábado).
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const linha = async (chave) => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}${chave}`)).json())[0]?.valor;
const limpa = (s) => String(s || '').replace(/ /g, ' ');

// A conta, direto da biblioteca do app (o mesmo arquivo que a tela usa).
const fonte = readFileSync(new URL('../lib/ponto.js', import.meta.url), 'utf8');
const P = await import('data:text/javascript;base64,' + Buffer.from(fonte).toString('base64'));

console.log('\n### A CONTA DO MÊS');
const sarah = { dias: [0, 3, 4, 5, 6], entrada: '16:00', saida: '00:00', salarioMes: 1500, alternado: { dia: 6, base: '2026-10-03' } };
const semRegra = { ...sarah, alternado: undefined };
// Outubro de 2026: qua 4, qui 5, sex 5, dom 4, e sábados 3, 17 e 31 (o 10 e o 24 são folga).
cobra('outubro: 21 dias de escala (e não 23)', P.diasDeEscalaDoMes(sarah, '2026-10') === 21 && P.diasDeEscalaDoMes(semRegra, '2026-10') === 23,
  `${P.diasDeEscalaDoMes(sarah, '2026-10')} com a regra, ${P.diasDeEscalaDoMes(semRegra, '2026-10')} sem`);
cobra('sábado 03/10 trabalha, 10/10 folga, 17/10 trabalha', P.trabalhaNoDia(sarah, '2026-10-03') && !P.trabalhaNoDia(sarah, '2026-10-10') && P.trabalhaNoDia(sarah, '2026-10-17'));
cobra('e pra trás também: 26/09 folga, 19/09 trabalha', !P.trabalhaNoDia(sarah, '2026-09-26') && P.trabalhaNoDia(sarah, '2026-09-19'));
cobra('segunda e terça: folga sempre', !P.trabalhaNoDia(sarah, '2026-10-05') && !P.trabalhaNoDia(sarah, '2026-10-06'));
cobra('quarta a sexta e domingo: todo semana', ['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-11', '2026-10-14'].every((d) => P.trabalhaNoDia(sarah, d)));
cobra('na média, 4,5 dias por semana', P.diasPorSemana(sarah) === 4.5 && P.diasPorSemana(semRegra) === 5);
// R$ 1.500 ÷ (21 × 8h) = R$ 8,93.
cobra('a hora de outubro: R$ 1.500 ÷ 168h = R$ 8,93', Math.round(P.valorHoraDoMes(sarah, '2026-10') * 100) === 893, String(P.valorHoraDoMes(sarah, '2026-10')));

console.log('\n### O SALDO DELA');
const turno = (dia) => ({ id: dia, data: dia, entrada: `${dia}T19:00:00.000Z`, saida: new Date(Date.parse(`${dia}T19:00:00.000Z`) + 8 * 3600e3).toISOString() });
const todos = [];
for (let d = 1; d <= 31; d += 1) { const iso = `2026-10-${String(d).padStart(2, '0')}`; if (P.trabalhaNoDia(sarah, iso)) todos.push(turno(iso)); }
let s = P.saldoDaPessoa(todos, sarah, '2026-10', '2026-11-18');
cobra('trabalhou todos os 21 dias: em dia, sem falta', s.saldo === 0 && s.faltas.length === 0, `saldo ${s.saldo}, faltas ${s.faltas.join(',')}`);
const comMal = P.saldoDaPessoa(todos, semRegra, '2026-10', '2026-11-18');
cobra('(sem a regra, os dois sábados de folga apareciam como 16h devendo)', comMal.saldo === -16 && comMal.faltas.join(',') === '2026-10-10,2026-10-24', `${comMal.saldo} ${comMal.faltas.join(',')}`);
s = P.saldoDaPessoa([...todos, turno('2026-10-10')], sarah, '2026-10', '2026-11-18');
cobra('cobriu o sábado de folga 10/10: +8h de hora extra', s.saldo === 8 && s.extras === 1, `saldo ${s.saldo}, extras ${s.extras}`);
s = P.saldoDaPessoa(todos.filter((t) => t.data !== '2026-10-17'), sarah, '2026-10', '2026-11-18');
cobra('faltou no sábado 17/10 (que era de trabalho): −8h', s.saldo === -8 && s.faltas.join(',') === '2026-10-17', `saldo ${s.saldo}, faltas ${s.faltas.join(',')}`);

// ---------------------------------------------------------------------------
console.log('\n### NA TELA DA DONA');
const HOJE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const somaDias = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
let sab = HOJE; while (new Date(`${sab}T12:00:00Z`).getUTCDay() !== 6) sab = somaDias(sab, 1);
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const pg = await ctx.newPage();
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
await pg.goto(BASE); await pg.waitForTimeout(1800);
await pg.locator('select[data-quem]').selectOption('dona');
await pg.locator('input[type="password"]').fill('Teste@123');
await pg.locator('button:has-text("Entrar")').click(); await pg.waitForTimeout(4000);
const tocar = (rot) => pg.evaluate((r) => { const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').replace(/ /g, ' ').trim().toLowerCase() === r.toLowerCase()); if (x) { x.click(); return true; } return false; }, rot);
await tocar('Ponto'); await pg.waitForTimeout(2000);
cobra('abriu a configuração da jornada', await tocar('Configurar jornada (horas esperadas)'));
await pg.waitForTimeout(600);
const bloco = pg.locator('[data-jornada="gerente"]');
await bloco.locator('input').first().fill('Sarah Lima');
await bloco.locator('input[inputmode="decimal"]').fill('1500');
for (const d of ['Dom', 'Qua', 'Qui', 'Sex', 'Sáb']) await bloco.locator(`button:text-is("${d}")`).click();
await bloco.locator('input[type="time"]').nth(0).fill('16:00');
await bloco.locator('input[type="time"]').nth(1).fill('00:00');
await pg.waitForTimeout(300);
cobra('com os 5 dias marcados: 40h por semana', /5 dia\(s\) × 8h = 40h\/semana/.test(limpa(await bloco.locator('[data-jornada-semana]').innerText())), limpa(await bloco.locator('[data-jornada-semana]').innerText()));
await bloco.locator('[data-alternado] select').selectOption('6');
// Primeiro, uma data errada (sexta): a tela avisa e não aceita.
await bloco.locator('[data-alternado] input[type="date"]').fill(somaDias(sab, -1));
await pg.waitForTimeout(300);
cobra('data que não é sábado: a tela avisa', /Essa data não é um sábado/.test(limpa(await bloco.locator('[data-alternado]').innerText())));
await bloco.locator('[data-alternado] input[type="date"]').fill(sab);
await pg.waitForTimeout(300);
const prox = limpa(await bloco.locator('[data-proximos]').innerText().catch(() => ''));
const esperados = [sab, somaDias(sab, 14), somaDias(sab, 28)].map(ddmm).join(', ');
cobra(`mostra os próximos sábados dela, de 15 em 15 dias: ${esperados}`, prox.includes(esperados), prox);
cobra('e a semana fica "4,5 dias × 8h = 36h/semana, em média"', /4,5 dias × 8h = 36h\/semana, em média/.test(limpa(await bloco.locator('[data-jornada-semana]').innerText())), limpa(await bloco.locator('[data-jornada-semana]').innerText()));
await tocar('Salvar jornada'); await pg.waitForTimeout(2500);
const jg = (await linha('jornadas') || {}).gerente || {};
cobra('salvou: quarta a domingo, 16h–00h, R$ 1.500, sábado um sim um não', JSON.stringify(jg.dias) === '[0,3,4,5,6]' && jg.entrada === '16:00' && jg.saida === '00:00' && jg.salarioMes === 1500 && jg.alternado?.dia === 6 && jg.alternado?.base === sab, JSON.stringify(jg));

console.log('\n### O SERVIDOR NÃO GUARDA REGRA TORTA');
const torta = await pg.evaluate(async (x) => (await (await fetch('/api/ponto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'jornadas', jornadas: { gerente: { nome: 'Sarah Lima', dias: [0, 3, 4, 5, 6], entrada: '16:00', saida: '00:00', salarioMes: 1500, alternado: { dia: 6, base: x } } } }) })).json()), somaDias(sab, -1));
cobra('data-base numa sexta: a regra não é guardada', torta.ok && !torta.jornadas?.gerente?.alternado, JSON.stringify(torta.jornadas?.gerente?.alternado || null));
const fora = await pg.evaluate(async (x) => (await (await fetch('/api/ponto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'jornadas', jornadas: { gerente: { nome: 'Sarah Lima', dias: [0, 3, 4, 5], entrada: '16:00', saida: '00:00', alternado: { dia: 6, base: x } } } }) })).json()), sab);
cobra('sábado fora da escala: a regra também não', fora.ok && !fora.jornadas?.gerente?.alternado, JSON.stringify(fora.jornadas?.gerente?.alternado || null));

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
