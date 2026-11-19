// "O CLIENTE PEDIU A CONTA IMPRESSA E EU NÃO CONSEGUI."
//
// Agora a mesa tem o botão "Conta em PDF". O que este teste guarda:
//
//   - o PDF é um PDF de verdade: começa e termina como PDF, e o índice
//     interno (xref) aponta pros lugares certos — leitor de PDF exigente
//     (o do iPhone, a impressora) recusa arquivo torto;
//   - a conta bate com a tela: itens, subtotal, 10%, total, o que já foi pago
//     e quanto falta, dividido pelas pessoas;
//   - os acentos saem certos ("PICO DO MANÉ", "Serviço", "Não é documento
//     fiscal") e nome comprido de prato quebra em duas linhas sem estourar;
//   - no COMPUTADOR o PDF abre numa aba (é onde está a impressora);
//   - no CELULAR vai pra folha de compartilhar (Imprimir, WhatsApp, Salvar) —
//     o "imprimir" do navegador não funciona no iPhone com o app instalado;
//   - mesa vazia não tem botão (não há conta pra mostrar).
import { chromium, devices } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const linha = async (chave) => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}${chave}`)).json())[0]?.valor;
const gravarLinha = (chave, v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}${chave}`, valor: v }]) });
const reais = (v) => { const [i, d] = (Math.round(v * 100) / 100).toFixed(2).split('.'); return `R$ ${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${d}`; };

const LONGO = 'Porção de batata 400g com cheddar e bacon extra crocante';
const p0 = (await linha('painel')) || {};
await gravarLinha('painel', { ...p0,
  negocio: { nome: 'Pico do Mané', cidade: 'Florianópolis', dona: 'Karen', papeis: { dona: 'Karen', garcom: 'Atendimento' } },
  mesasQtd: 6,
  cardapio: [
    { id: 'hk', nome: 'Heineken', categoria: 'Bebidas', preco: '14', ativo: true },
    { id: 'bt', nome: LONGO, categoria: 'Porções', preco: '39,90', ativo: true },
    { id: 'cp', nome: 'Caipirinha de limão', categoria: 'Drinks', preco: '18', ativo: true },
  ],
  fichas: [], estoque: [],
});

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const entrar = async (pg, papel, senha) => {
  await pg.goto(BASE, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(1800);
  await pg.locator('select[data-quem]').selectOption(papel);
  await pg.locator('input[type="password"]').fill(senha);
  await pg.locator('button:has-text("Entrar")').click(); await pg.waitForTimeout(4000);
};
const pedir = (pg, url, corpo) => pg.evaluate(async (x) => {
  const r = await fetch(x.url, x.corpo ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(x.corpo) } : { cache: 'no-store' });
  let j = null; try { j = await r.json(); } catch { /* sem json */ } return { status: r.status, j };
}, { url, corpo });
const tocar = (pg, rot) => pg.evaluate((r) => { const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').replace(/ /g, ' ').trim().toLowerCase() === r.toLowerCase()); if (x) { x.click(); return true; } return false; }, rot);

// A mesa 3: Tamara, 2 pessoas, 2 Heineken, a porção de nome comprido e uma
// caipirinha; um amigo já pagou R$ 20 no Pix e foi embora.
const ctxDona = await b.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
const dona = await ctxDona.newPage();
dona.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
await entrar(dona, 'dona', 'Teste@123');
await pedir(dona, '/api/caixa', { acao: 'abrir', saldoInicial: '50' });
const ab = await pedir(dona, '/api/comandas', { acao: 'abrir', mesa: '3', pessoas: 2 });
const id = ab.j?.comanda?.id;
for (const c of ['hk', 'hk', 'bt', 'cp']) await pedir(dona, '/api/comandas', { acao: 'add', comandaId: id, cardapioId: c });
await pedir(dona, '/api/comandas', { acao: 'infos', comandaId: id, nome: 'Tamara' });
const pa = await pedir(dona, '/api/comandas', { acao: 'parcial', comandaId: id, valor: 20, forma: 'Pix' });
cobra('montou a mesa 3 (com R$ 20 já pagos)', !!id && pa.status === 200, JSON.stringify(pa.j).slice(0, 120));
await pedir(dona, '/api/comandas', { acao: 'abrir', mesa: '5', pessoas: 1 });

// A conta feita na mão.
const subtotal = 2 * 14 + 39.9 + 18;            // 85,90
const servico = Math.round(subtotal * 0.10 * 100) / 100; // 8,59
const total = Math.round((subtotal + servico) * 100) / 100; // 94,49
const falta = Math.round((total - 20) * 100) / 100;         // 74,49
const porPessoa = Math.round((falta / 2) * 100) / 100;

// Lê o PDF que a página gerou, e confere o "esqueleto" (o índice interno).
const lerPdf = async (pg, url) => pg.evaluate(async (u) => {
  const buf = new Uint8Array(await (await fetch(u)).arrayBuffer());
  let s = ''; for (const x of buf) s += String.fromCharCode(x); return s;
}, url);
const esqueletoOk = (s) => {
  const m = /startxref\n(\d+)\n%%EOF/.exec(s);
  if (!s.startsWith('%PDF-1.4') || !m) return 'sem começo/fim de PDF';
  const xref = Number(m[1]);
  if (s.slice(xref, xref + 4) !== 'xref') return `startxref aponta pra "${s.slice(xref, xref + 8)}"`;
  const entradas = s.slice(xref).split('\n').slice(3).filter((l) => / 00000 n $/.test(l)).map((l) => Number(l.slice(0, 10)));
  for (let i = 0; i < entradas.length; i += 1) if (!s.startsWith(`${i + 1} 0 obj`, entradas[i])) return `objeto ${i + 1} fora do lugar`;
  const len = Number((/\/Length (\d+) >>\nstream\n/.exec(s) || [])[1]);
  const ini = s.indexOf('stream\n') + 7; const fim = s.indexOf('endstream');
  if (fim - ini !== len) return `Length ${len} mas o conteúdo tem ${fim - ini}`;
  return '';
};
const textos = (s) => [...s.matchAll(/\((.*)\) Tj/g)].map((m) => m[1].replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8))).replace(/\\([()\\])/g, '$1'));

