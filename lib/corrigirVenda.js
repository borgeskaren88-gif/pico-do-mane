// CORRIGIR UMA VENDA JÁ FECHADA — tirar o que não foi vendido.
//
// "A Sarah lançou duas doses numa comanda e fechou em dinheiro, mas vendeu
// uma só." Antes o único remédio era APAGAR a venda inteira, e aí sumia junto
// a dose que foi vendida de verdade, e o dinheiro dela.
//
// A correção só DIMINUI: tira quantidade de um item (ou o item todo). Aumentar
// uma venda fechada seria cobrar do cliente depois que ele foi embora — isso é
// outra venda.
//
// O que muda, na ordem:
//   1. os itens e a conta: soma dos itens, serviço de 10% (se a mesa tinha),
//      desconto (a mesma porcentagem de antes) e o total;
//   2. o pagamento: a diferença sai primeiro do FIADO (ninguém deve fiado de
//      uma dose que não tomou), depois das outras formas, da última pra
//      primeira; o pagamento parcial (quem pagou e foi embora) fica por último;
//   3. o registro: a venda guarda o que foi tirado, quanto, quando e por quem.
//
// Estoque, caixa e receita ficam com a rota (precisam do banco); aqui é só a
// conta, sem banco, pra ser conferida sozinha.

const r2 = (x) => Math.round((Number(x) || 0) * 100) / 100;
const q3 = (x) => Math.round((Number(x) || 0) * 1000) / 1000;
const nume = (v) => {
  if (typeof v === 'number') return v;
  const s = String(v == null ? '' : v).trim();
  if (!s) return 0;
  // "1.234,56" ou "12,50" (jeito brasileiro) ou "12.5".
  const t = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
};

