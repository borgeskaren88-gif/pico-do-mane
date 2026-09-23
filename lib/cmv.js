import { num, ymOf, todayISO } from './util';
import { qtdNaUnidadeDoItem, custoPelasCompras, indexarCompras, chaveNome, ehPorcionado } from './estoque';

// CMV — CUSTO DA MERCADORIA VENDIDA
//
// Quanto de ingrediente saiu da prateleira pra produzir o que foi vendido no
// mes. E o numero que responde "meu preco esta certo?". Em bar, saudavel fica
// entre 28% e 35% da receita; acima disso ou o preco esta defasado, ou tem
// coisa saindo sem ser cobrada, ou tem desperdicio.
//
// NAO confundir com o "Custo variavel" do DRE, que e o que ela PAGOU pra
// fornecedor dentro do mes. Comprou 20kg de camarao e vendeu 5kg: o custo
// variavel mostra os 20kg e o mes parece pessimo; o CMV mostra os 5kg. No mes
// seguinte ela vende os 15kg sem comprar nada e o custo variavel mostra zero.
// Nenhum dos dois meses e verdade — o dinheiro so mudou de prateleira pra
// caixa. Quem conta a historia certa mes a mes e o CMV.
//
// A conta sai pelo MESMO caminho que baixa o estoque (ficha do prato + os
// `extras` do item, que carregam o sabor escolhido na venda). Entao o custo
// daqui e o mesmo ingrediente que saiu de verdade — nao a media dos sabores.

// Faixas de referencia pra bar. Serve pra dar o veredito na tela sem ela
// precisar decorar numero.
export const CMV_BOM = 35;    // ate aqui, tranquilo
export const CMV_ATENCAO = 45; // daqui pra cima, tem problema

// A cobertura abaixo disso deixa o CMV sem sentido: o custo sai de um pedaco
// pequeno do cardapio e a porcentagem vira chute.
export const COBERTURA_MINIMA = 60;

// Ingrediente custando mais de TANTAS vezes o preco de venda nao e prejuizo, e
// ficha errada. Mesma regua da engenharia de cardapio, pela mesma razao: um
// item quebrado sozinho envergava o numero do mes inteiro. Prejuizo de
// verdade (custa um pouco mais do que vende) continua entrando na conta.
export const CMV_IMPOSSIVEL = 5;

const cent = (v) => Math.round(num(v) * 100) / 100;

// Custo de UM item de uma comanda (ja multiplicado pela quantidade vendida).
//
// `completo=false` quando algum ingrediente da receita nao tem item de estoque
// ou esta sem custo cadastrado — ai o custo sai por baixo, e o CMV parece
// melhor do que e. Por isso a tela avisa em vez de so mostrar o numero.
export function custoDoItemVendido(item, fichaPorCardapio, estoquePorId) {
  const qtd = num(item && item.qtd);
  if (!(qtd > 0)) return { custo: 0, qtd: 0, temFicha: false, completo: true, faltando: [] };

  const ficha = fichaPorCardapio.get(item.cardapioId) || [];
  const extras = Array.isArray(item.extras) ? item.extras : [];
  const ingredientes = [...ficha, ...extras];
  if (!ingredientes.length) return { custo: 0, qtd, temFicha: false, completo: true, faltando: [] };

  let custo = 0;
  let completo = true;
  const faltando = [];
  for (const ing of ingredientes) {
    const it = estoquePorId.get(ing.estoqueId);
    if (!it) { completo = false; faltando.push('(item removido)'); continue; }
    const c = num(it.custo);
    // Ingrediente "a gosto" (quantidade zero) nao e falha de cadastro: sal e
    // gelo raspado entram assim de proposito. O que falta mesmo e custo.
    if (!(c > 0)) { completo = false; faltando.push(it.nome || ''); continue; }
    custo += qtd * qtdNaUnidadeDoItem(ing.qtd, ing.unidade, it) * c;
  }
  return { custo: cent(custo), qtd, temFicha: true, completo, faltando };
}

