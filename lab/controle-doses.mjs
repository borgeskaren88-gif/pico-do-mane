// "EU TENHO USADO MUITO POUCO OU QUASE NADA A ÁREA DE CONTROLE DE BEBIDA, NÃO
// ACHO QUE ELA ESTÁ FUNCIONAL."
//
// Não estava: era um diário. Ela digitava nome, volume, dose e data de cada
// garrafa e ouvia de volta "dá 20 doses e durou 9 dias" — sem saber se as 20
// tinham sido vendidas. Agora a área faz a única conta que importa num bar:
//
//     o que saiu da garrafa − o que passou pela comanda = o que sumiu
//
// O QUE ESTE TESTE GUARDA:
//
//   - A PRIMEIRA CONTAGEM NÃO ACUSA NINGUÉM. O saldo de antes nunca tinha sido
//     conferido; a diferença é o estoque se acertando, não sumiço.
//   - DA SEGUNDA EM DIANTE, A RESPOSTA SAI EM DOSES E EM REAIS. "Faltam 200 ml"
//     não diz nada atrás do balcão; "sumiram 4 doses, R$ 88" diz.
//   - MÃO PESADA NÃO É SUMIÇO. 5% do que saiu fica amarelo; 20% fica vermelho.
//   - O BARRIL, QUE MORA EM LITROS, vira copos — e o app descobre sozinho que
//     ele é de 30 L, pelo nome.
//   - A CONTAGEM É ÀS CEGAS: o que o sistema espera não aparece antes.
//   - O ESTOQUE É ACERTADO PRO QUE ELA CONTOU. Senão a mesma dose faltaria de
//     novo em toda contagem, pra sempre.
//   - A GARRAFA ABERTA SE CONTA EM DÉCIMOS, tocando no desenho.
//   - SÓ ENTRA NA LISTA DA SEMANA O QUE É BEBIDA E GIRA. Farinha não.
//   - E UMA VEZ É RUÍDO, TODA VEZ É PROBLEMA: três faltas seguidas viram aviso.
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
const HOJE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const p0 = await painel();
await gravar({ ...p0,
  negocio: { nome: 'Pico do Mané', cidade: 'Florianópolis', dona: 'Karen', papeis: { dona: 'Karen', garcom: 'Atendimento' } },
  estoque: [
    // Garrafa contada em unidades: 1 un = 1 garrafa de 1000 ml. Dose de 50 ml.
    { id: 'vdk', nome: 'Vodka Absolut 1L', custo: '88', unidade: 'un', conteudo: '1000', conteudoUnid: 'ml', saldo: '3', categoria: 'Bebidas' },
    // O barril mora em LITROS. O tamanho (30) só está no nome.
    { id: 'brr', nome: 'Chopp Blumenau 30L', custo: '11,50', unidade: 'L', saldo: '60', categoria: 'Bebidas' },
    { id: 'gin', nome: 'Gin Tanqueray', custo: '120', unidade: 'un', conteudo: '750', conteudoUnid: 'ml', saldo: '2', categoria: 'Bebidas' },
    { id: 'ton', nome: 'Água tônica lata', custo: '4', unidade: 'un', saldo: '6', categoria: 'Bebidas' },
    // Gira, tem ficha, e NÃO é bebida: não pode aparecer na lista da semana.
    { id: 'far', nome: 'Farinha de trigo', custo: '6', unidade: 'kg', saldo: '10', categoria: 'Cozinha' },
  ],
  cardapio: [
    { id: 'c-vdk', nome: 'Dose de vodka', categoria: 'Drinks', preco: '22', ativo: true },
    { id: 'c-chp', nome: 'Chopp 500ml', categoria: 'Bebidas', preco: '14,99', ativo: true },
    { id: 'c-gin', nome: 'Gin tônica', categoria: 'Drinks', preco: '30', ativo: true },
    { id: 'c-pao', nome: 'Pão da casa', categoria: 'Cozinha', preco: '12', ativo: true },
  ],
  fichas: [
    { cardapioId: 'c-vdk', itens: [{ estoqueId: 'vdk', qtd: '50', unidade: 'ml' }] },
    { cardapioId: 'c-chp', itens: [{ estoqueId: 'brr', qtd: '0,5', unidade: 'L' }] },
    { cardapioId: 'c-gin', itens: [{ estoqueId: 'gin', qtd: '50', unidade: 'ml' }, { estoqueId: 'ton', qtd: '1', unidade: 'un' }] },
    { cardapioId: 'c-pao', itens: [{ estoqueId: 'far', qtd: '0,3', unidade: 'kg' }] },
  ],
  listaCompras: [], controleDoses: null,
  receitas: [], despesas: [], compras: [], diario: [], clientes: [], garrafas: [],
});
// As vendas do mês, que é de onde a tela tira "quais garrafas giram".
await fetch(`${BANCO}?chave=eq.${MARCA}venda:cd1`, { method: 'DELETE' });
await fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([
  { chave: `${MARCA}venda:cd1`, valor: { id: 'cd1', data: HOJE, mesa: '1', total: 1200, fechadaEm: `${HOJE}T20:00:00`,
    itens: [
      { cardapioId: 'c-chp', nome: 'Chopp 500ml', qtd: 40, preco: 14.99 },
      { cardapioId: 'c-vdk', nome: 'Dose de vodka', qtd: 10, preco: 22 },
      { cardapioId: 'c-gin', nome: 'Gin tônica', qtd: 6, preco: 30 },
      { cardapioId: 'c-pao', nome: 'Pão da casa', qtd: 50, preco: 12 },
    ] } },
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

// innerText obedece o text-transform do CSS: comparo sem ligar pra caixa.
const tocar = (rot) => pg.evaluate((r) => {
  const lim = (t) => String(t || '').replace(/ /g, ' ').trim().toLowerCase();
  const x = [...document.querySelectorAll('button')].find((e) => lim(e.innerText) === r.toLowerCase());
  if (x) { x.click(); return true; }
  return false;
}, rot);
const texto = async () => limpa(await pg.locator('body').innerText());
const abrirControle = async () => { const ok = await tocar('Controle'); await pg.waitForTimeout(1500); return ok; };
const saldoDe = async (id) => num3(((await painel()).estoque || []).find((x) => x.id === id)?.saldo);
const num3 = (v) => Math.round(Number(String(v).replace(',', '.')) * 1000) / 1000;
const registros = async () => ((await painel()).controleDoses || {}).registros || [];

// O bar trabalhou: a comanda baixou `qtd` deste item. É o que o fechamento de
// uma mesa faz no estoque — um movimento 'venda' e o saldo descendo.
const vender = async (id, qtd) => {
  await pg.waitForTimeout(2600); // deixa o app terminar de gravar o que tinha
  const p = await painel();
  await gravar({ ...p, estoque: p.estoque.map((it) => {
    if (it.id !== id) return it;
    const saldo = num3(num3(it.saldo) - qtd);
    return { ...it, saldo, movimentos: [{ id: `v${Date.now()}`, tipo: 'venda', qtd, saldoDepois: saldo, motivo: 'Venda', data: HOJE, ts: Date.now() }, ...(it.movimentos || [])] };
  }) });
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3600);
  await abrirControle();
};

// "Acabou" de uma garrafa: toca nela, põe as fechadas, confere.
const acabou = async (id, fechadas) => {
  await tocar('Acabou a garrafa');
  await pg.waitForTimeout(500);
  const abriu = await pg.evaluate((i) => { const x = document.querySelector(`[data-acabou="${i}"]`); if (x) { x.click(); return true; } return false; }, id);
  await pg.waitForTimeout(600);
  const painelTxt = limpa(await pg.evaluate(() => { const x = document.querySelector('[data-painel="acabou"]'); return x ? x.innerText : ''; }));
  await pg.evaluate((n) => {
    const mais = document.querySelector('[data-painel="acabou"] button[aria-label="mais"]');
    for (let k = 0; k <= n; k += 1) mais.click();   // o primeiro toque vai de "?" pra 0
  }, fechadas);
  await pg.waitForTimeout(300);
  await tocar('Conferir');
  await pg.waitForTimeout(2600);
  return { abriu, painelTxt };
};
// O pedaço do resultado, e só ele: o histórico embaixo repete as frases.
const resultado = async () => {
  const t = await texto();
  const i = t.toLowerCase().indexOf('resultado');
  const f = t.toLowerCase().indexOf('últimas contagens');
  return i < 0 ? '' : t.slice(i, f < 0 ? undefined : f);
};

// ---------------------------------------------------------------------------
console.log('\n### A ÁREA VIROU OUTRA COISA');
cobra('achou o Controle no menu', await abrirControle());
let txt = await texto();
cobra('a tela se chama Controle de doses', /controle de doses/i.test(txt), (txt.match(/[^\n]*controle de[^\n]*/i) || ['(não achou)'])[0]);
cobra('tem os dois jeitos: acabou a garrafa e conferência da semana', /acabou a garrafa/i.test(txt) && /conferência da semana/i.test(txt));
// O formulário do diário antigo pedia volume, dose e data. Não pede mais.
cobra('e não pede mais volume, dose nem data', !/volume da garrafa|dose padrão|data de abertura/i.test(txt),
  (txt.match(/[^\n]*(volume da garrafa|dose padrão|data de abertura)[^\n]*/i) || ['(não pede, certo)'])[0]);

console.log('\n### A PRIMEIRA CONTAGEM NÃO ACUSA NINGUÉM');
// O estoque diz 3 vodkas. Ela tem 2 fechadas. Antes de qualquer conferência,
// isso não é sumiço: é o cadastro velho.
let r = await acabou('vdk', 2);
cobra('tocou na vodka', r.abriu);
let res = await resultado();
cobra('diz que é a primeira contagem', /primeira contagem/i.test(res), res.split('\n').slice(0, 4).join(' | ') || '(sem resultado)');
cobra('mostra o que o estoque dizia e o que ela contou', /dizia 3 un e tu contou 2/i.test(res), res.split('\n').slice(0, 4).join(' | '));
cobra('e NÃO fala em sumiço', !/sumiram/i.test(res), (res.match(/[^\n]*sumiram[^\n]*/i) || ['(não acusa, certo)'])[0]);
await pg.waitForTimeout(2400);
cobra('o estoque foi acertado pra 2', (await saldoDe('vdk')) === 2, String(await saldoDe('vdk')));
cobra('e a contagem ficou guardada como ponto de partida', (await registros()).length === 1 && (await registros())[0].estado === 'partida',
  JSON.stringify((await registros()).map((x) => x.estado)));

console.log('\n### DA SEGUNDA EM DIANTE: DOSES E REAIS');
// Abriu uma das duas. A comanda registrou 16 doses (0,8 garrafa). A garrafa
// acabou — e sobrou 1 fechada. Uma garrafa dá 20: sumiram 4.
// Junto, duas faltas antigas da mesma vodka, pra a terceira fechar o padrão.
await pg.waitForTimeout(600);
{
  const p = await painel();
  const reg = p.controleDoses.registros;
  const velho = (dias, id) => ({ id, estoqueId: 'vdk', nome: 'Vodka Absolut 1L', unidade: 'un', data: HOJE, ts: reg[0].ts + dias, tipo: 'acabou', esperado: 1.1, contado: 1, diferenca: -0.1, doses: 2, doseQtd: 0.05, doseNome: 'Dose de vodka', custo: 8.8, venda: 44, saiu: 0.9, pct: 10, estado: 'pouco' });
  await gravar({ ...p, controleDoses: { ...p.controleDoses, registros: [velho(2, 'old2'), velho(1, 'old1'), ...reg] } });
}
await vender('vdk', 0.8);
r = await acabou('vdk', 1);
res = await resultado();
cobra('sumiram 4 doses', /sumiram 4 doses de dose de vodka/i.test(res), res.split('\n').slice(0, 4).join(' | ') || '(sem resultado)');
// 4 doses × R$ 22. O produto é a vodka pura, então dá pra falar em venda.
cobra('que valem R$ 88,00 que não entraram no caixa', /R\$ 88,00 que não entrou no caixa/i.test(res), res.split('\n').slice(0, 4).join(' | '));
// 0,2 de 1 garrafa que saiu = 20%.
cobra('e é 20% do que saiu — acima da mão pesada', /20% do que saiu — acima dos 10%/i.test(res), res.split('\n').slice(0, 4).join(' | '));
await pg.waitForTimeout(2400);
cobra('o estoque foi acertado pra 1', (await saldoDe('vdk')) === 1, String(await saldoDe('vdk')));
{
  const ult = (await registros())[0] || {};
  cobra('o registro guarda a diferença de ANTES do acerto', ult.estado === 'sumiu' && ult.diferenca === -0.2 && ult.custo === 17.6,
    JSON.stringify({ estado: ult.estado, diferenca: ult.diferenca, custo: ult.custo }));
}

console.log('\n### PÔR NA LISTA DE COMPRAS, COMO ANTES');
cobra('o resultado oferece pôr na lista', await tocar('Pôr na lista de compras'));
await pg.waitForTimeout(2600);
cobra('e a vodka foi pra lista de compras', ((await painel()).listaCompras || []).some((i) => /vodka absolut/i.test(i.nome || '')),
  JSON.stringify(((await painel()).listaCompras || []).map((i) => i.nome)));

console.log('\n### TRÊS FALTAS SEGUIDAS VIRAM AVISO');
txt = await texto();
cobra('a tela avisa "faltando toda vez"', /faltando toda vez/i.test(txt), (txt.match(/[^\n]*faltando toda vez[^\n]*/i) || ['(não avisa)'])[0]);
cobra('e diz qual: a vodka, nas últimas 3 contagens', /Vodka Absolut 1L: faltou nas últimas 3 contagens/i.test(txt),
  (txt.match(/[^\n]*faltou nas últimas[^\n]*/i) || ['(não diz)'])[0]);

console.log('\n### O BARRIL MORA EM LITROS E SAI EM COPOS');
r = await acabou('brr', 1);
cobra('tocou no barril', r.abriu);
// ÀS CEGAS: o estoque diz 60 litros, e isso não pode aparecer antes de contar.
cobra('o painel NÃO mostra os 60 que o sistema espera', !/60/.test(r.painelTxt), r.painelTxt.replace(/\s+/g, ' '));
// O tamanho ninguém digitou: veio do nome.
cobra('e descobriu sozinho que o barril é de 30 L', /cada embalagem: 30 L/i.test(r.painelTxt), r.painelTxt.replace(/\s+/g, ' '));
res = await resultado();
cobra('a primeira do barril também é ponto de partida', /primeira contagem/i.test(res) && /dizia 60 L e tu contou 30/i.test(res), res.split('\n').slice(0, 4).join(' | '));
// Saíram 57 copos pela comanda (28,5 L). O barril acabou: dava 60. Faltam 3.
await vender('brr', 28.5);
r = await acabou('brr', 0);
res = await resultado();
cobra('sumiram 3 copos de chopp', /sumiram 3 doses de chopp 500ml/i.test(res), res.split('\n').slice(0, 4).join(' | ') || '(sem resultado)');
cobra('R$ 44,97 que não entraram', /R\$ 44,97 que não entrou no caixa/i.test(res), res.split('\n').slice(0, 4).join(' | '));
// 1,5 L de 30 = 5%. Espuma e mão pesada: amarelo, não vermelho.
cobra('5% do que saiu: dentro do que mão pesada explica', /5% do que saiu: dentro do que mão pesada explica/i.test(res), res.split('\n').slice(0, 4).join(' | '));
await pg.waitForTimeout(2400);
cobra('o barril zerou no estoque', (await saldoDe('brr')) === 0, String(await saldoDe('brr')));

console.log('\n### A CONFERÊNCIA DA SEMANA: SÓ O QUE É BEBIDA E GIRA');
cobra('abriu a conferência da semana', await tocar('Conferência da semana'));
await pg.waitForTimeout(900);
const naLista = await pg.evaluate(() => [...document.querySelectorAll('[data-item]')].map((x) => x.getAttribute('data-item')));
cobra('a lista tem o chopp, o gin, a vodka e a tônica', ['brr', 'gin', 'vdk', 'ton'].every((i) => naLista.includes(i)), naLista.join(','));
// A farinha gira mais que todo mundo e tem ficha. Não é garrafa.
cobra('e NÃO tem a farinha', !naLista.includes('far'), naLista.join(','));
// O que mais carrega dinheiro vem primeiro: 40 chopps × 0,5 L × 11,50.
cobra('o chopp, que mais gira, vem primeiro', naLista[0] === 'brr', naLista.join(','));

console.log('\n### A ABERTA SE CONTA EM DÉCIMOS, TOCANDO NA GARRAFA');
const contarSemana = (id, fechadas, nivel) => pg.evaluate((x) => {
  const linha = document.querySelector(`[data-item="${x.id}"]`);
  if (!linha) return false;
  const mais = linha.querySelector('button[aria-label="mais"]');
  for (let k = 0; k <= x.fechadas; k += 1) mais.click();
  if (x.nivel === 0) {
    const sem = [...linha.querySelectorAll('button')].find((e) => /não tem aberta/i.test(e.innerText || ''));
    sem.click();
  } else {
    linha.querySelector(`button[aria-label="${x.nivel} de 10"]`).click();
  }
  return true;
}, { id, fechadas, nivel });
// Gin: 1 fechada e a aberta pela metade = 1,5. Tônica: 5 latas, nada aberto.
cobra('contou o gin: 1 fechada, aberta em 5 de 10', await contarSemana('gin', 1, 5));
cobra('contou a tônica: 5 fechadas, nenhuma aberta', await contarSemana('ton', 5, 0));
await pg.waitForTimeout(500);
txt = await texto();
cobra('a tela repete o que ela marcou: 5 de 10', /5 de 10 na aberta/i.test(txt), (txt.match(/[^\n]*de 10 na aberta[^\n]*/i) || ['(não repete)'])[0]);
// As que ela não contou ficam de fora — sem inventar zero pra ninguém.
cobra('o botão diz que vai conferir só as 2 contadas', await tocar('Conferir 2 garrafas'));
await pg.waitForTimeout(3200);
cobra('o gin ficou com 1,5 no estoque', (await saldoDe('gin')) === 1.5, String(await saldoDe('gin')));
cobra('a tônica com 5', (await saldoDe('ton')) === 5, String(await saldoDe('ton')));
// Vodka e chopp não foram contados nesta rodada: não podem ter sido mexidos.
cobra('e quem não foi contado não mudou', (await saldoDe('vdk')) === 1 && (await saldoDe('brr')) === 0, `${await saldoDe('vdk')} / ${await saldoDe('brr')}`);

console.log('\n### NA SEMANA SEGUINTE: UMA BATE, A OUTRA SOBRA');
// Gin: 6 doses de 50 ml numa garrafa de 750 = 0,4. Sobra 1,1 — e é o que tem.
await vender('gin', 0.4);
// Tônica: saíram 3 pela comanda, deveria ter 2. Ela acha 4: compra não lançada.
await vender('ton', 3);
await tocar('Conferência da semana');
await pg.waitForTimeout(900);
await contarSemana('gin', 1, 1);
await contarSemana('ton', 4, 0);
await pg.waitForTimeout(400);
await tocar('Conferir 2 garrafas');
await pg.waitForTimeout(3200);
res = await resultado();
const linhaDe = (nome) => { const ls = res.split('\n'); const i = ls.findIndex((l) => l.includes(nome)); return i < 0 ? '' : `${ls[i]} ${ls[i + 1] || ''}`; };
cobra('o gin bateu', /bateu/i.test(linhaDe('Gin Tanqueray')), linhaDe('Gin Tanqueray') || '(sem linha)');
cobra('a tônica tem 2 A MAIS — e a tela diz o motivo provável', /tem 2 doses de gin tônica a mais/i.test(linhaDe('Água tônica lata')) && /compra que não foi lançada/i.test(linhaDe('Água tônica lata')),
  linhaDe('Água tônica lata') || '(sem linha)');

console.log('\n### O PLACAR DO MÊS');
txt = await texto();
// Só o que FALTOU: vodka 17,60 + as duas antigas 8,80 + 8,80 + chopp 17,25.
// Partida, o que bateu e o que sobrou não entram.
const iPlacar = txt.toLowerCase().indexOf('sumiu neste mês');
const placar = iPlacar < 0 ? '' : txt.slice(iPlacar, iPlacar + 160);
cobra('soma R$ 52,45 de custo sumido', /R\$ 52,45/.test(placar), placar.split('\n').slice(0, 3).join(' | ') || '(sem placar)');
cobra('e não conta a partida nem a sobra como falta', /em 4 de 6 contagens/i.test(placar), placar.split('\n').slice(0, 3).join(' | '));

console.log('\n### "NÃO VIGIAR" TIRA DA LISTA');
await tocar('Conferência da semana');
await pg.waitForTimeout(700);
await pg.evaluate(() => { const l = document.querySelector('[data-item="ton"]'); const x = l && [...l.querySelectorAll('button')].find((e) => /não vigiar/i.test(e.innerText || '')); if (x) x.click(); });
await pg.waitForTimeout(900);
const depois = await pg.evaluate(() => [...document.querySelectorAll('[data-item]')].map((x) => x.getAttribute('data-item')));
cobra('a tônica saiu da lista da semana', !depois.includes('ton') && depois.includes('gin'), depois.join(','));

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