export function corrigirVenda(venda, qtds, { motivo = '', por = 'dona', agora = new Date().toISOString() } = {}) {
  if (!venda || !Array.isArray(venda.itens)) return { erro: 'Venda não encontrada.' };
  const itens = venda.itens;
  if (!Array.isArray(qtds) || qtds.length !== itens.length) return { erro: 'A lista de itens mudou. Abre a venda de novo.' };

  const removidos = [];
  const novosItens = [];
  for (let i = 0; i < itens.length; i += 1) {
    const it = itens[i] || {};
    const antes = q3(nume(it.qtd));
    const depois = q3(Number(qtds[i]));
    if (!(depois >= 0) || depois > antes + 1e-9) return { erro: `Só dá pra diminuir: ${it.nome || 'item'} tinha ${antes}.` };
    const saiu = q3(antes - depois);
    if (saiu > 0) removidos.push({ nome: it.nome || 'Item', qtd: saiu, preco: r2(nume(it.preco)), cardapioId: it.cardapioId || '', extras: Array.isArray(it.extras) ? it.extras : [] });
    if (depois > 0) novosItens.push({ ...it, qtd: depois });
  }
  if (!removidos.length) return { erro: 'Nada mudou: diminui a quantidade do que não foi vendido.' };
  // TUDO EM ZERO = CANCELAR A VENDA INTEIRA. É o caso da venda REPETIDA ("a
  // Sarah lançou 2 vezes"): a mesma conta fechada duas vezes vira duas vendas
  // de 1 dose cada, e não há o que diminuir dentro de nenhuma delas. Cancelar
  // por aqui (e não pelo "apagar" da Auditoria) devolve o estoque e acerta o
  // caixa e a receita, igual a uma correção.
  const cancelar = !novosItens.length;

  // A conta de novo, com as MESMAS regras do fechamento.
  const subtotal = cancelar ? 0 : r2(novosItens.reduce((s, it) => s + nume(it.qtd) * nume(it.preco), 0));
  const tinhaServico = nume(venda.servico) > 0.005;
  const servico = tinhaServico ? r2(subtotal * 0.10) : 0;
  const bruto = r2(subtotal + servico);
  const pct = Math.max(0, Math.min(100, nume(venda.descontoPct)));
  // Desconto em porcentagem acompanha a conta; desconto sem porcentagem (antigo)
  // fica o mesmo, até o limite do que sobrou.
  const desconto = cancelar ? 0 : (pct > 0 ? r2(bruto * pct / 100) : Math.min(r2(venda.desconto), bruto));
  const total = cancelar ? 0 : r2(bruto - desconto);
  const totalAntes = r2(venda.total);
  let falta = r2(totalAntes - total);
  if (!(falta > 0.004)) return { erro: 'O total não diminuiu.' };

  // De qual pagamento sai a diferença.
  const pags = (Array.isArray(venda.pagamentos) && venda.pagamentos.length
    ? venda.pagamentos
    : [{ forma: venda.pagamento || 'Dinheiro', valor: totalAntes }]).map((p) => ({ ...p, valor: r2(p.valor) }));
  const reducoes = {};
  const tira = (i, limite) => {
    const v = Math.min(pags[i].valor, falta, limite == null ? Infinity : limite);
    if (!(v > 0.004)) return;
    pags[i].valor = r2(pags[i].valor - v);
    reducoes[pags[i].forma] = r2((reducoes[pags[i].forma] || 0) + v);
    falta = r2(falta - v);
  };
  // 1) O fiado — mas nunca abaixo do que o cliente já pagou dele.
  const fiadoAntes = r2(venda.fiado);
  const abatido = r2(venda.abatido);
  let podeTirarFiado = Math.max(0, r2(fiadoAntes - abatido));
  for (let i = pags.length - 1; i >= 0 && falta > 0.004 && podeTirarFiado > 0.004; i -= 1) {
    if (pags[i].forma !== 'Fiado') continue;
    const antes = pags[i].valor;
    tira(i, podeTirarFiado);
    podeTirarFiado = r2(podeTirarFiado - (antes - pags[i].valor));
  }
  // 2) As outras formas, da última pra primeira; 3) por fim, os parciais.
  for (const parcial of [false, true]) {
    for (let i = pags.length - 1; i >= 0 && falta > 0.004; i -= 1) {
      if (pags[i].forma === 'Fiado' || !!pags[i].parcial !== parcial) continue;
      tira(i);
    }
  }
  if (falta > 0.004) return { erro: 'Não consegui tirar a diferença dos pagamentos desta venda.' };

  const pagamentos = pags.filter((p) => p.valor > 0.004);
  const fiado = r2(fiadoAntes - (reducoes.Fiado || 0));
  const reducao = r2(totalAntes - total);
  const nova = {
    ...venda,
    ...(cancelar ? { cancelada: true } : {}),
    itens: novosItens, subtotal, servico, desconto, total, pagamentos,
    pagamento: pagamentos.length === 1 ? pagamentos[0].forma : (pagamentos.length ? 'Dividido' : venda.pagamento),
    fiado,
    pago: fiado - abatido <= 0.005 ? true : venda.pago,
    totalOriginal: venda.totalOriginal != null ? venda.totalOriginal : totalAntes,
    correcoes: [...(Array.isArray(venda.correcoes) ? venda.correcoes : []), {
      em: agora, por, motivo: String(motivo || '').slice(0, 120),
      removidos: removidos.map(({ nome, qtd, preco }) => ({ nome, qtd, preco })),
      de: totalAntes, para: total, reducoes,
    }],
  };
  return { venda: nova, removidos, reducao, reducoes, servicoAntes: r2(venda.servico), servicoDepois: servico, cancelada: cancelar };
}

// O que muda num caixa JÁ FECHADO. O caixa aberto não precisa: ele soma as
// vendas na hora. O fechado guardou os números do fechamento — e a sobra ou
// falta da gaveta tem que ser refeita com o dinheiro que realmente devia estar
// lá. (Se o cliente pagou uma dose só, a gaveta tinha uma dose a menos do que o
// app esperava: o caixa acusava falta que não existia.)
export function ajustarCaixaFechado(caixa, reducoes, servicoTirado = 0) {
  if (!caixa || caixa.aberto) return null;
  const entradas = { ...(caixa.entradas || {}) };
  let recebidoMenos = 0;
  for (const [forma, v] of Object.entries(reducoes || {})) {
    entradas[forma] = r2((Number(entradas[forma]) || 0) - v);
    if (forma !== 'Fiado') recebidoMenos = r2(recebidoMenos + v);
  }
  const dinheiroFinal = r2((Number(caixa.dinheiroFinal) || 0) - (reducoes.Dinheiro || 0));
  const contado = caixa.contado != null ? Number(caixa.contado) : null;
  return {
    ...caixa,
    entradas,
    recebido: r2((Number(caixa.recebido) || 0) - recebidoMenos),
    dinheiroFinal,
    fiado: r2((Number(caixa.fiado) || 0) - (reducoes.Fiado || 0)),
    servico: r2((Number(caixa.servico) || 0) - servicoTirado),
    diferenca: contado != null ? r2(contado - dinheiroFinal) : caixa.diferenca,
    recebidoMenosPorCorrecao: r2((Number(caixa.recebidoMenosPorCorrecao) || 0) + recebidoMenos),
  };
}
