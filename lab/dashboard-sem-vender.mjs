// "EU QUERIA VISUALIZAR DE FORMA SIMPLES COMO ESTÁ O CONSUMO DA CASA, A PERDA,
//  O QUEBRADO, O CONGELADO." — "Sim, coloca no Dashboard."
//
// O placar "Saiu sem vender" morava numa aba dentro do Estoque. Agora o
// Dashboard (tela inicial) mostra o total do mês e os baldes, e tocar leva
// pra aba certa.
//   Consumo da casa: 2 × R$ 10,00 = R$ 20,00
//   Quebrou:         1 × R$ 10,00 = R$ 10,00   (1 vez)
//   Congelou:        3 × R$ 10,00 = R$ 30,00
//   Desperdício:     1 × R$ 10,00 = R$ 10,00   (balde "Perda")
//   Total: R$ 70,00
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
const limpa = (s) => String(s || '').replace(/[  ]/g, ' ');
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
let n = 0;
const mov = (qtd, motivo) => ({ id: `m${n += 1}`, tipo: 'saida', qtd, motivo, saldoDepois: 0, data: hoje, ts: Date.now() + n });

const p0 = await painel();
await gravar({ ...p0, estoque: [
  { id: 'a', nome: 'Heineken long neck', custo: '10', unidade: 'un', saldo: '50', categoria: 'Bebidas', movimentos: [mov(2, 'Consumo da casa'), mov(1, 'Quebrou'), mov(3, 'Congelou')] },
  { id: 'b', nome: 'Limão', custo: '10', unidade: 'kg', saldo: '5', categoria: 'Cozinha', movimentos: [mov(1, 'Desperdício')] },
] });

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 }, serviceWorkers: 'block' });
const pg = await ctx.newPage();
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1600);
await pg.locator('select[data-quem]').selectOption({ label: 'Dona' });
await pg.locator('input[type="password"]').first().fill('Teste@123');
await pg.locator('button:has-text("Entrar")').first().click();
await pg.waitForTimeout(4200);

console.log('\n### o cartão aparece na tela inicial');
const card = pg.locator('[data-card="saiu-sem-vender"]');
cobra('existe o cartão "Saiu sem vender" no Dashboard', await card.count() === 1);
const t = limpa(await card.innerText());
cobra('total do mês R$ 70,00', /R\$ 70,00/.test(t), t.replace(/\n/g, ' · ').slice(0, 160));
const balde = async (k) => limpa(await card.locator(`[data-balde="${k}"]`).innerText()).replace(/\n/g, ' ');
cobra('Consumo da casa R$ 20,00', /R\$ 20,00/.test(await balde('consumo')), await balde('consumo'));
cobra('Quebrou R$ 10,00 (1 vez)', /R\$ 10,00.*1 vez/.test(await balde('quebra')), await balde('quebra'));
cobra('Congelou R$ 30,00', /R\$ 30,00/.test(await balde('congelou')), await balde('congelou'));
cobra('Perda R$ 10,00 (o desperdício)', /R\$ 10,00/.test(await balde('perdaSo')), await balde('perdaSo'));
cobra('hoje também R$ 70,00', /hoje: R\$ 70,00/.test(t));

console.log('\n### tocar leva pra aba Saiu sem vender');
await card.locator('button').first().click();
await pg.waitForTimeout(1800);
const corpo = limpa(await pg.locator('body').innerText());
cobra('abriu a aba com o placar completo', /Saiu sem vender em/i.test(corpo) && /R\$ 70,00/.test(corpo), (corpo.match(/Saiu sem vender em[^\n]*/i) || ['(não achou)'])[0]);

console.log('\n### sem estoque, o cartão não aparece (nada de cartão vazio)');
const p1 = await painel();
await gravar({ ...p1, estoque: [] });
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(4200);
cobra('cartão some', await pg.locator('[data-card="saiu-sem-vender"]').count() === 0);

await b.close();
console.log(ruim ? `\n${ruim} RUIM` : '\nTUDO OK');
process.exit(ruim ? 1 : 0);
