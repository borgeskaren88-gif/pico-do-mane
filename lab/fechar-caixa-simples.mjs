// "MELHORAR O FECHAR O CAIXA, FAZER ALGO QUE SEJA MAIS SIMPLES. TODA VEZ QUE
// FECHO O CAIXA ESTOU IGNORANDO ESSA CONFERÊNCIA."
//
// Ela ignorava porque a conferência trazia até DOZE itens — tudo que tinha
// mexido no dia, inclusive camarão em quilo — numa caixa de rolar, à uma da
// manhã. Conferência que ninguém faz vale zero.
//
// O QUE ESTE TESTE GUARDA:
//
//   - SÃO TRÊS, NÃO DOZE. E os três que mais giraram dinheiro.
//   - SÓ O QUE SE CONTA COM O OLHO. Camarão em quilo e chopp em litro ficam de
//     fora, mesmo girando mais dinheiro que tudo: ninguém pesa nada na saída.
//   - CONTINUA ÀS CEGAS. A lista não leva o saldo que o sistema espera.
//   - O DINHEIRO DIZ NA HORA no que deu: bateu, faltou ou sobrou.
//   - FECHA SEM "TEM CERTEZA?". Dois toques já bastam; o teste recusa qualquer
//     janela de confirmação, então se ela voltar, o caixa não fecha e isto falha.
//   - PULAR CONTINUA PODENDO. Fechar o caixa não trava por causa de contagem.
//   - E O QUE FOI CONTADO VIRA RESULTADO, como antes.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
const caixas = async () => (await (await fetch(`${BANCO}?select=valor&chave=like.${MARCA}caixa:*`)).json()).map((x) => x.valor);
const limpa = (s) => String(s || '').replace(/ /g, ' ');

// O dia operacional, a mesma conta do app: antes das 6h, a noite é a de ontem.
const diaOperacional = () => {
  const agora = new Date();
  const h = parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(agora), 10) || 0;
  const base = h < 6 ? new Date(agora.getTime() - 24 * 3600 * 1000) : agora;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(base);
};
const DIA = diaOperacional();
// Um item que vendeu `qtd` hoje. O saldo já está descontado.
const item = (id, nome, unidade, custo, saldo, vendeu) => ({
  id, nome, unidade, custo: String(custo), saldo: String(saldo), categoria: 'Bebidas',
  movimentos: vendeu > 0 ? [{ id: `m-${id}`, tipo: 'venda', qtd: vendeu, saldoDepois: saldo, motivo: 'Venda', data: DIA, ts: Date.now() }] : [],
});

const p0 = await painel();
await gravar({ ...p0,
  negocio: { nome: 'Pico do Mané', cidade: 'Florianópolis', dona: 'Karen', papeis: { dona: 'Karen', garcom: 'Atendimento' } },
  estoque: [
    // CONTÁVEIS, do que mais girou dinheiro pro que menos (custo × vendido):
    item('hei', 'Heineken long neck', 'un', 7.5, 20, 30),   // 225,00  -> entra
    item('ori', 'Original 600ml', 'grf', 9, 12, 20),        // 180,00  -> entra
    item('red', 'Red Bull lata', 'lata', 8, 15, 10),        //  80,00  -> entra
    item('agu', 'Água sem gás', 'un', 1.5, 40, 12),         //  18,00  -> fica de fora (4º)
    item('coc', 'Coca lata', 'lata', 3, 30, 5),             //  15,00  -> fica de fora
    item('suc', 'Suco caixinha', 'un', 2, 10, 2),           //   4,00  -> fica de fora
    // NÃO SE CONTA COM O OLHO — e giraram MAIS dinheiro que todos os de cima:
    item('cam', 'Camarão limpo', 'kg', 60, 3.2, 8),         // 480,00
    item('chp', 'Chopp Blumenau 30L', 'L', 11.5, 12, 30),   // 345,00
    // Contável, mas não mexeu hoje:
    item('cor', 'Corona long neck', 'un', 8, 24, 0),
  ],
  cardapio: [], fichas: [], receitas: [], despesas: [], compras: [], diario: [], clientes: [],
});
// Nenhum caixa de outras rodadas.
for (const c of await caixas()) if (c && c.id) await fetch(`${BANCO}?chave=eq.${MARCA}caixa:${c.id}`, { method: 'DELETE' });

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const pg = await ctx.newPage();
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
// Qualquer "tem certeza?" é RECUSADO. Se a janela voltar a existir, o caixa
// não fecha e os testes do fim acusam.
let janelas = 0;
pg.on('dialog', (d) => { janelas += 1; d.dismiss(); });

