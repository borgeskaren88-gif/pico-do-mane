// Lógica pura do estoque (sem React), pra ficar fácil de testar e reaproveitar
// no componente, no servidor (baixa ao fechar comanda) e na disponibilidade
// mostrada ao garçom.
import { num, limparNome, uid, todayISO, numQtd, diaOperacional, addDays } from './util';

export const UNIDADES = ['un', 'cx', 'fardo', 'pct', 'grf', 'kg', 'g', 'L', 'ml', 'saco', 'lata', 'dose'];
export const UNIDADES_CONTEUDO = ['ml', 'g', 'un']; // conteúdo por unidade: garrafa 1000 ml, saco 5000 g, pacote 50 un
export const MOTIVOS_SAIDA = ['Consumo da casa', 'Desperdício', 'Vencido', 'Cortesia', 'Outro'];
// Quantos movimentos cada item guarda. Era 60, e num item de alto giro (gelo,
// chopp) isso cobria 2 ou 3 dias: cada venda gerava um movimento, e um sábado
// cheio sozinho estourava o limite. Aí o ritmo de consumo de 21 dias que avisa
// "está acabando" lia só metade do consumo e avisava tarde.
//
// Agora as baixas de venda do mesmo dia entram AGRUPADAS num movimento só (ver
// aplicarBaixasVendas), então 180 cobre uns 5 meses de histórico real sem
// inchar o banco.
export const MAX_MOV = 180;

