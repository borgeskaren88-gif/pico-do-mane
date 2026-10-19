// "QUERO UMA ÁREA COM UMA CALCULADORA ASSIM" (a da Stone, de preço de venda).
//
// O que este teste guarda é A FÓRMULA, e ela é contraintuitiva:
//
//   Quase todo mundo faz preço multiplicando o custo. Isso ignora que imposto,
//   cartão e comissão são cobrados em cima do PREÇO. A conta certa é
//
//       preço = custo ÷ (1 − taxas − margem)
//
//   Com custo R$ 8,00, taxas 9,5% e margem 25%, o preço é R$ 12,21 (R$ 12,50
//   arredondado). Quem trocar isso por markup chega em R$ 10,00 — e ela passa a
//   cobrar barato em TODO o cardápio sem nada na tela avisando.
//
// Erro de preço não dá erro: dá um mês ruim que ninguém sabe explicar. Por isso
// o teste confere o número contra a conta feita na mão, e também contra as duas
// respostas erradas mais prováveis.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });

// A CONTA FEITA NA MÃO — é ela que julga a tela, não o contrário.
//   custo .......... 0,4 kg × R$ 20,00/kg = R$ 8,00
//   taxas .......... 6% de imposto + 3,5% de cartão = 9,5%
//   margem ......... 25%
//   preço exato .... 8 ÷ (1 − 0,345) = R$ 12,2137…
//   sugerido ....... arredonda pra cima no meio real = R$ 12,50
//   hoje ela cobra . R$ 10,00
//   margem de hoje . (1 − 0,095) − 8/10 = 10,5%
//   bolso hoje ..... 10 × 0,905 − 8 = R$ 1,05
//   bolso no certo . 12,50 × 0,905 − 8 = R$ 3,31
//   na mesa ........ R$ 2,26 por porção · R$ 226,25 em 100
const CUSTO = 'R$ 8,00';
const SUGERIDO = 'R$ 12,50';
const MARKUP_ERRADO = 'R$ 10,00';   // custo × (1 + margem) — ignora as taxas
const OUTRO_ERRADO = 'R$ 10,67';    // custo ÷ (1 − margem) — esquece as taxas
const NA_MESA = 'R$ 2,26';

const p0 = await painel();
await gravar({ ...p0,
  estoque: [{ id: 'e1', nome: 'Batata congelada', custo: '20', unidade: 'kg', saldo: '30', categoria: 'Cozinha' }],
  cardapio: [{ id: 'c1', nome: 'Porção de batata', categoria: 'Porções', preco: '10,00', ativo: true }],
  fichas: [{ cardapioId: 'c1', itens: [{ estoqueId: 'e1', qtd: '0,4', unidade: 'kg' }] }],
  precoBase: undefined,
});

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 950 }, serviceWorkers: 'block' });
const pg = await ctx.newPage();
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
pg.on('console', (m) => { const x = m.text(); if (m.type() === 'error' && !/status of 40/.test(x)) { console.log('[console]', x.slice(0, 160)); ruim++; } });

await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1600);
await pg.locator('button:text-is("Dona")').first().click();
await pg.locator('input[type="password"]').first().fill('Teste@123');
await pg.locator('button:has-text("Entrar")').first().click();
await pg.waitForTimeout(3800);