await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1800);
await pg.locator('select[data-quem]').selectOption({ label: 'Karen' });
await pg.locator('input[type="password"]').first().fill('Teste@123');
await pg.locator('button:has-text("Entrar")').first().click();
await pg.waitForTimeout(3800);

const pedir = (url, corpo) => pg.evaluate(async (x) => {
  const r = await fetch(x.url, x.corpo ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(x.corpo) } : { cache: 'no-store' });
  let j = null; try { j = await r.json(); } catch { /* sem corpo */ }
  return { status: r.status, j };
}, { url, corpo });
const tocar = (rot) => pg.evaluate((r) => {
  const lim = (t) => String(t || '').replace(/ /g, ' ').trim().toLowerCase();
  const x = [...document.querySelectorAll('button')].find((e) => lim(e.innerText) === r.toLowerCase());
  if (x) { x.click(); return true; }
  return false;
}, rot);
const texto = async () => limpa(await pg.locator('body').innerText());

// ---------------------------------------------------------------------------
console.log('\n### O QUE O SERVIDOR MANDA CONTAR');
const abriu = await pedir('/api/caixa', { acao: 'abrir', saldoInicial: '100' });
cobra('abriu o caixa com R$ 100,00 de troco', abriu.status === 200 && abriu.j?.ok, JSON.stringify(abriu.j).slice(0, 100));
const lista = (await pedir('/api/caixa')).j.paraContar || [];
const ids = lista.map((x) => x.id);
cobra('são 3 itens, não 12', lista.length === 3, `${lista.length}: ${ids.join(',')}`);
// 225, 180 e 80 de giro: Heineken, Original, Red Bull — nessa ordem.
cobra('os 3 que mais giraram dinheiro, em ordem', ids.join(',') === 'hei,ori,red', ids.join(','));
// Camarão (480) e chopp (345) giraram mais que todos. Não se conta com o olho.
cobra('camarão em quilo e chopp em litro ficam de fora', !ids.includes('cam') && !ids.includes('chp'), ids.join(','));
// Às cegas: nem saldo, nem custo, nem quanto vendeu descem pra tela.
cobra('a lista não leva o saldo que o sistema espera', lista.every((x) => Object.keys(x).sort().join(',') === 'id,nome,unidade'), JSON.stringify(lista[0]));

// ---------------------------------------------------------------------------
console.log('\n### A TELA DE FECHAR');
cobra('abriu a Central de Operações', await tocar('Central de Operações'));
await pg.waitForTimeout(1500);
cobra('abriu o Caixa', await tocar('Caixa'));
await pg.waitForTimeout(1800);
cobra('tocou em Fechar caixa', await tocar('Fechar caixa'));
await pg.waitForTimeout(900);
let t = await texto();
const iCartao = t.toLowerCase().indexOf('1. conta o dinheiro da gaveta');
const cartao = iCartao < 0 ? '' : t.slice(iCartao, iCartao + 700);
cobra('passo 1: conta o dinheiro da gaveta', iCartao >= 0, (t.match(/[^\n]*conta o dinheiro[^\n]*/i) || ['(não achou)'])[0]);
cobra('diz quanto era pra ter: R$ 100,00', /Era pra ter R\$ 100,00/.test(cartao), cartao.split('\n').slice(0, 3).join(' | '));
cobra('passo 2: conta só estes 3', /2\. Conta só estes 3/.test(cartao), (cartao.match(/[^\n]*2\. [^\n]*/) || ['(não achou)'])[0]);
cobra('com os três nomes', /Heineken long neck/.test(cartao) && /Original 600ml/.test(cartao) && /Red Bull lata/.test(cartao), cartao.replace(/\s+/g, ' ').slice(0, 260));
cobra('e sem o quarto da fila nem o camarão', !/Água sem gás|Camarão|Chopp/.test(cartao), (cartao.match(/Água sem gás|Camarão|Chopp/g) || ['(só os 3, certo)']).join(' '));
// A tela não pode entregar o que o sistema espera: 20, 12 e 15.
cobra('não mostra o que o sistema espera de cada um', !/\b20\b|\b12\b|\b15\b/.test(cartao.replace(/R\$ [\d.,]+/g, '').replace(/600ml/g, '')), cartao.replace(/\s+/g, ' ').slice(0, 300));

