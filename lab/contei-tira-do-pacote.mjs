// "TEM 7,1 KG DE BATATA QUE ERAM OS PACOTES, AÍ PEGUEI UM PACOTE E FIZ 4 SACOS
//  DE 400 G. NÃO DEVERIA DIMINUIR NO PACOTE?"
//
// Deveria. Saco não nasce sozinho. Quando ela conta os freezers e acha sacos a
// MAIS do que o sistema sabia, é porque ensacou sem apertar "Separei" — e o
// pacote fechado continuava com a mesma batata (contada duas vezes).
//   Batata frita 7,1 kg, saco de 400 g, antes 0 sacos, contou 4 na frente
//   → 4 × 0,4 = 1,6 kg saem → pacote fica 5,5 kg
// Dá pra recusar (a caixa vem marcada): contagem que só corrige erro não
// mexe no pacote.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
const limpa = (s) => String(s || '').replace(/[  ]/g, ' ');

const semear = async () => {
  const p0 = await painel();
  await gravar({ ...p0, estoque: [
    { id: 'bat', nome: 'Batata frita', custo: '10,25', unidade: 'kg', saldo: '7,1', minimo: '2', categoria: 'Cozinha' },
    { id: 'bat400', nome: 'Batata 400g', custo: '0', unidade: 'pct', saldo: '0', linha: 0, salva: 0, categoria: 'Cozinha', separar: { brutoId: 'bat', gramas: 400, unidade: 'g', minLinha: 4, minSalva: 2 } },
  ] });
};
await semear();

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, serviceWorkers: 'block' });
const pg = await ctx.newPage();
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1600);
await pg.locator('select[data-quem]').selectOption({ label: 'Dona' });
await pg.locator('input[type="password"]').first().fill('Teste@123');
await pg.locator('button:has-text("Entrar")').first().click();
await pg.waitForTimeout(3800);
const clicar = (rot) => pg.evaluate((r) => { const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === r); if (x) { x.click(); return true; } return false; }, rot);
const texto = async () => limpa(await pg.locator('body').innerText());
const item = async (id) => (await painel()).estoque.find((i) => i.id === id);

const abrirContei = async () => {
  await clicar('Abastecimento'); await pg.waitForTimeout(1700);
  await pg.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === 'Contei'); if (x) x.click(); });
  await pg.waitForTimeout(500);
};

console.log('\n### contou 4 sacos a mais → a tela pergunta e tira 1,6 kg do pacote');
await abrirContei();
const q = pg.locator('input[inputmode="decimal"], input[type="text"]');
// os dois campos da contagem: frente e fundo
const campos = await pg.evaluate(() => [...document.querySelectorAll('div')].filter((d) => /Quanto tem AGORA em cada freezer/.test(d.innerText || '') && d.querySelectorAll('input').length >= 2).map((d) => d.querySelectorAll('input').length).slice(-1));
cobra('abriu o formulário de contagem', campos.length > 0);
await pg.evaluate(() => {
  const caixa = [...document.querySelectorAll('div')].filter((d) => /Quanto tem AGORA em cada freezer/.test(d.innerText || '') && d.querySelectorAll('input[type="text"],input:not([type])').length >= 2).slice(-1)[0];
  const ins = [...caixa.querySelectorAll('input')].filter((i) => i.type !== 'checkbox');
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(ins[0], '4'); ins[0].dispatchEvent(new Event('input', { bubbles: true }));
  set.call(ins[1], '0'); ins[1].dispatchEvent(new Event('input', { bubbles: true }));
});
await pg.waitForTimeout(500);
let t = await texto();
cobra('mostra a pergunta com "tirar 1,6 kg de Batata frita"', /tirar 1,6 kg de Batata frita/.test(t), (t.match(/[^\n]*saíram do pacote[^\n]*/) || ['(sem pergunta)'])[0]);
cobra('a caixa já vem marcada', await pg.locator('label[data-tirar-pacote] input').isChecked());
await clicar('Confirmar'); await pg.waitForTimeout(1500);
let bat = await item('bat'); let s400 = await item('bat400');
cobra('o pacote caiu de 7,1 para 5,5 kg', Math.abs(Number(String(bat.saldo).replace(',', '.')) - 5.5) < 0.001, String(bat.saldo));
cobra('os 4 sacos ficaram na frente', Number(s400.linha) === 4 && Number(s400.saldo) === 4, JSON.stringify({ l: s400.linha, s: s400.salva, sd: s400.saldo }));
cobra('o saco passou a custar R$ 4,10 (0,4 × 10,25)', Math.abs(Number(String(s400.custo).replace(',', '.')) - 4.1) < 0.001, String(s400.custo));
cobra('o histórico do pacote diz de onde saiu', (bat.movimentos || []).some((m) => /Separado em 4 × Batata 400g/.test(m.motivo)));

console.log('\n### contagem SEM sacos a mais não mexe no pacote');
await abrirContei();
t = await texto();
cobra('não pergunta nada (contagem igual à anterior)', !/saíram do pacote/.test(t));
await clicar('Confirmar'); await pg.waitForTimeout(1200);
bat = await item('bat');
cobra('pacote continua em 5,5 kg', Math.abs(Number(String(bat.saldo).replace(',', '.')) - 5.5) < 0.001, String(bat.saldo));

console.log('\n### desmarcou a caixa: só conta, não mexe no pacote');
await abrirContei();
await pg.evaluate(() => {
  const caixa = [...document.querySelectorAll('div')].filter((d) => /Quanto tem AGORA em cada freezer/.test(d.innerText || '') && d.querySelectorAll('input').length >= 2).slice(-1)[0];
  const ins = [...caixa.querySelectorAll('input')].filter((i) => i.type !== 'checkbox');
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(ins[0], '6'); ins[0].dispatchEvent(new Event('input', { bubbles: true }));
});
await pg.waitForTimeout(400);
await pg.locator('label[data-tirar-pacote] input').uncheck();
await clicar('Confirmar'); await pg.waitForTimeout(1500);
bat = await item('bat'); s400 = await item('bat400');
cobra('pacote intacto (5,5 kg)', Math.abs(Number(String(bat.saldo).replace(',', '.')) - 5.5) < 0.001, String(bat.saldo));
cobra('mas a contagem valeu: 6 na frente', Number(s400.linha) === 6, String(s400.linha));

await b.close();
console.log(ruim ? `\n${ruim} RUIM` : '\nTUDO OK');
process.exit(ruim ? 1 : 0);
