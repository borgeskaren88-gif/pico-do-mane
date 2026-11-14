// CONTROLE DE DOSES.
//
// "Eu tenho usado muito pouco ou quase nada a área de controle de bebida, não
// acho que ela está funcional."
//
// Não estava. Era um DIÁRIO: ela digitava nome, volume, dose e data de cada
// garrafa, tocava em "Encerrar", e em troca ouvia "essa garrafa dá 20 doses e
// durou 9 dias". Pedia trabalho e não devolvia decisão nenhuma — não sabia se
// as 20 doses tinham sido vendidas.
//
// Todo sistema de bar que presta gira em torno de UMA conta:
//
//     o que saiu da garrafa − o que passou pela comanda = o que sumiu
//
// E quase tudo dela já existia aqui. O "passou pela comanda" é o saldo do
// estoque: cada venda baixa a dose pela ficha técnica, cada cortesia e cada
// perda lançada também. Então o saldo é o que DEVERIA ter. Faltava só o outro
// lado: um jeito de dizer o que TEM, que servisse pra garrafa aberta.
//
// É isso que este arquivo faz. Dois momentos de contar:
//
//   ACABOU — a garrafa (ou o barril) esvaziou. É a contagem mais barata que
//   existe: a aberta vale zero, sem olhômetro. Só falta dizer quantas fechadas
//   sobraram na prateleira.
//
//   SEMANAL — as poucas garrafas que mais giram, uma vez por semana: quantas
//   fechadas, e em que altura está a aberta, em DÉCIMOS. Décimo é como o
//   mercado inteiro conta garrafa aberta, porque é o que o olho consegue.
//
// A RESPOSTA SAI EM DOSES E EM REAIS. "Faltam 200 ml" não quer dizer nada pra
// quem está atrás do balcão; "faltam 4 doses" quer.
//
// E A CONTAGEM É ÀS CEGAS, pela mesma razão da conferência do caixa: quem vê
// "o sistema diz 3" digita 3.

import { num, numQtd } from './util';
import { fatorEntre, qtdNaUnidadeDoItem, tamanhoNoNome } from './estoque';

const arr = (v) => (Array.isArray(v) ? v : []);
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;

const MEDIDA = ['ml', 'l', 'g', 'kg'];
// Item guardado em litro ou grama é medido; o resto (un, grf, lata, cx) é
// contado — uma unidade dele JÁ É uma garrafa.
export const ehMedido = (item) => MEDIDA.includes(String((item && item.unidade) || '').toLowerCase());

export const configVazia = () => ({ registros: [], tamanhos: {}, fora: [], extras: [] });
export const lerConfig = (c) => ({
  registros: arr(c && c.registros),
  tamanhos: (c && typeof c.tamanhos === 'object' && c.tamanhos) || {},
  fora: arr(c && c.fora),
  extras: arr(c && c.extras),
});

// QUANTO CABE NUMA EMBALAGEM, NA UNIDADE DO ITEM.
//
// Item contado: 1, por definição. Item medido (o chopp mora em LITROS): tem
// que saber que o barril é de 30. Procura, nesta ordem: o que ela já disse
// aqui, a última nota que diz o que vem na embalagem, e o tamanho escrito no
// nome ("Chopp Blumenau 30L"). Sem nenhum dos três devolve null — e a tela
// pergunta, uma vez só. Chutar aqui faria toda conta de dose sair errada.
export function embalagemDe(item, compras = [], tamanhos = {}) {
  if (!item) return null;
  if (!ehMedido(item)) return { tamanho: 1, origem: 'unidade' };
  const dito = numQtd(tamanhos && tamanhos[item.id]);
  if (dito > 0) return { tamanho: dito, origem: 'dito' };
  const notas = arr(compras)
    .filter((c) => c && (c.estoqueId === item.id) && numQtd(c.conteudo) > 0 && c.conteudoUnid)
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
  for (const c of notas) {
    const f = fatorEntre(c.conteudoUnid, item.unidade);
    if (f != null) return { tamanho: r3(numQtd(c.conteudo) * f), origem: 'nota' };
  }
  const t = tamanhoNoNome(item.nome);
  if (t) {
    const f = fatorEntre(t.unid, item.unidade);
    if (f != null) return { tamanho: r3(t.qtd * f), origem: 'nome' };
  }
  return null;
}

// Fechadas + a altura da aberta em décimos, virando quantidade do item.
export function quantoTem({ cheias = 0, nivel = 0 } = {}, tamanho = 1) {
  const c = Math.max(0, Math.floor(Number(cheias) || 0));
  const n = Math.max(0, Math.min(10, Math.round(Number(nivel) || 0)));
  return r3((c + n / 10) * (Number(tamanho) || 1));
}