// Nome comparável: sem acento, sem maiúscula, sem espaço sobrando. A nota do
// fornecedor escreve "Maracuja" e o estoque "Maracujá" — pra máquina eram dois
// produtos diferentes, e a compra não entrava.
export const chaveNome = (s) => limparNome(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const igualNome = (a, b) => chaveNome(a) === chaveNome(b);
export const ehData = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Um nome contém o outro como palavra inteira? "maracuja c/semente pct 1kg"
// contém "maracuja". Palavra inteira e 4 letras no mínimo, senão "uva" casaria
// com "luva" e "cha" com "chantilly".
const contemPalavra = (todo, parte) =>
  parte.length >= 4 && new RegExp(`(^|[^a-z0-9])${escaparRegex(parte)}([^a-z0-9]|$)`).test(todo);

// Qual item do estoque este produto comprado é?
//
// A nota do fornecedor vem com embalagem e peso grudados no nome —
// "Morango Fruta pct 1KG" — e o estoque tem só "Morango". Exigir o nome
// idêntico fazia a compra entrar em despesa e em contas a pagar, mas não somar
// nada no saldo: o produto simplesmente não existia pro sistema.
//
// Devolve null quando há empate (dois itens do estoque cabem no nome). Nesse
// caso é ela quem escolhe — chutar entre dois seria pior que não entrar.
export function sugerirItemEstoque(produto, estoque) {
  const alvo = chaveNome(produto);
  if (!alvo) return null;
  const itens = Array.isArray(estoque) ? estoque : [];
  const exato = itens.find((it) => it && chaveNome(it.nome) === alvo);
  if (exato) return { item: exato, exato: true };
  const cands = itens.filter((it) => {
    const n = chaveNome(it && it.nome);
    return !!n && (contemPalavra(alvo, n) || contemPalavra(n, alvo));
  });
  return cands.length === 1 ? { item: cands[0], exato: false } : null;
}

// Onde esta compra vai cair no estoque. A ligação que ela escolheu na mão
// (estoqueId) manda sempre — foi ela que disse, não se discute.
export function resolverCompraNoEstoque(compra, estoque) {
  const itens = Array.isArray(estoque) ? estoque : [];
  const id = compra && compra.estoqueId;
  if (id === 'nenhum') return null;
  if (id) {
    const it = itens.find((x) => x && x.id === id);
    if (it) return { item: it, como: 'vinculo' };
  }
  const s = sugerirItemEstoque(compra && compra.produto, itens);
  return s ? { item: s.item, como: s.exato ? 'nome' : 'parecido' } : null;
}

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
  // numQtd, não num: isto é QUANTIDADE, e os dois leem o ponto diferente.
  // "0.385" kg de camarão virava 385 kg com num() (que trata 3 casas como
  // separador de milhar), e o custo do prato explodia — o produto aparecia no
  // prejuízo sem motivo. A tela da ficha já valida com essa mesma régua.
  const q = numQtd(qtd);
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

// COMO a quantidade da receita vira quantidade do item — e, principalmente, se
// ela virou POR CHUTE.
//
// qtdNaUnidadeDoItem tem um último recurso: quando não conhece a conversão,
// "assume mesma unidade" e devolve a quantidade crua. Isso é silencioso e é a
// armadilha mais cara do sistema: uma receita que pede 300 ml de açaí, num item
// cadastrado como POTE (sem dizer quantos ml tem o pote), vira 300 POTES — e um
// prato de R$ 30 passa a custar vinte e um mil reais.
//
// Aqui o chute deixa de ser silencioso: devolve ok=false e diz por quê.
export function conversaoDaReceita(unidadeReceita, item) {
  const u = String(unidadeReceita || '');
  if (fatorMesmaFamilia(u, item?.unidade) != null) return { ok: true, via: 'direto' };
  const conteudo = num(item?.conteudo);
  const uc = item?.conteudoUnid;
  if (conteudo > 0 && uc && fatorMesmaFamilia(u, uc) != null) return { ok: true, via: 'conteudo' };
  return {
    ok: false,
    via: 'chute',
    // Diferencia "faltou preencher o conteúdo" de "o conteúdo está numa
    // grandeza que não casa" — o conserto é diferente em cada caso.
    temConteudo: conteudo > 0 && !!uc,
  };
}

// Varre TODAS as fichas atrás do chute de unidade.
//
// Devolve um produto por linha, com os ingredientes problemáticos e quanto
// cada um está inflando o custo do prato. Ordena pelo estrago em reais: é por
// onde consertar rende mais.
export function fichasComUnidadeSolta(fichas = [], estoque = [], cardapio = []) {
  const porId = new Map((estoque || []).map((it) => [it.id, it]));
  const doCardapio = new Map((cardapio || []).filter((c) => c && c.id).map((c) => [c.id, c]));
  const saida = [];
  for (const f of (fichas || [])) {
    if (!f || !f.cardapioId || !Array.isArray(f.itens)) continue;
    const problemas = [];
    for (const ing of f.itens) {
      const it = porId.get(ing && ing.estoqueId);
      if (!it) continue;
      const q = numQtd(ing.qtd);
      if (!(q > 0)) continue; // ingrediente "a gosto" não converte nada
      const c = conversaoDaReceita(ing.unidade, it);
      if (c.ok) continue;
      problemas.push({
        estoqueId: it.id,
        nome: it.nome,
        qtd: q,
        unidadeReceita: String(ing.unidade || '') || '(sem unidade)',
        unidadeItem: it.unidade || 'un',
        temConteudo: c.temConteudo,
        // O que este ingrediente está somando no custo do prato, com o chute.
        custoGerado: Math.round(q * num(it.custo) * 100) / 100,
      });
    }
    if (!problemas.length) continue;
    const c = doCardapio.get(f.cardapioId);
    problemas.sort((a, b) => b.custoGerado - a.custoGerado);
    saida.push({
      cardapioId: f.cardapioId,
      produto: (c && c.nome) || '(produto removido do cardápio)',
      preco: num(c && c.preco),
      problemas,
      custoGerado: Math.round(problemas.reduce((s, p) => s + p.custoGerado, 0) * 100) / 100,
    });
  }
  return saida.sort((a, b) => b.custoGerado - a.custoGerado);
}

// Os insumos culpados, do pior pro menos pior, sem repetir.
//
// Um item de estoque mal cadastrado costuma estragar VÁRIAS fichas de uma vez
// (o açaí aparece em toda tigela do cardápio). Consertar o item conserta todas,
// então é esta a lista que vale seguir — não a de produtos.
export function insumosComUnidadeSolta(fichas = [], estoque = [], cardapio = []) {
  const m = new Map();
  for (const linha of fichasComUnidadeSolta(fichas, estoque, cardapio)) {
    for (const p of linha.problemas) {
      const g = m.get(p.estoqueId) || { ...p, produtos: [], custoGerado: 0 };
      g.produtos.push(linha.produto);
      g.custoGerado = Math.round((g.custoGerado + p.custoGerado) * 100) / 100;
      m.set(p.estoqueId, g);
    }
  }
  return [...m.values()].sort((a, b) => b.custoGerado - a.custoGerado);
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

// ---------------------------------------------------------------------------
// COMPRAS QUE NÃO VIRARAM SALDO
// ---------------------------------------------------------------------------
// Compra registrada antes de o produto existir no estoque (ou com o nome da
// nota, que não casava) entrou em despesa e em contas a pagar e não somou nada
// na prateleira. Isto acha essas linhas pra ela lançar com um toque, em vez de
// digitar tudo de novo.
//
// O cuidado é não somar duas vezes. Dois freios:
//   1) estoqueEm: carimbo gravado na linha quando ela lança daqui.
//   2) o extrato do item: se já existe um movimento de compra no mesmo dia com
//      a mesma quantidade, aquela compra já entrou (foi automático, na hora).
// E só olha os últimos dias, porque o extrato guarda um número limitado de
// movimentos — mais pra trás não dá pra ter certeza, e na dúvida não oferece.
export function compraJaNoExtrato(compra, item, entrada) {
  const q = entrada ? entrada.qtd : numQtd(compra && compra.quantidade);
  const data = (compra && compra.data) || '';
  return (item.movimentos || []).some((m) =>
    m && m.tipo === 'compra' && m.data === data && Math.abs(numQtd(m.qtd) - q) < 0.0001);
}

export function comprasPendentesDeEstoque(compras, estoque, dias = 45, hoje = todayISO()) {
  const itens = Array.isArray(estoque) ? estoque : [];
  if (!itens.length) return [];
  const desde = addDays(hoje, -dias);
  const pend = [];
  for (const c of (Array.isArray(compras) ? compras : [])) {
    if (!c || c.estoqueEm || c.estoqueId === 'nenhum') continue;
    if (!(numQtd(c.qtdCompra || c.quantidade) > 0)) continue;
    if (!c.data || c.data < desde) continue;
    const r = resolverCompraNoEstoque(c, itens);
    if (!r) continue;
    const entrada = entradaDaCompra(c, r.item);
    if (!entrada || compraJaNoExtrato(c, r.item, entrada)) continue;
    pend.push({ compra: c, item: r.item, entrada });
  }
  return pend.sort((a, b) => String(b.compra.data).localeCompare(String(a.compra.data)));
}

// ---------------------------------------------------------------------------
// PENTE FINO: produtos repetidos
// ---------------------------------------------------------------------------
// O mesmo produto acaba cadastrado duas vezes porque a nota de cada fornecedor
// escreve o nome de um jeito. Aí o saldo fica rachado entre os dois, a ficha
// técnica aponta pra um e a compra soma no outro, e nenhum dos dois diz a
// verdade.
//
// Isto aqui só APONTA os suspeitos. Juntar é decisão dela, item por item:
// "Coca Cola" e "Coca Cola Zero" são parecidos e NÃO são a mesma coisa.

// Quanto vale 1 unidade de `de` na unidade `para`. null quando não dá pra
// converter (não se soma caixa com quilo).
export function fatorEntre(de, para) {
  return fatorMesmaFamilia(String(de || ''), String(para || ''));
}

// A chave de um grupo, pra ela poder marcar "esses aí não são iguais" e o
// aviso não voltar toda vez.
export const chaveGrupo = (ids) => [...ids].sort().join('|');

export function gruposDuplicados(estoque, fichas = [], ignorados = []) {
  const itens = (Array.isArray(estoque) ? estoque : []).filter((it) => it && it.id);
  if (itens.length < 2) return [];
  const chaves = itens.map((it) => chaveNome(it.nome));

  // Quem é parente de quem: mesmo nome normalizado, ou um nome cabendo dentro
  // do outro como palavra inteira ("Polenta" dentro de "Polenta 2kg").
  const pai = itens.map((_, i) => i);
  const raiz = (i) => { while (pai[i] !== i) { pai[i] = pai[pai[i]]; i = pai[i]; } return i; };
  const juntar = (a, b) => { const ra = raiz(a), rb = raiz(b); if (ra !== rb) pai[rb] = ra; };
  for (let i = 0; i < itens.length; i++) {
    for (let j = i + 1; j < itens.length; j++) {
      const a = chaves[i], b = chaves[j];
      if (!a || !b) continue;
      if (a === b || contemPalavra(a, b) || contemPalavra(b, a)) juntar(i, j);
    }
  }

  // Quais itens a ficha técnica já usa: na dúvida, o principal é esse — junta
  // pra dentro de quem as receitas já apontam e nada precisa ser remendado.
  const emFicha = new Set();
  for (const f of (Array.isArray(fichas) ? fichas : [])) {
    for (const ing of (f && Array.isArray(f.itens) ? f.itens : [])) if (ing && ing.estoqueId) emFicha.add(ing.estoqueId);
  }

  const porRaiz = new Map();
  itens.forEach((it, i) => {
    const r = raiz(i);
    if (!porRaiz.has(r)) porRaiz.set(r, []);
    porRaiz.get(r).push(it);
  });

  const ign = new Set(ignorados || []);
  const grupos = [];
  for (const membros of porRaiz.values()) {
    if (membros.length < 2) continue;
    const chave = chaveGrupo(membros.map((m) => m.id));
    if (ign.has(chave)) continue;
    // Nomes idênticos depois de tirar acento e maiúscula: não tem o que
    // discutir. Nomes só parecidos: ela confere antes.
    const nivel = new Set(membros.map((m) => chaveNome(m.nome))).size === 1 ? 'certo' : 'provavel';
    // Sugestão de principal: quem a ficha usa; senão o nome mais curto (é o
    // nome limpo, sem a embalagem grudada); depois quem tem mais histórico.
    const principal = [...membros].sort((a, b) =>
      (emFicha.has(b.id) ? 1 : 0) - (emFicha.has(a.id) ? 1 : 0)
      || chaveNome(a.nome).length - chaveNome(b.nome).length
      || (b.movimentos || []).length - (a.movimentos || []).length
      || num(b.saldo) - num(a.saldo))[0];
    grupos.push({
      chave, nivel, itens: membros, principalId: principal.id,
      // Unidades diferentes e inconversíveis é o que impede a soma.
      unidadesBatem: membros.every((m) => m.unidade === principal.unidade || fatorEntre(m.unidade, principal.unidade) != null),
    });
  }
  return grupos.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === 'certo' ? -1 : 1));
}

