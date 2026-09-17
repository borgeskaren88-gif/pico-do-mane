// Lógica pura do estoque (sem React), pra ficar fácil de testar e reaproveitar
// no componente, no servidor (baixa ao fechar comanda) e na disponibilidade
// mostrada ao garçom.
import { num, limparNome, uid, todayISO, numQtd, diaOperacional } from './util';

export const UNIDADES = ['un', 'cx', 'fardo', 'pct', 'grf', 'kg', 'g', 'L', 'ml', 'saco', 'lata', 'dose'];
export const UNIDADES_CONTEUDO = ['ml', 'g', 'un']; // conteúdo por unidade: garrafa 1000 ml, saco 5000 g, pacote 50 un
export const MOTIVOS_SAIDA = ['Consumo da casa', 'Desperdício', 'Vencido', 'Cortesia', 'Outro'];
export const MAX_MOV = 60; // guarda os últimos movimentos por item, pra não inchar o banco

export const igualNome = (a, b) => limparNome(a).toLowerCase() === limparNome(b).toLowerCase();
export const ehData = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

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

// Detalha o "rende": pra cada ingrediente, quantas doses o saldo atual dá, e
// aponta o GARGALO (o que trava primeiro). Assim a dona vê exatamente qual
// ingrediente está segurando a produção. Ingredientes sem item no estoque
// entram como faltando (semItem).
export function detalheProducao(fichaItens, estoque) {
  const byId = new Map((estoque || []).map((it) => [it.id, it]));
  const linhas = [];
  for (const ing of fichaItens || []) {
    const it = byId.get(ing.estoqueId);
    if (!it) { linhas.push({ estoqueId: ing.estoqueId, nome: '(item removido)', possivel: 0, semItem: true }); continue; }
    const precisa = qtdNaUnidadeDoItem(ing.qtd, ing.unidade, it);
    const possivel = precisa > 0 ? Math.floor(num(it.saldo) / precisa) : Infinity;
    linhas.push({ estoqueId: ing.estoqueId, nome: it.nome, possivel, saldo: num(it.saldo), unidade: it.unidade, aGosto: precisa <= 0 });
  }
  const contam = linhas.filter((l) => l.possivel !== Infinity);
  const rende = contam.length ? Math.max(0, Math.min(...contam.map((l) => l.possivel))) : 0;
  const gargalo = contam.length ? contam.reduce((a, b) => (b.possivel < a.possivel ? b : a)) : null;
  return { rende, gargalo, linhas };
}

// Custo de uma ficha técnica: soma o custo de cada ingrediente (quantidade da
// receita convertida pra unidade do item × custo unitário do item de estoque).
// `completo=false` se algum ingrediente não tem item/custo cadastrado (custo
// sai subestimado). Serve pra calcular a margem de cada produto do cardápio.
export function custoDaFicha(fichaItens, estoque) {
  const byId = new Map((estoque || []).map((it) => [it.id, it]));
  let custo = 0;
  let completo = true;
  for (const ing of fichaItens || []) {
    const it = byId.get(ing.estoqueId);
    if (!it) { completo = false; continue; }
    const c = num(it.custo);
    if (!(c > 0)) completo = false;
    custo += qtdNaUnidadeDoItem(ing.qtd, ing.unidade, it) * c;
  }
  return { custo: Math.round(custo * 100) / 100, completo };
}

