// "QUERIA DETERMINAR UM HORÁRIO PARA PROMOÇÃO DE UM PRODUTO. HOJE TIVE CHOPP A
// 9,99, FIZ DAS 16H ÀS 18H, AÍ 18H EU FUI E DESATIVEI DO CARDÁPIO."
//
// Ela trocava o preço na mão e desligava na mão. 18h de um sábado é exatamente
// a hora em que ninguém lembra de desligar nada: o chopp fica 9,99 a noite
// inteira, a margem vai pro chão e ninguém vê.
//
// O QUE ESTE TESTE GUARDA:
//
//   - QUEM COBRA É O SERVIDOR. A tela do garçom não calcula happy hour: ela
//     mostra o preço que veio pronto. Se calculasse sozinha, o relógio do iPad
//     dez minutos adiantado já faria ela mostrar 9,99 e o servidor cobrar
//     12,00 — com o cliente no caixa pra discutir.
//   - A PROMOÇÃO NÃO VAZA. Fora dos dias marcados, depois da data de fim e
//     desligada, o preço é o normal. Cada um desses é um jeito diferente de
//     deixar 9,99 valendo pra sempre sem ninguém perceber.
//   - DOIS PREÇOS, DUAS LINHAS. A mesa que pediu dois chopps às 17h50 e mais
//     dois às 18h05 juntava os quatro numa linha só, com o preço do primeiro.
//     O happy hour vazava pra fora do horário e a conta do cliente não tinha
//     nada de errado pra mostrar.
//   - A VIRADA DA MEIA-NOITE. "22h às 1h" na sexta vale até 1h do sábado: quem
//     está no bar à meia-noite e meia ainda está na sexta à noite.
//   - E A TELA NÃO DEIXA SALVAR BOBAGEM: promoção mais cara que o preço normal
//     não é promoção, é armadilha.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
// brl() escreve espaço DURO entre o R$ e o número (U+00A0). Procurar com o
// espaço normal do teclado não acha nada, e a asserção passa a não valer nada.
const limpa = (s) => String(s || '').replace(/ /g, ' ');

// O RELÓGIO DE FLORIPA, QUE É O QUE A PROMOÇÃO OBEDECE.
const agoraBR = () => {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date())) if (x.type !== 'literal') p[x.type] = x.value;
  const dia = `${p.year}-${p.month}-${p.day}`;
  return { dia, min: Number(p.hour) * 60 + Number(p.minute) };
};
const semanaDe = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const maisDias = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const { dia: HOJE, min: MIN } = agoraBR();
const HOJE_SEM = semanaDe(HOJE);
const ONTEM = maisDias(HOJE, -1);
const ONTEM_SEM = semanaDe(ONTEM);
const TODOS = [0, 1, 2, 3, 4, 5, 6];
// OUTRO dia da semana, qualquer um que não seja hoje nem ontem.
const OUTRO_SEM = TODOS.filter((d) => d !== HOJE_SEM && d !== ONTEM_SEM)[0];

// A JANELA QUE ATRAVESSA A MEIA-NOITE, montada pra valer a qualquer hora.
//
// de 23:59 até 23:58 vira a meia-noite por construção, e em qualquer minuto do
// dia (menos dois) estamos na parte DEPOIS da virada — onde o dia que manda é
// o de ontem. Nesses dois minutos o teste não vale, e aí ele FALHA em vez de
// passar quieto: teste que se pula sozinho é teste que não guarda nada.
const DE_VIRA = '23:59';
const ATE_VIRA = '23:58';
if (MIN >= 23 * 60 + 58) {
  console.log(`  RUIM  este teste não vale entre 23:58 e 23:59 de Floripa (agora é ${Math.floor(MIN / 60)}:${String(MIN % 60).padStart(2, '0')}). Roda de novo em três minutos.`);
  process.exit(1);
}

