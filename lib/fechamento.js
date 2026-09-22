import { num, numQtd, brl, diaOperacional, limparNome } from './util';
import { qtdNaUnidadeDoItem } from './estoque';

// Conferência de fechamento: o que saiu do estoque bate com o que entrou no caixa?
//
// A pergunta que isso responde é "saiu alguma coisa que ninguém cobrou?". E a
// regra da casa aqui é mais dura que no resto do sistema: ACUSAR ERRADO É PIOR
// QUE NÃO ACUSAR. Um número que aponta furo onde não tem furo faz a dona
// desconfiar do time à toa — e, pior, na segunda vez que errar ela para de
// acreditar no sistema inteiro, inclusive quando ele estiver certo.
//
// Por isso cada linha sai com um nível de certeza, e o que não dá pra afirmar
// aparece como "não dá pra conferir" em vez de virar acusação:
//
//   certo     — item contável (garrafa, lata, dose) e vendido direto. Uma
//               garrafa é uma garrafa: se sumiu, sumiu.
//   duvidoso  — item de peso/volume, ou que só sai por receita. A diferença
//               tanto pode ser furo quanto ficha técnica mal medida.
//   sobra     — contou MAIS do que o sistema esperava. Não é furo: é
//               lançamento faltando (compra não registrada, em geral).
//   ok        — dentro da tolerância.

const arr = (v) => (Array.isArray(v) ? v : []);
const r3 = (x) => Math.round(x * 1000) / 1000;
const r2 = (x) => Math.round(x * 100) / 100;

// Unidades que se contam no dedo. Nessas a tolerância é zero: não existe
// "meia garrafa evaporou".
export const CONTAVEIS = new Set(['un', 'cx', 'fardo', 'pct', 'grf', 'lata', 'saco']);
// Peso e volume têm perda natural — resto na panela, respingo, gelo derretendo.
// 3% do que saiu no dia é o que se considera normal.
export const TOLERANCIA_PESO = 0.03;

export const ehContavel = (item) => CONTAVEIS.has(String((item && item.unidade) || 'un'));

// Quanto este item mexeu HOJE, separado por motivo. Sai do próprio extrato do
// item, que já guarda cada movimento com a data.
export function movimentoDoDia(item, hoje = diaOperacional()) {
  const m = { entrou: 0, venda: 0, perda: 0, cortesia: 0, consumo: 0, outras: 0, contagens: 0 };
  for (const mv of arr(item && item.movimentos)) {
    if (!mv || mv.data !== hoje) continue;
    const q = numQtd(mv.qtd);
    const motivo = String(mv.motivo || '').toLowerCase();
    if (mv.tipo === 'entrada' || mv.tipo === 'compra') m.entrou += q;
    else if (mv.tipo === 'venda') m.venda += q;
    else if (mv.tipo === 'contagem') m.contagens += 1;
    else if (mv.tipo === 'saida') {
      if (/desperd|vencid|quebr|perda/.test(motivo)) m.perda += q;
      else if (/cortesia/.test(motivo)) m.cortesia += q;
      else if (/consumo/.test(motivo)) m.consumo += q;
      else m.outras += q;
    }
  }
  for (const k of Object.keys(m)) m[k] = k === 'contagens' ? m[k] : r3(m[k]);
  return m;
}

// Quanto vale UMA unidade deste item na boca do caixa.
//
// Só responde quando o item é vendido DIRETO — quer dizer, existe um produto do
// cardápio cuja ficha usa só ele. Long neck, lata, dose: a conta é limpa.
//
// Farinha de trigo não tem preço de venda, e fingir que tem transformaria
// "faltam 200 g" numa acusação de R$ 40 que não existe. Nesses casos devolve 0
// e a conferência fala só em custo.
export function precoDiretoDoItem(itemId, fichas, cardapio, estoque) {
  const item = arr(estoque).find((x) => x && x.id === itemId);
  if (!item) return 0;
  const precoDe = new Map(arr(cardapio).filter((c) => c && c.id).map((c) => [c.id, num(c.preco)]));
  let melhor = 0;
  for (const f of arr(fichas)) {
    if (!f || !f.cardapioId || !Array.isArray(f.itens) || f.itens.length !== 1) continue;
    const ing = f.itens[0];
    if (!ing || ing.estoqueId !== itemId) continue;
    const porVenda = qtdNaUnidadeDoItem(ing.qtd, ing.unidade, item);
    const preco = precoDe.get(f.cardapioId) || 0;
    if (porVenda > 0 && preco > 0) melhor = Math.max(melhor, preco / porVenda);
  }
  return r2(melhor);
}

