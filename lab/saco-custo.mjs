// "A FAVORITA DIZ QUE NÃO TEM VALOR NA CARNE 300G E NA BATATA 400G, MAS ESSES
//  SÃO PACOTES QUE SEPARAMOS PRA LINHA DE FRENTE E SALVA-VIDAS. ELES DEVERIAM
//  JÁ PEGAR OS VALORES DA CARNE QUANDO CHEGA E DO PACOTE DE BATATA CAIXA."
//
// O SACO SEPARADO NÃO TEM PREÇO PRÓPRIO: é uma fatia do bruto.
//   Carne a R$ 48,00 o kg        → Carne 300g  = 0,3 × 48        = R$ 14,40
//   Batata cx de 20 kg a R$ 80   → Batata 400g = 0,4/20 × 80     = R$  1,60
//   + queijo 100 g a R$ 40/kg                                    = R$  4,00
//   A Favorita (1 saco de cada + queijo)                         = R$ 20,00
// O custo GUARDADO nos sacos é zero, de propósito: é o estado real dela.
//
// E quando a caixa não diz quantos kg tem, NÃO inventa (400 caixas!) — a tela
// diz o que falta preencher.
import ExcelJS from 'exceljs';
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
const limpa = (s) => String(s || '').replace(/[\u00a0\u202f]/g, ' ');

const estoqueBase = (batata) => [
  { id: 'carne', nome: 'Carne', custo: '48', unidade: 'kg', saldo: '20', categoria: 'Cozinha' },
  { id: 'carne300', nome: 'Carne 300g', custo: '0', unidade: 'un', saldo: '10', categoria: 'Cozinha', separar: { brutoId: 'carne', gramas: 300, unidade: 'g' } },
  batata,
  { id: 'bat400', nome: 'Batata 400g', custo: '0', unidade: 'un', saldo: '20', categoria: 'Cozinha', separar: { brutoId: 'caixa', gramas: 400, unidade: 'g' } },
  { id: 'queijo', nome: 'Mussarela', custo: '40', unidade: 'kg', saldo: '5', categoria: 'Cozinha' },
];
const caixaCom = { id: 'caixa', nome: 'Batata caixa', custo: '80', unidade: 'cx', conteudo: '20', conteudoUnid: 'kg', saldo: '3', categoria: 'Cozinha' };
const caixaSem = { id: 'caixa', nome: 'Batata caixa', custo: '80', unidade: 'cx', saldo: '3', categoria: 'Cozinha' };

const p0 = await painel();
const base = { ...p0,
  cardapio: [{ id: 'c1', nome: 'A Favorita', categoria: 'Porções', preco: '79,99', ativo: true }],
  fichas: [{ cardapioId: 'c1', itens: [
    { estoqueId: 'carne300', qtd: '1', unidade: 'un' },
    { estoqueId: 'bat400', qtd: '1', unidade: 'un' },
    { estoqueId: 'queijo', qtd: '100', unidade: 'g' },
  ] }],
  compras: [], despesas: [], receitas: [], diario: [], fritadeira: undefined,
  precoBase: { impostos: '0', cartao: '3,15', comissao: '', delivery: '', margem: '65' },
};
await gravar({ ...base, estoque: estoqueBase(caixaCom) });

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, serviceWorkers: 'block' });
const pg = await ctx.newPage();
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
pg.on('console', (m) => { const x = m.text(); if (m.type() === 'error' && !/status of 40/.test(x)) { console.log('[console]', x.slice(0, 160)); ruim++; } });

await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1600);
await pg.locator('select[data-quem]').selectOption({ label: 'Dona' });
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
const abrirFavorita = async () => {
  await irPara('Abastecimento');
  await irPara('Preço certo');
  await pg.evaluate(() => {
    const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /A Favorita/.test(o.textContent)));
    const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    if (s) { set.call(s, 'c1'); s.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await pg.waitForTimeout(1500);
};
const linha = async (rotulo) => {
  const l = (await texto()).split('\n');
  const i = l.findIndex((x) => x.trim().startsWith(rotulo));
  return i < 0 ? '(não achou)' : `${l[i]} ⇢ ${l[i + 1] || ''}`;
};

console.log('\n### os dois sacos pegam o preço do bruto (sem nenhuma nota de compra)');
await abrirFavorita();
let l = await linha('Custo de uma unidade');
cobra('A Favorita custa R$ 20,00 (carne 14,40 + batata 1,60 + queijo 4,00)', /⇢ R\$ 20,00/.test(l), l);
let txt = await texto();
cobra('não acusa mais "sem custo no estoque"', !/sem custo no estoque/.test(txt));

console.log('\n### e o custo fica GRAVADO nos sacos quando a carne é recalculada');
const r = await pg.evaluate(async () => {
  const x = await fetch('/api/estoque', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'corrigirCustos' }) });
  return x.json();
});
cobra('o servidor corrigiu', r.ok && r.corrigidos >= 1, JSON.stringify(r).slice(0, 120));
const pg2 = await painel();
const c300 = (pg2.estoque || []).find((i) => i.id === 'carne300');
const b400 = (pg2.estoque || []).find((i) => i.id === 'bat400');
cobra('Carne 300g gravada a R$ 14,40', Math.abs(Number(c300?.custo) - 14.4) < 0.001, String(c300?.custo));
cobra('Batata 400g gravada a R$ 1,60', Math.abs(Number(b400?.custo) - 1.6) < 0.001, String(b400?.custo));