// O R$ do pt-BR vem com ESPAÇO INQUEBRÁVEL (U+00A0), não com espaço comum.
// Os dois são idênticos na tela e diferentes pro computador: a primeira versão
// deste teste reprovou "R$ 8,00" por não ser igual a "R$ 8,00". Aqui o escape
// é explícito justamente pra ninguém mais cair nessa olhando o código.
const limpa = (s) => String(s || '').replace(/\u00A0/g, ' ');
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
// O rótulo e o valor são duas colunas; innerText devolve cada uma numa linha.
const linha = async (rotulo) => {
  const l = (await texto()).split('\n');
  const i = l.findIndex((x) => x.trim().startsWith(rotulo));
  return i < 0 ? '(não achou)' : `${l[i]} ⇢ ${l[i + 1] || ''}`;
};
// Preenche um campo de % pelo rótulo que está em cima dele.
const porCento = async (rotulo, valor) => {
  const ok = await pg.evaluate(([r, v]) => {
    const lab = [...document.querySelectorAll('div')].find((d) => (d.textContent || '').trim() === r && d.children.length === 0);
    const campo = lab && lab.parentElement && lab.parentElement.querySelector('input');
    if (!campo) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(campo, v);
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, [rotulo, valor]);
  cobra(`preencheu "${rotulo}"`, ok);
  await pg.waitForTimeout(500);
};

await irPara('Abastecimento');
await irPara('Preço certo');

console.log('\n### o custo vem da ficha técnica — ela não digita ingrediente nenhum');
// É isto que a calculadora da internet não consegue fazer: ela não sabe o que
// tem dentro da porção. O sistema sabe.
await pg.evaluate(() => {
  const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /Porção de batata/.test(o.textContent)));
  if (!s) return;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  setter.call(s, 'c1');
  s.dispatchEvent(new Event('change', { bubbles: true }));
});
await pg.waitForTimeout(1200);
const lCusto = await linha('Custo de uma unidade');
cobra(`o custo saiu sozinho: ${CUSTO}`, lCusto.includes(CUSTO), lCusto);

console.log('\n### a conta é margem sobre a venda, NÃO markup');
await porCento('Impostos (% da venda)', '6');
await porCento('Taxa média do cartão', '3,5');
await porCento('Margem de lucro desejada', '25');
await pg.waitForTimeout(900);
let txt = await texto();
// O título vem em CAIXA ALTA porque o CSS manda. Procurando com a caixa do
// código, o indexOf dava -1, o recorte saía VAZIO — e as duas conferências de
// "não pode ser tal número" passavam sem testar coisa nenhuma. Passar por
// vazio é o pior jeito de passar: parece proteção e não é. Por isso o recorte
// agora é checado antes de ser usado.
const iSug = txt.search(/Preço de venda sugerido/i);
cobra('achou o quadro do preço sugerido', iSug >= 0);
const bloco = iSug >= 0 ? txt.slice(iSug, iSug + 420) : '';
cobra('e o quadro não está vazio', bloco.length > 80, `${bloco.length} caracteres`);
cobra(`o preço sugerido é ${SUGERIDO}`, bloco.includes(SUGERIDO), bloco.replace(/\n/g, ' | ').slice(0, 170));
cobra(`e NÃO ${MARKUP_ERRADO} (custo × 1,25 — o erro de quem multiplica o custo)`, !bloco.includes(MARKUP_ERRADO));
cobra(`nem ${OUTRO_ERRADO} (esqueceu imposto e cartão)`, !bloco.includes(OUTRO_ERRADO));
cobra('mostra a conta exata antes do arredondamento', /12,21/.test(bloco), (bloco.match(/[^\n]*exata[^\n]*/) || [''])[0]);

console.log('\n### "pra onde vai cada R$ 1,00" fecha em 100%');
// Se as fatias não somarem o preço inteiro, tem dinheiro sem dono no desenho.
const fatias = await pg.evaluate(() => {
  const lim = (s) => String(s || '').replace(/\u00A0/g, ' ');
  const t = [...document.querySelectorAll('div')].find((d) => lim(d.textContent).trim() === 'Pra onde vai cada R$ 1,00 que entra');
  if (!t) return null;
  // SÓ AS LINHAS DA LEGENDA. Pegando toda div, o contêiner também entra — o
  // texto dele termina com o "· 25%" da última linha e a soma dava 126%.
  return [...t.parentElement.querySelectorAll('span')]
    .map((d) => lim(d.textContent).match(/^R\$ [\d.,]+ · (\d+)%$/))
    .filter(Boolean).map((m) => Number(m[1]));
});
cobra('as fatias aparecem', Array.isArray(fatias) && fatias.length >= 3, JSON.stringify(fatias));
if (Array.isArray(fatias) && fatias.length) {
  const soma = fatias.reduce((a, c) => a + c, 0);
  cobra('somam ~100% (arredondamento de 1 em 1 ponto)', Math.abs(soma - 100) <= 2, `soma ${soma}%`);
}

