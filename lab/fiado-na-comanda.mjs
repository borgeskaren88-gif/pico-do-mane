// "QUANDO EU ABRISSE UMA COMANDA EM NOME DE TAMARA — EU SEI QUE TEMOS UMA
// TAMARA QUE TEM CONTA FIADO AQUI — QUERIA QUE JÁ APARECESSE NA TELA QUANTO ELA
// AINDA PODE GASTAR, OU SE ELA JÁ ATINGIU O LIMITE."
//
// O app já sabia o limite e a dívida de cada cliente. Só contava no FIM: a
// mesa consumia a noite inteira e, na hora de fechar no fiado, vinha o erro —
// com a conta feita e o cliente olhando. A informação tem que chegar quando o
// nome é escrito, que é quando ainda dá pra decidir alguma coisa.
//
// O QUE ESTE TESTE GUARDA:
//
//   - ESCREVEU O NOME, APARECEU. Do jeito que se escreve no salão: "tamara",
//     minúsculo e sem sobrenome, acha a "Tamara Silva" do cadastro.
//   - A CONTA É: limite menos o que está em aberto. Venda já paga não conta, e
//     o que já foi abatido também não.
//   - AVISA QUANDO A CONTA DA MESA JÁ PASSOU do que cabe no fiado.
//   - LIMITE ESTOURADO DIZ QUE ESTOUROU — e diz a verdade sobre o bloqueio:
//     com ele desligado, o app ainda deixa fechar.
//   - NA DÚVIDA, NÃO ACUSA. Duas "Paula" no cadastro e um "Paula" na comanda:
//     não mostra nada. Dizer que a pessoa errada deve é pior que ficar calado.
//   - A TELA E O FECHAMENTO FAZEM A MESMA CONTA. Se a tela diz "pode fiar
//     R$ 120", fiar 120 passa e fiar 120,01 não.
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

const p0 = await painel();
await gravar({ ...p0,
  negocio: { nome: 'Pico do Mané', cidade: 'Florianópolis', dona: 'Karen', papeis: { dona: 'Karen', garcom: 'Atendimento' } },
  mesasQtd: 8,
  cardapio: [
    { id: 'hk', nome: 'Heineken', categoria: 'Bebidas', preco: '14', ativo: true },
    { id: 'cento', nome: 'Prato de cento e vinte', categoria: 'Cozinha', preco: '120', ativo: true },
    { id: 'centavo', nome: 'Um centavo', categoria: 'Cozinha', preco: '0,01', ativo: true },
  ],
  clientes: [
    { id: 'c1', nome: 'Tamara Silva', telefone: '', limite: '300', bloquear: true },
    { id: 'c2', nome: 'Igor Bittencourt', telefone: '', limite: '100', bloquear: true },
    { id: 'c3', nome: 'Bruno Costa', telefone: '', limite: '', bloquear: false },
    // Estourou, mas o bloqueio está desligado: o app avisa e deixa fechar.
    { id: 'c4', nome: 'Carla Dias', telefone: '', limite: '200', bloquear: false },
    // Duas Paulas: um "Paula" na comanda não diz qual das duas é.
    { id: 'c5', nome: 'Paula Mendes', telefone: '', limite: '150', bloquear: true },
    { id: 'c6', nome: 'Paula Rocha', telefone: '', limite: '150', bloquear: true },
    // Cliente sem limite e sem dívida: não há o que dizer.
    { id: 'c7', nome: 'Rita Lopes', telefone: '', limite: '', bloquear: false },
  ],
  estoque: [], fichas: [], receitas: [], despesas: [], compras: [], diario: [],
});
const venda = (id, nome, extra) => ({ chave: `${MARCA}venda:${id}`, valor: { id, data: HOJE, mesa: '9', nome, total: 0, fechadaEm: `${HOJE}T20:00:00`, itens: [], ...extra } });
for (const id of ['f1', 'f2', 'f3', 'f4', 'f5', 'f6']) await fetch(`${BANCO}?chave=eq.${MARCA}venda:${id}`, { method: 'DELETE' });
await fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([
  // Tamara: fiou 200, já abateu 20. Deve 180. De 300, sobram 120.
  venda('f1', 'Tamara Silva', { total: 200, fiado: 200, abatido: 20, pagamento: 'Fiado' }),
  // E uma conta dela JÁ PAGA, grande de propósito: não pode entrar na soma.
  venda('f2', 'Tamara Silva', { total: 500, fiado: 500, pagamento: 'Fiado', pago: true }),
  venda('f3', 'Igor Bittencourt', { total: 100, fiado: 100, pagamento: 'Fiado' }),
  venda('f4', 'Bruno Costa', { total: 45, fiado: 45, pagamento: 'Fiado' }),
  venda('f5', 'Carla Dias', { total: 250, fiado: 250, pagamento: 'Fiado' }),
  venda('f6', 'Paula Mendes', { total: 80, fiado: 80, pagamento: 'Fiado' }),
]) });

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const pg = await ctx.newPage();
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
pg.on('console', (m) => { const x = m.text(); if (m.type() === 'error' && !/status of 40/.test(x)) { console.log('[console]', x.slice(0, 160)); ruim++; } });