const p0 = await painel();
await gravar({ ...p0,
  negocio: { nome: 'Pico do Mané', cidade: 'Florianópolis', dona: 'Karen', papeis: { dona: 'Karen', garcom: 'Atendimento' } },
  mesasQtd: 6,
  estoque: [{ id: 'est1', nome: 'Barril', custo: '11,50', unidade: 'L', saldo: '200', categoria: 'Bebidas' }],
  cardapio: [
    // VALENDO AGORA: janela do dia inteiro, todos os dias.
    { id: 'chp', nome: 'Chopp 300ml', categoria: 'Bebidas', preco: '12', ativo: true,
      promo: { preco: '9,99', de: '00:00', ate: '23:59', dias: TODOS, fim: '', ligada: true } },
    // NÃO PEGA: o dia da semana marcado não é hoje.
    { id: 'cer', nome: 'Cerveja long neck', categoria: 'Bebidas', preco: '14', ativo: true,
      promo: { preco: '8', de: '00:00', ate: '23:59', dias: [OUTRO_SEM], fim: '', ligada: true } },
    // NÃO PEGA: a data de fim já passou.
    { id: 'cai', nome: 'Caipirinha', categoria: 'Drinks', preco: '22', ativo: true,
      promo: { preco: '15', de: '00:00', ate: '23:59', dias: TODOS, fim: ONTEM, ligada: true } },
    // NÃO PEGA: desligada na mão.
    { id: 'por', nome: 'Porção de frango', categoria: 'Cozinha', preco: '40', ativo: true,
      promo: { preco: '25', de: '00:00', ate: '23:59', dias: TODOS, fim: '', ligada: false } },
    // VALENDO: atravessa a meia-noite e o dia marcado é o de ONTEM.
    { id: 'agu', nome: 'Água', categoria: 'Bebidas', preco: '6', ativo: true,
      promo: { preco: '3', de: DE_VIRA, ate: ATE_VIRA, dias: [ONTEM_SEM], fim: '', ligada: true } },
    // NÃO PEGA: mesma janela virada, mas marcada em HOJE — depois da virada
    // quem manda é ontem, então esta não é a noite dela.
    { id: 'suc', nome: 'Suco', categoria: 'Bebidas', preco: '9', ativo: true,
      promo: { preco: '4', de: DE_VIRA, ate: ATE_VIRA, dias: [HOJE_SEM], fim: '', ligada: true } },
    // Sem promoção nenhuma: a testemunha de que nada mudou pros outros.
    { id: 'caf', nome: 'Café', categoria: 'Bebidas', preco: '5', ativo: true },
  ],
  fichas: [], receitas: [], despesas: [], compras: [], diario: [], clientes: [],
});

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const pg = await ctx.newPage();
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
pg.on('console', (m) => { const x = m.text(); if (m.type() === 'error' && !/status of 40/.test(x)) { console.log('[console]', x.slice(0, 160)); ruim++; } });

await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1800);
await pg.locator('button:text-is("Atendimento")').first().click();
await pg.locator('input[type="password"]').first().fill('1234');
await pg.locator('button:has-text("Entrar")').first().click();
await pg.waitForTimeout(3800);

// ---------------------------------------------------------------------------
console.log('\n### O QUE O SERVIDOR MANDA PRA TELA DO GARÇOM');
// A tela não calcula promoção. Então o que importa é o que desce do servidor:
// é esse número que ela mostra e é esse que ela vai cobrar.
const doServidor = await pg.evaluate(async () => {
  const r = await fetch('/api/comandas');
  const j = await r.json();
  const m = {};
  for (const i of (j.cardapio || [])) m[i.id] = { preco: i.preco, promoDe: i.promoDe, promo: i.promo };
  return m;
});
const pr = (id) => doServidor[id] && Number(doServidor[id].preco);
cobra('o chopp desce a 9,99, não a 12,00', pr('chp') === 9.99, String(pr('chp')));
cobra('e vem com o preço normal pra riscar na tela', Number(doServidor.chp.promoDe) === 12, String(doServidor.chp.promoDe));
cobra('a long neck continua 14,00 (o dia não é dela)', pr('cer') === 14, String(pr('cer')));
cobra('a caipirinha continua 22,00 (a promoção acabou ontem)', pr('cai') === 22, String(pr('cai')));
cobra('a porção continua 40,00 (promoção desligada)', pr('por') === 40, String(pr('por')));
cobra('o café continua 5,00 (nunca teve promoção)', pr('caf') === 5, String(pr('caf')));
cobra('e nenhum deles vem marcado como promoção', !['cer', 'cai', 'por', 'caf'].some((k) => doServidor[k].promoDe != null),
  JSON.stringify(['cer', 'cai', 'por', 'caf'].map((k) => doServidor[k].promoDe)));