// Produtos vendidos hoje que NÃO baixam nada do estoque. São o ponto cego: o
// que eles consomem sai da prateleira sem o sistema saber, então uma falta num
// ingrediente deles pode ser só isso — e não furo.
export function vendidosSemFicha(vendas, fichas, cardapio, estoque) {
  const byId = new Map(arr(estoque).map((it) => [it.id, it]));
  const fichaDe = new Map();
  for (const f of arr(fichas)) if (f && f.cardapioId && Array.isArray(f.itens) && f.itens.length) fichaDe.set(f.cardapioId, f.itens);
  const nomeDe = new Map(arr(cardapio).filter((c) => c && c.id).map((c) => [c.id, c.nome || '']));
  const funciona = (cardapioId) => {
    const itens = fichaDe.get(cardapioId);
    if (!itens || !itens.length) return false;
    return itens.some((ing) => { const it = byId.get(ing.estoqueId); return it && qtdNaUnidadeDoItem(ing.qtd, ing.unidade, it) > 0; });
  };
  const m = new Map();
  for (const v of arr(vendas)) {
    for (const item of arr(v && v.itens)) {
      const q = num(item && item.qtd) || 0;
      if (q <= 0 || !item.cardapioId) continue;
      if (Array.isArray(item.extras) && item.extras.length) continue; // baixa pelo sabor
      if (funciona(item.cardapioId)) continue;
      const cur = m.get(item.cardapioId) || { cardapioId: item.cardapioId, nome: nomeDe.get(item.cardapioId) || item.nome || '—', qtd: 0 };
      cur.qtd += q;
      m.set(item.cardapioId, cur);
    }
  }
  return [...m.values()].sort((a, b) => b.qtd - a.qtd);
}

// As saídas lançadas na mão hoje (perda, cortesia, consumo da casa). Não são
// furo — são decisões. Mas custam dinheiro e entram na conta do dia.
export function saidasDoDia(estoque, hoje = diaOperacional()) {
  const linhas = [];
  for (const it of arr(estoque)) {
    const m = movimentoDoDia(it, hoje);
    const total = m.perda + m.cortesia + m.consumo + m.outras;
    if (total <= 0) continue;
    linhas.push({
      id: it.id, nome: limparNome(it.nome), unidade: it.unidade || 'un',
      perda: m.perda, cortesia: m.cortesia, consumo: m.consumo, outras: m.outras,
      total: r3(total), valor: r2(total * num(it.custo)),
    });
  }
  return linhas.sort((a, b) => b.valor - a.valor);
}

// A conferência de uma linha: o que o sistema diz que tem × o que ela contou.
function conferirItem(item, contado, ctx) {
  const sistema = numQtd(item.saldo);
  const real = numQtd(contado);
  const mov = movimentoDoDia(item, ctx.hoje);
  const contavel = ehContavel(item);
  // Tolerância: zero no contável; no peso/volume, uma folga sobre o que saiu.
  const tol = contavel ? 0 : Math.max(TOLERANCIA_PESO * (mov.venda + mov.entrou), 0.05);
  const falta = r3(sistema - real);
  const preco = ctx.precoDireto(item.id);
  const semFichaPerto = ctx.semFicha.length > 0;

  let nivel;
  if (Math.abs(falta) <= tol) nivel = 'ok';
  else if (falta < 0) nivel = 'sobra';
  else if (contavel && preco > 0 && !semFichaPerto) nivel = 'certo';
  else nivel = 'duvidoso';

  const porque = nivel === 'sobra'
    ? 'Tem mais do que o sistema esperava. Isso não é furo: é entrada que faltou lançar — confere se alguma compra ficou de fora.'
    : nivel === 'certo'
      ? 'Item contado no dedo e vendido direto: se saiu e não foi cobrado, foi mesmo.'
      : nivel === 'duvidoso'
        ? (contavel
          ? 'Tem produto vendido hoje que não baixa estoque — a falta pode ser por causa dele, e não furo.'
          : 'Item de peso/volume: a diferença pode ser sobra de panela ou receita mal medida, não só furo.')
        : '';

  return {
    id: item.id, nome: limparNome(item.nome), unidade: item.unidade || 'un',
    sistema: r3(sistema), contado: r3(real), falta, tolerancia: r3(tol), nivel, porque,
    custoPerdido: falta > tol ? r2(falta * num(item.custo)) : 0,
    receitaPerdida: falta > tol ? r2(falta * preco) : 0,
    vendeuHoje: mov.venda, entrouHoje: mov.entrou, saiuNaMao: r3(mov.perda + mov.cortesia + mov.consumo + mov.outras),
  };
}

