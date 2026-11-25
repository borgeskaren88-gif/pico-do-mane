import {
  num, numQtd, limparNome, addDays, ymOf, weekday, DIAS, totalCompra, fiadoDaVenda, abertoDaVenda,
  ehBalcao, diaOperacional, agruparContasAbertas,
  CUSTO_VARIAVEL, DESPESA_OPERACIONAL, DESPESA_NAO_OPERACIONAL, FONTES_NAO_OPERACIONAL,
} from './util';
import { cmvDoMes, estoqueNoMes } from './cmv';
import { custoDaFicha, custoDosSabores, chaveNome } from './estoque';
import { dadosDoFornecedor, precoUnitario } from './cotacao';
import { analisarPrecos } from './inteligenciaCompras';
import { chaveCliente } from './clientes';

// O PACOTE PARA O ANALISTA — tudo que o PicoOS sabe, numa planilha só.
//
// "Estou com um analista no bar me ajudando a pôr a casa em ordem e ele precisa
// de muitas informações que tem no PicoOS, porém não achei uma boa forma de
// mandar essas coisas pra ele."
//
// Aqui o app faz o que ela faria à mão em uma semana: junta vendas, caixa,
// despesas, compras, fichas e cardápio, conta tudo com os MESMOS critérios das
// telas (por isso os números batem) e organiza em abas, cada uma respondendo a
// uma coisa que o analista pediu. A primeira aba explica o que tem em cada uma
// e os critérios; a segunda diz, item por item do pedido dele, o que está no
// pacote e o que o PicoOS não tem (e que só ela pode responder).
//
// Sem banco e sem Excel: devolve a descrição das abas, que lib/pacoteXlsx.js
// escreve e que o teste confere sozinho.

const ATRASADO = 'Recebimento Atrasado';
const PRO_LABORE = 'Pró-labore (sócios)';
const DISTRIBUICAO = 'Distribuição de lucros';
// Almoço: comanda FECHADA (paga) entre 11h e 17h, hora de Florianópolis. A
// hora é a do pagamento, não a do pedido — é a melhor aproximação que o
// sistema tem, e a aba "Vendas por hora" deixa o analista traçar a própria linha.
export const ALMOCO = { de: 11, ate: 17 };
const RE_CAT_BEBIDA = /bebida|chop|cerveja|drink|dose|vinho|destilad|refri|suco|[aá]gua|coquetel|caipi|licor|whisk|espumante/i;
const RE_CHOPP = /chop/i;

const arr = (v) => (Array.isArray(v) ? v : []);
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;
const soma = (l, f) => r2(l.reduce((s, x) => s + (Number(f(x)) || 0), 0));
const diasEntre = (ini, fim) => { const l = []; for (let d = ini; d <= fim; d = addDays(d, 1)) l.push(d); return l; };
const mesesEntre = (ini, fim) => { const l = []; for (let m = ymOf(ini); m <= ymOf(fim); m = ymOf(addDays(`${m}-28`, 5))) l.push(m); return l; };
const rotuloMes = (ym) => `${ym.slice(5, 7)}/${ym.slice(0, 4)}`;
const fmtHora = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false });
export const horaDe = (iso) => {
  const t = Date.parse(iso || '');
  if (!t) return null;
  const h = parseInt(fmtHora.format(new Date(t)), 10);
  return Number.isFinite(h) ? h % 24 : null;
};

export function tipoDaDespesa(cat) {
  if (cat === PRO_LABORE) return 'Retirada dos sócios (pró-labore)';
  if (cat === DISTRIBUICAO) return 'Retirada dos sócios (lucros)';
  if (DESPESA_NAO_OPERACIONAL.includes(cat)) return 'Fora da operação';
  if (CUSTO_VARIAVEL.includes(cat)) return 'Custo variável';
  if (DESPESA_OPERACIONAL.includes(cat)) return 'Despesa fixa/operacional';
  return 'Outras (categoria fora do padrão)';
}
const ehRetirada = (t) => t.startsWith('Retirada');
const ehForaDaOperacao = (t) => t === 'Fora da operação';

export function periodoDoPacote(meses, hoje, primeiraData) {
  const n = Math.floor(Number(meses));
  if (!(n >= 1)) return { ini: primeiraData || hoje, fim: hoje };
  let ym = ymOf(hoje);
  for (let i = 1; i < n; i += 1) ym = ymOf(addDays(`${ym}-01`, -1));
  return { ini: `${ym}-01`, fim: hoje };
}

// O pedido do analista, item por item: o que está no pacote, em parte, ou fora
// do PicoOS (o que só ela pode responder).
const SIM = 'Está no pacote';
const PARTE = 'Em parte';
const NAO = 'Não está no PicoOS — tu respondes';
const MAPA = [
  ['1. Vendas', 'Relatório de vendas por produto, itens mais e menos vendidos', SIM, 'Vendas por produto', 'Do mais vendido (em R$) ao menos vendido; itens do cardápio sem nenhuma venda no período aparecem no fim, com 0.'],
  ['1. Vendas', 'Histórico de vendas de almoço, por dia', SIM, 'Almoço por dia · Vendas por hora', `Almoço = comanda fechada entre ${ALMOCO.de}h e ${ALMOCO.ate}h (hora do pagamento). A aba "Vendas por hora" deixa o analista definir o próprio corte.`],
  ['1. Vendas', 'Vendas de chopp e demais bebidas', SIM, 'Bebidas e chopp', 'Mês a mês. A categoria do cardápio decide o que é bebida; a coluna "Chopp?" separa o chopp.'],
  ['1. Vendas', 'Cardápio atual e preços', SIM, 'Cardápio', 'Com custo da ficha e margem, quando o prato tem ficha técnica.'],
  ['1. Vendas', 'Média de clientes por dia, por dia da semana', PARTE, 'Dia da semana', 'Só conta os dias em que o garçom informou quantas pessoas na mesa. Quando todas as mesas aparecem com 1 pessoa, o número não vale e o dia fica de fora.'],
  ['1. Vendas', 'Movimento nos dias de maior e menor fluxo', SIM, 'Maiores e menores dias · Vendas por dia', ''],
  ['2. Financeiro', 'Fluxo de caixa dos últimos 4 meses', SIM, 'Fluxo de caixa diário · Resumo mensal', 'Entradas e saídas lançadas, dia a dia, com saldo acumulado.'],
  ['2. Financeiro', 'Contas a pagar e a receber, com datas e prazos', SIM, 'Contas a pagar · Contas a receber', 'A pagar: o que está em aberto, por vencimento. A receber: o fiado em aberto por cliente, com a idade da dívida.'],
  ['2. Financeiro', 'Custos fixos e variáveis', SIM, 'Despesas · Custos por categoria', 'O PicoOS chama de "custo variável" o que só existe se vender (insumo, gelo, cachê) e de "despesa fixa/operacional" o que roda todo mês (aluguel, salários, energia).'],
  ['2. Financeiro', 'Despesas com fornecedores, mercadorias e operação', SIM, 'Despesas · Compras (notas) · Fornecedores', ''],
  ['2. Financeiro', 'Retiradas atuais dos sócios (pró-labore)', SIM, 'Retiradas dos sócios', 'Só o que foi lançado como "Pró-labore (sócios)" ou "Distribuição de lucros". Retirada que não foi lançada não aparece.'],
  ['2. Financeiro', 'Dados para avaliar pró-labore de R$ 2.000 por sócio', SIM, 'Pró-labore (simulação)', 'Mês a mês e por dia de movimento. Muda o número de sócios e o valor nas células amarelas e a planilha recalcula.'],
  ['3. Produtos e custos', 'Produtos comercializados e custos de aquisição', SIM, 'Produtos e custos', 'Custo atual de cada item do estoque, na unidade do estoque, mais o último fornecedor e a data da última compra.'],
  ['3. Produtos e custos', 'Notas fiscais ou tabelas de preços dos fornecedores', PARTE, 'Compras (notas) · Cotações', 'Aqui vão os DADOS de cada nota lançada (fornecedor, item, quantidade, preço). A foto ou o PDF da nota não está no PicoOS.'],
  ['3. Produtos e custos', 'Fichas técnicas dos pratos e porções', SIM, 'Fichas técnicas', 'Só os pratos que têm ficha cadastrada. A aba "Cardápio" mostra quais não têm.'],
  ['3. Produtos e custos', 'Quantidades e custos dos ingredientes de cada preparação', SIM, 'Fichas técnicas', 'Ingrediente por ingrediente, com o custo de cada linha e o total do prato.'],
  ['3. Produtos e custos', 'Preços praticados no cardápio', SIM, 'Cardápio', ''],
  ['3. Produtos e custos', 'Preço do chopp e condições dos fornecedores', PARTE, 'Melhor preço · Cotações · Fornecedores', 'Prazo para pagar, pedido mínimo e prazo de entrega só aparecem quando foram preenchidos nas cotações.'],
  ['4. Operação e processos', 'Rotinas de funcionamento da cozinha e do atendimento', NAO, '', 'Descrever: abertura, serviço, fechamento, quem faz o quê.'],
  ['4. Operação e processos', 'Processos de armazenamento, preparação e manipulação dos alimentos', NAO, '', 'Descrever, ou mandar fotos e documentos que já existam.'],
  ['4. Operação e processos', 'Materiais, controles e procedimentos já usados pela equipe', PARTE, 'Fichas técnicas · Produtos e custos', 'O PicoOS controla estoque, fichas, caixa, ponto e doses. Papéis e rotinas fora do sistema, tu listas.'],
  ['4. Operação e processos', 'Estrutura do balcão lateral e usos comerciais', NAO, '', 'Medidas, fotos e o que já foi pensado.'],
  ['5. Marketing', 'Redes sociais e materiais de divulgação', NAO, '', 'Os @ e links, e o material que já existe.'],
  ['5. Marketing', 'Perfil dos clientes que frequentam', PARTE, 'Dia da semana · Clientes', 'O PicoOS só conhece os clientes do fiado. Faixa etária, origem e turistas × moradores, tu descreves.'],
  ['5. Marketing', 'Cadastro de clientes', PARTE, 'Clientes', 'Só quem foi cadastrado para o fiado. Telefones só vão se tu marcares na hora de baixar.'],
  ['5. Marketing', 'Brindes e prêmios para o sorteio da pesquisa', NAO, 'Vendas por produto', 'A decisão é tua. Dica: a coluna "Margem %" mostra o que sobra em cada produto.'],
  ['5. Marketing', 'Parceiros, influenciadores e convidados do evento de lançamento', NAO, '', 'Lista de nomes e contatos.'],
  ['6. Turismo e parcerias', 'Contatos com guias turísticos e empresas do setor', NAO, '', ''],
  ['6. Turismo e parcerias', 'Parcerias possíveis para atrair visitantes', NAO, '', ''],
  ['6. Turismo e parcerias', 'Aproximação com o projeto de Turismo de Base Comunitária e com o Rafael', NAO, '', ''],
  ['7. Outras', 'Calendário de funcionamento e períodos de fechamento', PARTE, 'Vendas por dia', 'Dia sem nenhum lançamento aparece zerado. Horário de funcionamento e feriados, tu informas.'],
  ['7. Outras', 'Movimento em dias de sol, chuva e outras condições', PARTE, 'Diário e clima · Vendas por dia', 'O PicoOS não guarda o tempo. Só aparece nos dias em que o campo "Clima" do Diário foi preenchido. O analista pode cruzar a data com o histórico do tempo.'],
  ['7. Outras', 'Outros relatórios ou controles que a empresa já usa', NAO, '', 'Planilhas, cadernos e o que mais existir.'],
];

