// "DEIXA O CADERNO ASSIM."
//
// Ela mandou print de uma lista de cartões: faixa colorida na lateral,
// etiqueta colorida, título em negrito e, do lado direito, o estado. Era tela
// de outro programa — o que ela quis dizer foi a APARÊNCIA.
//
// O caderno dela era uma lista de linhas finas com uma bolinha de 17px pra
// mudar o estado. Virou um cartão por anotação.
//
// O QUE ESTE TESTE GUARDA, e por quê:
//
//   - O RECADO ESCONDIDO CONTINUA ESCONDIDO. Esta é a razão de o teste
//     existir. O texto de dentro da nota não é decoração: é o que ela escreve
//     sobre dinheiro e sobre gente, com o celular em cima do balcão. Redesenhar
//     a lista é exatamente o tipo de mudança que o põe na tela sem ninguém
//     perceber — e vazamento de texto não dá erro em lugar nenhum.
//   - O toque que muda o estado continua funcionando e continua GRAVANDO. A
//     bolinha virou etiqueta; se o clique tivesse ficado só no desenho, ela
//     tocaria, veria a cor mudar e perderia tudo no próximo carregamento.
//   - A faixa da lateral diz o estado pela cor, e cada estado tem a sua.
//   - O cartão cabe na largura do celular, e no tema claro a letra não some.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
const limpa = (s) => String(s || '').replace(/ /g, ' ');

const MIN = 60 * 1000, HORA = 60 * MIN, DIA = 24 * HORA;
const agora = Date.now();
// O texto de dentro da nota. Se esta palavra aparecer na página antes de ela
// tocar na anotação, o caderno deixou de ser dela.
const SEGREDO = 'SEGREDO-DO-CADERNO-7781';

const IDEIAS = [
  { id: 'n1', texto: 'Comprar guardanapo novo', status: 'ideia', criadoEm: agora - 4 * MIN },
  { id: 'n2', texto: 'Falar com o fornecedor da Coca', status: 'executando', criadoEm: agora - 26 * HORA },
  { id: 'n3', texto: 'Combinar aumento do Igor', status: 'delegado', criadoEm: agora - 3 * DIA, nota: SEGREDO },
  { id: 'n4', texto: 'Trocar o óleo da fritadeira', status: 'feito', criadoEm: agora - 40 * DIA },
];

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, serviceWorkers: 'block' });
const pg = await ctx.newPage();
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
pg.on('console', (m) => { const x = m.text(); if (m.type() === 'error' && !/status of 40/.test(x)) { console.log('[console]', x.slice(0, 160)); ruim++; } });

// O nome do acesso tem que estar no painel ANTES, senão a tela de entrada não
// tem em quem tocar.
const pZero = await painel();
await gravar({ ...pZero, negocio: { nome: 'Pico do Mané', cidade: 'Florianópolis', dona: 'Karen', papeis: { dona: 'Karen' } } });

// Mas as anotações vão DEPOIS de entrar: o login da dona reescreve o painel, e
// semear antes faria o app apagá-las antes de mostrar uma linha.
await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1800);
await pg.locator('button:text-is("Karen")').first().click();
await pg.locator('input[type="password"]').first().fill('Teste@123');
await pg.locator('button:has-text("Entrar")').first().click();
await pg.waitForTimeout(3800);

const p0 = await painel();
await gravar({ ...p0, ideias: IDEIAS });
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3800);

const achouBrain = await pg.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === 'Brain');
  if (x) { x.click(); return true; }
  return false;
});
cobra('achou a tela do Brain', achouBrain);
await pg.waitForTimeout(1800);

// COMO ACHAR O CARTÃO.
//
// Ele não tem classe pra agarrar, e eu não vou pôr uma só pro teste — produto
// não carrega andaime. Mas o cartão é o único div cujo primeiro filho é a
// faixa de 4px marcada como enfeite, e isso o identifica sem inventar nada.
await pg.evaluate(() => {
  window.__cartao = (titulo) => [...document.querySelectorAll('div')].find((d) => {
    const f = d.firstElementChild;
    if (!f || f.getAttribute('aria-hidden') !== 'true') return false;
    if (getComputedStyle(f).width !== '4px') return false;
    return (d.innerText || '').includes(titulo);
  });
  // A cor de uma variável do tema, já resolvida em rgb, pra poder comparar.
  window.__corDoTema = (v) => {
    const d = document.createElement('div');
    d.style.background = `var(${v})`;
    document.body.appendChild(d);
    const c = getComputedStyle(d).backgroundColor;
    d.remove();
    return c;
  };
});