// Quem precisa disto no salão é o ATENDIMENTO — então o teste entra como ele.
await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1800);
await pg.locator('button:text-is("Atendimento")').first().click();
await pg.locator('input[type="password"]').first().fill('1234');
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
// A faixa do fiado, e só ela: o resto da tela também fala em reais.
const faixa = () => pg.evaluate(() => {
  const x = document.querySelector('[data-fiado]');
  return x ? { estado: x.getAttribute('data-fiado'), txt: (x.innerText || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim() } : null;
});
// Abre a mesa pela API (já com o nome) e entra nela pela tela.
const mesaCom = async (mesa, nome) => {
  const ab = await pedir('/api/comandas', { acao: 'abrir', mesa: String(mesa), pessoas: 2 });
  const id = ab.j.comanda.id;
  if (nome) await pedir('/api/comandas', { acao: 'infos', comandaId: id, nome });
  return id;
};
const entrarNaMesa = async (mesa) => {
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3200);
  await tocar('Comandas');
  await pg.waitForTimeout(1500);
  const ok = await pg.evaluate((m) => {
    // O quadradinho da mesa é "OCUPADA / 3 / nome / R$ ...", uma coisa por linha.
    const x = [...document.querySelectorAll('button')].find((e) => {
      const ls = (e.innerText || '').split('\n').map((l) => l.trim()).filter(Boolean);
      return /^ocupada$/i.test(ls[0] || '') && ls[1] === m;
    });
    if (x) { x.click(); return true; }
    return false;
  }, String(mesa));
  await pg.waitForTimeout(2200);
  return ok;
};

// ---------------------------------------------------------------------------
console.log('\n### ESCREVEU O NOME, APARECEU');
await mesaCom(1, '');
cobra('entrou na mesa 1', await entrarNaMesa(1));
cobra('sem nome, a tela não diz nada de fiado', (await faixa()) === null, JSON.stringify(await faixa()));
// Do jeito que se escreve no salão: minúsculo e sem sobrenome.
await pg.locator('input[placeholder="Ex.: João do balcão"]').first().fill('tamara');
await pg.locator('input[placeholder="Ex.: João do balcão"]').first().blur();
await pg.waitForTimeout(3200);
let f = await faixa();
cobra('a faixa do fiado apareceu', !!f, JSON.stringify(f));
cobra('achou a Tamara Silva do cadastro', /Tamara Silva/.test(f?.txt || ''), f?.txt || '(nada)');
// 300 de limite − (200 fiados − 20 abatidos) = 120. A conta paga de 500 fica fora.
cobra('diz que ela ainda pode fiar R$ 120,00', f?.estado === 'livre' && /ainda pode fiar R\$ 120,00/.test(f?.txt || ''), f?.txt || '(nada)');
cobra('e mostra de onde vem: limite e em aberto', /Limite R\$ 300,00 · em aberto R\$ 180,00/.test(f?.txt || ''), f?.txt || '(nada)');
cobra('com a mesa vazia, não avisa de conta passando', !/a mais do que cabe/.test(f?.txt || ''), f?.txt || '');

console.log('\n### A CONTA DA MESA PASSOU DO QUE CABE');
// 9 Heineken = 126,00 + 10% de serviço = 138,60. Cabiam 120.
const idT = (await pedir('/api/comandas')).j.comandas.find((c) => String(c.mesa) === '1').id;
for (let k = 0; k < 9; k += 1) await pedir('/api/comandas', { acao: 'add', comandaId: idT, cardapioId: 'hk' });
cobra('voltou na mesa 1', await entrarNaMesa(1));
f = await faixa();
cobra('avisa que a conta já está em R$ 138,60', /Esta conta já está em R\$ 138,60/.test(f?.txt || ''), f?.txt || '(nada)');
cobra('e que são R$ 18,60 a mais do que cabe', /são R\$ 18,60 a mais do que cabe no fiado dessa pessoa/.test(f?.txt || ''), f?.txt || '(nada)');

