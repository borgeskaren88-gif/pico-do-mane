import { num, numQtd, ymOf, mesLabel, DESPESA_OPERACIONAL, JUROS_ATRASO } from './util';

// O RATEIO DO CUSTO FIXO — salário, aluguel, luz, gás, divididos por unidade.
//
// "Mão de obra não se põe também?"
//
// Na ficha, não — e é o mesmo motivo do gás: a cozinheira ganha igual no sábado
// cheio e na terça parada. Salário não sobe porque saiu mais porção, então não
// é custo DO prato; é custo da casa. Pôr na ficha dobraria o mesmo dinheiro no
// resultado, porque "Salários", "Encargos" e "Pró-labore" já são despesa
// operacional no DRE.
//
// MAS A PERGUNTA DELA ESTÁ CERTA NO QUE IMPORTA: mão de obra num bar costuma
// pesar MUITO mais que luz e gás. Ignorar isso na hora de pôr preço é bem pior
// que ignorar a conta de energia. Só que o lugar disso não é a ficha — é aqui:
//
//     rateio por unidade = despesa de casa do mês ÷ unidades vendidas no mês
//
// E isso o sistema calcula sozinho, porque conhece as duas pontas. Ela não
// precisa estimar nada.
//
// A DIVISÃO É POR CABEÇA, e isso é grosseiro de propósito: um chopp e um
// camarão não dão o mesmo trabalho pra cozinha. Dividir pelo tempo de preparo
// seria mais justo e exigiria ela cronometrar cada prato — coisa que não vai
// acontecer num bar em pé. Grosseiro e usado vale mais que exato e vazio; a
// tela avisa que é média.

// O ÚLTIMO MÊS FECHADO, não o corrente.
//
// No meio do mês o aluguel inteiro já foi lançado e só metade das vendas
// aconteceu — o rateio sairia quase o dobro do real. Mês fechado tem as duas
// pontas completas.
export function mesFechadoAnterior(hojeISO) {
  const y = Number(String(hojeISO).slice(0, 4));
  const m = Number(String(hojeISO).slice(5, 7));
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function rateioDoMes({ despesas = [], vendas = [], mes } = {}) {
  if (!mes) return null;
  // Só a despesa de CASA. Custo variável (mercadoria) fica de fora: ele já
  // está na ficha técnica, item por item. Somar aqui também seria contar o
  // ingrediente duas vezes no preço.
  //
  // E JUROS DE BOLETO ATRASADO TAMBÉM FICA DE FORA, embora seja despesa
  // operacional no DRE. Aluguel e salário são o preço de manter a casa aberta
  // pra vender; juros de atraso é o preço de ter pago uma conta fora do prazo.
  // Deixar entrar faria o rateio subir e a tela de preço mandar ela cobrar
  // mais caro no cardápio por causa de um boleto pago tarde — e meses depois
  // ninguém saberia de onde veio o aumento.
  const doMes = (despesas || []).filter((d) => d && ymOf(d.data) === mes
    && DESPESA_OPERACIONAL.includes(d.categoria) && d.categoria !== JUROS_ATRASO);
  const casa = Math.round(doMes.reduce((s, d) => s + num(d.valor), 0) * 100) / 100;

  let unidades = 0;
  for (const v of vendas || []) {
    if (!v || ymOf(v.data) !== mes) continue;
    for (const it of v.itens || []) unidades += numQtd(it && it.qtd);
  }
  unidades = Math.round(unidades * 100) / 100;

  if (!(casa > 0) || !(unidades > 0)) {
    return { mes, rotulo: mesLabel(mes), casa, unidades, porUnidade: null, falta: !(casa > 0) ? 'despesas' : 'vendas' };
  }
  // As três linhas que mais pesam, pra ela ver de onde vem o número em vez de
  // ter que confiar nele.
  const porCategoria = {};
  for (const d of doMes) porCategoria[d.categoria || '—'] = (porCategoria[d.categoria || '—'] || 0) + num(d.valor);
  const maiores = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([cat, val]) => ({ cat, val: Math.round(val * 100) / 100 }));

  return {
    mes, rotulo: mesLabel(mes), casa, unidades,
    porUnidade: Math.round((casa / unidades) * 100) / 100,
    maiores,
  };
}
