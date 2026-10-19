// "TEM O KETCHUP QUE VAI, TEM LIMÃO FATIA QUE VAI NAS PORÇÕES."
//
// Ela está auditando as próprias fichas e achando o que falta. Estes dois são
// ingrediente de verdade — só saem porque a porção saiu — e entram no CMV,
// diferente do gás e do salário.
//
// O QUE ESTE TESTE GUARDA:
//
//   - os DOIS jeitos de dizer a quantidade. "1 sachê" qualquer um responde.
//     "23 g de limão" ninguém responde — mas "1 kg dá umas 40 porções" todo
//     mundo estima. Se sobrar só o primeiro jeito, o limão nunca entra em
//     ficha nenhuma;
//   - aplicar em VÁRIOS pratos de uma vez e em nenhum que não foi marcado;
//   - e o custo subindo de verdade lá na calculadora de preço. "É só um
//     limãozinho" vira dinheiro quando multiplica por 500 porções, e é esse
//     número que faz ela levar a sério.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
const limpa = (s) => String(s || '').replace(/ /g, ' ');

// A CONTA FEITA NA MÃO:
//   ketchup ... sachê, R$ 0,35 a unidade, 1 por porção        = R$ 0,35
//   limão ..... R$ 10,00 o quilo, 1 kg rende 40 porções
//               → 1/40 kg = 25 g por porção → 0,025 × 10      = R$ 0,25
//   batata .... 0,4 kg × R$ 20 = R$ 8,00 + 0,35 + 0,25        = R$ 8,60
const p0 = await painel();
await gravar({ ...p0,
  estoque: [
    { id: 'bat', nome: 'Batata congelada', custo: '20', unidade: 'kg', saldo: '40', categoria: 'Cozinha' },
    { id: 'ket', nome: 'Ketchup sachê', custo: '0,35', unidade: 'un', saldo: '500', categoria: 'Cozinha' },
    { id: 'gal', nome: 'Ketchup galão', custo: '45', unidade: 'un', saldo: '3', categoria: 'Cozinha', conteudo: 3200, conteudoUnid: 'g' },
    { id: 'lim', nome: 'Limão', custo: '10', unidade: 'kg', saldo: '8', categoria: 'Cozinha' },
  ],
  cardapio: [
    { id: 'c1', nome: 'Batata Frita Clássica', categoria: 'Porções', preco: '29,99', ativo: true },
    { id: 'c2', nome: 'Isca de Tilápia', categoria: 'Porções', preco: '45,00', ativo: true },
    { id: 'c3', nome: 'Chopp Pilsen', categoria: 'Chopp / Cerveja', preco: '12,00', ativo: true },
  ],
  fichas: [{ cardapioId: 'c1', itens: [{ estoqueId: 'bat', qtd: '0,4', unidade: 'kg' }] }],
  despesas: [], receitas: [], compras: [], diario: [], fritadeira: undefined,
  precoBase: { impostos: '0', cartao: '3,15', comissao: '', delivery: '', margem: '65' },
});