// A conferência inteira do fechamento.
//
// `contagens`: { [itemId]: quanto ela contou na prateleira }. Só o que ela
// contou é conferido — o resto o sistema não tem como afirmar nada, e fica de
// fora em vez de virar palpite.
export function conferirFechamento({
  estoque = [], fichas = [], cardapio = [], vendas = [],
  contagens = {}, caixa = null, hoje = diaOperacional(),
} = {}) {
  const semFicha = vendidosSemFicha(vendas, fichas, cardapio, estoque);
  const cachePreco = new Map();
  const ctx = {
    hoje, semFicha,
    precoDireto: (id) => {
      if (!cachePreco.has(id)) cachePreco.set(id, precoDiretoDoItem(id, fichas, cardapio, estoque));
      return cachePreco.get(id);
    },
  };

  const linhas = [];
  for (const it of arr(estoque)) {
    const c = contagens[it.id];
    if (c == null || c === '') continue;
    linhas.push(conferirItem(it, c, ctx));
  }
  linhas.sort((a, b) => (b.receitaPerdida || b.custoPerdido) - (a.receitaPerdida || a.custoPerdido));

  const faltando = linhas.filter((l) => l.nivel === 'certo' || l.nivel === 'duvidoso');
  const certos = linhas.filter((l) => l.nivel === 'certo');
  const saidas = saidasDoDia(estoque, hoje);

  // Dinheiro: o caixa já sabe quanto devia ter. Aqui só se junta as duas
  // histórias, porque elas costumam ser a mesma: o que saiu sem ser cobrado
  // não virou dinheiro nenhum.
  const esperado = caixa ? num(caixa.dinheiroFinal) : null;
  const contadoCaixa = caixa && caixa.contado != null && caixa.contado !== '' ? num(caixa.contado) : null;
  const dinheiro = esperado == null ? null : {
    esperado: r2(esperado),
    contado: contadoCaixa == null ? null : r2(contadoCaixa),
    diferenca: contadoCaixa == null ? null : r2(contadoCaixa - esperado),
  };

  const totais = {
    custoPerdido: r2(faltando.reduce((s, l) => s + l.custoPerdido, 0)),
    receitaPerdida: r2(faltando.reduce((s, l) => s + l.receitaPerdida, 0)),
    receitaPerdidaCerta: r2(certos.reduce((s, l) => s + l.receitaPerdida, 0)),
    saidasNaMao: r2(saidas.reduce((s, l) => s + l.valor, 0)),
    faltaNoCaixa: dinheiro && dinheiro.diferenca != null && dinheiro.diferenca < 0 ? r2(-dinheiro.diferenca) : 0,
    conferidos: linhas.length,
    comFalta: faltando.length,
  };

  return {
    hoje, linhas, semFicha, saidas, dinheiro, totais,
    veredito: veredito({ linhas, certos, faltando, dinheiro, totais, semFicha }),
  };
}

// O recado em uma frase — é o que ela lê antes de qualquer número.
function veredito({ linhas, certos, faltando, dinheiro, totais, semFicha }) {
  if (!linhas.length) {
    return { nivel: 'vazio', texto: 'Conta uns produtos aí em cima pra eu conferir. Sem contagem eu não tenho como saber se saiu algo sem ser cobrado.' };
  }
  const faltaCaixa = totais.faltaNoCaixa;
  const certosComFalta = certos.filter((l) => l.falta > 0);

  if (!faltando.length && !faltaCaixa) {
    return { nivel: 'ok', texto: `Conferi ${linhas.length} produto(s) e o caixa: está tudo batendo. Noite limpa.` };
  }

  const partes = [];
  if (certosComFalta.length) {
    const nomes = certosComFalta.slice(0, 3).map((l) => `${l.falta} ${l.unidade} de ${l.nome}`).join(', ');
    partes.push(`Saiu e não foi cobrado: ${nomes}${certosComFalta.length > 3 ? ' e mais' : ''}.`);
    if (totais.receitaPerdidaCerta > 0) partes.push(`São ${brl(totais.receitaPerdidaCerta)} que deviam ter entrado.`);
  }
  if (faltaCaixa > 0) partes.push(`No dinheiro faltam ${brl(faltaCaixa)}.`);
  const duvidosos = faltando.length - certosComFalta.length;
  if (duvidosos > 0) partes.push(`Tem mais ${duvidosos} produto(s) com diferença, mas nesses eu não ponho a mão no fogo — olha o motivo em cada linha.`);
  if (semFicha.length) partes.push(`E ${semFicha.length} produto(s) vendido(s) hoje não baixam estoque, então parte da falta pode ser isso.`);

  return {
    nivel: certosComFalta.length || faltaCaixa > 0 ? 'atencao' : 'olhar',
    texto: partes.join(' '),
  };
}

