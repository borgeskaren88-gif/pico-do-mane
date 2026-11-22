import { num, numQtd, limparNome, brl, addDays, todayISO } from './util';
import { resolverCompraNoEstoque, entradaDaCompra, fatorEntre, chaveNome } from './estoque';
import { precoNaUnidadeDoItem, precoUnitario, dadosDoFornecedor } from './cotacao';

// O COMPRADOR ESPERTO — onde comprar cada coisa, pelo que ela JÁ pagou.
//
// "Você já tem acesso aos meus pedidos com valores, então queria que de alguma
// forma ele me falasse qual o melhor preço, melhor fornecedor, de alguma forma
// prática pra facilitar as cotações."
//
// As cotações dependiam de ela digitar cada preço que viu. Mas toda NOTA que
// ela lança em Compras já é uma cotação de verdade: quem vendeu, quanto, quando
// e quanto veio. Aqui as duas fontes viram uma régua só:
//
//   - tudo na UNIDADE DO ITEM DE ESTOQUE (o mesmo cálculo que dá entrada no
//     estoque): caixa de 12 da Ambev e unidade avulsa do mercado se comparam
//     direito — R$ 95 a caixa é R$ 7,92 a unidade;
//   - o preço que vale de cada fornecedor é o MAIS RECENTE (preço de seis meses
//     atrás não decide compra de hoje): nota dos últimos 120 dias, cotação dos
//     últimos 60;
//   - a economia é em REAIS POR MÊS, no consumo dela: 30 centavos numa coisa que
//     ela compra 200 por mês vale mais que 3 reais numa que compra 2.
//
// Sem banco e sem tela: dá pra conferir sozinho.

const JANELA_NOTA = 120;
const JANELA_COTACAO = 60;
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const r4 = (v) => Math.round((Number(v) || 0) * 10000) / 10000;
const chaveForn = (f) => chaveNome(f) || 'sem fornecedor';
const ddmm = (d) => (d && d.length >= 10 ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '');

