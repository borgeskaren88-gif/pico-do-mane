// "EU QUERIA QUE O BOTÃO DE OCULTAR OCULTASSE TIPO TODAS AS INFORMAÇÕES."
//
// Ele trocava o valor por "R$ ••••" em sete lugares que eu lembrei de marcar —
// e deixava inteiro o "Pra olhar agora", que mostra em vermelho quantas contas
// venceram e quanto somam. Justamente o bloco que ela mais quer esconder
// quando tem alguém do lado do balcão.
//
// Marcar mais sete lugares seria consertar a instância, não o problema: o card
// que eu criar mês que vem nasce vazando de novo. A regra inverte — esconde o
// conteúdo INTEIRO e deixa de fora só o cabeçalho, onde mora o botão de trazer
// de volta.
//
// O QUE ESTE TESTE GUARDA:
//
//   - escondido esconde MESMO: nem o dinheiro, nem as contas vencidas, nem a
//     contagem de itens zerados sobram legíveis;
//   - o botão de voltar NÃO pode ser escondido junto. Tela que esconde o
//     próprio interruptor vira tela quebrada;
//   - e o texto borrado não pode continuar selecionável: num tablet que passa
//     de mão em mão, texto que se arrasta e copia é texto que não foi
//     escondido.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
const limpa = (s) => String(s || '').replace(/ /g, ' ');

const hoje = new Date().toISOString().slice(0, 10);
const p0 = await painel();
await gravar({ ...p0,
  negocio: { nome: 'Pico do Mané', dona: 'Karen', papeis: { dona: 'Karen' } },
  receitas: [{ id: 'r1', data: hoje, valor: '17777', fonte: 'Vendas' }],
  despesas: [{ id: 'd1', data: hoje, valor: '4321', categoria: 'Salários', desc: 'equipe' }],
  // Uma conta vencida, pra o "Pra olhar agora" existir. Sem ela não há corpo
  // pra esconder e o teste passaria sem medir nada.
  compras: [{ id: 'c1', data: '2026-09-01', produto: 'Gelo', fornecedor: 'Zé', quantidade: '1', valorUnit: '2701', vencimento: '2026-09-10', pago: '', categoria: 'Fornecedores de insumo' }],
  cardapio: [], fichas: [], estoque: [], diario: [],
});

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' });
const pg = await ctx.newPage();
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
pg.on('console', (m) => { const x = m.text(); if (m.type() === 'error' && !/status of 40/.test(x)) { console.log('[console]', x.slice(0, 160)); ruim++; } });

await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1600);
await pg.locator('button:text-is("Karen")').first().click();
await pg.locator('input[type="password"]').first().fill('Teste@123');
await pg.locator('button:has-text("Entrar")').first().click();
await pg.waitForTimeout(4200);