// A REGRA NÃO DESCE PRA TELA. Se o objeto `promo` fosse pro navegador, no dia
// seguinte alguém usaria ele pra calcular preço do lado de lá.
cobra('a regra da promoção não vai pro navegador', !Object.values(doServidor).some((x) => x.promo != null),
  JSON.stringify(Object.values(doServidor).map((x) => (x.promo ? 'veio' : '-'))));

console.log('\n### A VIRADA DA MEIA-NOITE');
cobra('a água está a 3,00 (a noite de ontem ainda corre)', pr('agu') === 3, String(pr('agu')));
cobra('o suco continua 9,00 (essa noite não é a dele)', pr('suc') === 9, String(pr('suc')));

// ---------------------------------------------------------------------------
console.log('\n### E É ISSO QUE ENTRA NA COMANDA');
const abrir = async (mesa) => pg.evaluate(async (m) => {
  const r = await fetch('/api/comandas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'abrir', mesa: m, pessoas: 2 }) });
  return (await r.json()).comanda;
}, mesa);
const add = async (id, cardapioId) => {
  const j = await pg.evaluate(async (x) => {
    const r = await fetch('/api/comandas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'add', comandaId: x.id, cardapioId: x.cardapioId }) });
    return { status: r.status, corpo: await r.json() };
  }, { id, cardapioId });
  if (!j.corpo || !j.corpo.comanda) { cobra(`o servidor aceitou o ${cardapioId}`, false, JSON.stringify(j).slice(0, 160)); return { itens: [] }; }
  return j.corpo.comanda;
};

const c1 = await abrir('1');
cobra('abriu a mesa 1', !!(c1 && c1.id), String(c1 && c1.id));
let com = await add(c1.id, 'chp');
await add(c1.id, 'chp');
com = await add(c1.id, 'cer');
const linhaDe = (c, cid) => (c.itens || []).filter((it) => it.cardapioId === cid);
cobra('dois chopps viraram uma linha de 2', linhaDe(com, 'chp').length === 1 && linhaDe(com, 'chp')[0].qtd === 2,
  JSON.stringify(linhaDe(com, 'chp').map((x) => [x.qtd, x.preco])));
cobra('cobrados a 9,99 cada', linhaDe(com, 'chp')[0].preco === 9.99, String(linhaDe(com, 'chp')[0].preco));
cobra('e a long neck a 14,00', linhaDe(com, 'cer')[0].preco === 14, String(linhaDe(com, 'cer')[0].preco));

// ---------------------------------------------------------------------------
console.log('\n### 18H EM PONTO: DOIS PREÇOS, DUAS LINHAS');
// Aqui eu faço o relógio virar à mão — desligando a promoção no banco — que é
// exatamente o que acontece quando dá a hora de terminar.
const pAgora = await painel();
await gravar({ ...pAgora, cardapio: pAgora.cardapio.map((i) => (i.id === 'chp' ? { ...i, promo: { ...i.promo, ligada: false } } : i)) });
await pg.waitForTimeout(400);
com = await add(c1.id, 'chp');
const chopps = linhaDe(com, 'chp');
cobra('o chopp de depois virou OUTRA linha', chopps.length === 2, JSON.stringify(chopps.map((x) => [x.qtd, x.preco])));
cobra('a linha velha ficou com 2 a 9,99', chopps.some((x) => x.qtd === 2 && x.preco === 9.99), JSON.stringify(chopps.map((x) => [x.qtd, x.preco])));
cobra('a nova entrou com 1 a 12,00', chopps.some((x) => x.qtd === 1 && x.preco === 12), JSON.stringify(chopps.map((x) => [x.qtd, x.preco])));
// O jeito antigo juntava os três a 9,99: 29,97 em vez de 33,98.
const soChopp = chopps.reduce((s, x) => s + x.qtd * x.preco, 0);
cobra('e o chopp da mesa soma 31,98, não 29,97', Math.round(soChopp * 100) === 3198, soChopp.toFixed(2));

// ---------------------------------------------------------------------------
console.log('\n### A DONA MONTA A PROMOÇÃO NA TELA');
const ctxD = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const don = await ctxD.newPage();
don.on('pageerror', (e) => { console.log('[pageerror dona]', e.message.slice(0, 160)); ruim++; });
don.on('dialog', (d) => d.accept());
await don.goto(BASE, { waitUntil: 'domcontentloaded' });
await don.waitForTimeout(1800);
await don.locator('button:text-is("Karen")').first().click();
await don.locator('input[type="password"]').first().fill('Teste@123');
await don.locator('button:has-text("Entrar")').first().click();
await don.waitForTimeout(3800);

const irPara = async (rot) => {
  const achou = await don.evaluate((r) => {
    const lim = (t) => String(t || '').replace(/\u00a0/g, ' ').trim().toLowerCase();
    const x = [...document.querySelectorAll('button')].find((e) => lim(e.innerText) === r.toLowerCase());
    if (x) { x.click(); return true; }
    return false;
  }, rot);
  await don.waitForTimeout(1700);
  cobra(`achou o caminho "${rot}"`, achou);
};
await irPara('Central de Operações');
await irPara('Cardápio');
await don.waitForTimeout(1200);

// Os campos da promoção, achados pelo rótulo (a ordem da tela pode mudar).
const porRotulo = (rot, valor) => don.evaluate((x) => {
  const lab = [...document.querySelectorAll('div,label')].find((d) => d.children.length === 0 && (d.textContent || '').trim().toLowerCase() === x.rot.toLowerCase());
  const campo = lab && lab.parentElement ? lab.parentElement.querySelector('input') : null;
  if (!campo) return false;
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(campo, x.valor);
  campo.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}, { rot, valor });

const textoDona = async () => limpa(await don.locator('body').innerText());
// A tela da promoção existe mesmo?
let td = await textoDona();
cobra('a tela do cardápio fala de promoção com horário', /promoção com horário/i.test(td),
  (td.match(/[^\n]*promo[^\n]*/i) || ['(não fala)'])[0]);
cobra('e explica com o caso dela: chopp a 9,99 das 16h às 18h', /chopp a 9,99 das 16h às 18h/i.test(td));

// Monta a promoção do Café: 3,50 das 00:00 às 23:59, todo dia.
cobra('escreveu o nome do item', await porRotulo('Item', 'Dose de gin'));
cobra('e o preço normal', await porRotulo('Preço (R$)', '5'));
cobra('pôs o preço da promoção', await porRotulo('Preço na promoção', '3,50'));
cobra('a hora de começar', await porRotulo('Começa', '00:00'));
cobra('e a de terminar', await porRotulo('Termina', '23:59'));
await don.waitForTimeout(600);
td = await textoDona();
// SO O PEDACO DO FORMULARIO. A lista embaixo tambem tem itens em promocao, e
// procurar no corpo inteiro faria esta assercao passar sem o formulario dizer
// nada — que e justamente o que eu quero provar que ele diz.
const noForm = (t) => {
  const i = t.toLowerCase().indexOf('promoção com horário');
  if (i < 0) return '';
  const f = t.toLowerCase().indexOf('sabores / variações', i);
  return t.slice(i, f < 0 ? undefined : f);
};
cobra('a tela já diz que vai valer agora', /valendo agora: R\$ 3,50/i.test(noForm(td)),
  (noForm(td).match(/[^\n]*valendo agora[^\n]*/i) || ['(não disse nada)'])[0]);

// A ARMADILHA: promoção mais cara que o preço normal.
cobra('trocou pra um preço MAIOR que o normal', await porRotulo('Preço na promoção', '7'));
await don.waitForTimeout(500);
td = await textoDona();
cobra('a tela acusa que isso não é promoção', /não é mais barato que o preço normal/i.test(noForm(td)),
  (noForm(td).match(/[^\n]*mais barato[^\n]*/i) || ['(deixou passar)'])[0]);
const antes = ((await painel()).cardapio || []).length;
await don.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === 'Adicionar'); if (x) x.click(); });
await don.waitForTimeout(2200);
cobra('e NÃO deixa salvar desse jeito', ((await painel()).cardapio || []).length === antes,
  `${antes} -> ${((await painel()).cardapio || []).length}`);

