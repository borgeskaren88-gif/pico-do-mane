// "AONDE FOI PARAR A OPÇÃO DE BAIXAR RELATÓRIO?"
//
// Não tinha ido a lugar nenhum: nunca esteve ali. O que existia era a planilha
// CSV, em Configurações, com os lançamentos crus — e isso não é o relatório.
// CSV entrega dado; o que ela quer levar pro contador é a CONCLUSÃO: o
// resultado do mês, a escada do dinheiro, o CMV, a margem.
//
// Quem imprime é o navegador. "Imprimir" no iPad e no iPhone já oferece
// "Salvar em PDF", e assim o papel é a MESMA tela que ela conferiu — gerador
// próprio de PDF seria mais um lugar pra conta discordar, e algumas centenas
// de KB baixadas no 4G do bar.
//
// O TESTE RODA EM MODO IMPRESSÃO, que é onde essas regras existem. Olhar isso
// na tela normal não prova nada: o CSS de impressão só liga quando o navegador
// vai imprimir, e um erro ali não aparece pra ninguém até a folha sair errada
// da impressora — quando ela já está na frente do contador.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
const limpa = (s) => String(s || '').replace(/ /g, ' ');

const HOJE = new Date('2026-10-20T15:00:00Z');

const p0 = await painel();
await gravar({ ...p0,
  negocio: { nome: 'Pico do Mané', cidade: 'Florianópolis', dona: 'Karen', papeis: { dona: 'Karen' } },
  receitas: [{ id: 'r1', data: '2026-09-10', valor: '20000', fonte: 'Vendas' }],
  despesas: [
    { id: 'd1', data: '2026-09-05', valor: '6000', categoria: 'Salários', desc: 'equipe' },
    { id: 'd2', data: '2026-09-08', valor: '5000', categoria: 'Fornecedores de insumo', desc: 'mercadoria' },
  ],
  cardapio: [], fichas: [], estoque: [], compras: [], diario: [],
});

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, serviceWorkers: 'block' });
const pg = await ctx.newPage();
await pg.clock.setFixedTime(HOJE);
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
pg.on('console', (m) => { const x = m.text(); if (m.type() === 'error' && !/status of 40/.test(x)) { console.log('[console]', x.slice(0, 160)); ruim++; } });

await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1600);
await pg.locator('button:text-is("Karen")').first().click();
await pg.locator('input[type="password"]').first().fill('Teste@123');
await pg.locator('button:has-text("Entrar")').first().click();
await pg.waitForTimeout(3800);

const texto = async () => limpa(await pg.locator('body').innerText());
const irPara = async (rot) => {
  const achou = await pg.evaluate((r) => {
    const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === r);
    if (x) { x.click(); return true; }
    return false;
  }, rot);
  await pg.waitForTimeout(1800);
  cobra(`achou o caminho "${rot}"`, achou);
};
// O que o navegador REALMENTE vai desenhar, com o CSS de impressão ligado.
const visivel = async (sel) => pg.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const c = getComputedStyle(el);
  return c.display !== 'none' && c.visibility !== 'hidden';
}, sel);

await irPara('Finanças');
await irPara('Relatórios');
await pg.waitForTimeout(1800);
// A tela abre no mês corrente; os lançamentos deste teste são de setembro.
await pg.evaluate(() => {
  const sel = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /Set\/2026/.test(o.textContent)));
  const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  if (sel) { set.call(sel, '2026-09'); sel.dispatchEvent(new Event('change', { bubbles: true })); }
});
await pg.waitForTimeout(1500);

console.log('\n### O SELETOR DE MÊS FALA PORTUGUÊS');
// Mostrava "2026-09" enquanto a página inteira escreve "Set/2026" — mesmo mês
// em duas línguas, e a crua logo no campo que ela usa pra escolher.
const rotulos = await pg.evaluate(() => {
  const sel = document.querySelector('select');
  return sel ? [...sel.options].map((o) => o.textContent) : [];
});
cobra('o mês aparece como "Set/2026"', rotulos.some((r) => /Set\/2026/.test(r)), JSON.stringify(rotulos));
cobra('e não como "2026-09"', !rotulos.some((r) => /^2026-09$/.test(String(r).trim())), JSON.stringify(rotulos));

console.log('\n### NA TELA: o botão existe e o cabeçalho de papel não atrapalha');
let txt = await texto();
cobra('tem o botão de baixar/imprimir', /Baixar \/ imprimir/i.test(txt), (txt.match(/[^\n]*Baixar \/ imprimir[^\n]*/i) || ['(não achou)'])[0]);
cobra('explica onde fica o "Salvar em PDF"', /Salvar em PDF/.test(txt));
cobra('o cabeçalho de papel está escondido', (await visivel('.so-impressao')) === false);
cobra('e o relatório aparece normalmente', /Relatórios/.test(txt));

console.log('\n### NO PAPEL: some o controle, aparece o cabeçalho');
// É aqui que o teste ganha o dinheiro dele. Erro no CSS de impressão não
// aparece pra ninguém até a folha sair errada da impressora.
await pg.emulateMedia({ media: 'print' });
await pg.waitForTimeout(500);
cobra('o cabeçalho de papel aparece', (await visivel('.so-impressao')) === true);
cobra('o bloco do relatório continua visível', (await visivel('.imprimivel')) === true);
cobra('o botão e o seletor de mês somem', (await visivel('.nao-imprimir')) === false);

const cabecalho = limpa(await pg.locator('.so-impressao').first().innerText());
cobra('o papel diz de qual bar é', /Pico do Mané/.test(cabecalho), cabecalho);
cobra('e de qual mês', /Set\/2026|Setembro/i.test(cabecalho), cabecalho);
cobra('e quando foi emitido', /emitido em 20\/10\/2026/.test(cabecalho), cabecalho);

console.log('\n### E O QUE ESTÁ FORA DO RELATÓRIO NÃO VAI PRA FOLHA');
// Menu, abas e barra de cima não interessam ao contador e comem a página.
const corpoNoPapel = limpa(await pg.locator('body').innerText());
cobra('o menu lateral some no papel', !/Log Operacional/.test(corpoNoPapel), (corpoNoPapel.match(/[^\n]*Log Operacional[^\n]*/) || [''])[0]);
cobra('a barra de abas some também', !/Despesa Rápida/.test(corpoNoPapel));

console.log('\n### OS NÚMEROS DO MÊS CONTINUAM NA FOLHA');
// De nada adianta a folha limpa se o relatório não estiver nela.
const noPapel = limpa(await pg.locator('.imprimivel').first().innerText());
cobra('o lucro do mês está lá', /R\$ 9\.000,00/.test(noPapel), (noPapel.match(/[^\n]*9\.000,00[^\n]*/) || ['(sumiu)'])[0]);
cobra('e o nome do mês também', /Set\/2026/.test(noPapel));

console.log('\n### E O PAPEL SAI CLARO, não com o fundo escuro da tela');
// Tema escuro impresso é ilegível e ainda torra a tinta do cartucho dela.
const cores = await pg.evaluate(() => {
  const r = getComputedStyle(document.documentElement);
  return { painel: r.getPropertyValue('--c-panel').trim(), texto: r.getPropertyValue('--c-text').trim() };
});
cobra('o fundo dos cartões vira branco', /^#f{3,6}$/i.test(cores.painel), JSON.stringify(cores));
cobra('e a letra vira escura (não a clara do tema escuro)', /^#10192b$/i.test(cores.texto), JSON.stringify(cores));

await pg.emulateMedia({ media: 'screen' });
await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