const texto = async () => limpa(await pg.locator('body').innerText());
const toque = async (rot) => pg.evaluate((r) => {
  const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === r);
  if (x) { x.click(); return true; }
  return false;
}, rot);
// O que o navegador REALMENTE desenha: se o conteúdo está borrado ou não.
const borrado = async () => pg.evaluate(() => {
  const alvo = [...document.querySelectorAll('div')]
    .find((d) => /blur\(/.test(getComputedStyle(d).filter || ''));
  if (!alvo) return null;
  const c = getComputedStyle(alvo);
  return { filtro: c.filter, selecao: c.userSelect || c.webkitUserSelect };
});

console.log('\n### COM A TELA ABERTA, TUDO APARECE');
let txt = await texto();
cobra('o botão diz "Ocultar"', /\bOcultar\b/.test(txt), (txt.match(/[^\n]*Ocultar[^\n]*/) || ['(não achou)'])[0]);
cobra('a receita do mês está visível', /R\$ 17\.777,00/.test(txt), (txt.match(/[^\n]*17\.777[^\n]*/) || ['(sumiu)'])[0]);
cobra('nada está borrado ainda', (await borrado()) === null);

console.log('\n### TOCOU EM OCULTAR: O CORPO SOME, O TÍTULO FICA');
cobra('tocou em Ocultar', await toque('Ocultar'));
await pg.waitForTimeout(800);
const b1 = await borrado();
cobra('o conteúdo ficou borrado', !!b1 && /blur\(/.test(b1.filtro), JSON.stringify(b1));
// Num tablet que passa de mão em mão, texto que se arrasta e copia é texto que
// não foi escondido.
cobra('e não dá pra selecionar e copiar por baixo', !!b1 && /none/.test(String(b1.selecao)), JSON.stringify(b1));
txt = await texto();
cobra('o valor virou pontinhos por baixo também', !/R\$ 17\.777,00/.test(txt), (txt.match(/[^\n]*17\.777[^\n]*/) || [''])[0]);

// Borrão NÃO some do innerText (ao contrário de visibility:hidden), então o
// texto continua "lá" pra quem lê o HTML. O que vale é o que o olho vê: se
// existe um pai borrado por cima.
const souBorrado = async (trecho) => pg.evaluate((t) => {
  const alvo = [...document.querySelectorAll('div,span,b')]
    .filter((e) => (e.textContent || '').includes(t) && e.children.length <= 3)
    .pop();
  if (!alvo) return null;
  let p = alvo;
  while (p) { if (/blur\(/.test(getComputedStyle(p).filter || '')) return true; p = p.parentElement; }
  return false;
}, trecho);

console.log('\n### E O QUE SOBRAVA VAZANDO TAMBÉM SAIU');
// A contagem de contas vencidas e a % da meta são conteúdo: dizem quanto o
// bar deve e quanto do mês já entrou.
cobra('a contagem de contas vencidas está coberta', (await souBorrado('conta vencida')) === true, String(await souBorrado('conta vencida')));
const metaPct = await pg.evaluate(() => {
  const t = [...document.querySelectorAll('text')].map((e) => (e.textContent || '').trim());
  return t.filter((x) => /%|•/.test(x));
});
cobra('a % da meta virou pontinhos', metaPct.some((x) => /•/.test(x)) && !metaPct.some((x) => /^\d+%$/.test(x)), JSON.stringify(metaPct));

console.log('\n### MAS O INTERRUPTOR NÃO PODE SE ESCONDER JUNTO');
// Tela que esconde o próprio botão de voltar vira tela quebrada.
cobra('o botão virou "Mostrar" e está legível', /\bMostrar\b/.test(txt), (txt.match(/[^\n]*Mostrar[^\n]*/) || ['(sumiu)'])[0]);
const botaoLimpo = await pg.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === 'Mostrar');
  if (!x) return null;
  // Nenhum pai dele pode estar borrado.
  let p = x;
  while (p) { if (/blur\(/.test(getComputedStyle(p).filter || '')) return false; p = p.parentElement; }
  return true;
});
cobra('e ele não está atrás do borrão', botaoLimpo === true, String(botaoLimpo));
// O cabeçalho também fica de fora: ela tem que saber em que tela está.
cobra('o cabeçalho continua legível', /Dashboard/.test(txt));
cobra('o nome dela continua na tela', /Karen/.test(txt), (txt.match(/[^\n]*Karen[^\n]*/) || ['(sumiu o nome)'])[0]);
cobra('e os títulos dos cartões também', /RECEITA DO MÊS/i.test(txt), (txt.match(/[^\n]*RECEITA DO M[^\n]*/i) || ['(sumiu o título)'])[0]);

console.log('\n### E VOLTA COMO ESTAVA');
cobra('tocou em Mostrar', await toque('Mostrar'));
await pg.waitForTimeout(800);
cobra('o borrão sumiu', (await borrado()) === null);
txt = await texto();
cobra('a receita voltou', /R\$ 17\.777,00/.test(txt), (txt.match(/[^\n]*17\.777[^\n]*/) || ['(não voltou)'])[0]);
cobra('os títulos seguem lá', /RECEITA DO MÊS/i.test(txt));

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
