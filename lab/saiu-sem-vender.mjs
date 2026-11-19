// "UMA LISTA DE TUDO QUE SAIU SEM VENDER, COM NOMES E VALORES DE CUSTO, COM
// CATEGORIA: CORTESIA, QUEBROU, CONGELOU, CONSUMO DA CASA, PERDA."
//
// Começou com a Heineken que a Sarah quebrou: ela lançou, avisou, e a Karen
// não achou em lugar nenhum — o placar só mostrava totais, e o lançamento
// estava escondido no histórico do item.
//
// O que este teste guarda:
//   - cada saída vira UMA linha: o que foi, quanto, quem pegou, quem lançou,
//     quando e quanto custou;
//   - a cortesia de um prato (que baixa vários ingredientes) é UMA linha, com
//     o nome do prato e o custo somado;
//   - as cinco categorias — e "Congelou", "Estragou" e "Venceu", que antes
//     saíam do estoque e sumiam do placar, agora contam;
//   - o placar e a lista dão o mesmo número; tocar num balde filtra a lista;
//   - o mês passado fica no mês passado (e dá pra voltar pra ele).
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const linha = async (chave) => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}${chave}`)).json())[0]?.valor;
const gravarLinha = (chave, v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}${chave}`, valor: v }]) });
const limpa = (s) => String(s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const HOJE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const MES = HOJE.slice(0, 7);
const DIA = `${MES}-01`;
const PASSADO = (() => { const d = new Date(`${MES}-01T12:00:00Z`); d.setUTCDate(0); return d.toISOString().slice(0, 10); })();
let k = 0;
const T0 = Date.parse(`${DIA}T23:00:00Z`);
const mv = (qtd, motivo, extra = {}, data = DIA) => ({ id: `m${k += 1}`, tipo: 'saida', qtd, motivo, data, ts: T0 + k * 60000, saldoDepois: 0, ...extra });

const p0 = (await linha('painel')) || {};
await gravarLinha('painel', { ...p0,
  negocio: { nome: 'Pico do Mané', cidade: 'Florianópolis', dona: 'Karen', papeis: { dona: 'Karen', garcom: 'Atendimento' } },
  estoque: [
    { id: 'hei', nome: 'Heineken long neck', custo: '7,50', unidade: 'un', saldo: '40', movimentos: [
      mv(1, 'Quebrou · Sarah (atendimento)', { quem: 'Sarah', por: 'gerente' }),   // quebra  7,50
      mv(2, 'Congelou (atendimento)', { por: 'garcom' }),                          // congelou 15,00 (antes sumia!)
      mv(1, 'Consumo da casa · João (atendimento)', { quem: 'João', por: 'garcom' }), // consumo 7,50
      mv(30, 'Venda', {}, DIA),                                                    // não é saída manual
      mv(5, 'Quebrou (atendimento)', { por: 'garcom' }, PASSADO),                  // mês passado: 37,50
    ].map((m, i) => (i === 3 ? { ...m, tipo: 'venda' } : m)) },
    { id: 'lim', nome: 'Limão', custo: '8', unidade: 'kg', saldo: '5', movimentos: [
      mv(0.5, 'Desperdício (cozinha)', { por: 'cozinha' }),                        // perda 4,00
      mv(0.25, 'Estragou (atendimento)', { por: 'garcom' }),                       // perda 2,00 (antes sumia!)
    ] },
    { id: 'leite', nome: 'Leite integral', custo: '5', unidade: 'L', saldo: '5', movimentos: [
      mv(1, 'Venceu (atendimento)', { por: 'garcom' }),                            // perda 5,00 (antes sumia!)
    ] },
    // UM X-BURGER DE CORTESIA: pão + carne, dois movimentos, uma linha.
    { id: 'pao', nome: 'Pão de hambúrguer', custo: '1,50', unidade: 'un', saldo: '20', movimentos: [
      mv(1, 'Cortesia · X-Burger · Aniversariante', { produto: 'X-Burger', refCortesia: 'cx1', quem: 'Aniversariante', por: 'dona' }),
    ] },
    { id: 'carne', nome: 'Blend 150g', custo: '9', unidade: 'un', saldo: '20', movimentos: [
      mv(1, 'Cortesia · X-Burger · Aniversariante', { produto: 'X-Burger', refCortesia: 'cx1', quem: 'Aniversariante', por: 'dona' }),
    ] },
    // Sem custo cadastrado: aparece, mas não soma.
    { id: 'gin', nome: 'Gin artesanal', custo: '', unidade: 'un', saldo: '2', movimentos: [mv(1, 'Cortesia', { por: 'dona' })] },
  ],
  cardapio: [], fichas: [], receitas: [], despesas: [], compras: [], diario: [],
});
// A conta: cortesia 10,50 · consumo 7,50 · quebrou 7,50 · congelou 15,00 · perda 11,00 = 51,50

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const pg = await ctx.newPage();
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
await pg.goto(BASE); await pg.waitForTimeout(1800);
await pg.locator('select[data-quem]').selectOption('dona');
await pg.locator('input[type="password"]').fill('Teste@123');
await pg.locator('button:has-text("Entrar")').click(); await pg.waitForTimeout(4000);
const tocar = (rot) => pg.evaluate((r) => { const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').replace(/\u00a0/g, ' ').trim().toLowerCase() === r.toLowerCase()); if (x) { x.click(); return true; } return false; }, rot);
const bloco = async (sel) => limpa(await pg.locator(sel).first().innerText().catch(() => ''));

console.log('\n### ONDE FICA');
cobra('Abastecimento', await tocar('Abastecimento')); await pg.waitForTimeout(1500);
cobra('a aba agora se chama "Saiu sem vender"', await tocar('Saiu sem vender')); await pg.waitForTimeout(1800);

console.log('\n### O PLACAR, COM AS CINCO CATEGORIAS');
const placar = await bloco('[data-placar="sem-vender"]');
cobra('total do mês: R$ 51,50', /R\$ 51,50/.test(placar), placar.slice(0, 120));
cobra('Cortesia R$ 10,50 · 1 vez (o X-Burger é uma vez, não duas)', /R\$ 10,50 1 vez/.test(await bloco('[data-balde="cortesia"]')), await bloco('[data-balde="cortesia"]'));
cobra('Consumo da casa R$ 7,50 · 1 vez', /R\$ 7,50 1 vez/.test(await bloco('[data-balde="consumo"]')), await bloco('[data-balde="consumo"]'));
cobra('Quebrou R$ 7,50 · 1 vez', /R\$ 7,50 1 vez/.test(await bloco('[data-balde="quebra"]')), await bloco('[data-balde="quebra"]'));
cobra('Congelou R$ 15,00 · 1 vez (antes não contava)', /R\$ 15,00 1 vez/.test(await bloco('[data-balde="congelou"]')), await bloco('[data-balde="congelou"]'));
cobra('Perda R$ 11,00 · 3 vezes (desperdício + estragou + venceu)', /R\$ 11,00 3 vezes/.test(await bloco('[data-balde="perda"]')), await bloco('[data-balde="perda"]'));
cobra('e avisa do gin sem custo', /1 saída ficou de fora/.test(placar));

console.log('\n### A LISTA');
const linhas = await pg.locator('[data-lista-sem-vender] [data-saida]').allInnerTexts();
const L = linhas.map(limpa);
L.forEach((l) => console.log(`      | ${l}`));
cobra('8 linhas (o X-Burger numa só, a venda e o mês passado de fora)', L.length === 8, String(L.length));
cobra('a Heineken da Sarah: Quebrou · 1 un · Sarah · lançado por Gerência · R$ 7,50', L.some((l) => /^Heineken long neck Quebrou · 1 un · Sarah · lançado por Gerência · \d\d\/\d\d \d\d:\d\d R\$ 7,50$/.test(l)));
cobra('Congelou: 2 un, lançado pelo Atendimento, R$ 15,00', L.some((l) => /^Heineken long neck Congelou · 2 un · lançado por Atendimento .*R\$ 15,00$/.test(l)));
cobra('Consumo da casa do João', L.some((l) => /Consumo da casa · 1 un · João · lançado por Atendimento .*R\$ 7,50$/.test(l)));
cobra('o X-Burger de cortesia: uma linha, R$ 10,50, pro aniversariante', L.some((l) => /^X-Burger Cortesia · Aniversariante · lançado por Dona .*R\$ 10,50$/.test(l)));
cobra('o limão estragado: Perda (estragou)', L.some((l) => /^Limão Perda \(estragou\) · 0,25 kg .*R\$ 2,00$/.test(l)));
cobra('o leite vencido: Perda (venceu)', L.some((l) => /^Leite integral Perda \(venceu\) · 1 L .*R\$ 5,00$/.test(l)));
cobra('o desperdício da cozinha: lançado por Cozinha', L.some((l) => /^Limão Perda \(desperdício\) · 0,5 kg · lançado por Cozinha .*R\$ 4,00$/.test(l)));
cobra('o gin sem custo aparece como "sem custo"', L.some((l) => /^Gin artesanal Cortesia .*sem custo$/.test(l)));
cobra('a mais nova em cima', /^Gin artesanal/.test(L[0] || ''), L[0]);
cobra('o total da lista bate com o placar: 8 saídas, R$ 51,50', /8 saídas R\$ 51,50/.test(await bloco('[data-lista-total]')), await bloco('[data-lista-total]'));

console.log('\n### FILTRAR');
await pg.locator('[data-filtro="congelou"]').click(); await pg.waitForTimeout(400);
cobra('"Congelou": só a Heineken congelada', (await pg.locator('[data-lista-sem-vender] [data-saida]').count()) === 1 && /1 saída de congelou R\$ 15,00/.test(await bloco('[data-lista-total]')), await bloco('[data-lista-total]'));
await pg.locator('[data-balde="perda"]').click(); await pg.waitForTimeout(400);
cobra('tocar no balde Perda do placar filtra a lista: 3 saídas, R$ 11,00', /3 saídas de perda R\$ 11,00/.test(await bloco('[data-lista-total]')), await bloco('[data-lista-total]'));
await pg.locator('[data-filtro="tudo"]').click(); await pg.waitForTimeout(400);

console.log('\n### O MÊS PASSADO');
await pg.locator('[aria-label="Mês anterior"]').click(); await pg.waitForTimeout(500);
const pas = await pg.locator('[data-lista-sem-vender] [data-saida]').allInnerTexts();
cobra('no mês passado: as 5 Heineken quebradas, R$ 37,50', pas.length === 1 && /Quebrou · 5 un .*R\$ 37,50/.test(limpa(pas[0])), pas.map(limpa).join(' / '));
cobra('e o placar do mês passado: R$ 37,50', /R\$ 37,50/.test(await bloco('[data-placar="sem-vender"]')));

console.log('\n### A SARAH LANÇA PELA TELA DELA, A KAREN VÊ');
await pedirSenha();
async function pedirSenha() {
  await pg.evaluate(async () => fetch('/api/acessos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'senha', papel: 'gerente', nova: 'Sarah@2026' }) }));
}
const ctxS = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const sa = await ctxS.newPage();
await sa.goto(BASE); await sa.waitForTimeout(1800);
await sa.locator('select[data-quem]').selectOption('gerente');
await sa.locator('input[type="password"]').fill('Sarah@2026');
await sa.locator('button:has-text("Entrar")').click(); await sa.waitForTimeout(4000);
const r = await sa.evaluate(async () => (await fetch('/api/comandas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'perda', itemId: 'hei', qtd: 1, motivo: 'Quebrou', quem: 'Sarah' }) })).status);
cobra('a Sarah lançou "Quebrou" pela tela de Perdas e consumo', r === 200);
await pg.reload(); await pg.waitForTimeout(3500);
await tocar('Abastecimento'); await pg.waitForTimeout(1200); await tocar('Saiu sem vender'); await pg.waitForTimeout(1800);
const L2 = (await pg.locator('[data-lista-sem-vender] [data-saida]').allInnerTexts()).map(limpa);
cobra('e aparece no topo da lista da Karen: Heineken, Quebrou, Sarah, Gerência', /^Heineken long neck Quebrou · 1 un · Sarah · lançado por Gerência .*R\$ 7,50$/.test(L2[0] || ''), L2[0]);

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
