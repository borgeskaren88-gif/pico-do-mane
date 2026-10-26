// "MEU ATENDENTE NÃO ESTÁ SE DANDO BEM COM O FIADO — ELE ACABA CRIANDO NOVAS
//  CONTAS SENDO QUE SÃO CONTAS ANTIGAS."
//
// Os prints dela mostram a lista de fiados com:
//
//     igor .............. R$  44,00      Igor Bittencourt ... R$ 112,28
//     Gabreil ........... R$  47,30      Gabriel Bittencourt  R$ 504,00
//
// A mesma pessoa duas vezes, e num dos casos com o nome escrito errado. Cada
// nome novo abre uma dívida própria: o limite de fiado do cliente não vale, a
// cobrança por WhatsApp some (a conta nova não tem telefone), e o total que
// ela acha que tem a receber está repartido em dois lugares.
//
// A porta era o "Outro (digitar)" na hora de fechar a conta.
//
// O QUE ESTE TESTE GUARDA:
//
//   - o atendimento escolhe da lista e só: sem campo livre, sem "Outro";
//   - a DONA continua podendo criar, que é o pedido dela;
//   - e a tranca de verdade está NO SERVIDOR. Esta é a parte que importa:
//     tela some com cache velho, com uma mudança minha amanhã, ou com quem
//     souber mandar o pedido direto. Regra de quem pode criar dívida tem que
//     morar onde o dado é gravado.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
const por = (chave, valor) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}${chave}`, valor }]) });
const limpa = (s) => String(s || '').replace(/ /g, ' ');

const p0 = await painel();
await gravar({ ...p0,
  // Os nomes dela, do print.
  clientes: [{ id: 'cli1', nome: 'Gabriel Bittencourt', telefone: '48999990000' }, { id: 'cli2', nome: 'Igor Bittencourt' }],
  cardapio: [{ id: 'c1', nome: 'Chopp Pilsen', categoria: 'Chopp / Cerveja', preco: '12,00', ativo: true }],
  fichas: [], estoque: [], compras: [], receitas: [], despesas: [], diario: [],
});
const mesa = (id) => ({ id, mesa: id.replace('m', ''), status: 'aberta', pessoas: 2, abertaEm: new Date().toISOString(),
  itens: [{ id: 'i1', cardapioId: 'c1', nome: 'Chopp Pilsen', preco: 12, qtd: 1 }] });
await por('comanda:m4', mesa('m4'));
await por('comanda:m5', mesa('m5'));

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

// Fecha uma mesa no fiado pelo MESMO caminho que o botão usa.
const fecharNoFiado = (pg, comandaId, nome) => pg.evaluate(async ([id, n]) => {
  const res = await fetch('/api/comandas', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acao: 'fechar', comandaId: id, nome: n, pessoas: 2, pagamentos: [{ forma: 'Fiado', valor: 13.2 }] }),
  });
  return { ok: res.ok, status: res.status, corpo: await res.json().catch(() => ({})) };
}, [comandaId, nome]);

// A dona tem a senha dela; o atendimento ainda entra com a de fábrica.
const SENHA = { Dona: 'Teste@123', Atendimento: '1234' };
const entrar = async (pg, quem) => {
  await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1800);
  await pg.locator(`button:text-is("${quem}")`).first().click();
  await pg.locator('input[type="password"]').first().fill(SENHA[quem]);
  await pg.locator('button:has-text("Entrar")').first().click();
  await pg.waitForTimeout(3800);
  // Entrou mesmo? Sem isto, um login que falha vira "o servidor recusou" e o
  // teste passa pelo motivo errado — foi o que acabou de acontecer comigo.
  const aindaNoLogin = await pg.evaluate(() => !!document.querySelector('input[type="password"]'));
  cobra(`entrou como ${quem}`, !aindaNoLogin);
};

console.log('\n### NO ATENDIMENTO, NÃO EXISTE MAIS "OUTRO (DIGITAR)"');
{
  const ctx = await b.newContext({ viewport: { width: 420, height: 950 }, serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 140)); ruim++; });
  await entrar(pg, 'Atendimento');
  // "Você bateu seu ponto?" abre por cima e come os toques.
  await pg.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => /Agora não/.test(e.innerText || '')); if (x) x.click(); });
  await pg.waitForTimeout(800);
  // O atendimento abre no Ponto, não nas Comandas.
  cobra('foi pra aba Comandas', await pg.evaluate(() => {
    const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === 'Comandas');
    if (x) { x.click(); return true; }
    return false;
  }));
  await pg.waitForTimeout(4200);
  // Abre a mesa ocupada e vai pro fechamento.
  const esperaBotao = async (re, rot) => {
    try {
      await pg.waitForFunction((fonte) => [...document.querySelectorAll('button')]
        .some((e) => new RegExp(fonte, 'i').test((e.innerText || '').trim())), re.source, { timeout: 15000 });
    } catch { cobra(rot, false, '(o botão nunca apareceu)'); return false; }
    const ok = await pg.evaluate((fonte) => {
      const x = [...document.querySelectorAll('button')].find((e) => new RegExp(fonte, 'i').test((e.innerText || '').trim()));
      if (x) { x.click(); return true; }
      return false;
    }, re.source);
    cobra(rot, ok);
    return ok;
  };
  await esperaBotao(/^ocupada/, 'achou a mesa ocupada');
  await esperaBotao(/Fechar conta/, 'tocou em Fechar conta');
  // E espera o formulário existir antes de mexer nele.
  try {
    await pg.waitForFunction(() => [...document.querySelectorAll('span,div')]
      .some((d) => (d.textContent || '').trim() === 'Fiado' && d.children.length === 0), null, { timeout: 15000 });
  } catch { cobra('o formulário de fechar abriu', false, '(não abriu)'); }
  // Põe o valor no Fiado pra o campo do nome aparecer.
  // O rótulo "Fiado" é um <span>, não um <div> — procurar só div não achava
  // nada e o campo do nome nunca aparecia.
  cobra('preencheu o valor no Fiado', await pg.evaluate(() => {
    const lin = [...document.querySelectorAll('span,div')].find((d) => (d.textContent || '').trim() === 'Fiado' && d.children.length === 0);
    const linha = lin && lin.parentElement;
    const inp = linha && linha.querySelector('input');
    if (!inp) return false;
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(inp, '13,20'); inp.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }));
  await pg.waitForTimeout(1200);
  const txt = limpa(await pg.locator('body').innerText());
  cobra('chegou na pergunta de quem ficou devendo', /Quem ficou devendo/i.test(txt), txt.slice(0, 80));
  const opcoes = await pg.evaluate(() => {
    const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /Bittencourt/.test(o.textContent)));
    return s ? [...s.options].map((o) => o.textContent) : [];
  });
  cobra('a lista de clientes está lá', opcoes.some((o) => /Gabriel Bittencourt/.test(o)), JSON.stringify(opcoes));
  cobra('mas NÃO tem "Outro (digitar)"', !opcoes.some((o) => /Outro \(digitar\)/.test(o)), JSON.stringify(opcoes));
  cobra('nem campo livre pra escrever nome', await pg.evaluate(() => ![...document.querySelectorAll('input')].some((i) => /Nome do cliente/.test(i.placeholder || ''))));
  cobra('e explica o que fazer quando o nome não está na lista', /Chama a dona pra cadastrar/i.test(txt), (txt.match(/[^\n]*Chama a dona[^\n]*/i) || ['(não explica)'])[0]);
  cobra('avisando pra não escrever parecido', /Não escreve parecido/i.test(txt));

  console.log('\n### E A TRANCA DE VERDADE ESTÁ NO SERVIDOR');
  // Mesmo mandando o pedido direto, como faria uma tela velha em cache.
  // A mesa tem que chegar aqui ABERTA. Sem conferir, um "não encontrada"
  // passaria por "o servidor recusou" e o teste daria certo pelo motivo errado.
  const antesM4 = (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}comanda:m4`)).json())[0]?.valor;
  cobra('a mesa 4 ainda está aberta pro teste', antesM4 && antesM4.status === 'aberta', JSON.stringify(antesM4 && { status: antesM4.status }));
  const r = await fecharNoFiado(pg, 'm4', 'Gabreil');
  cobra('o servidor recusou o nome novo', r.ok === false || r.corpo.ok === false, JSON.stringify(r).slice(0, 160));
  cobra('e diz por quê, com o nome', /não está na lista de clientes/i.test(JSON.stringify(r.corpo)), JSON.stringify(r.corpo).slice(0, 160));
  cobra('dizendo quem cadastra', /quem cadastra cliente novo é a dona/i.test(JSON.stringify(r.corpo)));
  const ainda = (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}comanda:m4`)).json())[0]?.valor;
  cobra('a mesa continua aberta, não virou dívida', ainda && ainda.status === 'aberta', JSON.stringify(ainda && ainda.status));

  console.log('\n### MAS NOME QUE JÁ EXISTE PASSA NORMAL');
  // Travar demais seria trocar um problema por outro: o atendimento precisa
  // conseguir fechar no fiado de quem já é cliente.
  const r2 = await fecharNoFiado(pg, 'm4', 'Gabriel Bittencourt');
  cobra('fechou no fiado do cliente certo', r2.ok === true && r2.corpo.ok !== false, JSON.stringify(r2).slice(0, 160));
  await ctx.close();
}

console.log('\n### E A DONA CONTINUA PODENDO CRIAR, QUE É O PEDIDO DELA');
{
  const ctx = await b.newContext({ viewport: { width: 420, height: 950 }, serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 140)); ruim++; });
  await entrar(pg, 'Dona');
  await pg.waitForTimeout(1500);
  await por('comanda:m5', mesa('m5'));
  const r3 = await fecharNoFiado(pg, 'm5', 'Cliente Novo da Dona');
  cobra('a dona fecha no fiado com nome novo', r3.ok === true && r3.corpo.ok !== false, JSON.stringify(r3).slice(0, 160));
  await ctx.close();
}

console.log('\n### JUNTAR AS DUAS CONTAS QUE JÁ ESTÃO LÁ');
// Travar a criação impede que apareçam mais; não conserta as que existem — e
// elas fazem estrago enquanto existirem: o limite de fiado do Gabriel não
// conta a dívida que ficou na conta do "Gabreil".
//
// A CONTA FEITA NA MÃO:
//   Gabreil .............. R$ 47,30  (1 compra, nome errado)
//   Gabriel Bittencourt .. R$ 50,00  (1 compra)
//   juntas ............... R$ 97,30 numa conta só, com as duas datas
{
  const ctx = await b.newContext({ viewport: { width: 420, height: 950 }, serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 140)); ruim++; });
  await entrar(pg, 'Dona');
  // Semeia DEPOIS do login: entrar como dona abre o Dashboard, que regrava o
  // painel e apagava o cadastro que eu tinha posto antes.
  await pg.waitForTimeout(1500);
  {
    const pAgora = await painel();
    await gravar({ ...pAgora, clientes: [
      { id: 'cli1', nome: 'Gabriel Bittencourt', telefone: '48999990000' },
      { id: 'cli2', nome: 'Igor Bittencourt' },
      // A conta errada foi criada antes da trava existir, e está lá.
      { id: 'cli3', nome: 'Gabreil' },
    ] });
  }
  await por('venda:errada', { id: 'errada', data: '2026-10-20', nome: 'Gabreil', mesa: '7',
    total: 47.3, fiado: 47.3, pagamento: 'Fiado', pago: false, fechadaEm: '2026-10-20T23:00:00.000Z', itens: [] });
  await por('venda:certa', { id: 'certa', data: '2026-10-21', nome: 'Gabriel Bittencourt', mesa: '8',
    total: 50, fiado: 50, pagamento: 'Fiado', pago: false, fechadaEm: '2026-10-21T23:00:00.000Z', itens: [] });
  const juntar = (de, para) => pg.evaluate(async ([d, p2]) => {
    const res = await fetch('/api/vendas', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'juntar', de: d, para: p2 }) });
    return { ok: res.ok, corpo: await res.json().catch(() => ({})) };
  }, [de, para]);

  const r = await juntar('Gabreil', 'Gabriel Bittencourt');
  cobra('juntou as duas contas', r.ok === true && r.corpo.ok === true, JSON.stringify(r.corpo).slice(0, 140));
  cobra('moveu 1 compra', r.corpo.movidas === 1, JSON.stringify(r.corpo));

  const errada = (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}venda:errada`)).json())[0]?.valor;
  cobra('a compra agora é do nome certo', errada && errada.nome === 'Gabriel Bittencourt', JSON.stringify(errada && { nome: errada.nome }));
  // RENOMEAR, NÃO SOMAR: a compra continua inteira, com data e valor.
  cobra('e continua inteira, com a data dela', errada && errada.data === '2026-10-20' && Number(errada.total) === 47.3, JSON.stringify(errada && { data: errada.data, total: errada.total }));
  // Operação que mexe em dívida de gente sem deixar rastro é operação que não
  // se escreve: dá pra achar e voltar.
  cobra('guardou de onde veio', errada && errada.nomeAntes === 'Gabreil', JSON.stringify(errada && { nomeAntes: errada.nomeAntes }));
  const certa = (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}venda:certa`)).json())[0]?.valor;
  cobra('a compra que já estava certa não foi tocada', certa && !certa.nomeAntes && Number(certa.total) === 50, JSON.stringify(certa && { nomeAntes: certa.nomeAntes }));

  console.log('\n### E O NOME ERRADO SAI DO CADASTRO DE CLIENTES');
  // Senão ela torna a escolher ele na próxima conta e o problema volta.
  const pFim = await painel();
  cobra('"Gabreil" saiu da lista', !(pFim.clientes || []).some((c) => /Gabreil/.test(c.nome || '')), JSON.stringify((pFim.clientes || []).map((c) => c.nome)));
  cobra('e "Gabriel Bittencourt" continua lá', (pFim.clientes || []).some((c) => c.nome === 'Gabriel Bittencourt'), JSON.stringify((pFim.clientes || []).map((c) => c.nome)));

  console.log('\n### E DÁ PRA VOLTAR ATRÁS — "caso uma hora eu erre também"');
  // Rastro que só eu consigo ler não serve pra quem está com o bar aberto. Se
  // ela juntar as duas contas trocadas, tem que voltar sozinha, na hora.
  const desjuntar = (de, para) => pg.evaluate(async ([d, p2]) => {
    const res = await fetch('/api/vendas', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'desjuntar', de: d, para: p2 }) });
    return { ok: res.ok, corpo: await res.json().catch(() => ({})) };
  }, [de, para]);
  const rd = await desjuntar('Gabreil', 'Gabriel Bittencourt');
  cobra('desfez o juntar', rd.corpo.ok === true, JSON.stringify(rd.corpo));
  cobra('devolveu a compra', rd.corpo.voltaram === 1, JSON.stringify(rd.corpo));
  const volta = (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}venda:errada`)).json())[0]?.valor;
  cobra('a compra voltou pro nome de antes', volta && volta.nome === 'Gabreil', JSON.stringify(volta && { nome: volta.nome }));
  cobra('com a data e o valor intactos', volta && volta.data === '2026-10-20' && Number(volta.total) === 47.3, JSON.stringify(volta && { data: volta.data, total: volta.total }));
  cobra('e sem rastro sobrando', volta && !volta.nomeAntes, JSON.stringify(volta && { nomeAntes: volta.nomeAntes }));
  // A compra que nunca foi movida não pode voltar junto.
  const intacta = (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}venda:certa`)).json())[0]?.valor;
  cobra('a que já era do nome certo não se mexeu', intacta && intacta.nome === 'Gabriel Bittencourt', JSON.stringify(intacta && { nome: intacta.nome }));
  // Desfazer duas vezes não pode inventar devolução.
  const rd2 = await desjuntar('Gabreil', 'Gabriel Bittencourt');
  cobra('desfazer de novo não acha nada pra devolver', rd2.corpo.ok === false, JSON.stringify(rd2.corpo));

  console.log('\n### E NÃO DEIXA JUNTAR UMA CONTA COM ELA MESMA');
  const r2 = await juntar('Gabriel Bittencourt', 'gabriel bittencourt');
  cobra('recusou', r2.corpo.ok === false, JSON.stringify(r2.corpo));
  cobra('dizendo por quê', /mesma conta/i.test(JSON.stringify(r2.corpo)), JSON.stringify(r2.corpo));
  await ctx.close();
}

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
