'use client';
import React, { useState } from 'react';
import { C, Card, Btn, KPI, Area, inputStyle } from './ui';
import { todayISO, num, brl, ymOf, mesLabel, weekday, DIAS, CUSTO_VARIAVEL, DESPESA_OPERACIONAL } from '../lib/util';
import SEED_DATA from '../data/seed.json';

// Monta um relatório em texto (Markdown) para análise: um RESUMO com os
// números já calculados + os DADOS COMPLETOS organizados por seção. Bem mais
// útil pra analisar do que o JSON cru.
function montarAnalise(all) {
  const L = [];
  const pct = (n, d) => (d ? (n / d * 100).toFixed(1).replace('.', ',') + '%' : '—');
  const soma = (arr, campo = 'valor') => arr.reduce((s, x) => s + num(x[campo]), 0);
  const totalCompra = (c) => num(c.quantidade) * num(c.valorUnit);
  const hoje = todayISO();

  const recTotal = soma(all.receitas);
  const despTotal = soma(all.despesas);
  const lucroTotal = recTotal - despTotal;
  const meses = [...new Set([...all.receitas, ...all.despesas].map((x) => ymOf(x.data)).filter(Boolean))].sort();

  L.push('# Pico do Mané — Dados para análise');
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
  for (const c of all.compras) fMap.set(c.fornecedor || 'Sem fornecedor', (fMap.get(c.fornecedor || 'Sem fornecedor') || 0) + totalCompra(c));
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
  secao('Diário', porData(all.diario), (d) => clean([
    d.data, d.clima, d.evento && `evento: ${d.evento}`, d.receita && `receita ${d.receita}`,
    d.nPedidos && `${d.nPedidos} pedidos`, d.fiado && `${d.fiado} fiado`, d.nota && `nota ${d.nota}`,
    d.problema, d.decisao, d.aprendizado, d.prioridade,
  ]));

  return L.join('\n');
}

export default function Backup({ all, restore }) {
  const [msg, setMsg] = useState('');
  const [importText, setImportText] = useState('');
  const jsonStr = JSON.stringify(all, null, 2);
  const analise = montarAnalise(all);

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
  const copiarAnalise = async () => {
    try { await navigator.clipboard.writeText(analise); setMsg('Resumo + dados copiados! Cole no chat com o Claude para análise.'); }
    catch { setMsg('Não consegui copiar automático. Abra "Ver resumo gerado" abaixo, selecione e copie.'); }
  };
  const importar = () => {
    try { restore(JSON.parse(importText)); setMsg('Dados restaurados com sucesso.'); setImportText(''); }
    catch { setMsg('JSON inválido. Cole exatamente o conteúdo de um backup.'); }
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
      <Card style={{ marginBottom: 14, borderColor: C.accent }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.accent, fontWeight: 700, marginBottom: 6 }}>Sobre os dados carregados</div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginBottom: 12 }}>
          Este painel já veio populado com o que estava nas suas 3 planilhas (DRE, Cotação de Fornecedores e Diário do Gestor) de maio a julho/2026, transcrito exatamente como estava lá. Uma única exceção: no Diário do dia 05/07, os campos de texto (problema, decisão, aprendizado, prioridade e nota) vieram corrompidos no PDF exportado — o texto original ficou sobreposto e ilegível, então não preenchi para não inventar dado. Vale conferir e completar esse dia manualmente.
        </div>
        {!confirmarRecarregar ? (
          <Btn kind="ghost" small onClick={recarregarOriginais}>↺ Recarregar dados originais das planilhas</Btn>
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
          <KPI titulo="Diário" valor={all.diario.length} />
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
          Gera um relatório com os números já calculados (receita, despesa, lucro e margem por mês, despesas por categoria, maiores fornecedores, contas a pagar e receita por dia da semana) seguido dos dados completos organizados. É só copiar e colar no chat comigo.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Btn onClick={copiarAnalise}>📋 Copiar resumo + dados para análise</Btn>
          <Btn kind="ghost" onClick={() => baixar(analise, `pico-do-mane-analise-${todayISO()}.md`, 'text/markdown;charset=utf-8')}>⬇ Baixar relatório de análise (.md)</Btn>
        </div>
        {msg && <div style={{ marginTop: 12, fontSize: 13, color: msg.startsWith('Não') ? C.amber : C.accent }}>{msg}</div>}
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, color: C.muted, fontSize: 13 }}>Ver resumo gerado</summary>
          <textarea readOnly value={analise} style={{ ...inputStyle, marginTop: 10, height: 240, fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre' }} />
        </details>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Backup e planilha</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Btn kind="ghost" onClick={() => baixar(jsonStr, `pico-do-mane-${todayISO()}.json`, 'application/json')}>⬇ Baixar backup completo (JSON)</Btn>
          <Btn kind="ghost" onClick={baixarCSV}>⬇ Baixar planilha (CSV para Excel/Sheets)</Btn>
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Restaurar backup</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>Cole o conteúdo de um backup JSON. Atenção: substitui os dados atuais.</div>
        <Area value={importText} onChange={setImportText} rows={4} placeholder='{ "diario": [...], "receitas": [...] }' />
        <div style={{ marginTop: 10 }}><Btn kind="ghost" onClick={importar}>Restaurar dados</Btn></div>
      </Card>

      <details style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, color: C.muted }}>Ver dados brutos ({total} registros)</summary>
        <textarea readOnly value={jsonStr} style={{ ...inputStyle, marginTop: 12, height: 200, fontSize: 11, fontFamily: 'monospace' }} />
      </details>
    </div>
  );
}

