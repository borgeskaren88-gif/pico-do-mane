// "TENHO UM ANALISTA NO BAR ME AJUDANDO A PÔR A CASA EM ORDEM E ELE PRECISA DE
// MUITAS INFORMAÇÕES QUE TEM NO PicoOS, PORÉM NÃO ACHEI UMA BOA FORMA DE MANDAR."
//
// O QUE ESTE TESTE GUARDA (com dados de mentira em que a resposta é conhecida):
//   - UM EXCEL SÓ, com uma aba por assunto que o analista pediu, e a aba
//     "Leia-me" e o "Mapa do pedido" (o que o PicoOS não tem).
//   - OS NÚMEROS BATEM com os critérios das telas: produto mais vendido, custo
//     pela ficha, margem, almoço por hora, faturamento = caixa + fiado, fluxo
//     de caixa com saldo acumulado, contas a pagar e a receber, melhor preço.
//   - O PRÓ-LABORE: entradas − saídas ANTES dos sócios, com as células amarelas
//     (nº de sócios e valor) ligadas por fórmula.
//   - PRIVACIDADE: telefone fora por padrão; nomes ocultáveis; só a dona baixa.
//   - A TELA: o cartão em Backup baixa o arquivo de verdade.
import ExcelJS from 'exceljs';
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const linha = async (chave) => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}${chave}`)).json())[0]?.valor;
const gravar = (chave, v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}${chave}`, valor: v }]) });

const agoraSP = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
if (agoraSP.getHours() < 6) agoraSP.setDate(agoraSP.getDate() - 1);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const somaDias = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const HOJE = iso(agoraSP);
const D1 = somaDias(HOJE, -2);
const D2 = somaDias(HOJE, -3);

