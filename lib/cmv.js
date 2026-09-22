import { num, ymOf } from './util';
import { qtdNaUnidadeDoItem } from './estoque';

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
export function cmvDoMes({ vendas = [], fichas = [], estoque = [], mes } = {}) {
  const fichaPorCardapio = new Map(
    (fichas || []).filter((f) => f && f.cardapioId).map((f) => [f.cardapioId, Array.isArray(f.itens) ? f.itens : []]),
  );
  const estoquePorId = new Map((estoque || []).map((it) => [it.id, it]));

  let cmv = 0;
  let receitaCoberta = 0;   // o que veio dos itens que TEM ficha
  let receitaSemFicha = 0;  // o que veio dos que nao da pra custear
  let vendasNoMes = 0;
  const semFicha = new Map();   // nome -> { nome, qtd, valor }
  const incompletos = new Map(); // nome do insumo -> quantas vezes apareceu
  const porProduto = new Map();  // nome -> { nome, qtd, custo, receita }

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

      cmv += r.custo;
      receitaCoberta += receita;
      for (const f of r.faltando) if (f) incompletos.set(f, (incompletos.get(f) || 0) + 1);

      const p = porProduto.get(nome) || { nome, qtd: 0, custo: 0, receita: 0 };
      p.qtd += r.qtd; p.custo = cent(p.custo + r.custo); p.receita = cent(p.receita + receita);
      porProduto.set(nome, p);
    }
  }

  cmv = cent(cmv);
  receitaCoberta = cent(receitaCoberta);
  receitaSemFicha = cent(receitaSemFicha);
  const receitaItens = cent(receitaCoberta + receitaSemFicha);

  // A porcentagem sai sobre a receita COBERTA, nao sobre a receita toda: o
  // custo so existe pros itens que tem ficha, entao o denominador tem que ser
  // dos mesmos itens. Misturar os dois daria um CMV artificialmente baixo, que
  // e o tipo de erro que faz ela achar que esta tudo bem.
  const pct = receitaCoberta > 0 ? cent((cmv / receitaCoberta) * 100) : null;
  const cobertura = receitaItens > 0 ? cent((receitaCoberta / receitaItens) * 100) : null;

  const lista = [...porProduto.values()].map((p) => ({
    ...p,
    pct: p.receita > 0 ? cent((p.custo / p.receita) * 100) : null,
  }));

  return {
    cmv,
    pct,
    margemBruta: cent(receitaCoberta - cmv),
    margemBrutaPct: pct == null ? null : cent(100 - pct),
    receitaCoberta,
    receitaSemFicha,
    receitaItens,
    cobertura,
    vendas: vendasNoMes,
    // Os piores primeiro: quem come mais percentual da propria venda.
    produtos: lista.sort((a, b) => (b.pct || 0) - (a.pct || 0)),
    // Quem mais pesa em REAIS no CMV — onde mexer rende mais.
    pesoNoCMV: [...lista].sort((a, b) => b.custo - a.custo).slice(0, 8),
    semFicha: [...semFicha.values()].sort((a, b) => b.valor - a.valor),
    insumosSemCusto: [...incompletos.entries()].sort((a, b) => b[1] - a[1]).map(([nome]) => nome),
  };
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
