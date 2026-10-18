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

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
