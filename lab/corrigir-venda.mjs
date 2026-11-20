// "A SARAH LANÇOU DUAS DOSES NUMA COMANDA E FECHOU EM DINHEIRO, MAS VENDEU
// UMA SÓ. EU CONSIGO ARRUMAR ISSO?"
//
// Antes: só dava pra APAGAR a venda inteira (e sumia junto a dose vendida de
// verdade). Agora a dona corrige: tira a dose a mais. O que este teste guarda:
//
//   - a venda fica com 1 dose, e o total é refeito com o 10%;
//   - o valor sai do pagamento em dinheiro;
//   - a dose volta pro estoque (a garrafa não "bebeu" 50 ml a mais);
//   - o caixa daquele dia, já fechado, é refeito: a "falta" que a gaveta
//     acusava (porque o cliente pagou uma dose só) some;
//   - a receita "Fechamento do caixa", já lançada, desce junto;
//   - a venda guarda o rastro: o que foi tirado, quanto, quando e por quê;
//   - só diminui; só a dona; e o fiado é o primeiro a sair.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const linha = async (chave) => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}${chave}`)).json())[0]?.valor;
const linhas = async (pre) => (await (await fetch(`${BANCO}?select=chave,valor&chave=like.${MARCA}${pre}*`)).json()).map((x) => x.valor);
const gravarLinha = (chave, v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}${chave}`, valor: v }]) });
const limpa = (s) => String(s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const saldoJack = async () => Number(((await linha('painel')).estoque || []).find((x) => x.id === 'jack')?.saldo);

// ---------------------------------------------------------------------------
console.log('\n### A CONTA (direto da biblioteca)');
const fonte = readFileSync(new URL('../lib/corrigirVenda.js', import.meta.url), 'utf8');
const L = await import('data:text/javascript;base64,' + Buffer.from(fonte).toString('base64'));
{
  const v = { id: 'x', itens: [{ nome: 'Chopp', qtd: 3, preco: 10 }], subtotal: 30, servico: 3, desconto: 0, total: 33, fiado: 13, abatido: 0, pagamentos: [{ forma: 'Dinheiro', valor: 20 }, { forma: 'Fiado', valor: 13 }] };
  const r = L.corrigirVenda(v, [2]);
  cobra('tirou 1 chopp de uma conta meio dinheiro, meio fiado: sai do FIADO primeiro', r.venda && r.venda.total === 22 && r.reducoes.Fiado === 11 && !r.reducoes.Dinheiro && r.venda.fiado === 2, JSON.stringify(r.reducoes));
  const r2 = L.corrigirVenda({ ...v, abatido: 10 }, [1]);
  // tira 22: o fiado só desce até o que já foi pago dele (13 − 10 = 3 livres); o resto, 19, sai do dinheiro
  cobra('fiado já parcialmente pago: só tira o que ainda deve, o resto sai do dinheiro', r2.venda && r2.reducoes.Fiado === 3 && r2.reducoes.Dinheiro === 19 && r2.venda.fiado === 10 && r2.venda.pago === true, JSON.stringify(r2.reducoes));
  const d = L.corrigirVenda({ id: 'd', itens: [{ nome: 'A', qtd: 2, preco: 50 }], subtotal: 100, servico: 10, descontoPct: 10, desconto: 11, total: 99, pagamentos: [{ forma: 'Pix', valor: 99 }] }, [1]);
  cobra('desconto de 10% acompanha: 50 + 5 − 5,50 = 49,50', d.venda && d.venda.total === 49.5 && d.venda.desconto === 5.5 && d.reducoes.Pix === 49.5, JSON.stringify(d.venda && { total: d.venda.total, desconto: d.venda.desconto }));
  cobra('aumentar não pode', !!L.corrigirVenda(v, [4]).erro);
  // Esperto: tira 2 chopps e põe 1 caipirinha a mais — o total cai, mas a
  // caipirinha seria cobrada de quem já foi embora.
  const mix = { id: 'm', itens: [{ nome: 'Chopp', qtd: 3, preco: 10 }, { nome: 'Caipirinha', qtd: 1, preco: 15 }], subtotal: 45, servico: 0, total: 45, pagamentos: [{ forma: 'Pix', valor: 45 }] };
  cobra('nem aumentar um item escondido no meio de outro que diminuiu', /Só dá pra diminuir: Caipirinha/.test(L.corrigirVenda(mix, [1, 2]).erro || ''), L.corrigirVenda(mix, [1, 2]).erro || '(passou!)');
  const z = L.corrigirVenda(v, [0]);
  cobra('tudo em zero cancela a venda inteira (é a venda repetida): sai tudo, fiado primeiro', z.cancelada === true && z.venda.total === 0 && z.reducoes.Fiado === 13 && z.reducoes.Dinheiro === 20, JSON.stringify(z.reducoes || z.erro));
  cobra('sem mudança não pode', !!L.corrigirVenda(v, [3]).erro);
  const p = L.corrigirVenda({ id: 'p', itens: [{ nome: 'A', qtd: 2, preco: 20 }], subtotal: 40, servico: 0, total: 40, pagamentos: [{ forma: 'Pix', valor: 15, parcial: true }, { forma: 'Dinheiro', valor: 25 }] }, [1]);
  cobra('quem pagou parcial e foi embora fica por último: sai do dinheiro', p.venda && p.reducoes.Dinheiro === 20 && !p.reducoes.Pix, JSON.stringify(p.reducoes));
}

// ---------------------------------------------------------------------------
const p0 = (await linha('painel')) || {};
await gravarLinha('painel', { ...p0,
  negocio: { nome: 'Pico do Mané', cidade: 'Florianópolis', dona: 'Karen', papeis: { dona: 'Karen', garcom: 'Atendimento' } },
  mesasQtd: 6,
  cardapio: [{ id: 'dj', nome: "Dose Jack Daniel's", categoria: 'Doses', preco: '18', ativo: true }],
  fichas: [{ cardapioId: 'dj', itens: [{ estoqueId: 'jack', qtd: '50', unidade: 'ml' }] }],
  estoque: [{ id: 'jack', nome: "Jack Daniel's 1L", custo: '0,12', unidade: 'ml', saldo: '1000', categoria: 'Bebidas', movimentos: [] }],
  receitas: [], despesas: [], estoqueBaixas: [],
});
await gravarLinha('jornadas', { gerente: { nome: 'Sarah Lima', dias: [3, 4, 5, 6, 0], entrada: '16:00', saida: '00:00' } });

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const novo = async () => { const c = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); const pg = await c.newPage(); pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; }); pg.on('dialog', (d) => d.accept()); return pg; };
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

console.log('\n### A NOITE: A SARAH LANÇA 2 DOSES E FECHA EM DINHEIRO');
const dona = await novo();
await entrar(dona, 'dona', 'Teste@123');
await pedir(dona, '/api/acessos', { acao: 'senha', papel: 'gerente', nova: 'Sarah@2026' });
await pedir(dona, '/api/caixa', { acao: 'abrir', saldoInicial: '100' });
const sarah = await novo();
await entrar(sarah, 'gerente', 'Sarah@2026');
await pedir(sarah, '/api/ponto', { acao: 'entrada', nome: 'Sarah Lima' });
const ab = await pedir(sarah, '/api/comandas', { acao: 'abrir', mesa: '2', pessoas: 1 });
const cid = ab.j?.comanda?.id;
await pedir(sarah, '/api/comandas', { acao: 'add', comandaId: cid, cardapioId: 'dj' });
await pedir(sarah, '/api/comandas', { acao: 'add', comandaId: cid, cardapioId: 'dj' });
// 2 × 18 = 36 + 10% = 39,60, tudo em dinheiro.
const fe = await pedir(sarah, '/api/comandas', { acao: 'fechar', comandaId: cid, pessoas: 1, pagamentos: [{ forma: 'Dinheiro', valor: 39.6 }] });
cobra('fechou: R$ 39,60 em dinheiro', fe.status === 200, JSON.stringify(fe.j).slice(0, 120));
const venda = fe.j.venda;
// E a mesma dose fechada DE NOVO numa outra comanda: a venda repetida.
const ab3 = await pedir(sarah, '/api/comandas', { acao: 'abrir', mesa: '3', pessoas: 1 });
await pedir(sarah, '/api/comandas', { acao: 'add', comandaId: ab3.j?.comanda?.id, cardapioId: 'dj' });
const fe3 = await pedir(sarah, '/api/comandas', { acao: 'fechar', comandaId: ab3.j?.comanda?.id, pessoas: 1, pagamentos: [{ forma: 'Dinheiro', valor: 19.8 }] });
const repetida = fe3.j.venda;
cobra('e a repetida: mais R$ 19,80 em dinheiro', fe3.status === 200);
await dona.waitForTimeout(1200);
cobra('a garrafa baixou 150 ml (3 doses lançadas)', (await saldoJack()) === 850, String(await saldoJack()));
// O cliente pagou UMA dose: R$ 19,80. A gaveta tem 100 + 19,80.
const caixa = (await linhas('caixa:')).find((x) => x.aberto);
const fc = await pedir(dona, '/api/caixa', { acao: 'fechar', id: caixa.id, contado: 119.8 });
cobra('o caixa fechou acusando falta de R$ 39,60', fc.j?.caixa?.diferenca === -39.6, String(fc.j?.caixa?.diferenca));
// E a Karen já lançou o fechamento em Receitas (com os 59,40).
const pr = await linha('painel');
await gravarLinha('painel', { ...pr, receitas: [{ id: 'rc1', data: fc.j.caixa.abertoEm.slice(0, 10), categoria: 'Caixa', descricao: 'Fechamento do caixa', valor: 59.4, obs: '', refCaixa: caixa.id }] });

console.log('\n### SÓ A DONA CORRIGE, E SÓ PRA MENOS');
cobra('a Sarah não corrige venda', (await pedir(sarah, '/api/vendas', { acao: 'corrigir', id: venda.id, qtds: [1] })).status === 401);
cobra('aumentar: recusa', (await pedir(dona, '/api/vendas', { acao: 'corrigir', id: venda.id, qtds: [3] })).status === 400);

console.log('\n### NA TELA DA KAREN: VENDAS DO DIA → CORRIGIR');
await dona.reload({ waitUntil: 'domcontentloaded' }); await dona.waitForTimeout(3800);
await tocar(dona, 'Central de Operações'); await dona.waitForTimeout(1500);
await tocar(dona, 'Vendas do dia'); await dona.waitForTimeout(2000);
cobra('a venda da mesa 2 tem o botão "Corrigir venda"', (await dona.locator(`[data-corrigir="${venda.id}"]`).count()) === 1);
await dona.locator(`[data-corrigir="${venda.id}"]`).click(); await dona.waitForTimeout(400);
await dona.locator('[data-linha-correcao="0"] button[aria-label="menos"]').click(); await dona.waitForTimeout(300);
const prev = limpa(await dona.locator('[data-previa]').innerText());
cobra('a prévia: novo total R$ 19,80 (−R$ 19,80), sai do Dinheiro', /Novo total: R\$ 19,80 \(−R\$ 19,80\)/.test(prev) && /Dinheiro −R\$ 19,80/.test(prev), prev);
await dona.locator('[data-painel-correcao] input').fill('lançou 2, vendeu 1');
await tocar(dona, 'Salvar correção'); await dona.waitForTimeout(3500);
const msg = limpa(await dona.locator('[data-corrigido]').innerText().catch(() => ''));
cobra('a tela conta o que fez: total, dinheiro, estoque e caixa', /de R\$ 39,60 pra R\$ 19,80/.test(msg) && /Dinheiro −R\$ 19,80/.test(msg) && /voltou pro estoque: 50 ml de Jack Daniel's 1L/.test(msg) && /caixa daquele dia foi refeito/.test(msg), msg);

console.log('\n### O QUE MUDOU NO BANCO');
const v2 = (await linhas('venda:')).find((x) => x.id === venda.id);
cobra('a venda: 1 dose, R$ 19,80, Dinheiro R$ 19,80', v2.itens.reduce((s, it) => s + it.qtd, 0) === 1 && v2.total === 19.8 && v2.pagamentos.length === 1 && v2.pagamentos[0].forma === 'Dinheiro' && v2.pagamentos[0].valor === 19.8, JSON.stringify({ total: v2.total, pags: v2.pagamentos }));
cobra('com o 10% refeito: R$ 1,80', v2.servico === 1.8 && v2.subtotal === 18);
cobra('e o rastro: tirou 1× a dose, de 39,60 pra 19,80, "lançou 2, vendeu 1"', v2.correcoes?.length === 1 && v2.correcoes[0].de === 39.6 && v2.correcoes[0].para === 19.8 && v2.correcoes[0].motivo === 'lançou 2, vendeu 1' && v2.totalOriginal === 39.6, JSON.stringify(v2.correcoes));
cobra('a dose voltou pra garrafa: 900 ml', (await saldoJack()) === 900, String(await saldoJack()));
const mov = ((await linha('painel')).estoque.find((x) => x.id === 'jack').movimentos || [])[0] || {};
cobra('com o motivo "Estorno · venda corrigida (Mesa 2)"', mov.tipo === 'entrada' && mov.qtd === 50 && /Estorno · venda corrigida \(Mesa 2\)/.test(mov.motivo), JSON.stringify(mov));
const cx2 = await linha(`caixa:${caixa.id}`);
cobra('o caixa fechado: a falta caiu pra R$ 19,80 (falta a repetida)', cx2.dinheiroFinal === 139.6 && cx2.diferenca === -19.8 && cx2.entradas.Dinheiro === 39.6, JSON.stringify({ final: cx2.dinheiroFinal, dif: cx2.diferenca, din: cx2.entradas.Dinheiro, rec: cx2.recebido }));
await dona.waitForTimeout(2500);
const rc = ((await linha('painel')).receitas || []).find((x) => x.refCaixa === caixa.id) || {};
cobra('a receita do fechamento desceu pra R$ 39,60, com a observação', rc.valor === 39.6 && /corrigido −R\$\s19,80 \(venda da mesa 2\)/.test(String(rc.obs).replace(/ /g, ' ')), JSON.stringify(rc));
const rastro = limpa(await dona.locator('[data-correcao]').first().innerText().catch(() => ''));
// A data e a hora no fuso do Brasil: corrigir às 22h não pode aparecer como "amanhã".
const quandoBR = new Date(v2.correcoes[0].em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às');
cobra(`na tela, a venda mostra "Corrigida em ${quandoBR}: tirou 1× Dose Jack Daniel's (−R$ 19,80) — lançou 2, vendeu 1"`, rastro.includes(`Corrigida em ${quandoBR}:`) && /Corrigida em .*tirou 1× Dose Jack Daniel's \(−R\$ 19,80\) — lançou 2, vendeu 1/.test(rastro), rastro);

console.log('\n### A VENDA REPETIDA: TUDO EM ZERO CANCELA ELA INTEIRA');
// "Não deixa corrigir": na repetida só tem 1 dose, e não há o que diminuir
// sem zerar. Zerar agora cancela a venda inteira, com estoque, caixa e receita.
await dona.locator(`[data-corrigir="${repetida.id}"]`).click(); await dona.waitForTimeout(400);
await dona.locator('[data-painel-correcao] [data-linha-correcao="0"] button[aria-label="menos"]').click(); await dona.waitForTimeout(300);
const prevC = limpa(await dona.locator('[data-previa]').innerText());
cobra('a prévia avisa: "A venda inteira vai ser cancelada (R$ 19,80)", sai do Dinheiro', /A venda inteira vai ser cancelada \(R\$ 19,80\)/.test(prevC) && /Dinheiro −R\$ 19,80/.test(prevC), prevC);
cobra('e o botão vira "Cancelar a venda inteira"', await tocar(dona, 'Cancelar a venda inteira'));
await dona.waitForTimeout(3500);
const msgC = limpa(await dona.locator('[data-corrigido]').first().innerText().catch(() => ''));
cobra('a tela confirma: venda da mesa 3 cancelada', /Venda da mesa 3 cancelada \(R\$ 19,80\)/.test(msgC) && /voltou pro estoque/.test(msgC), msgC);
cobra('a repetida saiu das vendas', !(await linhas('venda:')).some((x) => x.id === repetida.id));
cobra('mas ficou guardada à parte, marcada como cancelada', (await linha(`vendaCancelada:${repetida.id}`))?.cancelada === true);
cobra('a dose dela voltou: a garrafa fica com 950 ml (só a dose vendida saiu)', (await saldoJack()) === 950, String(await saldoJack()));
const cx3 = await linha(`caixa:${caixa.id}`);
cobra('o caixa fechado agora bate: diferença zero, R$ 19,80 em dinheiro', cx3.diferenca === 0 && cx3.entradas.Dinheiro === 19.8 && cx3.dinheiroFinal === 119.8, JSON.stringify({ dif: cx3.diferenca, din: cx3.entradas.Dinheiro }));
await dona.waitForTimeout(2500);
const rc3 = ((await linha('painel')).receitas || []).find((x) => x.refCaixa === caixa.id) || {};
cobra('e a receita do fechamento: R$ 19,80', rc3.valor === 19.8, String(rc3.valor));

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