// JUNTA vários itens em um só. Devolve estoque, fichas e compras já remendados
// — se as receitas continuassem apontando pro item apagado, o prato sumia da
// disponibilidade e a baixa parava de acontecer.
export function fundirItens(estoque, fichas, compras, principalId, absorvidosIds) {
  const itens = Array.isArray(estoque) ? estoque : [];
  const principal = itens.find((it) => it && it.id === principalId);
  const alvos = (absorvidosIds || []).filter((id) => id && id !== principalId);
  if (!principal || !alvos.length) return { estoque, fichas, compras, fundidos: 0, naoDeu: [] };

  const naoDeu = [];
  const absorvidos = [];
  for (const id of alvos) {
    const it = itens.find((x) => x && x.id === id);
    if (!it) continue;
    const fator = it.unidade === principal.unidade ? 1 : fatorEntre(it.unidade, principal.unidade);
    // Sem conversão possível, juntar inventaria saldo. Fica de fora e ela sabe.
    if (fator == null) { naoDeu.push({ nome: it.nome, motivo: `está em ${it.unidade || 'un'} e ${principal.nome} está em ${principal.unidade || 'un'}` }); continue; }
    absorvidos.push({ it, fator });
  }
  if (!absorvidos.length) return { estoque, fichas, compras, fundidos: 0, naoDeu };

  let saldo = num(principal.saldo);
  let minimo = num(principal.minimo);
  let custo = num(principal.custo);
  let validade = principal.validade || '';
  const movs = [];
  for (const { it, fator } of absorvidos) {
    const q = num(it.saldo) * fator;
    saldo += q;
    minimo = Math.max(minimo, num(it.minimo) * fator);
    // Custo só vem junto quando a unidade é a MESMA: custo por caixa não é
    // custo por quilo, e herdar isso estouraria a margem de todo prato.
    // Juntar dois itens é juntar duas prateleiras: o custo do que fica é a
    // média ponderada dos dois, não o de um deles. Só entre unidades iguais —
    // custo por caixa não se mistura com custo por quilo.
    if (fator === 1 && num(it.custo) > 0) custo = custoMedio(saldo - q, custo, q, num(it.custo));
    // Validade: vale sempre a mais curta, que é a que manda usar primeiro.
    if (ehData(it.validade) && (!ehData(validade) || it.validade < validade)) validade = it.validade;
    for (const m of (it.movimentos || [])) movs.push({ ...m, motivo: `${m.motivo || 'Movimento'} (era ${limparNome(it.nome)})` });
  }

  const nomes = absorvidos.map(({ it }) => limparNome(it.nome)).join(', ');
  const marca = {
    id: uid(), tipo: 'contagem', qtd: saldo, saldoDepois: saldo,
    motivo: `Juntado com ${nomes}`, data: todayISO(), ts: Date.now(),
  };
  const fundido = {
    ...principal,
    saldo: Math.round(saldo * 10000) / 10000,
    minimo: Math.round(minimo * 10000) / 10000,
    custo, validade,
    conteudo: num(principal.conteudo) > 0 ? principal.conteudo : (absorvidos.find(({ it }) => num(it.conteudo) > 0)?.it.conteudo || principal.conteudo),
    conteudoUnid: principal.conteudoUnid || (absorvidos.find(({ it }) => it.conteudoUnid)?.it.conteudoUnid || ''),
    categoria: principal.categoria || (absorvidos.find(({ it }) => it.categoria)?.it.categoria || ''),
    atualizadoEm: todayISO(),
    movimentos: [marca, ...movs, ...(principal.movimentos || [])]
      .sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, MAX_MOV),
  };

  const mortos = new Set(absorvidos.map(({ it }) => it.id));
  const novoEstoque = itens.filter((it) => !mortos.has(it.id)).map((it) => (it.id === principalId ? fundido : it));

  const ids = [...mortos];
  return {
    estoque: novoEstoque,
    fichas: repontarFichas(fichas, ids, principalId),
    compras: repontarCompras(compras, ids, principalId),
    // Os ids absorvidos saem junto porque o servidor precisa REFAZER o reaponte
    // sobre a versão mais recente das listas, não sobre a cópia que veio aqui.
    absorvidos: ids,
    fundidos: absorvidos.length, naoDeu,
  };
}