console.log('\n### QUEM JÁ ESTOUROU');
await mesaCom(2, 'Igor Bittencourt');
cobra('entrou na mesa 2', await entrarNaMesa(2));
f = await faixa();
cobra('diz que o Igor já atingiu o limite', f?.estado === 'estourou' && /Igor Bittencourt já atingiu o limite de fiado/.test(f?.txt || ''), f?.txt || '(nada)');
cobra('e que no fiado a conta não fecha', /no fiado esta conta não fecha/.test(f?.txt || ''), f?.txt || '(nada)');

await mesaCom(4, 'Carla Dias');
cobra('entrou na mesa 4', await entrarNaMesa(4));
f = await faixa();
// Dizer "não fecha" aqui seria mentira: com o bloqueio desligado, fecha.
cobra('Carla estourou, mas a tela diz a verdade: o bloqueio está desligado', f?.estado === 'estourou' && /o bloqueio está desligado/.test(f?.txt || '') && !/não fecha/.test(f?.txt || ''), f?.txt || '(nada)');

console.log('\n### DEVE, MAS NINGUÉM DEFINIU LIMITE');
await mesaCom(3, 'Bruno Costa');
cobra('entrou na mesa 3', await entrarNaMesa(3));
f = await faixa();
cobra('mostra os R$ 45,00 em aberto do Bruno', f?.estado === 'semLimite' && /Bruno Costa tem R\$ 45,00 em aberto no fiado/.test(f?.txt || ''), f?.txt || '(nada)');
cobra('e diz que não tem limite definido', /Essa conta não tem limite definido/.test(f?.txt || ''), f?.txt || '(nada)');

console.log('\n### NA DÚVIDA, NÃO ACUSA');
await mesaCom(5, 'Paula');
cobra('entrou na mesa 5', await entrarNaMesa(5));
// Paula Mendes deve 80; Paula Rocha não deve nada. Qual das duas sentou?
cobra('com duas Paulas no cadastro, "Paula" não mostra nada', (await faixa()) === null, JSON.stringify(await faixa()));
const quem = async (nome) => (await pedir(`/api/comandas?fiadoDe=${encodeURIComponent(nome)}`)).j;
cobra('já "Paula Mendes" inteiro acha a certa', (await quem('Paula Mendes')).fiado?.aberto === 80, JSON.stringify((await quem('Paula Mendes')).fiado));
cobra('nome que não é cliente não mostra nada', (await quem('Zeca do Pandeiro')).fiado === null);
cobra('cliente sem limite e sem dívida também não', (await quem('Rita Lopes')).fiado === null);
cobra('e sem login o servidor não responde', (await (await fetch(`${BASE}/api/comandas?fiadoDe=Tamara`)).status) === 401);

console.log('\n### A TELA E O FECHAMENTO FAZEM A MESMA CONTA');
// A tela disse: a Tamara pode fiar R$ 120,00. Então 120,01 não passa e 120 passa.
const idF = await mesaCom(6, 'Tamara Silva');
await pedir('/api/comandas', { acao: 'infos', comandaId: idF, servico: false });
await pedir('/api/comandas', { acao: 'add', comandaId: idF, cardapioId: 'cento' });
const cent = (await pedir('/api/comandas', { acao: 'add', comandaId: idF, cardapioId: 'centavo' })).j.comanda;
const umCentavoAMais = await pedir('/api/comandas', { acao: 'fechar', comandaId: idF, pessoas: 2, nome: 'Tamara Silva', pagamentos: [{ forma: 'Fiado', valor: 120.01 }] });
cobra('fiar R$ 120,01 é barrado', umCentavoAMais.status === 400 && /atingiu o limite de fiado/.test(umCentavoAMais.j?.erro || ''), JSON.stringify(umCentavoAMais.j).slice(0, 150));
const itemCentavo = (cent.itens || []).find((i) => i.cardapioId === 'centavo');
await pedir('/api/comandas', { acao: 'remover', comandaId: idF, itemId: itemCentavo.id });
const noLimite = await pedir('/api/comandas', { acao: 'fechar', comandaId: idF, pessoas: 2, nome: 'Tamara Silva', pagamentos: [{ forma: 'Fiado', valor: 120 }] });
cobra('fiar exatamente os R$ 120,00 passa', noLimite.status === 200 && noLimite.j?.ok === true, JSON.stringify(noLimite.j).slice(0, 150));
const agora = (await quem('tamara')).fiado;
cobra('e depois disso a tela diz que ela estourou', agora?.estado === 'estourou' && agora?.aberto === 300 && agora?.disponivel === 0, JSON.stringify(agora));

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
