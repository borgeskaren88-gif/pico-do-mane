import { num, brl } from './util';

// ENGENHARIA DE CARDÁPIO
//
// Cruza quanto cada item DÁ de lucro com quantas vezes ele SAI, e cai em um de
// quatro cantos. É a matriz clássica de engenharia de cardápio (Kasavana &
// Smith), a mesma coisa que o app que ela viu chama de Estrela, Burro de
// carga, Quebra-cabeça e Cachorro.
//
// O valor disto não é o rótulo, é a AÇÃO: cada canto pede uma coisa diferente,
// e sem cruzar os dois eixos ela olharia só a margem (e tiraria do cardápio um
// prato que puxa gente) ou só a quantidade (e protegeria um campeão de venda
// que não deixa nada).

export const GRUPOS = {
  estrela: {
    chave: 'estrela',
    nome: 'Estrelas',
    icone: '⭐',
    resumo: 'dá lucro e sai muito',
    texto: 'São o teu tesouro. O prato que tu quer vender mais.',
    acao: 'Mantém no topo do cardápio e nunca deixa faltar ingrediente.',
  },
  burro: {
    chave: 'burro',
    nome: 'Burros de carga',
    icone: '🐴',
    resumo: 'sai muito e deixa pouco',
    texto: 'Vendem muito e lucram pouco — mas nem sempre são vilões: às vezes é o que traz a pessoa até aqui.',
    acao: 'Revê a ficha técnica e usa ele de isca em combo, pra subir a margem do pedido inteiro.',
  },
  quebra: {
    chave: 'quebra',
    nome: 'Quebra-cabeças',
    icone: '🧩',
    resumo: 'dá lucro e quase ninguém pede',
    texto: 'Dão lucro, mas quase ninguém pede. Ou está escondido no cardápio, ou o preço está assustando.',
    acao: 'Dá destaque, ensina o salão a sugerir, e confere se o preço não está alto demais.',
  },
  cachorro: {
    chave: 'cachorro',
    nome: 'Cachorros',
    icone: '🐕',
    resumo: 'sai pouco e deixa pouco',
    texto: 'Ocupam espaço no cardápio, insumo na prateleira e tempo na cozinha, sem dar retorno.',
    acao: 'Fortes candidatos a sair do cardápio — ou a serem reinventados.',
  },
};

export const ORDEM_GRUPOS = ['estrela', 'burro', 'quebra', 'cachorro'];

// A REGRA DOS 70%, que é a padrão da engenharia de cardápio.
//
// Um item é "popular" quando vende mais que 70% do que venderia se todos os
// itens saíssem igual. Sem esse desconto, metade do cardápio seria impopular
// por definição — o corte ficaria na média e só serviria pra dividir a lista
// no meio, dissesse o que dissesse.
export const FATOR_POPULARIDADE = 0.7;

// Abaixo disto a matriz não diz nada: com três pratos, um item vira Estrela ou
// Cachorro por acaso, dependendo de quem vendeu duas unidades a mais.
export const MIN_ITENS = 4;

// Custo acima de TANTAS vezes o preço não é prejuízo, é ficha técnica errada.
//
// Um item vendido no prejuízo de verdade custa um pouco mais do que vende.
// Custar mil vezes o preço é erro de cadastro — quantidade digitada na unidade
// trocada, insumo com custo absurdo, coisa assim.
//
// Isto precisa ser separado ANTES de calcular os cortes, e é por isso que
// existe: um item com margem de −R$ 35.000 puxa a média ponderada pra baixo de
// zero, e aí TODO o resto do cardápio fica "acima do corte". Dois itens
// quebrados faziam a classificação dos outros setenta e cinco virar lixo.
export const FATOR_IMPOSSIVEL = 5;

const cent = (v) => Math.round(num(v) * 100) / 100;

// Separa o que dá pra classificar do que está com a ficha quebrada.
function peneirar(linhas) {
  const bons = [];
  const impossiveis = [];
  for (const l of (linhas || [])) {
    if (!l || l.lucro == null) continue;
    const preco = num(l.preco);
    const custo = num(l.custo);
    if (preco > 0 && custo > preco * FATOR_IMPOSSIVEL) { impossiveis.push({ ...l, preco, custo }); continue; }
    bons.push(l);
  }
  return { bons, impossiveis };
}

