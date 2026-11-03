import { num, ymOf } from './util';

// QUANTO DEVERIA TER NO CAIXA HOJE.
//
// "Mês passado estava com saldo final de 300,00, aí virou o mês e fica tudo
// zerado no Dashboard, e eu acho isso ótimo, porém no final das contas eu não
// sei quanto eu deveria ter em caixa."
//
// O Dashboard conta o MÊS, e tem que contar mesmo: é como ela sabe se este mês
// está indo bem. Mas o dinheiro não zera na virada — os R$ 300 que sobraram em
// outubro continuaram na gaveta no dia 1º de novembro. Faltava o número que
// atravessa os meses.
//
// POR QUE NÃO SOMAR TUDO DESDE O COMEÇO:
//
// Porque isso só daria certo se cada centavo que entrou e saiu na vida do bar
// estivesse lançado aqui, desde o primeiro dia. Não está, e nunca vai estar —
// ela começou a usar o PicoOS no meio do caminho, e sempre vai haver o dia em
// que alguém pagou algo e esqueceu de anotar. Um número errado com cara de
// certo é pior que número nenhum: ela confere, não bate, e para de acreditar.
//
// Então a conta parte de uma ÂNCORA: o dia em que ela contou o dinheiro e
// disse quanto tinha. Dali pra frente é só somar o que entrou e tirar o que
// saiu.
//
//     deveria ter = o que ela contou na última conferência
//                   + tudo que entrou depois
//                   − tudo que saiu depois
//
// E isso se conserta sozinho: cada conferência nova vira a âncora, e o erro
// acumulado volta a zero. A diferença encontrada é informação, não fracasso —
// é ela que mostra a despesa que ninguém lançou.
//
// AQUI ENTRA TUDO, ao contrário do DRE. Empréstimo que entrou, equipamento que
// ela comprou, lucro que ela tirou pra si: nada disso é resultado da operação,
// mas tudo isso MEXEU NO DINHEIRO. A pergunta aqui não é "o bar deu lucro?",
// é "quanto tem na mão?".

const n2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const arr = (v) => (Array.isArray(v) ? v : []);

// A conferência que vale: a mais recente que já aconteceu. Data no futuro é
// erro de digitação e não pode virar âncora — jogaria o saldo pro espaço.
export function ancoraDe(conferencias, hoje) {
  return arr(conferencias)
    .filter((c) => c && c.data && c.valor != null && c.data <= hoje)
    .sort((a, b) => String(a.data).localeCompare(String(b.data)) || String(a.criadoEm || '').localeCompare(String(b.criadoEm || '')))
    .pop() || null;
}

export function saldoDoBar({ receitas = [], despesas = [], conferencias = [], hoje } = {}) {
  const ancora = ancoraDe(conferencias, hoje);
  // Depois da conferência, não no dia dela: quem conta o dinheiro conta o que
  // já aconteceu. Incluir o próprio dia somaria duas vezes o movimento daquele
  // dia — uma na contagem dela, outra na soma daqui.
  const conta = (lista) => n2(arr(lista)
    .filter((d) => d && d.data && d.data <= hoje && (!ancora || d.data > ancora.data))
    .reduce((s, d) => s + num(d.valor), 0));

  const entrou = conta(receitas);
  const saiu = conta(despesas);
  const base = ancora ? n2(ancora.valor) : 0;

  return {
    ancora,
    desde: ancora ? ancora.data : null,
    base,
    entrou,
    saiu,
    esperado: n2(base + entrou - saiu),
    // Sem âncora o número existe, mas vale o que valem os lançamentos: tudo.
    // A tela precisa saber disso pra não apresentar chute como certeza.
    semAncora: !ancora,
  };
}

// O histórico, do mais novo pro mais velho, já com a diferença de cada vez.
// A diferença é o que interessa de verdade: uma conferência que fecha certo é
// um alívio; três seguidas faltando R$ 50 é um problema com nome e endereço.
export function historicoConferencias(conferencias) {
  return arr(conferencias)
    .filter((c) => c && c.data)
    .map((c) => ({ ...c, diferenca: n2(num(c.valor) - num(c.esperado)) }))
    .sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')));
}

// O que sobrou no fim de cada mês fechado, pra ela ver a linha do tempo que o
// Dashboard zera. Parte da âncora e vai somando mês a mês.
export function porMes({ receitas = [], despesas = [], conferencias = [], hoje, quantos = 6 } = {}) {
  const ancora = ancoraDe(conferencias, hoje);
  const desde = ancora ? ancora.data : null;
  const meses = [...new Set([
    ...arr(receitas).map((r) => r && r.data),
    ...arr(despesas).map((d) => d && d.data),
  ].filter(Boolean).filter((d) => d <= hoje && (!desde || d > desde)).map(ymOf))].sort();

  let acumulado = ancora ? n2(ancora.valor) : 0;
  const linhas = meses.map((m) => {
    const ent = n2(arr(receitas).filter((r) => r && r.data && r.data <= hoje && (!desde || r.data > desde) && ymOf(r.data) === m).reduce((s, r) => s + num(r.valor), 0));
    const sai = n2(arr(despesas).filter((d) => d && d.data && d.data <= hoje && (!desde || d.data > desde) && ymOf(d.data) === m).reduce((s, d) => s + num(d.valor), 0));
    acumulado = n2(acumulado + ent - sai);
    return { mes: m, entrou: ent, saiu: sai, doMes: n2(ent - sai), acumulado };
  });
  return linhas.slice(-quantos).reverse();
}