// 600 porções em 30 dias = 20 por dia, pro modo "quantos dias dura".
const diasAtras = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
for (const [i, d] of [diasAtras(2), diasAtras(9), diasAtras(18)].entries()) {
  await fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ chave: `${MARCA}venda:k${i}`, valor: { id: `k${i}`, data: d, total: 1, itens: [
      { cardapioId: 'c1', nome: 'Batata Frita Clássica', qtd: 100, preco: '29,99' },
      { cardapioId: 'c2', nome: 'Isca de Tilápia', qtd: 100, preco: '45,00' },
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
const toque = async (t) => pg.evaluate((x) => {
  const lim = (s) => String(s || '').replace(/ /g, ' ').trim();
  const b2 = [...document.querySelectorAll('button')].find((e) => lim(e.innerText).startsWith(x));
  if (b2) { b2.click(); return true; }
  return false;
}, t);
const campo = async (rotulo, valor) => pg.evaluate(([r, v]) => {
  const lim = (s) => String(s || '').replace(/ /g, ' ').trim();
  const lab = [...document.querySelectorAll('div')].find((d) => lim(d.textContent) === r && d.children.length === 0);
  const c = lab && lab.parentElement && lab.parentElement.querySelector('input');
  if (!c) return false;
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(c, v); c.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}, [rotulo, valor]);
const escolher = async (id, regex) => pg.evaluate(([i, r]) => {
  const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => new RegExp(r).test(o.textContent)));
  if (!s) return false;
  const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  set.call(s, i); s.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}, [id, regex]);
const marcar = async (nome) => pg.evaluate((n) => {
  const l = [...document.querySelectorAll('label')].find((x) => (x.textContent || '').includes(n));
  const cb = l && l.querySelector('input[type="checkbox"]');
  if (cb && !cb.checked) { cb.click(); return true; }
  return false;
}, nome);

await irPara('Abastecimento');
await irPara('Estoque');
await irPara('Fichas técnicas');
await pg.waitForTimeout(900);

console.log('\n### o ajudante dos acompanhamentos existe');
let txt = await texto();
cobra('aparece na tela', /Acompanhamentos — ketchup, limão, molho/.test(txt), (txt.match(/[^\n]*Acompanhamentos[^\n]*/) || [''])[0]);
await pg.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => /Acompanhamentos — ketchup/.test(e.innerText || '')); if (x) x.click(); });
await pg.waitForTimeout(800);
cobra('e diz por que ESTES entram na ficha (ao contrário do gás)', /estes são ingrediente/i.test(await texto()));

console.log('\n### KETCHUP: o jeito fácil — "vai 1 sachê"');
cobra('escolheu o ketchup', await escolher('ket', 'Ketchup'));
await pg.waitForTimeout(800);
cobra('preencheu a quantidade', await campo('Quantidade', '1'));
await pg.waitForTimeout(800);
txt = await texto();
cobra('mostra R$ 0,35 por porção', /R\$ 0,35/.test(txt), (txt.match(/[^\n]*em cada porção[^\n]*/) || [''])[0]);
cobra('e o tamanho disso em 500 porções (R$ 175,00)', /R\$ 175,00/.test(txt), (txt.match(/[^\n]*500 porções[^\n]*/) || ['(não mostrou)'])[0]);
cobra('marcou a batata', await marcar('Batata Frita Clássica'));
await pg.waitForTimeout(400);
cobra('marcou a isca', await marcar('Isca de Tilápia'));
await pg.waitForTimeout(400);
cobra('aplicou nos dois', await toque('Pôr em 2 prato(s)'));
await pg.waitForTimeout(2200);
let fichas = (await painel()).fichas;
cobra('a batata ganhou ketchup', (fichas.find((f) => f.cardapioId === 'c1')?.itens || []).some((i) => i.estoqueId === 'ket' && i.qtd === '1'), JSON.stringify(fichas.find((f) => f.cardapioId === 'c1')));
cobra('a isca também', (fichas.find((f) => f.cardapioId === 'c2')?.itens || []).some((i) => i.estoqueId === 'ket'), JSON.stringify(fichas.find((f) => f.cardapioId === 'c2')));
cobra('o chopp NÃO foi tocado', !fichas.some((f) => f.cardapioId === 'c3'), JSON.stringify(fichas.map((f) => f.cardapioId)));

console.log('\n### LIMÃO: o jeito que salva — ninguém sabe dizer "23 g de limão"');
cobra('dá pra pôr outro', await toque('Pôr outro acompanhamento'));
await pg.waitForTimeout(800);
cobra('escolheu o limão', await escolher('lim', 'Limão'));
await pg.waitForTimeout(800);
cobra('tem o modo por rendimento', await toque('Sei quantas porções rende'));
await pg.waitForTimeout(700);
txt = await texto();
// Rótulo vem em CAIXA ALTA pelo CSS, e innerText obedece ao CSS. (De novo.)
cobra('e pergunta na unidade que ELA compra', /1 kg de Limão dá quantas porções\?/i.test(txt), (txt.match(/[^\n]*QUANTAS PORÇÕES[^\n]*/i) || ['(não perguntou)'])[0]);
cobra('respondeu 40', await campo('1 kg de Limão dá quantas porções?', '40'));
await pg.waitForTimeout(800);
txt = await texto();
cobra('converteu pra 25 g por porção', /25 g/.test(txt), (txt.match(/[^\n]*em cada porção[^\n]*/) || [''])[0]);
cobra('e custa R$ 0,25', /R\$ 0,25/.test(txt));
cobra('marcou a batata', await marcar('Batata Frita Clássica'));
await pg.waitForTimeout(400);
cobra('aplicou', await toque('Pôr em 1 prato(s)'));
await pg.waitForTimeout(2200);
fichas = (await painel()).fichas;
const fBat = fichas.find((f) => f.cardapioId === 'c1');
cobra('a batata agora tem batata + ketchup + limão', fBat && fBat.itens.length === 3, JSON.stringify(fBat && fBat.itens));
cobra('o limão entrou em gramas, legível', fBat && fBat.itens.some((i) => i.estoqueId === 'lim' && i.qtd === '25' && i.unidade === 'g'), JSON.stringify(fBat && fBat.itens));

