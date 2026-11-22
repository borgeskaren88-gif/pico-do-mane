import { num, brl, addDays, ymOf, limparNome, totalCompra, fiadoDaVenda, abertoDaVenda, ehBalcao, DIAS, diaOperacional, agruparContasAbertas } from './util';
import { cmvDoMes, estoqueNoMes } from './cmv';
import { listaSemVender, CATEGORIAS_SAIDA } from './fechamento';
import { metaDoMes } from './meta';

// O RELATÓRIO DA SEMANA — os números, contados pelo app.
//
// "O Darci consegue me entregar um relatório de como foi a semana, mas preciso
// que ele seja inteligente como um CEO analisando esse relatório."
//
// A divisão de trabalho é a mesma do resto do Darci, e é ela que deixa o
// relatório confiável: AQUI o app faz TODAS as contas (faturamento, comparação
// com a semana passada e com a média, produtos que subiram e caíram, CMV,
// perdas, fiado, caixa, meta). A IA recebe isso pronto e faz o que um CEO faz:
// lê, liga uma coisa na outra, diz o que importa e o que fazer. Ela não soma
// nada que importe — se errasse uma conta, a Karen decidiria em cima do erro.
//
// A semana é de SEGUNDA a DOMINGO, no dia do bar (que vira às 6h).

const ATRASADO = 'Recebimento Atrasado';
const arr = (v) => (Array.isArray(v) ? v : []);
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const pctDe = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);
const ddmm = (d) => (d && d.length >= 10 ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '');
const diaDaSemana = (iso) => new Date(iso + 'T12:00:00').getDay();
const nomeDia = (iso) => DIAS[diaDaSemana(iso)];
const sinal = (p) => (p == null ? '' : `${p > 0 ? '+' : ''}${p}%`);

// Qual semana: 'passada' (a última de segunda a domingo inteira) ou 'atual'
// (desta segunda até ontem — o dia de hoje ainda está acontecendo).
export function semanaDoRelatorio(qual = 'passada', hoje = diaOperacional()) {
  const desdeSegunda = (diaDaSemana(hoje) + 6) % 7;
  const segundaAtual = addDays(hoje, -desdeSegunda);
  if (qual === 'atual') {
    const fim = addDays(hoje, -1);
    if (fim < segundaAtual) return { ini: segundaAtual, fim: segundaAtual, parcial: true, vazia: true };
    return { ini: segundaAtual, fim, parcial: true };
  }
  return { ini: addDays(segundaAtual, -7), fim: addDays(segundaAtual, -1), parcial: false };
}

const diasEntre = (ini, fim) => { const l = []; for (let d = ini; d <= fim; d = addDays(d, 1)) l.push(d); return l; };