// Conserta o preço e salva de verdade.
cobra('voltou pra 3,50', await porRotulo('Preço na promoção', '3,50'));
await don.waitForTimeout(500);
await don.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === 'Adicionar'); if (x) x.click(); });
await don.waitForTimeout(2600);
const novoCafe = ((await painel()).cardapio || []).find((i) => i.nome === 'Dose de gin' && i.promo);
cobra('agora salvou com a promoção dentro', !!novoCafe, JSON.stringify(novoCafe && novoCafe.promo));
cobra('com o preço da promoção certo', !!novoCafe && novoCafe.promo.preco === '3,50', String(novoCafe && novoCafe.promo.preco));
cobra('o horário certo', !!novoCafe && novoCafe.promo.de === '00:00' && novoCafe.promo.ate === '23:59', JSON.stringify(novoCafe && [novoCafe.promo.de, novoCafe.promo.ate]));
cobra('e os sete dias marcados', !!novoCafe && novoCafe.promo.dias.length === 7, JSON.stringify(novoCafe && novoCafe.promo.dias));

// A LISTA DO CARDÁPIO MOSTRA O QUE ESTÁ VALENDO.
//
// Lido só do pedaço da lista: o formulário em cima também diz "valendo agora",
// e procurar no corpo inteiro faria esta asserção passar sem lista nenhuma.
td = await textoDona();
const naLista = (t) => { const i = t.toLowerCase().indexOf('itens do cardápio'); return i < 0 ? '' : t.slice(i); };
// A LINHA TODA, NUMA ASSERCAO SO. Separado, "todo dia" casava com a linha de
// OUTRO item e passava sem a dose de gin estar marcada em lugar nenhum.
const linhaDaDose = (naLista(td).match(/[^\n]*valendo agora: R\$ 3,50[^\n]*/i) || [''])[0];
cobra('a lista marca o item que está em promoção agora', !!linhaDaDose, linhaDaDose || '(a lista não marca nada)');
cobra('e diz em quais dias, na mesma linha', /todo dia/i.test(linhaDaDose), linhaDaDose || '(não diz)');
// A que acabou ontem não pode aparecer como valendo.
cobra('a caipirinha aparece como acabada, não como valendo', /acabou em/i.test(naLista(td)),
  (naLista(td).match(/[^\n]*acabou em[^\n]*/i) || ['(não aparece)'])[0]);