export function montarPacote({
  dados = {}, vendas = [], hoje = diaOperacional(), geradoEm = new Date().toISOString(),
  meses = 4, telefones = false, nomes = true, nomeNegocio = '',
} = {}) {
  const receitas = arr(dados.receitas).filter((r) => r && r.data);
  const despesas = arr(dados.despesas).filter((d) => d && d.data);
  const compras = arr(dados.compras).filter((c) => c && c.data);
  const estoque = arr(dados.estoque);
  const cardapio = arr(dados.cardapio).filter((c) => c && c.nome);
  const fichas = arr(dados.fichas);
  const cotacoes = arr(dados.cotacoes);
  const clientes = arr(dados.clientes).filter((c) => c && c.nome);
  const diario = arr(dados.diario).filter((d) => d && d.data);
  const todasVendas = arr(vendas).filter((v) => v && !v.cancelada && v.data);

  const todasDatas = [...todasVendas.map((v) => v.data), ...receitas.map((r) => r.data), ...despesas.map((d) => d.data)].filter(Boolean).sort();
  const { ini, fim } = periodoDoPacote(meses, hoje, todasDatas[0]);
  const noPeriodo = (d) => d && d >= ini && d <= fim;
  const vs = todasVendas.filter((v) => noPeriodo(v.data));
  const rec = receitas.filter((r) => noPeriodo(r.data));
  const des = despesas.filter((d) => noPeriodo(d.data));
  const comp = compras.filter((c) => noPeriodo(c.data));
  const dias = diasEntre(ini, fim);
  const listaMeses = mesesEntre(ini, fim);
  const catDe = new Map(cardapio.filter((c) => c.id).map((c) => [c.id, c.categoria || 'Sem categoria']));
  const ehBebida = (nome, cat) => RE_CAT_BEBIDA.test(cat || '') || RE_CHOPP.test(nome || '');
  const abas = [];
  const aba = (a) => { abas.push({ notas: [], parametros: [], linhas: [], ...a }); return a; };

  // ---------------------------------------------------------------- DIA A DIA
  const tipoReceita = (r) => (r.categoria === ATRASADO ? 'fiado' : (FONTES_NAO_OPERACIONAL.includes(r.categoria) ? 'aporte' : 'vendas'));
  const porDia = new Map(dias.map((d) => [d, {
    data: d, vendas: 0, fiadoRecebido: 0, aporte: 0, fiado: 0, comandas: 0, balcao: 0, pessoas: 0,
    vendidoComandas: 0, almocoQtd: 0, almocoValor: 0, almocoItens: 0, almocoPessoas: 0,
  }]));
  for (const r of rec) {
    const d = porDia.get(r.data); if (!d) continue;
    const t = tipoReceita(r);
    if (t === 'fiado') d.fiadoRecebido = r2(d.fiadoRecebido + num(r.valor));
    else if (t === 'aporte') d.aporte = r2(d.aporte + num(r.valor));
    else d.vendas = r2(d.vendas + num(r.valor));
  }
  const porHora = new Map();
  for (const v of vs) {
    const d = porDia.get(v.data); if (!d) continue;
    d.fiado = r2(d.fiado + fiadoDaVenda(v));
    if (ehBalcao(v)) d.balcao += 1; else d.comandas += 1;
    d.pessoas += num(v.pessoas) || 0;
    d.vendidoComandas = r2(d.vendidoComandas + num(v.total));
    const h = horaDe(v.fechadaEm);
    if (h != null) {
      const ph = porHora.get(h) || { hora: h, comandas: 0, total: 0 };
      ph.comandas += 1; ph.total = r2(ph.total + num(v.total)); porHora.set(h, ph);
      if (h >= ALMOCO.de && h < ALMOCO.ate) {
        d.almocoQtd += 1; d.almocoValor = r2(d.almocoValor + num(v.total));
        d.almocoItens = r3(d.almocoItens + arr(v.itens).reduce((s, it) => s + (num(it.qtd) || 0), 0));
        d.almocoPessoas += num(v.pessoas) || 0;
      }
    }
  }
  const linhasDia = [...porDia.values()].map((d) => {
    const fat = r2(d.vendas + d.fiado);
    const n = d.comandas + d.balcao;
    // Uma pessoa por mesa em todas as mesas é o padrão do sistema quando o garçom
    // não informa — não é contagem de verdade.
    const pessoasValem = d.pessoas > 0 && !(d.pessoas === d.comandas && d.comandas > 1);
    return { ...d, dia: weekday(d.data), fat, n, pessoasValem, ticket: n ? r2(d.vendidoComandas / n) : null };
  });
  const comMov = linhasDia.filter((d) => d.fat > 0 || d.n > 0);

  aba({
    nome: 'Vendas por dia', descricao: 'Faturamento, comandas e pessoas, um dia por linha (dias sem lançamento aparecem zerados).',
    notas: ['Faturamento = caixa lançado + fiado do dia (o mesmo critério do Darci e do relatório da semana). "Vendido em comandas" é a soma das comandas fechadas, com serviço.'],
    colunas: [
      { h: 'Data', t: 'data', w: 12 }, { h: 'Dia da semana', w: 16 }, { h: 'Faturamento (caixa + fiado)', t: 'brl', w: 20 },
      { h: 'Caixa lançado', t: 'brl', w: 15 }, { h: 'Fiado do dia', t: 'brl', w: 14 }, { h: 'Comandas de mesa', t: 'int', w: 12 },
      { h: 'Vendas de balcão', t: 'int', w: 12 }, { h: 'Pessoas informadas', t: 'int', w: 12 }, { h: 'Ticket médio por comanda', t: 'brl', w: 16 },
      { h: 'Vendido em comandas', t: 'brl', w: 16 }, { h: 'Almoço: comandas', t: 'int', w: 12 }, { h: 'Almoço: R$', t: 'brl', w: 14 }, { h: 'Noite e demais: R$', t: 'brl', w: 15 },
    ],
    linhas: linhasDia.map((d) => [d.data, d.dia, d.fat, d.vendas, d.fiado, d.comandas, d.balcao, d.pessoasValem ? d.pessoas : null, d.ticket, d.vendidoComandas, d.almocoQtd, d.almocoValor, r2(d.vendidoComandas - d.almocoValor)]),
    totais: { 2: 'soma', 3: 'soma', 4: 'soma', 5: 'soma', 6: 'soma', 9: 'soma', 10: 'soma', 11: 'soma', 12: 'soma' },
  });

  // ---------------------------------------------------- COMANDAS x CAIXA
  // A ponte: o que as comandas dizem (itens + serviço − desconto, e como foram
  // pagas) contra o que foi lançado no caixa em Finanças. É aqui que aparece o
  // dia com comandas e sem caixa lançado — que no faturamento vira "zero".
  const FORMAS = ['Dinheiro', 'Pix', 'Crédito', 'Débito'];
  const concDia = new Map();
  for (const v of vs) {
    const x = concDia.get(v.data) || { n: 0, itens: 0, serv: 0, desc: 0, gravado: 0, fiado: 0, formas: { Dinheiro: 0, Pix: 0, Crédito: 0, Débito: 0, outras: 0 } };
    x.n += 1;
    x.itens = r2(x.itens + arr(v.itens).reduce((a, it) => a + num(it.qtd) * num(it.preco), 0));
    x.serv = r2(x.serv + num(v.servico)); x.desc = r2(x.desc + num(v.desconto)); x.gravado = r2(x.gravado + num(v.total)); x.fiado = r2(x.fiado + fiadoDaVenda(v));
    const pags = arr(v.pagamentos).length ? v.pagamentos : [{ forma: v.pagamento || 'Dinheiro', valor: v.total }];
    for (const p of pags) {
      if (!p || p.forma === 'Fiado') continue;
      const k = FORMAS.includes(p.forma) ? p.forma : 'outras';
      x.formas[k] = r2(x.formas[k] + num(p.valor));
    }
    concDia.set(v.data, x);
  }
  const situacaoDia = (n, caixa, dif) => {
    if (n > 0 && !(caixa > 0)) return 'Falta lançar o caixa deste dia';
    if (n === 0 && caixa > 0) return 'Caixa lançado sem comandas';
    if (Math.abs(dif) < 1) return 'Bate';
    return dif < 0 ? 'Caixa menor que o recebido nas comandas' : 'Caixa maior que o recebido nas comandas';
  };
  const diasConc = linhasDia.filter((d) => d.n > 0 || d.vendas > 0).map((d) => {
    const x = concDia.get(d.data) || { n: 0, itens: 0, serv: 0, desc: 0, gravado: 0, fiado: 0, formas: { Dinheiro: 0, Pix: 0, Crédito: 0, Débito: 0, outras: 0 } };
    const total = r2(x.itens + x.serv - x.desc);
    const recebido = r2(total - x.fiado);
    const dif = r2(d.vendas - recebido);
    return { d, x, total, recebido, dif, sit: situacaoDia(x.n, d.vendas, dif) };
  });
  aba({
    nome: 'Conciliação comandas e caixa', descricao: 'Ponte entre as comandas (itens, serviço, desconto, fiado, forma de pagamento) e o caixa lançado em Finanças, dia a dia.',
    notas: [
      'Total das comandas = itens + serviço − descontos. Recebido nas comandas = total − fiado (o fiado ainda não entrou). A diferença compara isso com o caixa lançado em Finanças (sem fiado pago e sem aporte).',
      'A coluna "Situação" aponta os dias a conferir. "Falta lançar o caixa" = tem comanda fechada e nada lançado no caixa: o faturamento desse dia aparece zerado nas outras abas. "Dif. do total gravado" deve ser 0; se não for, a comanda foi alterada depois.',
    ],
    colunas: [
      { h: 'Data', t: 'data', w: 12 }, { h: 'Dia da semana', w: 15 }, { h: 'Comandas', t: 'int', w: 10 }, { h: 'Itens vendidos', t: 'brl', w: 14 }, { h: 'Serviço', t: 'brl', w: 12 }, { h: 'Descontos', t: 'brl', w: 12 },
      { h: 'Total das comandas', t: 'brl', w: 15 }, { h: 'Fiado (a receber)', t: 'brl', w: 14 }, { h: 'Recebido nas comandas', t: 'brl', w: 15 },
      { h: 'Dinheiro', t: 'brl', w: 12 }, { h: 'Pix', t: 'brl', w: 12 }, { h: 'Crédito', t: 'brl', w: 12 }, { h: 'Débito', t: 'brl', w: 12 }, { h: 'Outras formas', t: 'brl', w: 12 },
      { h: 'Caixa lançado em Finanças', t: 'brl', w: 15 }, { h: 'Diferença (caixa − recebido)', t: 'brl', w: 15 }, { h: 'Situação', w: 40 }, { h: 'Dif. do total gravado', t: 'brl', w: 14 },
    ],
    linhas: diasConc.map(({ d, x, total, recebido, dif, sit }) => [
      d.data, d.dia, x.n, x.itens, x.serv, x.desc, { f: 'D{r}+E{r}-F{r}', v: total }, x.fiado, { f: 'G{r}-H{r}', v: recebido },
      x.formas.Dinheiro, x.formas.Pix, x.formas['Crédito'], x.formas['Débito'], x.formas.outras,
      d.vendas, { f: 'O{r}-I{r}', v: dif }, sit, r2(x.gravado - total),
    ]),
    totais: { 2: 'soma', 3: 'soma', 4: 'soma', 5: 'soma', 6: 'soma', 7: 'soma', 8: 'soma', 9: 'soma', 10: 'soma', 11: 'soma', 12: 'soma', 13: 'soma', 14: 'soma', 15: 'soma', 17: 'soma' },
  });

  // ------------------------------------------------------------ DIA DA SEMANA
  const ordemSemana = [1, 2, 3, 4, 5, 6, 0];
  aba({
    nome: 'Dia da semana', descricao: 'Média de faturamento, comandas e clientes por dia da semana.',
    notas: ['Médias só dos dias COM movimento. Pessoas: só dos dias em que o garçom informou o número de pessoas (a coluna "Dias com pessoas informadas" diz quantos).'],
    colunas: [
      { h: 'Dia da semana', w: 16 }, { h: 'Dias com movimento', t: 'int', w: 12 }, { h: 'Faturamento médio', t: 'brl', w: 16 }, { h: 'Maior faturamento', t: 'brl', w: 16 },
      { h: 'Menor faturamento', t: 'brl', w: 16 }, { h: 'Comandas (média)', t: 'num', w: 12 }, { h: 'Pessoas por dia (média)', t: 'num', w: 14 }, { h: 'Dias com pessoas informadas', t: 'int', w: 14 }, { h: 'Ticket médio por comanda', t: 'brl', w: 16 },
    ],
    linhas: ordemSemana.map((g) => {
      const l = comMov.filter((d) => new Date(`${d.data}T12:00:00`).getDay() === g && d.fat > 0);
      const lp = l.filter((d) => d.pessoasValem);
      const nome = DIAS[g];
      const com = l.reduce((s, d) => s + d.n, 0);
      return [
        nome, l.length, l.length ? r2(soma(l, (d) => d.fat) / l.length) : null, l.length ? Math.max(...l.map((d) => d.fat)) : null,
        l.length ? Math.min(...l.map((d) => d.fat)) : null, l.length ? r2(com / l.length) : null,
        lp.length ? r2(lp.reduce((s, d) => s + d.pessoas, 0) / lp.length) : null, lp.length,
        com ? r2(soma(l, (d) => d.vendidoComandas) / com) : null,
      ];
    }),
  });

  const ranking = [...comMov].filter((d) => d.fat > 0);
  const maiores = [...ranking].sort((a, b) => b.fat - a.fat).slice(0, 10);
  const menores = [...ranking].sort((a, b) => a.fat - b.fat).slice(0, 10);
  aba({
    nome: 'Maiores e menores dias', descricao: 'Os 10 dias de maior e os 10 de menor faturamento, com o movimento de cada um.',
    notas: ['Só entram dias com faturamento. Dia fechado ou sem lançamento não conta como "menor".'],
    colunas: [{ h: 'Lista', w: 16 }, { h: 'Posição', t: 'int', w: 9 }, { h: 'Data', t: 'data', w: 12 }, { h: 'Dia da semana', w: 16 }, { h: 'Faturamento', t: 'brl', w: 15 }, { h: 'Comandas', t: 'int', w: 11 }, { h: 'Pessoas informadas', t: 'int', w: 12 }],
    linhas: [
      ...maiores.map((d, i) => ['Maiores dias', i + 1, d.data, d.dia, d.fat, d.n, d.pessoasValem ? d.pessoas : null]),
      ...menores.map((d, i) => ['Menores dias', i + 1, d.data, d.dia, d.fat, d.n, d.pessoasValem ? d.pessoas : null]),
    ],
  });

  const diasAlmoco = linhasDia.filter((d) => d.almocoQtd > 0);
  aba({
    nome: 'Almoço por dia', descricao: `Comandas fechadas entre ${ALMOCO.de}h e ${ALMOCO.ate}h, dia a dia.`,
    notas: [`Almoço = comanda PAGA entre ${ALMOCO.de}h e ${ALMOCO.ate}h (hora de Florianópolis). É a hora do pagamento, não a do pedido.`],
    colunas: [{ h: 'Data', t: 'data', w: 12 }, { h: 'Dia da semana', w: 16 }, { h: 'Comandas', t: 'int', w: 11 }, { h: 'Itens vendidos', t: 'num', w: 13 }, { h: 'Vendido (R$)', t: 'brl', w: 15 }, { h: 'Ticket médio', t: 'brl', w: 14 }],
    linhas: diasAlmoco.map((d) => [d.data, d.dia, d.almocoQtd, d.almocoItens, d.almocoValor, r2(d.almocoValor / d.almocoQtd)]),
    totais: { 2: 'soma', 3: 'soma', 4: 'soma' },
  });

  const totalHora = soma([...porHora.values()], (h) => h.total);
  aba({
    nome: 'Vendas por hora', descricao: 'Comandas e valor por hora do pagamento — para traçar o próprio corte de almoço e noite.',
    notas: ['Hora em que a comanda foi fechada (paga), no horário de Florianópolis.'],
    colunas: [{ h: 'Hora', w: 9 }, { h: 'Comandas', t: 'int', w: 11 }, { h: 'Vendido (R$)', t: 'brl', w: 15 }, { h: '% do total', t: 'pct', w: 11 }, { h: 'Comandas por dia com movimento', t: 'num', w: 16 }],
    linhas: [...porHora.values()].sort((a, b) => a.hora - b.hora).map((h) => [`${String(h.hora).padStart(2, '0')}h`, h.comandas, h.total, totalHora ? h.total / totalHora : null, comMov.length ? r2(h.comandas / comMov.length) : null]),
    totais: { 1: 'soma', 2: 'soma' },
  });

  // ------------------------------------------------------------- PRODUTOS
  const prod = new Map();
  const porMesProd = new Map();
  for (const v of vs) {
    const fator = 1 - Math.max(0, Math.min(100, num(v.descontoPct))) / 100;
    for (const it of arr(v.itens)) {
      const nome = limparNome(it && it.nome) || 'Sem nome';
      const q = num(it.qtd);
      if (!(q > 0)) continue;
      const cat = catDe.get(it.cardapioId) || 'Sem categoria';
      const p = prod.get(nome) || { nome, categoria: cat, qtd: 0, receita: 0, custo: 0, temCusto: false, obs: '' };
      p.qtd = r3(p.qtd + q); p.receita = r2(p.receita + q * num(it.preco) * fator);
      prod.set(nome, p);
      const pm = porMesProd.get(nome) || {};
      pm[ymOf(v.data)] = r3((pm[ymOf(v.data)] || 0) + q); porMesProd.set(nome, pm);
    }
  }
  const semFichaSet = new Set();
  for (const mes of listaMeses) {
    const r = cmvDoMes({ vendas: vs, fichas, cardapio, mes, estoque: estoqueNoMes(estoque, compras, mes).estoque });
    for (const p of arr(r.produtos)) { const x = prod.get(p.nome); if (x) { x.custo = r2(x.custo + p.custo); x.temCusto = true; } }
    for (const p of arr(r.impossiveis)) { const x = prod.get(p.nome); if (x) x.obs = 'ficha com custo absurdo (conferir)'; }
    for (const s of arr(r.semFicha)) semFichaSet.add(s.nome);
  }
  for (const p of prod.values()) { if (!p.temCusto && !p.obs) p.obs = 'sem ficha técnica'; if (p.obs.startsWith('ficha com')) { p.custo = 0; p.temCusto = false; } }
  // Itens ativos do cardápio que não venderam nada: é "a menor saída".
  for (const c of cardapio) {
    if (c.ativo === false) continue;
    const nome = limparNome(c.nome);
    if (!prod.has(nome)) prod.set(nome, { nome, categoria: c.categoria || 'Sem categoria', qtd: 0, receita: 0, custo: 0, temCusto: false, obs: 'não vendeu no período' });
  }
  const listaProd = [...prod.values()].sort((a, b) => (b.receita - a.receita) || (b.qtd - a.qtd) || a.nome.localeCompare(b.nome));
  const totalReceitaProd = soma(listaProd, (p) => p.receita);
  const posQtd = new Map([...listaProd].sort((a, b) => b.qtd - a.qtd).map((p, i) => [p.nome, i + 1]));
  aba({
    nome: 'Vendas por produto', descricao: 'Quantidade, receita, custo e margem de cada produto, do mais vendido ao menos vendido.',
    notas: ['Receita já com o desconto dado na comanda. Custo = custo atual dos ingredientes da ficha técnica (o mesmo cálculo do CMV). Produto sem ficha fica sem custo e sem margem.'],
    colunas: [
      { h: 'Posição (por receita)', t: 'int', w: 11 }, { h: 'Produto', w: 34 }, { h: 'Categoria', w: 18 }, { h: 'Bebida?', w: 9 }, { h: 'Quantidade vendida', t: 'num', w: 12 },
      { h: 'Receita', t: 'brl', w: 14 }, { h: '% da receita', t: 'pct', w: 10 }, { h: 'Custo (ficha)', t: 'brl', w: 13 }, { h: 'Margem R$', t: 'brl', w: 13 }, { h: 'Margem %', t: 'pct', w: 10 },
      { h: 'Posição (por quantidade)', t: 'int', w: 12 }, { h: 'Observação', w: 30 },
    ],
    linhas: listaProd.map((p, i) => [
      i + 1, p.nome, p.categoria, ehBebida(p.nome, p.categoria) ? 'Sim' : 'Não', p.qtd, p.receita, totalReceitaProd ? p.receita / totalReceitaProd : null,
      p.temCusto ? p.custo : null,
      p.temCusto ? { f: 'F{r}-H{r}', v: r2(p.receita - p.custo) } : null,
      p.temCusto && p.receita > 0 ? { f: 'IF(F{r}>0,I{r}/F{r},"")', v: (p.receita - p.custo) / p.receita } : null,
      posQtd.get(p.nome), p.obs,
    ]),
    totais: { 4: 'soma', 5: 'soma' },
  });

  const bebidas = listaProd.filter((p) => ehBebida(p.nome, p.categoria) && (p.qtd > 0 || p.obs === 'não vendeu no período'));
  aba({
    nome: 'Bebidas e chopp', descricao: 'Vendas de chopp e das demais bebidas, mês a mês.',
    notas: ['Bebida = categoria do cardápio de bebida/chopp/cerveja/drink/dose/vinho/etc., ou nome com "chopp". Filtra a coluna "Categoria" para ajustar.'],
    colunas: [{ h: 'Produto', w: 34 }, { h: 'Categoria', w: 18 }, { h: 'Chopp?', w: 9 }, ...listaMeses.map((m) => ({ h: `Qtd ${rotuloMes(m)}`, t: 'num', w: 11 })), { h: 'Quantidade total', t: 'num', w: 12 }, { h: 'Receita total', t: 'brl', w: 14 }, { h: 'Margem %', t: 'pct', w: 10 }],
    linhas: bebidas.map((p) => [
      p.nome, p.categoria, RE_CHOPP.test(p.nome) || RE_CHOPP.test(p.categoria) ? 'Sim' : 'Não',
      ...listaMeses.map((m) => (porMesProd.get(p.nome) || {})[m] || 0),
      p.qtd, p.receita, p.temCusto && p.receita > 0 ? (p.receita - p.custo) / p.receita : null,
    ]),
    totais: Object.fromEntries([...listaMeses.map((_, i) => [3 + i, 'soma']), [3 + listaMeses.length, 'soma'], [4 + listaMeses.length, 'soma']]),
  });

  // ------------------------------------------------------ CARDÁPIO E FICHAS
  const fichaPorId = new Map(fichas.filter((f) => f && f.cardapioId).map((f) => [f.cardapioId, arr(f.itens)]));
  const custoPrato = (c) => {
    const itens = fichaPorId.get(c.id);
    if (!itens || !itens.length) return null;
    const base = custoDaFicha(itens, estoque);
    const sab = custoDosSabores(c.sabores, estoque, c.saboresTotal);
    return { custo: r2(base.custo + (sab && sab.medio ? sab.medio : 0)), completo: base.completo, detalhe: base.detalhe, faltando: base.faltando };
  };
  const cardOrdenado = [...cardapio].sort((a, b) => String(a.categoria || '').localeCompare(String(b.categoria || '')) || String(a.nome).localeCompare(String(b.nome)));
  aba({
    nome: 'Cardápio', descricao: 'Cardápio atual com preços, custo da ficha e margem.',
    notas: ['Margem = preço − custo da ficha técnica (fórmula: muda o preço e a margem recalcula). Prato sem ficha fica sem custo.'],
    colunas: [{ h: 'Item', w: 34 }, { h: 'Categoria', w: 18 }, { h: 'Preço', t: 'brl', w: 12 }, { h: 'Ativo?', w: 8 }, { h: 'Custo (ficha)', t: 'brl', w: 13 }, { h: 'Margem R$', t: 'brl', w: 12 }, { h: 'Margem %', t: 'pct', w: 10 }, { h: 'Tem ficha?', w: 10 }, { h: 'Ficha completa?', w: 13 }],
    linhas: cardOrdenado.map((c) => {
      const k = custoPrato(c);
      const preco = num(c.preco);
      return [
        limparNome(c.nome), c.categoria || '', preco, c.ativo === false ? 'Não' : 'Sim',
        k ? k.custo : null, k ? { f: 'C{r}-E{r}', v: r2(preco - k.custo) } : null,
        k && preco > 0 ? { f: 'IF(C{r}>0,F{r}/C{r},"")', v: (preco - k.custo) / preco } : null,
        k ? 'Sim' : 'Não', k ? (k.completo ? 'Sim' : 'Não — falta custo de: ' + k.faltando.join(', ')) : '',
      ];
    }),
  });

  const linhasFicha = [];
  for (const c of cardOrdenado) {
    const k = custoPrato(c);
    if (!k) continue;
    k.detalhe.forEach((d, i) => linhasFicha.push([limparNome(c.nome), c.categoria || '', num(c.preco), d.nome, numQtd(d.qtd), d.unidade || '', d.custo, i === 0 ? k.custo : null, d.chute ? 'unidade da receita não converte direito — conferir' : '']));
  }
  aba({
    nome: 'Fichas técnicas', descricao: 'Ingrediente por ingrediente de cada prato, com quantidade e custo.',
    notas: ['Custo de cada linha = quantidade na receita × custo atual do ingrediente no estoque. O custo total do prato aparece na primeira linha dele.'],
    colunas: [{ h: 'Prato', w: 30 }, { h: 'Categoria', w: 16 }, { h: 'Preço', t: 'brl', w: 11 }, { h: 'Ingrediente', w: 30 }, { h: 'Quantidade', t: 'num', w: 11 }, { h: 'Unidade', w: 9 }, { h: 'Custo da linha', t: 'brl', w: 13 }, { h: 'Custo total do prato', t: 'brl', w: 14 }, { h: 'Observação', w: 40 }],
    linhas: linhasFicha,
  });

  // ------------------------------------------------- ESTOQUE E FORNECEDORES
  const comprasPorNome = new Map();
  for (const c of compras) { const k = chaveNome(c.produto); if (!k) continue; (comprasPorNome.get(k) || comprasPorNome.set(k, []).get(k)).push(c); }
  aba({
    nome: 'Produtos e custos', descricao: 'Itens do estoque com custo de aquisição, saldo e último fornecedor.',
    notas: ['Custo na unidade do estoque (o mesmo que alimenta as fichas e o CMV). Valor parado = saldo × custo.'],
    colunas: [{ h: 'Item', w: 34 }, { h: 'Categoria', w: 16 }, { h: 'Unidade', w: 9 }, { h: 'Custo atual', t: 'brl', w: 12 }, { h: 'Saldo', t: 'num', w: 10 }, { h: 'Valor parado', t: 'brl', w: 13 }, { h: 'Mínimo', t: 'num', w: 9 }, { h: 'Último fornecedor', w: 22 }, { h: 'Data da última compra', t: 'data', w: 14 }],
    linhas: [...estoque].filter((i) => i && i.nome).sort((a, b) => String(a.categoria || '').localeCompare(String(b.categoria || '')) || String(a.nome).localeCompare(String(b.nome))).map((it) => {
      const ult = [...(comprasPorNome.get(chaveNome(it.nome)) || [])].sort((a, b) => String(b.data).localeCompare(String(a.data)))[0];
      return [limparNome(it.nome), it.categoria || '', it.unidade || 'un', num(it.custo), numQtd(it.saldo), { f: 'D{r}*E{r}', v: r2(num(it.custo) * numQtd(it.saldo)) }, numQtd(it.minimo) || null, ult ? limparNome(ult.fornecedor) : '', ult ? ult.data : null];
    }),
    totais: { 5: 'soma' },
  });

  const compOrd = [...comp].sort((a, b) => String(a.data).localeCompare(String(b.data)));
  aba({
    nome: 'Compras (notas)', descricao: 'Cada linha de nota lançada no período: fornecedor, item, quantidade e preço. Compra parcelada = uma linha por parcela.',
    notas: [
      'COMPRA PARCELADA: cada linha é UMA PARCELA (quantidade 1 × valor da parcela). Somando a coluna "Total da linha", o valor da compra fecha. As colunas "Qtd real" e "Preço cheio" só mostram a compra inteira e NÃO entram em nenhuma soma.',
      'São os dados lançados em Compras. A foto ou o PDF da nota fiscal não fica no PicoOS.',
    ],
    colunas: [{ h: 'Data', t: 'data', w: 12 }, { h: 'Fornecedor', w: 22 }, { h: 'Produto', w: 32 }, { h: 'Quantidade (da linha)', t: 'num', w: 12 }, { h: 'Valor unitário (da linha)', t: 'brl', w: 14 }, { h: 'Total da linha', t: 'brl', w: 13 }, { h: 'Nota', w: 14 }, { h: 'Parcela', w: 9 }, { h: 'Qtd real da compra (só informação)', t: 'num', w: 14 }, { h: 'Preço cheio unitário (só informação)', t: 'brl', w: 15 }, { h: 'Forma de pagamento', w: 16 }, { h: 'Vencimento', t: 'data', w: 12 }, { h: 'Pago?', w: 8 }, { h: 'Data do pagamento', t: 'data', w: 14 }, { h: 'Tipo de conta', w: 22 }],
    linhas: compOrd.map((c) => [c.data, limparNome(c.fornecedor), limparNome(c.produto), numQtd(c.quantidade), num(c.valorUnit), { f: 'D{r}*E{r}', v: r2(totalCompra(c)) }, c.nota || '', c.parcela || '', numQtd(c.qtdCompra) || null, num(c.precoCheio) || null, c.formaPagto || '', c.vencimento || null, c.pago === 'Sim' ? 'Sim' : 'Não', c.dataPagamento || null, c.tipoConta || '']),
    totais: { 5: 'soma' },
  });

  const porForn = new Map();
  for (const c of comp) {
    const f = limparNome(c.fornecedor) || 'Sem fornecedor';
    const x = porForn.get(f) || { f, linhas: 0, total: 0, ultima: '' };
    x.linhas += 1; x.total = r2(x.total + totalCompra(c)); if (String(c.data) > x.ultima) x.ultima = c.data; porForn.set(f, x);
  }
  const totalForn = soma([...porForn.values()], (x) => x.total);
  aba({
    nome: 'Fornecedores', descricao: 'Quanto foi comprado de cada fornecedor e as condições comerciais.',
    notas: ['Prazo para pagar, pedido mínimo e prazo de entrega vêm das cotações; ficam vazios se não foram preenchidos.'],
    colunas: [{ h: 'Fornecedor', w: 26 }, { h: 'Linhas de nota', t: 'int', w: 11 }, { h: 'Total comprado', t: 'brl', w: 15 }, { h: '% do total', t: 'pct', w: 10 }, { h: 'Prazo para pagar (dias)', t: 'int', w: 13 }, { h: 'Pedido mínimo', t: 'brl', w: 13 }, { h: 'Entrega (dias)', t: 'int', w: 11 }, { h: 'Última compra', t: 'data', w: 13 }],
    linhas: [...porForn.values()].sort((a, b) => b.total - a.total).map((x) => {
      const d = dadosDoFornecedor(cotacoes, x.f);
      return [x.f, x.linhas, x.total, totalForn ? x.total / totalForn : null, d.prazoPag || null, d.minPedido || null, d.prazoEntrega || null, x.ultima || null];
    }),
    totais: { 1: 'soma', 2: 'soma' },
  });

  aba({
    nome: 'Cotações', descricao: 'Todos os preços cotados, com o preço por unidade já calculado.',
    notas: ['Preço por unidade = preço da embalagem ÷ o que vem dentro (caixa de 12 a R$ 95 = R$ 7,92 a unidade). É o que permite comparar fornecedores.'],
    colunas: [{ h: 'Data', t: 'data', w: 12 }, { h: 'Produto', w: 32 }, { h: 'Fornecedor', w: 22 }, { h: 'Preço', t: 'brl', w: 12 }, { h: 'Embalagem', w: 10 }, { h: 'Cada um tem', t: 'num', w: 11 }, { h: 'Preço por unidade', t: 'brl', w: 14 }, { h: 'Prazo para pagar (dias)', t: 'int', w: 13 }, { h: 'Pedido mínimo', t: 'brl', w: 13 }, { h: 'Entrega (dias)', t: 'int', w: 11 }, { h: 'Chopp?', w: 8 }],
    linhas: [...cotacoes].filter((c) => c && c.produto).sort((a, b) => String(b.data || '').localeCompare(String(a.data || ''))).map((c) => [c.data || null, limparNome(c.produto), limparNome(c.fornecedor), num(c.preco), c.embalagem || 'un', numQtd(c.conteudo) || null, precoUnitario(c) || null, num(c.prazoPag) || null, num(c.minPedido) || null, num(c.prazoEntrega) || null, RE_CHOPP.test(c.produto) ? 'Sim' : 'Não']),
  });

  const precos = analisarPrecos({ compras, cotacoes, estoque, hoje });
  aba({
    nome: 'Melhor preço', descricao: 'Para cada produto, o fornecedor mais barato hoje (pelas notas e cotações recentes).',
    notas: ['Vale o preço mais recente de cada fornecedor (nota até 120 dias, cotação até 60), na unidade do estoque. A economia é por mês, no consumo dos últimos 90 dias.'],
    colunas: [{ h: 'Produto', w: 32 }, { h: 'Unidade', w: 9 }, { h: 'Mais barato em', w: 22 }, { h: 'Preço por unidade', t: 'brl', w: 14 }, { h: 'Fonte', w: 10 }, { h: 'Data', t: 'data', w: 12 }, { h: 'Segundo mais barato', w: 22 }, { h: 'Preço do segundo', t: 'brl', w: 14 }, { h: 'Última compra em', w: 22 }, { h: 'Preço da última compra', t: 'brl', w: 15 }, { h: 'Economia estimada por mês', t: 'brl', w: 15 }, { h: 'Chopp?', w: 8 }],
    linhas: precos.map((a) => [a.nome, a.unidade, a.melhor.fornecedor, a.melhor.unit, a.melhor.fonte === 'nota' ? 'Nota' : 'Cotação', a.melhor.data, a.fornecedores[1] ? a.fornecedores[1].fornecedor : '', a.fornecedores[1] ? a.fornecedores[1].unit : null, a.ultima ? a.ultima.fornecedor : '', a.ultima ? a.ultima.unit : null, a.economiaMes || null, RE_CHOPP.test(a.nome) ? 'Sim' : 'Não']),
  });

  // ------------------------------------------------------------- FINANCEIRO
  const despRows = des.map((d) => ({ ...d, tipo: tipoDaDespesa(d.categoria), valor: num(d.valor) }));
  const despDia = new Map(dias.map((d) => [d, { op: 0, ret: 0, fora: 0 }]));
  for (const d of despRows) {
    const x = despDia.get(d.data); if (!x) continue;
    if (ehRetirada(d.tipo)) x.ret = r2(x.ret + d.valor); else if (ehForaDaOperacao(d.tipo)) x.fora = r2(x.fora + d.valor); else x.op = r2(x.op + d.valor);
  }
  const fluxo = linhasDia.map((d) => {
    const s = despDia.get(d.data);
    const entradas = r2(d.vendas + d.fiadoRecebido + d.aporte);
    const saidas = r2(s.op + s.ret + s.fora);
    return { data: d.data, dia: d.dia, vendas: d.vendas, fiadoRec: d.fiadoRecebido, aporte: d.aporte, entradas, op: s.op, ret: s.ret, fora: s.fora, saidas, saldo: r2(entradas - saidas), fiadoDado: d.fiado };
  });
  let acum = 0;
  aba({
    nome: 'Fluxo de caixa diário', descricao: 'Entradas e saídas lançadas, dia a dia, com saldo acumulado.',
    notas: ['Regime de CAIXA: entra o dinheiro recebido (vendas lançadas no caixa + fiado que foi pago + aporte/empréstimo). O fiado que ficou a receber NÃO entra: aparece na última coluna só para informação.', 'Saídas = despesas lançadas (compras pagas viram despesa). "Retiradas dos sócios" = pró-labore e distribuição de lucros. "Fora da operação" = investimento e pagamento de dívida.'],
    colunas: [
      { h: 'Data', t: 'data', w: 12 }, { h: 'Dia da semana', w: 15 }, { h: 'Vendas recebidas', t: 'brl', w: 15 }, { h: 'Fiado recebido', t: 'brl', w: 14 }, { h: 'Aporte / empréstimo', t: 'brl', w: 14 }, { h: 'Total de entradas', t: 'brl', w: 15 },
      { h: 'Despesas operacionais e variáveis', t: 'brl', w: 17 }, { h: 'Retiradas dos sócios', t: 'brl', w: 14 }, { h: 'Fora da operação', t: 'brl', w: 14 }, { h: 'Total de saídas', t: 'brl', w: 14 },
      { h: 'Saldo do dia', t: 'brl', w: 14 }, { h: 'Saldo acumulado', t: 'brl', w: 15 }, { h: 'Fiado dado no dia (a receber)', t: 'brl', w: 15 },
    ],
    linhas: fluxo.map((d, i) => {
      acum = r2(acum + d.saldo);
      return [d.data, d.dia, d.vendas, d.fiadoRec, d.aporte, { f: 'SUM(C{r}:E{r})', v: d.entradas }, d.op, d.ret, d.fora, { f: 'SUM(G{r}:I{r})', v: d.saidas }, { f: 'F{r}-J{r}', v: d.saldo }, i === 0 ? { f: 'K{r}', v: acum } : { f: 'L{p}+K{r}', v: acum }, d.fiadoDado];
    }),
    totais: { 2: 'soma', 3: 'soma', 4: 'soma', 5: 'soma', 6: 'soma', 7: 'soma', 8: 'soma', 9: 'soma', 10: 'soma', 12: 'soma' },
  });

  const resumoMes = listaMeses.map((m) => {
    const ds = linhasDia.filter((d) => ymOf(d.data) === m);
    const fl = fluxo.filter((d) => ymOf(d.data) === m);
    const comMes = ds.filter((d) => d.fat > 0 || d.n > 0);
    const nCom = ds.reduce((s, d) => s + d.n, 0);
    return {
      m, fat: soma(ds, (d) => d.fat), fiado: soma(ds, (d) => d.fiado), fiadoRec: soma(fl, (d) => d.fiadoRec), entradas: soma(fl, (d) => d.entradas),
      op: soma(fl, (d) => d.op), ret: soma(fl, (d) => d.ret), fora: soma(fl, (d) => d.fora), saldo: soma(fl, (d) => d.saldo),
      comandas: nCom, ticket: nCom ? r2(soma(ds, (d) => d.vendidoComandas) / nCom) : null, diasMov: comMes.length,
      // O mês do fim do período está incompleto se o dia seguinte ainda é dele.
      parcial: m === ymOf(fim) && ymOf(addDays(fim, 1)) === m,
    };
  });
  aba({
    nome: 'Resumo mensal', descricao: 'O mês em uma linha: faturamento, entradas, saídas e saldo.',
    notas: ['O último mês costuma estar incompleto (a coluna "Mês completo?" avisa). Faturamento = caixa + fiado; entradas e saídas seguem o regime de caixa da aba "Fluxo de caixa diário".'],
    colunas: [{ h: 'Mês', w: 10 }, { h: 'Mês completo?', w: 12 }, { h: 'Faturamento (caixa + fiado)', t: 'brl', w: 17 }, { h: 'Fiado do mês (a receber)', t: 'brl', w: 15 }, { h: 'Fiado recebido', t: 'brl', w: 14 }, { h: 'Entradas de caixa', t: 'brl', w: 15 }, { h: 'Despesas operacionais e variáveis', t: 'brl', w: 17 }, { h: 'Retiradas dos sócios', t: 'brl', w: 14 }, { h: 'Fora da operação', t: 'brl', w: 14 }, { h: 'Saldo do mês', t: 'brl', w: 14 }, { h: 'Comandas', t: 'int', w: 10 }, { h: 'Ticket médio', t: 'brl', w: 12 }, { h: 'Dias com movimento', t: 'int', w: 12 }],
    linhas: resumoMes.map((x) => [rotuloMes(x.m), x.parcial ? 'Não (parcial)' : 'Sim', x.fat, x.fiado, x.fiadoRec, x.entradas, x.op, x.ret, x.fora, x.saldo, x.comandas, x.ticket, x.diasMov]),
    totais: { 2: 'soma', 3: 'soma', 4: 'soma', 5: 'soma', 6: 'soma', 7: 'soma', 8: 'soma', 9: 'soma', 10: 'soma', 12: 'soma' },
  });

  aba({
    nome: 'Despesas', descricao: 'Cada despesa lançada, classificada em custo variável, despesa fixa/operacional, retirada ou fora da operação.',
    notas: ['Classificação do PicoOS: "custo variável" só existe se vender (insumos, gelo, cachê, extra); "despesa fixa/operacional" roda todo mês (aluguel, salários, energia, etc.).'],
    colunas: [{ h: 'Data', t: 'data', w: 12 }, { h: 'Categoria', w: 28 }, { h: 'Tipo', w: 30 }, { h: 'Descrição', w: 36 }, { h: 'Valor', t: 'brl', w: 13 }, { h: 'Observação', w: 30 }],
    linhas: [...despRows].sort((a, b) => String(a.data).localeCompare(String(b.data))).map((d) => [d.data, d.categoria || '', d.tipo, limparNome(d.descricao), d.valor, d.obs || '']),
    totais: { 4: 'soma' },
  });

  const cats = new Map();
  for (const d of despRows) {
    const k = d.categoria || 'Sem categoria';
    const x = cats.get(k) || { cat: k, tipo: d.tipo, porMes: {} };
    x.porMes[ymOf(d.data)] = r2((x.porMes[ymOf(d.data)] || 0) + d.valor); cats.set(k, x);
  }
  aba({
    nome: 'Custos por categoria', descricao: 'Quanto saiu em cada categoria, mês a mês, com média mensal.',
    notas: ['A média considera os meses do período (o último pode estar incompleto).'],
    colunas: [{ h: 'Categoria', w: 28 }, { h: 'Tipo', w: 30 }, ...listaMeses.map((m) => ({ h: rotuloMes(m), t: 'brl', w: 13 })), { h: 'Total', t: 'brl', w: 14 }, { h: 'Média por mês', t: 'brl', w: 14 }],
    linhas: [...cats.values()].sort((a, b) => a.tipo.localeCompare(b.tipo) || (Object.values(b.porMes).reduce((s, v) => s + v, 0) - Object.values(a.porMes).reduce((s, v) => s + v, 0))).map((x) => {
      const vals = listaMeses.map((m) => x.porMes[m] || 0);
      const tot = r2(vals.reduce((s, v) => s + v, 0));
      const ult = String.fromCharCode(67 + listaMeses.length - 1);
      const colTot = String.fromCharCode(67 + listaMeses.length);
      return [x.cat, x.tipo, ...vals, { f: `SUM(C{r}:${ult}{r})`, v: tot }, { f: `${colTot}{r}/${listaMeses.length}`, v: r2(tot / listaMeses.length) }];
    }),
    totais: Object.fromEntries([...listaMeses.map((_, i) => [2 + i, 'soma']), [2 + listaMeses.length, 'soma'], [3 + listaMeses.length, 'soma']]),
  });

  aba({
    nome: 'Retiradas dos sócios', descricao: 'Pró-labore e distribuição de lucros que foram lançados.',
    notas: [`Só aparece o que foi lançado nas categorias "${PRO_LABORE}" e "${DISTRIBUICAO}". Retirada feita sem lançar no PicoOS não está aqui.`],
    colunas: [{ h: 'Data', t: 'data', w: 12 }, { h: 'Tipo', w: 30 }, { h: 'Descrição', w: 36 }, { h: 'Valor', t: 'brl', w: 14 }],
    linhas: despRows.filter((d) => ehRetirada(d.tipo)).sort((a, b) => String(a.data).localeCompare(String(b.data))).map((d) => [d.data, d.tipo, limparNome(d.descricao), d.valor]),
    totais: { 3: 'soma' },
  });

  // Simulação do pró-labore: entradas − saídas operacionais, ANTES dos sócios.
  const nSocios = 2; const valorSocio = 2000;
  aba({
    nome: 'Pró-labore (simulação)', descricao: 'Quanto sobra por mês antes dos sócios, e se cobre o pró-labore proposto.',
    notas: [
      'Resultado antes dos sócios = entradas de caixa (vendas + fiado recebido, sem aporte) − saídas operacionais e variáveis (sem pró-labore, sem distribuição de lucros e sem investimento/dívida).',
      'Muda o número de sócios e o valor do pró-labore nas células AMARELAS: as colunas G a K recalculam sozinhas. O último mês costuma estar incompleto — olha a coluna "Mês completo?".',
    ],
    parametros: [{ rotulo: 'Número de sócios', valor: nSocios, t: 'int' }, { rotulo: 'Pró-labore por sócio (R$ por mês)', valor: valorSocio, t: 'brl' }],
    colunas: [
      // Coluna larga de propósito: os rótulos dos parâmetros (amarelos) moram nela.
      { h: 'Mês', w: 34 }, { h: 'Mês completo?', w: 12 }, { h: 'Entradas de caixa (sem aporte)', t: 'brl', w: 17 }, { h: 'Saídas operacionais e variáveis', t: 'brl', w: 17 }, { h: 'Resultado antes dos sócios', t: 'brl', w: 16 },
      { h: 'Retiradas já lançadas (pró-labore + lucros)', t: 'brl', w: 18 }, { h: 'Pró-labore proposto (sócios × valor)', t: 'brl', w: 17 }, { h: 'Sobra depois do pró-labore proposto', t: 'brl', w: 17 }, { h: 'Dias com movimento', t: 'int', w: 11 }, { h: 'Sobra por dia de movimento', t: 'brl', w: 15 }, { h: 'Cobre o pró-labore?', w: 12 },
    ],
    linhas: resumoMes.map((x) => {
      const entr = r2(x.entradas - soma(fluxo.filter((d) => ymOf(d.data) === x.m), (d) => d.aporte));
      const res = r2(entr - x.op);
      const prop = nSocios * valorSocio;
      const sobra = r2(res - prop);
      return [
        rotuloMes(x.m), x.parcial ? 'Não (parcial)' : 'Sim', entr, x.op, { f: 'C{r}-D{r}', v: res }, x.ret,
        { f: '{P0}*{P1}', v: prop }, { f: 'E{r}-G{r}', v: sobra }, x.diasMov,
        { f: 'IF(I{r}>0,H{r}/I{r},"")', v: x.diasMov ? r2(sobra / x.diasMov) : '' },
        { f: 'IF(H{r}>=0,"Sim","Não")', v: sobra >= 0 ? 'Sim' : 'Não' },
      ];
    }),
    totais: { 2: 'soma', 3: 'soma', 4: 'soma', 5: 'soma', 6: 'soma', 7: 'soma', 8: 'soma' },
  });

  // Contas a pagar / a receber.
  const abertas = agruparContasAbertas(compras.filter((c) => c && c.pago !== 'Sim' && c.vencimento));
  const diffDias = (a, b) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000);
  aba({
    nome: 'Contas a pagar', descricao: 'Tudo que está em aberto, por vencimento.',
    notas: [`Posição em ${hoje}. Uma linha = um boleto (os itens da mesma nota somados).`],
    colunas: [{ h: 'Vencimento', t: 'data', w: 12 }, { h: 'Fornecedor', w: 26 }, { h: 'Nota', w: 14 }, { h: 'Valor', t: 'brl', w: 14 }, { h: 'Situação', w: 22 }, { h: 'Dias para vencer', t: 'int', w: 12 }, { h: 'Forma de pagamento', w: 18 }],
    linhas: abertas.map((g) => {
      const dd = diffDias(g.vencimento, hoje);
      return [g.vencimento, limparNome(g.fornecedor), g.nota || '', r2(g.total), dd < 0 ? `Vencida há ${-dd} dia(s)` : (dd === 0 ? 'Vence hoje' : `Vence em ${dd} dia(s)`), dd, g.formaPagto || ''];
    }),
    totais: { 3: 'soma' },
  });

  const devendo = new Map();
  let anon = 0; const apelido = new Map();
  for (const v of todasVendas) {
    const a = abertoDaVenda(v);
    if (a <= 0.005) continue;
    const nomeV = limparNome(v.nome) || `Mesa ${v.mesa}`;
    const k = chaveCliente(nomeV);
    const x = devendo.get(k) || { nome: nomeV, aberto: 0, n: 0, mais: v.data, recente: v.data };
    x.aberto = r2(x.aberto + a); x.n += 1; if (v.data < x.mais) x.mais = v.data; if (v.data > x.recente) x.recente = v.data;
    devendo.set(k, x);
  }
  const limiteDe = (nomeV) => { const c = clientes.find((x) => chaveCliente(x.nome) === chaveCliente(nomeV)); return c ? (num(c.limite) || null) : null; };
  aba({
    nome: 'Contas a receber', descricao: 'O fiado em aberto por cliente, com a idade da dívida.',
    notas: [nomes ? `Posição em ${hoje}. Fiado ainda não pago, somando todas as comandas do cliente.` : `Posição em ${hoje}. Nomes ocultados a pedido (Cliente 1, 2…), do maior para o menor valor.`],
    colunas: [{ h: 'Cliente', w: 28 }, { h: 'Em aberto', t: 'brl', w: 14 }, { h: 'Comandas em aberto', t: 'int', w: 12 }, { h: 'Fiado mais antigo', t: 'data', w: 14 }, { h: 'Fiado mais recente', t: 'data', w: 14 }, { h: 'Dias do mais antigo', t: 'int', w: 12 }, { h: 'Limite de fiado', t: 'brl', w: 13 }],
    linhas: [...devendo.values()].sort((a, b) => b.aberto - a.aberto).map((x) => {
      if (!apelido.has(x.nome)) { anon += 1; apelido.set(x.nome, `Cliente ${anon}`); }
      return [nomes ? x.nome : apelido.get(x.nome), x.aberto, x.n, x.mais, x.recente, diffDias(hoje, x.mais), nomes ? limiteDe(x.nome) : null];
    }),
    totais: { 1: 'soma', 2: 'soma' },
  });

  // ---------------------------------------------------------- CLIENTES E DIÁRIO
  if (nomes) {
    aba({
      nome: 'Clientes', descricao: 'Clientes cadastrados (os do fiado).',
      notas: [telefones ? 'Inclui telefones, a pedido. São dados pessoais: manda só para quem precisa.' : 'Sem telefones (não foram marcados na hora de baixar).'],
      colunas: [{ h: 'Nome', w: 30 }, ...(telefones ? [{ h: 'Telefone', w: 18 }] : []), { h: 'Limite de fiado', t: 'brl', w: 13 }, { h: 'Fiado em aberto', t: 'brl', w: 14 }, { h: 'Bloqueado para fiado?', w: 14 }],
      linhas: [...clientes].sort((a, b) => String(a.nome).localeCompare(String(b.nome))).map((c) => {
        const d = devendo.get(chaveCliente(c.nome));
        return [limparNome(c.nome), ...(telefones ? [c.telefone || ''] : []), num(c.limite) || null, d ? d.aberto : 0, c.bloquear ? 'Sim' : 'Não'];
      }),
    });
  }
  aba({
    nome: 'Diário e clima', descricao: 'O que foi anotado no Diário: clima, eventos, problemas e decisões.',
    notas: ['O PicoOS não guarda o tempo. Só tem clima nos dias em que o campo "Clima" foi preenchido no Diário.'],
    colunas: [{ h: 'Data', t: 'data', w: 12 }, { h: 'Dia da semana', w: 15 }, { h: 'Clima', w: 16 }, { h: 'Evento', w: 24 }, { h: 'Receita anotada', t: 'brl', w: 14 }, { h: 'Pedidos', t: 'int', w: 9 }, { h: 'Relato / nota', w: 44 }, { h: 'Problema', w: 30 }, { h: 'Decisão', w: 30 }, { h: 'Aprendizado', w: 30 }],
    linhas: [...diario].filter((d) => noPeriodo(d.data)).sort((a, b) => String(a.data).localeCompare(String(b.data))).map((d) => [d.data, weekday(d.data), d.clima || '', d.evento || '', num(d.receita) || null, num(d.nPedidos) || null, d.relato || d.nota || '', d.problema || '', d.decisao || '', d.aprendizado || '']),
  });

  // ------------------------------------------------------------ CONFERÊNCIAS
  // O que o próprio PicoOS acha que merece uma olhada ANTES de decidir qualquer
  // coisa em cima dos números. Não corrige nada: aponta, e ela marca "Resolvido".
  const conferencias = [];
  const dinheiro = (v) => `R$ ${r2(v).toFixed(2).replace('.', ',')}`;
  const ddmmTxt = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  const gruposDesp = new Map();
  for (const d of despRows) { if (!(d.valor > 0)) continue; const k = `${d.data}|${d.valor.toFixed(2)}`; (gruposDesp.get(k) || gruposDesp.set(k, []).get(k)).push(d); }
  for (const [, g] of [...gruposDesp.entries()].filter(([, g]) => g.length > 1).sort((a, b) => a[0].localeCompare(b[0]))) {
    conferencias.push(['Possível despesa repetida', g[0].data, `${g.length} lançamentos de ${dinheiro(g[0].valor)} no mesmo dia: ${g.map((d) => `${d.categoria || 'sem categoria'}${limparNome(d.descricao) ? ' — ' + limparNome(d.descricao) : ''}`).join(' | ')}.`, g[0].valor * g.length, 'Aba Despesas · Finanças → Despesas. Se uma compra paga já gerou a despesa e ela foi lançada de novo à mão, apaga uma.']);
  }
  for (const x of diasConc.filter((y) => y.sit === 'Falta lançar o caixa deste dia')) {
    conferencias.push(['Comandas sem caixa lançado', x.d.data, `${x.x.n} comanda(s) fechada(s), ${dinheiro(x.total)} no total, e nenhum caixa lançado em ${ddmmTxt(x.d.data)}. O faturamento do dia aparece zerado.`, x.total, 'Aba Conciliação comandas e caixa · Finanças → Receitas']);
  }
  for (const x of diasConc.filter((y) => y.sit === 'Caixa lançado sem comandas')) {
    conferencias.push(['Caixa sem comandas', x.d.data, `Caixa lançado de ${dinheiro(x.d.vendas)} em ${ddmmTxt(x.d.data)}, mas nenhuma comanda fechada nesse dia (venda fora do sistema?).`, x.d.vendas, 'Aba Conciliação comandas e caixa']);
  }
  for (const c of cardOrdenado) {
    if (c.ativo === false) continue;
    const k = custoPrato(c);
    if (!k) conferencias.push(['Item sem ficha técnica', null, `${limparNome(c.nome)} (${c.categoria || 'sem categoria'}), preço ${dinheiro(num(c.preco))}: sem ficha, o custo e a margem ficam em branco.`, num(c.preco), 'Aba Cardápio · Cozinha → Fichas']);
    else if (!k.completo) conferencias.push(['Ficha com custo faltando', null, `${limparNome(c.nome)}: falta custo de ${k.faltando.join(', ')}. A margem fica subestimada.`, num(c.preco), 'Aba Fichas técnicas · Abastecimento → Estoque']);
  }
  aba({
    nome: 'Conferências', descricao: 'O que o PicoOS aponta para conferir antes de decidir: despesas repetidas, dias sem caixa, itens sem ficha.',
    notas: ['O app só APONTA, não corrige nada. Marca "Resolvido?" (célula amarela) conforme for conferindo. Uma despesa "repetida" pode ser legítima (duas compras do mesmo valor no mesmo dia): olha a descrição.'],
    colunas: [{ h: 'Tipo', w: 28 }, { h: 'Data', t: 'data', w: 12 }, { h: 'O que encontrei', w: 90 }, { h: 'Valor', t: 'brl', w: 14 }, { h: 'Onde conferir', w: 50 }, { h: 'Resolvido?', w: 14, entrada: true }],
    linhas: conferencias.map((c) => [...c, '']),
  });

  // ------------------------------------------------------------- MAPA E LEIA-ME
  const ordem = ['Mapa do pedido', 'Conferências', 'Resumo mensal', 'Fluxo de caixa diário', 'Pró-labore (simulação)', 'Retiradas dos sócios', 'Despesas', 'Custos por categoria', 'Contas a pagar', 'Contas a receber',
    'Vendas por dia', 'Conciliação comandas e caixa', 'Dia da semana', 'Maiores e menores dias', 'Almoço por dia', 'Vendas por hora', 'Vendas por produto', 'Bebidas e chopp', 'Cardápio', 'Fichas técnicas', 'Produtos e custos', 'Compras (notas)',
    'Fornecedores', 'Cotações', 'Melhor preço', 'Clientes', 'Diário e clima'];
  aba({
    nome: 'Mapa do pedido', descricao: 'O pedido do analista, item por item: o que está no pacote e o que só o dono responde.',
    notas: ['Na última coluna, escreve a resposta dos itens que o PicoOS não tem e devolve a planilha.'],
    colunas: [{ h: 'Assunto', w: 22 }, { h: 'O que o analista pediu', w: 52 }, { h: 'Situação', w: 28 }, { h: 'Onde está', w: 36 }, { h: 'Observação', w: 70 }, { h: 'Tua resposta', w: 50, entrada: true }],
    linhas: MAPA.map((m) => [...m, '']),
  });
  const porNome = new Map(abas.map((a) => [a.nome, a]));
  const ordenadas = ordem.map((n) => porNome.get(n)).filter(Boolean);
  const periodoTxt = `${ini.slice(8, 10)}/${ini.slice(5, 7)}/${ini.slice(0, 4)} a ${fim.slice(8, 10)}/${fim.slice(5, 7)}/${fim.slice(0, 4)}`;
  const leia = {
    nome: 'Leia-me', descricao: '', parametros: [],
    notas: [
      `Pacote do PicoOS${nomeNegocio ? ` — ${nomeNegocio}` : ''}`,
      `Período dos dados: ${periodoTxt}. Gerado em ${new Date(geradoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`,
      'Tem dinheiro e dados do negócio: manda só para quem precisa. Salário de cada funcionário não vai neste arquivo.',
      'CRITÉRIOS: faturamento = caixa lançado + fiado do dia. O dia do bar vira às 6h da manhã. Fluxo de caixa = dinheiro que entrou e saiu (o fiado a receber fica de fora até ser pago).',
      'CUSTO DOS PRATOS = custo atual dos ingredientes (estoque) × quantidade da ficha técnica, o mesmo cálculo do CMV do PicoOS. Prato sem ficha fica sem custo.',
      `ALMOÇO = comanda paga entre ${ALMOCO.de}h e ${ALMOCO.ate}h. PESSOAS = número que o garçom informa ao fechar a comanda (quando não informa, o dia não entra na média).`,
      'Cada aba tem, no alto, uma linha explicando como foi calculada. Se um número parecer estranho, a explicação está ali.',
    ],
    colunas: [{ h: 'Aba', w: 28 }, { h: 'O que tem', w: 100 }],
    linhas: ordenadas.map((a) => [a.nome, a.descricao]),
  };
  const finais = [leia, ...ordenadas];
  return { periodo: { ini, fim }, geradoEm, abas: finais };
}