export function montarRelatorio({ dados = {}, vendas = [], caixas = [], registros = [], reservas = [], ini, fim, hoje = diaOperacional() } = {}) {
  const receitas = arr(dados.receitas);
  const despesas = arr(dados.despesas);
  const compras = arr(dados.compras);
  const estoque = arr(dados.estoque);
  const cardapio = arr(dados.cardapio);
  const fichas = arr(dados.fichas);
  vendas = arr(vendas).filter((v) => v && !v.cancelada);
  const nDias = diasEntre(ini, fim).length;

  // ---- FATURAMENTO: o mesmo critério do Darci e do Log ----
  // caixa lançado na Finanças (sem "Recebimento Atrasado") + fiado das comandas.
  const caixaDe = (d) => receitas.filter((r) => r && r.data === d && (r.categoria || '') !== ATRASADO).reduce((s, r) => s + num(r.valor), 0);
  const vendasDe = (d) => vendas.filter((v) => (v.data || '') === d);
  const fiadoDe = (d) => vendasDe(d).reduce((s, v) => s + fiadoDaVenda(v), 0);
  const totalDia = (d) => r2(caixaDe(d) + fiadoDe(d));
  const somaPeriodo = (a, b) => r2(diasEntre(a, b).reduce((s, d) => s + totalDia(d), 0));

  const dias = diasEntre(ini, fim).map((d) => {
    const vs = vendasDe(d);
    const pessoas = vs.reduce((s, v) => s + (num(v.pessoas) || 0), 0);
    const mesas = vs.filter((v) => !ehBalcao(v)).length;
    return {
      data: d, dia: nomeDia(d), total: totalDia(d), caixa: r2(caixaDe(d)), fiado: r2(fiadoDe(d)),
      comandas: mesas, balcao: vs.length - mesas, pessoas,
      // Uma pessoa por mesa em todas é o padrão do sistema quando o garçom não
      // informa — não é contagem de verdade.
      pessoasValem: pessoas > 0 && !(pessoas === mesas && mesas > 1),
    };
  });
  const total = r2(dias.reduce((s, d) => s + d.total, 0));
  const antIni = addDays(ini, -7);
  const antFim = addDays(fim, -7);
  const anterior = somaPeriodo(antIni, antFim);
  // A média das 4 semanas antes desta (do mesmo pedaço, se a semana for parcial).
  const ultimas4 = [1, 2, 3, 4].map((k) => somaPeriodo(addDays(ini, -7 * k), addDays(fim, -7 * k)));
  const com4 = ultimas4.filter((v) => v > 0);
  const media4 = com4.length ? r2(com4.reduce((s, v) => s + v, 0) / com4.length) : 0;
  // O mesmo dia da semana, na média das 4 anteriores: é o que diz se a sexta
  // foi boa ou ruim (sexta não se compara com terça).
  for (const d of dias) {
    const iguais = [1, 2, 3, 4].map((k) => totalDia(addDays(d.data, -7 * k))).filter((v) => v > 0);
    d.mediaIgual = iguais.length ? r2(iguais.reduce((s, v) => s + v, 0) / iguais.length) : 0;
    d.pctIgual = d.mediaIgual > 0 && d.total > 0 ? pctDe(d.total, d.mediaIgual) : null;
  }
  const comMov = dias.filter((d) => d.total > 0);
  const melhor = [...comMov].sort((a, b) => b.total - a.total)[0] || null;
  const pior = comMov.length > 1 ? [...comMov].sort((a, b) => a.total - b.total)[0] : null;

  // ---- COMANDAS, PÚBLICO E TICKET ----
  const vsSem = vendas.filter((v) => (v.data || '') >= ini && (v.data || '') <= fim);
  const vsAnt = vendas.filter((v) => (v.data || '') >= antIni && (v.data || '') <= antFim);
  const somaVendas = (l) => r2(l.reduce((s, v) => s + num(v.total), 0));
  const comandas = vsSem.filter((v) => !ehBalcao(v)).length;
  const balcao = vsSem.length - comandas;
  const ticket = vsSem.length ? r2(somaVendas(vsSem) / vsSem.length) : 0;
  const ticketAnt = vsAnt.length ? r2(somaVendas(vsAnt) / vsAnt.length) : 0;
  const pessoas = dias.filter((d) => d.pessoasValem).reduce((s, d) => s + d.pessoas, 0);
  const vendasComPessoas = dias.filter((d) => d.pessoasValem).reduce((s, d) => s + vendasDe(d.data).reduce((x, v) => x + num(v.total), 0), 0);
  const porPessoa = pessoas > 0 ? r2(vendasComPessoas / pessoas) : 0;
  const servico = r2(vsSem.reduce((s, v) => s + num(v.servico), 0));
  const descontos = r2(vsSem.reduce((s, v) => s + num(v.desconto), 0));

  // ---- PRODUTOS: o que puxou a semana, o que subiu, o que caiu ----
  const catDe = new Map(cardapio.filter((c) => c && c.id).map((c) => [c.id, c.categoria || 'Outros']));
  const produtosDe = (lista) => {
    const m = new Map();
    for (const v of lista) {
      const fator = 1 - Math.max(0, Math.min(100, num(v.descontoPct))) / 100;
      for (const it of arr(v.itens)) {
        const nome = limparNome(it && it.nome) || 'Sem nome';
        const q = num(it.qtd);
        if (!(q > 0)) continue;
        const p = m.get(nome) || { nome, qtd: 0, receita: 0, categoria: catDe.get(it.cardapioId) || 'Outros' };
        p.qtd = r2(p.qtd + q);
        p.receita = r2(p.receita + q * num(it.preco) * fator);
        m.set(nome, p);
      }
    }
    return m;
  };
  const prodSem = produtosDe(vsSem);
  const prodAnt = produtosDe(vsAnt);
  const receitaProdutos = r2([...prodSem.values()].reduce((s, p) => s + p.receita, 0));
  const top = [...prodSem.values()].sort((a, b) => b.receita - a.receita).slice(0, 10)
    .map((p) => ({ ...p, parte: receitaProdutos > 0 ? Math.round((p.receita / receitaProdutos) * 100) : 0, qtdAnt: (prodAnt.get(p.nome) || {}).qtd || 0 }));
  const variacoes = [];
  for (const p of new Set([...prodSem.keys(), ...prodAnt.keys()])) {
    const a = (prodSem.get(p) || {}).qtd || 0;
    const b = (prodAnt.get(p) || {}).qtd || 0;
    if (Math.max(a, b) < 4) continue; // pouca quantidade: variação é barulho
    const pc = b > 0 ? pctDe(a, b) : null;
    if (b === 0 || Math.abs(pc) >= 30) variacoes.push({ nome: p, agora: a, antes: b, pct: pc, receita: (prodSem.get(p) || prodAnt.get(p)).receita });
  }
  const subiram = variacoes.filter((v) => v.pct == null || v.pct > 0).sort((x, y) => (y.agora - y.antes) - (x.agora - x.antes)).slice(0, 5);
  const cairam = variacoes.filter((v) => v.pct != null && v.pct < 0).sort((x, y) => (x.agora - x.antes) - (y.agora - y.antes)).slice(0, 5);
  const porCategoria = {};
  for (const p of prodSem.values()) porCategoria[p.categoria] = r2((porCategoria[p.categoria] || 0) + p.receita);

  // ---- CMV DA SEMANA: o mesmo cálculo da tela (custo da época de cada mês) ----
  let cmv = 0; let receitaCoberta = 0; let receitaSemFicha = 0; const semFicha = new Map();
  for (const mes of [...new Set([ymOf(ini), ymOf(fim)])]) {
    const r = cmvDoMes({ vendas: vsSem, fichas, cardapio, mes, estoque: estoqueNoMes(estoque, compras, mes).estoque });
    cmv += num(r.cmv); receitaCoberta += num(r.receitaCoberta); receitaSemFicha += num(r.receitaSemFicha);
    for (const s of arr(r.semFicha)) semFicha.set(s.nome, (semFicha.get(s.nome) || 0) + num(s.valor));
  }
  const cobertura = receitaCoberta + receitaSemFicha > 0 ? Math.round((receitaCoberta / (receitaCoberta + receitaSemFicha)) * 100) : null;
  const cmvPct = receitaCoberta > 0 ? Math.round((cmv / receitaCoberta) * 1000) / 10 : null;

  // ---- DINHEIRO QUE SAIU ----
  const desSem = despesas.filter((d) => d && d.data >= ini && d.data <= fim);
  const despesasTotal = r2(desSem.reduce((s, d) => s + num(d.valor), 0));
  const despesasPorCat = {};
  for (const d of desSem) { const k = d.categoria || 'Outros'; despesasPorCat[k] = r2((despesasPorCat[k] || 0) + num(d.valor)); }
  const maioresDespesas = [...desSem].sort((a, b) => num(b.valor) - num(a.valor)).slice(0, 5)
    .map((d) => ({ descricao: limparNome(d.descricao || d.fornecedor || d.categoria) || 'Despesa', categoria: d.categoria || 'Outros', valor: r2(d.valor), data: d.data }));
  const despesasAnt = r2(despesas.filter((d) => d && d.data >= antIni && d.data <= antFim).reduce((s, d) => s + num(d.valor), 0));
  const comprasSem = compras.filter((c) => c && c.data >= ini && c.data <= fim);
  const comprasTotal = r2(comprasSem.reduce((s, c) => s + totalCompra(c), 0));

  // ---- SAIU SEM VENDER (cortesia, consumo da casa, quebra, perda) ----
  const saidas = listaSemVender(estoque).filter((l) => l.data >= ini && l.data <= fim);
  const semVender = CATEGORIAS_SAIDA.map(([id, nome]) => {
    const l = saidas.filter((s) => s.categoria === id);
    return { id, nome, vezes: l.length, custo: r2(l.reduce((s, x) => s + (num(x.custo) || 0), 0)), semCusto: l.filter((x) => x.custo == null).length };
  }).filter((c) => c.vezes > 0);
  const semVenderTotal = r2(semVender.reduce((s, c) => s + c.custo, 0));
  const maioresPerdas = [...saidas].filter((s) => s.categoria !== 'cortesia' && s.categoria !== 'consumo').sort((a, b) => (num(b.custo) || 0) - (num(a.custo) || 0)).slice(0, 4)
    .map((s) => ({ nome: s.nome, custo: s.custo, categoria: s.categoria, motivo: s.motivo }));

  // ---- FIADO ----
  const fiadoNovo = r2(dias.reduce((s, d) => s + d.fiado, 0));
  const fiadoRecebido = r2(receitas.filter((r) => r && r.data >= ini && r.data <= fim && (r.categoria || '') === ATRASADO).reduce((s, r) => s + num(r.valor), 0));
  const fiadoAberto = r2(vendas.reduce((s, v) => s + abertoDaVenda(v), 0));

  // ---- CAIXA: sobrou ou faltou dinheiro na gaveta? ----
  const caixasSem = arr(caixas).filter((c) => c && !c.aberto && c.abertoEm && diaOperacional(new Date(c.abertoEm)) >= ini && diaOperacional(new Date(c.abertoEm)) <= fim);
  const comDif = caixasSem.filter((c) => c.diferenca != null && Math.abs(num(c.diferenca)) >= 0.01);
  const caixa = {
    fechados: caixasSem.length,
    semContagem: caixasSem.filter((c) => c.contado == null).length,
    faltou: r2(comDif.filter((c) => num(c.diferenca) < 0).reduce((s, c) => s + num(c.diferenca), 0)),
    sobrou: r2(comDif.filter((c) => num(c.diferenca) > 0).reduce((s, c) => s + num(c.diferenca), 0)),
  };

  // ---- VENDAS CORRIGIDAS NA SEMANA (venda lançada errado) ----
  const correcoes = [];
  for (const v of vendas) for (const c of arr(v.correcoes)) {
    const d = String(c && c.em || '').slice(0, 10);
    if (d >= ini && d <= addDays(fim, 1)) correcoes.push({ de: r2(c.de), para: r2(c.para) });
  }

  // ---- META DO MÊS ----
  const ym = ymOf(fim);
  const metaValor = metaDoMes(dados.metas, ym);
  const realizadoMes = somaPeriodo(`${ym}-01`, fim);
  const diasNoMes = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();
  const diaFim = Number(fim.slice(8, 10));
  const meta = metaValor > 0 ? {
    valor: r2(metaValor), realizado: realizadoMes, pct: Math.round((realizadoMes / metaValor) * 100),
    // Projeção pelo ritmo do mês até aqui. É estimativa, e vai escrito assim.
    projecao: diaFim > 0 ? r2((realizadoMes / diaFim) * diasNoMes) : 0,
    faltaPorDia: diaFim < diasNoMes ? r2(Math.max(0, metaValor - realizadoMes) / (diasNoMes - diaFim)) : 0,
    mes: ym,
  } : null;

  // ---- EQUIPE: horas no ponto ----
  const horas = new Map();
  for (const r of arr(registros)) {
    if (!r || !r.entrada || !r.saida) continue;
    const d = diaOperacional(new Date(r.entrada));
    if (d < ini || d > fim) continue;
    const h = (Date.parse(r.saida) - Date.parse(r.entrada)) / 3600000;
    if (!(h > 0 && h < 20)) continue;
    const nome = limparNome(r.nome) || r.papel || 'Equipe';
    horas.set(nome, r2((horas.get(nome) || 0) + h));
  }
  const equipe = [...horas.entries()].map(([nome, h]) => ({ nome, horas: Math.round(h * 10) / 10 })).sort((a, b) => b.horas - a.horas);
  const horasTotal = Math.round(equipe.reduce((s, e) => s + e.horas, 0) * 10) / 10;

  // ---- A SEMANA QUE VEM: contas e reservas ----
  const proxFim = addDays(hoje, 7);
  // Uma conta = um boleto (os itens da mesma nota juntos), igual à tela de
  // Contas a Pagar e ao resto do Darci.
  const abertas = agruparContasAbertas(compras.filter((c) => c && c.pago !== 'Sim' && c.vencimento));
  const vencidas = abertas.filter((c) => c.vencimento < hoje);
  const aVencer = abertas.filter((c) => c.vencimento >= hoje && c.vencimento <= proxFim);
  const contas = {
    vencidas: vencidas.length, vencidasTotal: r2(vencidas.reduce((s, c) => s + c.total, 0)),
    aVencer: aVencer.length, aVencerTotal: r2(aVencer.reduce((s, c) => s + c.total, 0)),
    maiores: [...aVencer].sort((a, b) => b.total - a.total).slice(0, 3).map((c) => ({ nome: limparNome(c.fornecedor || (c.itens[0] && c.itens[0].produto)) || 'Conta', valor: r2(c.total), vence: c.vencimento })),
  };
  const resProx = arr(reservas).filter((r) => r && r.data >= hoje && r.data <= proxFim && r.status !== 'cancelada' && !r.cancelada);
  const reservasProx = { mesas: resProx.length, pessoas: resProx.reduce((s, r) => s + (num(r.pessoas) || 1), 0) };
  const zerados = estoque.filter((i) => i && i.ativo !== false && num(i.minimo) > 0 && num(i.saldo) <= 0).map((i) => limparNome(i.nome));
  const baixos = estoque.filter((i) => i && i.ativo !== false && num(i.minimo) > 0 && num(i.saldo) > 0 && num(i.saldo) < num(i.minimo)).map((i) => limparNome(i.nome));

  return {
    ini, fim, nDias,
    faturamento: { total, anterior, pctAnterior: pctDe(total, anterior), media4, pctMedia4: pctDe(total, media4), semanasNaMedia: com4.length },
    dias, melhor, pior,
    comandas, balcao, ticket, ticketAnt, pctTicket: pctDe(ticket, ticketAnt), pessoas, porPessoa, servico, descontos,
    produtos: { top, subiram, cairam, porCategoria, receitaProdutos },
    cmv: { valor: r2(cmv), pct: cmvPct, receitaCoberta: r2(receitaCoberta), cobertura, semFicha: [...semFicha.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([nome, valor]) => ({ nome, valor: r2(valor) })) },
    despesas: { total: despesasTotal, anterior: despesasAnt, porCategoria: despesasPorCat, maiores: maioresDespesas },
    compras: { total: comprasTotal, qtd: comprasSem.length },
    resultadoCaixa: r2(total - despesasTotal),
    semVender, semVenderTotal, maioresPerdas,
    fiado: { novo: fiadoNovo, recebido: fiadoRecebido, aberto: fiadoAberto },
    caixa, correcoes: { qtd: correcoes.length, valor: r2(correcoes.reduce((s, c) => s + (c.de - c.para), 0)) },
    meta, equipe, horasTotal,
    proxima: { contas, reservas: reservasProx, zerados, baixos },
  };
}