export function analisarPrecos({ compras = [], cotacoes = [], estoque = [], hoje = todayISO() } = {}) {
  const produtos = new Map(); // chave -> { nome, unidade, itemId, pontos: [] }
  // Resolver o item de estoque pelo nome é a parte cara: uma vez por nome.
  const cacheItem = new Map();
  const itemDe = (produto, estoqueId) => {
    const k = `${estoqueId || ''}|${chaveNome(produto)}`;
    if (!cacheItem.has(k)) {
      // O MESMO item em que a nota deu entrada no estoque (inclusive pelo nome
      // parecido): se a nota somou na prateleira dele, o preço é dele.
      const r = resolverCompraNoEstoque({ produto, estoqueId }, estoque);
      cacheItem.set(k, r ? r.item : null);
    }
    return cacheItem.get(k);
  };
  const grupo = (item, produto) => {
    const chave = item ? `i:${item.id}` : `p:${chaveNome(produto)}`;
    if (!produtos.has(chave)) produtos.set(chave, { chave, nome: item ? limparNome(item.nome) : limparNome(produto), unidade: item ? (item.unidade || 'un') : '', itemId: item ? item.id : '', pontos: [] });
    return produtos.get(chave);
  };
  const desde = addDays(hoje, -365);

  for (const c of Array.isArray(compras) ? compras : []) {
    if (!c || !c.produto || !c.data || c.data < desde || c.data > hoje) continue;
    if (c.estoqueId === 'nenhum' && /imposto/i.test(c.produto)) continue;
    const preco = num(c.precoCheio || c.valorUnit);
    if (!(preco > 0)) continue;
    const item = itemDe(c.produto, c.estoqueId);
    let unit = preco;
    let qtd = numQtd(c.qtdCompra || c.quantidade) || 1;
    if (item) {
      const e = entradaDaCompra(c, item);
      if (!e || e.erro || !(e.custo > 0)) continue; // embalagem que não converte: fora
      unit = e.custo; qtd = e.qtd;
    }
    grupo(item, c.produto).pontos.push({ fonte: 'nota', fornecedor: limparNome(c.fornecedor) || 'Sem fornecedor', data: c.data, unit: r4(unit), qtd });
  }

  for (const c of Array.isArray(cotacoes) ? cotacoes : []) {
    if (!c || !c.produto || !(num(c.preco) > 0)) continue;
    const item = itemDe(c.produto, '');
    const unit = item ? precoNaUnidadeDoItem(c, item, fatorEntre) : precoUnitario(c);
    if (!(unit > 0)) continue;
    grupo(item, c.produto).pontos.push({ fonte: 'cotacao', fornecedor: limparNome(c.fornecedor) || 'Sem fornecedor', data: c.data || hoje, unit: r4(unit), qtd: 0 });
  }

  const resultado = [];
  for (const g of produtos.values()) {
    const notas = g.pontos.filter((p) => p.fonte === 'nota').sort((a, b) => b.data.localeCompare(a.data));
    // O preço ATUAL de cada fornecedor: o ponto mais recente dele, dentro da janela.
    const porForn = new Map();
    for (const p of [...g.pontos].sort((a, b) => b.data.localeCompare(a.data))) {
      const limite = addDays(hoje, -(p.fonte === 'nota' ? JANELA_NOTA : JANELA_COTACAO));
      if (p.data < limite) continue;
      const k = chaveForn(p.fornecedor);
      if (!porForn.has(k)) porForn.set(k, { ...p, vezes: 0 });
      if (p.fonte === 'nota') porForn.get(k).vezes += 1;
    }
    const fornecedores = [...porForn.values()].sort((a, b) => a.unit - b.unit);
    if (!fornecedores.length) continue;
    const melhor = fornecedores[0];
    const ultima = notas[0] || null;
    const anterior = notas[1] || null;
    // Quanto ela usa: o que entrou pelas notas dos últimos 90 dias, por mês.
    const q90 = notas.filter((p) => p.data >= addDays(hoje, -90)).reduce((s, p) => s + p.qtd, 0);
    const consumoMes = r2(q90 / 3);
    const pagouMaisCaro = ultima && chaveForn(ultima.fornecedor) !== chaveForn(melhor.fornecedor) && melhor.unit < ultima.unit - 0.0001;
    const economiaMes = pagouMaisCaro ? r2((ultima.unit - melhor.unit) * consumoMes) : 0;
    const pctMaisCaro = pagouMaisCaro ? Math.round(((ultima.unit - melhor.unit) / ultima.unit) * 100) : 0;
    const subiu = ultima && anterior && anterior.unit > 0 ? Math.round(((ultima.unit - anterior.unit) / anterior.unit) * 100) : null;
    resultado.push({
      chave: g.chave, nome: g.nome, unidade: g.unidade, itemId: g.itemId,
      fornecedores, melhor, ultima, anterior, consumoMes, economiaMes, pctMaisCaro, subiu,
      texto: veredito({ nome: g.nome, unidade: g.unidade, fornecedores, melhor, ultima, economiaMes, pctMaisCaro, consumoMes }),
    });
  }
  resultado.sort((a, b) => (b.economiaMes - a.economiaMes) || a.nome.localeCompare(b.nome));
  return resultado;
}

const porUn = (u) => (u ? `/${u}` : '');