// ---- o bar de mentira ----
const p0 = (await linha('painel')) || {};
await gravar('painel', {
  ...p0,
  negocio: { nome: 'Pico do Mané', cidade: 'Florianópolis', dona: 'Karen', papeis: {} },
  cardapio: [
    { id: 'c1', nome: 'Chopp Pilsen 300ml', categoria: 'Chopp', preco: '12', ativo: true },
    { id: 'c2', nome: 'Prato Executivo', categoria: 'Almoço', preco: '40', ativo: true },
    { id: 'c3', nome: 'Porção de Fritas', categoria: 'Petiscos', preco: '30', ativo: true },
    { id: 'c4', nome: 'Suco', categoria: 'Bebidas', preco: '10', ativo: true },
    { id: 'c5', nome: 'Camarão', categoria: 'Cozinha', preco: '80', ativo: true },
  ],
  estoque: [
    { id: 'barril', nome: 'Barril chopp', unidade: 'L', custo: '11,5', saldo: '60', minimo: '30', categoria: 'Bebidas' },
    { id: 'arroz', nome: 'Arroz', unidade: 'kg', custo: '6', saldo: '10', minimo: '5', categoria: 'Cozinha' },
    { id: 'frango', nome: 'Frango', unidade: 'kg', custo: '24', saldo: '8', minimo: '3', categoria: 'Cozinha' },
    { id: 'gelo', nome: 'Gelo', unidade: 'saco', custo: '8', saldo: '5', minimo: '2', categoria: 'Outros' },
  ],
  fichas: [
    { cardapioId: 'c1', itens: [{ estoqueId: 'barril', qtd: '0,3', unidade: 'L' }] },
    { cardapioId: 'c2', itens: [{ estoqueId: 'arroz', qtd: '0,2', unidade: 'kg' }, { estoqueId: 'frango', qtd: '0,25', unidade: 'kg' }] },
  ],
  receitas: [
    { id: 'r1', data: D1, categoria: 'Caixa', descricao: 'Caixa', valor: '300' },
    { id: 'r2', data: D2, categoria: 'Caixa', descricao: 'Caixa', valor: '200' },
    { id: 'r3', data: D2, categoria: 'Recebimento Atrasado', descricao: 'Fiado pago', valor: '40' },
    { id: 'r4', data: D2, categoria: 'Empréstimo/Aporte', descricao: 'Aporte', valor: '500' },
  ],
  despesas: [
    { id: 'd1', data: D1, categoria: 'Gelo', descricao: 'Gelo', valor: '80' },
    { id: 'd2', data: D1, categoria: 'Aluguel', descricao: 'Aluguel', valor: '1000' },
    { id: 'd3', data: D2, categoria: 'Pró-labore (sócios)', descricao: 'Retirada Karen', valor: '1500' },
    { id: 'd4', data: D2, categoria: 'Investimento', descricao: 'Freezer', valor: '300' },
  ],
  compras: [
    { id: 'n1', data: D1, fornecedor: 'Ambev', produto: 'Barril chopp', estoqueId: 'barril', quantidade: '2', valorUnit: '345', conteudo: '30', conteudoUnid: 'L', pago: 'Sim', formaPagto: 'À vista' },
    { id: 'n2', data: D2, fornecedor: 'Gelo Ilha', produto: 'Gelo', estoqueId: 'gelo', quantidade: '10', valorUnit: '8', pago: 'Não', formaPagto: 'Prazo', vencimento: somaDias(HOJE, 5), nota: 'NF1' },
    { id: 'n3', data: D2, fornecedor: 'Mercado X', produto: 'Arroz', estoqueId: 'arroz', quantidade: '10', valorUnit: '6', pago: 'Não', formaPagto: 'Prazo', vencimento: somaDias(HOJE, -3), nota: 'NF9' },
  ],
  cotacoes: [
    { id: 'q1', data: somaDias(HOJE, -1), produto: 'Barril chopp', fornecedor: 'Cervejaria Local', preco: '330', embalagem: 'L', conteudo: '30', prazoPag: '28', minPedido: '300', prazoEntrega: '2' },
  ],
  clientes: [{ id: 'cl1', nome: 'Tamara Silva', telefone: '48999990000', limite: '300' }],
  diario: [{ id: 'di1', data: D1, clima: 'Chuva', evento: 'Jogo do Brasil', receita: '300', nPedidos: '2', nota: 'Dia de jogo' }],
  tarefas: [],
});
const venda = (id, data, mesa, pessoas, fechada, itens, total, fiado, extra = {}) => gravar(`venda:${id}`, { id, data, mesa, pessoas, fechadaEm: fechada, itens, total, servico: 0, fiado, pago: !fiado, ...extra });
await venda('v1', D1, '1', 4, `${D1}T15:30:00.000Z`, [{ nome: 'Prato Executivo', cardapioId: 'c2', qtd: 2, preco: 40 }, { nome: 'Suco', cardapioId: 'c4', qtd: 2, preco: 10 }], 110, 0);
await venda('v2', D1, '2', 2, `${D1}T23:30:00.000Z`, [{ nome: 'Chopp Pilsen 300ml', cardapioId: 'c1', qtd: 10, preco: 12 }], 132, 50, { nome: 'Tamara Silva', pagamento: 'Fiado' });
await venda('v3', D2, '1', 3, `${D2}T16:00:00.000Z`, [{ nome: 'Prato Executivo', cardapioId: 'c2', qtd: 3, preco: 40 }], 132, 0);
await venda('v4', D2, '', 0, `${D2}T23:00:00.000Z`, [{ nome: 'Chopp Pilsen 300ml', cardapioId: 'c1', qtd: 5, preco: 12 }, { nome: 'Porção de Fritas', cardapioId: 'c3', qtd: 1, preco: 30 }], 90, 0, { balcao: true });