// Receitas: aponta tudo pro principal. Duas linhas do mesmo item na MESMA
// unidade viram uma só somada; unidades diferentes ficam como estão, porque o
// cálculo já sabe somar linha por linha.
export function repontarFichas(fichas, absorvidos, principalId) {
  const mortos = new Set(absorvidos || []);
  if (!mortos.size) return Array.isArray(fichas) ? fichas : [];
  return (Array.isArray(fichas) ? fichas : []).map((f) => {
    if (!f || !Array.isArray(f.itens)) return f;
    if (!f.itens.some((ing) => ing && mortos.has(ing.estoqueId))) return f;
    const juntas = [];
    for (const ing of f.itens) {
      const alvo = { ...ing, estoqueId: mortos.has(ing.estoqueId) ? principalId : ing.estoqueId };
      const ja = juntas.find((x) => x.estoqueId === alvo.estoqueId && x.unidade === alvo.unidade);
      // Arredonda: 0,1 + 0,2 em ponto flutuante dá 0,30000000000000004, e isso
      // ia parar gravado na receita.
      if (ja) ja.qtd = String(Math.round((numQtd(ja.qtd) + numQtd(alvo.qtd)) * 10000) / 10000);
      else juntas.push(alvo);
    }
    return { ...f, itens: juntas };
  });
}

// Compras já ligadas na mão a um item que deixou de existir.
export function repontarCompras(compras, absorvidos, principalId) {
  const mortos = new Set(absorvidos || []);
  if (!mortos.size) return Array.isArray(compras) ? compras : [];
  return (Array.isArray(compras) ? compras : []).map((c) =>
    (c && mortos.has(c.estoqueId) ? { ...c, estoqueId: principalId } : c));
}

// ---------------------------------------------------------------------------
// DA NOTA PRO SALDO: quanto uma compra vira de verdade no estoque
// ---------------------------------------------------------------------------
// A nota fala em EMBALAGEM e o estoque fala em UNIDADE DE USO. "3 × Polenta
// 2kg a R$ 11,90" são 3 pacotes na nota e 6 kg na prateleira — e o custo é
// R$ 5,95 o quilo, não R$ 11,90. Somar 3 e gravar custo 11,90 põe o dobro no
// preço de cada prato, e o prato aparece no prejuízo sem motivo.
//
// Por isso a linha da compra pode dizer o conteúdo de cada embalagem. Sem isso
// preenchido, nada muda: 1 comprado = 1 no estoque, como sempre foi.
function porUnidadeDaCompra(compra, item) {
  const conteudo = numQtd(compra && compra.conteudo);
  const u = String((compra && compra.conteudoUnid) || '');
  if (!(conteudo > 0) || !u || !item) return { fator: 1, convertido: false };
  // Direto: a embalagem está na mesma grandeza do item (kg num item em kg/g).
  const direto = fatorEntre(u, item.unidade);
  if (direto != null) return { fator: conteudo * direto, convertido: true };
  // Ou pelo "conteúdo por unidade" do item (garrafa de 1000 ml, lata de 300 ml).
  const cItem = num(item.conteudo), uItem = item.conteudoUnid;
  if (cItem > 0 && uItem) {
    const f = fatorEntre(u, uItem);
    if (f != null) return { fator: (conteudo * f) / cItem, convertido: true };
  }
  return { fator: 1, convertido: false, erro: `não dá pra transformar ${u} em ${item.unidade || 'un'}` };
}

const arred = (v, casas = 4) => Math.round(v * 10 ** casas) / 10 ** casas;

// O que esta linha de compra vira no estoque: quantidade na unidade do item e
// custo na unidade do item.
export function entradaDaCompra(compra, item) {
  // qtdCompra: numa compra parcelada a linha vira "1 × o valor da parcela",
  // pra o dinheiro fechar em centavos. A quantidade de verdade fica aqui.
  const qtd = numQtd((compra && compra.qtdCompra) || (compra && compra.quantidade));
  if (!(qtd > 0) || !item) return null;
  const { fator, convertido, erro } = porUnidadeDaCompra(compra, item);
  // precoCheio: numa compra parcelada, valorUnit carrega só a fatia daquela
  // parcela (é assim que o dinheiro fecha nas somas). O CUSTO do produto é o
  // preço inteiro — senão o ingrediente entraria valendo um terço e a margem
  // de todo prato ficaria linda e mentirosa.
  const preco = num((compra && compra.precoCheio) || (compra && compra.valorUnit));
  return {
    qtd: arred(qtd * fator),
    custo: preco > 0 && fator > 0 ? arred(preco / fator) : preco,
    fator, convertido, erro: erro || '',
  };
}

