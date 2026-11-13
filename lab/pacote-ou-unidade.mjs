// "ESTOU COM DIFICULDADE NA HORA QUE VOU CALCULAR O PREÇO CERTO DO PÃO DE
// ALHO: ELE PEGA O VALOR QUE ESTÁ NA COMPRA, QUE É 18 E POUCO, PORÉM NO
// ABASTECIMENTO O VALOR ESTÁ 3 E POUCO — PORQUE 18 E POUCO É O VALOR DO PACOTE
// QUE VEM COM 5 UNIDADES."
//
// Os dois números estavam certos. Um falava do PACOTE, o outro da UNIDADE. O
// que faltava era a frase que liga os dois: "neste pacote vêm 5".
//
// O Preço Certo usa de propósito o custo reconstruído pelas NOTAS, e não o
// guardado no item — é o único caminho em que o custo anda sozinho quando o
// fornecedor sobe o preço. Mas quando a nota não diz o que vem na embalagem,
// o custo da nota é o do pacote, e o preço sugerido sai cinco vezes maior.
//
// O QUE ESTE TESTE GUARDA:
//
//   - A TELA DE COMPRA PERGUNTA, NA HORA. "No estoque está R$ 3,68 por un e tu
//     está lançando R$ 18,40 — esse valor é do pacote ou de um só?" Com o
//     pacote na mão pra contar. Depois ninguém lembra.
//   - E PREENCHE NUM TOQUE, com a conta de volta visível: "Vêm 5 un (R$ 3,68
//     cada)". Se o número de volta bate com o estoque, ela sabe que acertou.
//   - DITO O QUE VEM DENTRO, O CUSTO SE ACERTA SOZINHO. Não é um campo que
//     serve pra enfeite: é o que divide 18,40 por 5.
//   - O PREÇO CERTO EXPLICA O NÚMERO ESTRANHO NA TELA EM QUE ELE APARECE.
//     O aviso já existia — no Estoque, que é onde se conserta. Só que ela não
//     estava lá: estava aqui, olhando R$ 18,40 sem explicação.
//   - E NÃO GRITA À TOA. Item em que a nota bate com o estoque não gera aviso
//     nenhum — alarme que sempre toca é alarme que se aprende a ignorar.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
// brl() escreve espaço DURO (U+00A0). Com o espaço do teclado não acha nada.
const limpa = (s) => String(s || '').replace(/ /g, ' ');
const hojeBR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const HOJE = hojeBR();

const p0 = await painel();
await gravar({ ...p0,
  negocio: { nome: 'Pico do Mané', cidade: 'Florianópolis', dona: 'Karen', papeis: { dona: 'Karen', garcom: 'Atendimento' } },
  estoque: [
    // O item está certo: R$ 3,68 a UNIDADE.
    { id: 'pao', nome: 'Pão de alho', custo: '3,68', unidade: 'un', saldo: '40', categoria: 'Cozinha' },
    // A testemunha: nota e item combinando. Não pode gerar aviso nenhum.
    { id: 'man', nome: 'Manteiga', custo: '28', unidade: 'kg', saldo: '5', categoria: 'Cozinha' },
  ],
  cardapio: [
    { id: 'c-pao', nome: 'Pão de alho na brasa', categoria: 'Cozinha', preco: '14', ativo: true },
    { id: 'c-man', nome: 'Pão na manteiga', categoria: 'Cozinha', preco: '10', ativo: true },
  ],
  fichas: [
    { cardapioId: 'c-pao', itens: [{ estoqueId: 'pao', qtd: '1', unidade: 'un' }] },
    { cardapioId: 'c-man', itens: [{ estoqueId: 'man', qtd: '0,05', unidade: 'kg' }] },
  ],
  // A NOTA COMO ELA LANÇOU: 1 pacote por R$ 18,40, sem dizer que vêm 5.
  compras: [
    { id: 'cp1', data: HOJE, produto: 'Pão de alho', categoria: 'Cozinha', quantidade: '1', valorUnit: '18,40', estoqueId: 'pao', pago: 'Sim' },
    { id: 'cp2', data: HOJE, produto: 'Manteiga', categoria: 'Cozinha', quantidade: '1', valorUnit: '28', estoqueId: 'man', conteudo: '1', conteudoUnid: 'kg', pago: 'Sim' },
  ],
  receitas: [], despesas: [], diario: [], clientes: [],
});

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const pg = await ctx.newPage();
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
pg.on('console', (m) => { const x = m.text(); if (m.type() === 'error' && !/status of 40/.test(x)) { console.log('[console]', x.slice(0, 160)); ruim++; } });

await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1800);
await pg.locator('button:text-is("Karen")').first().click();
await pg.locator('input[type="password"]').first().fill('Teste@123');
await pg.locator('button:has-text("Entrar")').first().click();
await pg.waitForTimeout(3800);