// `linhas` = [{ id, nome, categoria, lucro, qtd }], onde `lucro` é a margem de
// contribuição de UMA unidade (preço − custo dos ingredientes) e `qtd` é
// quantas saíram no período.
//
// O corte de margem é a MÉDIA PONDERADA pelo que saiu, não a média simples:
// senão um item caro que sai uma vez por mês puxaria o corte pra cima e
// jogaria o cardápio inteiro pro lado errado.
export function engenhariaDoCardapio(linhas = []) {
  const { bons: itens, impossiveis } = peneirar(linhas);
  if (itens.length < MIN_ITENS) {
    return { itens: [], grupos: [], impossiveis, poucosDados: true, motivo: `Precisa de pelo menos ${MIN_ITENS} produtos com ficha técnica pra comparar.`, cortes: null };
  }

  const totalQtd = itens.reduce((s, l) => s + num(l.qtd), 0);
  if (!(totalQtd > 0)) {
    return { itens: [], grupos: [], impossiveis, poucosDados: true, motivo: 'Nenhum desses produtos saiu no período escolhido.', cortes: null };
  }

  const margemCorte = cent(itens.reduce((s, l) => s + num(l.lucro) * num(l.qtd), 0) / totalQtd);
  const popCorte = Math.round(((totalQtd / itens.length) * FATOR_POPULARIDADE) * 100) / 100;

  const classificados = itens.map((l) => {
    const daLucro = num(l.lucro) >= margemCorte;
    const sai = num(l.qtd) >= popCorte;
    const grupo = daLucro ? (sai ? 'estrela' : 'quebra') : (sai ? 'burro' : 'cachorro');
    return { ...l, lucro: cent(l.lucro), qtd: num(l.qtd), grupo, daLucro, sai };
  });

  const grupos = ORDEM_GRUPOS.map((chave) => {
    // Dentro do grupo, o que mais pôs dinheiro no bolso primeiro — é por onde
    // ela começa a mexer.
    const doGrupo = classificados
      .filter((l) => l.grupo === chave)
      .sort((a, b) => (b.lucro * b.qtd) - (a.lucro * a.qtd));
    return {
      ...GRUPOS[chave],
      itens: doGrupo,
      qtdItens: doGrupo.length,
      lucroTotal: cent(doGrupo.reduce((s, l) => s + l.lucro * l.qtd, 0)),
    };
  }).filter((g) => g.qtdItens > 0);

  return {
    itens: classificados,
    grupos,
    impossiveis,
    poucosDados: false,
    motivo: '',
    cortes: { margem: margemCorte, popularidade: popCorte, totalQtd, nItens: itens.length },
  };
}

// A matriz feita DENTRO de cada categoria, e não no cardápio todo.
//
// É a leitura mais correta: chopp e porção de camarão não disputam o mesmo
// lugar. Comparados juntos, o chopp sempre vira Burro de carga (margem baixa,
// sai muito) — o que é a natureza dele, não um problema. Categoria com menos
// de MIN_ITENS produtos fica de fora, porque ali a matriz é sorteio.
export function engenhariaPorCategoria(linhas = []) {
  const { bons, impossiveis } = peneirar(linhas);
  const porCat = new Map();
  for (const l of bons) {
    const cat = l.categoria || 'Sem categoria';
    if (!porCat.has(cat)) porCat.set(cat, []);
    porCat.get(cat).push(l);
  }
  const saida = [];
  const forasteiras = [];
  for (const [categoria, itens] of porCat) {
    const r = engenhariaDoCardapio(itens);
    if (r.poucosDados) { forasteiras.push({ categoria, qtdItens: itens.length, motivo: r.motivo }); continue; }
    saida.push({ categoria, ...r });
  }
  saida.sort((a, b) => b.itens.length - a.itens.length);
  // Os quebrados saem uma vez só, fora das categorias: o problema deles é de
  // cadastro, não de posição no cardápio.
  return { categorias: saida, forasteiras, impossiveis };
}

// Uma frase do que fazer primeiro, pra ela não ter que ler os quatro grupos
// no meio do movimento do bar.
export function primeiroPasso(r) {
  if (!r || r.poucosDados) return '';
  const g = (c) => r.grupos.find((x) => x.chave === c);
  const cachorro = g('cachorro');
  const quebra = g('quebra');
  const burro = g('burro');
  if (quebra && quebra.qtdItens) {
    const top = quebra.itens[0];
    return `Começa pelos quebra-cabeças: ${top.nome} deixa ${brl(top.lucro)} por unidade e saiu só ${top.qtd}. Se o salão sugerir, é lucro que já está no cardápio.`;
  }
  if (cachorro && cachorro.qtdItens) {
    return `Começa pelos cachorros: ${cachorro.qtdItens} produto(s) que não vendem nem deixam margem, ocupando espaço no cardápio.`;
  }
  if (burro && burro.qtdItens) {
    const top = burro.itens[0];
    return `Teu maior volume é ${top.nome}, que deixa pouco por unidade. Um centavo a mais de margem nele vale mais que qualquer outra mexida.`;
  }
  return 'Teu cardápio está todo do lado bom da conta.';
}
