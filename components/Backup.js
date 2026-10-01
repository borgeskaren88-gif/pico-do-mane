'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { C, Card, Btn, KPI, Area, PageTitle, inputStyle } from './ui';
import { todayISO, fmtDate, num, brl, ymOf, mesLabel, weekday, limparNome, DIAS, CUSTO_VARIAVEL, DESPESA_OPERACIONAL } from '../lib/util';
import { horasDoTurno, fmtHoras, aPagarNoMes } from '../lib/ponto';
import SEED_DATA from '../data/seed.json';

// Monta um relatório em texto (Markdown) para análise: um RESUMO com os
// números já calculados + os DADOS COMPLETOS organizados por seção. Bem mais
// útil pra analisar do que o JSON cru.
function montarAnalise(all, marca = 'Meu negócio') {
  const L = [];
  const arrOu = (v) => (Array.isArray(v) ? v : []);
  const pct = (n, d) => (d ? (n / d * 100).toFixed(1).replace('.', ',') + '%' : '—');
  const soma = (arr, campo = 'valor') => arr.reduce((s, x) => s + num(x[campo]), 0);
  const totalCompra = (c) => num(c.quantidade) * num(c.valorUnit);
  const hoje = todayISO();

  const recTotal = soma(all.receitas);
  const despTotal = soma(all.despesas);
  const lucroTotal = recTotal - despTotal;
  const meses = [...new Set([...all.receitas, ...all.despesas].map((x) => ymOf(x.data)).filter(Boolean))].sort();

  L.push(`# ${marca} — Dados para análise`);
  L.push(`Gerado em ${todayISO()}`, '');

  L.push('## 1. Resumo', '');
  L.push(`- Período: ${meses.length ? mesLabel(meses[0]) + ' a ' + mesLabel(meses[meses.length - 1]) : '—'}`);
  L.push(`- Receita total: ${brl(recTotal)}`);
  L.push(`- Despesa total: ${brl(despTotal)}`);
  L.push(`- Lucro operacional: ${brl(lucroTotal)} (margem ${pct(lucroTotal, recTotal)})`, '');

  L.push('### Resultado por mês', '', '| Mês | Receita | Despesa | Lucro | Margem |', '|---|---|---|---|---|');
  for (const ym of meses) {
    const r = soma(all.receitas.filter((x) => ymOf(x.data) === ym));
    const d = soma(all.despesas.filter((x) => ymOf(x.data) === ym));
    L.push(`| ${mesLabel(ym)} | ${brl(r)} | ${brl(d)} | ${brl(r - d)} | ${pct(r - d, r)} |`);
  }
  L.push(`| Total | ${brl(recTotal)} | ${brl(despTotal)} | ${brl(lucroTotal)} | ${pct(lucroTotal, recTotal)} |`, '');

  // Despesas por categoria
  const catMap = new Map();
  for (const d of all.despesas) catMap.set(d.categoria || 'Sem categoria', (catMap.get(d.categoria || 'Sem categoria') || 0) + num(d.valor));
  L.push('### Despesas por categoria', '', '| Categoria | Total | % |', '|---|---|---|');
  for (const [k, v] of [...catMap.entries()].sort((a, b) => b[1] - a[1])) L.push(`| ${k} | ${brl(v)} | ${pct(v, despTotal)} |`);
  L.push('');

  // Custo variável x operacional
  let cv = 0, op = 0, outros = 0;
  for (const d of all.despesas) {
    const v = num(d.valor);
    if (CUSTO_VARIAVEL.includes(d.categoria)) cv += v;
    else if (DESPESA_OPERACIONAL.includes(d.categoria)) op += v;
    else outros += v;
  }
  L.push('### Custo variável x Operacional', '');
  L.push(`- Custo variável: ${brl(cv)} (${pct(cv, despTotal)})`);
  L.push(`- Despesa operacional: ${brl(op)} (${pct(op, despTotal)})`);
  if (outros) L.push(`- Não classificado: ${brl(outros)} (${pct(outros, despTotal)})`);
  L.push('');

  // Maiores fornecedores (compras)
  const fMap = new Map();
  for (const c of all.compras) { const f = limparNome(c.fornecedor) || 'Sem fornecedor'; fMap.set(f, (fMap.get(f) || 0) + totalCompra(c)); }
  L.push('### Maiores fornecedores (por compras)', '', '| Fornecedor | Total |', '|---|---|');
  for (const [k, v] of [...fMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) L.push(`| ${k} | ${brl(v)} |`);
  L.push('');

  // Contas a pagar
  const abertas = all.compras.filter((c) => c.pago !== 'Sim');
  const totalAberto = abertas.reduce((s, c) => s + totalCompra(c), 0);
  const vencidas = abertas.filter((c) => c.vencimento && c.vencimento < hoje);
  const totalVenc = vencidas.reduce((s, c) => s + totalCompra(c), 0);
  L.push('### Contas a pagar', '');
  L.push(`- Em aberto: ${brl(totalAberto)} (${abertas.length} itens)`);
  L.push(`- Vencidas: ${brl(totalVenc)} (${vencidas.length} itens)`, '');

  // Receita média por dia da semana
  const wdSum = {}, wdDates = {};
  for (const r of all.receitas) {
    const w = weekday(r.data); if (!w) continue;
    wdSum[w] = (wdSum[w] || 0) + num(r.valor);
    (wdDates[w] = wdDates[w] || new Set()).add(r.data);
  }
  L.push('### Receita média por dia da semana', '', '| Dia | Média | Total |', '|---|---|---|');
  for (const dia of DIAS) {
    if (!wdSum[dia]) continue;
    L.push(`| ${dia} | ${brl(wdSum[dia] / (wdDates[dia].size || 1))} | ${brl(wdSum[dia])} |`);
  }
  L.push('');

  // O SALÃO, O ESTOQUE E A FOLHA.
  // ==========================================================================
  // "Como eu faço pra tu teres acesso ao PicoOS, pra quando eu perguntar como
  // está a minha empresa tu conseguires responder?"
  //
  // Este relatório é a ponte que já existia — e estava velha. Ele contava
  // receita, despesa e compra, e parava aí: nada de estoque, nada das comandas,
  // nada da folha. Ou seja, respondia sobre a parte do negócio que cabe numa
  // planilha e calava sobre a parte que acontece no salão.
  //
  // Aqui vai o resto, em resumo. Resumo e não despejo: comanda por comanda com
  // item por item daria dezenas de milhares de linhas, e o que responde "como
  // está a empresa" é o padrão — quanto sai por dia, o que mais vende, quanto
  // tem parado na prateleira, quanto a equipe custou.
  const vendas = arrOu(all.vendas);
  if (vendas.length) {
    const totalV = vendas.reduce((s, v) => s + num(v.total), 0);
    const fiadoV = vendas.reduce((s, v) => s + num(v.fiado), 0);
    const pessoas = vendas.reduce((s, v) => s + num(v.pessoas), 0);
    const dias = new Set(vendas.map((v) => v.data).filter(Boolean));
    // QUANTAS PESSOAS FREQUENTARAM O BAR, e quanto cada uma gastou.
    //
    // "Quero que toda vez que eu baixar o relatório ele venha com esse dado de
    // quantidade de pessoas que frequentaram o bar, e ticket médio por pessoa
    // também."
    //
    // Duas contas diferentes que costumam ser confundidas, e por isso aparecem
    // lado a lado com nome:
    //   - por COMANDA: quanto rende uma mesa (serve pra pensar em rodízio);
    //   - por PESSOA: quanto rende cada cliente (serve pra pensar em cardápio,
    //     preço e promoção).
    // Uma mesa de R$ 200 com 8 pessoas e outra de R$ 200 com 2 são o mesmo
    // ticket de mesa e negócios completamente diferentes.
    const contadas = vendas.filter((v) => v.pessoasContadas);
    const pessoasContadas = contadas.reduce((s2, v) => s2 + num(v.pessoas), 0);
    const totalContado = contadas.reduce((s2, v) => s2 + num(v.total), 0);

    L.push('### Salão (comandas fechadas)', '');
    L.push(`- Comandas: ${vendas.length} em ${dias.size} dia(s) de movimento`);
    L.push(`- Vendido: ${brl(totalV)} · ticket médio por COMANDA ${brl(vendas.length ? totalV / vendas.length : 0)}`);
    if (pessoas > 0) {
      L.push(`- **Pessoas que frequentaram o bar: ${pessoas}** · ticket médio por PESSOA ${brl(totalV / pessoas)}`);
      L.push(`- Média de ${(pessoas / (vendas.length || 1)).toFixed(1).replace('.', ',')} pessoa(s) por mesa`);
    } else {
      L.push('- Pessoas: nenhuma comanda tem contagem ainda.');
    }
    L.push(`- Ficou no fiado: ${brl(fiadoV)} (${pct(fiadoV, totalV)} do vendido)`, '');

    // O AVISO QUE IMPEDE ESTE RELATÓRIO DE MENTIR.
    //
    // Até 30/09/2026 o app preenchia "1 pessoa" sozinho quando ninguém contava.
    // Essas vendas estão no banco indistinguíveis de uma mesa que era mesmo de
    // uma pessoa — então o número de público dos meses antigos é o menor
    // possível, e o gasto por pessoa, o maior possível. Dizer isso é o que
    // separa um relatório de um chute bem formatado.
    if (contadas.length < vendas.length) {
      const velhas = vendas.length - contadas.length;
      L.push(`> **Cuidado com o histórico.** ${velhas} de ${vendas.length} comandas são de antes de a contagem virar obrigatória — nelas o app preenchia "1 pessoa" sozinho quando ninguém contava. Então o público de antes está SUBESTIMADO e o gasto por pessoa, SUPERESTIMADO.`);
      if (contadas.length > 0 && pessoasContadas > 0) {
        L.push('>');
        L.push(`> Só com as ${contadas.length} comandas de contagem confirmada: **${pessoasContadas} pessoas**, ${brl(totalContado)} vendidos, **${brl(totalContado / pessoasContadas)} por pessoa**. É este o número pra confiar.`);
      }
      L.push('');
    }

    // Por mês, pra ver a curva — e por dia da semana, que é a decisão de
    // escala que ela toma toda semana.
    const porMes = new Map();
    const porDia = new Map();
    const porSemana = new Map();
    for (const v of vendas) {
      const m = ymOf(v.data);
      if (m) {
        const cur = porMes.get(m) || { total: 0, pessoas: 0, comandas: 0 };
        cur.total += num(v.total); cur.pessoas += num(v.pessoas); cur.comandas += 1;
        porMes.set(m, cur);
      }
      if (v.data) porDia.set(v.data, (porDia.get(v.data) || 0) + num(v.total));
      const w = weekday(v.data);
      if (w) {
        const cur = porSemana.get(w) || { total: 0, pessoas: 0, dias: new Set() };
        cur.total += num(v.total); cur.pessoas += num(v.pessoas); cur.dias.add(v.data); porSemana.set(w, cur);
      }
    }
    if (porMes.size) {
      L.push('| Mês | Comandas | Pessoas | Vendido | Por comanda | Por pessoa |', '|---|---|---|---|---|---|');
      for (const [m, x] of [...porMes.entries()].sort()) {
        L.push(`| ${mesLabel(m)} | ${x.comandas} | ${x.pessoas || '—'} | ${brl(x.total)} | ${brl(x.total / (x.comandas || 1))} | ${x.pessoas > 0 ? brl(x.total / x.pessoas) : '—'} |`);
      }
      L.push('');
    }
    if (porSemana.size) {
      L.push('#### Salão por dia da semana', '', '| Dia | Noites | Média por noite | Pessoas por noite | Por pessoa |', '|---|---|---|---|---|');
      for (const dia of DIAS) {
        const x = porSemana.get(dia); if (!x) continue;
        const n = x.dias.size || 1;
        L.push(`| ${dia} | ${x.dias.size} | ${brl(x.total / n)} | ${x.pessoas > 0 ? (x.pessoas / n).toFixed(1).replace('.', ',') : '—'} | ${x.pessoas > 0 ? brl(x.total / x.pessoas) : '—'} |`);
      }
      L.push('');
    }
    // Os últimos dias em cheio: é o que responde "e ontem, como foi?".
    const ultimos = [...porDia.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 30);
    if (ultimos.length) {
      L.push('#### Últimos dias de movimento', '', '| Dia | Comandas | Pessoas | Vendido | Por pessoa |', '|---|---|---|---|---|');
      for (const [d, v] of ultimos) {
        const doDia = vendas.filter((x) => x.data === d);
        const p = doDia.reduce((s2, x) => s2 + num(x.pessoas), 0);
        L.push(`| ${d} | ${doDia.length} | ${p || '—'} | ${brl(v)} | ${p > 0 ? brl(v / p) : '—'} |`);
      }
      L.push('');
    }
    // O que efetivamente sai pela porta.
    const prod = new Map();
    for (const v of vendas) {
      for (const it of arrOu(v.itens)) {
        const q = num(it.qtd); if (!(q > 0)) continue;
        const nome = it.nome || '—';
        const cur = prod.get(nome) || { qtd: 0, total: 0 };
        cur.qtd += q; cur.total += q * num(it.preco); prod.set(nome, cur);
      }
    }
    if (prod.size) {
      L.push('#### O que mais vende (todas as comandas)', '', '| Produto | Qtd | Receita |', '|---|---|---|');
      for (const [nome, x] of [...prod.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 30)) {
        L.push(`| ${nome} | ${x.qtd} | ${brl(x.total)} |`);
      }
      L.push('');
    } else {
      L.push('_As comandas não guardaram itens — só os totais._', '');
    }
  }

  const estoque = arrOu(all.estoque);
  if (estoque.length) {
    const parado = estoque.reduce((s, it) => s + num(it.saldo) * num(it.custo), 0);
    const semCusto = estoque.filter((it) => !(num(it.custo) > 0));
    const acabando = estoque.filter((it) => num(it.minimo) > 0 && num(it.saldo) <= num(it.minimo));
    L.push('### Estoque', '');
    L.push(`- Itens controlados: ${estoque.length}`);
    L.push(`- Dinheiro parado na prateleira: ${brl(parado)}`);
    L.push(`- Abaixo do mínimo: ${acabando.length}`);
    // Isto é qualidade do dado, e vale dizer: item sem custo estraga a margem e
    // o CMV em silêncio, e é o tipo de coisa que só aparece quando alguém olha.
    if (semCusto.length) L.push(`- **Sem custo cadastrado: ${semCusto.length}** (${semCusto.slice(0, 8).map((x) => x.nome).join(', ')}${semCusto.length > 8 ? '…' : ''}) — esses não entram na margem nem no CMV`);
    L.push('');
    if (acabando.length) {
      L.push('| Acabando | Saldo | Mínimo |', '|---|---|---|');
      for (const it of acabando.slice(0, 25)) L.push(`| ${it.nome} | ${num(it.saldo)} ${it.unidade || ''} | ${num(it.minimo)} |`);
      L.push('');
    }
    const maiores = [...estoque].sort((a, b) => num(b.saldo) * num(b.custo) - num(a.saldo) * num(a.custo)).slice(0, 15);
    L.push('| Onde o dinheiro está parado | Saldo | Custo unit. | Parado |', '|---|---|---|---|');
    for (const it of maiores) {
      const v = num(it.saldo) * num(it.custo);
      if (!(v > 0)) continue;
      L.push(`| ${it.nome} | ${num(it.saldo)} ${it.unidade || ''} | ${brl(num(it.custo))} | ${brl(v)} |`);
    }
    L.push('');
  }

  const ponto = arrOu(all.ponto);
  if (ponto.length) {
    L.push('### Folha (ponto batido)', '');
    const porPessoa = new Map();
    for (const r of ponto) {
      const nome = r.nome || '—';
      const cur = porPessoa.get(nome) || { horas: 0, turnos: 0, papel: r.papel || '' };
      cur.horas += horasDoTurno(r); cur.turnos += 1;
      if (!cur.papel && r.papel) cur.papel = r.papel;
      porPessoa.set(nome, cur);
    }
    L.push('| Pessoa | Setor | Turnos | Horas |', '|---|---|---|---|');
    for (const [nome, x] of porPessoa) L.push(`| ${nome} | ${x.papel || '—'} | ${x.turnos} | ${fmtHoras(x.horas)} |`);
    L.push('');
    // O mês corrente em dinheiro, que é a pergunta de quem paga.
    const mesAtual = todayISO().slice(0, 7);
    const jornadas = all.jornadas && typeof all.jornadas === 'object' ? all.jornadas : {};
    const linhas = [];
    for (const [nome, x] of porPessoa) {
      const p = aPagarNoMes(ponto.filter((r) => (r.nome || '—') === nome), jornadas[x.papel], mesAtual);
      if (p) linhas.push(`| ${nome} | ${fmtHoras(p.horas)} | ${brl(p.valorHora)} | ${brl(p.total)} |`);
    }
    if (linhas.length) {
      L.push(`#### A pagar em ${mesLabel(mesAtual)} (pelo que já foi trabalhado)`, '', '| Pessoa | Horas | Hora | A pagar |', '|---|---|---|---|', ...linhas, '');
    }
  }

  // 2. Dados completos
  L.push('## 2. Dados completos', '');
  const clean = (parts) => parts.filter((p) => p != null && String(p).trim() !== '').join(' · ');
  const secao = (titulo, arr, fmt) => {
    L.push(`### ${titulo} (${arr.length})`, '');
    if (!arr.length) { L.push('_sem registros_', ''); return; }
    for (const x of arr) L.push('- ' + fmt(x));
    L.push('');
  };
  const porData = (arr) => [...arr].sort((a, b) => (a.data || '').localeCompare(b.data || ''));

  secao('Receitas', porData(all.receitas), (r) => clean([r.data, r.categoria, r.descricao, brl(num(r.valor)), r.obs]));
  secao('Despesas', porData(all.despesas), (d) => clean([d.data, d.categoria, d.descricao, brl(num(d.valor)), d.obs]));
  secao('Compras', porData(all.compras), (c) => clean([
    c.data, c.produto, c.fornecedor, `${c.quantidade}x ${brl(num(c.valorUnit))} = ${brl(totalCompra(c))}`,
    c.vencimento && `vence ${c.vencimento}`, c.pago === 'Sim' ? 'PAGO' : 'em aberto', c.obs,
  ]));
  secao('Cotações', all.cotacoes, (c) => clean([c.data, c.produto, c.fornecedor, brl(num(c.preco)), c.categoria]));
  secao('Garrafas', all.garrafas, (g) => clean([
    g.produto, g.volume && `${g.volume}ml`, g.dose && `dose ${g.dose}ml`,
    g.dataAbertura && `aberto ${g.dataAbertura}`, g.dataTermino && `fim ${g.dataTermino}`,
    g.drinks && `${g.drinks} drinks`, g.obs,
  ]));
  secao('Log Operacional', porData(all.diario), (d) => clean([
    d.data, d.clima, d.evento && `evento: ${d.evento}`, d.receita && `receita ${d.receita}`,
    d.nPedidos && `${d.nPedidos} pedidos`, d.fiado && `${d.fiado} fiado`, d.nota && `nota ${d.nota}`,
    d.problema, d.decisao, d.aprendizado, d.prioridade,
  ]));

  return L.join('\n');
}

export default function Backup({ all, restore, negocio = '' }) {
  const [msg, setMsg] = useState('');
  const [importText, setImportText] = useState('');
  const jsonStr = JSON.stringify(all, null, 2);

  // Backups automáticos na nuvem (uma cópia por dia, feita sozinho).
  const [autoBackups, setAutoBackups] = useState([]);
  const [restaurando, setRestaurando] = useState('');
  const carregarAuto = useCallback(async () => {
    try { const r = await fetch('/api/backup', { cache: 'no-store' }); const j = await r.json(); if (j.ok) setAutoBackups(Array.isArray(j.backups) ? j.backups : []); } catch { /* ignora */ }
  }, []);
  useEffect(() => { carregarAuto(); }, [carregarAuto]);

  // O PONTO NÃO MORA NO PAINEL: cada batida é uma linha própria no banco. Pra o
  // relatório poder falar de folha, ele precisa ser buscado — e é melhor buscar
  // ao abrir a tela do que no clique, porque o navegador só deixa escrever na
  // área de transferência logo depois do toque, sem espera no meio.
  const [ponto, setPonto] = useState([]);
  const [jornadas, setJornadas] = useState({});
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/ponto', { cache: 'no-store' });
        const j = await r.json();
        if (j.ok) {
          setPonto(Array.isArray(j.registros) ? j.registros : []);
          setJornadas(j.jornadas && typeof j.jornadas === 'object' ? j.jornadas : {});
        }
      } catch { /* sem ponto, o relatório sai sem a seção de folha */ }
    })();
  }, []);
  const restaurarAuto = async (b) => {
    const data = typeof b === 'string' ? b : b.data;
    const semEstoque = typeof b === 'object' && b.resumo && Number(b.resumo.estoque) === 0;
    const aviso = semEstoque
      ? `Restaurar o backup de ${data}?\n\nATENÇÃO: esse dia está SEM estoque. Seu estoque atual será mantido (não vai ser apagado). O resto (financeiro, cardápio…) volta pra esse dia.`
      : `Restaurar o backup de ${data}?\n\nISSO SUBSTITUI os dados atuais pelos desse dia. Use só se algo deu errado.`;
    if (typeof window !== 'undefined' && !window.confirm(aviso)) return;
    setRestaurando(data); setMsg('');
    try {
      const r = await fetch('/api/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'restaurar', data }) });
      const j = await r.json();
      if (j.ok) { setMsg('Backup restaurado! Recarregando…'); setTimeout(() => { try { window.location.reload(); } catch { /* ignora */ } }, 900); }
      else setMsg(j.erro || 'Não consegui restaurar.');
    } catch { setMsg('Sem conexão pra restaurar.'); }
    finally { setRestaurando(''); }
  };

  // Recuperar SÓ o estoque + fichas de um dia bom, sem mexer no financeiro/cardápio.
  const restaurarSoEstoque = async (data) => {
    if (typeof window !== 'undefined' && !window.confirm(`Recuperar o estoque do dia ${data}?\n\nIsso traz de volta o estoque e as fichas técnicas desse dia. O restante (financeiro, cardápio, clientes) NÃO muda.`)) return;
    setRestaurando(data); setMsg('');
    try {
      const r = await fetch('/api/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'restaurarEstoque', data }) });
      const j = await r.json();
      if (j.ok) { setMsg(`Estoque recuperado (${j.estoque} itens)! Recarregando…`); setTimeout(() => { try { window.location.reload(); } catch { /* ignora */ } }, 900); }
      else setMsg(j.erro || 'Não consegui recuperar o estoque.');
    } catch { setMsg('Sem conexão pra recuperar.'); }
    finally { setRestaurando(''); }
  };
  // O estoque de hoje está vazio? Então oferece recuperar do backup mais recente que tenha itens.
  const estoqueAtualVazio = Array.isArray(all.estoque) && all.estoque.length === 0;
  const melhorEstoque = autoBackups.filter((b) => b.resumo && Number(b.resumo.estoque) > 0).sort((a, b) => Number(b.resumo.estoque) - Number(a.resumo.estoque) || (b.data || '').localeCompare(a.data || ''))[0];

  const baixar = (conteudo, nome, tipo) => {
    const blob = new Blob([conteudo], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = nome; a.click();
    URL.revokeObjectURL(url); setMsg('Arquivo gerado. Verifique seus downloads.');
  };
  const q = (x) => `"${(x == null ? '' : String(x)).replace(/"/g, '""')}"`;
  const baixarCSV = () => {
    const L = [];
    L.push('=== RECEITAS ===', 'Data,Fonte,Descrição,Valor,Obs');
    all.receitas.forEach((r) => L.push([r.data, r.categoria, r.descricao, r.valor, r.obs].map(q).join(',')));
    L.push('', '=== DESPESAS ===', 'Data,Categoria,Descrição,Valor,Obs');
    all.despesas.forEach((r) => L.push([r.data, r.categoria, r.descricao, r.valor, r.obs].map(q).join(',')));
    L.push('', '=== COMPRAS ===', 'Data,Produto,Fornecedor,Qtd,ValorUnit,FormaPagto,Vencimento,Pago,DataPagamento');
    all.compras.forEach((r) => L.push([r.data, r.produto, r.fornecedor, r.quantidade, r.valorUnit, r.formaPagto, r.vencimento, r.pago, r.dataPagamento].map(q).join(',')));
    L.push('', '=== COTAÇÕES ===', 'Data,Produto,Fornecedor,Preço,Categoria');
    all.cotacoes.forEach((r) => L.push([r.data, r.produto, r.fornecedor, r.preco, r.categoria].map(q).join(',')));
    L.push('', '=== GARRAFAS ===', 'Produto,Volume(ml),Dose(ml),Abertura,Término,Drinks,Obs');
    all.garrafas.forEach((r) => L.push([r.produto, r.volume, r.dose, r.dataAbertura, r.dataTermino, r.drinks, r.obs].map(q).join(',')));
    L.push('', '=== DIÁRIO ===', 'Data,Clima,Evento,Receita,Pedidos,PedidosFiados,Nota,Problema,Decisão,Aprendizado,Prioridade');
    all.diario.forEach((r) => L.push([r.data, r.clima, r.evento, r.receita, r.nPedidos, r.fiado, r.nota, r.problema, r.decisao, r.aprendizado, r.prioridade].map(q).join(',')));
    baixar('\ufeff' + L.join('\n'), `pico-do-mane-${todayISO()}.csv`, 'text/csv;charset=utf-8');
  };
  const analise = useMemo(() => montarAnalise({ ...all, ponto, jornadas }, negocio || 'Meu negócio'), [all, ponto, jornadas, negocio]);
  const copiarAnalise = async () => {
    try { await navigator.clipboard.writeText(analise); setMsg('Resumo + dados copiados! Cole no chat com o Claude para análise.'); }
    catch { setMsg('Não consegui copiar automático. Abra "Ver resumo gerado" abaixo, selecione e copie.'); }
  };
  const importar = () => {
    try { restore(JSON.parse(importText)); setMsg('Dados restaurados com sucesso.'); setImportText(''); }
    catch { setMsg('JSON inválido. Cole exatamente o conteúdo de um backup.'); }
  };
  // Restaurar escolhendo o arquivo .json direto (sem precisar copiar e colar).
  const escolherArquivo = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const texto = String(reader.result || '');
      try {
        const dados = JSON.parse(texto);
        const n = ['diario', 'receitas', 'despesas', 'compras', 'cotacoes', 'garrafas']
          .reduce((s, k) => s + (Array.isArray(dados[k]) ? dados[k].length : 0), 0);
        setImportText(texto);
        setMsg(`Arquivo "${file.name}" carregado (${n} registros). Confira e clique em "Restaurar dados".`);
      } catch {
        setMsg('Esse arquivo não é um backup válido (JSON). Verifique se escolheu o arquivo certo.');
      }
    };
    reader.onerror = () => setMsg('Não consegui ler o arquivo. Tente de novo.');
    reader.readAsText(file);
    e.target.value = '';
  };
  const [confirmarRecarregar, setConfirmarRecarregar] = useState(false);
  const recarregarOriginais = () => {
    if (!confirmarRecarregar) { setConfirmarRecarregar(true); return; }
    try {
      if (!SEED_DATA || !SEED_DATA.diario) {
        setMsg('Erro: os dados originais não foram encontrados. Tente recarregar a página e tentar de novo.');
        setConfirmarRecarregar(false);
        return;
      }
      restore(SEED_DATA);
      setConfirmarRecarregar(false);
      setMsg('Dados originais das planilhas recarregados.');
    } catch (e) {
      setMsg('Erro ao recarregar: ' + (e && e.message ? e.message : String(e)));
      setConfirmarRecarregar(false);
    }
  };
  const total = all.diario.length + all.receitas.length + all.despesas.length + all.compras.length + all.cotacoes.length + all.garrafas.length;

  return (
    <div>
      <PageTitle sub="Salvar, restaurar e analisar seus dados">Backup</PageTitle>
      <Card style={{ marginBottom: 14, borderColor: C.accent }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.accent, fontWeight: 700, marginBottom: 6 }}>Sobre os dados carregados</div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginBottom: 12 }}>
          Este painel já veio populado com o que estava nas suas 3 planilhas (DRE, Cotação de Fornecedores e Diário do Gestor) de maio a julho/2026, transcrito exatamente como estava lá. Uma única exceção: no Diário do dia 05/07, os campos de texto (problema, decisão, aprendizado, prioridade e nota) vieram corrompidos no PDF exportado — o texto original ficou sobreposto e ilegível, então não preenchi para não inventar dado. Vale conferir e completar esse dia manualmente.
        </div>
        {!confirmarRecarregar ? (
          <Btn kind="ghost" small onClick={recarregarOriginais}>Recarregar dados originais das planilhas</Btn>
        ) : (
          <div>
            <div style={{ fontSize: 13, color: C.amber, marginBottom: 8, fontWeight: 600 }}>Isso substitui TUDO que está no painel agora pelos dados originais das planilhas. Confirma?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn kind="danger" small onClick={recarregarOriginais}>Sim, recarregar</Btn>
              <Btn kind="ghost" small onClick={() => setConfirmarRecarregar(false)}>Cancelar</Btn>
            </div>
          </div>
        )}
        {msg && <div style={{ marginTop: 10, fontSize: 13, color: msg.startsWith('Erro') ? C.red : C.accent }}>{msg}</div>}
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>Seus dados</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>Tudo é salvo automaticamente e continua aqui quando você voltar. Guarde um backup de vez em quando e use "Copiar" quando quiser que eu analise seus números.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <KPI titulo="Log Operacional" valor={all.diario.length} />
          <KPI titulo="Receitas" valor={all.receitas.length} />
          <KPI titulo="Despesas" valor={all.despesas.length} />
          <KPI titulo="Compras" valor={all.compras.length} />
          <KPI titulo="Cotações" valor={all.cotacoes.length} />
          <KPI titulo="Garrafas" valor={all.garrafas.length} />
        </div>
      </Card>

      <Card style={{ marginBottom: 14, borderColor: C.accent }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Para análise</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>
          <b style={{ color: C.text }}>É assim que eu enxergo teu bar.</b> Eu não fico ligado no PicoOS o tempo todo —
          este botão junta tudo numa mensagem só: resultado por mês, despesas por categoria, fornecedores, contas a
          pagar, o salão (o que mais vende, quanto sai por dia da semana, ticket médio), o estoque (quanto tem parado,
          o que está acabando) e a folha do mês. Copia e cola aqui no nosso chat — aí pode me perguntar qualquer coisa
          sobre o negócio que eu respondo com os teus números de verdade.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Btn onClick={copiarAnalise}>Copiar tudo pra mandar pro Claude</Btn>
          <Btn kind="ghost" onClick={() => baixar(analise, `pico-do-mane-analise-${todayISO()}.md`, 'text/markdown;charset=utf-8')}>Baixar relatório de análise (.md)</Btn>
        </div>
        {msg && <div style={{ marginTop: 12, fontSize: 13, color: msg.startsWith('Não') ? C.amber : C.accent }}>{msg}</div>}
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, color: C.muted, fontSize: 13 }}>Ver resumo gerado</summary>
          <textarea readOnly value={analise} style={{ ...inputStyle, marginTop: 10, height: 240, fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre' }} />
        </details>
      </Card>

      {estoqueAtualVazio && melhorEstoque && (
        <Card style={{ marginBottom: 14, borderColor: C.red }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.red, fontWeight: 700, marginBottom: 6 }}>Seu estoque está vazio</div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginBottom: 12 }}>
            Encontrei uma cópia de <b style={{ color: C.text }}>{fmtDate(melhorEstoque.data)}</b> com <b style={{ color: C.text }}>{melhorEstoque.resumo.estoque} itens de estoque</b> e {melhorEstoque.resumo.fichas} fichas técnicas. Posso trazer só o estoque de volta — o financeiro e o cardápio de agora <b>não mudam</b>.
          </div>
          <Btn kind="danger" onClick={() => restaurarSoEstoque(melhorEstoque.data)} disabled={!!restaurando}>
            {restaurando === melhorEstoque.data ? 'Recuperando…' : `Recuperar meu estoque (${melhorEstoque.resumo.estoque} itens)`}
          </Btn>
        </Card>
      )}

      <Card style={{ marginBottom: 14, borderColor: C.green }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Backup automático na nuvem ✓</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
          O PicoOS guarda uma cópia de tudo sozinho, todo dia que você abre o app (mantém os últimos 14 dias). Se algo der errado, dá pra voltar pra um dia anterior aqui.
        </div>
        {autoBackups.length === 0 ? (
          <div style={{ fontSize: 13, color: C.faint }}>Ainda sem cópias — a primeira é feita quando você abrir o app amanhã (ou recarregue agora).</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {autoBackups.map((b) => (
              <div key={b.data} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderTop: `1px solid ${C.hair}`, paddingTop: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{fmtDate(b.data)}</div>
                  {b.resumo && <div style={{ fontSize: 11, color: C.faint }}>{b.resumo.lancamentos} lançamentos · {b.resumo.estoque} itens de estoque · {b.resumo.fichas} fichas</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {b.resumo && Number(b.resumo.estoque) > 0 && (
                    <Btn kind="ghost" small onClick={() => restaurarSoEstoque(b.data)} disabled={!!restaurando}>{restaurando === b.data ? '…' : 'Só o estoque'}</Btn>
                  )}
                  <Btn kind="ghost" small onClick={() => restaurarAuto(b)} disabled={!!restaurando}>{restaurando === b.data ? 'Restaurando…' : 'Restaurar tudo'}</Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Backup e planilha</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Btn kind="ghost" onClick={() => baixar(jsonStr, `pico-do-mane-${todayISO()}.json`, 'application/json')}>Baixar backup completo (JSON)</Btn>
          <Btn kind="ghost" onClick={baixarCSV}>Baixar planilha (CSV para Excel/Sheets)</Btn>
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Restaurar backup</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>O jeito fácil: escolha o arquivo <b>.json</b> do backup. Atenção: substitui os dados atuais.</div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: C.accent, color: '#06101F', borderRadius: 10, padding: '11px 18px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          Escolher arquivo de backup
          <input type="file" accept=".json,application/json" onChange={escolherArquivo} style={{ display: 'none' }} />
        </label>
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, color: C.muted, fontWeight: 600 }}>Ou colar o conteúdo manualmente</summary>
          <div style={{ marginTop: 10 }}>
            <Area value={importText} onChange={setImportText} rows={4} placeholder='{ "diario": [...], "receitas": [...] }' />
          </div>
        </details>
        <div style={{ marginTop: 12 }}><Btn onClick={importar}>Restaurar dados</Btn></div>
      </Card>

      <details style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, color: C.muted }}>Ver dados brutos ({total} registros)</summary>
        <textarea readOnly value={jsonStr} style={{ ...inputStyle, marginTop: 12, height: 200, fontSize: 11, fontFamily: 'monospace' }} />
      </details>
    </div>
  );
}

