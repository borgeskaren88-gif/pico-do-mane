// "O DARCI CONSEGUE ME ENTREGAR UM RELATÓRIO DE COMO FOI A SEMANA, MAS PRECISO
// QUE ELE SEJA INTELIGENTE COMO UM CEO ANALISANDO ESSE RELATÓRIO."
//
// O QUE ESTE TESTE GUARDA:
//   - OS NÚMEROS SÃO DO APP, NÃO DA IA: faturamento da semana, comparação com
//     a anterior e com a média, perdas, falta no caixa, despesas e meta chegam
//     na IA já contados — e certos.
//   - A IA RECEBE O JEITO DE CEO: prioridade por dinheiro, decisão com dono e
//     ganho, nada de número inventado, as seções na ordem.
//   - ABRIR O DARCI NÃO GASTA IA: o relatório só é pedido quando ela toca.
//   - A SEMANA FECHADA FICA GUARDADA: abrir de novo não chama a IA de novo;
//     "Gerar de novo" chama.
//   - IA FORA DO AR: o relatório sai assim mesmo (resumo automático), com aviso.
//   - SÓ A DONA vê.
//   - O DARCI DE OUTRO BAR NÃO SE ACHA O PICO: as instruções levam o nome do bar.
//
// LAB_ENV: ANTHROPIC_API_KEY=chave-de-mentira-do-lab
// LAB_ENV: ANTHROPIC_BASE_URL=http://127.0.0.1:54500
import http from 'http';
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const linha = async (chave) => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}${chave}`)).json())[0]?.valor;
const gravar = (chave, v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}${chave}`, valor: v }]) });
const limpa = (s) => String(s || '').replace(/ /g, ' ');

// ---- as datas, do mesmo jeito que o app conta (dia vira às 6h, semana seg-dom) ----
const agoraSP = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
if (agoraSP.getHours() < 6) agoraSP.setDate(agoraSP.getDate() - 1);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const somaDias = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const HOJE = iso(agoraSP);
const desdeSeg = (new Date(HOJE + 'T12:00:00').getDay() + 6) % 7;
const INI = somaDias(HOJE, -desdeSeg - 7);
const FIM = somaDias(INI, 6);
const dia = (k) => somaDias(INI, k); // k=0 segunda ... 6 domingo

// ---- a semana de mentira ----
// Semana analisada: R$ 1.000 por dia, sábado R$ 2.000, e R$ 50 de fiado na
// terça = R$ 8.050. A anterior: R$ 800 por dia = R$ 5.600 (+44%). As três
// antes dela: R$ 900 por dia = R$ 6.300 cada; média das 4 = R$ 6.125 (+31%).
const receitas = [];
for (let k = 0; k < 7; k += 1) receitas.push({ id: `r${k}`, data: dia(k), categoria: 'Caixa', descricao: 'Caixa', valor: String(k === 5 ? 2000 : 1000) });
for (let k = 0; k < 7; k += 1) receitas.push({ id: `a${k}`, data: somaDias(INI, k - 7), categoria: 'Caixa', descricao: 'Caixa', valor: '800' });
for (let w = 2; w <= 4; w += 1) for (let k = 0; k < 7; k += 1) receitas.push({ id: `b${w}${k}`, data: somaDias(INI, k - 7 * w), categoria: 'Caixa', descricao: 'Caixa', valor: '900' });
receitas.push({ id: 'fr', data: dia(3), categoria: 'Recebimento Atrasado', descricao: 'Fiado', valor: '70' });