// Custo médio ponderado móvel: mistura o que já tem na prateleira com o que
// está entrando, cada um pesando pela sua quantidade.
//
// Sem saldo anterior (ou sem custo anterior) não há o que misturar: vale o
// preço da compra. Compra sem preço não mexe no custo — preço zero não é
// informação, é campo em branco.
export function custoMedio(saldoAtual, custoAtual, qtdEntra, custoEntra) {
  const q = num(qtdEntra), ce = num(custoEntra);
  if (!(q > 0) || !(ce > 0)) return num(custoAtual);
  const sa = Math.max(0, num(saldoAtual)), ca = num(custoAtual);
  if (!(sa > 0) || !(ca > 0)) return Math.round(ce * 10000) / 10000;
  return Math.round(((sa * ca + q * ce) / (sa + q)) * 10000) / 10000;
}

// ENTRADAS de compra no estoque (soma no saldo dos itens já cadastrados e
// atualiza o custo). Compra que não acha item nenhum é ignorada aqui — quem
// avisa é a tela, que mostra o destino ANTES de registrar.
export function aplicarEntradasEstoque(estoque, comprasNovas) {
  const itens = Array.isArray(estoque) ? estoque : [];
  const novas = Array.isArray(comprasNovas) ? comprasNovas : [];
  if (!itens.length || !novas.length) return estoque;

  // Agrupa por item de destino primeiro: duas linhas da mesma nota podem cair
  // no mesmo item, e cada uma tem que somar no saldo já atualizado pela outra.
  const porItem = new Map();
  for (const c of novas) {
    if (!c || numQtd(c.qtdCompra || c.quantidade) <= 0) continue;
    const r = resolverCompraNoEstoque(c, itens);
    if (!r) continue;
    if (!porItem.has(r.item.id)) porItem.set(r.item.id, []);
    porItem.get(r.item.id).push({ compra: c, como: r.como });
  }
  if (!porItem.size) return estoque;

  return itens.map((it) => {
    const lista = porItem.get(it.id);
    if (!lista) return it;
    let saldo = num(it.saldo);
    let custo = num(it.custo);
    let lotes = garantirLotes(it);
    const movs = [];
    for (const { compra: c, como } of lista) {
      // A embalagem vira unidade de uso aqui: 3 pacotes de 2 kg somam 6 kg, e
      // o custo gravado é o do quilo, não o do pacote.
      const e = entradaDaCompra(c, it);
      if (!e) continue;
      const q = e.qtd;
      // CUSTO MÉDIO PONDERADO MÓVEL.
      //
      // Antes o custo era simplesmente TROCADO pelo preço da nota nova. Bastava
      // uma compra cara de emergência (2 kg no mercado a R$ 60) pra todo o
      // estoque parado (10 kg comprados a R$ 40) passar a valer R$ 60 — e a
      // margem de todo prato com aquele ingrediente despencava num dia, sem
      // nada ter mudado no bar.
      //
      // O certo é diluir: o que já está na prateleira continua valendo o que
      // custou, e a compra nova entra pesando pela quantidade dela.
      custo = custoMedio(saldo, custo, q, e.custo);
      saldo += q;
      // Quando o nome da nota é diferente do nome do item, guarda o da nota no
      // movimento — assim uma entrada que casou "por parecido" dá pra auditar.
      const daNota = como === 'nome' ? '' : ` · ${limparNome(c.produto)}`;
      lotes = entrarLote(lotes, q, c.validade);
      movs.push({
        id: uid(), tipo: 'compra', qtd: q, saldoDepois: saldo,
        motivo: (c.fornecedor ? `Compra · ${limparNome(c.fornecedor)}` : 'Compra') + daNota,
        data: c.data || todayISO(), ts: Date.now(),
      });
    }
    // movs.reverse(): o extrato do item é do mais novo pro mais velho. Duas
    // linhas da mesma nota caindo no mesmo item entravam na ordem em que foram
    // digitadas, e o saldo aparecia descendo (4 e depois 6) em vez de subindo.
    const atualizado = { ...it, saldo, custo, lotes, atualizadoEm: todayISO(), movimentos: [...movs.reverse(), ...(it.movimentos || [])].slice(0, MAX_MOV) };
    atualizado.validade = validadeDoItem(atualizado);
    return atualizado;
  });
}

// CORRIGE os custos do estoque usando as Compras como fonte da verdade. Para
// cada item, pega o valor unitário da compra mais recente com o mesmo nome. Serve
// pra consertar custos que ficaram inflados por um bug antigo de leitura de
// número — as Compras guardam o preço como texto puro, então parseiam certo com
// o num() atual. Itens sem compra correspondente ficam como estão.
// As compras agrupadas pelo nome do produto, pra não varrer a lista inteira
// uma vez por item.
//
// Sem isto, reconstruir 6 meses de custo era itens × compras comparações, e
// cada comparação normaliza acento (NFD) — dá milhões de chamadas e trava o
// celular dela. Indexando uma vez, cada item só olha as compras dele.
export function indexarCompras(compras) {
  const m = new Map();
  for (const c of (Array.isArray(compras) ? compras : [])) {
    if (!c) continue;
    const k = chaveNome(c.produto);
    if (!k) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(c);
  }
  return m;
}