// Os números, escritos em texto pra ir pra IA — e pra mostrar na tela quando
// não houver IA ligada. Tudo já calculado: a IA só lê.
export function relatorioEmTexto(r, { nomeBar = '', cidade = '' } = {}) {
  const L = [];
  const p = (s) => { if (s) L.push(s); };
  const f = r.faturamento;
  p(`NEGÓCIO: ${nomeBar || 'o bar'}${cidade ? `, ${cidade}` : ''}.`);
  p(`SEMANA ANALISADA: ${ddmm(r.ini)} a ${ddmm(r.fim)} (${r.nDias} dia(s), segunda a domingo${r.nDias < 7 ? ' — semana ainda em andamento, comparações feitas com o MESMO pedaço das semanas anteriores' : ''}).`);
  p('\n## FATURAMENTO (caixa lançado + fiado das comandas)');
  p(`Semana: ${brl(f.total)}. Semana anterior (mesmos dias): ${brl(f.anterior)} (${sinal(f.pctAnterior) || 'sem base'}). Média das ${f.semanasNaMedia} semana(s) anteriores: ${brl(f.media4)} (${sinal(f.pctMedia4) || 'sem base'}).`);
  p('Por dia (valor | média do mesmo dia nas 4 semanas anteriores | diferença):');
  for (const d of r.dias) p(`- ${d.dia} ${ddmm(d.data)}: ${brl(d.total)} | ${d.mediaIgual ? brl(d.mediaIgual) : 'sem média'} | ${d.pctIgual == null ? '—' : sinal(d.pctIgual)}${d.total > 0 ? ` · ${d.comandas} mesa(s)${d.balcao ? ` + ${d.balcao} balcão` : ''}${d.pessoasValem ? ` · ${d.pessoas} pessoas` : ''}` : ' · sem movimento lançado'}`);
  if (r.melhor) p(`Melhor dia: ${r.melhor.dia} (${brl(r.melhor.total)}).${r.pior ? ` Pior dia com movimento: ${r.pior.dia} (${brl(r.pior.total)}).` : ''}`);

  p('\n## CLIENTES E TICKET');
  p(`${r.comandas} comanda(s) de mesa e ${r.balcao} venda(s) de balcão. Ticket médio por comanda: ${brl(r.ticket)} (semana anterior ${brl(r.ticketAnt)}, ${sinal(r.pctTicket) || 'sem base'}).`);
  p(r.pessoas > 0 ? `Pessoas informadas pelo garçom: ${r.pessoas}. Gasto médio por pessoa: ${brl(r.porPessoa)}.` : 'Número de pessoas não informado pelo garçom nesta semana (não dá pra calcular gasto por pessoa).');
  p(`Serviço (10%) cobrado: ${brl(r.servico)}. Descontos dados: ${brl(r.descontos)}.`);

  p('\n## PRODUTOS');
  const pr = r.produtos;
  p(pr.top.length ? `Mais vendidos por faturamento: ${pr.top.map((x) => `${x.nome} ${x.qtd} un, ${brl(x.receita)} (${x.parte}% da venda de produtos; semana anterior ${x.qtdAnt} un)`).join('; ')}.` : 'Sem vendas de comanda na semana.');
  if (Object.keys(pr.porCategoria).length) p(`Venda por categoria do cardápio: ${Object.entries(pr.porCategoria).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${brl(v)}`).join(', ')}.`);
  if (pr.subiram.length) p(`Subiram (unidades, vs semana anterior): ${pr.subiram.map((x) => `${x.nome} ${x.antes}→${x.agora}${x.pct != null ? ` (${sinal(x.pct)})` : ' (novo)'}`).join(', ')}.`);
  if (pr.cairam.length) p(`Caíram: ${pr.cairam.map((x) => `${x.nome} ${x.antes}→${x.agora} (${sinal(x.pct)})`).join(', ')}.`);

  p('\n## CMV (custo do ingrediente do que foi vendido)');
  p(r.cmv.pct == null
    ? 'Não dá pra calcular nesta semana (falta venda de comanda ou ficha técnica).'
    : `CMV: ${brl(r.cmv.valor)}, ${String(r.cmv.pct).replace('.', ',')}% da receita dos produtos com ficha (${brl(r.cmv.receitaCoberta)}). Referência de bar: saudável até 35%, acima de 45% é problema.${r.cmv.cobertura != null && r.cmv.cobertura < 100 ? ` Só ${r.cmv.cobertura}% da venda tem ficha técnica; sem ficha: ${r.cmv.semFicha.map((s) => `${s.nome} (${brl(s.valor)})`).join(', ') || '—'}.` : ''}`);

  p('\n## DESPESAS E COMPRAS DA SEMANA');
  p(`Despesas lançadas: ${brl(r.despesas.total)} (semana anterior ${brl(r.despesas.anterior)}).${Object.keys(r.despesas.porCategoria).length ? ` Por categoria: ${Object.entries(r.despesas.porCategoria).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${brl(v)}`).join(', ')}.` : ''}`);
  if (r.despesas.maiores.length) p(`Maiores: ${r.despesas.maiores.map((d) => `${d.descricao} ${brl(d.valor)} (${ddmm(d.data)})`).join('; ')}.`);
  p(`Compras de mercadoria registradas: ${r.compras.qtd}, total ${brl(r.compras.total)}.`);
  p(`Faturamento menos despesas lançadas na semana: ${brl(r.resultadoCaixa)} (é uma visão de caixa da semana, não é lucro: conta de luz, aluguel e salário podem cair em outra semana).`);

  p('\n## SAIU SEM VENDER (pelo custo)');
  p(r.semVender.length ? `${r.semVender.map((c) => `${c.nome}: ${c.vezes} vez(es), ${brl(c.custo)}${c.semCusto ? ` (+${c.semCusto} sem custo cadastrado)` : ''}`).join('; ')}. Total ${brl(r.semVenderTotal)}.` : 'Nada registrado (cortesia, consumo da casa, quebra, perda).');
  if (r.maioresPerdas.length) p(`Maiores perdas: ${r.maioresPerdas.map((x) => `${x.nome}${x.custo != null ? ` ${brl(x.custo)}` : ''}${x.motivo ? ` — ${x.motivo}` : ''}`).join('; ')}.`);

  p('\n## FIADO');
  p(`Fiado novo na semana: ${brl(r.fiado.novo)}. Fiado recebido na semana: ${brl(r.fiado.recebido)}. Total em aberto hoje: ${brl(r.fiado.aberto)}.`);

  p('\n## CAIXA (gaveta)');
  p(`${r.caixa.fechados} caixa(s) fechado(s)${r.caixa.semContagem ? `, ${r.caixa.semContagem} sem contar o dinheiro` : ''}. Faltou na gaveta: ${brl(Math.abs(r.caixa.faltou))}. Sobrou: ${brl(r.caixa.sobrou)}.`);
  if (r.correcoes.qtd) p(`Vendas corrigidas depois de fechadas: ${r.correcoes.qtd}, tirando ${brl(r.correcoes.valor)} (lançamento errado ou repetido).`);

  p('\n## META DO MÊS');
  p(r.meta ? `Meta de ${r.meta.mes}: ${brl(r.meta.valor)}. Feito até ${ddmm(r.fim)}: ${brl(r.meta.realizado)} (${r.meta.pct}%). No ritmo atual o mês fecha em cerca de ${brl(r.meta.projecao)} (ESTIMATIVA).${r.meta.faltaPorDia > 0 ? ` Pra bater, precisa de ${brl(r.meta.faltaPorDia)} por dia daqui pra frente.` : ''}` : 'Sem meta cadastrada pro mês.');

  p('\n## EQUIPE (horas no ponto)');
  p(r.equipe.length ? `${r.horasTotal} h no total: ${r.equipe.map((e) => `${e.nome} ${String(e.horas).replace('.', ',')} h`).join(', ')}.${r.faturamento.total > 0 && r.horasTotal > 0 ? ` Faturamento por hora trabalhada: ${brl(r.faturamento.total / r.horasTotal)}.` : ''}` : 'Ninguém bateu ponto completo (entrada e saída) na semana.');

  p('\n## PRÓXIMOS 7 DIAS');
  const c = r.proxima.contas;
  p(`Contas vencidas: ${c.vencidas} (${brl(c.vencidasTotal)}). A vencer: ${c.aVencer} (${brl(c.aVencerTotal)})${c.maiores.length ? ` — maiores: ${c.maiores.map((x) => `${x.nome} ${brl(x.valor)} em ${ddmm(x.vence)}`).join(', ')}` : ''}.`);
  p(`Reservas: ${r.proxima.reservas.mesas} mesa(s), ${r.proxima.reservas.pessoas} pessoa(s).`);
  if (r.proxima.zerados.length) p(`Estoque ZERADO: ${r.proxima.zerados.slice(0, 8).join(', ')}.`);
  if (r.proxima.baixos.length) p(`Abaixo do mínimo: ${r.proxima.baixos.slice(0, 8).join(', ')}.`);
  return L.join('\n');
}

