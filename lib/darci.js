// Cérebro do Darci: lê os números do bar e monta as respostas. É lógica pura
// (sem React), pra a tela cheia e o balão flutuante responderem exatamente a
// mesma coisa. Ele NÃO inventa nada — tudo sai dos dados do próprio PicoOS.
// O sotaque é leve, do jeito da ilha: trata por "tu", direto e sem enrolação.
import { num, brl, addDays, ymOf, limparNome, fiadoDaVenda, abertoDaVenda, diaOperacional, weekday } from './util';

const ATRASADO = 'Recebimento Atrasado';
const arr = (v) => (Array.isArray(v) ? v : []);
// Tira acento e caixa, pra casar a pergunta sem depender de como foi escrita.
export const norm = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const tem = (t, ...palavras) => palavras.some((p) => t.includes(p));
const lista = (a, n = 3) => a.slice(0, n).join(', ');
const plural = (n, um, muitos) => `${n} ${n === 1 ? um : muitos}`;

export const ATALHOS = [
  'Briefing do dia',
  'Previsão de hoje',
  'Como foi ontem?',
  'Quanto tenho a receber?',
  'O que está acabando?',
  'Como está o mês?',
  'O que eu faço hoje?',
  'O que mais vende?',
  'Tenho conta pra pagar?',
];

// Lê tudo que o Darci precisa saber sobre o bar agora.
export function analisarBar({ receitas = [], despesas = [], compras = [], vendas = [], estoque = [], tarefas = [], clientes = [] } = {}) {
  receitas = arr(receitas); despesas = arr(despesas); compras = arr(compras);
  vendas = arr(vendas); estoque = arr(estoque); tarefas = arr(tarefas); clientes = arr(clientes);

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

  return {
    hoje, ontem, caixaOntem, fiadoOntem, totalOntem: Math.round((caixaOntem + fiadoOntem) * 100) / 100,
    recMes, despMes, resultado, maiorCat, aReceber, devedores, noLimite,
    baixos, zerados, valorEstoque, vencidas, vence7, somaC,
    topProdutos, ticketOntem, pedidosOntem: vendasOntem.length,
    previsao, hojeAteAgora,
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
  if (!r.length) {
    const top = n.topProdutos[0];
    r.push(`está tudo redondo. Foca em vender mais: ${top ? `teu carro-chefe é ${top.nome}` : 'trabalha teu carro-chefe'}.`);
  }
  return r;
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

  if (tem(t, 'briefing', 'resumo', 'como estamos', 'como esta o bar', 'panorama', 'bom dia', 'boa tarde', 'boa noite', 'me atualiza')) return briefing(n);

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
const COMUNS = /^(tu|ainda|nos|no|na|essa|esse|esta|est[aá]|t[aá]|pra|para|eu|deve|pode|tem|como|se|nenhum|nenhuma|ningu[eé]m|que|hoje|ontem|isso|foi|falta|faltou|sobrou|paga|rep[oõ]e|olha|tua|tuas|teu|teus|meu|minha|nada|no m[eê]s|d[eé])$/i;
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
