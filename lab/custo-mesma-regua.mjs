// "PAGO 48 E POUCO NO QUILO DA CARNE E ESSA TÁBUA VAI 300G DE CARNE (...)
//  POR QUE PARECE QUE EU GASTO TÃO POUCO?"
//
// Ela olhou A Favorita: custo R$ 12,39 pra um prato com 300 g de carne,
// mussarela, batata frita e anéis de cebola. Só a carne, a R$ 48 o quilo, já
// seriam R$ 14,40 — mais que a ficha inteira. Ela conhece o próprio custo e
// viu na hora que o número era mentira.
//
// E era. A causa:
//
//   "Carne 300g" é SACO PORCIONADO — ninguém compra saco de 300 g, compra
//   carne em quilo e ensaca. O custo desse saco não é um dado próprio: é uma
//   fatia do quilo comprado, e só é recalculado no caminho que reconstrói
//   custo pelas NOTAS DE COMPRA.
//
//   O relatório usava esse caminho. As três telas de preço (Preço certo,
//   Margem e Raio-X) liam o custo congelado no item — que pode ser zero, ou de
//   quando alguém digitou pela última vez.
//
// Duas réguas pro mesmo prato é pior que uma régua torta: ela confere, vê
// números diferentes e para de confiar nos dois.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
const limpa = (s) => String(s || '').replace(/ /g, ' ');

const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const diasAtras = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

// A CONTA FEITA NA MÃO:
//   carne comprada a R$ 48,00 o quilo
//   "Carne 300g" é saco de 300 g do mesmo item  →  0,3 × 48 = R$ 14,40 o saco
//   a ficha da Favorita leva 1 saco             →  R$ 14,40 só de carne
//   + queijo 100 g a R$ 40/kg                   →  R$  4,00
//   = R$ 18,40
// O custo GUARDADO no saco é zero, de propósito: é o estado real dela.
const p0 = await painel();
await gravar({ ...p0,
  estoque: [
    { id: 'carne', nome: 'Carne', custo: '0', unidade: 'kg', saldo: '20', categoria: 'Cozinha' },
    { id: 'carne300', nome: 'Carne 300g', custo: '0', unidade: 'un', saldo: '10', categoria: 'Cozinha', separar: { brutoId: 'carne', gramas: 300, unidade: 'g' } },
    { id: 'queijo', nome: 'Mussarela', custo: '40', unidade: 'kg', saldo: '5', categoria: 'Cozinha' },
  ],
  cardapio: [{ id: 'c1', nome: 'A Favorita', categoria: 'Porções', preco: '79,99', ativo: true }],
  fichas: [{ cardapioId: 'c1', itens: [
    { estoqueId: 'carne300', qtd: '1', unidade: 'un' },
    { estoqueId: 'queijo', qtd: '100', unidade: 'g' },
  ] }],
  // A NOTA DE COMPRA é a única fonte que sabe quanto custa a carne.
  compras: [{ id: 'nota', data: diasAtras(10), produto: 'Carne', quantidade: '20', valorUnit: '48', tipoConta: 'Fornecedores de insumo' }],
  despesas: [], receitas: [], diario: [], fritadeira: undefined,
  precoBase: { impostos: '0', cartao: '3,15', comissao: '', delivery: '', margem: '65' },
});

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
  await pg.waitForTimeout(1700);
  cobra(`achou o caminho "${rot}"`, achou);
};
const linha = async (rotulo) => {
  const l = (await texto()).split('\n');
  const i = l.findIndex((x) => x.trim().startsWith(rotulo));
  return i < 0 ? '(não achou)' : `${l[i]} ⇢ ${l[i + 1] || ''}`;
};

console.log('\n### o PREÇO CERTO usa o custo da nota, não o zero guardado no saco');
await irPara('Abastecimento');
await irPara('Preço certo');
await pg.evaluate(() => {
  const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /A Favorita/.test(o.textContent)));
  const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  if (s) { set.call(s, 'c1'); s.dispatchEvent(new Event('change', { bubbles: true })); }
});
await pg.waitForTimeout(1500);
const l = await linha('Custo de uma unidade');
cobra('não é R$ 4,00 (só o queijo, com a carne sumindo)', !/⇢ R\$ 4,00/.test(l), l);
cobra('a carne entrou a R$ 14,40 → total R$ 18,40', /⇢ R\$ 18,40/.test(l), l);

console.log('\n### e a MARGEM conta a mesma história');
await irPara('Margem');
await pg.waitForTimeout(1200);
let txt = await texto();
// preço 79,99 − 18,40 = 61,59 de lucro
cobra('mostra custo R$ 18,40', /custo R\$ 18,40/.test(txt), (txt.match(/[^\n]*A Favorita[\s\S]{0,120}/) || [''])[0].replace(/\n/g, ' · '));
cobra('e lucro R$ 61,59', /R\$ 61,59/.test(txt));

