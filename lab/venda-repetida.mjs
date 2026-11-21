// "ELA FEZ UMA E AÍ FEZ OUTRA PORQUE ACHOU QUE NÃO TINHA IDO."
//
// A mesma conta fechada duas vezes vira duas vendas: o caixa espera um
// dinheiro que não entrou e a garrafa baixa uma dose que não saiu. Agora,
// se a MESMA mesa (ou o balcão) acabou de fechar uma conta com os mesmos
// itens e o mesmo total, o app pergunta antes de fechar de novo.
//
// O que este teste guarda:
//   - o servidor recusa a repetida e diz qual foi a primeira (hora e itens);
//   - na tela: a pergunta aparece; "Cancelar" não fecha e explica; "OK"
//     (outra conta igual de verdade) fecha;
//   - outra mesa com os mesmos itens: fecha sem perguntar;
//   - balcão: pergunta só se for logo em seguida.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const linha = async (k) => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}${k}`)).json())[0]?.valor;
const grava = (k, v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}${k}`, valor: v }]) });
const vendas = async () => (await (await fetch(`${BANCO}?select=valor&chave=like.${MARCA}venda:*`)).json()).map((x) => x.valor);
const limpa = (s) => String(s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const HOJE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

const p0 = (await linha('painel')) || {};
await grava('painel', { ...p0, negocio: { nome: 'Pico do Mané', dona: 'Karen', papeis: { dona: 'Karen', garcom: 'Atendimento' } }, mesasQtd: 10,
  cardapio: [{ id: 'rl', nome: 'RedLabel - Dose', categoria: 'Doses', preco: '18', ativo: true }], fichas: [], estoque: [] });
const item = () => [{ id: 'i1', cardapioId: 'rl', nome: 'RedLabel - Dose', preco: 18, qtd: 1 }];
// A PRIMEIRA, fechada há 5 minutos na mesa 2: 1 RedLabel + 10% = 19,80.
const ha5 = new Date(Date.now() - 5 * 60000).toISOString();
await grava('venda:v0', { id: 'v0', data: HOJE, mesa: '2', total: 19.8, subtotal: 18, servico: 1.8, itens: item(), pagamentos: [{ forma: 'Dinheiro', valor: 19.8 }], pagamento: 'Dinheiro', fechadaEm: ha5, pago: true, fiado: 0 });
// A REPETIDA: a mesa 2 aberta de novo com a mesma dose. E a mesa 7, outra
// conta igual de verdade.
for (const [id, mesa] of [['m2', '2'], ['m7', '7']]) await grava(`comanda:${id}`, { id, mesa, status: 'aberta', pessoas: 1, abertaEm: new Date().toISOString(), itens: item() });

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await (await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' })).newPage();
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
await pg.goto(BASE); await pg.waitForTimeout(1800);
await pg.locator('select[data-quem]').selectOption('dona');
await pg.locator('input[type="password"]').fill('Teste@123');
await pg.locator('button:has-text("Entrar")').click(); await pg.waitForTimeout(4000);
const pedir = (url, corpo) => pg.evaluate(async (x) => { const r = await fetch(x.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(x.corpo) }); let j = null; try { j = await r.json(); } catch { /* */ } return { status: r.status, j }; }, { url, corpo });
await pedir('/api/caixa', { acao: 'abrir', saldoInicial: '100' });

console.log('\n### O SERVIDOR RECONHECE A REPETIDA');
const r1 = await pedir('/api/comandas', { acao: 'fechar', comandaId: 'm2', pessoas: 1, pagamentos: [{ forma: 'Dinheiro', valor: 19.8 }] });
cobra('a mesa 2 fechando a mesma conta de 5 minutos atrás: recusa e pergunta', r1.status === 409 && !!r1.j?.repetida, JSON.stringify(r1.j).slice(0, 140));
cobra('e diz qual foi a primeira: a hora, 1 RedLabel, R$ 19,80', /parece igual à que foi fechada às \d\d:\d\d \(mesa 2\): 1 RedLabel - Dose, R\$ 19,80/.test(r1.j?.erro || ''), r1.j?.erro);
cobra('não criou venda nenhuma', (await vendas()).length === 1);
const r7 = await pedir('/api/comandas', { acao: 'fechar', comandaId: 'm7', pessoas: 1, pagamentos: [{ forma: 'Dinheiro', valor: 19.8 }] });
cobra('a mesa 7 com os mesmos itens: fecha sem perguntar (é outra mesa)', r7.status === 200 && r7.j?.ok);

console.log('\n### NA TELA: A PERGUNTA');
const dialogos = [];
let resposta = false;
pg.on('dialog', async (d) => { dialogos.push(d.message()); if (resposta) await d.accept(); else await d.dismiss(); });
const tocar = (re) => pg.evaluate((fonte) => { const x = [...document.querySelectorAll('button')].find((e) => new RegExp(fonte, 'i').test((e.innerText || '').replace(/\u00a0/g, ' ').trim())); if (x) { x.click(); return true; } return false; }, re.source);
await tocar(/^Central de Operações$/); await pg.waitForTimeout(1500);
await tocar(/^Comandas$/); await pg.waitForTimeout(2000);
const fecharPelaTela = async () => {
  await pg.evaluate(() => { const t = [...document.querySelectorAll('button')].find((e) => /^\s*(OCUPADA)?\s*2\b/i.test(e.innerText || '') && /ocupad|R\$/i.test(e.innerText || '')); if (t) t.click(); });
  await pg.waitForTimeout(1200);
  await tocar(/^Fechar conta/); await pg.waitForTimeout(800);
  await pg.evaluate(() => {
    const lin = [...document.querySelectorAll('span,div')].find((d) => (d.textContent || '').trim() === 'Dinheiro' && d.children.length === 0);
    const inp = lin && lin.parentElement && lin.parentElement.querySelector('input');
    if (!inp) return;
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(inp, '19,80'); inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await pg.waitForTimeout(400);
  await tocar(/^Confirmar$/); await pg.waitForTimeout(2500);
};
await fecharPelaTela();
cobra('apareceu a pergunta: "parece igual … Essa já foi!"', dialogos.some((m) => /parece igual à que foi fechada/.test(m) && /Essa já foi/.test(m)), dialogos.join(' | ').slice(0, 200));
const txt = limpa(await pg.locator('body').innerText());
cobra('tocou "Cancelar": não fechou, e a tela explica', /Não fechei de novo: a conta das \d\d:\d\d já tinha ido/.test(txt), (txt.match(/Não fechei[^.]*\./) || ['(sem aviso)'])[0]);
cobra('a mesa 2 continua aberta, sem venda nova', !!(await linha('comanda:m2')) && (await vendas()).filter((v) => v.mesa === '2').length === 1);
resposta = true;
await pg.reload(); await pg.waitForTimeout(3500);
await tocar(/^Central de Operações$/); await pg.waitForTimeout(1500);
await tocar(/^Comandas$/); await pg.waitForTimeout(2000);
await fecharPelaTela();
cobra('tocou "OK" (era outra conta igual de verdade): fechou', !(await linha('comanda:m2')) && (await vendas()).filter((v) => v.mesa === '2').length === 2);

console.log('\n### NO BALCÃO, SÓ SE FOR LOGO EM SEGUIDA');
const bal = (extra = {}) => pedir('/api/comandas', { acao: 'balcao', itens: [{ cardapioId: 'rl', qtd: 1 }], pagamentos: [{ forma: 'Pix', valor: 18 }], pessoas: 1, ...extra });
cobra('a primeira dose no balcão: fecha', (await bal()).status === 200);
const b2 = await bal();
cobra('a mesma dose no balcão logo em seguida: pergunta', b2.status === 409 && /balcão/.test(b2.j?.erro || ''), b2.j?.erro);
cobra('confirmando que é outra pessoa: fecha', (await bal({ confirmarRepetida: true })).status === 200);

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
