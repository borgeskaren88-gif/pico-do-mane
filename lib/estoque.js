// Lógica pura do estoque (sem React), pra ficar fácil de testar e reaproveitar
// no componente, no servidor (baixa ao fechar comanda) e na disponibilidade
// mostrada ao garçom.
import { num, limparNome, uid, todayISO } from './util';

export const UNIDADES = ['un', 'cx', 'fardo', 'pct', 'grf', 'kg', 'g', 'L', 'ml', 'saco', 'lata', 'dose'];
export const UNIDADES_CONTEUDO = ['ml', 'g']; // unidade do "conteúdo por unidade" (garrafa de 1000 ml, saco de 5000 g)
export const MOTIVOS_SAIDA = ['Consumo / uso', 'Venda', 'Perda / vencido', 'Quebra', 'Cortesia', 'Ajuste', 'Outro'];
export const MAX_MOV = 60; // guarda os últimos movimentos por item, pra não inchar o banco

export const igualNome = (a, b) => limparNome(a).toLowerCase() === limparNome(b).toLowerCase();

// Grandezas conversíveis entre si (mesma família).
const MASSA = { g: 1, kg: 1000 };
const VOLUME = { ml: 1, l: 1000, L: 1000 };
function familia(u) { if (MASSA[u] != null) return 'massa'; if (VOLUME[u] != null) return 'volume'; return null; }
// Fator entre duas unidades da MESMA família (ou iguais). null se não dá.
function fatorMesmaFamilia(de, para) {
  if (de && para && de === para) return 1;
  const fd = familia(de), fp = familia(para);
  if (fd && fd === fp) { const base = fd === 'massa' ? MASSA : VOLUME; return base[de] / base[para]; }
  return null;
}

// Converte uma quantidade da RECEITA (qtd + unidade) para a unidade do ITEM de
// estoque. Trata o "conteúdo por unidade": ex.: a receita pede 50 ml e o item é
// uma garrafa de 1000 ml -> 50/1000 = 0,05 garrafa. Se nada casa, usa direto.
export function qtdNaUnidadeDoItem(qtd, unidadeReceita, item) {
  const q = num(qtd);
  if (q <= 0) return 0;
  const uItem = item?.unidade;
  // 1) mesma unidade / mesma grandeza (kg<->g, L<->ml)
  const direto = fatorMesmaFamilia(unidadeReceita, uItem);
  if (direto != null) return q * direto;
  // 2) via "conteúdo por unidade" (ex.: 50 ml numa garrafa de 1000 ml)
  const conteudo = num(item?.conteudo);
  const uConteudo = item?.conteudoUnid;
  if (conteudo > 0 && uConteudo) {
    const fator = fatorMesmaFamilia(unidadeReceita, uConteudo);
    if (fator != null) return (q * fator) / conteudo;
  }
  // 3) sem conversão conhecida: assume mesma unidade
  return q;
}

// Quantos "pratos/taças" a ficha rende com o estoque atual: o menor entre todos
// os ingredientes (o que trava primeiro). Ingredientes não cadastrados são
// ignorados. Retorna 0 se a ficha estiver vazia.
export function podeProduzir(fichaItens, estoque) {
  const byId = new Map((estoque || []).map((it) => [it.id, it]));
  let min = Infinity;
  for (const ing of fichaItens || []) {
    const it = byId.get(ing.estoqueId);
    if (!it) continue;
    const precisa = qtdNaUnidadeDoItem(ing.qtd, ing.unidade, it);
    if (precisa <= 0) continue;
    const possivel = Math.floor(num(it.saldo) / precisa);
    if (possivel < min) min = possivel;
  }
  return min === Infinity ? 0 : Math.max(0, min);
}

// Disponibilidade de cada item do cardápio a partir das fichas + estoque.
// Retorna { [cardapioId]: { disp, temFicha } }. disp = null significa "sem ficha"
// (não dá pra saber -> não avisa nada). disp = 0 é falta; disp baixo é acabando.
export function disponibilidadeCardapio(cardapio, fichas, estoque) {
  const fMap = new Map((fichas || []).filter((f) => f && f.cardapioId && Array.isArray(f.itens) && f.itens.length).map((f) => [f.cardapioId, f.itens]));
  const res = {};
  for (const c of cardapio || []) {
    const itens = fMap.get(c.id);
    res[c.id] = itens ? { disp: podeProduzir(itens, estoque), temFicha: true } : { disp: null, temFicha: false };
  }
  return res;
}

// ENTRADAS de compra no estoque (soma no saldo dos itens já cadastrados e
// atualiza o custo). Itens não cadastrados são ignorados (viram sugestão).
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

