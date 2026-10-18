import { num, todayISO, FONTES_NAO_OPERACIONAL, MESES } from './util';

// O TETO DO MEI — e quando ela vai bater nele.
//
// Estourar o limite sem perceber é dos perrengues mais caros que existem pra
// quem é MEI, e ele não avisa: chega como notificação da Receita no ano
// seguinte, com imposto retroativo. Quem acompanha mês a mês quase nunca
// estoura; quem só descobre em dezembro não tem o que fazer.
//
// O sistema já tem toda a receita lançada. Então ele pode somar o ano e dizer
// a única coisa que importa: NO RITMO DE AGORA, QUANDO ACABA?
//
// AS REGRAS (2026):
//   - teto de R$ 81.000 por ano-calendário, o mesmo desde 2018;
//   - passar até 20% (até R$ 97.200): fica MEI até 31/12, paga um DAS
//     complementar sobre o excesso e é desenquadrada a partir de 1º de janeiro
//     do ano seguinte;
//   - passar de mais de 20% (acima de R$ 97.200): o desenquadramento é
//     RETROATIVO a 1º de janeiro do ano em curso — o ano inteiro vira Simples
//     Nacional de uma vez. É o caso caro, e é o que este aviso existe pra
//     evitar.
//
// O VALOR FICA EDITÁVEL de propósito. Há projeto aprovado pra subir o teto
// (R$ 110 mil em 2027, R$ 140 mil em 2028), pendente de sanção. Número de lei
// chumbado no código vira mentira silenciosa no dia em que a lei muda — e
// ninguém lembra de vir aqui consertar. Melhor um campo que ela ajusta sozinha.
export const TETO_MEI_PADRAO = 81000;
export const TOLERANCIA = 0.20;

const diaDoAno = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  const jan = new Date(`${iso.slice(0, 4)}-01-01T12:00:00`);
  return Math.round((d - jan) / 86400000) + 1;
};
const bissexto = (ano) => (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
// Dia do ano -> "12 de março". Serve pra ela saber em que altura do ano o
// ritmo atual bate no teto.
const dataDoDia = (ano, n) => {
  const d = new Date(`${ano}-01-01T12:00:00`);
  d.setDate(d.getDate() + Math.max(0, n - 1));
  return { mes: d.getMonth(), dia: d.getDate(), texto: `${d.getDate()} de ${['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][d.getMonth()]}`, curto: `${String(d.getDate()).padStart(2, '0')}/${MESES[d.getMonth()]}` };
};

// FATURAMENTO não é tudo que entra no caixa. Empréstimo e aporte entram como
// dinheiro e não são venda — não contam pro teto. É a mesma régua que o lucro
// operacional usa no relatório, pelo mesmo motivo.
export function faturamentoDoAno(receitas = [], ano) {
  return Math.round(
    (receitas || [])
      .filter((r) => r && String(r.data || '').slice(0, 4) === String(ano) && !FONTES_NAO_OPERACIONAL.includes(r.categoria))
      .reduce((s, r) => s + num(r.valor), 0) * 100,
  ) / 100;
}

export function olharOTeto({ receitas = [], teto = TETO_MEI_PADRAO, hoje = todayISO() } = {}) {
  const ano = Number(hoje.slice(0, 4));
  const limite = num(teto) > 0 ? num(teto) : TETO_MEI_PADRAO;
  const limiteTolerancia = Math.round(limite * (1 + TOLERANCIA) * 100) / 100;
  const faturado = faturamentoDoAno(receitas, ano);
  const pct = (faturado / limite) * 100;

  const dias = diaDoAno(hoje);
  const diasNoAno = bissexto(ano) ? 366 : 365;
  // A média sai por DIA, não por mês: em outubro o mês corrente está pela
  // metade, e dividir por "10 meses" faria o ritmo parecer menor do que é —
  // justo no número que serve pra avisar.
  const mediaDiaria = dias > 0 ? faturado / dias : 0;
  const projecao = Math.round(mediaDiaria * diasNoAno * 100) / 100;

  // Em que dia do ano o ritmo de agora bate no teto. Só faz sentido se o ritmo
  // levar lá dentro deste ano.
  let estouro = null;
  if (mediaDiaria > 0) {
    const diaQueBate = Math.ceil(limite / mediaDiaria);
    if (diaQueBate <= diasNoAno) estouro = { dia: diaQueBate, ...dataDoDia(ano, diaQueBate), jaPassou: diaQueBate <= dias };
  }

  const nivel = faturado > limiteTolerancia ? 'estourou'
    : faturado > limite ? 'passou'
      : pct >= 85 ? 'perto'
        : pct >= 60 ? 'atencao'
          : 'tranquilo';

  return {
    ano, faturado, limite, limiteTolerancia, pct, dias, diasNoAno, mediaDiaria, projecao, estouro, nivel,
    // Quanto ainda cabe até o teto (nunca negativo — o que passou vira outro recado).
    folga: Math.round(Math.max(0, limite - faturado) * 100) / 100,
    excesso: Math.round(Math.max(0, faturado - limite) * 100) / 100,
    // No ritmo de agora, a projeção estoura mesmo sem ter estourado ainda?
    vaiEstourar: projecao > limite,
  };
}
