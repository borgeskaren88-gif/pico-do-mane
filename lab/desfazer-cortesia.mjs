// "FUI COLOCAR UMA HEINEKEN COMO CORTESIA E ACABEI COLOCANDO 11, COMO REVERTO
// ISTO?"
//
// Não revertia. Lançou, saiu do estoque, acabou. A tela não mostrava nem o que
// tinha acabado de ser lançado — nenhuma lista, nenhum botão, nenhum caminho
// de volta. Um dedo errado no teclado tirava dez cervejas do estoque pra
// sempre, e ela só ia descobrir na contagem.
//
// O QUE ESTE TESTE GUARDA:
//
//   - A VOLTA É EXATA. Devolve o que SAIU, não o que foi pedido. A baixa trava
//     no zero: quem tem 5 e tira 11 fica com 0, não com -6. Devolvendo os 11,
//     o estoque sairia MAIOR do que era antes do erro — um conserto que
//     estraga mais que o estrago.
//   - SÓ A DONA DESFAZ. O atendimento lança cortesia, mas desfazer é apagar
//     rastro de saída de mercadoria. Botão escondido não é trava: o teste bate
//     direto no servidor com o crachá do garçom.
//   - E O LANÇAMENTO SOME DA LISTA. Desfazer duas vezes devolveria o dobro.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
const limpa = (s) => String(s || '').replace(/ /g, ' ');
const saldoDe = async (id) => {
  const it = ((await painel()).estoque || []).find((x) => x.id === id);
  return it ? Number(it.saldo) : null;
};
const linhasCortesia = async () => (await (await fetch(`${BANCO}?select=chave,valor&chave=like.${MARCA}cortesia:*`)).json());

const p0 = await painel();
await gravar({ ...p0,
  negocio: { nome: 'Pico do Mané', cidade: 'Florianópolis', dona: 'Karen', papeis: { dona: 'Karen', garcom: 'Atendimento' } },
  estoque: [
    { id: 'hei', nome: 'Heineken long neck', custo: '7,50', unidade: 'un', saldo: '40', categoria: 'Bebidas' },
    // O caso que estraga o conserto ingênuo: tem 5, ela tira 11. Saem 5.
    { id: 'lim', nome: 'Limão', custo: '8', unidade: 'kg', saldo: '5', categoria: 'Cozinha' },
  ],
  cardapio: [
    { id: 'cv', nome: 'Heineken', categoria: 'Bebidas', preco: '14', ativo: true },
    { id: 'cp', nome: 'Caipirinha', categoria: 'Drinks', preco: '22', ativo: true },
  ],
  fichas: [
    { cardapioId: 'cv', itens: [{ estoqueId: 'hei', qtd: '1', unidade: 'un' }] },
    { cardapioId: 'cp', itens: [{ estoqueId: 'lim', qtd: '1', unidade: 'kg' }] },
  ],
  receitas: [], despesas: [], compras: [], diario: [],
});

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const pg = await ctx.newPage();
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
pg.on('console', (m) => { const x = m.text(); if (m.type() === 'error' && !/status of 40/.test(x)) { console.log('[console]', x.slice(0, 160)); ruim++; } });

await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1800);
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
  await pg.waitForTimeout(1700);
  cobra(`achou o caminho "${rot}"`, achou);
};
const toque = async (t) => pg.evaluate((x) => {
  const lim = (s) => String(s || '').replace(/ /g, ' ').trim().toLowerCase();
  const b2 = [...document.querySelectorAll('button')].find((e) => lim(e.innerText) === x.toLowerCase());
  if (b2) { b2.click(); return true; }
  return false;
}, t);
const escrever = (valor) => pg.evaluate((v) => {
  const lab = [...document.querySelectorAll('div')].find((d) => d.children.length === 0 && /^quantas\?$/i.test((d.textContent || '').trim()));
  const campo = lab && lab.parentElement ? lab.parentElement.querySelector('input') : null;
  if (!campo) return false;
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(campo, v);
  campo.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}, valor);

await irPara('Abastecimento');
await irPara('Cortesia / Consumo');
await pg.waitForTimeout(1200);

console.log('\n### O DEDO ERRADO: 11 HEINEKEN EM VEZ DE 1');
cobra('o estoque começa com 40', (await saldoDe('hei')) === 40, String(await saldoDe('hei')));
cobra('escolheu a Heineken', await toque('Heineken'));
await pg.waitForTimeout(600);
cobra('digitou 11', await escrever('11'));
await pg.waitForTimeout(400);
cobra('registrou a cortesia', await toque('Registrar cortesia'));
await pg.waitForTimeout(2600);
cobra('saíram 11 do estoque', (await saldoDe('hei')) === 29, String(await saldoDe('hei')));