// O jeito de pensar de um CEO, escrito pra IA. O que faz a diferença entre
// "relatório" e "análise": prioridade por dinheiro, causa ligada a número, e
// decisão com dono e prazo — nada de conselho genérico.
export function instrucoesCEO({ nomeBar = 'o bar', dona = '' } = {}) {
  return `Você é o Darci, sócio de ${dona || 'quem é dono(a)'} no PicoOS, o sistema do ${nomeBar}. Neste momento você não está batendo papo: está entregando o RELATÓRIO DA SEMANA, e pensa como um CEO experiente de bares e restaurantes que leu todos os números e tem 5 minutos com a dona pra dizer o que importa e o que fazer.

COMO UM CEO PENSA
- Prioriza por DINHEIRO: o que mais mexe no resultado vem primeiro. Não lista tudo; escolhe.
- Liga uma coisa na outra: o faturamento caiu porque veio menos gente ou porque o ticket caiu? A queda foi num dia só ou na semana toda? O CMV subiu por causa de preço de compra, de perda ou de produto com ficha errada?
- Separa fato de hipótese: o que está nos números é fato; a explicação é hipótese e vai escrita como tal ("pode ser", "vale conferir").
- Compara sempre: semana anterior, média das últimas semanas, o mesmo dia da semana, a meta. Número sozinho não diz nada.
- Decide: cada decisão tem o QUÊ, POR QUÊ (o número que justifica), QUEM faz e o GANHO esperado em reais quando der pra calcular com os números da ficha (mostra a conta em uma linha). Nada de "melhorar o atendimento", "investir em marketing" ou "ficar de olho" sem um número e uma ação concreta.
- Também reconhece o que foi bem, em uma ou duas linhas, com número.
- Se um dado está faltando ou não é confiável (pessoas não informadas, produto sem ficha, caixa sem contagem), diz em uma linha o que isso esconde e como resolver no PicoOS.

DE ONDE SAEM OS NÚMEROS
- Só da FICHA DA SEMANA abaixo. NUNCA invente número, percentual ou fato. Pode fazer contas simples com os números dela (somar, subtrair, dividir) e deve conferir a conta.
- Valores sempre no formato R$ 1.234,56.

COMO ESCREVER
- Português do Brasil simples, tratando por "tu". A dona não é técnica: se usar um termo como CMV ou ticket médio, explica em meia frase na primeira vez.
- Até umas 450 palavras. Direto, sem enrolação, sem sermão, sem emoji.
- Use EXATAMENTE estas seções, nesta ordem, com "## " no começo de cada título:
## A semana em uma frase
## Os números que importam
(4 a 6 itens com "- ", cada um com o número e a comparação)
## O que foi bem
## O que me preocupa
## Por que isso aconteceu
## O que eu faria esta semana
(3 decisões numeradas "1.", "2.", "3.", cada uma com o quê, por quê, quem e o ganho esperado)
## De olho nos próximos 7 dias
## A pergunta da semana
(uma pergunta estratégica pra ela pensar, ligada aos números)
- Pode usar **negrito** para destacar um número-chave. Não use tabelas.`;
}