console.log('\n### a carne SUBIU: o saco acompanha sozinho');
const p1 = await painel();
await gravar({ ...p1, estoque: (p1.estoque || []).map((i) => (i.id === 'carne' ? { ...i, custo: '60' } : i)) });
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3600);
await abrirFavorita();
l = await linha('Custo de uma unidade');
// 0,3 × 60 = 18,00 + 1,60 + 4,00 = 23,60
cobra('A Favorita passa a R$ 23,60', /⇢ R\$ 23,60/.test(l), l);

console.log('\n### caixa SEM dizer quantos kg tem: não inventa, diz o que falta');
const p2 = await painel();
await gravar({ ...p2, estoque: estoqueBase(caixaSem).map((i) => (i.id === 'bat400' ? { ...i, custo: '0' } : i)) });
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3600);
await abrirFavorita();
l = await linha('Custo de uma unidade');
txt = await texto();
cobra('NÃO vira milhares de reais (400 caixas)', !/R\$ [0-9]\.[0-9]{3},/.test(l) && !/R\$ [0-9]{4,}/.test(l), l);
cobra('diz que falta o conteúdo da caixa', /Batata 400g \(falta dizer quantos g tem/.test(txt), (txt.match(/[^\n]*sem custo no estoque[^\n]*/) || ['(não achou o aviso)'])[0]);

console.log('\n### a PLANILHA DO ANALISTA conta a mesma história (era lá que o aviso aparecia)');
// Volta ao cenário bom: caixa com 20 kg, carne a R$ 48, sacos com custo zero guardado.
const pa = await painel();
await gravar({ ...pa, estoque: estoqueBase(caixaCom) });
const entrarHttp = async () => {
  const x = await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ papel: 'dona', senha: 'Teste@123', lembrar: true }) });
  return (x.headers.getSetCookie ? x.headers.getSetCookie() : [x.headers.get('set-cookie')]).filter(Boolean).map((c) => c.split(';')[0]).join('; ');
};
const ck = await entrarHttp();
const xr = await fetch(`${BASE}/api/analista`, { headers: { cookie: ck } });
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(Buffer.from(await xr.arrayBuffer()));
const v = (c) => (c && typeof c === 'object' && 'result' in c ? c.result : (c && typeof c === 'object' && 'text' in c ? c.text : c));
const lerTabela = (ws, primeira) => {
  let ini = -1;
  ws.eachRow((row, n) => { if (ini < 0 && n > 1 && v(row.getCell(1).value) === primeira) ini = n; });
  const out = [];
  if (ini < 0) return out;
  for (let n = ini + 1; n <= ws.rowCount; n += 1) { const row = ws.getRow(n); if (!row.hasValues) break; out.push(row.values.slice(1).map(v)); }
  return out;
};
const fi = lerTabela(wb.getWorksheet('Fichas técnicas'), 'Prato');
const fav = fi.filter((l) => l[0] === 'A Favorita');
const cCarne = fav.find((l) => l[3] === 'Carne 300g');
const cBatata = fav.find((l) => l[3] === 'Batata 400g');
cobra('ficha da Favorita: Carne 300g a R$ 14,40', cCarne && Math.abs(Number(cCarne[6]) - 14.4) < 0.006, JSON.stringify(cCarne));
cobra('ficha da Favorita: Batata 400g a R$ 1,60', cBatata && Math.abs(Number(cBatata[6]) - 1.6) < 0.006, JSON.stringify(cBatata));
const pc = lerTabela(wb.getWorksheet('Produtos e custos'), 'Item');
const pcs = pc.find((l) => l[0] === 'Carne 300g');
cobra('produtos e custos: Carne 300g com custo de R$ 14,40', pcs && Math.abs(Number(pcs[3]) - 14.4) < 0.006, JSON.stringify(pcs));

await b.close();
console.log(ruim ? `\n${ruim} RUIM` : '\nTUDO OK');
process.exit(ruim ? 1 : 0);