console.log('\n### e diz quanto ela está deixando na mesa cobrando o preço de hoje');
cobra('aponta o preço de hoje', /R\$ 10,00/.test(txt));
cobra(`diz que são ${NA_MESA} por porção`, txt.includes(NA_MESA), (txt.match(/[^\n]*na mesa[^\n]*/) || ['(não disse)'])[0]);
cobra('e o quanto isso vira no mês', /R\$ 226,25/.test(txt), (txt.match(/[^\n]*100 unidades[\s\S]{0,60}/) || [''])[0].replace(/\n/g, ' '));

console.log('\n### margem impossível não inventa um preço');
// Taxas 9,5% + margem 95% passa de 100%: não existe preço que feche. Mostrar
// um número gigante aqui seria pior que não mostrar nada.
await porCento('Margem de lucro desejada', '95');
await pg.waitForTimeout(900);
txt = await texto();
cobra('avisa que não existe esse preço', /Não existe preço que feche/i.test(txt), (txt.match(/[^\n]*Não existe preço[^\n]*/) || ['(não avisou)'])[0]);
cobra('e diz até quanto dá pra pedir', /menos de 90|menos de 91/.test(txt), (txt.match(/[^\n]*Baixa a margem[^\n]*/) || [''])[0]);

console.log('\n### as taxas ficam guardadas — ela não redigita a cada produto');
await porCento('Margem de lucro desejada', '25');
await pg.waitForTimeout(1500);
const salvo = (await painel()).precoBase || {};
cobra('gravou no banco', salvo.impostos === '6' && salvo.cartao === '3,5' && salvo.margem === '25', JSON.stringify(salvo));
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3800);
await irPara('Abastecimento');
await irPara('Preço certo');
txt = await texto();
cobra('e voltam preenchidas depois de recarregar', await pg.evaluate(() => {
  const vals = [...document.querySelectorAll('input')].map((i) => i.value);
  return vals.includes('6') && vals.includes('3,5') && vals.includes('25');
}));

console.log('\n### pôr o preço no cardápio pede confirmação — é o que o cliente paga');
await pg.evaluate(() => {
  const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /Porção de batata/.test(o.textContent)));
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  if (s) { setter.call(s, 'c1'); s.dispatchEvent(new Event('change', { bubbles: true })); }
});
await pg.waitForTimeout(1400);
const toque = async (t) => pg.evaluate((x) => {
  const lim = (s) => String(s || '').replace(/\u00A0/g, ' ').trim();
  const b2 = [...document.querySelectorAll('button')].find((e) => lim(e.innerText).startsWith(x));
  if (b2) { b2.click(); return true; }
  return false;
}, t);
cobra('tem o botão de aplicar', await toque('Pôr R$ 12,50 no cardápio'));
await pg.waitForTimeout(700);
cobra('UM toque só não troca nada', (await painel()).cardapio[0].preco === '10,00', (await painel()).cardapio[0].preco);
cobra('ele pergunta antes', /Sim, trocar/.test(await texto()));
cobra('tocou no "Sim, trocar"', await toque('Sim, trocar'));
await pg.waitForTimeout(1800);
cobra('aí sim o cardápio mudou pra 12,50', (await painel()).cardapio[0].preco === '12,50', (await painel()).cardapio[0].preco);

console.log('\n### o exemplo "25%" era uma ARMADILHA pra bar — a tela avisa');
// Eu copiei "ex.: 25" das calculadoras de varejo. Lá o custo é a mercadoria
// pronta. Aqui o custo é só o INGREDIENTE — aluguel, salário e luz não estão
// nele. Com 25% numa porção de R$ 8,00 de ingrediente, o preço sai R$ 11,50 e
// o ingrediente come 72% da venda. A tela diria "25% de lucro" enquanto ela
// vendia no vermelho. É o tipo de erro que não dá erro.
await porCento('Impostos (% da venda)', '0');       // MEI: DAS é fixo, não % da venda
await porCento('Taxa média do cartão', '3,15');     // a maquininha dela
await porCento('Margem de lucro desejada', '25');
await pg.waitForTimeout(900);
txt = await texto();
cobra('com 25% o ingrediente come 72% da venda', /72% da venda/.test(txt), (txt.match(/[^\n]*% da venda[^\n]*/) || ['(não mostrou)'])[0]);
cobra('e a tela manda pedir mais margem', /Pede mais margem/i.test(txt), (txt.match(/[^\n]*acima de 45%[^\n]*/) || [''])[0]);