console.log('\n### O DINHEIRO DIZ NA HORA NO QUE DEU');
const digitarDinheiro = (v) => pg.evaluate((x) => {
  const campo = [...document.querySelectorAll('input')].find((i) => i.placeholder === 'quanto tem');
  if (!campo) return false;
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(campo, x);
  campo.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}, v);
const gaveta = () => pg.evaluate(() => { const x = document.querySelector('[data-gaveta]'); return x ? { estado: x.getAttribute('data-gaveta'), txt: (x.innerText || '').replace(/ /g, ' ') } : null; });
cobra('antes de digitar, não acusa nada', (await gaveta()) === null, JSON.stringify(await gaveta()));
cobra('digitou 88', await digitarDinheiro('88'));
await pg.waitForTimeout(400);
let g = await gaveta();
cobra('faltam R$ 12,00', g?.estado === 'falta' && /Faltam R\$ 12,00 na gaveta/.test(g?.txt || ''), JSON.stringify(g));
await digitarDinheiro('105,50');
await pg.waitForTimeout(400);
g = await gaveta();
cobra('sobram R$ 5,50', g?.estado === 'sobra' && /Sobram R\$ 5,50 na gaveta/.test(g?.txt || ''), JSON.stringify(g));
await digitarDinheiro('100');
await pg.waitForTimeout(400);
g = await gaveta();
cobra('bateu certinho', g?.estado === 'bateu' && /Bateu certinho/.test(g?.txt || ''), JSON.stringify(g));

console.log('\n### CONTA DOIS, PULA UM, E FECHA SEM "TEM CERTEZA?"');
// Heineken: o sistema espera 20, ela conta 18 — faltam 2. Original: bate em 12.
// O Red Bull ela pula. Pular tem que continuar podendo.
const contar = (nome, v) => pg.evaluate((x) => {
  const linha = [...document.querySelectorAll('div')].find((d) => d.children.length === 0 && (d.textContent || '').trim() === x.nome);
  const bloco = linha && linha.parentElement && linha.parentElement.parentElement;
  const campo = bloco ? bloco.querySelector('input') : null;
  if (!campo) return false;
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(campo, x.v);
  campo.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}, { nome, v });
cobra('contou 18 Heineken', await contar('Heineken long neck', '18'));
cobra('contou 12 Original', await contar('Original 600ml', '12'));
await pg.waitForTimeout(400);
cobra('tocou em Fechar o caixa', await tocar('Fechar o caixa'));
await pg.waitForTimeout(3600);
cobra('nenhuma janela de "tem certeza?" apareceu', janelas === 0, `${janelas} janela(s)`);
const cx = (await caixas()).find((c) => c && c.aberto === false) || null;
cobra('o caixa fechou', !!cx, JSON.stringify((await caixas()).map((c) => c.aberto)));
cobra('guardou o dinheiro contado', cx && Number(cx.contado) === 100, String(cx && cx.contado));
const conf = cx && cx.conferencia;
cobra('a conferência foi feita com o que ela contou', !!conf && conf.totais.conferidos === 2, JSON.stringify(conf && conf.totais).slice(0, 160));
const falta = conf && (conf.faltas || []).find((f) => /Heineken/.test(f.nome));
cobra('achou as 2 Heineken que faltam', !!falta && falta.falta === 2 && falta.sistema === 20 && falta.contado === 18, JSON.stringify(falta));
cobra('e não inventou falta no Red Bull, que ela pulou', !(conf.faltas || []).some((f) => /Red Bull/.test(f.nome)), JSON.stringify((conf.faltas || []).map((f) => f.nome)));
t = await texto();
cobra('o resultado aparece na tela logo depois', /Heineken long neck · contou 18, sistema 20/.test(t), (t.match(/[^\n]*Heineken[^\n]*/) || ['(não aparece)'])[0]);

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
