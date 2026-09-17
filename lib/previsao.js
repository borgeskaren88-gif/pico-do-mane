import { num, brl, addDays, ymOf, diaOperacional, fiadoDaVenda, abertoDaVenda, limparNome, classificarFiado } from './util';

// Duas contas que o DRE não responde:
//
//   1) O QUE VEM: quanto entra e quanto sai nos próximos 30 dias, dia a dia.
//   2) O QUE É MEU DE VERDADE: o mês pode fechar "positivo" e ainda assim não
//      haver dinheiro, porque tem conta em aberto pra pagar. Lucro no papel não
//      paga fornecedor.
//
// Regra da casa aqui: toda estimativa vem acompanhada de quantos dias de
// histórico a sustentam. Número sem lastro é chute, e com o dinheiro dela não
// vale chutar em silêncio.
const arr = (v) => (Array.isArray(v) ? v : []);
const cent = (v) => Math.round(num(v) * 100) / 100;
const diaSemanaNum = (iso) => { try { return new Date(iso + 'T12:00:00').getDay(); } catch { return 0; } };

// Despesas que se repetem todo mês e NÃO passam por Compras. Isso importa: uma
// compra paga vira despesa também, então somar "contas a pagar" com o histórico
// de despesas contaria a mesma coisa duas vezes. Estas categorias são sempre
// lançadas direto, nunca vêm de compra de mercadoria.
export const FIXAS_MENSAIS = [
  'Pró-labore (sócios)', 'Salários', 'Encargos e benefícios',
  'Aluguel', 'Energia elétrica', 'Água/esgoto', 'Gás',
  'Internet/Wifi', 'Assinaturas', 'Sistemas', 'Contabilidade',
  'Impostos (DAS MEI)', 'Taxa de lixo', 'Alvarás e licenças', 'Seguros',
];

const totalCompra = (c) => num(c.quantidade) * num(c.valorUnit);

// ---------------------------------------------------------------------------
// 1) O QUE VEM: os próximos 30 dias
// ---------------------------------------------------------------------------

// Quanto cada dia da semana costuma pôr NO CAIXA (venda menos o que ficou no
// fiado — fiado não é dinheiro no dia em que a mesa fecha).
function caixaPorDiaSemana(vendas, hoje, semanas = 8) {
  const desde = addDays(hoje, -semanas * 7);
  const dias = Array.from({ length: 7 }, () => ({ soma: 0, datas: new Set() }));
  for (const v of arr(vendas)) {
    const d = v && v.data;
    if (!d || d < desde || d >= hoje) continue;
    const i = diaSemanaNum(d);
    dias[i].soma += num(v.total) - fiadoDaVenda(v);
    dias[i].datas.add(d);
  }
  return dias.map((x) => ({ media: x.datas.size ? x.soma / x.datas.size : 0, dias: x.datas.size }));
}

// Média mensal das despesas fixas, pelos últimos meses FECHADOS (o mês corrente
// está pela metade e puxaria a média pra baixo).
function fixasPorMes(despesas, hoje, meses = 3) {
  const ymAtual = ymOf(hoje);
  const soma = new Map();
  for (const d of arr(despesas)) {
    if (!d || !FIXAS_MENSAIS.includes(d.categoria)) continue;
    const ym = ymOf(d.data);
    if (!ym || ym >= ymAtual) continue;
    soma.set(ym, (soma.get(ym) || 0) + num(d.valor));
  }
  const ultimos = [...soma.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, meses);
  if (!ultimos.length) return { media: 0, meses: 0 };
  return { media: cent(ultimos.reduce((s, [, v]) => s + v, 0) / ultimos.length), meses: ultimos.length };
}