const faixaDe = (t) => pg.evaluate((titulo) => {
  const el = window.__cartao(titulo);
  return el ? getComputedStyle(el.firstElementChild).backgroundColor : null;
}, t);
const etiqueta = (t) => pg.evaluate((titulo) => {
  const el = window.__cartao(titulo);
  if (!el) return null;
  const bt = el.querySelector('button');
  return bt ? (bt.innerText || '').trim() : null;
}, t);
const textoDo = async (t) => limpa(await pg.evaluate((titulo) => {
  const el = window.__cartao(titulo);
  return el ? (el.innerText || '') : '';
}, t));

console.log('\n### CADA ANOTAÇÃO VIROU UM CARTÃO COM FAIXA COLORIDA');
for (const i of IDEIAS) {
  const t = await pg.evaluate((titulo) => {
    const el = window.__cartao(titulo);
    if (!el) return null;
    return { faixa: getComputedStyle(el.firstElementChild).backgroundColor, raio: getComputedStyle(el).borderRadius };
  }, i.texto);
  cobra(`"${i.texto}" tem cartão`, t !== null);
  if (t) {
    cobra('  com canto arredondado', /^1[0-9]px/.test(t.raio), t.raio);
    cobra('  e faixa pintada', /^rgb\(/.test(t.faixa), t.faixa);
  }
}

console.log('\n### A COR DA FAIXA É O ESTADO — e cada estado tem a sua');
const cores = {};
for (const i of IDEIAS) cores[i.status] = await faixaDe(i.texto);
cobra('as quatro faixas são quatro cores diferentes', new Set(Object.values(cores).filter(Boolean)).size === 4, JSON.stringify(cores));
const verde = await pg.evaluate(() => window.__corDoTema('--c-green'));
cobra('a anotação feita usa o verde do tema', cores.feito === verde, `${cores.feito} vs ${verde}`);

console.log('\n### A ETIQUETA DIZ O ESTADO POR ESCRITO');
// A bolinha antiga não dizia nada: a cor era a única pista, e ela teria que
// decorar quatro cores pra saber em que pé está cada coisa.
cobra('a nova diz "Ideia"', (await etiqueta('Comprar guardanapo novo')) === 'Ideia', String(await etiqueta('Comprar guardanapo novo')));
cobra('a em andamento diz "Fazendo"', (await etiqueta('Falar com o fornecedor da Coca')) === 'Fazendo', String(await etiqueta('Falar com o fornecedor da Coca')));
cobra('a passada adiante diz "Passei pra alguém"', (await etiqueta('Combinar aumento do Igor')) === 'Passei pra alguém', String(await etiqueta('Combinar aumento do Igor')));
cobra('e a feita vem com o certinho', (await etiqueta('Trocar o óleo da fritadeira')) === '✓ Feito', String(await etiqueta('Trocar o óleo da fritadeira')));

console.log('\n### O TEMPO VEM EM LINGUAGEM DE GENTE');
// "20/10/2026 19:42" não responde a pergunta que ela faz olhando a lista, que
// é "isso aí é de agora ou está encostado faz tempo?".
cobra('"há 4 min" na de agora há pouco', /há 4 min/.test(await textoDo('Comprar guardanapo novo')), (await textoDo('Comprar guardanapo novo')).replace(/\n/g, ' | '));
cobra('"ontem" na de ontem', /ontem/.test(await textoDo('Falar com o fornecedor da Coca')), (await textoDo('Falar com o fornecedor da Coca')).replace(/\n/g, ' | '));
cobra('"há 3 dias" na de três dias', /há 3 dias/.test(await textoDo('Combinar aumento do Igor')), (await textoDo('Combinar aumento do Igor')).replace(/\n/g, ' | '));
cobra('e data no formato daqui na velha', /\d{2}\/\d{2}/.test(await textoDo('Trocar o óleo da fritadeira')), (await textoDo('Trocar o óleo da fritadeira')).replace(/\n/g, ' | '));

console.log('\n### O RECADO ESCONDIDO CONTINUA ESCONDIDO');
// A asserção que justifica o teste inteiro. Olho no HTML cru, não no texto
// visível: escondido com CSS ainda é escondido pro olho e aberto pra quem
// sabe olhar — e isso não serve pra ela.
const htmlAntes = await pg.content();
cobra('o texto de dentro não está na página', !htmlAntes.includes(SEGREDO));
const corpoAntes = limpa(await pg.locator('body').innerText());
cobra('nem na tela', !corpoAntes.includes(SEGREDO));
cobra('mas o cartão avisa que tem recado', /tem recado escondido/.test(corpoAntes), corpoAntes.slice(0, 120));

console.log('\n### E ABRE QUANDO ELA TOCA NO TÍTULO');
await pg.evaluate(() => {
  const el = window.__cartao('Combinar aumento do Igor');
  // O primeiro botão do cartão é a etiqueta de estado; o segundo é o título.
  const bts = el.querySelectorAll('button');
  bts[1].click();
});
await pg.waitForTimeout(900);
const corpoDepois = limpa(await pg.locator('body').innerText());
cobra('o recado aparece depois do toque', corpoDepois.includes(SEGREDO));
cobra('e aparecem os botões de mexer', /editar/.test(corpoDepois) && /apagar/.test(corpoDepois), corpoDepois.slice(0, 160));

console.log('\n### TOCAR NA ETIQUETA ANDA O ESTADO — E GRAVA');
// Se o clique tivesse ficado só no desenho, ela tocaria, veria a cor mudar e
// perderia tudo no próximo carregamento, sem um aviso sequer.
const faixaAntes = await faixaDe('Comprar guardanapo novo');
await pg.evaluate(() => { window.__cartao('Comprar guardanapo novo').querySelector('button').click(); });
await pg.waitForTimeout(500);
cobra('na tela, "Ideia" virou "Fazendo"', (await etiqueta('Comprar guardanapo novo')) === 'Fazendo', String(await etiqueta('Comprar guardanapo novo')));
cobra('e a faixa mudou de cor junto', (await faixaDe('Comprar guardanapo novo')) !== faixaAntes, `${faixaAntes} -> ${await faixaDe('Comprar guardanapo novo')}`);
await pg.waitForTimeout(2500);
const p1 = await painel();
const gravada = (p1.ideias || []).find((x) => x.id === 'n1');
cobra('e o banco guardou o estado novo', !!gravada && gravada.status === 'executando', JSON.stringify(gravada));

console.log('\n### O CARTÃO CABE NA TELA DO CELULAR DELA');
await pg.setViewportSize({ width: 390, height: 844 });
await pg.waitForTimeout(900);
const cabe = await pg.evaluate(() => {
  const el = window.__cartao('Falar com o fornecedor da Coca');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const p = el.parentElement.getBoundingClientRect();
  return { fora: Math.round(r.right - p.right), largura: Math.round(r.width) };
});
cobra('não passa da borda da coluna', !!cabe && cabe.fora <= 1, JSON.stringify(cabe));
cobra('e ocupa a largura do celular', !!cabe && cabe.largura > 240, JSON.stringify(cabe));

console.log('\n### E NO TEMA CLARO A LETRA NÃO SOME');
// Ela usa o claro de dia. Cartão com fundo próprio é justamente onde o tema
// claro costuma quebrar: fundo que continua escuro, ou letra que some nele.
await pg.evaluate(() => document.documentElement.setAttribute('data-theme', 'claro'));
await pg.waitForTimeout(700);
const claro = await pg.evaluate(() => {
  const el = window.__cartao('Comprar guardanapo novo');
  if (!el) return null;
  const bts = el.querySelectorAll('button');
  const tit = bts[1] ? bts[1].firstElementChild : null;
  return { fundo: getComputedStyle(el).backgroundColor, letra: tit ? getComputedStyle(tit).color : null };
});
const luz = (rgb) => { const m = String(rgb).match(/\d+/g); return m ? (Number(m[0]) * 299 + Number(m[1]) * 587 + Number(m[2]) * 114) / 1000 : null; };
cobra('o fundo do cartão fica claro', !!claro && luz(claro.fundo) > 200, JSON.stringify(claro));
cobra('e a letra do título fica escura', !!claro && luz(claro.letra) < 110, JSON.stringify(claro));

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
