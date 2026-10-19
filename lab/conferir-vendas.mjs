// "SIM, PODE FAZER ESSA COMPARAÇÃO AUTOMÁTICA."
//
// Ela disse que num sábado saem 20 a 30 batatas, e o sistema tinha contado
// menos de 3 porções fritas por dia. Se a diferença for real, é muito maior
// que o óleo: venda que não passa pelo app não entra no CMV, não entra no
// resultado do mês e não entra no aviso do teto do MEI — que passaria a dizer
// que ela está longe do limite justamente quando não está.
//
// A conta usa o que não mente: mercadoria comprada. Ela paga, lança, a nota
// existe.
//
// O QUE ESTE TESTE GUARDA, e o terceiro é o que me preocupa mais:
//
//   - só MERCADORIA entra. Pondo aluguel na conta, qualquer bar pareceria
//     estar perdendo metade do estoque;
//   - só MÊS FECHADO. O mês corrente tem compra lançada e venda pela metade;
//   - FICHA INCOMPLETA NÃO PODE SER LIDA COMO VENDA SUMINDO. Produto sem
//     ficha derruba o CMV sozinho, sem nenhuma venda ter se perdido. Acusar
//     "tua venda está sumindo" nesse caso é mandar ela procurar ladrão onde o
//     que tem é cadastro pela metade — e ela vai procurar, porque confia.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
const limpa = (s) => String(s || '').replace(/ /g, ' ');

// Relógio parado em 19/10/2026 → os três meses fechados são Jul, Ago e Set.
const HOJE = new Date('2026-10-19T15:00:00Z');
const MESES = ['2026-07', '2026-08', '2026-09'];

const ESTOQUE = [{ id: 'bat', nome: 'Batata congelada', custo: '20', unidade: 'kg', saldo: '50', categoria: 'Cozinha' }];
const CARDAPIO = [
  { id: 'c1', nome: 'Batata Frita', categoria: 'Porções', preco: '30,00', ativo: true },
  { id: 'c2', nome: 'Chopp', categoria: 'Chopp / Cerveja', preco: '12,00', ativo: true },
];
const FICHAS = [{ cardapioId: 'c1', itens: [{ estoqueId: 'bat', qtd: '0,4', unidade: 'kg' }] }];

// 100 batatas por mês × 0,4 kg × R$ 20 = R$ 800 de CMV por mês = R$ 2.400 nos três.
const vendasDe = (comChopp) => MESES.flatMap((m, i) => {
  const itens = [{ cardapioId: 'c1', nome: 'Batata Frita', qtd: 100, preco: '30,00' }];
  if (comChopp) itens.push({ cardapioId: 'c2', nome: 'Chopp', qtd: 300, preco: '12,00' });
  return [{ chave: `venda:m${i}`, valor: { id: `m${i}`, data: `${m}-10`, total: 1, itens } }];
});
const comprasDe = (porMes) => [
  ...MESES.map((m, i) => ({ id: `cp${i}`, data: `${m}-05`, produto: 'Batata', quantidade: '1', valorUnit: String(porMes), tipoConta: 'Fornecedores de insumo' })),
  // Estas duas NÃO podem entrar:
  { id: 'aluguel', data: '2026-08-05', produto: 'Aluguel do galpão', quantidade: '1', valorUnit: '9000', tipoConta: 'Aluguel' },
  { id: 'outubro', data: '2026-10-05', produto: 'Batata', quantidade: '1', valorUnit: '9000', tipoConta: 'Fornecedores de insumo' },
];