console.log('\n### ingrediente sem custo é NOMEADO, não "algum"');
// Tira a nota de compra: aí nem o caminho novo sabe o preço da carne, e a tela
// tem que dizer QUAL item está furado — não só que "algum" está.
const pS = await painel();
await gravar({ ...pS, compras: [] });
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3600);
await irPara('Abastecimento');
await irPara('Preço certo');
await pg.evaluate(() => {
  const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /A Favorita/.test(o.textContent)));
  const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  if (s) { set.call(s, 'c1'); s.dispatchEvent(new Event('change', { bubbles: true })); }
});
await pg.waitForTimeout(1500);
txt = await texto();
cobra('diz QUAL ingrediente está sem custo', /sem custo no estoque: .*Carne 300g/.test(txt), (txt.match(/[^\n]*sem custo no estoque[^\n]*/) || ['(só disse "algum")'])[0]);
cobra('e avisa que o preço sai por baixo', /sai por baixo/.test(txt));

console.log('\n### SACO PORCIONADO CUJO PACOTE NÃO CONVERTE: não inventa custo');
// O caso real dela: "Batata 400g" é saco de 400 g tirado de um pacote
// cadastrado em SACO — sem dizer quantos gramas tem o saco. A conversão de
// "400 g" pra "saco" cai no chute do fim da função e devolve 400. O saco
// porcionado passava a custar 400 SACOS, e a Batata Frita Clássica apareceu
// com R$ 2.484,36 de ingrediente numa porção de R$ 29,99.
//
// Quando não dá pra converter, o certo é NÃO derivar: fica o custo que o saco
// já tinha. Velho é consertável; mil vezes maior não é.
const pB = await painel();
await gravar({ ...pB,
  estoque: [
    // Pacote em SACO, sem conteúdo — não dá pra saber quantos gramas tem.
    { id: 'pacote', nome: 'Batata pacote', custo: '6,20', unidade: 'saco', saldo: '10', categoria: 'Cozinha' },
    { id: 'bat400', nome: 'Batata 400g', custo: '3,22', unidade: 'un', saldo: '20', categoria: 'Cozinha', separar: { brutoId: 'pacote', gramas: 400, unidade: 'g' } },
  ],
  cardapio: [{ id: 'c2', nome: 'Batata Frita Clássica', categoria: 'Porções', preco: '29,99', ativo: true }],
  fichas: [{ cardapioId: 'c2', itens: [{ estoqueId: 'bat400', qtd: '1', unidade: 'un' }] }],
  compras: [],
});
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3600);
await irPara('Abastecimento');
await irPara('Preço certo');
await pg.evaluate(() => {
  const s2 = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /Batata Frita/.test(o.textContent)));
  const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  if (s2) { set.call(s2, 'c2'); s2.dispatchEvent(new Event('change', { bubbles: true })); }
});
await pg.waitForTimeout(1500);
const l2 = await linha('Custo de uma unidade');
cobra('NÃO virou 400 sacos (R$ 2.480,00)', !/2\.480|2\.484/.test(l2), l2);
cobra('ficou com o custo que o saco já tinha: R$ 3,22', /⇢ R\$ 3,22/.test(l2), l2);

console.log('\n### e a tela mostra o custo LINHA A LINHA');
// Um número só não dá pra conferir. Com a lista, o ingrediente absurdo salta
// aos olhos — foram 40 minutos de caça pra achar o que isto mostra num relance.
txt = await texto();
cobra('tem a lista "de onde vem esse custo"', /De onde vem esse custo/i.test(txt), (txt.match(/[^\n]*De onde vem esse custo[^\n]*/i) || ['(não mostra)'])[0]);
cobra('com o ingrediente e o quanto ele pesa', /Batata 400g[\s\S]{0,60}R\$ 3,22/.test(txt), (txt.match(/[^\n]*Batata 400g[^\n]*/) || [''])[0]);

console.log('\n### conversão no chute é apontada em vermelho');
// Ficha pedindo "300 g" de um item cadastrado em pote, sem dizer quantos
// gramas tem o pote: o sistema usaria 300 POTES.
const pC = await painel();
await gravar({ ...pC,
  estoque: [{ id: 'pote', nome: 'Molho pote', custo: '18', unidade: 'pote', saldo: '5', categoria: 'Cozinha' }],
  fichas: [{ cardapioId: 'c2', itens: [{ estoqueId: 'pote', qtd: '300', unidade: 'g' }] }],
});
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3600);
await irPara('Abastecimento');
await irPara('Preço certo');
await pg.evaluate(() => {
  const s3 = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /Batata Frita/.test(o.textContent)));
  const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  if (s3) { set.call(s3, 'c2'); s3.dispatchEvent(new Event('change', { bubbles: true })); }
});
await pg.waitForTimeout(1500);
txt = await texto();
cobra('avisa "conversão no chute"', /Conversão no chute/i.test(txt), (txt.match(/[^\n]*onversão no chute[^\n]*/) || ['(passou calado)'])[0]);
cobra('e nomeia o ingrediente', /Molho pote/.test(txt));
cobra('explicando o conserto (preencher o conteúdo)', /preenche o conteúdo da embalagem/.test(txt));
cobra('e NÃO oferece botão: "Molho pote" não diz tamanho nenhum', !/Usar \d/.test(txt), (txt.match(/[^\n]*Usar \d[^\n]*/) || [''])[0]);