// A frase, do jeito que ela lê.
function veredito({ unidade, fornecedores, melhor, ultima, economiaMes, pctMaisCaro }) {
  const fonte = (p) => (p.fonte === 'nota' ? `pagaste em ${ddmm(p.data)}` : `cotado em ${ddmm(p.data)}`);
  if (fornecedores.length === 1) {
    return `Só tem preço de ${melhor.fornecedor} (${brl(melhor.unit)}${porUn(unidade)}, ${fonte(melhor)}). Cota com mais um pra saber se está bom.`;
  }
  const segundo = fornecedores[1];
  if (ultima && pctMaisCaro > 0) {
    return `Compra no ${melhor.fornecedor}: ${brl(melhor.unit)}${porUn(unidade)} (${fonte(melhor)}), ${pctMaisCaro}% mais barato que a tua última compra no ${ultima.fornecedor} (${brl(ultima.unit)}${porUn(unidade)}).${economiaMes >= 1 ? ` No teu consumo, dá uns ${brl(economiaMes)} por mês.` : ''}`;
  }
  const dif = segundo.unit > 0 ? Math.round(((segundo.unit - melhor.unit) / segundo.unit) * 100) : 0;
  return `${ultima && chaveForn(ultima.fornecedor) === chaveForn(melhor.fornecedor) ? 'Tu já compras no mais barato: ' : 'O mais barato é '}${melhor.fornecedor}, ${brl(melhor.unit)}${porUn(unidade)}${dif >= 1 ? ` (${dif}% abaixo do ${segundo.fornecedor})` : ` (praticamente igual ao ${segundo.fornecedor})`}.`;
}

// O resumo do topo: quanto dá pra economizar por mês e o que subiu.
export function resumoDasCompras(analise) {
  const economias = analise.filter((a) => a.economiaMes >= 1);
  const subiram = analise.filter((a) => a.subiu != null && a.subiu >= 10).sort((a, b) => b.subiu - a.subiu);
  // Quem é o mais barato em mais produtos (com pelo menos 2 fornecedores).
  const campeao = new Map();
  for (const a of analise) if (a.fornecedores.length >= 2) campeao.set(a.melhor.fornecedor, (campeao.get(a.melhor.fornecedor) || 0) + 1);
  const top = [...campeao.entries()].sort((x, y) => y[1] - x[1])[0] || null;
  return {
    economiaMes: r2(economias.reduce((s, a) => s + a.economiaMes, 0)),
    economias: economias.slice(0, 8),
    subiram: subiram.slice(0, 6),
    campeao: top ? { fornecedor: top[0], produtos: top[1] } : null,
    produtos: analise.length,
  };
}

// O PEDIDO PRONTO: a lista de compras dividida pelo fornecedor mais barato de
// cada item, com o total estimado e a mensagem pra mandar no WhatsApp.
export function montarPedidos(lista, analise, cotacoes = [], estoque = []) {
  const porChave = new Map(analise.map((a) => [a.chave, a]));
  const grupos = new Map();
  const semPreco = [];
  for (const it of Array.isArray(lista) ? lista : []) {
    if (!it || it.comprado || !it.nome) continue;
    // O item da lista acha o produto do mesmo jeito que a nota acha o estoque.
    const r = resolverCompraNoEstoque({ produto: it.nome }, estoque);
    const a = porChave.get(r ? `i:${r.item.id}` : `p:${chaveNome(it.nome)}`);
    if (!a) { semPreco.push(limparNome(it.nome)); continue; }
    const f = a.melhor.fornecedor;
    if (!grupos.has(f)) grupos.set(f, { fornecedor: f, itens: [], total: 0, ...dadosDoFornecedor(cotacoes, f) });
    const g = grupos.get(f);
    const qtd = numQtd(it.quantidade);
    const sub = qtd > 0 ? r2(qtd * a.melhor.unit) : 0;
    g.itens.push({ nome: limparNome(it.nome), quantidade: String(it.quantidade || '').trim(), unit: a.melhor.unit, unidade: a.unidade, subtotal: sub });
    g.total = r2(g.total + sub);
  }
  const pedidos = [...grupos.values()].sort((a, b) => b.total - a.total).map((g) => ({
    ...g,
    abaixoDoMinimo: g.minPedido > 0 && g.total > 0 && g.total < g.minPedido,
    mensagem: `Olá! Segue o pedido:\n${g.itens.map((i) => `• ${i.quantidade ? `${i.quantidade} ` : ''}${i.nome}`).join('\n')}\nPode me confirmar o valor e a entrega? Valeu!`,
  }));
  return { pedidos, semPreco };
}