// ---------------------------------------------------------------------------
console.log('\n### NO COMPUTADOR: ABRE O PDF NUMA ABA');
const ctxG = await b.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
const gar = await ctxG.newPage();
gar.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
await entrar(gar, 'garcom', '1234');
await tocar(gar, 'Comandas'); await gar.waitForTimeout(2000);
await gar.evaluate(() => { window.__abas = []; window.open = (u) => { window.__abas.push(u); return {}; }; });
// Mesa vazia: sem botão.
await gar.locator('button:has-text("5")').filter({ hasText: /ocupada|aberta|R\$|5/ }).first().click().catch(() => {});
await gar.waitForTimeout(800);
const naVazia = await gar.locator('[data-conta-pdf]').count();
await tocar(gar, '‹ Mesas'); await gar.waitForTimeout(800);
cobra('mesa sem nada lançado: sem o botão', naVazia === 0);
await gar.evaluate(() => { const t = [...document.querySelectorAll('button')].find((e) => /^\s*(OCUPADA|ABERTA)?\s*3\b/i.test(e.innerText || '') && /R\$|ocupad|tamara/i.test(e.innerText || '')); if (t) t.click(); });
await gar.waitForTimeout(1500);
cobra('na mesa 3 aparece o botão "Conta em PDF"', (await gar.locator('[data-conta-pdf]').count()) === 1);
await gar.locator('[data-conta-pdf]').click();
await gar.waitForTimeout(800);
const abas = await gar.evaluate(() => window.__abas);
cobra('o PDF abriu numa aba nova', abas.length === 1 && String(abas[0]).startsWith('blob:'), JSON.stringify(abas));
const pdf = abas[0] ? await lerPdf(gar, abas[0]) : '';
const esq = esqueletoOk(pdf);
cobra('é um PDF bem montado (começo, fim, índice e tamanho batendo)', !esq, esq || `${pdf.length} bytes`);
const t = textos(pdf);
const tem = (re) => t.some((l) => re.test(l));
console.log(t.map((l) => `      | ${l}`).join('\n'));
cobra('no topo: PICO DO MANÉ, Florianópolis', tem(/PICO DO MANÉ/) && tem(/Florianópolis/));
cobra('CONTA DA MESA 3, Cliente: Tamara, Pessoas: 2', tem(/^CONTA DA MESA 3$/) && tem(/^Cliente: Tamara$/) && tem(/^Pessoas: 2$/));
cobra('2x Heineken = 28,00, e "R$ 14,00 cada"', tem(/^2x Heineken\s+28,00$/) && tem(/R\$ 14,00 cada/));
cobra('o nome comprido da porção quebra em linhas, sem passar da bobina', tem(/^1x Porção de batata/) && tem(/39,90$/) && t.every((l) => l.length <= 34), t.filter((l) => l.length > 34).join(' / '));
cobra(`Subtotal ${reais(subtotal)} e Serviço (10%) ${reais(servico)}`, tem(new RegExp(`^Subtotal\\s+${reais(subtotal).replace('$', '\\$')}$`)) && tem(new RegExp(`^Serviço \\(10%\\)\\s+${reais(servico).replace('$', '\\$')}$`)));
cobra(`TOTAL ${reais(total)}`, tem(new RegExp(`^TOTAL\\s+${reais(total).replace('$', '\\$')}$`)));
cobra(`Já pago R$ 20,00 e FALTA PAGAR ${reais(falta)}`, tem(/^Já pago\s+R\$ 20,00$/) && tem(new RegExp(`^FALTA PAGAR\\s+${reais(falta).replace('$', '\\$')}$`)));
cobra(`Dividido por 2: ${reais(porPessoa)} cada`, tem(new RegExp(`^Dividido por 2\\s+${reais(porPessoa).replace('$', '\\$')} cada$`)));
cobra('e avisa: "Não é documento fiscal."', tem(/Não é documento fiscal\./));
cobra('o nome do bar está no título do arquivo', /\/Title \(Conta da mesa 3\)/.test(pdf));