// innerText obedece o text-transform do CSS: comparo sem ligar pra caixa.
const tocar = (rot) => pg.evaluate((r) => {
  const lim = (t) => String(t || '').replace(/ /g, ' ').trim().toLowerCase();
  const x = [...document.querySelectorAll('button')].find((e) => lim(e.innerText) === r.toLowerCase());
  if (x) { x.click(); return true; }
  return false;
}, rot);
const irPara = async (rot) => { const ok = await tocar(rot); await pg.waitForTimeout(1700); cobra(`achou o caminho "${rot}"`, ok); };
const texto = async () => limpa(await pg.locator('body').innerText());
const escolher = (rot, valor) => pg.evaluate((x) => {
  const lab = [...document.querySelectorAll('div,label')].find((d) => d.children.length === 0 && (d.textContent || '').trim().toLowerCase() === x.rot.toLowerCase());
  const campo = lab && lab.parentElement ? lab.parentElement.querySelector('select') : null;
  if (!campo) return false;
  const alvo = [...campo.options].find((o) => (o.textContent || '').toLowerCase().includes(x.valor.toLowerCase()));
  if (!alvo) return false;
  const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  set.call(campo, alvo.value);
  campo.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}, { rot, valor });
const digitar = (rot, valor) => pg.evaluate((x) => {
  const lab = [...document.querySelectorAll('div,label')].find((d) => d.children.length === 0 && (d.textContent || '').trim().toLowerCase() === x.rot.toLowerCase());
  const campo = lab && lab.parentElement ? lab.parentElement.querySelector('input') : null;
  if (!campo) return false;
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(campo, x.valor);
  campo.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}, { rot, valor });

// ---------------------------------------------------------------------------
console.log('\n### O PREÇO CERTO EXPLICA O NÚMERO ESTRANHO, ONDE ELE APARECE');
await irPara('Abastecimento');
await irPara('Preço Certo');
await pg.waitForTimeout(1200);
cobra('escolheu o pão de alho', await escolher('Produto', 'Pão de alho na brasa'));
await pg.waitForTimeout(1200);
let txt = await texto();
// SÓ O PEDAÇO DO AVISO: o corpo inteiro cospe reais em vários lugares.
const aviso = (t) => {
  const i = t.toLowerCase().indexOf('o custo abaixo está alto demais');
  return i < 0 ? '' : t.slice(i, i + 700);
};
cobra('a tela acusa que o custo está alto demais', /o custo abaixo está alto demais/i.test(txt),
  (txt.match(/[^\n]*custo abaixo[^\n]*/i) || ['(ficou quieta)'])[0]);
cobra('mostra o que a conta está usando: R$ 18,40', /usando R\$ 18,40 por un/i.test(aviso(txt)), aviso(txt).split('\n').slice(0, 3).join(' | '));
cobra('e o que o estoque diz: R$ 3,68', /no estoque ele está a R\$ 3,68/i.test(aviso(txt)), aviso(txt).split('\n').slice(0, 3).join(' | '));
cobra('diz quantas vezes de diferença', /5× menos/.test(aviso(txt)), aviso(txt).split('\n').slice(0, 3).join(' | '));
cobra('e aponta a causa: a nota não diz o que vem na embalagem', /não dizem o que vem na embalagem/i.test(aviso(txt)), aviso(txt).split('\n').slice(0, 4).join(' | '));
cobra('ensina onde consertar', /Cada um tem/.test(aviso(txt)) && /Compras/.test(aviso(txt)), '(manda preencher "Cada um tem" em Compras)');
// O conserto é consertar, não ignorar: enquanto não arruma, o preço está errado.
cobra('e avisa pra NÃO usar o preço sugerido até arrumar', /não usa o preço sugerido abaixo/i.test(aviso(txt)),
  (aviso(txt).match(/[^\n]*preço sugerido[^\n]*/i) || ['(não avisa)'])[0]);

console.log('\n### E NÃO GRITA À TOA');
cobra('escolheu o pão na manteiga, cuja nota bate', await escolher('Produto', 'Pão na manteiga'));
await pg.waitForTimeout(1200);
txt = await texto();
cobra('nenhum aviso nesse', !/o custo abaixo está alto demais/i.test(txt),
  (txt.match(/[^\n]*custo abaixo[^\n]*/i) || ['(ficou quieta, que é o certo)'])[0]);