// Sem IA ligada, o relatório ainda sai: os números organizados e os sinais
// mais fortes, escritos pelo próprio app. Menos esperto, mas nunca vazio.
export function relatorioSemIA(r) {
  const f = r.faturamento;
  const L = [];
  L.push('## A semana em uma frase');
  L.push(`Faturamento de **${brl(f.total)}**${f.pctAnterior != null ? `, ${f.pctAnterior >= 0 ? `${f.pctAnterior}% acima` : `${Math.abs(f.pctAnterior)}% abaixo`} da semana anterior` : ''}${f.pctMedia4 != null ? ` e ${f.pctMedia4 >= 0 ? `${f.pctMedia4}% acima` : `${Math.abs(f.pctMedia4)}% abaixo`} da média das últimas semanas` : ''}.`);
  L.push('## Os números que importam');
  L.push(`- Ticket médio por comanda: ${brl(r.ticket)}${r.pctTicket != null ? ` (${sinal(r.pctTicket)} vs semana anterior)` : ''}.`);
  if (r.melhor) L.push(`- Melhor dia: ${r.melhor.dia}, ${brl(r.melhor.total)}.${r.pior ? ` Pior: ${r.pior.dia}, ${brl(r.pior.total)}.` : ''}`);
  if (r.cmv.pct != null) L.push(`- CMV (quanto do preço vai em ingrediente): ${String(r.cmv.pct).replace('.', ',')}%${r.cmv.pct > 45 ? ' — alto' : r.cmv.pct > 35 ? ' — atenção' : ' — saudável'}.`);
  if (r.semVenderTotal > 0) L.push(`- Saiu sem vender: ${brl(r.semVenderTotal)} pelo custo.`);
  L.push(`- Despesas lançadas: ${brl(r.despesas.total)}. Fiado novo ${brl(r.fiado.novo)}, recebido ${brl(r.fiado.recebido)}.`);
  if (r.meta) L.push(`- Meta do mês: ${r.meta.pct}% feita; no ritmo, fecha perto de ${brl(r.meta.projecao)} (estimativa).`);
  L.push('## De olho nos próximos 7 dias');
  const c = r.proxima.contas;
  L.push(`- Contas a vencer: ${c.aVencer} (${brl(c.aVencerTotal)})${c.vencidas ? `; vencidas: ${c.vencidas} (${brl(c.vencidasTotal)})` : ''}.`);
  if (r.proxima.zerados.length) L.push(`- Estoque zerado: ${r.proxima.zerados.slice(0, 5).join(', ')}.`);
  L.push('');
  L.push('_Este é o resumo automático. Com a IA do Darci ligada, ele analisa estes números e te diz o que fazer._');
  return L.join('\n');
}
