// Cérebro do Darci: lê os números do bar e monta as respostas. É lógica pura
// (sem React), pra a tela cheia e o balão flutuante responderem exatamente a
// mesma coisa. Ele NÃO inventa nada — tudo sai dos dados do próprio PicoOS.
// O sotaque é leve, do jeito da ilha: trata por "tu", direto e sem enrolação.
import { num, brl, addDays, ymOf, limparNome, fiadoDaVenda, abertoDaVenda, diaOperacional, weekday } from './util';
import { custoDaFicha, custoDosSabores } from './estoque';

const ATRASADO = 'Recebimento Atrasado';
const arr = (v) => (Array.isArray(v) ? v : []);
// Tira acento e caixa, pra casar a pergunta sem depender de como foi escrita.
export const norm = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const tem = (t, ...palavras) => palavras.some((p) => t.includes(p));
const lista = (a, n = 3) => a.slice(0, n).join(', ');
const plural = (n, um, muitos) => `${n} ${n === 1 ? um : muitos}`;

// ---------------------------------------------------------------------------
// O Darci lembra até onde a dona já foi informada. Assim, quando ela abre o
// app, ele conta só o que aconteceu DEPOIS da última conversa — em vez de
// repetir tudo de novo.
export const CHAVE_VISTO = 'picoos-darci-visto';

export function lerVisto() {
  try {
    const v = parseInt(localStorage.getItem(CHAVE_VISTO), 10);
    if (v > 1600000000000) return v;
  } catch { /* ignora */ }
  // Primeira vez: conta o que rolou nas últimas 12 horas (o expediente de ontem).
  return Date.now() - 12 * 3600 * 1000;
}
export function marcarVisto(ms) {
  try { localStorage.setItem(CHAVE_VISTO, String(ms || Date.now())); } catch { /* ignora */ }
}

// Quase tudo no PicoOS nasce com um id que começa pelo relógio (Date.now em
// base 36). Dá pra saber quando a linha foi criada sem guardar campo novo.
const msDoId = (id) => {
  const ms = parseInt(String(id || '').slice(0, 8), 36);
  return (ms > 1600000000000 && ms < 4000000000000) ? ms : 0;
};
const nascidoDepois = (x, desde) => msDoId(x && x.id) > desde;

