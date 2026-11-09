// "ISTO AQUI ESTÁ MUITO BOM, MAS PODERIA TER AO LADO DO VALOR FEITO, QUANTO
// TEVE DE LUCRO NÉ?"
//
// A tela dizia "32× Chopp PROMO — R$ 319,68" e parava ali. Quanto disso ficou
// no bolso dela, ninguém sabia: pra descobrir tinha que abrir a ficha técnica,
// achar o custo do litro, multiplicar por 0,3 e depois por 32. Ninguém faz
// isso num sábado.
//
// O QUE ESTE TESTE GUARDA:
//
//   - A SOBRA É RECEITA MENOS O CUSTO DA FICHA, no produto e no dia.
//   - PRODUTO SEM FICHA NÃO VIRA ZERO. Zero diria "não custou nada" e a soma
//     do dia mentiria pra cima. Vira "sem ficha técnica", e fica FORA do
//     total — com o aviso de quanto ficou de fora.
//   - PREJUÍZO APARECE COMO PREJUÍZO. Item que custa mais do que vende tem
//     que saltar da tela, não se diluir na média.
//   - FICHA INCOMPLETA AVISA. Custo faltando faz a sobra parecer maior do que
//     é, e é justamente isso que não pode passar calado.
//   - O DESCONTO DERRUBA A RECEITA. É a mesma régua do CMV do mês: duas telas
//     que respondem a mesma pergunta com contas diferentes sempre discordam.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
// brl() escreve espaço DURO (U+00A0) entre o R$ e o número. Procurar com o
// espaço do teclado não acha nada e a asserção passa a não valer nada.
const limpa = (s) => String(s || '').replace(/ /g, ' ');

// O DIA OPERACIONAL, a mesma conta da tela: antes das 6h da manhã, a noite
// ainda é a de ontem. Semeando no dia errado, a tela abriria vazia e o teste
// reclamaria da coisa errada.
const diaOperacional = () => {
  const agora = new Date();
  const h = parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(agora), 10) || 0;
  const base = h < 6 ? new Date(agora.getTime() - 24 * 3600 * 1000) : agora;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(base);
};
const DIA = diaOperacional();

const p0 = await painel();
await gravar({ ...p0,
  negocio: { nome: 'Pico do Mané', cidade: 'Florianópolis', dona: 'Karen', papeis: { dona: 'Karen', garcom: 'Atendimento' } },
  estoque: [
    { id: 'brr', nome: 'Barril de chopp', custo: '11,50', unidade: 'L', saldo: '100', categoria: 'Bebidas' },
    { id: 'vdk', nome: 'Vodka', custo: '60', unidade: 'L', saldo: '10', categoria: 'Bebidas' },
    { id: 'agu', nome: 'Água garrafa', custo: '2', unidade: 'un', saldo: '50', categoria: 'Bebidas' },
    // SEM CUSTO de propósito: é o que deixa a ficha da caipirinha incompleta.
    { id: 'gel', nome: 'Gelo', custo: '0', unidade: 'kg', saldo: '30', categoria: 'Bebidas' },
  ],
  cardapio: [
    { id: 'c-chp', nome: 'Chopp PROMO', categoria: 'Bebidas', preco: '9,99', ativo: true },
    { id: 'c-cam', nome: 'Camarão do Pico', categoria: 'Cozinha', preco: '129,90', ativo: true },
    { id: 'c-cai', nome: 'Caipirinha', categoria: 'Drinks', preco: '20', ativo: true },
    { id: 'c-dos', nome: 'Dose cara', categoria: 'Drinks', preco: '20', ativo: true },
    { id: 'c-agu', nome: 'Água', categoria: 'Bebidas', preco: '6', ativo: true },
  ],
  fichas: [
    { cardapioId: 'c-chp', itens: [{ estoqueId: 'brr', qtd: '0,3', unidade: 'L' }] },          // 3,45 o copo
    { cardapioId: 'c-cai', itens: [{ estoqueId: 'vdk', qtd: '0,08', unidade: 'L' }, { estoqueId: 'gel', qtd: '0,2', unidade: 'kg' }] }, // 4,80 + gelo sem custo
    { cardapioId: 'c-dos', itens: [{ estoqueId: 'vdk', qtd: '0,5', unidade: 'L' }] },          // 30,00 — vende por 20
    { cardapioId: 'c-agu', itens: [{ estoqueId: 'agu', qtd: '1', unidade: 'un' }] },           // 2,00
    // c-cam não tem ficha nenhuma: é o produto que o app NÃO sabe custear.
  ],
  receitas: [], despesas: [], compras: [], diario: [], clientes: [],
});

