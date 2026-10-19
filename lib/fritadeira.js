import { num, numQtd, ymOf } from './util';
import { norm } from './darci';

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
export function porcoesFritasPorDia(vendas = [], idsFritos = [], dias = 30, cardapio = []) {
  const ids = new Set((idsFritos || []).filter(Boolean));
  if (!ids.size || !(dias > 0)) return { porDia: 0, total: 0, diasComVenda: 0 };
  // CASA TAMBÉM PELO NOME, não só pelo código.
  //
  // A venda guarda o cardapioId do item — quando foi lançada pelo app, com o
  // cardápio de hoje. Item recriado, cardápio reimportado ou venda mais antiga
  // podem ter só o nome. Contando só por código, essas sumiam da conta: as
  // porções por dia saíam pequenas demais e o óleo por porção explodia, que
  // foi exatamente o que apareceu na tela dela (513 ml por porção).
  //
  // A tela de Margem já casava por nome pelo mesmo motivo. Aqui faltava.
  const nomes = new Set((cardapio || []).filter((c) => c && ids.has(c.id)).map((c) => norm(c.nome)).filter(Boolean));
  const corte = new Date();
  corte.setDate(corte.getDate() - dias);
  const limite = corte.toISOString().slice(0, 10);
  let total = 0;
  const diasVistos = new Set();
  const contagemPorPrato = new Map();
  const nomePorId = new Map((cardapio || []).map((c) => [c && c.id, (c && c.nome) || '']));
  for (const v of vendas || []) {
    const d = String((v && v.data) || '').slice(0, 10);
    if (!d || d < limite) continue;
    let achouNesta = false;
    for (const it of (v && v.itens) || []) {
      const bate = ids.has(it && it.cardapioId) || (!!it && nomes.has(norm(it.nome)));
      if (!bate) continue;
      const q = numQtd(it.qtd);
      if (q > 0) {
        total += q; achouNesta = true;
        const rot = nomePorId.get(it.cardapioId) || it.nome || '—';
        contagemPorPrato.set(rot, (contagemPorPrato.get(rot) || 0) + q);
      }
    }
    if (achouNesta) diasVistos.add(d);
  }
  return {
    total: Math.round(total * 100) / 100,
    diasComVenda: diasVistos.size,
    // DE ONDE VEM O NÚMERO, prato por prato.
    //
    // Ela olhou "2,73 por dia" e não tinha como julgar se estava certo —
    // disse que num sábado saem 20 a 30 batatas. Com a lista aberta ela vê
    // num segundo o que eu não consigo ver daqui: prato que ela marcou e
    // nunca vendeu, ou prato campeão que ficou de fora.
    porPrato: [...new Map([
      ...[...ids].map((id) => [nomePorId.get(id) || id, 0]),
      ...contagemPorPrato.entries(),
    ]).entries()]
      .map(([nome, qtd]) => ({ nome, qtd: Math.round(qtd * 100) / 100 }))
      .sort((a, b) => b.qtd - a.qtd),
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
  const mlPorPorcao = Math.max(1, Math.round(ml / porcoesPorGalao));
  // QUANDO O NÚMERO NÃO PODE ESTAR CERTO, A TELA TEM QUE DIZER.
  //
  // Uma porção que vai na fritadeira leva uns 10 a 30 ml de óleo, contando o
  // que absorve e a parte dela no galão que se joga fora. Acima de 60 ml
  // alguma das duas entradas está torta — quase sempre o galão durando mais
  // do que ela disse, ou saindo mais frito do que o sistema conseguiu contar.
  //
  // Mostrar 513 ml calado, como a tela fez, é pior que não mostrar nada: vira
  // ficha técnica, vira CMV, vira preço.
  const suspeito = mlPorPorcao > 60;

  return {
    ok: true,
    suspeito,
    porcoesPorGalao: Math.round(porcoesPorGalao * 10) / 10,
    // Arredonda pro ml inteiro: a ficha tem que ser legível ("52 ml de óleo"),
    // e a terceira casa decimal aqui é falsa precisão — a conta toda nasce de
    // duas estimativas.
    mlPorPorcao,
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