// Quanto ESTE item custava, pelas compras, numa data qualquer.
//
// `ate` é a data de corte: só entram compras feitas até ela. Passando o último
// dia de um mês, dá o custo que o item tinha NAQUELE mês — é assim que o CMV
// de meses passados é calculado com o preço da época, e não com o de hoje.
//
// Devolve null quando não há nenhuma compra desse item até a data (aí quem
// chama decide: manter o custo atual, ou avisar que não tem base).
export function custoPelasCompras(item, compras, ate = todayISO(), dias = 90) {
  const precoDe = (c) => num(c.precoCheio || c.valorUnit); // parcelada: o preço inteiro
  const doItem = (Array.isArray(compras) ? compras : [])
    .filter((c) => c && igualNome(c.produto, item.nome) && precoDe(c) > 0 && (c.data || '') <= ate);
  if (!doItem.length) return null;
  doItem.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  // Média ponderada das compras dos últimos `dias`, e não o preço da última.
  // Pegar só a última faria esta conta desfazer o custo médio: bastava uma
  // compra cara de emergência pra reprecificar tudo de novo.
  const desde = addDays(ate, -dias);
  const janela = doItem.filter((c) => (c.data || '') >= desde);
  const base = janela.length ? janela : [doItem[0]];
  let pesoTotal = 0, valorTotal = 0;
  for (const c of base) {
    const e = entradaDaCompra(c, item);
    const q = e && e.qtd > 0 ? e.qtd : numQtd(c.qtdCompra || c.quantidade) || 1;
    const preco = e && e.custo > 0 ? e.custo : precoDe(c);
    if (!(q > 0) || !(preco > 0)) continue;
    pesoTotal += q; valorTotal += q * preco;
  }
  const custo = pesoTotal > 0 ? Math.round((valorTotal / pesoTotal) * 10000) / 10000 : precoDe(doItem[0]);
  return custo > 0 ? custo : null;
}