const semear = async (porMes, comChopp) => {
  const p = await painel();
  await gravar({ ...p, estoque: ESTOQUE, cardapio: CARDAPIO, fichas: FICHAS, compras: comprasDe(porMes), despesas: [], receitas: [], diario: [] });
  for (const v of ['m0', 'm1', 'm2']) await fetch(`${BANCO}?chave=eq.${MARCA}venda:${v}`, { method: 'DELETE' });
  for (const v of vendasDe(comChopp)) {
    await fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}${v.chave}`, valor: v.valor }]) });
  }
};

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, serviceWorkers: 'block' });
const pg = await ctx.newPage();
await pg.clock.setFixedTime(HOJE);
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
pg.on('console', (m) => { const x = m.text(); if (m.type() === 'error' && !/status of 40/.test(x)) { console.log('[console]', x.slice(0, 160)); ruim++; } });

await semear(1000, false);
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
  await pg.waitForTimeout(1700);
  return achou;
};
const abrir = async () => {
  await irPara('Abastecimento');
  await irPara('Estoque');
  await irPara('Conferência');
  await pg.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => /As vendas batem com o que tu compra/.test(e.innerText || '')); if (x) x.click(); });
  await pg.waitForTimeout(900);
  return texto();
};
const recarregar = async () => { await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(3600); };

console.log('\n### quando bate, diz que pode confiar');
// Comprou R$ 3.000 nos três meses; as vendas explicam R$ 2.400 = 80%.
let txt = await abrir();
cobra('a conferência aparece', /As vendas batem com o que tu compra/.test(txt), (txt.match(/[^\n]*batem com o que[^\n]*/) || [''])[0]);
cobra('comprou R$ 3.000,00', /R\$ 3\.000,00/.test(txt), (txt.match(/[^\n]*TU COMPROU[\s\S]{0,40}/i) || [''])[0].replace(/\n/g, ' '));
cobra('as vendas explicam R$ 2.400,00', /R\$ 2\.400,00/.test(txt));
cobra('dá 80%', /R\$ 80\b/.test(txt) || /80% —/.test(txt), (txt.match(/[^\n]*explicam[^\n]*/) || [''])[0]);
cobra('e diz que pode confiar no relatório', /Pode confiar nos números/.test(txt));

console.log('\n### ALUGUEL E O MÊS CORRENTE NÃO ENTRAM NA CONTA');
// Com o aluguel de R$ 9.000 dentro, o "comprou" seria R$ 12.000 e qualquer
// bar pareceria estar perdendo o estoque. O mesmo com a compra de outubro.
cobra('o aluguel de R$ 9.000 ficou de fora', !/R\$ 12\.000,00/.test(txt));
cobra('a compra de outubro também', !/R\$ 21\.000,00/.test(txt));
cobra('só os três meses fechados', /Jul\/2026 a Set\/2026/.test(txt), (txt.match(/[^\n]*Jul\/2026[^\n]*/) || ['(período errado)'])[0]);

console.log('\n### buraco grande com ficha completa: a culpa provável é VENDA');
// Comprou R$ 12.000 e as vendas explicam R$ 2.400 = 20%.
await semear(4000, false);
await recarregar();
txt = await abrir();
cobra('mostra 20%', /R\$ 20\b/.test(txt), (txt.match(/[^\n]*explicam[^\n]*/) || [''])[0]);
cobra('aponta R$ 9.600,00 sem explicação', /R\$ 9\.600,00/.test(txt), (txt.match(/[^\n]*não explicam[^\n]*/) || [''])[0]);
cobra('culpa provável: venda fora do app', /1\. Venda que não passou pelo app/.test(txt), (txt.match(/[^\n]*1\.[^\n]*/) || ['(não ordenou)'])[0]);
cobra('e lembra do teto do MEI', /teto do MEI/.test(txt));

console.log('\n### MESMO BURACO, MAS COM FICHA PELA METADE: a culpa muda');
// Agora metade do que ela vende é chopp SEM ficha. O CMV cai sozinho, sem
// nenhuma venda ter sumido. Acusar venda aqui é mandar ela procurar ladrão
// onde o que tem é cadastro incompleto.
await semear(4000, true);
await recarregar();
txt = await abrir();
cobra('a cobertura derrubou a leitura pra FICHA', /1\. Ficha técnica faltando/.test(txt), (txt.match(/[^\n]*1\.[^\n]*/) || ['(não mudou a ordem)'])[0]);
cobra('diz quanto do vendido tem ficha', /% do que tu vendeu tem ficha/.test(txt), (txt.match(/[^\n]*tem ficha[^\n]*/) || [''])[0]);
cobra('e manda arrumar a ficha ANTES de desconfiar', /antes de desconfiar/.test(txt));
cobra('NÃO acusa venda sumindo em primeiro lugar', !/1\. Venda que não passou/.test(txt));

console.log('\n### SISTEMA ENTRANDO EM USO NÃO PODE SER LIDO COMO VAZAMENTO');
// O caso REAL dela, com os números do print:
//   Jul  comprou 9.395,47  ·  vendas explicam     0,00  →   0%
//   Ago  comprou 5.369,54  ·  vendas explicam 3.024,73  →  56%
//   Set  comprou 4.148,85  ·  vendas explicam 4.812,03  → 116%
// A média deu 41% e o card acusou "venda que não passou pelo app" em primeiro
// lugar. Mas julho zerado não é venda sumindo: é mês em que o app ainda não
// rodava. E setembro acima de 100% é o contrário de problema.
//
// Um número que acusa justamente quem acabou de adotar a ferramenta ensina a
// ignorar a ferramenta.
const pR = await painel();
await gravar({ ...pR, estoque: ESTOQUE, cardapio: CARDAPIO, fichas: FICHAS, despesas: [], receitas: [], diario: [],
  compras: [
    { id: 'j', data: '2026-07-05', produto: 'Batata', quantidade: '1', valorUnit: '9395,47', tipoConta: 'Fornecedores de insumo' },
    { id: 'a', data: '2026-08-05', produto: 'Batata', quantidade: '1', valorUnit: '5369,54', tipoConta: 'Fornecedores de insumo' },
    { id: 's', data: '2026-09-05', produto: 'Batata', quantidade: '1', valorUnit: '4148,85', tipoConta: 'Fornecedores de insumo' },
  ] });
for (const v of ['m0', 'm1', 'm2']) await fetch(`${BANCO}?chave=eq.${MARCA}venda:${v}`, { method: 'DELETE' });
// Julho: NENHUMA venda. Agosto: 378 batatas (×R$ 8 = 3.024). Setembro: 601 (4.808).
for (const [k, mes, qtd] of [['m1', '2026-08', 378], ['m2', '2026-09', 601]]) {
  await fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ chave: `${MARCA}venda:${k}`, valor: { id: k, data: `${mes}-10`, total: 1, itens: [{ cardapioId: 'c1', nome: 'Batata Frita', qtd, preco: '30,00' }] } }]) });
}
await recarregar();
txt = await abrir();
cobra('NÃO acusa venda sumindo', !/1\. Venda que não passou/.test(txt), (txt.match(/[^\n]*1\.[^\n]*/) || [''])[0]);
cobra('diz que é rodagem, não vazamento', /rodagem, não vazamento/i.test(txt), (txt.match(/[^\n]*rodagem[^\n]*/) || ['(não reconheceu)'])[0]);
cobra('aponta o mês sem venda lançada', /Jul\/2026/.test(txt) && /sem venda lançada/.test(txt), (txt.match(/[^\n]*sem venda lançada[^\n]*/) || ['(não apontou)'])[0]);
cobra('e mostra o último mês saudável', /Set\/2026/.test(txt) && /11[0-9]%/.test(txt), (txt.match(/[^\n]*último mês fechado[\s\S]{0,90}/) || [''])[0].replace(/\n/g, ' '));
cobra('explica que acima de 100% não é erro', /Acima de 100% não é erro/.test(txt));
cobra('e manda olhar de novo daqui a um mês', /daqui a um mês/.test(txt));
cobra('cada mês mostra a sua porcentagem', /56%/.test(txt), (txt.match(/[^\n]*Ago\/2026[^\n]*/) || [''])[0]);

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