// ---------------------------------------------------------------------------
console.log('\n### NO CELULAR: VAI PRA FOLHA DE COMPARTILHAR');
const ctxCel = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
await ctxCel.addInitScript(() => {
  window.__compartilhou = [];
  navigator.canShare = () => true;
  navigator.share = async (d) => { for (const f of d.files || []) window.__compartilhou.push({ nome: f.name, tipo: f.type, tam: f.size, titulo: d.title }); };
  window.open = () => { window.__abriuAba = true; return {}; };
});
const cel = await ctxCel.newPage();
cel.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
await entrar(cel, 'garcom', '1234');
await tocar(cel, 'Comandas'); await cel.waitForTimeout(2000);
await cel.evaluate(() => { const t = [...document.querySelectorAll('button')].find((e) => /^\s*(OCUPADA|ABERTA)?\s*3\b/i.test(e.innerText || '') && /R\$|ocupad|tamara/i.test(e.innerText || '')); if (t) t.click(); });
await cel.waitForTimeout(1500);
await cel.locator('[data-conta-pdf]').click();
await cel.waitForTimeout(800);
const comp = await cel.evaluate(() => window.__compartilhou);
cobra('abriu a folha de compartilhar com o PDF (Imprimir / WhatsApp / Salvar)', comp.length === 1 && comp[0].tipo === 'application/pdf' && /^Conta-mesa-3-\d{4}-\d{4}\.pdf$/.test(comp[0].nome) && comp[0].tam > 800, JSON.stringify(comp));
cobra('e não tentou abrir aba (no iPhone com o app instalado isso não funciona)', !(await cel.evaluate(() => window.__abriuAba)));

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
