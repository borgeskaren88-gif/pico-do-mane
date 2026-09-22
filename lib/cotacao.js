import { num, limparNome, brl } from './util';

// Comparação de fornecedores — a conta que decide de quem comprar.
//
// Comparar preço de cotação parecia trivial e não é. O erro que mata: a Ambev
// cota "caixa de 12 a R$ 95" e o Zé cota "unidade a R$ 8,50". Comparando 95 com
// 8,50, o Zé parece onze vezes mais barato — quando na verdade é mais CARO
// (95÷12 = R$ 7,92). Por isso toda comparação aqui passa pelo PREÇO POR UNIDADE.
//
// Depois do preço vêm duas coisas que a Karen usa de verdade pra decidir:
//   - prazo de pagamento: 28 dias é dinheiro que fica no caixa dela
//   - pedido mínimo em R$: o mais barato pode obrigar a levar mais do que precisa
export const EMBALAGENS = ['un', 'cx', 'fardo', 'pct', 'saco', 'grf', 'kg', 'L'];

export const mesmoNome = (a, b) => limparNome(a).toLowerCase() === limparNome(b).toLowerCase();

// Quantas unidades vêm na embalagem cotada. Vazio = 1 (é a unidade avulsa).
export const unidadesDe = (c) => Math.max(1, num(c && c.conteudo) || 1);

// O número que vale pra comparar.
export const precoUnitario = (c) => {
  const p = num(c && c.preco);
  return p > 0 ? Math.round((p / unidadesDe(c)) * 10000) / 10000 : 0;
};

// Como a embalagem é descrita pra ela: "caixa de 12 a R$ 95,00".
export function descreveEmbalagem(c) {
  const un = unidadesDe(c);
  const emb = (c && c.embalagem) || 'un';
  if (un <= 1) return `${brl(num(c.preco))} a ${emb === 'un' ? 'unidade' : emb}`;
  return `${emb} de ${un} a ${brl(num(c.preco))}`;
}

// Prazo e pedido mínimo são do FORNECEDOR, não da cotação — mas ficam gravados
// na cotação pra não precisar de um cadastro à parte. Aqui vale o mais recente
// que ela informou pra aquele fornecedor, em qualquer produto: assim ela digita
// uma vez e passa a valer pras próximas.
export function dadosDoFornecedor(cotacoes, fornecedor) {
  const regs = (cotacoes || [])
    .filter((c) => c && mesmoNome(c.fornecedor, fornecedor))
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
  let prazoPag = 0, minPedido = 0, prazoEntrega = 0;
  for (const c of regs) { if (!prazoPag && num(c.prazoPag) > 0) prazoPag = num(c.prazoPag); }
  for (const c of regs) { if (!minPedido && num(c.minPedido) > 0) minPedido = num(c.minPedido); }
  // Prazo de ENTREGA é outra coisa que prazo de pagamento, e é ele que decide
  // quando repor: pedir com 1 dia de antecedência pra um fornecedor que leva 5
  // é o mesmo que não pedir.
  for (const c of regs) { if (!prazoEntrega && num(c.prazoEntrega) > 0) prazoEntrega = num(c.prazoEntrega); }
  return { prazoPag, minPedido, prazoEntrega };
}

// Quanto tempo leva pra chegar este produto: o prazo do fornecedor mais barato
// que tem cotação dele. Sem cotação, devolve 0 e quem chamou decide o que
// fazer — inventar um prazo daria um mínimo sugerido de mentira.
export function prazoDeEntregaDoProduto(cotacoes, produto) {
  const ops = opcoesDoProduto(cotacoes, produto);
  for (const o of ops) { if (num(o.prazoEntrega) > 0) return num(o.prazoEntrega); }
  return 0;
}

// As opções de compra de UM produto, da melhor pra pior. Um fornecedor entra
// uma vez só, com a cotação mais recente dele — preço velho não serve pra
// decidir hoje.
export function opcoesDoProduto(cotacoes, produto) {
  const regs = (cotacoes || []).filter((c) => c && c.produto && mesmoNome(c.produto, produto) && num(c.preco) > 0);
  const porForn = new Map();
  for (const c of regs) {
    const f = limparNome(c.fornecedor) || 'Sem fornecedor';
    const atual = porForn.get(f);
    if (!atual || String(c.data || '') > String(atual.data || '')) porForn.set(f, c);
  }
  return [...porForn.entries()]
    .map(([fornecedor, c]) => ({
      fornecedor,
      cotacao: c,
      data: c.data || '',
      preco: num(c.preco),
      unidades: unidadesDe(c),
      unitario: precoUnitario(c),
      embalagem: descreveEmbalagem(c),
      ...dadosDoFornecedor(cotacoes, fornecedor),
    }))
    .sort((a, b) => a.unitario - b.unitario);
}

// O veredito, escrito do jeito que ela lê. Devolve null quando não dá pra
// opinar — é melhor calar do que empurrar uma escolha com base em um preço só.
export function melhorCompra(cotacoes, produto) {
  const ops = opcoesDoProduto(cotacoes, produto);
  if (!ops.length) return null;
  const [v, segundo] = ops;

  if (ops.length === 1) {
    return {
      opcoes: ops, vencedor: v,
      texto: `Só tem preço de um fornecedor (${v.fornecedor}, ${brl(v.unitario)} por unidade). Cota com mais um pra saber se está bom.`,
      nivel: 'info',
    };
  }

  const partes = [];
  const dif = segundo.unitario - v.unitario;
  const pct = segundo.unitario > 0 ? Math.round((dif / segundo.unitario) * 100) : 0;
  partes.push(pct >= 1
    ? `${v.fornecedor} está ${pct}% mais barato que ${segundo.fornecedor}: ${brl(v.unitario)} contra ${brl(segundo.unitario)} por unidade.`
    : `${v.fornecedor} e ${segundo.fornecedor} estão praticamente no mesmo preço (${brl(v.unitario)} contra ${brl(segundo.unitario)} por unidade).`);

  // O prazo pode virar o jogo: comprar mais caro pagando em 28 dias às vezes
  // vale mais que economizar 3% à vista.
  if (v.prazoPag > segundo.prazoPag) {
    partes.push(`E ainda te dá ${v.prazoPag} dias pra pagar.`);
  } else if (segundo.prazoPag > v.prazoPag) {
    partes.push(`Mas atenção ao prazo: ${segundo.fornecedor} te dá ${segundo.prazoPag} dias pra pagar e ${v.fornecedor} ${v.prazoPag > 0 ? `só ${v.prazoPag}` : 'é à vista'}. Com o caixa apertado, o prazo pode valer mais que a diferença de preço.`);
  }

  // O mínimo é o que costuma estragar a economia: leva mais do que precisa,
  // o dinheiro fica parado na prateleira (e às vezes vence).
  if (v.minPedido > 0) {
    const emb = Math.ceil(v.minPedido / v.preco);
    partes.push(`Pedido mínimo de ${brl(v.minPedido)} — dá ${emb} ${v.unidades > 1 ? `${v.cotacao.embalagem || 'embalagem'}(s)` : 'unidade(s)'}. Se tu precisa de menos que isso, o barato sai caro.`);
  }

  return { opcoes: ops, vencedor: v, texto: partes.join(' '), nivel: pct >= 10 ? 'destaque' : 'info', economia: dif };
}