await ctxD.close();

// ---------------------------------------------------------------------------
console.log('\n### E O GARÇOM VÊ O PREÇO NOVO, SEM CALCULAR NADA');
const comPromo = await pg.evaluate(async () => {
  const r = await fetch('/api/comandas');
  const j = await r.json();
  const i = (j.cardapio || []).find((x) => x.nome === 'Dose de gin' && x.promoDe != null);
  return i ? { preco: i.preco, promoDe: i.promoDe } : null;
});
cobra('a dose de gin desce a 3,50 pro atendimento', !!comPromo && Number(comPromo.preco) === 3.5, JSON.stringify(comPromo));
cobra('com os 5,00 pra riscar do lado', !!comPromo && Number(comPromo.promoDe) === 5, JSON.stringify(comPromo));

await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3200);
const toqueG = (re) => pg.evaluate((r) => {
  const x = [...document.querySelectorAll('button')].find((e) => new RegExp(r, 'i').test(String(e.innerText || '').replace(/\u00a0/g, ' ').trim()));
  if (x) { x.click(); return true; }
  return false;
}, re.source);
if (!(await toqueG(/^balc/))) { await toqueG(/^comandas$/); await pg.waitForTimeout(1800); }
const noBalcao = await toqueG(/^balc/);
if (!noBalcao) console.log('   (botões do garçom: ' + (await pg.evaluate(() => [...document.querySelectorAll('button')].map((e) => String(e.innerText || '').trim()).filter(Boolean).slice(0, 25).join(' | '))) + ')');
cobra('entrou no balcão', noBalcao);
await pg.waitForTimeout(1800);
const botaoDoCafe = await pg.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find((e) => /^dose de gin/i.test((e.innerText || '').trim()));
  return x ? String(x.innerText || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim() : '';
});
cobra('o botão da dose mostra os 3,50', /R\$ 3,50/.test(botaoDoCafe), botaoDoCafe || '(não achou o botão)');
cobra('mostra os 5,00 que era antes', /R\$ 5,00/.test(botaoDoCafe), botaoDoCafe || '(não achou o botão)');
cobra('e avisa que é promoção', /promo/i.test(botaoDoCafe), botaoDoCafe || '(não achou o botão)');

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