// Custo dos SABORES de um item (a fruta escolhida na venda: caipirinha de
// morango, maracujá…). Como cada sabor custa diferente, devolve a média, o
// mínimo e o máximo — pra compor a margem do item que tem seletor de sabor.
export function custoDosSabores(sabores, estoque) {
  const byId = new Map((estoque || []).map((it) => [it.id, it]));
  const custos = [];
  for (const s of sabores || []) {
    const it = byId.get(String(s.estoqueId));
    if (!it) continue;
    custos.push(qtdNaUnidadeDoItem(s.qtd, s.unidade, it) * num(it.custo));
  }
  if (!custos.length) return { medio: 0, min: 0, max: 0, n: 0 };
  const r = (x) => Math.round(x * 100) / 100;
  return { medio: r(custos.reduce((a, b) => a + b, 0) / custos.length), min: r(Math.min(...custos)), max: r(Math.max(...custos)), n: custos.length };
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

// CORRIGE os custos do estoque usando as Compras como fonte da verdade. Para
// cada item, pega o valor unitário da compra mais recente com o mesmo nome. Serve
// pra consertar custos que ficaram inflados por um bug antigo de leitura de
// número — as Compras guardam o preço como texto puro, então parseiam certo com
// o num() atual. Itens sem compra correspondente ficam como estão.
export function recalcularCustosPelasCompras(estoque, compras) {
  if (!Array.isArray(estoque) || !estoque.length) return { estoque, corrigidos: 0 };
  const comprasArr = Array.isArray(compras) ? compras : [];
  let corrigidos = 0;
  const novo = estoque.map((it) => {
    const doItem = comprasArr.filter((c) => igualNome(c.produto, it.nome) && num(c.valorUnit) > 0);
    if (!doItem.length) return it;
    doItem.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const novoCusto = num(doItem[0].valorUnit);
    if (novoCusto > 0 && Math.abs(novoCusto - num(it.custo)) > 0.005) { corrigidos += 1; return { ...it, custo: novoCusto, atualizadoEm: todayISO() }; }
    return it;
  });
  return { estoque: corrigidos ? novo : estoque, corrigidos };
}

// BAIXA automática pelas vendas do salão (comandas fechadas). Idempotente via
// `jaBaixadas` (ids de venda). Vendas sem ficha só são marcadas como vistas, e
// as antigas nunca são descontadas retroativamente. Usa a conversão com
// conteúdo, então taça de garrafa e porção de tábua baixam certinho.
// Retorna { estoque, baixadas, mudou, resumo }.
// `podar` remove das "já baixadas" os ids de vendas que sumiram (foram
// apagadas) — só faz sentido quando recebe TODAS as vendas (reconciliação).
// No fechamento de UMA comanda passa-se só a venda nova, então podar=false,
// senão a lista de baixadas seria zerada e as vendas antigas seriam descontadas
// de novo (bug que zerava o estoque "do nada").
export function aplicarBaixasVendas(estoque, fichas, vendas, jaBaixadas, podar = true) {
  const baixadasSet = new Set(Array.isArray(jaBaixadas) ? jaBaixadas : []);
  const vendasValidas = (Array.isArray(vendas) ? vendas : []).filter((v) => v && v.id);
  const idsPresentes = new Set(vendasValidas.map((v) => v.id));
  const naoVistas = vendasValidas.filter((v) => !baixadasSet.has(v.id));
  const baixadasPodadas = podar ? [...baixadasSet].filter((id) => idsPresentes.has(id)) : [...baixadasSet];
  const houvePoda = podar && baixadasPodadas.length !== baixadasSet.size;

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
      const qtdVendida = num(item.qtd) || 0;
      if (qtdVendida <= 0) continue;
      // Ingredientes = ficha do prato + "extras" do item (ex.: a fruta do sabor
      // escolhido numa caipirinha). Assim o sabor baixa a fruta certa.
      const ficha = fichaPorCardapio.get(item.cardapioId) || [];
      const extras = Array.isArray(item.extras) ? item.extras : [];
      const ingredientes = [...ficha, ...extras];
      if (!ingredientes.length) continue;
      for (const ing of ingredientes) {
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

  const baixadasFinal = podar ? [...baixadasSet].filter((id) => idsPresentes.has(id)) : [...baixadasSet];
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
    validade: ehData(campos?.validade) ? campos.validade : '',
    atualizadoEm: todayISO(),
    movimentos: saldo > 0 ? [{ id: uid(), tipo: 'contagem', qtd: saldo, saldoDepois: saldo, motivo: 'Saldo inicial', data: todayISO(), ts: Date.now() }] : [],
  };
  return item;
}

// ---------------------------------------------------------------------------
// VALIDADE
// O "hoje" daqui é o DIA OPERACIONAL (a madrugada ainda conta como a noite de
// ontem), o mesmo que o Darci usa. Se um usasse o dia do calendário e o outro
// não, das 00h às 6h — bem na hora em que ela fecha o bar — a tela diria "vence
// hoje" e o Darci diria "vence amanhã".
//
// Uma data por produto, que a Karen atualiza quando abastece. Quando há lote
// misturado (uma lata de agosto e três de dezembro), vale a data mais próxima:
// é a que vai estragar primeiro, e é dela que ela precisa saber.
//
// Controle por lote seria mais exato, mas depende de alguém lembrar de marcar
// "esse lote acabou" toda vez. Num bar isso morre em dois meses, e aí o
// controle vira mentira — pior que não ter. Uma data só é honesta.

// Quantos dias faltam (negativo = já venceu). null se o item não tem data.
export function diasParaVencer(item, hoje = diaOperacional()) {
  if (!item || !ehData(item.validade)) return null;
  const a = new Date(item.validade + 'T12:00:00');
  const b = new Date(hoje + 'T12:00:00');
  return Math.round((a - b) / 86400000);
}

// O quanto isso é urgente. Os cortes são de bar: 3 dias é "usa agora ou perde",
// 7 dias dá pra planejar uma promoção ou encaixar num prato.
export function nivelValidade(dias) {
  if (dias == null) return null;
  if (dias < 0) return 'vencido';
  if (dias <= 3) return 'urgente';
  if (dias <= 7) return 'atencao';
  return 'ok';
}

// Só o que tem saldo: item zerado não estraga. Vem do mais urgente pro menos.
export function itensVencendo(estoque, hoje = diaOperacional(), ateDias = 7) {
  const out = [];
  for (const it of (estoque || [])) {
    if (!it || num(it.saldo) <= 0) continue;
    const dias = diasParaVencer(it, hoje);
    if (dias == null || dias > ateDias) continue;
    out.push({ item: it, dias, nivel: nivelValidade(dias) });
  }
  return out.sort((a, b) => a.dias - b.dias);
}

// "venceu ontem", "vence hoje", "vence amanhã", "vence em 5 dias"
export function textoValidade(dias) {
  if (dias == null) return '';
  if (dias < -1) return `venceu há ${Math.abs(dias)} dias`;
  if (dias === -1) return 'venceu ontem';
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  return `vence em ${dias} dias`;
}

// Aplica um movimento (entrada/saida/contagem) num item, devolvendo o item novo.
export function aplicarMovimentoItem(item, tipo, qtd, motivo, validade) {
  const saldoAtual = num(item.saldo);
  const q = numQtd(qtd); // ponto digitado no teclado do celular é decimal, não milhar
  let saldoNovo = saldoAtual, mov;
  if (tipo === 'entrada') { saldoNovo = saldoAtual + q; mov = { tipo: 'entrada', qtd: q, motivo: motivo || 'Entrada manual' }; }
  else if (tipo === 'saida') { saldoNovo = Math.max(0, saldoAtual - q); mov = { tipo: 'saida', qtd: q, motivo: motivo || 'Saída' }; }
  else { const dif = q - saldoAtual; saldoNovo = q; mov = { tipo: 'contagem', qtd: q, motivo: `Contagem${dif !== 0 ? ` (${dif > 0 ? '+' : ''}${Math.round(dif * 1000) / 1000})` : ''}` }; }
  saldoNovo = Math.round(saldoNovo * 1000) / 1000;
  const movimento = { id: uid(), ...mov, saldoDepois: saldoNovo, data: todayISO(), ts: Date.now() };
  const novo = { ...item, saldo: saldoNovo, atualizadoEm: todayISO(), movimentos: [movimento, ...(item.movimentos || [])].slice(0, MAX_MOV) };
  // Abasteceu e informou a validade: passa a valer a nova data. Se o lote que
  // já estava aqui vence ANTES, a antiga é que continua valendo — é ela que vai
  // estragar primeiro, e é dela que a Karen precisa ser avisada.
  if (tipo === 'entrada' && ehData(validade)) {
    novo.validade = (ehData(item.validade) && item.validade < validade) ? item.validade : validade;
  }
  // Zerou o saldo: a validade morre junto, senão fica avisando de item que
  // nem existe mais.
  if (saldoNovo <= 0) novo.validade = '';
  return novo;
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
  if ('validade' in campos) novo.validade = ehData(campos.validade) ? campos.validade : '';
  return novo;
}