// BAIXA automática pelas vendas do salão (comandas fechadas). Idempotente via
// `jaBaixadas` (ids de venda). Vendas sem ficha só são marcadas como vistas, e
// as antigas nunca são descontadas retroativamente. Usa a conversão com
// conteúdo, então taça de garrafa e porção de tábua baixam certinho.
// Retorna { estoque, baixadas, mudou, resumo }.
export function aplicarBaixasVendas(estoque, fichas, vendas, jaBaixadas) {
  const baixadasSet = new Set(Array.isArray(jaBaixadas) ? jaBaixadas : []);
  const vendasValidas = (Array.isArray(vendas) ? vendas : []).filter((v) => v && v.id);
  const idsPresentes = new Set(vendasValidas.map((v) => v.id));
  const naoVistas = vendasValidas.filter((v) => !baixadasSet.has(v.id));
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
        const baixa = qtdVendida * qtdNaUnidadeDoItem(ing.qtd, ing.unidade, novoEstoque[i]);
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

  if (mudouEstoque) novoEstoque = novoEstoque.map((it) => { if (it._c) { const { _c, ...rest } = it; return rest; } return it; });

  const baixadasFinal = [...baixadasSet].filter((id) => idsPresentes.has(id));
  return {
    estoque: mudouEstoque ? novoEstoque : estoque,
    baixadas: baixadasFinal,
    mudou: mudouEstoque,
    resumo: { vendas: naoVistas.length, itens: itensBaixados },
  };
}

// ---- Helpers atômicos usados pela API /api/estoque (servidor) ----

// Cria um item novo do catálogo, com saldo inicial (se houver) já como
// movimento de "contagem".
export function novoItemEstoque(campos) {
  const saldo = num(campos?.saldo);
  const item = {
    id: uid(),
    nome: limparNome(campos?.nome),
    categoria: String(campos?.categoria || ''),
    unidade: String(campos?.unidade || 'un'),
    saldo,
    minimo: num(campos?.minimo),
    custo: num(campos?.custo),
    conteudo: num(campos?.conteudo),
    conteudoUnid: campos?.conteudoUnid === 'g' ? 'g' : (campos?.conteudoUnid === 'ml' ? 'ml' : ''),
    atualizadoEm: todayISO(),
    movimentos: saldo > 0 ? [{ id: uid(), tipo: 'contagem', qtd: saldo, saldoDepois: saldo, motivo: 'Saldo inicial', data: todayISO(), ts: Date.now() }] : [],
  };
  return item;
}

// Aplica um movimento (entrada/saida/contagem) num item, devolvendo o item novo.
export function aplicarMovimentoItem(item, tipo, qtd, motivo) {
  const saldoAtual = num(item.saldo);
  const q = num(qtd);
  let saldoNovo = saldoAtual, mov;
  if (tipo === 'entrada') { saldoNovo = saldoAtual + q; mov = { tipo: 'entrada', qtd: q, motivo: motivo || 'Entrada manual' }; }
  else if (tipo === 'saida') { saldoNovo = Math.max(0, saldoAtual - q); mov = { tipo: 'saida', qtd: q, motivo: motivo || 'Saída' }; }
  else { const dif = q - saldoAtual; saldoNovo = q; mov = { tipo: 'contagem', qtd: q, motivo: `Contagem${dif !== 0 ? ` (${dif > 0 ? '+' : ''}${Math.round(dif * 1000) / 1000})` : ''}` }; }
  saldoNovo = Math.round(saldoNovo * 1000) / 1000;
  const movimento = { id: uid(), ...mov, saldoDepois: saldoNovo, data: todayISO(), ts: Date.now() };
  return { ...item, saldo: saldoNovo, atualizadoEm: todayISO(), movimentos: [movimento, ...(item.movimentos || [])].slice(0, MAX_MOV) };
}

// Atualiza só os METADADOS de um item (nome, categoria, unidade, mínimo, custo,
// conteúdo) — nunca o saldo (que só muda por movimento). Assim uma edição da
// dona não sobrescreve uma baixa feita por uma venda ao mesmo tempo.
export function editarMetadadosItem(item, campos) {
  const novo = { ...item };
  if ('nome' in campos) novo.nome = limparNome(campos.nome);
  if ('categoria' in campos) novo.categoria = String(campos.categoria || '');
  if ('unidade' in campos) novo.unidade = String(campos.unidade || 'un');
  if ('minimo' in campos) novo.minimo = num(campos.minimo);
  if ('custo' in campos) novo.custo = num(campos.custo);
  if ('conteudo' in campos) novo.conteudo = num(campos.conteudo);
  if ('conteudoUnid' in campos) novo.conteudoUnid = campos.conteudoUnid === 'g' ? 'g' : (campos.conteudoUnid === 'ml' ? 'ml' : '');
  return novo;
}
