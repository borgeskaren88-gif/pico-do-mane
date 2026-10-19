import { num, numQtd, ymOf } from './util';

// O ÓLEO DA FRITADEIRA — o custo que some de toda ficha técnica.
//
// Ela paga R$ 189 num galão de 14,5 L e a ficha da Batata Frita Clássica tem
// UM ingrediente: batata. O óleo não aparece em lugar nenhum do custo, então o
// CMV do mês sai melhor do que é e o preço de cada frito sai calculado por
// baixo. Não é descuido dela: ninguém sabe dizer "quantos ml de óleo tem numa
// porção de batata". A pergunta não tem resposta direta.
//
// MAS TEM RESPOSTA INDIRETA, e é por aí que esta conta vai. O óleo não se gasta
// porção por porção — ele se gasta até a hora de trocar. Então o que custa é o
// GALÃO INTEIRO, dividido por tudo que foi frito até a troca:
//
//     porções por galão = dias até trocar × porções fritas por dia
//     custo por porção  = preço do galão ÷ porções por galão
//
// As duas perguntas que sobram ela sabe responder de cabeça ("troco de 7 em 7
// dias") — e a segunda nem precisa: o sistema conta as vendas dos pratos que
// ela marcar como fritos.
//
// É UMA APROXIMAÇÃO, e a tela diz isso. Uma isca de tilápia e uma porção de
// batata não castigam o óleo igual. Mas errar junto com o resto do bar é
// infinitamente melhor que o número de hoje, que é zero.

// Quantas porções dos pratos fritos saíram por dia, olhando as vendas.
// É a pergunta que ela não saberia responder e o sistema sabe.
export function porcoesFritasPorDia(vendas = [], idsFritos = [], dias = 30) {
  const ids = new Set((idsFritos || []).filter(Boolean));
  if (!ids.size || !(dias > 0)) return { porDia: 0, total: 0, diasComVenda: 0 };
  const corte = new Date();
  corte.setDate(corte.getDate() - dias);
  const limite = corte.toISOString().slice(0, 10);
  let total = 0;
  const diasVistos = new Set();
  for (const v of vendas || []) {
    const d = String((v && v.data) || '').slice(0, 10);
    if (!d || d < limite) continue;
    let achouNesta = false;
    for (const it of (v && v.itens) || []) {
      if (!ids.has(it && it.cardapioId)) continue;
      const q = numQtd(it.qtd);
      if (q > 0) { total += q; achouNesta = true; }
    }
    if (achouNesta) diasVistos.add(d);
  }
  return {
    total: Math.round(total * 100) / 100,
    diasComVenda: diasVistos.size,
    // Divide pela JANELA INTEIRA, não pelos dias que tiveram venda. O óleo
    // envelhece na segunda-feira fechada igual envelhece no sábado cheio — e
    // dividir só pelos dias movimentados faria a porção parecer mais cara.
    porDia: Math.round((total / dias) * 100) / 100,
  };
}

// O conteúdo da embalagem em ml. O estoque guarda em ml (UNIDADES_CONTEUDO),
// mas quem fala é ela, e ela fala em litros.
export const litrosParaMl = (l) => Math.round(numQtd(l) * 1000);

export function contaDoOleo({ conteudoMl, precoGalao, diasAteTrocar, porcoesPorDia }) {
  const ml = numQtd(conteudoMl);
  const preco = num(precoGalao);
  const dias = numQtd(diasAteTrocar);
  const porDia = numQtd(porcoesPorDia);
  if (!(ml > 0)) return { ok: false, falta: 'tamanho' };
  if (!(dias > 0)) return { ok: false, falta: 'dias' };
  if (!(porDia > 0)) return { ok: false, falta: 'porcoes' };
  const porcoesPorGalao = dias * porDia;
  const mlPorPorcao = ml / porcoesPorGalao;
  return {
    ok: true,
    porcoesPorGalao: Math.round(porcoesPorGalao * 10) / 10,
    // Arredonda pro ml inteiro: a ficha tem que ser legível ("52 ml de óleo"),
    // e a terceira casa decimal aqui é falsa precisão — a conta toda nasce de
    // duas estimativas.
    mlPorPorcao: Math.max(1, Math.round(mlPorPorcao)),
    custoPorPorcao: preco > 0 ? Math.round((preco / porcoesPorGalao) * 100) / 100 : 0,
    custoPorMl: preco > 0 && ml > 0 ? preco / ml : 0,
  };
}

// O QUE NÃO ENTRA NA FICHA, e por quê.
//
// Ela pediu pra pôr também "% de luz da fritadeira" e "gás". Não vai — e não é
// preguiça minha:
//
//   O óleo é INSUMO: só existe porque fritou, e sobe quando frita mais. Entra
//   na ficha e no CMV.
//
//   Luz, gás e aluguel são DESPESA OPERACIONAL: a conta chega igual no mês
//   parado. Já são contadas no DRE, nas categorias 'Energia elétrica' e 'Gás'.
//   Pondo de novo na ficha, o mesmo dinheiro sairia duas vezes do resultado e
//   o CMV passaria a ser comparável com nada — nem com o do mês passado dela,
//   nem com a faixa de 28% a 35% que o mercado usa.
//
// O lugar certo pro fixo é o rateio por unidade, na calculadora de preço. E
// esse o sistema pode calcular sozinho, porque conhece as despesas do mês e
// quantas unidades saíram.
export function rateioDoFixo({ despesasOperacionais = 0, unidadesVendidas = 0 }) {
  const d = num(despesasOperacionais);
  const u = numQtd(unidadesVendidas);
  if (!(d > 0) || !(u > 0)) return null;
  return Math.round((d / u) * 100) / 100;
}