const entrar = async (papel, senha) => {
  const r = await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ papel, senha, lembrar: true }) });
  return (r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie')]).filter(Boolean).map((c) => c.split(';')[0]).join('; ');
};
const cookie = await entrar('dona', 'Teste@123');
const baixar = async (q = '', c = cookie) => { const r = await fetch(`${BASE}/api/analista${q}`, { headers: { cookie: c } }); return { r, buf: Buffer.from(await r.arrayBuffer()) }; };
const abrir = async (buf) => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf); return wb; };
const v = (c) => (c instanceof Date ? c.toISOString().slice(0, 10) : (c && typeof c === 'object' && 'result' in c ? c.result : (c && typeof c === 'object' && 'text' in c ? c.text : c)));
const tabela = (ws, primeira) => {
  let ini = -1;
  // (a linha 1 é o título da aba, que pode ter o mesmo nome do cabeçalho)
  ws.eachRow((row, n) => { if (ini < 0 && n > 1 && v(row.getCell(1).value) === primeira) ini = n; });
  const out = [];
  if (ini < 0) return out;
  for (let n = ini + 1; n <= ws.rowCount; n += 1) {
    const row = ws.getRow(n);
    if (!row.hasValues) break;
    out.push(row.values.slice(1).map(v));
  }
  return out;
};
const aprox = (a, b) => Math.abs(Number(a) - Number(b)) < 0.006;

console.log('\n— o arquivo —');
const { r: res, buf } = await baixar();
cobra('baixa um .xlsx de verdade (começa com PK, tipo e nome certos)', res.status === 200 && buf.slice(0, 2).toString() === 'PK' && /spreadsheetml/.test(res.headers.get('content-type') || '') && /picoos-pacote-analista-\d{4}-\d{2}-\d{2}\.xlsx/.test(res.headers.get('content-disposition') || ''), `${res.status} ${res.headers.get('content-disposition')}`);
const wb = await abrir(buf);
const nomes = wb.worksheets.map((w) => w.name);
const esperadas = ['Leia-me', 'Mapa do pedido', 'Resumo mensal', 'Fluxo de caixa diário', 'Pró-labore (simulação)', 'Retiradas dos sócios', 'Despesas', 'Custos por categoria', 'Contas a pagar', 'Contas a receber', 'Vendas por dia', 'Dia da semana', 'Maiores e menores dias', 'Almoço por dia', 'Vendas por hora', 'Vendas por produto', 'Bebidas e chopp', 'Cardápio', 'Fichas técnicas', 'Produtos e custos', 'Compras (notas)', 'Fornecedores', 'Cotações', 'Melhor preço', 'Clientes', 'Diário e clima'];
cobra('tem uma aba pra cada assunto que o analista pediu', esperadas.every((n) => nomes.includes(n)), nomes.filter((n) => !esperadas.includes(n)).join(',') + ' | faltam: ' + esperadas.filter((n) => !nomes.includes(n)).join(','));
cobra('"Leia-me" é a primeira aba e lista todas as outras', nomes[0] === 'Leia-me' && esperadas.slice(1).every((n) => tabela(wb.getWorksheet('Leia-me'), 'Aba').some((l) => l[0] === n)));
const mapa = tabela(wb.getWorksheet('Mapa do pedido'), 'Assunto');
cobra('o "Mapa do pedido" tem os 33 itens e marca o que o PicoOS não tem', mapa.length === 33 && mapa.filter((l) => /Não está no PicoOS/.test(l[2])).length === 10 && mapa.some((l) => /Turismo/.test(l[0])), `${mapa.length} itens`);
cobra('e a coluna "Tua resposta" existe, vazia, pra ela preencher', mapa.every((l) => !l[5]) && v(wb.getWorksheet('Mapa do pedido').getRow(wb.getWorksheet('Mapa do pedido').getRow(1).hasValues ? 5 : 5).getCell(1).value) !== undefined);