console.log('\n### MAS QUANDO O NOME DIZ O TAMANHO, O BOTÃO CONSERTA NA HORA');
// "Xarope Monin 700ml" numa ficha que pede 30 ml virou R$ 1.797,00 na tela
// dela — TRINTA GARRAFAS — porque o cadastro não dizia que a garrafa tem 700
// ml. E o aviso mandava ela abrir outra tela e preencher um campo com a
// informação que já está escrita no nome do item, na linha de cima.
//
// A CONTA FEITA NA MÃO:
//   garrafa de Monin ..... R$ 59,90
//   a ficha pede ......... 30 ml
//   sem o conteúdo ....... 30 × 59,90 = R$ 1.797,00  (trinta garrafas)
//   com o conteúdo ....... 30/700 × 59,90 = R$ 2,57
const QUEBRADO = 'R$ 1.797,00';
const CERTO = 'R$ 2,57';
const pM = await painel();
await gravar({ ...pM,
  estoque: [{ id: 'mon', nome: 'Xarope Monin 700ml', custo: '59,90', unidade: 'un', saldo: '4', categoria: 'Bar' }],
  fichas: [{ cardapioId: 'c2', itens: [{ estoqueId: 'mon', qtd: '30', unidade: 'ml' }] }],
});
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3600);
await irPara('Abastecimento');
await irPara('Preço certo');
await pg.evaluate(() => {
  const s4 = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /Batata Frita/.test(o.textContent)));
  const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  if (s4) { set.call(s4, 'c2'); s4.dispatchEvent(new Event('change', { bubbles: true })); }
});
await pg.waitForTimeout(1500);
txt = await texto();
cobra(`o estrago aparece: ${QUEBRADO}`, txt.includes(QUEBRADO), (txt.match(/[^\n]*Xarope Monin[^\n]*/) || ['(não achou a linha)'])[0]);
cobra('a tela leu o tamanho do próprio nome', /já diz 700ml/.test(txt), (txt.match(/[^\n]*já diz[^\n]*/) || ['(não leu)'])[0]);
cobra('e oferece o conserto num toque', /Usar 700 ml/.test(txt), (txt.match(/[^\n]*Usar 700[^\n]*/) || ['(sem botão)'])[0]);
cobra('sem mandar ela pra outra tela', !/preenche o conteúdo da embalagem/.test(txt));

cobra('tocou em "Usar 700 ml"', await pg.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find((e) => /Usar 700 ml/.test(e.innerText || ''));
  if (x) { x.click(); return true; }
  return false;
}));
await pg.waitForTimeout(2600);
const mon = (await painel()).estoque.find((e) => e.id === 'mon');
cobra('gravou 700 ml no item', mon && Number(mon.conteudo) === 700 && mon.conteudoUnid === 'ml', JSON.stringify(mon && { c: mon.conteudo, u: mon.conteudoUnid }));
cobra('e não estragou o resto do cadastro', mon && mon.nome === 'Xarope Monin 700ml' && Number(mon.custo) === 59.9, JSON.stringify(mon && { n: mon.nome, c: mon.custo }));
txt = await texto();
cobra(`o custo caiu pra ${CERTO}`, txt.includes(CERTO), (txt.match(/[^\n]*Xarope Monin[^\n]*/) || [''])[0]);
cobra(`e sumiu o ${QUEBRADO}`, !txt.includes(QUEBRADO));
cobra('o aviso vermelho foi embora junto', !/Conversão no chute/i.test(txt), (txt.match(/[^\n]*onversão no chute[^\n]*/) || [''])[0]);

console.log('\n### e NÃO oferece quando a grandeza não casa');
// Nome em mililitro não conserta ficha que pede GRAMA: peso e volume são
// coisas diferentes, e preencher ali trocaria um custo errado por outro.
const pG = await painel();
await gravar({ ...pG,
  estoque: [{ id: 'mon2', nome: 'Xarope Monin 700ml', custo: '59,90', unidade: 'un', saldo: '4', categoria: 'Bar' }],
  fichas: [{ cardapioId: 'c2', itens: [{ estoqueId: 'mon2', qtd: '30', unidade: 'g' }] }],
});
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3600);
await irPara('Abastecimento');
await irPara('Preço certo');
await pg.evaluate(() => {
  const s5 = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /Batata Frita/.test(o.textContent)));
  const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  if (s5) { set.call(s5, 'c2'); s5.dispatchEvent(new Event('change', { bubbles: true })); }
});
await pg.waitForTimeout(1500);
txt = await texto();
cobra('ainda aponta o chute', /Conversão no chute/i.test(txt));
cobra('mas não oferece os 700 ml pra uma ficha em grama', !/Usar 700 ml/.test(txt), (txt.match(/[^\n]*Usar 700[^\n]*/) || [''])[0]);
cobra('e volta a mandar preencher no Estoque', /preenche o conteúdo da embalagem/.test(txt));

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