// ---------------------------------------------------------------------------
console.log('\n### A TELA DE COMPRA PERGUNTA NA HORA, COM O PACOTE NA MÃO');
await irPara('Abastecimento');
await irPara('Compras');
await pg.waitForTimeout(1400);
cobra('escreveu o produto', await digitar('Produto', 'Pão de alho'));
await pg.waitForTimeout(500);
cobra('pôs a quantidade', await digitar('Qtd', '1'));
await pg.waitForTimeout(400);
cobra('e o valor do pacote', await digitar('Valor un. (R$)', '18,40'));
await pg.waitForTimeout(900);
txt = await texto();
const perg = (t) => { const i = t.toLowerCase().indexOf('esse valor é do pacote ou de um só'); return i < 0 ? '' : t.slice(i, i + 600); };
cobra('a tela pergunta se o valor é do pacote', /esse valor é do pacote ou de um só/i.test(txt),
  (txt.match(/[^\n]*pacote ou de um só[^\n]*/i) || ['(não perguntou nada)'])[0]);
cobra('com os dois números do lado: 3,68 e 18,40', /R\$ 3,68/.test(perg(txt)) && /R\$ 18,40/.test(perg(txt)), perg(txt).split('\n').slice(0, 3).join(' | '));
cobra('e diz que é 5× mais', /5× mais/.test(perg(txt)), perg(txt).split('\n').slice(0, 3).join(' | '));
// A conta de volta é o que deixa ela conferir com o olho antes de tocar.
cobra('oferece preencher num toque, com a conta de volta', /Vêm 5 un \(R\$ 3,68 cada\)/.test(perg(txt)),
  (perg(txt).match(/[^\n]*Vêm \d+[^\n]*/) || ['(não oferece)'])[0]);
cobra('e deixa dizer que é de um só mesmo', /É de um só mesmo/i.test(perg(txt)), '(a saída pra quando não é pacote)');

console.log('\n### TOCOU: O CAMPO SE PREENCHE E A PERGUNTA SOME');
cobra('tocou em "Vêm 5 un"', await tocar('Vêm 5 un (R$ 3,68 cada)'));
await pg.waitForTimeout(900);
txt = await texto();
cobra('a pergunta sumiu, porque foi respondida', !/esse valor é do pacote ou de um só/i.test(txt),
  (txt.match(/[^\n]*pacote ou de um só[^\n]*/i) || ['(sumiu, certo)'])[0]);
// Não é campo de enfeite: é o que faz a linha entrar como 5 un no estoque.
// A LINHA DO DESTINO, e não "5 un" em qualquer canto: o texto de ajuda logo
// abaixo fala em "caixa de 12 un", e procurar no corpo inteiro faria esta
// asserção passar com o campo vazio.
const destino = (txt.match(/[^\n]*Vai somar no estoque[^\n]*/i) || [''])[0];
cobra('a linha agora entra como 5 un no estoque', /\+5 un/.test(destino), destino || '(não diz o destino)');
// E a própria linha já mostra a conta de volta: 18,40 ÷ 5 = 3,68.
cobra('e já mostra o custo certo por unidade', /custo R\$ 3,68 por un/.test(destino), destino || '(não mostra o custo)');

console.log('\n### DITO O QUE VEM DENTRO, O CUSTO SE ACERTA SOZINHO');
// Arruma a nota velha direto no banco — é o mesmo que ela abrir e preencher.
const pAgora = await painel();
await gravar({ ...pAgora, compras: pAgora.compras.map((c) => (c.id === 'cp1' ? { ...c, conteudo: '5', conteudoUnid: 'un' } : c)) });
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3600);
await irPara('Abastecimento');
await irPara('Preço Certo');
await pg.waitForTimeout(1200);
cobra('escolheu o pão de alho de novo', await escolher('Produto', 'Pão de alho na brasa'));
await pg.waitForTimeout(1200);
txt = await texto();
cobra('o aviso sumiu', !/o custo abaixo está alto demais/i.test(txt),
  (txt.match(/[^\n]*custo abaixo[^\n]*/i) || ['(sumiu, certo)'])[0]);
// 18,40 ÷ 5 = 3,68. O mesmo número que o estoque sempre disse.
// O NÚMERO QUE A TELA MOSTRA COMO CUSTO, lido da linha seguinte ao rótulo.
// No corpo inteiro, "R$ 3,68" aparece também na explicação de onde vem o
// custo — e aí a asserção passaria mesmo com o número grande errado.
const linhas = txt.split('\n');
const iCusto = linhas.findIndex((l) => /^custo de uma unidade$/i.test(l.trim()));
const valorCusto = iCusto >= 0 ? (linhas[iCusto + 1] || '').trim() : '';
// 18,40 ÷ 5 = 3,68. O mesmo número que o estoque sempre disse.
cobra('o custo virou R$ 3,68, igual ao do estoque', valorCusto === 'R$ 3,68', valorCusto || '(não achou o custo na tela)');
cobra('e não é mais o R$ 18,40 do pacote', valorCusto !== 'R$ 18,40', valorCusto);

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