// Limpa vendas de outras rodadas e semeia as duas do dia.
for (const k of ['v1', 'v2']) await fetch(`${BANCO}?chave=eq.${MARCA}venda:${k}`, { method: 'DELETE' });
await fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([
  { chave: `${MARCA}venda:v1`,
    valor: { id: 'v1', data: DIA, mesa: '3', pessoas: 4, total: 659.48, fechadaEm: `${DIA}T22:10:00`, pagamento: 'Pix', descontoPct: 0,
      itens: [
        { cardapioId: 'c-chp', nome: 'Chopp PROMO', qtd: 32, preco: 9.99 },
        { cardapioId: 'c-cam', nome: 'Camarão do Pico', qtd: 2, preco: 129.90 },
        { cardapioId: 'c-cai', nome: 'Caipirinha', qtd: 3, preco: 20 },
        { cardapioId: 'c-dos', nome: 'Dose cara', qtd: 1, preco: 20 },
      ] } },
  // METADE DE DESCONTO: os 60,00 de água valem 30,00 de verdade.
  { chave: `${MARCA}venda:v2`,
    valor: { id: 'v2', data: DIA, mesa: '5', pessoas: 2, total: 30, fechadaEm: `${DIA}T23:40:00`, pagamento: 'Dinheiro', descontoPct: 50,
      itens: [{ cardapioId: 'c-agu', nome: 'Água', qtd: 10, preco: 6 }] } },
]) });

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

// innerText obedece o text-transform do CSS, então comparo sem ligar pra caixa.
const irPara = async (rot) => {
  const achou = await pg.evaluate((r) => {
    const lim = (t) => String(t || '').replace(/ /g, ' ').trim().toLowerCase();
    const x = [...document.querySelectorAll('button')].find((e) => lim(e.innerText) === r.toLowerCase());
    if (x) { x.click(); return true; }
    return false;
  }, rot);
  await pg.waitForTimeout(1700);
  cobra(`achou o caminho "${rot}"`, achou);
};
await irPara('Central de Operações');
await irPara('Vendas do dia');
await pg.waitForTimeout(1500);
await irPara('Por produto');
await pg.waitForTimeout(1200);

const texto = async () => limpa(await pg.locator('body').innerText());
// SÓ O PEDAÇO DA LISTA POR PRODUTO. O resumo do dia lá em cima também cospe
// reais, e procurar no corpo inteiro faria asserção passar sem a lista existir.
const naLista = (t) => { const i = t.toLowerCase().indexOf('o que saiu em'); return i < 0 ? '' : t.slice(i); };
// A linha de um produto são QUATRO linhas de texto: o nome, o valor, o
// detalhe ("em N comandas · custou X") e a sobra. Quatro exatas, de propósito:
// com cinco, a janela invadiria o produto de baixo e um "sobrou" do vizinho
// faria a asserção passar pelo motivo errado.
const linhaDe = (t, nome) => {
  const ls = naLista(t).split('\n');
  const i = ls.findIndex((l) => l.includes(nome));
  return i < 0 ? '' : ls.slice(i, i + 4).join(' ').replace(/\s+/g, ' ').trim();
};

let txt = await texto();
cobra('a lista por produto abriu', /o que saiu em/i.test(txt), (txt.match(/[^\n]*o que saiu em[^\n]*/i) || ['(não abriu)'])[0]);

console.log('\n### AO LADO DO VALOR FEITO, QUANTO SOBROU');
// 32 copos de 0,3 L a 11,50 o litro = 110,40 de chopp. Entraram 319,68.
const lChopp = linhaDe(txt, 'Chopp PROMO');
cobra('o chopp mostra os R$ 319,68 que entraram', /R\$ 319,68/.test(lChopp), lChopp || '(não achou a linha)');
cobra('e quanto custou: R$ 110,40', /custou R\$ 110,40/.test(lChopp), lChopp || '(não achou a linha)');
cobra('e quanto sobrou: R$ 209,28', /sobrou R\$ 209,28/.test(lChopp), lChopp || '(não achou a linha)');
cobra('com a margem do produto: 65%', /\b65%/.test(lChopp), lChopp || '(não achou a linha)');

const lCai = linhaDe(txt, 'Caipirinha');
cobra('a caipirinha sobrou R$ 45,60', /sobrou R\$ 45,60/.test(lCai), lCai || '(não achou a linha)');