const p0 = (await linha('painel')) || {};
await gravar('painel', {
  ...p0,
  negocio: { nome: 'Pico do Mané', cidade: 'Florianópolis', dona: 'Karen', papeis: {} },
  receitas,
  despesas: [{ id: 'd1', data: dia(2), categoria: 'Gelo', descricao: 'Gelo do fim de semana', valor: '120' }],
  compras: [],
  metas: { [FIM.slice(0, 7)]: '40000' },
  cardapio: [{ id: 'hk', nome: 'Heineken', categoria: 'Bebidas', preco: '14', ativo: true }, { id: 'cp', nome: 'Caipirinha', categoria: 'Bebidas', preco: '25', ativo: true }],
  fichas: [{ cardapioId: 'hk', itens: [{ estoqueId: 'hei', qtd: '1', unidade: 'un' }] }],
  estoque: [{ id: 'hei', nome: 'Heineken long neck', custo: '7,50', unidade: 'un', saldo: '40', minimo: '10', categoria: 'Bebidas',
    movimentos: [{ id: 'mq', tipo: 'saida', qtd: 2, data: dia(4), ts: Date.parse(dia(4) + 'T23:00:00'), motivo: 'Quebrou' }] }],
  diario: [], tarefas: [],
});
for (const [id, k, itens, fiado] of [
  ['v1', 1, [{ nome: 'Heineken', cardapioId: 'hk', qtd: 10, preco: 14 }], 50],
  ['v2', 5, [{ nome: 'Heineken', cardapioId: 'hk', qtd: 20, preco: 14 }, { nome: 'Caipirinha', cardapioId: 'cp', qtd: 6, preco: 25 }], 0],
  ['v0', -3, [{ nome: 'Heineken', cardapioId: 'hk', qtd: 12, preco: 14 }], 0],
]) {
  const sub = itens.reduce((s, it) => s + it.qtd * it.preco, 0);
  await gravar(`venda:${id}`, { id, data: dia(k), mesa: '3', pessoas: 4, total: sub * 1.1, servico: sub * 0.1, subtotal: sub, fiado, pagamento: fiado ? 'Fiado' : 'Pix', pagamentos: [{ forma: fiado ? 'Fiado' : 'Pix', valor: sub * 1.1 }], fechadaEm: `${dia(k)}T23:00:00.000Z`, itens });
}
await gravar('caixa:cx1', { id: 'cx1', aberto: false, abertoEm: `${dia(5)}T21:00:00.000Z`, fechadoEm: `${dia(6)}T04:00:00.000Z`, contado: 470, dinheiroFinal: 500, diferenca: -30 });
await gravar('ponto:p1', { id: 'p1', nome: 'Sarah', papel: 'gerente', entrada: `${dia(4)}T19:00:00.000Z`, saida: `${dia(5)}T03:00:00.000Z` });

// ---- a IA de mentira ----
const ia = { chamadas: [], falhar: false };
const RESPOSTA = `## A semana em uma frase
A semana veio **44% acima** da anterior, puxada pelo sábado.
## Os números que importam
- Faturamento R$ 8.050,00
## O que foi bem
O sábado.
## O que me preocupa
Faltou R$ 30,00 na gaveta.
## Por que isso aconteceu
Pode ser troco errado.
## O que eu faria esta semana
1. Contar o caixa com duas pessoas no sábado.
2. Conferir a quebra de Heineken.
3. Repetir a promoção do sábado.
## De olho nos próximos 7 dias
Nada vencendo.
## A pergunta da semana
O que fez o sábado dobrar?`;
const srv = http.createServer((req, res) => {
  let corpo = '';
  req.on('data', (c) => { corpo += c; });
  req.on('end', () => {
    const j = corpo ? JSON.parse(corpo) : {};
    ia.chamadas.push({ url: req.url, corpo: j, chave: req.headers['x-api-key'] });
    res.setHeader('Content-Type', 'application/json');
    if (ia.falhar) { res.statusCode = 500; return res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'fora do ar' } })); }
    const ehRelatorio = /RELATÓRIO DA SEMANA/.test(String(j.system || ''));
    res.end(JSON.stringify({ id: 'msg_lab', type: 'message', role: 'assistant', model: j.model, stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'text', text: ehRelatorio ? RESPOSTA : 'Resposta curta.' }] }));
  });
});
await new Promise((ok) => srv.listen(54500, '127.0.0.1', ok));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pg = await ctx.newPage();
await pg.goto(BASE);
await pg.selectOption('select[data-quem]', 'dona');
await pg.fill('input[type=password]', 'Teste@123');
await pg.click('button[type=submit]');
await pg.waitForSelector('[data-nav="darci"], .pos-navitem', { timeout: 20000 });
await pg.evaluate(() => localStorage.setItem('picoos-tab', 'darci'));
await pg.goto(BASE);
await pg.waitForSelector('[data-relatorio-semana]', { timeout: 20000 });
await pg.waitForTimeout(1500);
const doRelatorio = () => ia.chamadas.filter((c) => /RELATÓRIO DA SEMANA/.test(String(c.corpo.system || '')));

