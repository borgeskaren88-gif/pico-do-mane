// "CONFERÊNCIA E CORTESIA: QUERIA ALGO BEM CLARO, QUANTO JÁ FOI GASTO EM
// CORTESIA, PERCA OU CONSUMO. TIPO BATI O OLHO, JÁ SEI."
//
// "CONTAS A PAGAR: QUERO TAMBÉM TER BEM CLARO O TANTO DE JUROS GASTO NO MÊS."
//
// Os dois números existiam, espalhados: o primeiro, só no Raio-X; o segundo,
// uma linha de despesa por boleto atrasado. Nenhum estava na tela onde ela
// toma a decisão.
//
// O QUE ESTE TESTE GUARDA:
//
//   - O PLACAR SOMA SÓ O QUE SAIU SEM VENDER, NESTE MÊS. Venda não entra.
//     Saída do mês passado não entra. Saída "outro motivo" não entra.
//   - CADA SAÍDA NO SEU BALDE: cortesia, consumo da casa, perda (desperdício,
//     vencido e quebra são perda).
//   - ITEM SEM CUSTO NÃO VIRA ZERO CALADO. Ele fica de fora e a tela AVISA
//     quantos ficaram — senão o total pareceria menor do que é.
//   - O PLACAR E O RAIO-X DÃO O MESMO NÚMERO. É a mesma conta; duas telas com
//     a mesma pergunta não podem responder diferente.
//   - LANÇOU UMA CORTESIA, O PLACAR ANDA NA HORA.
//   - OS JUROS DO MÊS SÃO SÓ OS DO MÊS, e só os da categoria de juros.
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
const MES = HOJE.slice(0, 7);
// Um dia que é deste mês com certeza, e um que é do mês passado com certeza.
const NESTE_MES = `${MES}-01`;
const MES_PASSADO = (() => { const d = new Date(`${MES}-01T12:00:00Z`); d.setUTCDate(0); return d.toISOString().slice(0, 10); })();
const MESMO_ANO = MES_PASSADO.slice(0, 4) === HOJE.slice(0, 4);
let k = 0;
const mv = (tipo, qtd, motivo, data) => ({ id: `mv${k += 1}`, tipo, qtd, motivo, data, ts: Date.now() - k * 1000, saldoDepois: 0 });

const p0 = await painel();
await gravar({ ...p0,
  negocio: { nome: 'Pico do Mané', cidade: 'Florianópolis', dona: 'Karen', papeis: { dona: 'Karen', garcom: 'Atendimento' } },
  estoque: [
    { id: 'hei', nome: 'Heineken long neck', custo: '7,50', unidade: 'un', saldo: '40', categoria: 'Bebidas', movimentos: [
      mv('saida', 4, 'Cortesia · Heineken', NESTE_MES),            // cortesia 30,00
      mv('saida', 2, 'Consumo da casa · Heineken', NESTE_MES),     // consumo  15,00
      mv('saida', 1, 'Quebra', NESTE_MES),                         // perda     7,50
      mv('venda', 50, 'Venda', NESTE_MES),                         // venda: não entra
      mv('saida', 10, 'Cortesia · Heineken', MES_PASSADO),         // mês passado: não entra
      mv('saida', 3, 'Outro', NESTE_MES),                          // outro motivo: não entra
    ] },
    { id: 'lim', nome: 'Limão', custo: '8', unidade: 'kg', saldo: '5', categoria: 'Cozinha', movimentos: [
      mv('saida', 1.5, 'Desperdício (cozinha)', NESTE_MES),        // perda 12,00
      mv('saida', 0.5, 'Vencido', NESTE_MES),                      // perda  4,00
    ] },
    // SEM CUSTO: a cortesia dele não tem como virar reais.
    { id: 'gin', nome: 'Gin artesanal', custo: '', unidade: 'un', saldo: '2', categoria: 'Bebidas', movimentos: [
      mv('saida', 1, 'Cortesia · Gin', NESTE_MES),
    ] },
  ],
  cardapio: [{ id: 'c-hei', nome: 'Heineken', categoria: 'Bebidas', preco: '14', ativo: true }],
  fichas: [{ cardapioId: 'c-hei', itens: [{ estoqueId: 'hei', qtd: '1', unidade: 'un' }] }],
  despesas: [
    // Juros DESTE mês: 12,50 + 7,50 = 20,00, em 2 boletos.
    { id: 'j1', data: NESTE_MES, categoria: 'Juros e multas por atraso', descricao: 'Boleto Ambev', valor: '12,50', obs: '' },
    { id: 'j2', data: NESTE_MES, categoria: 'Juros e multas por atraso', descricao: 'Boleto gás', valor: '7,50', obs: '' },
    // Do mês passado: entra no ano (se for o mesmo ano), não no mês.
    { id: 'j3', data: MES_PASSADO, categoria: 'Juros e multas por atraso', descricao: 'Boleto luz', valor: '30', obs: '' },
    // Parecido, mas NÃO é juro de boleto.
    { id: 'd1', data: NESTE_MES, categoria: 'Tarifas bancárias', descricao: 'Tarifa', valor: '45', obs: '' },
    { id: 'd2', data: NESTE_MES, categoria: 'Energia elétrica', descricao: 'Celesc', valor: '430', obs: '' },
  ],
  receitas: [], compras: [], diario: [], clientes: [],
});

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const pg = await ctx.newPage();
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
pg.on('dialog', (d) => d.accept());