// ---------------------------------------------------------------------------
//  O PADRÃO DAS CONFERÊNCIAS
// ---------------------------------------------------------------------------
//
// Uma noite não diz nada. Faltar duas latas numa quinta é vida; faltar as
// mesmas duas latas em cinco quintas seguidas é outra coisa. O que separa azar
// de padrão é a REPETIÇÃO — e ninguém consegue ver isso abrindo quinze caixas
// um por um e guardando nomes de cabeça.
//
// Aqui as noites são juntadas por item.
//
// O DENOMINADOR é o ponto delicado. "Faltou 6 vezes" sozinho não quer dizer
// nada: 6 de 6 é grave, 6 de 15 é outra conversa. E o item nem sempre entra na
// contagem — a tela do fechamento oferece só os 12 que mais giraram naquela
// noite. Por isso o certo é contar sobre as noites em que ELE foi contado.
//
// Caixa fechado antes desta mudança não guardou os itens que bateram certo, só
// as faltas. Nesse caso não dá pra saber o denominador exato, e em vez de
// inventar um, devolve base='noites' — e a tela diz qual régua está usando.
const PIOR = { certo: 3, duvidoso: 2, sobra: 1 };

export function padraoDasConferencias(historico = [], { minNoites = 2 } = {}) {
  const comConf = (Array.isArray(historico) ? historico : [])
    .filter((c) => c && c.conferencia && c.conferencia.totais);
  const noites = comConf.length;
  if (noites < minNoites) {
    return { noites, base: 'noites', itens: [], totalPerdido: 0, poucasNoites: true };
  }

  // Só dá pra usar o denominador exato se TODAS as noites da janela souberem o
  // que foi contado. Misturar as duas réguas daria uma taxa que não é nem uma
  // coisa nem outra.
  const base = comConf.every((c) => Array.isArray(c.conferencia.contados)) ? 'contado' : 'noites';

  const m = new Map();
  const pega = (nome) => {
    const chave = limparNome(nome).toLowerCase();
    if (!m.has(chave)) {
      m.set(chave, {
        nome: limparNome(nome), unidade: '', falhas: 0, contagens: 0,
        niveis: { certo: 0, duvidoso: 0, sobra: 0 },
        valor: 0, faltaTotal: 0, ultima: '',
      });
    }
    return m.get(chave);
  };

  for (const c of comConf) {
    const conf = c.conferencia;
    const quando = String(c.fechadoEm || c.abertoEm || '').slice(0, 10);
    // Primeiro o que foi contado (inclusive o que bateu), pra formar a base.
    for (const nome of (Array.isArray(conf.contados) ? conf.contados : [])) {
      if (nome) pega(nome).contagens += 1;
    }
    for (const fl of (Array.isArray(conf.faltas) ? conf.faltas : [])) {
      if (!fl || !fl.nome) continue;
      const g = pega(fl.nome);
      g.falhas += 1;
      if (g.niveis[fl.nivel] != null) g.niveis[fl.nivel] += 1;
      g.unidade = g.unidade || fl.unidade || '';
      // Sobra não é dinheiro perdido — é entrada que faltou lançar. Somar ela
      // no prejuízo faria um erro de cadastro parecer furo.
      if (fl.nivel !== 'sobra') {
        g.valor = Math.round((g.valor + (num(fl.receitaPerdida) || num(fl.custoPerdido))) * 100) / 100;
        g.faltaTotal = Math.round((g.faltaTotal + num(fl.falta)) * 1000) / 1000;
      }
      if (quando > g.ultima) g.ultima = quando;
    }
  }

  const itens = [...m.values()]
    .filter((g) => g.falhas > 0)
    .map((g) => {
      const pior = Object.keys(g.niveis).filter((k) => g.niveis[k] > 0).sort((a, b) => PIOR[b] - PIOR[a])[0] || 'duvidoso';
      const de = base === 'contado' ? g.contagens : noites;
      return {
        ...g,
        pior,
        de,
        // A taxa só existe quando há denominador de verdade.
        taxa: de > 0 ? Math.round((g.falhas / de) * 100) : null,
        // Repetir é o que importa: uma vez é ocorrência, duas ou mais é padrão.
        repete: g.falhas >= 2,
      };
    })
    // Pelo dinheiro primeiro; empatado em dinheiro, quem repetiu mais.
    .sort((a, b) => b.valor - a.valor || b.falhas - a.falhas);

  return {
    noites,
    base,
    itens,
    totalPerdido: Math.round(itens.reduce((s, g) => s + g.valor, 0) * 100) / 100,
    poucasNoites: false,
  };
}