// Quanto tempo faz, em palavras de gente.
export function faz(ms) {
  const min = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (min < 2) return 'agora há pouco';
  if (min < 60) return `há ${min} minutos`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${plural(h, 'hora', 'horas')}`;
  const d = Math.round(h / 24);
  return `há ${plural(d, 'dia', 'dias')}`;
}

export const ATALHOS = [
  'O que mudou?',
  'Briefing do dia',
  'Previsão de hoje',
  'Como foi ontem?',
  'Quanto tenho a receber?',
  'O que está acabando?',
  'Como está o mês?',
  'O que eu faço hoje?',
  'O que mais vende?',
  'Quantas pessoas vieram ontem?',
  'Alguma coisa subiu de preço?',
  'Tenho conta pra pagar?',
];

// O que aconteceu no PicoOS depois de um certo momento. É isso que faz o Darci
// ser prático: em vez de repetir tudo, ele conta só o que mudou desde a última
// vez que a dona falou com ele.
export function listaNovidades({ receitas = [], despesas = [], compras = [], vendas = [], estoque = [], tarefas = [] } = {}, desdeMs = 0) {
  const d = Number(desdeMs) || 0;
  const fora = [];
  if (!d) return fora;
  const soma = (a) => Math.round(a.reduce((s, x) => s + num(x.valor), 0) * 100) / 100;
  const unicos = (a) => [...new Set(a)];

  // Comandas fechadas (com o fiado que saiu nelas).
  const vs = arr(vendas).filter((v) => v && v.fechadaEm && Date.parse(v.fechadaEm) > d);
  if (vs.length) {
    const total = vs.reduce((s, v) => s + num(v.total), 0);
    const fia = vs.reduce((s, v) => s + fiadoDaVenda(v), 0);
    const nomes = unicos(vs.filter((v) => fiadoDaVenda(v) > 0.005).map((v) => limparNome(v.nome) || `Mesa ${v.mesa}`));
    fora.push(`${plural(vs.length, 'comanda fechada', 'comandas fechadas')}, ${brl(total)}${fia > 0.005 ? `, sendo ${brl(fia)} no fiado${nomes.length ? ` — ${lista(nomes, 3)}` : ''}` : ''}.`);
  }

  // Lançamentos novos em Finanças.
  const recs = arr(receitas).filter((r) => nascidoDepois(r, d));
  const atrasados = recs.filter((r) => (r.categoria || '') === ATRASADO);
  const caixas = recs.filter((r) => (r.categoria || '') !== ATRASADO);
  if (caixas.length) fora.push(`${plural(caixas.length, 'receita lançada', 'receitas lançadas')}: ${brl(soma(caixas))}.`);
  if (atrasados.length) fora.push(`Fiado recebido: ${brl(soma(atrasados))}.`);
  const des = arr(despesas).filter((x) => nascidoDepois(x, d));
  if (des.length) {
    const maior = [...des].sort((a, b) => num(b.valor) - num(a.valor))[0];
    fora.push(`${plural(des.length, 'despesa lançada', 'despesas lançadas')}: ${brl(soma(des))}${maior ? ` — a maior é ${maior.categoria || 'sem categoria'}, ${brl(num(maior.valor))}` : ''}.`);
  }
  const cps = arr(compras).filter((x) => nascidoDepois(x, d));
  if (cps.length) fora.push(`${plural(cps.length, 'compra registrada', 'compras registradas')} nas contas.`);

  // Estoque: cada movimento guarda a hora, então dá pra ver o que mexeu.
  const movs = [];
  for (const it of arr(estoque)) for (const m of arr(it.movimentos)) if (m && Number(m.ts) > d) movs.push({ m, it });
  if (movs.length) {
    const zerou = movs.filter((x) => num(x.m.saldoDepois) <= 0.0001);
    const perdas = movs.filter((x) => x.m.tipo === 'saida' && /(desperd|vencid|quebr|perda)/i.test(x.m.motivo || ''));
    const entrou = movs.filter((x) => x.m.tipo === 'compra' || x.m.tipo === 'entrada');
    if (zerou.length) fora.push(`Acabou no estoque: ${lista(unicos(zerou.map((x) => limparNome(x.it.nome))), 4)}.`);
    if (perdas.length) fora.push(`${plural(perdas.length, 'perda registrada', 'perdas registradas')}: ${lista(unicos(perdas.map((x) => limparNome(x.it.nome))), 3)}.`);
    if (entrou.length) fora.push(`${plural(unicos(entrou.map((x) => x.it.id)).length, 'item repôs', 'itens repuseram')} estoque.`);
  }

  // TO DO.
  const tns = arr(tarefas).filter((t) => nascidoDepois(t, d) && !t.feito);
  if (tns.length) fora.push(`${plural(tns.length, 'tarefa nova', 'tarefas novas')} no TO DO.`);

  return fora;
}

// Lê tudo que o Darci precisa saber sobre o bar agora.
export function analisarBar({ receitas = [], despesas = [], compras = [], vendas = [], estoque = [], tarefas = [], clientes = [], cardapio = [], fichas = [], desdeMs = 0 } = {}) {
  receitas = arr(receitas); despesas = arr(despesas); compras = arr(compras);
  vendas = arr(vendas); estoque = arr(estoque); tarefas = arr(tarefas); clientes = arr(clientes);
  cardapio = arr(cardapio); fichas = arr(fichas);

  const hoje = diaOperacional();
  const ontem = addDays(hoje, -1);
  const ym = ymOf(hoje);
  const totalCompra = (c) => num(c.quantidade) * num(c.valorUnit);

  // Caixa lançado na Finanças (mesmo critério do Log: sem "Recebimento Atrasado").
  const caixaDe = (d) => receitas.filter((r) => r && r.data === d && (r.categoria || '') !== ATRASADO).reduce((s, r) => s + num(r.valor), 0);
  const caixaOntem = caixaDe(ontem);
  const vendasOntem = vendas.filter((v) => (v.data || '') === ontem);
  const fiadoOntem = vendasOntem.reduce((s, v) => s + fiadoDaVenda(v), 0);

  // Mês corrente.
  const recMes = receitas.filter((r) => r && ymOf(r.data) === ym && (r.categoria || '') !== ATRASADO).reduce((s, r) => s + num(r.valor), 0);
  const despMes = despesas.filter((d) => d && ymOf(d.data) === ym).reduce((s, d) => s + num(d.valor), 0);
  const resultado = Math.round((recMes - despMes) * 100) / 100;
  const porCat = {};
  for (const d of despesas) if (d && ymOf(d.data) === ym) { const k = d.categoria || 'Outros'; porCat[k] = (porCat[k] || 0) + num(d.valor); }
  const maiorCat = Object.entries(porCat).sort((a, b) => b[1] - a[1])[0] || null;

  // Fiado em aberto, por cliente.
  const aReceber = Math.round(vendas.reduce((s, v) => s + abertoDaVenda(v), 0) * 100) / 100;
  const mapa = new Map();
  for (const v of vendas) {
    const a = abertoDaVenda(v);
    if (a <= 0.005) continue;
    const k = limparNome(v.nome) || `Mesa ${v.mesa}`;
    mapa.set(k, (mapa.get(k) || 0) + a);
  }
  const devedores = [...mapa.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
  const noLimite = devedores.filter((d) => {
    const cli = clientes.find((c) => limparNome(c?.nome).toLowerCase() === d.nome.toLowerCase());
    const lim = cli ? num(cli.limite) : 0;
    return lim > 0 && d.total >= lim - 0.005;
  });

  // Estoque.
  const baixos = estoque.filter((it) => num(it.minimo) > 0 && num(it.saldo) <= num(it.minimo));
  const zerados = estoque.filter((it) => num(it.saldo) <= 0);
  const valorEstoque = estoque.reduce((s, it) => s + num(it.saldo) * num(it.custo), 0);

  // Contas a pagar.
  const abertas = compras.filter((c) => c && c.pago !== 'Sim' && c.vencimento);
  const vencidas = abertas.filter((c) => c.vencimento < hoje);
  const vence7 = abertas.filter((c) => c.vencimento >= hoje && c.vencimento <= addDays(hoje, 7));
  const somaC = (a) => Math.round(a.reduce((s, c) => s + totalCompra(c), 0) * 100) / 100;

  // O que mais vende (últimos 30 dias de comanda).
  const desde = addDays(hoje, -30);
  const prod = new Map();
  for (const v of vendas) {
    if ((v.data || '') < desde) continue;
    for (const it of (v.itens || [])) {
      const q = num(it.qtd);
      if (q <= 0) continue;
      const k = it.nome || '—';
      const cur = prod.get(k) || { nome: k, qtd: 0, total: 0 };
      cur.qtd += q; cur.total += q * num(it.preco);
      prod.set(k, cur);
    }
  }
  const topProdutos = [...prod.values()].sort((a, b) => b.total - a.total);
  const ticketOntem = vendasOntem.length ? vendasOntem.reduce((s, v) => s + num(v.total), 0) / vendasOntem.length : 0;

  // Previsão de hoje: o que costuma acontecer nos últimos dias iguais a esse
  // (as últimas oito sextas, se hoje é sexta). Mesma ideia da tela Previsão,
  // só que aqui em dinheiro, que é o que ela quer ouvir de manhã.
  const diaSemana = weekday(hoje);
  const diasIguais = [];
  for (let i = 7; diasIguais.length < 8 && i <= 8 * 7; i += 7) {
    const d = addDays(hoje, -i);
    const cx = caixaDe(d);
    const vs = vendas.filter((v) => (v.data || '') === d);
    const fi = vs.reduce((s, v) => s + fiadoDaVenda(v), 0);
    if (cx <= 0 && !vs.length) continue; // dia fechado ou sem lançamento: não conta
    diasIguais.push({ data: d, caixa: cx, fiado: fi, total: cx + fi, pedidos: vs.length, itens: vs });
  }
  const media = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  const totais = diasIguais.map((d) => d.total);
  const espTotal = media(totais);
  const desvio = totais.length > 1 ? Math.sqrt(media(totais.map((x) => (x - espTotal) ** 2))) : 0;
  // Itens que costumam sair nesse dia da semana.
  const porItem = new Map();
  for (const d of diasIguais) for (const v of d.itens) for (const it of (v.itens || [])) {
    const q = num(it.qtd); if (q <= 0) continue;
    const k = it.nome || '—';
    porItem.set(k, (porItem.get(k) || 0) + q);
  }
  const itensPrevistos = [...porItem.entries()]
    .map(([nome, q]) => ({ nome, qtd: Math.round(q / (diasIguais.length || 1)) }))
    .filter((x) => x.qtd >= 1).sort((a, b) => b.qtd - a.qtd);
  const previsao = {
    diaSemana,
    dias: diasIguais.length,
    total: Math.round(espTotal * 100) / 100,
    min: Math.round(Math.max(0, espTotal - desvio) * 100) / 100,
    max: Math.round((espTotal + desvio) * 100) / 100,
    caixa: Math.round(media(diasIguais.map((d) => d.caixa)) * 100) / 100,
    fiado: Math.round(media(diasIguais.map((d) => d.fiado)) * 100) / 100,
    pedidos: Math.round(media(diasIguais.map((d) => d.pedidos))),
    itens: itensPrevistos,
  };
  // Quanto já entrou hoje, pra comparar com a previsão durante o expediente.
  const vendasHoje = vendas.filter((v) => (v.data || '') === hoje);
  const hojeAteAgora = Math.round((caixaDe(hoje) + vendasHoje.reduce((s, v) => s + fiadoDaVenda(v), 0)) * 100) / 100;

  // Quanta gente esteve no bar. Vem do nº de pessoas que o garçom informa ao
  // fechar cada comanda — então conta quem consumiu, mesa por mesa.
  const pessoasDe = (d) => vendas.filter((v) => (v.data || '') === d).reduce((s, v) => s + (num(v.pessoas) || 0), 0);
  const comandasDe = (d) => vendas.filter((v) => (v.data || '') === d).length;
  const gastoDe = (d) => vendas.filter((v) => (v.data || '') === d).reduce((s, v) => s + num(v.total), 0);
  const noPeriodo = (ini, fim) => vendas.filter((v) => (v.data || '') >= ini && (v.data || '') <= fim);
  const pessoasEntre = (ini, fim) => noPeriodo(ini, fim).reduce((s, v) => s + (num(v.pessoas) || 0), 0);
  const diasComMovimento = (ini, fim) => new Set(noPeriodo(ini, fim).filter((v) => num(v.pessoas) > 0).map((v) => v.data)).size;
  const diaMaisCheio = (ini, fim) => {
    const porDia = {};
    for (const v of noPeriodo(ini, fim)) { const d = v.data || ''; porDia[d] = (porDia[d] || 0) + (num(v.pessoas) || 0); }
    const top = Object.entries(porDia).sort((a, b) => b[1] - a[1])[0];
    return top ? { data: top[0], pessoas: top[1] } : null;
  };
  const publico = { de: pessoasDe, comandasDe, gastoDe, entre: pessoasEntre, dias: diasComMovimento, maisCheio: diaMaisCheio };

  // Margem de cada produto do cardápio (mesma conta da tela Margem) e o que
  // subiu de preço nas compras. É o vigia silencioso do lucro.
  const fichaPorId = new Map(fichas.filter((f) => f && f.cardapioId).map((f) => [f.cardapioId, arr(f.itens)]));
  const margens = [];
  for (const c of cardapio) {
    if (!c || c.ativo === false) continue;
    const ficha = fichaPorId.get(c.id);
    if (!ficha || !ficha.length) continue;
    const preco = num(c.preco);
    const base = custoDaFicha(ficha, estoque);
    const sab = custoDosSabores(c.sabores, estoque);
    const custo = Math.round((base.custo + sab.medio) * 100) / 100;
    const lucro = Math.round((preco - custo) * 100) / 100;
    margens.push({ nome: c.nome || '', preco, custo, lucro, margem: preco > 0 ? (lucro / preco) * 100 : 0, completo: base.completo });
  }
  margens.sort((a, b) => a.margem - b.margem); // pior primeiro
  const noPrejuizo = margens.filter((m) => m.completo && m.lucro < -0.005);

  // Alta de custo: compara o preço unitário da última compra de cada produto
  // com o da compra anterior. Só o que subiu de verdade (10% ou mais).
  const porProduto = new Map();
  for (const c of compras) {
    const nome = limparNome(c && c.produto);
    if (!nome || !(num(c.valorUnit) > 0) || !c.data) continue;
    const k = nome.toLowerCase();
    if (!porProduto.has(k)) porProduto.set(k, []);
    porProduto.get(k).push({ nome, data: c.data, unit: num(c.valorUnit) });
  }
  const altasCusto = [];
  for (const [, hist] of porProduto) {
    if (hist.length < 2) continue;
    hist.sort((a, b) => (a.data || '').localeCompare(b.data || ''));
    const nova = hist[hist.length - 1];
    const velha = hist[hist.length - 2];
    if (!(velha.unit > 0) || nova.data < addDays(hoje, -45)) continue; // compra velha demais não é notícia
    const pct = ((nova.unit - velha.unit) / velha.unit) * 100;
    if (pct >= 10) altasCusto.push({ nome: nova.nome, de: velha.unit, para: nova.unit, pct: Math.round(pct), data: nova.data });
  }
  altasCusto.sort((a, b) => b.pct - a.pct);

  return {
    margens, noPrejuizo, altasCusto, publico,
    hoje, ontem, caixaOntem, fiadoOntem, totalOntem: Math.round((caixaOntem + fiadoOntem) * 100) / 100,
    recMes, despMes, resultado, maiorCat, aReceber, devedores, noLimite,
    baixos, zerados, valorEstoque, vencidas, vence7, somaC,
    topProdutos, ticketOntem, pedidosOntem: vendasOntem.length,
    previsao, hojeAteAgora,
    desdeMs, novidades: listaNovidades({ receitas, despesas, compras, vendas, estoque, tarefas }, desdeMs),
    tarefasAbertas: tarefas.filter((t) => t && !t.feito),
  };
}

// O que ele mandaria fazer, por ordem de urgência.
export function recomendacoes(n) {
  const r = [];
  if (n.vencidas.length) r.push(`tu tem ${plural(n.vencidas.length, 'conta vencida', 'contas vencidas')} somando ${brl(n.somaC(n.vencidas))}. Resolve isso hoje — juro só cresce e come tua margem.`);
  if (n.resultado < 0) r.push(`o mês está negativo em ${brl(Math.abs(n.resultado))}.${n.maiorCat ? ` Teu maior gasto é ${n.maiorCat[0]}, com ${brl(n.maiorCat[1])}. Ataca essa linha primeiro.` : ''}`);
  if (n.aReceber > 0 && n.recMes > 0 && n.aReceber / n.recMes > 0.25) r.push(`o fiado em aberto já é ${Math.round((n.aReceber / n.recMes) * 100)}% do que tu faturou no mês. Está alto. Prioriza cobrar ${lista(n.devedores.map((d) => d.nome), 2)}.`);
  if (n.noLimite.length) r.push(`${lista(n.noLimite.map((d) => d.nome), 3)} ${n.noLimite.length === 1 ? 'bateu' : 'bateram'} o limite de fiado. Não libera mais nada sem receber.`);
  if (n.zerados.length) r.push(`${plural(n.zerados.length, 'item zerado', 'itens zerados')} no estoque. Venda perdida é a mais cara que existe.`);
  else if (n.baixos.length) r.push(`${plural(n.baixos.length, 'item', 'itens')} abaixo do mínimo. Repõe antes do fim de semana.`);
  if (n.vence7.length) r.push(`${plural(n.vence7.length, 'conta vence', 'contas vencem')} nos próximos sete dias, ${brl(n.somaC(n.vence7))}. Deixa o caixa preparado.`);
  if (n.noPrejuizo && n.noPrejuizo.length) r.push(`${lista(n.noPrejuizo.map((m) => m.nome), 3)} ${n.noPrejuizo.length === 1 ? 'está saindo' : 'estão saindo'} por menos do que custa. Ou sobe o preço, ou muda a ficha.`);
  else if (n.altasCusto && n.altasCusto.length) { const a = n.altasCusto[0]; r.push(`${a.nome} subiu ${a.pct}% na última compra, de ${brl(a.de)} pra ${brl(a.para)}. Confere o preço de venda do que leva ele.`); }
  if (!r.length) {
    const top = n.topProdutos[0];
    r.push(`está tudo redondo. Foca em vender mais: ${top ? `teu carro-chefe é ${top.nome}` : 'trabalha teu carro-chefe'}.`);
  }
  return r;
}

// O relatório do que mudou. Se não mudou nada, ele diz isso e emenda com o que
// está pedindo atenção — pra a conversa nunca terminar em "nada".
export function novidadesTexto(n) {
  const l = arr(n.novidades);
  const quando = n.desdeMs ? faz(n.desdeMs) : '';
  const rec = recomendacoes(n);
  if (!l.length) {
    return `Desde a última vez que a gente falou${quando ? `, ${quando}` : ''}, nada mudou por aqui. Do que já estava: ${rec[0]}`;
  }
  return `Desde a última vez${quando ? `, ${quando}` : ''}: ${l.join(' ')} Agora, o que eu faria primeiro: ${rec[0]}`;
}

// Entende de que dia (ou período) a pergunta fala: "ontem", "sexta passada",
// "dia 3", "03/09", "essa semana", "mês passado"…
export function periodoDaPergunta(t, hoje) {
  const dd = (d) => d;
  if (tem(t, 'hoje', 'agora')) return { tipo: 'dia', ini: hoje, rotulo: 'hoje' };
  if (tem(t, 'ontem')) return { tipo: 'dia', ini: addDays(hoje, -1), rotulo: 'ontem' };
  if (tem(t, 'anteontem')) return { tipo: 'dia', ini: addDays(hoje, -2), rotulo: 'anteontem' };
  if (tem(t, 'semana passada', 'semana retrasada')) return { tipo: 'periodo', ini: addDays(hoje, -14), fim: addDays(hoje, -8), rotulo: 'na semana passada' };
  if (tem(t, 'essa semana', 'esta semana', 'na semana', 'ultimos 7', 'ultimos sete', 'semana')) return { tipo: 'periodo', ini: addDays(hoje, -6), fim: hoje, rotulo: 'nos últimos sete dias' };
  if (tem(t, 'mes passado')) { const d = addDays(hoje, -1); const ym = ymOf(`${ymOf(hoje)}-01`); const iniAnt = addDays(`${ym}-01`, -1); return { tipo: 'periodo', ini: `${ymOf(iniAnt)}-01`, fim: iniAnt, rotulo: 'no mês passado', _d: dd(d) }; }
  if (tem(t, 'esse mes', 'este mes', 'no mes', 'mes')) return { tipo: 'periodo', ini: `${ymOf(hoje)}-01`, fim: hoje, rotulo: 'neste mês' };

  // "03/09" ou "3/9"
  const mData = /(\d{1,2})[\/\-](\d{1,2})/.exec(t);
  if (mData) {
    const dia = String(Math.min(31, Math.max(1, +mData[1]))).padStart(2, '0');
    const mes = String(Math.min(12, Math.max(1, +mData[2]))).padStart(2, '0');
    const ano = hoje.slice(0, 4);
    const alvo = `${ano}-${mes}-${dia}`;
    return { tipo: 'dia', ini: alvo > hoje ? `${Number(ano) - 1}-${mes}-${dia}` : alvo, rotulo: `no dia ${dia}/${mes}` };
  }
  // "dia 3"
  const mDia = /dia (\d{1,2})\b/.exec(t);
  if (mDia) {
    const dia = String(Math.min(31, Math.max(1, +mDia[1]))).padStart(2, '0');
    let alvo = `${hoje.slice(0, 7)}-${dia}`;
    if (alvo > hoje) { const anterior = addDays(`${hoje.slice(0, 7)}-01`, -1); alvo = `${anterior.slice(0, 7)}-${dia}`; }
    return { tipo: 'dia', ini: alvo, rotulo: `no dia ${dia}/${alvo.slice(5, 7)}` };
  }
  // "sexta", "sábado"… : a última vez que esse dia da semana aconteceu.
  const DIAS_T = [['domingo', 0], ['segunda', 1], ['terca', 2], ['quarta', 3], ['quinta', 4], ['sexta', 5], ['sabado', 6]];
  for (const [nome] of DIAS_T) {
    if (t.includes(nome)) {
      for (let i = 0; i <= 7; i++) {
        const d = addDays(hoje, -i);
        if (norm(weekday(d)).startsWith(nome.slice(0, 5))) return { tipo: 'dia', ini: d, rotulo: `${nome === 'sabado' ? 'no sábado' : nome === 'domingo' ? 'no domingo' : `na ${nome}`}${i === 0 ? ' (hoje)' : ''}` };
      }
    }
  }
  return null;
}

// Quanta gente esteve no bar.
export function quantasPessoas(t, n) {
  const p = n.publico;
  const per = periodoDaPergunta(t, n.hoje) || { tipo: 'dia', ini: n.ontem, rotulo: 'ontem' };
  const fmtDia = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

  if (per.tipo === 'dia') {
    const pessoas = p.de(per.ini);
    const comandas = p.comandasDe(per.ini);
    if (!comandas) return `${maiuscula(per.rotulo)} não tem comanda fechada — ou o bar não abriu, ou ninguém fechou conta no sistema.`;
    if (!pessoas) return `${maiuscula(per.rotulo)} foram ${plural(comandas, 'comanda', 'comandas')}, mas ninguém marcou quantas pessoas em cada mesa. Ao fechar a comanda, o garçom informa o número de pessoas — aí eu passo a te dizer isso.`;
    const gasto = p.gastoDe(per.ini);
    const porPessoa = pessoas > 0 ? gasto / pessoas : 0;
    // Se deu exatamente 1 por mesa, provavelmente ninguém contou de verdade.
    const suspeito = pessoas === comandas && comandas > 1
      ? ' Mas olha: deu exatamente uma pessoa por mesa, então acho que o pessoal não marcou quantos eram na comanda.'
      : '';
    return `${maiuscula(per.rotulo)} passaram ${plural(pessoas, 'pessoa', 'pessoas')} pelo bar, em ${plural(comandas, 'mesa', 'mesas')}. Deu ${brl(porPessoa)} por pessoa.${suspeito}`;
  }

  const pessoas = p.entre(per.ini, per.fim);
  if (!pessoas) return `${maiuscula(per.rotulo)} eu não tenho contagem de pessoas. Ela vem do número que o garçom informa ao fechar cada comanda.`;
  const dias = p.dias(per.ini, per.fim);
  const cheio = p.maisCheio(per.ini, per.fim);
  const media = dias > 0 ? Math.round(pessoas / dias) : 0;
  return `${maiuscula(per.rotulo)} passaram ${plural(pessoas, 'pessoa', 'pessoas')} pelo bar, em ${plural(dias, 'dia', 'dias')} de movimento — média de ${plural(media, 'pessoa', 'pessoas')} por dia.${cheio ? ` O dia mais cheio foi ${fmtDia(cheio.data)}, ${norm(weekday(cheio.data)).replace('-feira', '')}, com ${cheio.pessoas}.` : ''}`;
}

// Previsão de hoje, em dinheiro e em produto.
export function previsaoDoDia(n) {
  const p = n.previsao || {};
  const dia = (p.diaSemana || '').replace('-Feira', '').toLowerCase();
  if (!p.dias) {
    return `Ainda não tenho ${dia ? `${dia}s` : 'dias'} parecidos no histórico pra te dar previsão. Vai fechando as comandas e lançando o caixa que em duas ou três semanas eu te digo com segurança.`;
  }
  const partes = [`Pra hoje, ${dia}, eu espero uns ${brl(p.total)} — a faixa normal é de ${brl(p.min)} a ${brl(p.max)}.`];
  partes.push(`É a média ${p.dias === 1 ? 'do último dia igual a hoje' : `${p.dias === 8 ? 'das últimas oito' : `dos últimos ${p.dias}`} dias iguais a hoje`}: ${brl(p.caixa)} no caixa e ${brl(p.fiado)} no fiado${p.pedidos ? `, uns ${plural(p.pedidos, 'pedido', 'pedidos')}` : ''}.`);
  if (p.itens && p.itens.length) {
    partes.push(`Deve sair: ${p.itens.slice(0, 5).map((i) => `${i.qtd} ${i.nome}`).join(', ')}.`);
    // Cruza com o estoque: o que costuma sair hoje e está no fim é venda perdida.
    const risco = [];
    for (const prev of p.itens.slice(0, 12)) {
      const alvo = norm(prev.nome);
      const it = [...n.zerados, ...n.baixos].find((e) => {
        const en = norm(e.nome);
        return en === alvo || en.includes(alvo) || alvo.includes(en);
      });
      if (it && !risco.includes(it.nome)) risco.push(it.nome);
    }
    if (risco.length) partes.push(`Olha o estoque: ${lista(risco, 3)} ${risco.length === 1 ? 'está' : 'estão'} no fim e ${risco.length === 1 ? 'é' : 'são'} do que mais sai hoje. Repõe antes de abrir.`);
  }
  if (n.hojeAteAgora > 0.005) {
    const pct = p.total > 0 ? Math.round((n.hojeAteAgora / p.total) * 100) : 0;
    partes.push(`Até agora tu já fez ${brl(n.hojeAteAgora)}${pct ? `, ${pct}% da previsão` : ''}.`);
  }
  return partes.join(' ');
}

export function briefing(n) {
  const p = ['Ó, Karen.'];
  if (n.caixaOntem > 0 || n.fiadoOntem > 0) {
    p.push(`Ontem entrou ${brl(n.caixaOntem)} no caixa${n.fiadoOntem > 0.005 ? `, e mais ${brl(n.fiadoOntem)} ficaram no fiado — o dia fechou em ${brl(n.totalOntem)}` : ''}.`);
  } else {
    p.push('Ontem ainda não tem caixa lançado.');
  }
  if (n.recMes > 0 || n.despMes > 0) {
    p.push(`No mês tu fez ${brl(n.recMes)} de receita e gastou ${brl(n.despMes)}. ${n.resultado >= 0 ? `Está positivo em ${brl(n.resultado)}` : `Está negativo em ${brl(Math.abs(n.resultado))}`}.`);
  }
  if (n.previsao && n.previsao.dias) p.push(`Pra hoje eu espero uns ${brl(n.previsao.total)}.`);
  if (n.aReceber > 0.005) p.push(`Tem ${brl(n.aReceber)} pra receber de fiado${n.devedores[0] ? `, e o maior é ${n.devedores[0].nome}, com ${brl(n.devedores[0].total)}` : ''}.`);
  if (n.baixos.length) p.push(`${plural(n.baixos.length, 'item', 'itens')} abaixo do mínimo.`);
  const rec = recomendacoes(n);
  p.push(`O que eu faria primeiro: ${rec[0]}`);
  if (rec[1]) p.push(`Depois disso, ${rec[1]}`);
  return p.join(' ');
}

// Entende a pergunta e responde com os dados reais.
function responderCru(texto, n) {
  const t = norm(texto);
  if (!t.trim()) return 'Pode falar. Me pergunta a previsão de hoje, como foi ontem, quanto tu tem pra receber, o que está acabando, ou pede o briefing do dia.';

  if (tem(t, 'mudou', 'novidade', 'aconteceu', 'me atualiza', 'o que rolou', 'algo novo', 'alguma nova', 'desde ontem', 'novidades')) return novidadesTexto(n);

  if (tem(t, 'briefing', 'resumo', 'como estamos', 'como esta o bar', 'panorama', 'bom dia', 'boa tarde', 'boa noite', 'me atualiza')) return briefing(n);

  if (tem(t, 'quantas pessoas', 'quanta gente', 'quantos clientes', 'publico', 'movimento de pessoas', 'quantas pessoa', 'gente veio', 'gente esteve', 'pessoas vieram', 'pessoas estiveram', 'lotacao', 'fluxo de pessoas')) return quantasPessoas(t, n);

  if (tem(t, 'previsao', 'previsto', 'projecao', 'estimativa', 'espero hoje', 'espera hoje', 'esperar hoje', 'vou vender', 'devo vender', 'vai vender', 'vai render', 'movimento hoje', 'movimento de hoje', 'como vai ser hoje', 'venda de hoje', 'vendas de hoje', 'quanto hoje', 'quanto vou fazer', 'quanto devo fazer')) return previsaoDoDia(n);

  if (tem(t, 'ontem', 'fechou ontem')) {
    if (!(n.caixaOntem > 0 || n.fiadoOntem > 0)) return 'Ontem ainda não tem caixa lançado na Finanças. Lança lá que eu te digo o número.';
    return `Ontem entrou ${brl(n.caixaOntem)} no caixa${n.fiadoOntem > 0.005 ? `, mais ${brl(n.fiadoOntem)} no fiado. O dia fechou em ${brl(n.totalOntem)}` : ''}.${n.pedidosOntem ? ` Foram ${plural(n.pedidosOntem, 'pedido', 'pedidos')}, ticket médio de ${brl(n.ticketOntem)}.` : ''}`;
  }

  if (tem(t, 'receber', 'fiado', 'devendo', 'deve', 'cobrar', 'devedor')) {
    if (n.aReceber <= 0.005) return 'Ninguém está te devendo. Fiado zerado — isso é ótimo pro teu caixa.';
    const top = n.devedores.slice(0, 4).map((d) => `${d.nome} ${brl(d.total)}`).join(', ');
    const alerta = n.noLimite.length ? ` E olha: ${lista(n.noLimite.map((d) => d.nome), 3)} já bateu o limite.` : '';
    return `Tu tem ${brl(n.aReceber)} pra receber, de ${plural(n.devedores.length, 'cliente', 'clientes')}. Os maiores: ${top}.${alerta} Cobrança se faz cedo, não na véspera.`;
  }

  if (tem(t, 'acabando', 'estoque', 'falta', 'faltando', 'repor', 'acabou', 'minimo')) {
    if (!n.baixos.length && !n.zerados.length) return `Está tranquilo, nada abaixo do mínimo. Tu tem ${brl(n.valorEstoque)} parado em mercadoria.`;
    const nomes = lista(n.baixos.map((it) => it.nome), 5);
    const zer = n.zerados.length ? ` E tem ${plural(n.zerados.length, 'item zerado', 'itens zerados')}.` : '';
    return `${plural(n.baixos.length, 'item', 'itens')} abaixo do mínimo: ${nomes}${n.baixos.length > 5 ? ', e mais alguns' : ''}.${zer} Repõe antes do fim de semana pra não perder venda.`;
  }

  if (tem(t, 'mes', 'mensal', 'lucro', 'prejuizo', 'resultado', 'sobrou', 'ganhando')) {
    if (n.recMes <= 0 && n.despMes <= 0) return 'Esse mês ainda não tem lançamento. Assim que tu lançar receita e despesa eu te digo o resultado.';
    const margem = n.recMes > 0 ? Math.round((n.resultado / n.recMes) * 100) : 0;
    return `No mês tu fez ${brl(n.recMes)} de receita e gastou ${brl(n.despMes)}. ${n.resultado >= 0 ? `Sobrou ${brl(n.resultado)}, margem de ${margem}%` : `Faltou ${brl(Math.abs(n.resultado))}`}.${n.maiorCat ? ` Teu maior gasto é ${n.maiorCat[0]}, ${brl(n.maiorCat[1])}.` : ''}`;
  }

  if (tem(t, 'conta', 'boleto', 'pagar', 'vencendo', 'vencer', 'vencida')) {
    if (!n.vencidas.length && !n.vence7.length) return 'Nenhuma conta vencida nem vencendo essa semana. Caixa livre.';
    const a = n.vencidas.length ? `Tu tem ${plural(n.vencidas.length, 'conta vencida', 'contas vencidas')}, ${brl(n.somaC(n.vencidas))}. ` : '';
    const b = n.vence7.length ? `${plural(n.vence7.length, 'conta vence', 'contas vencem')} nos próximos sete dias, ${brl(n.somaC(n.vence7))}.` : '';
    return `${a}${b} ${n.vencidas.length ? 'Paga ou negocia as vencidas hoje — juro só cresce.' : 'Deixa o caixa preparado.'}`;
  }

  if (tem(t, 'mais vende', 'mais vendido', 'top', 'carro-chefe', 'carro chefe', 'melhor produto', 'campeao')) {
    if (!n.topProdutos.length) return 'Ainda não tenho venda de comanda suficiente pra te dizer. Conforme tu for fechando comanda eu te falo.';
    const top = n.topProdutos.slice(0, 5).map((p) => `${p.nome}, ${plural(p.qtd, 'unidade', 'unidades')}`).join('; ');
    return `Nos últimos trinta dias, teus campeões: ${top}. O primeiro é teu carro-chefe: não deixa faltar e cuida bem da margem dele.`;
  }

  if (tem(t, 'faco hoje', 'o que fazer', 'prioridade', 'conselho', 'recomenda', 'foco', 'devo fazer')) {
    const r = recomendacoes(n);
    return `Tuas prioridades: ${r.slice(0, 3).map((x, i) => `${i + 1}. ${x}`).join(' ')}`;
  }

  if (tem(t, 'tarefa', 'pendencia', 'to do', 'todo')) {
    if (!n.tarefasAbertas.length) return 'Nenhuma tarefa em aberto. Lista limpa.';
    return `Tu tem ${plural(n.tarefasAbertas.length, 'tarefa', 'tarefas')} em aberto. As primeiras: ${lista(n.tarefasAbertas.map((t2) => t2.texto), 4)}.`;
  }

  if (tem(t, 'quanto tem em estoque', 'valor do estoque', 'parado', 'mercadoria')) {
    return `Tu tem ${brl(n.valorEstoque)} parado em mercadoria. Dinheiro em prateleira não rende — cuidado pra não comprar demais.`;
  }

  if (tem(t, 'margem', 'quanto sobra', 'quanto lucro', 'lucro do', 'custa', 'custo do', 'subiu', 'encareceu', 'aumentou de preco')) {
    // Perguntou de um produto específico? Procura pelo nome na pergunta.
    const alvo = n.margens.find((m) => t.includes(norm(m.nome)) && norm(m.nome).length > 3);
    if (alvo) {
      return `${alvo.nome}: tu vende a ${brl(alvo.preco)} e o custo da ficha é ${brl(alvo.custo)}. Sobra ${brl(alvo.lucro)}, ${Math.round(alvo.margem)}% de margem.${alvo.completo ? '' : ' Mas olha: falta custo de algum ingrediente na ficha, então esse número está por baixo.'}`;
    }
    if (tem(t, 'subiu', 'encareceu', 'custo', 'aumentou')) {
      if (!n.altasCusto.length) return 'Nenhum insumo subiu de preço nas últimas compras. Teus custos estão firmes.';
      const top = n.altasCusto.slice(0, 3).map((a) => `${a.nome} subiu ${a.pct}%, de ${brl(a.de)} pra ${brl(a.para)}`).join('; ');
      return `Subiu de preço na última compra: ${top}. Confere se o preço de venda do que usa isso ainda fecha.`;
    }
    if (!n.margens.length) return 'Ainda não dá pra calcular margem: os produtos precisam de ficha técnica com os ingredientes e o custo do estoque.';
    const piores = n.margens.filter((m) => m.completo).slice(0, 3).map((m) => `${m.nome} (${Math.round(m.margem)}%)`).join(', ');
    const prej = n.noPrejuizo.length ? ` E olha, ${plural(n.noPrejuizo.length, 'produto está dando prejuízo', 'produtos estão dando prejuízo')}: ${lista(n.noPrejuizo.map((m) => m.nome), 3)}.` : '';
    return `Tuas piores margens: ${piores}.${prej} Me pergunta de um produto pelo nome que eu te dou o número dele.`;
  }

  if (tem(t, 'obrigad', 'valeu', 'legal', 'otimo')) return 'Que isso. Estamos juntos — qualquer hora tu me chama.';
  if (tem(t, 'quem e voce', 'o que voce faz', 'seu nome', 'teu nome', 'darci')) {
    return 'Eu sou o Darci, teu sócio aqui dentro do PicoOS. Manezinho da ilha. Leio teus números o tempo todo — caixa, fiado, estoque, contas e vendas — e te digo, sem enrolação, onde está o dinheiro e onde está o problema.';
  }

  return 'Essa eu ainda não sei responder. Me pergunta assim: a previsão de hoje, como foi ontem, quanto tenho a receber, o que está acabando, como está o mês, tenho conta pra pagar, o que mais vende, ou o que eu faço hoje.';
}

// ---------------------------------------------------------------------------
// O jeito de falar. O conteúdo é sempre o mesmo — muda o tempero.
//   leve       = português correto, direto
//   manezinho  = jeito da ilha: "tá", "pra", "ó", "tô de olho" (padrão)
//   carregado  = mais o ritmo com "né" (e, na voz, o chiado da ilha)
// Nada de gramática quebrada: manezinho fala certo, só fala solto.
const ABERTURAS = ['Ó, ', 'Olha só, ', 'Ó só, ', 'Pois é, '];
const FECHOS = ['', '', '', ' É isso, ó.', ' Vai por mim.', ' Tô de olho aqui.'];
// Só troca a maiúscula do começo se a primeira palavra não for nome próprio.
const COMUNS = /^(tu|ainda|nos|no|na|essa|esse|esta|est[aá]|t[aá]|pra|para|eu|deve|pode|tem|como|se|nenhum|nenhuma|ningu[eé]m|que|hoje|ontem|isso|foi|falta|faltou|sobrou|paga|rep[oõ]e|olha|tua|tuas|teu|teus|meu|minha|nada|desde|agora|quem|quanto|vamos|acabou|entrou|saiu|d[eé])$/i;
const embaralha = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

// Troca uma palavra inteira. Não dá pra usar \b: em JavaScript o "á" não conta
// como letra, então /\bestá\b/ nunca casaria com "está no limite".
const solta = (t, de, por) => t.replace(new RegExp(`(^|[^\\p{L}\\p{N}])${de}(?![\\p{L}\\p{N}])`, 'gu'), (m, antes) => antes + por);

export function temperar(texto, nivel = 'manezinho') {
  let t = String(texto == null ? '' : texto).trim();
  if (!t || nivel === 'leve') return t;
  for (const [de, por] of [['Está', 'Tá'], ['está', 'tá'], ['Estão', 'Tão'], ['estão', 'tão'],
    ['Estou', 'Tô'], ['estou', 'tô'], ['para', 'pra'], ['Você', 'Tu'], ['você', 'tu'], ['muito', 'bem']]) {
    t = solta(t, de, por);
  }
  const h = embaralha(t);
  if (!/^(Ó|Olha|Pois é)/.test(t)) {
    const primeira = t.split(/[\s,.]/)[0];
    const corpo = COMUNS.test(primeira) ? t[0].toLowerCase() + t.slice(1) : t;
    t = ABERTURAS[h % ABERTURAS.length] + corpo;
  }
  // Um "né" no fim da primeira frase. O ponto tem que ser mesmo de fim de
  // frase — o "." de R$ 2.413,23 não vale.
  if (nivel === 'carregado') t = t.replace(/^([^.!?]{18,}?)([.!?])(?=\s|$)/, (m, frase, p) => `${frase}, né${p}`);
  const fecho = FECHOS[(h >>> 3) % FECHOS.length];
  return fecho && !/\?$/.test(t) ? t + fecho : t;
}

// A resposta que sai pra ela: o conteúdo do Darci, no jeito de falar escolhido.
export function responder(texto, n, nivel) {
  return temperar(responderCru(texto, n), nivel == null ? 'manezinho' : nivel);
}

// ---------------------------------------------------------------------------
// Anotar por voz. O Darci entende uma ordem falada e devolve o que ENTENDEU —
// quem grava é a tela, e só depois da dona confirmar. Nada é salvo no escuro.
//
//   "lança 50 de gelo"            -> despesa de R$ 50, Gelo
//   "dá baixa de 3 bacon, perda"  -> saída de 3 no estoque, motivo Desperdício
//   "anota comprar guardanapo"    -> tarefa no TO DO
const numeroBR = (s) => {
  const v = parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
  return isFinite(v) ? v : 0;
};
const qtdBR = (v) => Number(Number(v).toFixed(3)).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const maiuscula = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function interpretarComando(texto, { estoque = [], despesas = [] } = {}) {
  // Chamar ele pelo nome é natural ("Darci, anota…") — tira isso da frente
  // antes de tentar entender a ordem.
  const cru = String(texto || '').trim().replace(/^\s*(?:darc[iyí]|darce)\s*[,.:!]?\s*/i, '');
  const t = norm(cru);
  if (!t) return null;

  // Onde está o dinheiro na frase: "R$60", "60 reais", "60,50" ou um número solto.
  const mVal = /r\$\s*(\d+(?:[.,]\d+)?)/.exec(t)
    || /(\d+(?:[.,]\d+)?)\s*(?:reais?|conto|pila)/.exec(t)
    || /(?:^|\s)(\d+(?:[.,]\d+)?)(?:\s|$)/.exec(t);
  const valor = mVal ? numeroBR(mVal[1]) : 0;

  const falaDePerda = /baixa|perd[ai]|quebr|estrag|joguei fora|venceu|vencid/.test(t);
  const falaDeDespesa = /despes|gast|paguei|pagamos|comprei|compramos|lan[cç]|nota|anota|registra|conta de/.test(t);
  const falaDeTarefa = /(?:^|\s)(anota|anotar|nota|lembra|lembre|lembrete|preciso|tenho que|tarefa|bota na lista|p[oõ]e na lista)(?:\s|$)/.test(t);

  // 1) Perda no estoque: precisa casar com um item cadastrado.
  if (falaDePerda) {
    const achados = arr(estoque)
      .map((it) => ({ it, nome: norm(it.nome) }))
      .filter((x) => x.nome.length > 2 && t.includes(x.nome))
      .sort((a, b) => b.nome.length - a.nome.length);
    if (achados.length) {
      const it = achados[0].it;
      const motivo = /venceu|vencid/.test(t) ? 'Vencido' : /quebr/.test(t) ? 'Quebra' : 'Desperdício';
      const qtd = valor > 0 ? valor : 1;
      return {
        tipo: 'perda',
        titulo: 'Baixar do estoque',
        resumo: `Baixar ${qtdBR(qtd)} ${it.unidade || 'un'} de ${limparNome(it.nome)}, como ${motivo.toLowerCase()}.`,
        dados: { itemId: it.id, nome: limparNome(it.nome), qtd, motivo, unidade: it.unidade || 'un' },
      };
    }
  }

  // 2) Compromisso na agenda: tem dia e/ou hora marcada. Vem antes da despesa,
  // senão "dia 12 às 15h" viraria uma despesa de R$ 12.
  const hoje = diaOperacional();
  const dataMarcada = proximaData(t, hoje);
  const horaMarcada = horaDaFrase(t);
  const falaDeCompromisso = falaDeTarefa || /agenda|marca[r]?(?:\s|$)|compromisso|reuniao|ligar|contato|visita|entrega/.test(t);
  if (falaDeCompromisso && (dataMarcada || horaMarcada)) {
    const tituloEv = maiuscula(tituloLimpo(cru));
    if (tituloEv.length > 2) {
      const data = dataMarcada || hoje;
      return {
        tipo: 'agenda',
        titulo: 'Marcar na agenda',
        resumo: `${tituloEv} — ${data.slice(8, 10)}/${data.slice(5, 7)}${horaMarcada ? ` às ${horaMarcada}` : ' (dia todo)'}.`,
        dados: { titulo: tituloEv, data, hora: horaMarcada || '', diaTodo: !horaMarcada },
      };
    }
  }

  // 3) Despesa: qualquer jeito de falar, desde que tenha um valor.
  if (falaDeDespesa && valor > 0) {
    const descricao = maiuscula(descricaoLimpa(cru));
    const parecida = descricao && arr(despesas).find((d) => d && d.descricao && norm(d.descricao).includes(norm(descricao).slice(0, 6)));
    const categoria = (parecida && parecida.categoria) || 'A classificar';
    return {
      tipo: 'despesa',
      titulo: 'Lançar despesa',
      resumo: descricao
        ? `Lançar despesa de ${brl(valor)} — ${descricao} (${categoria}), hoje.`
        : `Lançar despesa de ${brl(valor)} hoje. Me diz do que foi, que aí eu completo.`,
      dados: { valor, descricao, categoria },
    };
  }

  // 4) Tarefa: o resto do que começa com "anota/lembra/preciso".
  const mTar = /(?:^|\s)(?:me\s+)?(?:anota|anotar|nota|lembra|lembre|lembrete|preciso|tenho que|tarefa|bota na lista|p[oõ]e na lista)\s+(?:que\s+|de\s+|do\s+|da\s+|pra\s+|para\s+)?(.+)$/i.exec(cru);
  if (falaDeTarefa && mTar && mTar[1].trim().length > 2) {
    const texto2 = maiuscula(limparNome(mTar[1]));
    return { tipo: 'tarefa', titulo: 'Anotar no TO DO', resumo: `Anotar no TO DO: "${texto2}".`, dados: { texto: texto2 } };
  }

  return null;
}

// Tira da frase o valor e as palavras de comando, pra sobrar só o "do que foi".
// "Nota em despesas R$60" -> "" (aí ela completa na tela);
// "paguei 340 de fornecedor" -> "fornecedor".
function descricaoLimpa(cru) {
  return String(cru)
    .replace(/r\$\s*\d+(?:[.,]\d+)?/gi, ' ')
    .replace(/\d+(?:[.,]\d+)?\s*(?:reais?|conto|pila)?/gi, ' ')
    .replace(/^\s*(?:anota(?:r)?|nota|lan[cç]a(?:r)?|registra(?:r)?|paguei|pagamos|gastei|gastamos|comprei|compramos|bota|p[oõ]e)\s*/i, '')
    .replace(/\b(?:em|no|na|nas|nos|de|do|da|pra|para|com)\s+(?:despesas?|finan[cç]as?|gastos?|contas?)\b/gi, ' ')
    .replace(/^\s*(?:em|no|na|de|do|da|pra|para|com|a|o)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// A PRÓXIMA vez que esse dia acontece (agenda olha pra frente, não pra trás).
function proximaData(t, hoje) {
  if (/depois de amanha/.test(t)) return addDays(hoje, 2);
  if (/amanha/.test(t)) return addDays(hoje, 1);
  if (/\bhoje\b|hoje a noite|essa noite|mais tarde/.test(t)) return hoje;

  const mData = /(\d{1,2})[\/\-](\d{1,2})/.exec(t);
  if (mData) {
    const dia = String(Math.min(31, Math.max(1, +mData[1]))).padStart(2, '0');
    const mes = String(Math.min(12, Math.max(1, +mData[2]))).padStart(2, '0');
    const alvo = `${hoje.slice(0, 4)}-${mes}-${dia}`;
    return alvo < hoje ? `${Number(hoje.slice(0, 4)) + 1}-${mes}-${dia}` : alvo;
  }
  const mDia = /dia (\d{1,2})\b/.exec(t);
  if (mDia) {
    const dia = String(Math.min(31, Math.max(1, +mDia[1]))).padStart(2, '0');
    const alvo = `${hoje.slice(0, 7)}-${dia}`;
    if (alvo >= hoje) return alvo;
    const proxMes = addDays(`${hoje.slice(0, 7)}-28`, 7); // cai no mês seguinte
    return `${proxMes.slice(0, 7)}-${dia}`;
  }
  const nomes = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  for (const nome of nomes) {
    if (!t.includes(nome)) continue;
    for (let i = 1; i <= 7; i++) {
      const d = addDays(hoje, i);
      if (norm(weekday(d)).startsWith(nome.slice(0, 5))) return d;
    }
  }
  return '';
}

// "13h", "13:30", "9h30", "as 8" -> "13:00", "13:30", "09:30", "08:00".
function horaDaFrase(t) {
  const m = /(\d{1,2})\s*(?:h|:)\s*(\d{2})?/.exec(t) || /\b[aà]s?\s+(\d{1,2})\b/.exec(t);
  if (!m) return '';
  let h = Math.min(23, Math.max(0, parseInt(m[1], 10) || 0));
  const min = m[2] ? Math.min(59, parseInt(m[2], 10)) : 0;
  // "às 8 da noite" / "8 da tarde" viram 20h.
  if (h <= 11 && /da noite|a noite|da tarde|de tarde|da madrugada/.test(t)) h += 12;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// Tira da frase o comando e as marcas de tempo, pra sobrar só o compromisso.
// "anota que segunda as 13h tenho que entrar em contato com Destino Floripa"
//   -> "entrar em contato com Destino Floripa"
function tituloLimpo(cru) {
  return String(cru)
    .replace(/^\s*(?:me\s+)?(?:anota(?:r)?|nota|lembra|lembre|lembrete|marca(?:r)?|agenda(?:r)?|bota|p[oõ]e|preciso|tenho que)\s*/i, '')
    .replace(/^\s*(?:que|de|pra|para)\s+/i, '')
    .replace(/(?:^|\s)(?:na|no|nesta|nessa|neste|nesse|toda|todo)?\s*(?:segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)(?:-?\s*feira)?(?![\p{L}])/giu, ' ')
    .replace(/(?:depois de amanh[aã]|amanh[aã]|hoje|mais tarde)(?![\p{L}])/giu, ' ')
    .replace(/\bdia \d{1,2}\b/gi, ' ')
    .replace(/\b\d{1,2}[\/\-]\d{1,2}\b/g, ' ')
    .replace(/(?:^|\s)[aà]s?\s*\d{1,2}\s*(?:h(?:\d{2})?|:\d{2})?(?![\p{L}])/giu, ' ')
    .replace(/\b\d{1,2}\s*(?:h(?:\d{2})?|:\d{2})\b/gi, ' ')
    .replace(/\b(?:da|de|a)\s+(?:manh[aã]|tarde|noite|madrugada)\b/gi, ' ')
    .replace(/\b(?:eu\s+)?(?:tenho que|preciso|devo)\b/gi, ' ')
    .replace(/\bna agenda\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // Depois de tirar o dia e a hora costuma sobrar um "de"/"que" órfão na frente.
    .replace(/^(?:que|de|do|da|pra|para|com)\s+/i, '')
    .trim();
}