await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1800);
await pg.locator('select[data-quem]').selectOption({ label: 'Karen' });
await pg.locator('input[type="password"]').first().fill('Teste@123');
await pg.locator('button:has-text("Entrar")').first().click();
await pg.waitForTimeout(3800);

const tocar = (rot) => pg.evaluate((r) => {
  const lim = (t) => String(t || '').replace(/ /g, ' ').trim().toLowerCase();
  const x = [...document.querySelectorAll('button')].find((e) => lim(e.innerText) === r.toLowerCase());
  if (x) { x.click(); return true; }
  return false;
}, rot);
const irPara = async (rot) => { const ok = await tocar(rot); await pg.waitForTimeout(1700); cobra(`achou o caminho "${rot}"`, ok); };
const bloco = (sel) => pg.evaluate((s) => { const x = document.querySelector(s); return x ? (x.innerText || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim() : ''; }, sel);

// ---------------------------------------------------------------------------
console.log('\n### O PLACAR: QUANTO SAIU SEM VENDER');
await irPara('Abastecimento');
await irPara('Saiu sem vender');
await pg.waitForTimeout(1200);
let placar = await bloco('[data-placar="sem-vender"]');
cobra('o placar está no topo da tela', !!placar, placar.slice(0, 120) || '(não achou)');
// 30,00 + 15,00 + (7,50 + 12,00 + 4,00) = 68,50
cobra('total do mês: R$ 68,50', /R\$ 68,50/.test(placar), placar.slice(0, 200));
cobra('cortesia: R$ 30,00, 1 vez', /R\$ 30,00 1 vez/.test(await bloco('[data-balde="cortesia"]')), await bloco('[data-balde="cortesia"]'));
cobra('consumo da casa: R$ 15,00, 1 vez', /R\$ 15,00 1 vez/.test(await bloco('[data-balde="consumo"]')), await bloco('[data-balde="consumo"]'));
// A quebra tem balde próprio agora ("quebrou, congelou..."): 7,50.
cobra('quebrou: R$ 7,50, 1 vez', /R\$ 7,50 1 vez/.test(await bloco('[data-balde="quebra"]')), await bloco('[data-balde="quebra"]'));
// Desperdício e vencido ficam em perda: 12,00 + 4,00.
cobra('perda: R$ 16,00, 2 vezes', /R\$ 16,00 2 vezes/.test(await bloco('[data-balde="perda"]')), await bloco('[data-balde="perda"]'));
// A venda de 50 (375,00) e a cortesia do mês passado (75,00) não podem entrar.
cobra('a venda e o mês passado ficaram de fora', !/R\$ 443,50|R\$ 143,50|R\$ 105,00/.test(placar), placar.slice(0, 200));
cobra('avisa que 1 saída ficou de fora por falta de custo', /1 saída ficou de fora dessa soma porque o item não tem custo/.test(placar), (placar.match(/\d+ saída[^.]*\./) || ['(não avisa)'])[0]);

console.log('\n### LANÇOU UMA CORTESIA, O PLACAR ANDA');
// 2 Heineken de cortesia = +15,00. Cortesia vai de 30,00 pra 45,00.
cobra('escolheu a Heineken', await tocar('Heineken'));
await pg.waitForTimeout(600);
await pg.evaluate(() => {
  const lab = [...document.querySelectorAll('div')].find((d) => d.children.length === 0 && /^quantas\?$/i.test((d.textContent || '').trim()));
  const campo = lab && lab.parentElement ? lab.parentElement.querySelector('input') : null;
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(campo, '2');
  campo.dispatchEvent(new Event('input', { bubbles: true }));
});
await pg.waitForTimeout(300);
cobra('registrou a cortesia', await tocar('Registrar cortesia'));
await pg.waitForTimeout(3600);
cobra('a cortesia do placar foi pra R$ 45,00, 2 vezes', /R\$ 45,00 2 vezes/.test(await bloco('[data-balde="cortesia"]')), await bloco('[data-balde="cortesia"]'));
placar = await bloco('[data-placar="sem-vender"]');
cobra('e o total pra R$ 83,50', /R\$ 83,50/.test(placar), placar.slice(0, 160));
// A cortesia foi lançada agora: é de hoje.
cobra('o "hoje" passou a mostrar os R$ 15,00', /hoje: R\$ 15,00/.test(placar), (placar.match(/hoje: R\$ [\d.,]+/) || ['(não mostra)'])[0]);

console.log('\n### O RAIO-X DIZ O MESMO');
await irPara('Finanças');
await irPara('Raio-X');
await pg.waitForTimeout(1500);
const raio = limpa(await pg.locator('body').innerText()).replace(/\s+/g, ' ');
cobra('perdas no Raio-X: R$ 23,50', /Perdas \/ desperdício \/ vencidos R\$ 23,50/i.test(raio), (raio.match(/Perdas \/ desperdício \/ vencidos R\$ [\d.,]+/i) || ['(não achou)'])[0]);
cobra('cortesias no Raio-X: R$ 45,00', /Cortesias R\$ 45,00/i.test(raio), (raio.match(/Cortesias R\$ [\d.,]+/i) || ['(não achou)'])[0]);
cobra('consumo no Raio-X: R$ 15,00', /Consumo da casa R\$ 15,00/i.test(raio), (raio.match(/Consumo da casa R\$ [\d.,]+/i) || ['(não achou)'])[0]);

// ---------------------------------------------------------------------------
console.log('\n### OS JUROS DO MÊS, EM CONTAS A PAGAR');
await irPara('Contas a Pagar');
await pg.waitForTimeout(1200);
const juros = await bloco('[data-placar="juros"]');
cobra('o cartão de juros está na tela', !!juros, juros.slice(0, 120) || '(não achou)');
// 12,50 + 7,50. A tarifa bancária (45) e a luz (430) não são juro de boleto.
cobra('juros do mês: R$ 20,00', /R\$ 20,00/.test(juros) && !/R\$ 65,00|R\$ 495,00/.test(juros), juros);
cobra('em 2 boletos pagos atrasados', /em 2 boletos pagos atrasados/.test(juros), juros);
// O de 30,00 é do mês passado: não entra no mês; entra no ano se for o mesmo ano.
// O número grande é o último do cartão. Tem que ser o do mês, não o do ano.
cobra('o número grande é o do mês (20,00), não o do ano', /R\$ 20,00$/.test(juros), juros);
if (MESMO_ANO) cobra('mas aparece no total do ano: R$ 50,00', /no ano: R\$ 50,00/.test(juros), juros);
else cobra('virada de ano: o total do ano é só o deste mês', !/no ano:/.test(juros), juros);

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