console.log('\n— vendas e produtos —');
const prod = tabela(wb.getWorksheet('Vendas por produto'), 'Posição (por receita)');
const por = (nome) => prod.find((l) => l[1] === nome) || [];
cobra('o mais vendido em R$ é o Prato Executivo: 5 un, R$ 200', por('Prato Executivo')[0] === 1 && aprox(por('Prato Executivo')[4], 5) && aprox(por('Prato Executivo')[5], 200), JSON.stringify(por('Prato Executivo')));
cobra('o chopp: 15 un, R$ 180, custo pela ficha R$ 51,75 e margem R$ 128,25 (71%)', aprox(por('Chopp Pilsen 300ml')[4], 15) && aprox(por('Chopp Pilsen 300ml')[5], 180) && aprox(por('Chopp Pilsen 300ml')[7], 51.75) && aprox(por('Chopp Pilsen 300ml')[8], 128.25) && aprox(por('Chopp Pilsen 300ml')[9], 128.25 / 180), JSON.stringify(por('Chopp Pilsen 300ml')));
cobra('o prato: custo R$ 36 (5 × R$ 7,20) e % da receita sobre o total de R$ 430', aprox(por('Prato Executivo')[7], 36) && aprox(por('Prato Executivo')[6], 200 / 430));
cobra('produto sem ficha fica sem custo, com o aviso', por('Porção de Fritas')[7] == null && /sem ficha/.test(por('Porção de Fritas')[11]) && /sem ficha/.test(por('Suco')[11]));
const camarao = prod[prod.length - 2]; // a última linha é o total
cobra('o item que nunca vendeu (Camarão) aparece no fim, com 0 — é a "menor saída"', camarao[1] === 'Camarão' && camarao[4] === 0 && /não vendeu/.test(camarao[11]), JSON.stringify(camarao));
const beb = tabela(wb.getWorksheet('Bebidas e chopp'), 'Produto');
cobra('bebidas: chopp e suco; o prato e a porção ficam de fora; chopp marcado', beb.some((l) => l[0] === 'Chopp Pilsen 300ml' && l[2] === 'Sim') && beb.some((l) => l[0] === 'Suco' && l[2] === 'Não') && !beb.some((l) => l[0] === 'Prato Executivo' || l[0] === 'Porção de Fritas'), beb.map((l) => `${l[0]}:${l[2]}`).join(' | '));

console.log('\n— almoço, hora e movimento —');
const alm = tabela(wb.getWorksheet('Almoço por dia'), 'Data');
cobra('almoço: 2 dias, 1 comanda cada (12h30 e 13h, hora de Florianópolis), R$ 242 no total', alm.length === 3 && alm.slice(0, 2).every((l) => l[2] === 1) && aprox(alm[2][4], 242) && aprox(v(wb.getWorksheet('Almoço por dia').getRow(1).getCell(1).value) ? 242 : 242, 242), JSON.stringify(alm.map((l) => [l[0], l[2], l[4]])));
const hora = tabela(wb.getWorksheet('Vendas por hora'), 'Hora');
cobra('por hora: 12h (1), 13h (1) e 20h (2 comandas, R$ 222) — a hora é a do pagamento, no fuso certo', hora.some((l) => l[0] === '12h' && l[1] === 1) && hora.some((l) => l[0] === '13h' && l[1] === 1) && hora.some((l) => l[0] === '20h' && l[1] === 2 && aprox(l[2], 222)), JSON.stringify(hora.map((l) => [l[0], l[1], l[2]])));
const dia = tabela(wb.getWorksheet('Vendas por dia'), 'Data');
const dd = (d) => dia.find((l) => l[0] === d) || [];
cobra(`faturamento do dia = caixa + fiado: ${D1} = R$ 350 (300 + 50); ${D2} = R$ 200 (o fiado recebido e o aporte não entram)`, aprox(dd(D1)[2], 350) && aprox(dd(D1)[3], 300) && aprox(dd(D1)[4], 50) && aprox(dd(D2)[2], 200), JSON.stringify([dd(D1).slice(0, 5), dd(D2).slice(0, 5)]));
cobra('comandas, balcão e pessoas do dia certos', dd(D1)[5] === 2 && dd(D1)[7] === 6 && dd(D2)[5] === 1 && dd(D2)[6] === 1 && dd(D2)[7] === 3, JSON.stringify([dd(D1).slice(5, 8), dd(D2).slice(5, 8)]));
cobra('cobre o período inteiro (dia sem lançamento aparece zerado)', dia.length >= 4 + 1 && dia.some((l) => l[0] === HOJE && l[2] === 0));
const mm = tabela(wb.getWorksheet('Maiores e menores dias'), 'Lista');
cobra('maior dia = ' + D1 + ' (R$ 350); menor dia = ' + D2 + ' (R$ 200)', mm.find((l) => l[0] === 'Maiores dias' && l[1] === 1)[2] === D1 && aprox(mm.find((l) => l[0] === 'Maiores dias' && l[1] === 1)[4], 350) && mm.find((l) => l[0] === 'Menores dias' && l[1] === 1)[2] === D2);
cobra('"Dia da semana" tem os 7 dias, segunda a domingo', tabela(wb.getWorksheet('Dia da semana'), 'Dia da semana').map((l) => l[0]).join() === 'Segunda-Feira,Terça-Feira,Quarta-Feira,Quinta-Feira,Sexta-Feira,Sábado,Domingo');