console.log('\n### A TELA MOSTRA O QUE ACABOU DE SER LANÇADO');
// Metade do conserto é ela VER o erro na hora, em vez de descobrir na
// contagem do mês.
let txt = await texto();
// SÓ O PEDAÇO DA LISTA. A mensagem de sucesso também diz "11× Heineken", e
// procurar no corpo inteiro faria a asserção passar mesmo sem lista nenhuma —
// que é justamente o defeito que eu estou consertando.
const naLista = (t) => {
  const i = t.toLowerCase().indexOf('últimos lançamentos');
  return i < 0 ? '' : t.slice(i);
};
cobra('tem a lista dos últimos lançamentos', /últimos lançamentos/i.test(txt), (txt.match(/[^\n]*ltimos lan[^\n]*/i) || ['(não tem lista)'])[0]);
cobra('com o 11× Heineken nela', /11× Heineken/.test(naLista(txt)), naLista(txt).split('\n').slice(0, 4).join(' | ') || '(lista vazia)');
cobra('e um botão de desfazer', /desfazer/i.test(naLista(txt)));

console.log('\n### DESFAZENDO: O QUE SAIU VOLTA');
pg.on('dialog', (d) => d.accept());
cobra('tocou em desfazer', await toque('desfazer'));
await pg.waitForTimeout(2800);
cobra('o estoque voltou pros 40', (await saldoDe('hei')) === 40, String(await saldoDe('hei')));
txt = await texto();
cobra('a tela confirma', /Desfeito: 11× Heineken/.test(txt), (txt.match(/[^\n]*Desfeito[^\n]*/) || ['(não disse nada)'])[0]);
// Desfazer duas vezes devolveria o dobro.
cobra('e o lançamento sumiu da lista', !/11× Heineken/.test(naLista(txt)), naLista(txt).split('\n').slice(0, 4).join(' | ') || '(lista sumiu junto, que é o certo com um só)');
cobra('a linha saiu do banco', (await linhasCortesia()).length === 0, JSON.stringify((await linhasCortesia()).map((l) => l.chave)));

console.log('\n### A VOLTA É DO QUE SAIU, NÃO DO QUE FOI PEDIDO');
// O Limão tem 5 e ela pede 11. A baixa trava no zero: saem 5. Devolvendo 11,
// o estoque sairia com 6 — mais do que tinha antes do erro. Conserto que
// estraga mais que o estrago.
cobra('escolheu a Caipirinha', await toque('Caipirinha'));
await pg.waitForTimeout(600);
cobra('digitou 11 de novo', await escrever('11'));
await pg.waitForTimeout(400);
cobra('registrou', await toque('Registrar cortesia'));
await pg.waitForTimeout(2600);
cobra('o limão zerou (não ficou negativo)', (await saldoDe('lim')) === 0, String(await saldoDe('lim')));
cobra('tocou em desfazer', await toque('desfazer'));
await pg.waitForTimeout(2800);
cobra('e voltou pros 5 que tinha — não pra 11', (await saldoDe('lim')) === 5, String(await saldoDe('lim')));

console.log('\n### SÓ A DONA DESFAZ');
// Botão escondido não é trava. Aqui eu bato direto no servidor com o crachá
// do atendimento, que é o que um navegador consegue fazer sozinho.
await toque('Heineken');
await pg.waitForTimeout(500);
await escrever('2');
await pg.waitForTimeout(300);
await toque('Registrar cortesia');
await pg.waitForTimeout(2600);
const pendente = (await linhasCortesia())[0];
const idPendente = pendente && pendente.valor && pendente.valor.id;
cobra('tem um lançamento pra tentar desfazer', !!idPendente, String(idPendente));
cobra('e saíram 2 do estoque', (await saldoDe('hei')) === 38, String(await saldoDe('hei')));

const ctxG = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const gar = await ctxG.newPage();
await gar.goto(BASE, { waitUntil: 'domcontentloaded' });
await gar.waitForTimeout(1600);
await gar.locator('button:text-is("Atendimento")').first().click();
await gar.locator('input[type="password"]').first().fill('1234');
await gar.locator('button:has-text("Entrar")').first().click();
await gar.waitForTimeout(3800);
const tentativa = await gar.evaluate(async (id) => {
  const r = await fetch('/api/comandas', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acao: 'desfazerCortesia', id }),
  });
  return { status: r.status, corpo: (await r.text()).slice(0, 120) };
}, idPendente);
cobra('o servidor recusa o atendimento', tentativa.status === 403, JSON.stringify(tentativa));
cobra('e o estoque não se mexeu', (await saldoDe('hei')) === 38, String(await saldoDe('hei')));
cobra('o lançamento continua lá', (await linhasCortesia()).length === 1);
await ctxG.close();

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