console.log('\n### e o custo sobe de verdade na calculadora de preço');
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3600);
await irPara('Abastecimento');
await irPara('Preço certo');
cobra('escolheu a batata', await escolher('c1', 'Batata Frita'));
await pg.waitForTimeout(1400);
const l = (await texto()).split('\n');
const i = l.findIndex((x) => x.trim().startsWith('Custo de uma unidade'));
const linha = i < 0 ? '(não achou)' : `${l[i]} ⇢ ${l[i + 1] || ''}`;
cobra('não é mais R$ 8,00', !/⇢ R\$ 8,00/.test(linha), linha);
cobra('agora é R$ 8,60 (batata + ketchup + limão)', /⇢ R\$ 8,60/.test(linha), linha);

console.log('\n### KETCHUP DE GALÃO: "quantos dias dura" é como ela pensa de verdade');
// "Eu troco óleo a cada 10 dias", disse ela. E o ketchup é galão que vai pro
// potinho — quantos potinhos saem de um galão ninguém contou na vida, mas
// quanto tempo o galão dura todo bar sabe.
//
//   galão de 3.200 g, dura 10 dias
//   20 porções fritas por dia × 10 = 200 porções por galão
//   3.200 ÷ 200 = 16 g por porção · R$ 45 ÷ 200 = R$ 0,23
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3600);
await irPara('Abastecimento');
await irPara('Estoque');
await irPara('Fichas técnicas');
await pg.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => /Acompanhamentos — ketchup/.test(e.innerText || '')); if (x) x.click(); });
await pg.waitForTimeout(800);
cobra('escolheu o galão', await escolher('gal', 'Ketchup galão'));
await pg.waitForTimeout(800);
cobra('marcou a batata', await marcar('Batata Frita Clássica'));
await pg.waitForTimeout(400);
cobra('marcou a isca', await marcar('Isca de Tilápia'));
await pg.waitForTimeout(600);
cobra('existe o modo por duração', await toque('Sei quantos dias dura'));
await pg.waitForTimeout(700);
txt = await texto();
cobra('pergunta quantos dias dura um galão', /quantos dias dura 1 un de ketchup galão/i.test(txt), (txt.match(/[^\n]*DIAS DURA[^\n]*/i) || ['(não perguntou)'])[0]);
cobra('e já diz quantas porções contou por dia', /20 por dia/.test(txt), (txt.match(/[^\n]*por dia[^\n]*/) || [''])[0]);
cobra('respondeu 10 dias', await campo('Quantos dias dura 1 un de Ketchup galão?', '10'));
await pg.waitForTimeout(900);
txt = await texto();
cobra('converteu pra 16 g por porção (não "0,005 un")', /16 g/.test(txt), (txt.match(/[^\n]*em cada porção[^\n]*/) || [''])[0]);
cobra('e mostra a conta por trás', /10 dias × 20 porções por dia = 200 porções/.test(txt), (txt.match(/[^\n]*porções por embalagem[^\n]*/) || ['(não mostrou)'])[0]);
cobra('custa R$ 0,23 por porção', /R\$ 0,23/.test(txt));
cobra('aplicou nos dois', await toque('Pôr em 2 prato(s)'));
await pg.waitForTimeout(2200);
const fim = (await painel()).fichas.find((f) => f.cardapioId === 'c1');
cobra('o galão entrou em gramas na ficha', fim.itens.some((i) => i.estoqueId === 'gal' && i.qtd === '16' && i.unidade === 'g'), JSON.stringify(fim.itens));

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