// O CMV do mes inteiro, item por item das comandas fechadas.
//
// A receita usada aqui e a dos PRODUTOS (preco x quantidade), ja abatido o
// desconto dado no fechamento. A taxa de servico fica de fora de proposito:
// ela nao e venda de mercadoria, e botar ela no denominador faria o CMV
// parecer 10% melhor do que e.
export function cmvDoMes({ vendas = [], fichas = [], estoque = [], cardapio = [], mes } = {}) {
  const fichaPorCardapio = new Map(
    (fichas || []).filter((f) => f && f.cardapioId).map((f) => [f.cardapioId, Array.isArray(f.itens) ? f.itens : []]),
  );
  const estoquePorId = new Map((estoque || []).map((it) => [it.id, it]));
  // Categoria do cardápio, pra separar bebida de cozinha. Somados, os dois
  // viram uma média que não serve pra nada: chopp dá 25%, camarão pode dar
  // 45%, e o número do meio esconde os dois.
  const catPorCardapio = new Map((cardapio || []).filter((c) => c && c.id).map((c) => [c.id, c.categoria || 'Outros']));

  let cmv = 0;
  let receitaCoberta = 0;   // o que veio dos itens que TEM ficha
  let receitaSemFicha = 0;  // o que veio dos que nao da pra custear
  let vendasNoMes = 0;
  const semFicha = new Map();   // nome -> { nome, qtd, valor }
  const incompletos = new Map(); // nome do insumo -> quantas vezes apareceu
  const porProduto = new Map();  // nome -> { nome, qtd, custo, receita }
  const porCategoria = new Map(); // categoria -> { categoria, qtd, custo, receita }

  for (const v of vendas || []) {
    if (!v || ymOf(v.data) !== mes) continue;
    vendasNoMes += 1;
    // Desconto dado no fechamento derruba a receita de verdade — e sobe o CMV
    // em %. Aplicado por rateio em cada item, que e como ele foi dado.
    const fator = 1 - Math.max(0, Math.min(100, num(v.descontoPct))) / 100;

    for (const item of (v.itens || [])) {
      const r = custoDoItemVendido(item, fichaPorCardapio, estoquePorId);
      if (!(r.qtd > 0)) continue;
      const receita = cent(r.qtd * num(item.preco) * fator);
      const nome = (item.nome || '').trim() || 'Sem nome';

      if (!r.temFicha) {
        receitaSemFicha += receita;
        const s = semFicha.get(nome) || { nome, qtd: 0, valor: 0 };
        s.qtd += r.qtd; s.valor = cent(s.valor + receita);
        semFicha.set(nome, s);
        continue;
      }

      for (const f of r.faltando) if (f) incompletos.set(f, (incompletos.get(f) || 0) + 1);

      // Acumula por produto PRIMEIRO. Os totais so podem ser somados depois,
      // porque so da pra saber se um produto tem custo impossivel com o mes
      // dele inteiro na mao.
      const cat = catPorCardapio.get(item.cardapioId) || 'Outros';
      const p = porProduto.get(nome) || { nome, categoria: cat, qtd: 0, custo: 0, receita: 0 };
      p.qtd += r.qtd; p.custo = cent(p.custo + r.custo); p.receita = cent(p.receita + receita);
      porProduto.set(nome, p);
    }
  }

  // SEGUNDA PASSADA: separa o que tem custo impossivel antes de somar.
  //
  // Um produto cujo ingrediente custa muitas vezes o preco de venda nao e
  // prejuizo, e ficha errada — e um so deles enverga o CMV do mes inteiro.
  // Foi o que aconteceu: tres chopps com a mesma ficha quebrada levaram a
  // categoria Chopp/Cerveja pra 218% e o CMV geral junto.
  const impossiveis = [];
  let receitaImpossivel = 0;
  for (const p of porProduto.values()) {
    if (p.receita > 0 && p.custo > p.receita * CMV_IMPOSSIVEL) {
      impossiveis.push({ ...p, pct: cent((p.custo / p.receita) * 100) });
      receitaImpossivel += p.receita;
      continue;
    }
    cmv += p.custo;
    receitaCoberta += p.receita;
    const g = porCategoria.get(p.categoria) || { categoria: p.categoria, qtd: 0, custo: 0, receita: 0 };
    g.qtd += p.qtd; g.custo = cent(g.custo + p.custo); g.receita = cent(g.receita + p.receita);
    porCategoria.set(p.categoria, g);
  }
  impossiveis.sort((a, b) => b.custo - a.custo);

  cmv = cent(cmv);
  receitaCoberta = cent(receitaCoberta);
  receitaSemFicha = cent(receitaSemFicha);
  receitaImpossivel = cent(receitaImpossivel);
  // O que ficou de fora entra no denominador da cobertura: produto com ficha
  // quebrada nao foi calculado, e a cobertura existe justamente pra dizer de
  // quanto do cardapio o numero saiu.
  const receitaItens = cent(receitaCoberta + receitaSemFicha + receitaImpossivel);

  // A porcentagem sai sobre a receita COBERTA, nao sobre a receita toda: o
  // custo so existe pros itens que tem ficha, entao o denominador tem que ser
  // dos mesmos itens. Misturar os dois daria um CMV artificialmente baixo, que
  // e o tipo de erro que faz ela achar que esta tudo bem.
  const pct = receitaCoberta > 0 ? cent((cmv / receitaCoberta) * 100) : null;
  const cobertura = receitaItens > 0 ? cent((receitaCoberta / receitaItens) * 100) : null;

  const idsImpossiveis = new Set(impossiveis.map((p) => p.nome));
  const lista = [...porProduto.values()].filter((p) => !idsImpossiveis.has(p.nome)).map((p) => ({
    ...p,
    pct: p.receita > 0 ? cent((p.custo / p.receita) * 100) : null,
    // Custo de UMA unidade. É o que dá pra comparar de um mês pro outro —
    // o custo total sobe só porque vendeu mais, e isso não diz nada.
    custoUnit: p.qtd > 0 ? Math.round((p.custo / p.qtd) * 10000) / 10000 : null,
  }));

  const categorias = [...porCategoria.values()]
    .map((g) => ({ ...g, pct: g.receita > 0 ? cent((g.custo / g.receita) * 100) : null }))
    .sort((a, b) => b.custo - a.custo);

  return {
    cmv,
    pct,
    margemBruta: cent(receitaCoberta - cmv),
    margemBrutaPct: pct == null ? null : cent(100 - pct),
    receitaCoberta,
    receitaSemFicha,
    receitaImpossivel,
    receitaItens,
    cobertura,
    impossiveis,
    vendas: vendasNoMes,
    // Os piores primeiro: quem come mais percentual da propria venda.
    produtos: lista.sort((a, b) => (b.pct || 0) - (a.pct || 0)),
    categorias,
    // Quem mais pesa em REAIS no CMV — onde mexer rende mais.
    pesoNoCMV: [...lista].sort((a, b) => b.custo - a.custo).slice(0, 8),
    semFicha: [...semFicha.values()].sort((a, b) => b.valor - a.valor),
    insumosSemCusto: [...incompletos.entries()].sort((a, b) => b[1] - a[1]).map(([nome]) => nome),
  };
}