export function recalcularCustosPelasCompras(estoque, compras) {
  if (!Array.isArray(estoque) || !estoque.length) return { estoque, corrigidos: 0 };
  let corrigidos = 0;
  const novo = estoque.map((it) => {
    const novoCusto = custoPelasCompras(it, compras);
    if (novoCusto != null && Math.abs(novoCusto - num(it.custo)) > 0.005) { corrigidos += 1; return { ...it, custo: novoCusto, atualizadoEm: todayISO() }; }
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
        // A venda come do lote que vence primeiro.
        novoEstoque[i].lotes = baixarLotes(garantirLotes(novoEstoque[i]), baixa);
        novoEstoque[i].validade = validadeDoItem(novoEstoque[i]);
        novoEstoque[i].atualizadoEm = todayISO();
        // AGRUPA as baixas de venda do MESMO DIA num movimento só.
        //
        // Uma linha por venda enchia o extrato: num sábado cheio, o gelo fazia
        // 40 movimentos e empurrava pra fora o histórico das semanas
        // anteriores. Quanto mais importante o item, menos passado ele tinha —
        // justo o contrário do que serve.
        //
        // O que se perde é a mesa de cada baixa; o que se ganha é o consumo
        // diário sobrevivendo meses. A venda em si continua guardando os itens,
        // então nada de auditável some.
        const dataMov = v.data || todayISO();
        const qtdBaixa = Math.round(baixa * 1000) / 1000;
        // Troca o objeto em vez de mexer nele: clonar() copiou o ARRAY, mas os
        // movimentos dentro ainda são os mesmos do estoque que entrou aqui —
        // mutar um deles mudaria o dado de quem chamou.
        const iHoje = novoEstoque[i].movimentos.findIndex((m) => m && m.tipo === 'venda' && m.data === dataMov);
        if (iHoje >= 0) {
          const ant = novoEstoque[i].movimentos[iHoje];
          novoEstoque[i].movimentos[iHoje] = {
            ...ant,
            qtd: Math.round((num(ant.qtd) + qtdBaixa) * 1000) / 1000,
            saldoDepois: novoEstoque[i].saldo,
            ts: Date.now(),
          };
        } else {
          novoEstoque[i].movimentos = [{ id: uid(), tipo: 'venda', qtd: qtdBaixa, saldoDepois: novoEstoque[i].saldo, motivo: 'Venda', data: dataMov, ts: Date.now() }, ...novoEstoque[i].movimentos].slice(0, MAX_MOV);
        }
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
  item.lotes = saldo > 0 ? entrarLote([], saldo, item.validade) : [];
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
    // Quanto vence NESTA data. Antes o aviso levava o saldo inteiro junto:
    // "14 latas vencem amanhã" quando eram 2 — e as outras 12 só em dezembro.
    const lotes = ordenarLotes(it.lotes);
    const qtdNoLote = lotes.length ? numQtd(lotes[0].qtd) : num(it.saldo);
    out.push({ item: it, dias, nivel: nivelValidade(dias), qtd: qtdNoLote, temOutrosLotes: lotes.length > 1 });
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
  // Os lotes seguem o saldo: entrada cria (ou engorda) um lote com a data
  // informada, saída come do que vence primeiro, contagem acerta o total.
  const lotes = garantirLotes(item);
  novo.lotes = tipo === 'entrada' ? entrarLote(lotes, q, validade)
    : tipo === 'saida' ? baixarLotes(lotes, q)
      : ajustarLotes(lotes, saldoNovo);
  // `validade` continua existindo como a data do lote mais próximo, pra tudo
  // que já lê esse campo seguir funcionando sem saber de lote.
  novo.validade = validadeDoItem(novo);
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

// ---------------------------------------------------------------------------
// LOTES DE VALIDADE
// ---------------------------------------------------------------------------
// Antes cada item tinha UMA data de validade. Duas latas vencendo amanhã e doze
// vencendo em três meses viravam "vence amanhã" — e continuavam assim mesmo
// depois de ela jogar as duas fora, até o saldo zerar.
//
// Aviso falso repetido tem um custo preciso: ela para de olhar o aviso. E aí o
// dia que for verdade, passa batido.
//
// Agora cada entrada com data vira um LOTE. A saída come do lote que vence
// primeiro (PEPS — que é como se usa na prática: o mais velho na frente). O
// campo `validade` continua existindo como a data do lote mais próximo, pra
// tudo que já lia ele continuar funcionando.
const lotesDe = (item) => (Array.isArray(item && item.lotes) ? item.lotes : []).filter((l) => l && numQtd(l.qtd) > 0);

// Ordem canônica dos lotes: quem vence primeiro na frente, sem data no fim.
// Fixar a ordem importa porque a tela lista nessa ordem e a baixa segue ela —
// deixar o array na ordem em que as coisas aconteceram daria telas diferentes
// pro mesmo estoque.
const CHAVE_SEM_DATA = '9999-99-99';
export const ordenarLotes = (lotes) => [...(Array.isArray(lotes) ? lotes : [])]
  .filter((l) => l && numQtd(l.qtd) > 0)
  .sort((a, b) => (ehData(a.validade) ? a.validade : CHAVE_SEM_DATA).localeCompare(ehData(b.validade) ? b.validade : CHAVE_SEM_DATA));

// A data que vale pro item: a do lote que vence primeiro.
export function validadeDoItem(item) {
  const comData = lotesDe(item).filter((l) => ehData(l.validade)).sort((a, b) => a.validade.localeCompare(b.validade));
  return comData.length ? comData[0].validade : '';
}

// Entra quantidade num lote. Sem data, entra como "sem validade" — e isso é
// informação: não dá pra avisar do que ela não anotou.
export function entrarLote(lotes, qtd, validade) {
  const q = numQtd(qtd);
  const base = (Array.isArray(lotes) ? lotes : []).filter((l) => l && numQtd(l.qtd) > 0);
  if (!(q > 0)) return base;
  const data = ehData(validade) ? validade : '';
  // Mesma data = mesmo lote: não adianta criar uma linha por compra.
  const igual = base.find((l) => (l.validade || '') === data);
  if (igual) return ordenarLotes(base.map((l) => (l === igual ? { ...l, qtd: Math.round((numQtd(l.qtd) + q) * 1000) / 1000 } : l)));
  return ordenarLotes([...base, { id: uid(), qtd: Math.round(q * 1000) / 1000, validade: data }]);
}

// Tira quantidade dos lotes, começando pelo que vence primeiro. Lote sem data
// vai por último: o que tem prazo é o que corre risco de estragar.
export function baixarLotes(lotes, qtd) {
  let resta = numQtd(qtd);
  if (!(resta > 0)) return (Array.isArray(lotes) ? lotes : []).filter((l) => l && numQtd(l.qtd) > 0);
  const ordem = ordenarLotes(lotes);
  const out = [];
  for (const l of ordem) {
    const tem = numQtd(l.qtd);
    if (resta <= 0) { out.push(l); continue; }
    const tira = Math.min(tem, resta);
    resta = Math.round((resta - tira) * 1000) / 1000;
    const sobra = Math.round((tem - tira) * 1000) / 1000;
    if (sobra > 0) out.push({ ...l, qtd: sobra });
  }
  return ordenarLotes(out);
}

// Depois de uma CONTAGEM, os lotes têm que somar o que ela contou. Sobrando,
// tira do que vence por último (o mais velho é o que ela usou). Faltando, a
// diferença entra sem data — não dá pra inventar validade pra o que apareceu.
export function ajustarLotes(lotes, saldoReal) {
  const alvo = numQtd(saldoReal);
  const atuais = (Array.isArray(lotes) ? lotes : []).filter((l) => l && numQtd(l.qtd) > 0);
  const soma = atuais.reduce((s, l) => s + numQtd(l.qtd), 0);
  if (!(alvo > 0)) return [];
  const dif = Math.round((alvo - soma) * 1000) / 1000;
  if (Math.abs(dif) < 0.0005) return ordenarLotes(atuais);
  if (dif > 0) return entrarLote(atuais, dif, '');
  // Contou menos: come do fim da fila (o que vence por último).
  const ordem = ordenarLotes(atuais).reverse();
  let resta = -dif;
  const out = [];
  for (const l of ordem) {
    const tem = numQtd(l.qtd);
    if (resta <= 0) { out.push(l); continue; }
    const tira = Math.min(tem, resta);
    resta = Math.round((resta - tira) * 1000) / 1000;
    const sobra = Math.round((tem - tira) * 1000) / 1000;
    if (sobra > 0) out.push({ ...l, qtd: sobra });
  }
  return ordenarLotes(out);
}

// Traz um item antigo (só com `validade`) pro mundo dos lotes, sem perder o que
// já estava lá.
export function garantirLotes(item) {
  if (Array.isArray(item && item.lotes)) return lotesDe(item);
  const saldo = num(item && item.saldo);
  if (!(saldo > 0)) return [];
  return [{ id: uid(), qtd: Math.round(saldo * 1000) / 1000, validade: ehData(item && item.validade) ? item.validade : '' }];
}

// ---------------------------------------------------------------------------
// CONSUMO, PONTO DE REPOSIÇÃO E COBERTURA
// ---------------------------------------------------------------------------
// O "mínimo" do item era um número digitado à mão. Isso é chute: o ponto certo
// de repor depende de quanto sai por dia E de quanto o fornecedor demora pra
// entregar. Repor cedo demais deixa dinheiro parado; tarde demais falta no
// sábado, que é quando dói.

export const JANELA_CONSUMO = 21; // dias olhados pra medir o ritmo

// Quanto sai por dia, pelo extrato do item. Devolve null quando não há saída
// nenhuma na janela — sem consumo não há ritmo, e fingir zero faria o item
// parecer eterno.
export function consumoPorDia(item, hoje = diaOperacional(), janela = JANELA_CONSUMO) {
  const movs = Array.isArray(item && item.movimentos) ? item.movimentos : [];
  const desde = addDays(hoje, -janela);
  const saidas = movs.filter((m) => m && (m.tipo === 'saida' || m.tipo === 'venda') && (m.data || '') >= desde);
  const total = saidas.reduce((s, m) => s + numQtd(m.qtd), 0);
  if (!(total > 0)) return null;
  // Item recém-cadastrado: divide pelos dias de vida dele, senão o ritmo sai
  // menor do que é e o aviso chega tarde.
  const maisAntigo = movs.map((m) => (m && m.data) || '').filter(Boolean).sort()[0] || desde;
  const inicio = maisAntigo > desde ? maisAntigo : desde;
  const dias = Math.max(3, Math.round((new Date(hoje + 'T12:00:00') - new Date(inicio + 'T12:00:00')) / 864e5) || janela);
  return Math.round((total / dias) * 10000) / 10000;
}

// Em quantos dias o saldo acaba, no ritmo atual. null quando não dá pra saber.
export function coberturaEmDias(item, hoje = diaOperacional()) {
  const porDia = consumoPorDia(item, hoje);
  if (!(porDia > 0)) return null;
  return Math.floor(num(item.saldo) / porDia);
}

// Quanto deveria ser o mínimo deste item.
//
//   ponto de reposição = consumo por dia × (dias de entrega + dias de folga)
//
// A folga existe porque o fornecedor atrasa e o fim de semana vende mais que a
// média. Sem ela, o ponto de reposição acerta na média e erra sempre que a
// semana foge dela — que é metade das semanas.
export function minimoSugerido(item, prazoEntrega, hoje = diaOperacional(), folga = 2) {
  const porDia = consumoPorDia(item, hoje);
  if (!(porDia > 0)) return null;
  const dias = Math.max(0, num(prazoEntrega)) + Math.max(0, num(folga));
  if (!(dias > 0)) return null;
  return Math.round(porDia * dias * 1000) / 1000;
}

// A leitura de reposição de um item: o que ele tem, quanto dura, e se o mínimo
// cadastrado bate com o que o consumo pede.
export function leituraDeReposicao(item, prazoEntrega, hoje = diaOperacional()) {
  const porDia = consumoPorDia(item, hoje);
  const sugerido = minimoSugerido(item, prazoEntrega, hoje);
  const atual = num(item.minimo);
  const cobertura = coberturaEmDias(item, hoje);
  let estado = 'sem-dados';
  if (sugerido != null) {
    if (!(atual > 0)) estado = 'sem-minimo';
    else if (atual < sugerido * 0.7) estado = 'baixo';   // repõe tarde: vai faltar
    else if (atual > sugerido * 2) estado = 'alto';      // repõe cedo: dinheiro parado
    else estado = 'ok';
  }
  return { porDia, sugerido, atual, cobertura, estado };
}

// ---------------------------------------------------------------------------
// CURVA ABC: onde o dinheiro está de verdade
// ---------------------------------------------------------------------------
// Num bar de capital curto, a pergunta útil não é "o que é caro", é "o que come
// meu dinheiro". Classifica pelo valor CONSUMIDO no período (saiu × custo):
//   A = os que somam os primeiros 80% do consumo — são poucos e mandam no caixa
//   B = os 15% seguintes
//   C = o resto — muitos itens, pouco dinheiro
// Item parado (sem consumo) fica de fora da curva e aparece à parte: ele não
// tem classe, tem um problema.
export function curvaABC(estoque, hoje = diaOperacional(), janela = JANELA_CONSUMO) {
  const itens = Array.isArray(estoque) ? estoque : [];
  const linhas = [];
  const parados = [];
  for (const it of itens) {
    if (!it || !it.id) continue;
    const porDia = consumoPorDia(it, hoje, janela);
    const custo = num(it.custo);
    const parado = num(it.saldo) * custo;
    if (!(porDia > 0)) {
      if (num(it.saldo) > 0) parados.push({ id: it.id, nome: limparNome(it.nome), saldo: num(it.saldo), unidade: it.unidade || 'un', parado: Math.round(parado * 100) / 100 });
      continue;
    }
    linhas.push({
      id: it.id, nome: limparNome(it.nome), unidade: it.unidade || 'un',
      porDia, saldo: num(it.saldo), custo,
      consumoValor: Math.round(porDia * janela * custo * 100) / 100,
      parado: Math.round(parado * 100) / 100,
      cobertura: coberturaEmDias(it, hoje),
    });
  }
  linhas.sort((a, b) => b.consumoValor - a.consumoValor);
  const total = linhas.reduce((s, l) => s + l.consumoValor, 0);
  let acum = 0;
  for (const l of linhas) {
    // A classe sai do acumulado ANTES deste item. Olhando o acumulado depois,
    // um item que sozinho passa de 80% (acontece sempre que um ingrediente
    // domina o consumo) cairia em B — e o maior de todos tem que ser A.
    const antes = total > 0 ? acum / total : 1;
    acum += l.consumoValor;
    l.classe = antes < 0.8 ? 'A' : antes < 0.95 ? 'B' : 'C';
    l.acumulado = Math.round((total > 0 ? acum / total : 1) * 1000) / 10;
  }
  parados.sort((a, b) => b.parado - a.parado);
  return {
    linhas, parados,
    total: Math.round(total * 100) / 100,
    janela,
    porClasse: ['A', 'B', 'C'].map((c) => {
      const doGrupo = linhas.filter((l) => l.classe === c);
      return {
        classe: c, itens: doGrupo.length,
        valor: Math.round(doGrupo.reduce((s, l) => s + l.consumoValor, 0) * 100) / 100,
        parado: Math.round(doGrupo.reduce((s, l) => s + l.parado, 0) * 100) / 100,
      };
    }),
    paradoTotal: Math.round(parados.reduce((s, p) => s + p.parado, 0) * 100) / 100,
  };
}