console.log('\n### com a margem certa pra bar, o número fecha');
await porCento('Margem de lucro desejada', '65');
await pg.waitForTimeout(900);
txt = await texto();
// 8 ÷ (1 − 0,0315 − 0,65) = R$ 25,12 exatos → R$ 25,50 arredondado pra cima.
cobra('preço sugerido R$ 25,50', txt.includes('R$ 25,50'), (txt.match(/[^\n]*A conta exata[^\n]*/) || [''])[0]);
cobra('a conta exata deu R$ 25,12', /R\$ 25,12/.test(txt));
cobra('e o ingrediente cai pra 32% da venda', /32% da venda/.test(txt), (txt.match(/[^\n]*% da venda[^\n]*/) || [''])[0]);
cobra('aí sim a tela diz que está tranquilo', /faixa tranquila/i.test(txt));

console.log('\n### QUANDO ELA JÁ COBRA MAIS, O BOTÃO NÃO PODE CONVIDAR A BAIXAR');
// O caso real que ela mandou: Batata clássica, custo R$ 3,22 de ficha, preço
// R$ 29,99. Com 65% de margem o sugerido dá R$ 10,50 — e a tela oferecia
// "Pôr R$ 10,50 no cardápio" logo abaixo de "não precisa mexer". Um toque e
// ela jogaria fora R$ 18,88 por porção.
//
// O sugerido é PISO: o mínimo pra margem pedida. Não é alvo nem teto.
const pAtual = await painel();
await gravar({ ...pAtual,
  estoque: [{ id: 'e1', nome: 'Batata congelada', custo: '8,05', unidade: 'kg', saldo: '30', categoria: 'Cozinha' }],
  cardapio: [{ id: 'c1', nome: 'Batata clássica', categoria: 'Porções', preco: '29,99', ativo: true }],
  fichas: [{ cardapioId: 'c1', itens: [{ estoqueId: 'e1', qtd: '0,4', unidade: 'kg' }] }],
  precoBase: { impostos: '0', cartao: '3,15', comissao: '', delivery: '', margem: '65' },
});
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3600);
await irPara('Abastecimento');
await irPara('Preço certo');
await pg.evaluate(() => {
  const s2 = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /Batata clássica/.test(o.textContent)));
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  if (s2) { setter.call(s2, 'c1'); s2.dispatchEvent(new Event('change', { bubbles: true })); }
});
await pg.waitForTimeout(1400);
txt = await texto();
cobra('o sugerido é R$ 10,50', txt.includes('R$ 10,50'), (txt.match(/[^\n]*conta exata[^\n]*/) || [''])[0]);
cobra('a tela chama isso de MÍNIMO, não de preço certo', /é o mínimo pra margem que tu pediu/i.test(txt), (txt.match(/[^\n]*mínimo[^\n]*/) || ['(não disse)'])[0]);
cobra('e manda NÃO baixar', /Não baixa/.test(txt));
cobra('NÃO existe mais o botão "Pôr R$ 10,50 no cardápio"', !(await toque('Pôr R$ 10,50 no cardápio')));
cobra('a saída pra baixar existe, mas diz o tamanho da perda', /perde R\$ 18,8\d por unidade/.test(txt), (txt.match(/[^\n]*se tu quiser mesmo assim[^\n]*/) || ['(não achou)'])[0]);