console.log('\n— financeiro —');
const fx = tabela(wb.getWorksheet('Fluxo de caixa diário'), 'Data');
const fd = (d) => fx.find((l) => l[0] === d) || [];
cobra(`fluxo ${D1}: entradas R$ 300, saídas R$ 1.080 (gelo + aluguel), saldo −R$ 780`, aprox(fd(D1)[5], 300) && aprox(fd(D1)[9], 1080) && aprox(fd(D1)[10], -780), JSON.stringify(fd(D1)));
cobra(`fluxo ${D2}: entradas R$ 740 (caixa 200 + fiado pago 40 + aporte 500), saídas R$ 1.800 (retirada 1.500 + investimento 300)`, aprox(fd(D2)[5], 740) && aprox(fd(D2)[3], 40) && aprox(fd(D2)[4], 500) && aprox(fd(D2)[7], 1500) && aprox(fd(D2)[8], 300) && aprox(fd(D2)[9], 1800), JSON.stringify(fd(D2)));
cobra('o saldo acumulado fecha em −R$ 1.840 e é fórmula (muda se editar)', aprox(fx[fx.length - 2][11], -1840) && typeof wb.getWorksheet('Fluxo de caixa diário').getRow(8 + 1).getCell(12).value === 'object');
const desp = tabela(wb.getWorksheet('Despesas'), 'Data');
cobra('despesas classificadas: gelo = variável, aluguel = fixa, pró-labore = retirada, freezer = fora da operação', desp.find((l) => l[1] === 'Gelo')[2] === 'Custo variável' && desp.find((l) => l[1] === 'Aluguel')[2] === 'Despesa fixa/operacional' && /Retirada dos sócios \(pró-labore\)/.test(desp.find((l) => l[1] === 'Pró-labore (sócios)')[2]) && desp.find((l) => l[1] === 'Investimento')[2] === 'Fora da operação');
const ret = tabela(wb.getWorksheet('Retiradas dos sócios'), 'Data');
cobra('retiradas dos sócios: só o pró-labore de R$ 1.500', ret.length === 2 && aprox(ret[0][3], 1500) && /Total/.test(ret[1][0]));
const pl = wb.getWorksheet('Pró-labore (simulação)');
const plt = tabela(pl, 'Mês');
const total = plt[plt.length - 1];
cobra('pró-labore: entradas R$ 540 (sem o aporte), saídas operacionais R$ 1.080, resultado antes dos sócios −R$ 540', aprox(total[2], 540) && aprox(total[3], 1080) && aprox(total[4], -540), JSON.stringify(total));
cobra('retiradas lançadas R$ 1.500; proposto 2 sócios × R$ 2.000 = R$ 4.000 por mês; sobra negativa → "Não" cobre', aprox(total[5], 1500) && plt.slice(0, -1).every((l) => aprox(l[6], 4000)) && plt.slice(0, -1).some((l) => l[10] === 'Não'));
cobra('as células amarelas (sócios = 2, valor = R$ 2.000) alimentam a fórmula', v(pl.getCell('B4').value) === 2 && v(pl.getCell('B5').value) === 2000 && String((plt.length ? pl.getRow(8).getCell(7).value.formula : '')) === '$B$4*$B$5', String(pl.getRow(8).getCell(7).value && pl.getRow(8).getCell(7).value.formula));
const cp = tabela(wb.getWorksheet('Contas a pagar'), 'Vencimento');
cobra('contas a pagar: a vencida (Mercado X, R$ 60, há 3 dias) vem antes da que vence em 5 dias (Gelo Ilha, R$ 80)', cp[0][1] === 'Mercado X' && /Vencida há 3/.test(cp[0][4]) && cp[1][1] === 'Gelo Ilha' && /Vence em 5/.test(cp[1][4]) && aprox(cp[2][3], 140), JSON.stringify(cp.map((l) => [l[1], l[3], l[4]])));
const cr = tabela(wb.getWorksheet('Contas a receber'), 'Cliente');
cobra('contas a receber: Tamara Silva, R$ 50, 1 comanda, com o limite do cadastro (R$ 300)', cr[0][0] === 'Tamara Silva' && aprox(cr[0][1], 50) && cr[0][2] === 1 && aprox(cr[0][6], 300), JSON.stringify(cr[0]));

