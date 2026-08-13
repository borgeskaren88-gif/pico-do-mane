// Lógica pura do estoque (sem React), pra ficar fácil de testar e reaproveitar
// tanto no componente Estoque quanto no Dashboard (baixa automática das vendas).
import { num, limparNome, uid, todayISO } from './util';

export const UNIDADES = ['un', 'cx', 'fardo', 'pct', 'grf', 'kg', 'g', 'L', 'ml', 'saco', 'lata', 'dose'];
export const MOTIVOS_SAIDA = ['Consumo / uso', 'Venda', 'Perda / vencido', 'Quebra', 'Cortesia', 'Ajuste', 'Outro'];
const MAX_MOV = 60; // guarda os últimos movimentos por item, pra não inchar o banco

const igualNome = (a, b) => limparNome(a).toLowerCase() === limparNome(b).toLowerCase();

// Conversão entre unidades da MESMA grandeza (massa e volume). Ex.: a receita
// pede em gramas mas o estoque está em kg -> fator 1/1000. Se as unidades não
// são conversíveis (ou são iguais), usa 1 (baixa direto na unidade do estoque).
const MASSA = { g: 1, kg: 1000 };
const VOLUME = { ml: 1, l: 1000, L: 1000 };
export function fatorConversao(de, para) {
  if (!de || !para || de === para) return 1;
  if (MASSA[de] != null && MASSA[para] != null) return MASSA[de] / MASSA[para];
  if (VOLUME[de] != null && VOLUME[para] != null) return VOLUME[de] / VOLUME[para];
  return 1;
}

// Quantos "pratos" a ficha rende com o estoque atual: o menor entre todos os
// ingredientes (o que trava primeiro). Ingredientes não cadastrados são
// ignorados. Retorna 0 se a ficha estiver vazia.
export function podeProduzir(fichaItens, estoque) {
  const byId = new Map((estoque || []).map((it) => [it.id, it]));
  let min = Infinity;
  for (const ing of fichaItens || []) {
    const it = byId.get(ing.estoqueId);
    if (!it) continue;
    const precisa = num(ing.qtd) * fatorConversao(ing.unidade, it.unidade);
    if (precisa <= 0) continue;
    const possivel = Math.floor(num(it.saldo) / precisa);
    if (possivel < min) min = possivel;
  }
  return min === Infinity ? 0 : Math.max(0, min);
}

// ENTRADAS de compra no estoque: para cada item comprado que já existe no
// catálogo (mesmo nome), soma a quantidade no saldo e atualiza o custo. Itens
// não cadastrados são ignorados aqui (viram sugestão na tela). Retorna um novo
// array só se algo mudou.
export function aplicarEntradasEstoque(estoque, comprasNovas) {
  if (!Array.isArray(estoque) || !estoque.length || !Array.isArray(comprasNovas) || !comprasNovas.length) return estoque;
  let mudou = false;
  const novo = estoque.map((it) => {
    const compras = comprasNovas.filter((c) => igualNome(c.produto, it.nome) && num(c.quantidade) > 0);
    if (!compras.length) return it;
    mudou = true;
    let saldo = num(it.saldo);
    let custo = num(it.custo);
    const movs = [];
    for (const c of compras) {
      const q = num(c.quantidade);
      saldo += q;
      if (num(c.valorUnit) > 0) custo = num(c.valorUnit);
      movs.push({ id: uid(), tipo: 'compra', qtd: q, saldoDepois: saldo, motivo: c.fornecedor ? `Compra · ${limparNome(c.fornecedor)}` : 'Compra', data: c.data || todayISO(), ts: Date.now() });
    }
    return { ...it, saldo, custo, atualizadoEm: todayISO(), movimentos: [...movs, ...(it.movimentos || [])].slice(0, MAX_MOV) };
  });
  return mudou ? novo : estoque;
}