console.log('\n### e se ela insistir, a pergunta é em vermelho e diz o que perde');
cobra('tocou na saída', await toque('se tu quiser mesmo assim'));
await pg.waitForTimeout(700);
txt = await texto();
cobra('pergunta se tem certeza', /Tens certeza\?/.test(txt), (txt.match(/[^\n]*Tens certeza[^\n]*/) || [''])[0]);
cobra('o botão diz BAIXAR, não "trocar"', /Sim, baixar pra R\$ 10,50/.test(txt));
cobra('e o preço do cardápio segue intacto até ela confirmar', (await painel()).cardapio[0].preco === '29,99', (await painel()).cardapio[0].preco);

console.log('\n### "EM 100 UNIDADES SÃO R$ X" DEPENDE DE UMA SUPOSIÇÃO — e ela tem que vir escrita');
// O combo que ela testou: Apple Green, custo R$ 168,63, ela cobra R$ 399,99.
// Com 65% o sugerido dá R$ 529,50 — 32% mais caro. A tela dizia que ela
// deixava R$ 12.543,04 por mês na mesa, como se as 100 unidades continuassem
// saindo ao preço novo. Num salto desse tamanho, não continuam.
const pCombo = await painel();
await gravar({ ...pCombo,
  estoque: [{ id: 'e2', nome: 'Insumo do combo', custo: '168,63', unidade: 'un', saldo: '30', categoria: 'Outros' }],
  cardapio: [{ id: 'c2', nome: 'Apple Green', categoria: 'Combos', preco: '399,99', ativo: true }],
  fichas: [{ cardapioId: 'c2', itens: [{ estoqueId: 'e2', qtd: '1', unidade: 'un' }] }],
  precoBase: { impostos: '0', cartao: '3,15', comissao: '', delivery: '', margem: '65' },
});
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3600);
await irPara('Abastecimento');
await irPara('Preço certo');
await pg.evaluate(() => {
  const s3 = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /Apple Green/.test(o.textContent)));
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  if (s3) { setter.call(s3, 'c2'); s3.dispatchEvent(new Event('change', { bubbles: true })); }
});
await pg.waitForTimeout(1400);
txt = await texto();
cobra('reproduz o caso dela: sugerido R$ 529,50', txt.includes('R$ 529,50'), (txt.match(/[^\n]*conta exata[^\n]*/) || [''])[0]);
cobra('e o R$ 125,43 por unidade', /R\$ 125,4\d/.test(txt), (txt.match(/[^\n]*na mesa[^\n]*/) || [''])[0]);
cobra('A SUPOSIÇÃO VEM ESCRITA', /se continuar vendendo o mesmo tanto/.test(txt), (txt.match(/[^\n]*mesmo tanto[^\n]*/) || ['(continua escondida)'])[0]);
cobra('diz o tamanho do salto (32%)', /32% mais caro/.test(txt), (txt.match(/[^\n]*mais caro[^\n]*/) || [''])[0]);
cobra('avisa que a quantidade cai', /100 unidades podem virar 70/.test(txt));
cobra('manda subir aos poucos num salto grande', /aos poucos/.test(txt));
cobra('e explica que combo tem margem menor de propósito', /vender mais/.test(txt) && /combo/i.test(txt));
cobra('aponta onde se decide isso de verdade', /quem mais deu no mês/.test(txt));

console.log('\n### num aumento pequeno o aviso NÃO aparece — senão vira paisagem');
// Batata a R$ 10,00 com sugerido R$ 12,50 é 25% ... ainda grande. Usa um
// caso de verdade pequeno: preço 12,00 contra sugerido 12,50 = 4%.
const pP = await painel();
await gravar({ ...pP, cardapio: [{ ...pP.cardapio[0], preco: '510,00' }] });
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3600);
await irPara('Abastecimento');
await irPara('Preço certo');
await pg.evaluate(() => {
  const s4 = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /Apple Green/.test(o.textContent)));
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  if (s4) { setter.call(s4, 'c2'); s4.dispatchEvent(new Event('change', { bubbles: true })); }
});
await pg.waitForTimeout(1400);
txt = await texto();
cobra('ainda diz que está deixando na mesa', /na mesa/.test(txt));
cobra('mas sem o sermão do salto (só 4%)', !/mais caro/.test(txt), (txt.match(/[^\n]*mais caro[^\n]*/) || [''])[0]);

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