// ---------------------------------------------------------------------------
//  O CMV NO TEMPO
// ---------------------------------------------------------------------------

const mesAnterior = (mes) => {
  const y = parseInt(String(mes).slice(0, 4), 10);
  const m = parseInt(String(mes).slice(5, 7), 10);
  if (!y || !m) return null;
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

const ultimoDiaDoMes = (mes) => {
  const y = parseInt(String(mes).slice(0, 4), 10);
  const m = parseInt(String(mes).slice(5, 7), 10);
  if (!y || !m) return todayISO();
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

// O estoque com os custos QUE OS INSUMOS TINHAM naquele mês, reconstruídos
// pelas compras até o último dia dele.
//
// Sem isto, comparar dois meses não diz nada: o extrato guarda quanto saiu, não
// quanto valia no dia, então agosto e setembro sairiam ambos com o custo de
// hoje — e a variação por produto daria zero sempre. Item sem nenhuma compra
// até aquela data fica com o custo atual e é contado em `semBase`, pra tela
// poder dizer de quanto do cálculo ela pode confiar.
// `compras` pode vir como lista ou já indexada por nome (indexarCompras) —
// quem chama várias vezes seguidas, como a evolução, indexa uma vez só.
export function estoqueNoMes(estoque = [], compras = [], mes) {
  const idx = compras instanceof Map ? compras : indexarCompras(compras);
  const ate = ultimoDiaDoMes(mes);
  let semBase = 0;
  const itens = (estoque || []).map((it) => {
    const c = custoPelasCompras(it, idx.get(chaveNome(it && it.nome)) || [], ate);
    if (c == null) { semBase += 1; return it; }
    return { ...it, custo: c };
  });

  // SEGUNDA PASSADA: o saco separado.
  //
  // Ninguém compra "Batata 400g" — compra batata em quilo e ensaca. Então a
  // primeira passada nunca acha nota nenhuma pro saco e ele fica com o custo
  // que estiver guardado, congelado no dia em que alguém digitou. O custo dele
  // não é um dado próprio: é uma fatia do pacote, e tem que andar junto quando
  // o quilo da batata sobe.
  //
  // Feito DEPOIS, e não junto, porque o pacote precisa já estar com o custo da
  // época — senão o saco herdaria o preço de hoje dentro de um mês antigo.
  const porId = new Map(itens.map((it) => [it.id, it]));
  const comSacos = itens.map((it) => {
    if (!ehPorcionado(it)) return it;
    const bruto = porId.get(it.separar.brutoId);
    if (!bruto) return it;
    const porSaco = qtdNaUnidadeDoItem(num(it.separar.gramas), it.separar.unidade || 'g', bruto);
    if (!(porSaco > 0) || !(num(bruto.custo) > 0)) return it;
    return { ...it, custo: Math.round(porSaco * num(bruto.custo) * 10000) / 10000 };
  });
  return { estoque: comSacos, semBase, comBase: comSacos.length - semBase };
}

// O CMV dos últimos `meses` meses, cada um com o custo da sua época.
//
// É a peça que faz o número virar decisão: 31% sozinho não quer dizer nada;
// 31% quando era 28% em julho é uma história, e quando era 35% é outra.
export function evolucaoCMV({ vendas = [], fichas = [], estoque = [], compras = [], cardapio = [], ateMes, meses = 6 } = {}) {
  const fim = ateMes || ymOf(todayISO());
  const lista = [];
  let m = fim;
  for (let i = 0; i < meses && m; i += 1) { lista.unshift(m); m = mesAnterior(m); }
  // Indexa as compras UMA vez pros seis meses, e não uma vez por mês.
  const idx = indexarCompras(compras);
  return lista.map((mm) => {
    const { estoque: est } = estoqueNoMes(estoque, idx, mm);
    const r = cmvDoMes({ vendas, fichas, estoque: est, cardapio, mes: mm });
    return { mes: mm, cmv: r.cmv, pct: r.pct, receita: r.receitaCoberta, cobertura: r.cobertura };
  });
}

// Comparação entre dois meses.
//
// O que conta é a diferença em PONTOS PERCENTUAIS, não a variação do CMV em
// reais. O CMV em reais cai quando se vende menos — um mês fraco mostraria
// "-30%" e pareceria vitória. Os reais vêm junto, mas como coadjuvante.
export function compararCMV(atual, anterior) {
  if (!atual || !anterior || atual.pct == null || anterior.pct == null) return null;
  const pontos = Math.round((atual.pct - anterior.pct) * 100) / 100;
  const varReais = anterior.cmv > 0 ? Math.round(((atual.cmv - anterior.cmv) / anterior.cmv) * 10000) / 100 : null;
  const varReceita = anterior.receita > 0 ? Math.round(((atual.receita - anterior.receita) / anterior.receita) * 10000) / 100 : null;
  return {
    pontos,
    // Meio ponto pra lá ou pra cá é ruído de mix, não mudança de verdade.
    piorou: pontos > 0.5,
    melhorou: pontos < -0.5,
    varReais,
    varReceita,
  };
}

// Quanto o custo de CADA produto mudou de um mês pro outro.
//
// Compara o custo de UMA unidade, não o total: o total sobe só porque vendeu
// mais. É isto que pega o fornecedor aumentando o preço sem avisar.
//
// `minQtd` corta produto que saiu pouco demais: dois camarões num mês contra
// vinte no outro dão uma variação que é sorteio, não tendência.
export function variacaoProdutos(atual, anterior, minQtd = 3) {
  if (!atual || !anterior) return [];
  const antes = new Map((anterior.produtos || []).map((p) => [p.nome, p]));
  const saida = [];
  for (const p of (atual.produtos || [])) {
    const a = antes.get(p.nome);
    if (!a || !(p.custoUnit > 0) || !(a.custoUnit > 0)) continue;
    if (p.qtd < minQtd || a.qtd < minQtd) continue;
    const variacao = Math.round(((p.custoUnit - a.custoUnit) / a.custoUnit) * 10000) / 100;
    if (Math.abs(variacao) < 1) continue; // menos de 1% é arredondamento
    saida.push({ nome: p.nome, categoria: p.categoria, qtd: p.qtd, custoUnit: p.custoUnit, custoUnitAntes: a.custoUnit, variacao });
  }
  // O que mais subiu primeiro: é onde a margem está sendo comida.
  return saida.sort((a, b) => b.variacao - a.variacao);
}

// O veredito em uma frase, pra ela nao precisar decorar faixa de CMV.
//
// A cobertura vem antes do numero de proposito: um CMV de 22% calculado em
// cima de um terco do cardapio nao e uma boa noticia, e um numero sem base.
export function lerCMV(r) {
  if (!r || r.pct == null) {
    return { nivel: 'sem-dados', titulo: 'Sem dados ainda', texto: 'Precisa de venda de comanda no mês e de ficha técnica nos produtos pra calcular.' };
  }
  if (r.cobertura != null && r.cobertura < COBERTURA_MINIMA) {
    return {
      nivel: 'sem-base',
      titulo: 'Falta ficha técnica',
      texto: `Só ${r.cobertura.toFixed(0)}% do que tu vendeu tem ficha. O CMV de ${r.pct.toFixed(0)}% saiu só dessa parte — enquanto o resto não tiver ficha, esse número não serve pra decidir preço.`,
    };
  }
  if (r.pct < CMV_BOM) {
    return { nivel: 'bom', titulo: 'Está saudável', texto: `${r.pct.toFixed(0)}% de CMV. Bar costuma ficar entre 28% e 35% — tu está dentro.` };
  }
  if (r.pct < CMV_ATENCAO) {
    return { nivel: 'atencao', titulo: 'Está apertado', texto: `${r.pct.toFixed(0)}% de CMV. O normal de bar é até 35%. Olha os produtos da lista abaixo: ou o preço está defasado, ou o insumo subiu.` };
  }
  return {
    nivel: 'ruim',
    titulo: 'Está alto demais',
    texto: `${r.pct.toFixed(0)}% de CMV, quando o normal de bar é até 35%. Nessa altura quase sempre tem coisa saindo sem ser cobrada, desperdício, ou preço parado há muito tempo.`,
  };
}