// A DOSE DESTE ITEM: quanto dele vai em cada venda.
//
// Vem da ficha técnica do produto que mais usa ele — a do que mais vendeu nos
// últimos 60 dias. É por ela que a diferença vira "4 doses" (ou "4 copos").
// `direto` diz se o produto é SÓ este item (chopp, dose pura, long neck): só
// aí dá pra falar em preço de venda sem inventar — num drink de cinco
// ingredientes, o preço não é da vodka.
export function doseDe(item, fichas = [], cardapio = [], vendas = [], hoje = '') {
  if (!item) return null;
  const desde = hoje ? (() => { const d = new Date(`${hoje}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 60); return d.toISOString().slice(0, 10); })() : '';
  const vendidos = new Map();
  for (const v of arr(vendas)) {
    if (!v || (desde && String(v.data || '') < desde)) continue;
    for (const it of arr(v.itens)) {
      if (!it || !it.cardapioId) continue;
      vendidos.set(it.cardapioId, (vendidos.get(it.cardapioId) || 0) + (Number(it.qtd) || 0));
    }
  }
  const porId = new Map(arr(cardapio).filter((c) => c && c.id).map((c) => [c.id, c]));
  let melhor = null;
  for (const f of arr(fichas)) {
    if (!f || !f.cardapioId) continue;
    const ing = arr(f.itens).find((x) => x && x.estoqueId === item.id);
    if (!ing) continue;
    const qtd = qtdNaUnidadeDoItem(ing.qtd, ing.unidade, item);
    if (!(qtd > 0)) continue;
    const prod = porId.get(f.cardapioId);
    if (prod && prod.ativo === false) continue;
    const cand = {
      qtd: r3(qtd),
      produto: (prod && prod.nome) || '',
      preco: num(prod && prod.preco),
      direto: arr(f.itens).length === 1,
      vendidos: vendidos.get(f.cardapioId) || 0,
    };
    if (!melhor || cand.vendidos > melhor.vendidos) melhor = cand;
  }
  return melhor;
}

// O QUE SAIU REGISTRADO desde a última vez que alguém contou este item.
//
// É a base da porcentagem: sumir 2 doses quando saíram 20 é 10%; quando
// saíram 200, é 1%. Lê o extrato do próprio item, do mais novo pro mais
// velho, e para na contagem anterior — dali pra trás já foi acertado.
export function saiuDesde(item, desdeTs = 0) {
  let soma = 0;
  for (const m of arr(item && item.movimentos)) {
    if (!m) continue;
    if ((Number(m.ts) || 0) <= desdeTs) break;
    if (m.tipo === 'contagem') break;
    // 'venda' é a baixa da comanda; 'saida' é cortesia, consumo e perda
    // lançados. Os dois são saída REGISTRADA — o que não está em nenhum dos
    // dois é justamente o que esta tela procura.
    if (m.tipo === 'venda' || m.tipo === 'saida') soma += Number(m.qtd) || 0;
  }
  return r3(soma);
}

// A linha até onde é "mão pesada" e depois dela é problema. Os números do
// mercado brigam entre si (de 2% a 10%, quase todos de quem vende sistema).
// Sem dosador, 10% é o teto honesto — e o que vale mesmo é o padrão dela ao
// longo das semanas, que a tela mostra.
export const TOLERANCIA_PCT = 10;

// O RESULTADO DE UMA CONTAGEM.
//
//   partida — a primeira deste item. O saldo de antes nunca tinha sido
//             conferido por aqui, então a diferença não é sumiço: é o estoque
//             se acertando. Acusar aqui seria começar a relação com mentira.
//   bateu   — menos de uma dose de diferença.
//   pouco   — faltou, mas dentro do que mão pesada explica.
//   sumiu   — faltou mais do que isso.
//   sobrou  — tem MAIS do que devia: compra não lançada ou ficha gastando
//             mais do que o copo leva.
export function resultadoContagem({ item, contado, dose = null, tamanho = 1, anterior = null }) {
  const esperado = r3(num(item && item.saldo));
  const real = r3(contado);
  const diferenca = r3(real - esperado);
  const falta = diferenca < 0 ? -diferenca : 0;
  const sobra = diferenca > 0 ? diferenca : 0;
  const mod = Math.abs(diferenca);
  const doseQtd = dose && dose.qtd > 0 ? dose.qtd : 0;
  const doses = doseQtd ? Math.round((mod / doseQtd) * 10) / 10 : null;
  const saiu = saiuDesde(item, anterior ? Number(anterior.ts) || 0 : 0);
  // O que saiu DE VERDADE é o registrado mais o que faltou. No mínimo uma
  // embalagem, pra uma dose perdida não virar "50%" num item que mal girou.
  const usoReal = Math.max(saiu + falta, Number(tamanho) || 1);
  const pct = falta > 0 ? Math.round((falta / usoReal) * 1000) / 10 : 0;

  let estado;
  if (!anterior) estado = 'partida';
  else if (doseQtd ? mod < doseQtd : mod < (Number(tamanho) || 1) * 0.03) estado = 'bateu';
  else if (sobra > 0) estado = 'sobrou';
  else estado = pct > TOLERANCIA_PCT ? 'sumiu' : 'pouco';

  return {
    estoqueId: item.id,
    nome: item.nome || '',
    unidade: item.unidade || 'un',
    esperado, contado: real, diferenca,
    doses, doseQtd, doseNome: (dose && dose.produto) || '',
    custo: r2(mod * num(item.custo)),
    // Só quando o produto é o item puro. Senão fica zero e a tela fala em custo.
    venda: dose && dose.direto && dose.preco > 0 && doses != null ? r2(doses * dose.preco) : 0,
    saiu, pct, estado,
  };
}

export const ultimoDe = (registros, estoqueId) => arr(registros)
  .filter((r) => r && r.estoqueId === estoqueId)
  .sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0))[0] || null;

// UMA VEZ É RUÍDO; TODA VEZ É UM PROBLEMA COM NOME.
//
// Garrafa que faltou duas doses numa semana não diz nada. A mesma garrafa
// faltando três contagens seguidas diz. É esta lista que vale olhar.
export function padroes(registros, minimo = 3) {
  const porItem = new Map();
  for (const r of arr(registros)) {
    if (!r || !r.estoqueId) continue;
    if (!porItem.has(r.estoqueId)) porItem.set(r.estoqueId, []);
    porItem.get(r.estoqueId).push(r);
  }
  const saida = [];
  for (const [estoqueId, lista] of porItem) {
    lista.sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));
    let seguidas = 0, doses = 0, custo = 0;
    for (const r of lista) {
      if (r.estado !== 'pouco' && r.estado !== 'sumiu') break;
      seguidas += 1; doses += Number(r.doses) || 0; custo += Number(r.custo) || 0;
    }
    if (seguidas >= minimo) saida.push({ estoqueId, nome: lista[0].nome, seguidas, doses: Math.round(doses * 10) / 10, custo: r2(custo), doseNome: lista[0].doseNome || '' });
  }
  return saida.sort((a, b) => b.custo - a.custo);
}

// O que faltou no mês, somado. Partida e sobra ficam de fora: uma é acerto,
// a outra é problema de cadastro.
export function resumoDoMes(registros, ym) {
  let custo = 0, venda = 0, contagens = 0, faltando = 0;
  for (const r of arr(registros)) {
    if (!r || String(r.data || '').slice(0, 7) !== ym || r.estado === 'partida') continue;
    contagens += 1;
    if (r.estado === 'pouco' || r.estado === 'sumiu') { faltando += 1; custo += Number(r.custo) || 0; venda += Number(r.venda) || 0; }
  }
  return { custo: r2(custo), venda: r2(venda), contagens, faltando };
}

// QUAIS GARRAFAS VIGIAR.
//
// Ninguém conta o bar inteiro toda semana — nem os bares grandes. Contam as
// poucas que carregam o dinheiro. Aqui são as 5 em que mais saiu custo nos
// últimos 30 dias, entre bebida e tabacaria, calculado pelas vendas e fichas.
// Sem ela configurar nada: lista que depende de cadastro é lista vazia.
// `extras` entra sempre, `fora` nunca.
export function vigiados({ estoque = [], fichas = [], vendas = [], hoje = '', config = null, quantos = 5 } = {}) {
  const cfg = lerConfig(config);
  const porId = new Map(arr(estoque).filter((it) => it && it.id).map((it) => [it.id, it]));
  const fichaDe = new Map(arr(fichas).filter((f) => f && f.cardapioId).map((f) => [f.cardapioId, arr(f.itens)]));
  const desde = hoje ? (() => { const d = new Date(`${hoje}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 30); return d.toISOString().slice(0, 10); })() : '';
  const gasto = new Map();
  for (const v of arr(vendas)) {
    if (!v || (desde && String(v.data || '') < desde)) continue;
    for (const it of arr(v.itens)) {
      const q = Number(it && it.qtd) || 0;
      if (!(q > 0)) continue;
      for (const ing of [...(fichaDe.get(it.cardapioId) || []), ...arr(it.extras)]) {
        const alvo = porId.get(ing && ing.estoqueId);
        if (!alvo) continue;
        const usado = q * qtdNaUnidadeDoItem(ing.qtd, ing.unidade, alvo) * num(alvo.custo);
        if (usado > 0) gasto.set(alvo.id, (gasto.get(alvo.id) || 0) + usado);
      }
    }
  }
  const serve = (it) => it && !it.separar && ['Bebidas', 'Tabacaria'].includes(it.categoria || '');
  const topo = [...gasto.entries()]
    .map(([id, valor]) => ({ item: porId.get(id), valor }))
    .filter((x) => serve(x.item) && !cfg.fora.includes(x.item.id))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, quantos)
    .map((x) => ({ item: x.item, valor: r2(x.valor), porque: 'gira' }));
  const ja = new Set(topo.map((x) => x.item.id));
  const extras = cfg.extras.map((id) => porId.get(id)).filter((it) => it && !ja.has(it.id)).map((item) => ({ item, valor: r2(gasto.get(item.id) || 0), porque: 'escolhida' }));
  return [...topo, ...extras];
}

export const diasDesde = (ts, agora = Date.now()) => (ts ? Math.floor((agora - Number(ts)) / 86400000) : null);