console.log('\n— produtos, fichas e fornecedores —');
const card = tabela(wb.getWorksheet('Cardápio'), 'Item');
const cc = (n) => card.find((l) => l[0] === n) || [];
cobra('cardápio: chopp R$ 12 com margem R$ 8,55 (fórmula); porção sem ficha fica sem custo', aprox(cc('Chopp Pilsen 300ml')[2], 12) && aprox(cc('Chopp Pilsen 300ml')[5], 8.55) && cc('Porção de Fritas')[7] === 'Não' && cc('Porção de Fritas')[4] == null);
const fi = tabela(wb.getWorksheet('Fichas técnicas'), 'Prato');
cobra('fichas: o prato tem frango (R$ 6,00) e arroz (R$ 1,20) e o total R$ 7,20 na primeira linha', fi.filter((l) => l[0] === 'Prato Executivo').length === 2 && fi.find((l) => l[3] === 'Frango' && aprox(l[6], 6)) && fi.find((l) => l[3] === 'Arroz' && aprox(l[6], 1.2)) && aprox(fi.find((l) => l[0] === 'Prato Executivo' && l[7] != null)[7], 7.2), JSON.stringify(fi.filter((l) => l[0] === 'Prato Executivo')));
const pc = tabela(wb.getWorksheet('Produtos e custos'), 'Item');
cobra('produtos e custos: barril a R$ 11,50/L, valor parado R$ 690, último fornecedor Ambev', aprox(pc.find((l) => l[0] === 'Barril chopp')[3], 11.5) && aprox(pc.find((l) => l[0] === 'Barril chopp')[5], 690) && pc.find((l) => l[0] === 'Barril chopp')[7] === 'Ambev', JSON.stringify(pc.find((l) => l[0] === 'Barril chopp')));
const nt = tabela(wb.getWorksheet('Compras (notas)'), 'Data');
cobra('notas: 3 linhas, total R$ 830 (690 + 80 + 60)', nt.length === 4 && aprox(nt[3][5], 830), JSON.stringify(nt.map((l) => l[5])));
const fo = tabela(wb.getWorksheet('Fornecedores'), 'Fornecedor');
cobra('fornecedores: Ambev lidera com R$ 690 (83%)', fo[0][0] === 'Ambev' && aprox(fo[0][2], 690) && aprox(fo[0][3], 690 / 830));
const cot = tabela(wb.getWorksheet('Cotações'), 'Data');
cobra('cotação do chopp: R$ 330 por 30 L = R$ 11,00 o litro, pagamento em 28 dias, mínimo R$ 300, entrega em 2 dias', cot[0][1] === 'Barril chopp' && aprox(cot[0][6], 11) && cot[0][7] === 28 && aprox(cot[0][8], 300) && cot[0][9] === 2 && cot[0][10] === 'Sim', JSON.stringify(cot[0]));
const mp = tabela(wb.getWorksheet('Melhor preço'), 'Produto');
cobra('melhor preço do barril: Cervejaria Local a R$ 11,00/L (cotação), contra a última compra na Ambev a R$ 11,50/L', mp[0][0] === 'Barril chopp' && mp[0][2] === 'Cervejaria Local' && aprox(mp[0][3], 11) && mp[0][4] === 'Cotação' && mp[0][8] === 'Ambev' && aprox(mp[0][9], 11.5), JSON.stringify(mp[0]));
const di = tabela(wb.getWorksheet('Diário e clima'), 'Data');
cobra('diário: o clima "Chuva" do dia do jogo', di[0][2] === 'Chuva' && di[0][3] === 'Jogo do Brasil');
const rm = tabela(wb.getWorksheet('Resumo mensal'), 'Mês');
cobra('resumo mensal: faturamento do período R$ 550 (350 + 200) e saldo R$ −1.840', aprox(rm[rm.length - 1][2], 550) && aprox(rm[rm.length - 1][9], -1840), JSON.stringify(rm[rm.length - 1]));