console.log('\n— abrir o Darci não gasta IA —');
cobra('o relatório aparece fechado, com o botão "Ver relatório"', /Ver relatório/.test(await pg.locator('[data-relatorio-semana]').innerText()));
cobra('nenhuma chamada de relatório só por abrir a tela', doRelatorio().length === 0, String(doRelatorio().length));

console.log('\n— os números chegam contados e certos —');
await pg.click('text=Ver relatório');
await pg.waitForSelector('[data-relatorio-texto]', { timeout: 30000 });
const chamada = doRelatorio()[0];
const ficha = limpa(chamada && chamada.corpo.messages[0].content);
const sistema = String(chamada && chamada.corpo.system || '');
cobra('a semana certa: segunda a domingo', ficha.includes(`SEMANA ANALISADA: ${INI.slice(8, 10)}/${INI.slice(5, 7)} a ${FIM.slice(8, 10)}/${FIM.slice(5, 7)}`), ficha.split('\n')[1]);
cobra('faturamento R$ 8.050,00 (caixa + fiado), +44% vs anterior R$ 5.600,00', ficha.includes('Semana: R$ 8.050,00') && ficha.includes('R$ 5.600,00 (+44%)'));
cobra('média das 4 semanas anteriores R$ 6.125,00 (+31%)', ficha.includes('R$ 6.125,00 (+31%)'));
cobra('o sábado comparado com a média dos sábados', /Sábado [0-9/]+: R\$ 2\.000,00 \| R\$ 875,00 \| \+129%/.test(ficha), (ficha.match(/- Sábado.*$/m) || [''])[0]);
cobra('o produto que puxou: Heineken 30 un', /Heineken 30 un, R\$ 420,00/.test(ficha));
cobra('Heineken subiu vs semana anterior (12→30)', /Subiram.*Heineken 12→30/.test(ficha));
cobra('a quebra entra pelo custo: R$ 15,00', ficha.includes('Quebrou: 1 vez(es), R$ 15,00'));
cobra('a falta no caixa: R$ 30,00', ficha.includes('Faltou na gaveta: R$ 30,00'));
cobra('despesas da semana R$ 120,00 e fiado novo/recebido', ficha.includes('Despesas lançadas: R$ 120,00') && ficha.includes('Fiado novo na semana: R$ 50,00') && ficha.includes('Fiado recebido na semana: R$ 70,00'));
cobra('meta do mês com projeção marcada como ESTIMATIVA', /Meta de .*R\$ 40\.000,00.*ESTIMATIVA/.test(ficha));
cobra('as horas da equipe (Sarah 8 h)', /Sarah 8 h/.test(ficha));
cobra('o nome do bar vem do cadastro', ficha.includes('NEGÓCIO: Pico do Mané, Florianópolis.'));

console.log('\n— a IA recebe o jeito de CEO —');
cobra('prioriza por dinheiro e decide com o quê/por quê/quem/ganho', /Prioriza por DINHEIRO/.test(sistema) && /QUEM faz e o GANHO/.test(sistema));
cobra('proíbe número inventado e conselho genérico', /NUNCA invente número/.test(sistema) && /melhorar o atendimento/.test(sistema));
cobra('as seções na ordem, de "A semana em uma frase" até "A pergunta da semana"', sistema.indexOf('## A semana em uma frase') < sistema.indexOf('## O que eu faria esta semana') && sistema.indexOf('## O que eu faria esta semana') < sistema.indexOf('## A pergunta da semana'));
cobra('fala com a dona pelo nome dela', sistema.includes('sócio de Karen'));
cobra('a chave vai do servidor (nunca do navegador)', chamada && chamada.chave === 'chave-de-mentira-do-lab');