// BAIXA automática pelas vendas do salão (comandas fechadas). Para cada venda
// ainda não processada, olha a ficha técnica de cada item vendido e desconta os
// ingredientes do estoque (convertendo a unidade). É idempotente: guarda os ids
// das vendas já baixadas em `jaBaixadas`, então rodar de novo não desconta de
// novo. Vendas sem ficha (ou de itens sem ficha) só são marcadas como vistas —
// nunca descontam nada. Isso também garante que, quando você criar uma ficha
// nova, as vendas ANTIGAS (já vistas) não sejam descontadas retroativamente.
//
// Retorna { estoque, baixadas, mudou, resumo }.
export function aplicarBaixasVendas(estoque, fichas, vendas, jaBaixadas) {
  const baixadasSet = new Set(Array.isArray(jaBaixadas) ? jaBaixadas : []);
  const vendasValidas = (Array.isArray(vendas) ? vendas : []).filter((v) => v && v.id);
  const idsPresentes = new Set(vendasValidas.map((v) => v.id));
  const naoVistas = vendasValidas.filter((v) => !baixadasSet.has(v.id));

  // Poda ids de vendas que não existem mais (ex.: venda excluída), pra a lista
  // de "já baixadas" não crescer pra sempre.
  const baixadasPodadas = [...baixadasSet].filter((id) => idsPresentes.has(id));
  const houvePoda = baixadasPodadas.length !== baixadasSet.size;

  if (!naoVistas.length) {
    return houvePoda
      ? { estoque, baixadas: baixadasPodadas, mudou: false, resumo: { vendas: 0, itens: 0 } }
      : { estoque, baixadas: jaBaixadas, mudou: false, resumo: { vendas: 0, itens: 0 } };
  }

  const fichaPorCardapio = new Map();
  for (const f of (Array.isArray(fichas) ? fichas : [])) {
    if (f && f.cardapioId && Array.isArray(f.itens) && f.itens.length) fichaPorCardapio.set(f.cardapioId, f.itens);
  }

  // Trabalha sobre uma cópia mutável indexada por id.
  const idx = new Map();
  let novoEstoque = (estoque || []).map((it, i) => { idx.set(it.id, i); return it; });
  let mudouEstoque = false;
  let itensBaixados = 0;
  const clonar = (i) => { if (novoEstoque[i]._c) return; novoEstoque[i] = { ...novoEstoque[i], movimentos: [...(novoEstoque[i].movimentos || [])], _c: true }; };

  for (const v of naoVistas) {
    for (const item of (v.itens || [])) {
      const ficha = fichaPorCardapio.get(item.cardapioId);
      if (!ficha) continue;
      const qtdVendida = num(item.qtd) || 0;
      if (qtdVendida <= 0) continue;
      for (const ing of ficha) {
        const i = idx.get(ing.estoqueId);
        if (i == null) continue;
        const it = novoEstoque[i];
        const baixa = qtdVendida * num(ing.qtd) * fatorConversao(ing.unidade, it.unidade);
        if (baixa <= 0) continue;
        clonar(i);
        const saldoNovo = Math.max(0, num(novoEstoque[i].saldo) - baixa);
        novoEstoque[i].saldo = Math.round(saldoNovo * 1000) / 1000;
        novoEstoque[i].atualizadoEm = todayISO();
        novoEstoque[i].movimentos = [{ id: uid(), tipo: 'venda', qtd: Math.round(baixa * 1000) / 1000, saldoDepois: novoEstoque[i].saldo, motivo: `Venda${v.mesa ? ` · mesa ${v.mesa}` : ''}`, data: v.data || todayISO(), ts: Date.now() }, ...novoEstoque[i].movimentos].slice(0, MAX_MOV);
        mudouEstoque = true;
        itensBaixados += 1;
      }
    }
    baixadasSet.add(v.id);
  }

  // Limpa o marcador interno de clonagem.
  if (mudouEstoque) novoEstoque = novoEstoque.map((it) => { if (it._c) { const { _c, ...rest } = it; return rest; } return it; });

  const baixadasFinal = [...baixadasSet].filter((id) => idsPresentes.has(id));
  return {
    estoque: mudouEstoque ? novoEstoque : estoque,
    baixadas: baixadasFinal,
    mudou: mudouEstoque,
    resumo: { vendas: naoVistas.length, itens: itensBaixados },
  };
}