console.log('\n### O QUE O APP NÃO SABE CUSTEAR, ELE NÃO CHUTA');
const lCam = linhaDe(txt, 'Camarão do Pico');
cobra('o camarão mostra os R$ 259,80 que entraram', /R\$ 259,80/.test(lCam), lCam || '(não achou a linha)');
cobra('mas diz "sem ficha técnica" em vez de inventar sobra', /sem ficha técnica/i.test(lCam), lCam || '(não achou a linha)');
// Zero diria "não custou nada" — e a sobra do dia subiria 259,80 de mentira.
cobra('e NÃO diz que sobrou tudo', !/sobrou R\$ 259,80/.test(lCam), lCam);

console.log('\n### PREJUÍZO APARECE COMO PREJUÍZO');
// Meio litro de vodka a 60,00 o litro = 30,00 num drink vendido por 20,00.
const lDose = linhaDe(txt, 'Dose cara');
cobra('a dose cara custou R$ 30,00', /custou R\$ 30,00/.test(lDose), lDose || '(não achou a linha)');
cobra('e a sobra dela é NEGATIVA: -R$ 10,00', /sobrou -R\$ 10,00/.test(lDose), lDose || '(não achou a linha)');

console.log('\n### FICHA INCOMPLETA AVISA, EM VEZ DE MENTIR PRA CIMA');
cobra('a caipirinha avisa que a ficha está incompleta', /ficha incompleta/i.test(lCai), lCai || '(não achou a linha)');
cobra('e diz qual custo falta: o gelo', /falta custo de[^·]*gelo/i.test(lCai), lCai || '(não achou a linha)');

console.log('\n### O DESCONTO DERRUBA A RECEITA, IGUAL AO CMV DO MÊS');
// 10 águas a 6,00 dão 60,00, mas a mesa saiu com 50% de desconto: 30,00.
const lAgua = linhaDe(txt, 'Água');
cobra('a água entra pelos R$ 30,00 de verdade, não pelos 60,00', /R\$ 30,00/.test(lAgua) && !/R\$ 60,00/.test(lAgua), lAgua || '(não achou a linha)');
cobra('custou R$ 20,00 e sobrou R$ 10,00', /custou R\$ 20,00/.test(lAgua) && /sobrou R\$ 10,00/.test(lAgua), lAgua || '(não achou a linha)');

console.log('\n### E O FECHAMENTO DO DIA');
// Só o que tem ficha: 319,68 + 60,00 + 20,00 + 30,00 = 429,68.
// Custo: 110,40 + 14,40 + 30,00 + 20,00 = 174,80. Sobra: 254,88 (59%).
const fim = naLista(txt);
const depoisDe = (rot) => { const m = fim.match(new RegExp(`${rot}[^\\n]*\\n?([^\\n]*)`, 'i')); return m ? `${m[0]}`.replace(/\s+/g, ' ').trim() : ''; };
cobra('diz quanto entrou do que dá pra custear: R$ 429,68', /entrou \(só o que tem ficha\)[\s\S]{0,40}R\$ 429,68/i.test(fim), depoisDe('entrou \\(só') || '(não diz)');
cobra('quanto custou no dia: R$ 174,80', /R\$ 174,80/.test(fim), depoisDe('custou \\(o que') || '(não diz)');
cobra('e quanto sobrou no dia: R$ 254,88', /sobrou no dia[\s\S]{0,40}R\$ 254,88/i.test(fim), depoisDe('sobrou no dia') || '(não diz)');
cobra('com a margem do dia: 59%', /sobrou no dia[\s\S]{0,60}\b59%/i.test(fim), depoisDe('sobrou no dia') || '(não diz)');

console.log('\n### E DIZ O QUE FICOU DE FORA DESSA CONTA');
cobra('avisa que 1 produto ficou de fora', /1 produto\(s\) ficaram de fora/i.test(fim),
  (fim.match(/[^\n]*ficaram de fora[^\n]*/i) || ['(não avisa)'])[0]);
cobra('e quanto ele valia: R$ 259,80', /ficaram de fora \(R\$ 259,80\)/i.test(fim),
  (fim.match(/[^\n]*ficaram de fora[^\n]*/i) || ['(não diz o valor)'])[0]);
cobra('avisa que 1 ficha está incompleta', /1 ficha\(s\) estão incompletas/i.test(fim),
  (fim.match(/[^\n]*incompletas[^\n]*/i) || ['(não avisa)'])[0]);
// Sobra NÃO é lucro do bar: aluguel, luz e salário ainda saem daqui.
cobra('e deixa claro que isso não é o lucro do bar', /aluguel, luz, gás e salário ainda saem daqui/i.test(fim),
  (fim.match(/[^\n]*ainda saem daqui[^\n]*/i) || ['(não explica)'])[0]);

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
