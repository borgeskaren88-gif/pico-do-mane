// "SE ACHA QUE NA PARTE DE RELATÓRIO A GENTE CONSEGUE DEIXAR ELE MAIS
// FUNCIONAL, OBJETIVO E CLARO? PROFISSIONAL MESMO."
//
// A página tinha 15 blocos abertos e QUATRO números disputando o nome
// "sobrou": "Sobrou no papel", "DISPONÍVEL DE VERDADE", "(=) Lucro
// operacional" e "Resultado do mês (o que sobrou)" — em cards diferentes,
// longe um do outro. Agora são degraus de uma escada só.
//
// E no meio do caminho apareceu um defeito de DINHEIRO, que é o que este
// teste existe principalmente pra travar:
//
//   DISTRIBUIÇÃO DE LUCROS SUMIA DA CONTA. Ela lançava "tirei minha parte,
//   R$ 1.500", o sistema tirava do lucro da operação (certo) e NUNCA
//   descontava de volta no "o que de fato sobrou no caixa". O número saía
//   MAIOR do que a realidade — e o card ao lado, somando entrou − saiu,
//   mostrava o valor certo. A mesma página se contradizia, e o errado era
//   justamente o que se anunciava definitivo.
//
// Número que mente pra mais é o pior tipo: ela gasta em cima dele.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });

// O mês que a tela abre sozinha é o de hoje, no fuso de São Paulo — o mesmo
// todayISO() do app. Datar no fuso do contêiner trocaria de mês na virada.
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dia = (n) => `${hoje.slice(0, 7)}-${String(n).padStart(2, '0')}`;
const mesAnterior = (() => { const d = new Date(`${hoje.slice(0, 7)}-01T12:00:00`); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();

// UM MÊS COM TODAS AS PONTAS, de propósito — é o mês em que o defeito aparece.
const RECEITAS = [
  { id: 'r1', data: dia(3), valor: '10000', categoria: 'Caixa', desc: 'vendas' },
  { id: 'r2', data: dia(4), valor: '2000', categoria: 'Empréstimo/Aporte', desc: 'aporte' },
  { id: 'r3', data: `${mesAnterior}-10`, valor: '8000', categoria: 'Caixa', desc: 'vendas' },
  // Aporte no mês passado também: é o que prova que o gráfico e a comparação
  // não misturam empréstimo com venda.
  { id: 'r4', data: `${mesAnterior}-11`, valor: '5000', categoria: 'Empréstimo/Aporte', desc: 'aporte' },
];
const DESPESAS = [
  { id: 'd1', data: dia(5), valor: '3000', categoria: 'Fornecedores de insumo', desc: 'bebida' },
  { id: 'd2', data: dia(6), valor: '2000', categoria: 'Aluguel', desc: 'aluguel' },
  { id: 'd3', data: dia(7), valor: '1000', categoria: 'Investimento', desc: 'freezer' },
  { id: 'd4', data: dia(8), valor: '1500', categoria: 'Distribuição de lucros', desc: 'minha parte' },
  { id: 'd5', data: `${mesAnterior}-12`, valor: '4000', categoria: 'Aluguel', desc: 'aluguel' },
];
// A CONTA CERTA, feita na mão:
//   receita da operação .............. 10.000
//   (−) custo variável ................ 3.000
//   (−) despesa operacional ........... 2.000
//   (=) lucro da operação ............. 5.000
//   (+) aporte ........................ 2.000
//   (−) investimento .................. 1.000
//   (−) distribuição de lucros ........ 1.500
//   (=) sobrou no caixa ............... 4.500   ← era 6.000 antes do conserto
// e pelo outro caminho: entrou 12.000 − saiu 7.500 = 4.500. Tem que bater.
const LUCRO = 5000, SOBROU = 4500, SOBROU_ERRADO = 6000;

// Um CMV mínimo, pra o card ter o que calcular: um chopp com ficha.
// 10 unidades × 0,3 L × R$ 10/L = R$ 30 de ingrediente em R$ 120 vendidos = 25%.
const ESTOQUE = [{ id: 'e1', nome: 'Chopp barril', custo: '10', unidade: 'L', saldo: '50', categoria: 'Bebidas' }];
const CARDAPIO = [{ id: 'c1', nome: 'Chopp 300ml', categoria: 'Chopp / Cerveja', preco: '12,00', ativo: true }];
const FICHAS = [{ cardapioId: 'c1', itens: [{ estoqueId: 'e1', qtd: '0,3', unidade: 'L' }] }];
const VENDA = { id: 'v1', data: dia(3), total: 120, itens: [{ cardapioId: 'c1', nome: 'Chopp 300ml', qtd: 10, preco: '12,00' }] };

const p0 = await painel();
await gravar({ ...p0, receitas: RECEITAS, despesas: DESPESAS, compras: [], diario: [], estoque: ESTOQUE, cardapio: CARDAPIO, fichas: FICHAS });
await fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}venda:v1`, valor: VENDA }]) });

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

const texto = async () => (await pg.locator('body').innerText()).replace(/ /g, ' ');
const irPara = async (rot) => {
  const achou = await pg.evaluate((r) => {
    const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === r);
    if (x) { x.click(); return true; }
    return false;
  }, rot);
  await pg.waitForTimeout(1800);
  cobra(`achou o caminho "${rot}"`, achou);
};
const reais = (s) => { const m = (s || '').match(/([\d.]+,\d{2})/); return m ? parseFloat(m[1].replace(/\./g, '').replace(',', '.')) : null; };

// Lê o valor em reais de uma linha da escada, pelo rótulo.
//
// CADA DEGRAU SÃO DUAS COLUNAS, e innerText devolve cada uma na SUA linha:
//   "(=) Sobrou no caixa do mês"
//   "R$ 4.500,00"
// A primeira versão deste leitor procurava o valor na mesma linha do rótulo,
// não achava nada, e reprovava um app que estava mostrando o número certo.
// Agora olha o rótulo e a linha seguinte.
const linha = async (rotulo) => {
  const t = await texto();
  const linhas = t.split('\n');
  const i = linhas.findIndex((l) => l.trim().startsWith(rotulo));
  if (i < 0) return { linha: '(rótulo não achado)', valor: null };
  const crua = `${linhas[i]} ⇢ ${linhas[i + 1] || ''}`;
  const v = reais(linhas[i]) ?? reais(linhas[i + 1]);
  if (v == null) return { linha: crua, valor: null };
  // O sinal vem como "− R$ 1.500,00" na própria coluna do valor.
  const negativo = /−/.test(linhas[i + 1] || '') || /−\s*R\$/.test(linhas[i]);
  return { linha: crua, valor: negativo ? -v : v };
};

await irPara('Finanças');
await irPara('Relatórios');

console.log('\n### a página começa pelo RESULTADO, não por dado solto');
// Antes abria no seletor de mês e caía num card de compra de emergência; o
// resultado do mês era o sétimo bloco.
let txt = await texto();
// MEDE O RELATÓRIO, NÃO O MENU.
//
// A primeira versão pegava os 700 primeiros caracteres do body — que são o
// menu lateral inteiro, igual em toda tela do app. O teste "passava" medindo
// uma coisa que não tem nada a ver com relatório. Começa onde a página começa.
const i0 = txt.indexOf('Resultado do mês');
cobra('a página de relatório abriu', i0 >= 0);
const topo = txt.slice(i0, i0 + 700);
cobra('o lucro do mês está logo no topo', topo.includes('5.000,00'), topo.replace(/\n/g, ' | ').slice(0, 200));
cobra('dizendo o que o número é', /lucro da opera/i.test(topo));
cobra('e com o veredito em uma frase', /sobrou|comprometid|negativ/i.test(topo));

console.log('\n### A LINHA QUE FALTAVA: distribuição de lucros aparece na conta');
cobra('a escada mostra a distribuição', /Distribui[çc][ãa]o de lucros/i.test(txt), (txt.match(/[^\n]*Distribui[^\n]*/) || ['(não aparece)'])[0]);

console.log('\n### e o "sobrou no caixa" parou de mentir pra MAIS');
// Este é o teste que importa. Antes do conserto dava 6.000 — a tirada de
// R$ 1.500 não mexia no número.
const sobrou = await linha('(=) Sobrou no caixa do mês');
cobra(`sobrou = ${SOBROU} (e não ${SOBROU_ERRADO})`, sobrou.valor === SOBROU, `tela: ${sobrou.linha || '(linha não achada)'}`);
cobra('não é o valor velho, inflado', sobrou.valor !== SOBROU_ERRADO);

console.log('\n### os dois caminhos da conta chegam no mesmo lugar');
// De cima: lucro ± o que não é operação. De baixo: entrou − saiu.
// São contas independentes no código; se discordarem, uma está errada.
const lucroLinha = await linha('(=) Lucro da operação');
cobra('lucro da operação confere', lucroLinha.valor === LUCRO, lucroLinha.linha);
const entrou = (txt.match(/ENTROU\n([^\n]+)/) || [])[1] || '';
const saiu = (txt.match(/SAIU\n([^\n]+)/) || [])[1] || '';
cobra('entrou − saiu dá o mesmo "sobrou"', reais(entrou) - reais(saiu) === SOBROU, `${entrou} − ${saiu}`);

console.log('\n### a escada fecha sozinha até o último degrau');
const aPagar = await linha('(–) Contas em aberto');
const aReceber = await linha('(+) Fiado a receber');
const disp = reais((txt.match(/DISPON[ÍI]VEL DE VERDADE\n([^\n]+)/) || [])[1]);
const esperado = Math.round((SOBROU + (aPagar.valor || 0) + (aReceber.valor || 0)) * 100) / 100;
cobra('sobrou − o que deve + o que tem a receber = disponível', disp === esperado, `${disp} vs ${esperado}`);

console.log('\n### acabaram os quatro números com o mesmo nome');
cobra('não existe mais "Sobrou no papel"', !/Sobrou no papel/i.test(txt));
cobra('nem "Resultado do mês (o que sobrou)"', !/Resultado do mês \(o que sobrou\)/i.test(txt));

console.log('\n### a página abre CURTA — o miúdo fica dobrado');
cobra('o detalhe do CMV começa fechado', /Ver detalhe/i.test(txt));
cobra('o histórico começa fechado', /Como vinha sendo/.test(txt) && !/Evolução \(receita/.test(txt));
// E abre quando ela quer.
await pg.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => /Como vinha sendo/.test(e.innerText || '')); if (x) x.click(); });
await pg.waitForTimeout(1200);
txt = await texto();
cobra('e abre no toque', /Evolução \(receita/.test(txt));

console.log('\n### a comparação com o mês passado não conta empréstimo como venda');
// O quadro "Contra <mês>" mostra o número DESTE mês e a variação contra o
// passado — eu li errado na primeira versão e cobrei do app que mostrasse
// 8.000 ali, que é o número do mês passado e não tem o que fazer nessa linha.
//
// Quem denuncia a mistura é a VARIAÇÃO: o mês passado teve 8.000 de venda e
// 5.000 de aporte. Contra 8.000, os 10.000 de agora são ▲25%. Se o aporte
// entrasse como receita (13.000), a mesma linha mostraria queda.
// O rótulo vem em CAIXA ALTA porque o CSS manda, e innerText obedece ao CSS.
const blocoContra = (txt.match(/Contra [^\n]*\n([\s\S]{0,260})/i) || [])[1] || '';
const linhaReceita = (blocoContra.match(/Receita\n([^\n]+)\n([^\n]+)/) || []);
cobra('a receita do mês é a da operação (10.000)', reais(linhaReceita[1]) === 10000, linhaReceita[1] || '(não achou)');
cobra('e cresceu 25% — ou seja, comparou contra 8.000', /▲\s*25%/.test(linhaReceita[2] || ''), linhaReceita[2] || '(não achou)');

console.log('\n### e o GRÁFICO conta a mesma história que a escada');
// AQUI MORAVA O DEFEITO. O gráfico somava empréstimo, aporte e investimento;
// todo o resto da página tirava. No mês do aporte, a barra dizia 12.000 e o
// DRE logo abaixo dizia 10.000 — pro mesmo mês, na mesma tela.
//
// O número do gráfico não é texto na página: só aparece quando o dedo passa
// por cima. Então o teste faz o que ela faria — passa o mouse na barra e lê a
// tarja. Testar o pixel da barra seria frágil; testar o que ela LÊ, não.
// ACHA O GRÁFICO CERTO PELO TÍTULO, não pela posição.
//
// A primeira versão pegou "a penúltima barra da página" e caiu no gráfico de
// dia da semana, que tem 14 barras e estava fora da tela. Barra é barra; o
// que diz de qual gráfico ela é, é o título em cima dela.
// O número do gráfico não é texto: é ALTURA DE BARRA. Então é a altura que o
// teste mede.
//
// Tentei antes passar o mouse e ler a tarja — não abre de jeito confiável num
// navegador sem gente de verdade, e um teste que às vezes passa não protege
// nada. A barra, não: ela está desenhada ali, com altura proporcional ao valor.
//
// Set vendeu 8.000 e recebeu 5.000 de aporte; Out vendeu 10.000 e recebeu
// 2.000. Só a operação: Out/Set = 10/8 = 1,25 (a barra de agora é MAIOR).
// Somando o aporte: 12/13 = 0,92 (a barra de agora seria MENOR). Os dois
// mundos ficam em lados opostos de 1 — não tem como confundir.
const alturas = await pg.evaluate(() => {
  const titulo = [...document.querySelectorAll('div')].find((d) => (d.textContent || '').trim() === 'Evolução (receita × despesa)');
  const wrap = titulo && titulo.parentElement && titulo.parentElement.querySelector('.recharts-wrapper');
  if (!wrap) return null;
  // Recharts desenha uma série de cada vez: primeiro todas as receitas, depois
  // todas as despesas. Aqui são 2 meses, então [Set, Out] de receita.
  const rects = [...wrap.querySelectorAll('.recharts-bar-rectangle path, .recharts-bar-rectangle rect')];
  return rects.slice(0, 2).map((r) => {
    const b = r.getBoundingClientRect();
    return Math.round(b.height);
  });
});
cobra('achou as barras de receita do gráfico', Array.isArray(alturas) && alturas.length === 2 && alturas.every((h) => h > 0), JSON.stringify(alturas));
if (Array.isArray(alturas) && alturas.length === 2 && alturas[0] > 0) {
  const razao = alturas[1] / alturas[0];
  cobra('a barra de agora é MAIOR que a do mês passado (10 contra 8)', razao > 1.15 && razao < 1.35, `Set=${alturas[0]}px Out=${alturas[1]}px · razão ${razao.toFixed(2)} (com o defeito daria ~0,92)`);
}

console.log('\n### um só gráfico de evolução, não dois desenhos da mesma coisa');
cobra('"Lucro por mês" não duplica mais o de barras', !/Lucro por mês/.test(txt));

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