console.log('\n— privacidade —');
const cl = tabela(wb.getWorksheet('Clientes'), 'Nome');
cobra('por padrão NÃO vai telefone de cliente', !JSON.stringify(cl).includes('48999990000') && wb.getWorksheet('Clientes').getRow(wb.getWorksheet('Clientes').getRow(1).hasValues ? 4 : 4).values.every((x) => x !== 'Telefone'));
const wbTel = await abrir((await baixar('?telefones=1')).buf);
cobra('marcando "telefone", o telefone vai', JSON.stringify(tabela(wbTel.getWorksheet('Clientes'), 'Nome')).includes('48999990000'));
const wbSem = await abrir((await baixar('?nomes=0&telefones=1')).buf);
const crSem = tabela(wbSem.getWorksheet('Contas a receber'), 'Cliente');
cobra('sem nomes: o fiado vira "Cliente 1", não há aba de Clientes e nenhum nome vaza', crSem[0][0] === 'Cliente 1' && !wbSem.getWorksheet('Clientes') && !JSON.stringify(crSem).includes('Tamara'));
cobra('salário de cada funcionário nunca vai (nem a aba, nem a palavra)', !nomes.some((n) => /salári|folha|ponto/i.test(n)));
const garcom = await entrar('garcom', '1234');
cobra('o garçom não baixa (401)', (await baixar('', garcom)).r.status === 401);
cobra('sem login não baixa (401)', (await baixar('', '')).r.status === 401);
const wb12 = await abrir((await baixar('?meses=12')).buf);
cobra('períodos: 12 meses e "tudo" também funcionam', (await abrir((await baixar('?meses=0')).buf)).worksheets.length === wb12.worksheets.length && wb12.worksheets.length === nomes.length);

console.log('\n— a tela —');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
await ctx.addInitScript(() => { try { sessionStorage.setItem('pdm_sessaoAtiva', '1'); } catch { /* */ } });
await ctx.addCookies(cookie.split('; ').map((kv) => { const i = kv.indexOf('='); return { name: kv.slice(0, i), value: kv.slice(i + 1), url: BASE }; }));
const pg = await ctx.newPage();
await pg.goto(BASE);
await pg.evaluate(() => localStorage.setItem('picoos-tab', 'backup'));
await pg.goto(BASE);
await pg.waitForSelector('[data-pacote-analista]', { timeout: 20000 });
const cartao = await pg.locator('[data-pacote-analista]').innerText();
cobra('o cartão "Pacote para o analista" está em Backup, com o aviso de privacidade', /Pacote para o analista/i.test(cartao) && /manda só pra quem precisa/i.test(cartao));
cobra('telefone vem desmarcado e nomes marcado', !(await pg.locator('[data-pacote-telefones]').isChecked()) && (await pg.locator('[data-pacote-nomes]').isChecked()));
const [down] = await Promise.all([pg.waitForEvent('download', { timeout: 40000 }), pg.click('[data-pacote-analista] button:has-text("Baixar o Excel")')]);
const caminho = await down.path();
const wbTela = await abrir((await import('fs')).readFileSync(caminho));
cobra('tocar em "Baixar o Excel" baixa a planilha, com todas as abas', /^picoos-pacote-analista-\d{4}-\d{2}-\d{2}\.xlsx$/.test(down.suggestedFilename()) && wbTela.worksheets.length === nomes.length, down.suggestedFilename());
await pg.waitForSelector('[data-pacote-msg]');
cobra('e avisa pra abrir a aba "Leia-me" primeiro', /Leia-me/.test(await pg.locator('[data-pacote-msg]').innerText()));

await browser.close();
console.log(ruim ? `\n${ruim} RUIM` : '\nTUDO OK');
process.exit(ruim ? 1 : 0);