console.log('\n— a tela —');
const tela = limpa(await pg.locator('[data-relatorio-semana]').innerText());
cobra('em cima, o faturamento e a comparação', tela.includes('R$ 8.050,00') && tela.includes('+44% vs semana anterior'));
cobra('as seções viram títulos, as decisões viram números', /O que eu faria esta semana/.test(tela) && !tela.includes('## ') && !tela.includes('**'));
// Foto pra mostrar (só quando pedida): LAB_FOTO=caminho.png
if (process.env.LAB_FOTO) { await pg.setViewportSize({ width: 430, height: 900 }); await pg.waitForTimeout(400); await pg.locator('[data-relatorio-semana]').screenshot({ path: process.env.LAB_FOTO }); await pg.setViewportSize({ width: 1280, height: 900 }); }
cobra('o gráfico dos 7 dias', await pg.locator('[data-relatorio-dias] > div').count() >= 7);

console.log('\n— guardado: não paga duas vezes —');
const antes = doRelatorio().length;
const r2 = await pg.evaluate(async () => (await fetch('/api/darci/relatorio?semana=passada')).json());
cobra('abrir de novo vem do guardado, sem chamar a IA', r2.guardado === true && doRelatorio().length === antes);
await pg.click('text=Gerar de novo');
await pg.waitForSelector('[data-relatorio-texto]', { timeout: 30000 });
await pg.waitForTimeout(500);
cobra('"Gerar de novo" chama a IA outra vez', doRelatorio().length === antes + 1);

console.log('\n— IA fora do ar —');
ia.falhar = true;
const r3 = await pg.evaluate(async () => (await fetch('/api/darci/relatorio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ semana: 'passada' }) })).json());
cobra('o relatório sai assim mesmo, com os números (resumo automático)', r3.ok && !r3.motor && limpa(r3.texto).includes('R$ 8.050,00') && /resumo automático/.test(r3.texto) && !!r3.erroIA);
ia.falhar = false;
const r4 = await pg.evaluate(async () => (await fetch('/api/darci/relatorio?semana=passada')).json());
cobra('IA voltou: abrir de novo refaz com a análise (não fica preso no automático)', r4.ok && r4.motor === 'claude' && !r4.guardado);

console.log('\n— só a dona —');
const garcom = await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ papel: 'garcom', senha: '1234', lembrar: true }) });
const cg = (garcom.headers.getSetCookie ? garcom.headers.getSetCookie() : [garcom.headers.get('set-cookie')]).map((c) => c.split(';')[0]).join('; ');
cobra('o garçom não vê o relatório', (await fetch(`${BASE}/api/darci/relatorio?semana=passada`, { headers: { cookie: cg } })).status === 401);

console.log('\n— o Darci de outro bar não se acha o Pico —');
const p1 = await linha('painel');
await gravar('painel', { ...p1, negocio: { nome: 'Boteco da Ana', cidade: 'Palhoça', dona: 'Ana', papeis: {} } });
const n0 = ia.chamadas.length;
await pg.evaluate(async () => (await fetch('/api/darci/perguntar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pergunta: 'como foi ontem?' }) })).json());
const sisP = String((ia.chamadas[n0] || {}).corpo?.system || '');
cobra('as instruções e a ficha levam o nome do bar e da dona', sisP.includes('sócio de Ana') && sisP.includes('Boteco da Ana') && !sisP.includes('Karen') && !sisP.includes('Pico do Mané') && !sisP.includes('Mariele'), sisP.slice(0, 120));
await gravar('painel', p1);
const n1 = ia.chamadas.length;
await pg.evaluate(async () => (await fetch('/api/darci/perguntar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pergunta: 'como foi ontem?' }) })).json());
const sisPico = String((ia.chamadas[n1] || {}).corpo?.system || '');
cobra('e o Pico continua recebendo o texto de sempre (Karen, Mari)', sisPico.includes('sócio da Karen') && sisPico.includes('Mariele'));

await browser.close();
srv.close();
console.log(ruim ? `\n${ruim} RUIM` : '\nTUDO OK');
process.exit(ruim ? 1 : 0);