export function previsao30(dados = {}, vendas = [], hoje = diaOperacional()) {
  const { despesas = [], compras = [] } = dados;
  const ate = addDays(hoje, 30);

  const porDia = caixaPorDiaSemana(vendas, hoje);
  const diasComBase = porDia.filter((x) => x.dias > 0).length;

  // Contas a pagar já lançadas, com data. Isso não é estimativa — é certeza.
  const abertas = arr(compras).filter((c) => c && c.pago !== 'Sim' && c.vencimento);
  const vencidas = abertas.filter((c) => c.vencimento < hoje);
  const naJanela = abertas.filter((c) => c.vencimento >= hoje && c.vencimento <= ate);

  // Fiado velho: pelo ciclo do bar, o que é do mês passado vence dia 10.
  const idade = classificarFiado(arr(vendas), ymOf(hoje));
  const aReceberAgora = cent(arr(vendas)
    .filter((v) => idade.balde.get(v.id) !== 'proximo')
    .reduce((s, v) => s + abertoDaVenda(v), 0));

  const fixas = fixasPorMes(despesas, hoje);
  const fixaPorDia = fixas.media / 30;

  // O dia a dia: entra a média do dia da semana, sai o que vence naquele dia,
  // mais a fatia diária das fixas.
  const linhas = [];
  let saldo = 0;
  for (let i = 1; i <= 30; i++) {
    const d = addDays(hoje, i);
    const entra = cent(porDia[diaSemanaNum(d)].media);
    const contas = naJanela.filter((c) => c.vencimento === d);
    const sai = cent(contas.reduce((s, c) => s + totalCompra(c), 0) + fixaPorDia);
    // O fiado do ciclo cai no dia 10.
    const fiadoHoje = (Number(d.slice(8, 10)) === 10) ? aReceberAgora : 0;
    saldo += entra + fiadoHoje - sai;
    linhas.push({
      data: d, entra: cent(entra + fiadoHoje), sai, saldo: cent(saldo),
      contas: contas.map((c) => ({ nome: limparNome(c.fornecedor) || limparNome(c.produto) || 'Conta', valor: cent(totalCompra(c)) })),
      fiado: fiadoHoje,
    });
  }

  const totalEntra = cent(linhas.reduce((s, l) => s + l.entra, 0));
  const totalSai = cent(linhas.reduce((s, l) => s + l.sai, 0) + vencidas.reduce((s, c) => s + totalCompra(c), 0));
  // O pior momento do mês: é aí que o caixa aperta, e é o que ela precisa ver.
  const pior = linhas.reduce((p, l) => (l.saldo < p.saldo ? l : p), linhas[0] || { saldo: 0, data: hoje });

  return {
    hoje, ate, linhas,
    entra: totalEntra, sai: totalSai, sobra: cent(totalEntra - totalSai),
    vencidas: cent(vencidas.reduce((s, c) => s + totalCompra(c), 0)), nVencidas: vencidas.length,
    contasNaJanela: cent(naJanela.reduce((s, c) => s + totalCompra(c), 0)), nContas: naJanela.length,
    fiadoPrevisto: aReceberAgora,
    fixas: fixas.media, mesesDeFixas: fixas.meses,
    diasComBase, confiavel: diasComBase >= 3 && fixas.meses >= 1,
  };
}

// ---------------------------------------------------------------------------
// 2) O QUE SOBROU DE VERDADE
// ---------------------------------------------------------------------------
// O DRE do mês diz o resultado da OPERAÇÃO. Isto aqui responde outra coisa:
// desse dinheiro, quanto ainda é dela depois de honrar o que já deve.
export function disponivelDeVerdade(dados = {}, vendas = [], mes = ymOf(diaOperacional())) {
  const { receitas = [], despesas = [], compras = [], estoque = [] } = dados;
  const noMes = (d) => ymOf(d && d.data) === mes;

  const entrou = cent(arr(receitas).filter(noMes).reduce((s, r) => s + num(r.valor), 0));
  const saiu = cent(arr(despesas).filter(noMes).reduce((s, d) => s + num(d.valor), 0));
  const noPapel = cent(entrou - saiu);

  // Tudo que ela deve e ainda não pagou — não só o do mês. Dívida não some
  // porque virou o mês.
  const abertas = arr(compras).filter((c) => c && c.pago !== 'Sim');
  const aPagar = cent(abertas.reduce((s, c) => s + totalCompra(c), 0));

  // Tudo que têm pra receber de fiado.
  const aReceber = cent(arr(vendas).reduce((s, v) => s + abertoDaVenda(v), 0));

  const disponivel = cent(noPapel - aPagar + aReceber);
  const emEstoque = cent(arr(estoque).reduce((s, it) => s + num(it.saldo) * num(it.custo), 0));

  return {
    mes, entrou, saiu, noPapel, aPagar, nAPagar: abertas.length, aReceber, disponivel, emEstoque,
    // O recado em uma frase, que é o que ela lê primeiro.
    recado: disponivel < 0
      ? 'Contando o que tu ainda deve, o mês está negativo. O lucro do papel já está comprometido.'
      : noPapel > disponivel
        ? `Do que sobrou no papel, ${brl(cent(noPapel - disponivel))} já tem dono: são contas em aberto. O que é teu mesmo é ${brl(disponivel)}.`
        : `Sobrou ${brl(disponivel)} de verdade — e isso já conta o que tu tem pra pagar e pra receber.`,
  };
}
