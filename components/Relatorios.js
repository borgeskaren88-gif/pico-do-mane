'use client';
import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, AreaChart, Area as AreaRecharts, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import { C, Card, Btn, KPI, Field, TextInput, NumInput, Select, Area, Empty, Resumo, SecTitle, PageTitle, inputStyle, Label } from './ui';

// Medidor (gauge) semicircular de leque, em azul — usado na nota média do mês.
function Medidor({ valor = 0, max = 10 }) {
  const N = 34;
  const frac = Math.max(0, Math.min(1, valor / max));
  const cx = 100, cy = 96, r1 = 56, r2 = 84;
  const ticks = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const ang = Math.PI - t * Math.PI;
    const x1 = cx + r1 * Math.cos(ang), y1 = cy - r1 * Math.sin(ang);
    const x2 = cx + r2 * Math.cos(ang), y2 = cy - r2 * Math.sin(ang);
    const on = t <= frac + 1e-9;
    ticks.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={on ? 'url(#medGrad)' : C.hair} strokeWidth={3.4} strokeLinecap="round" />);
  }
  return (
    <svg viewBox="0 0 200 116" width="100%" style={{ maxWidth: 250, display: 'block', margin: '0 auto' }} aria-hidden="true">
      <defs>
        <linearGradient id="medGrad" gradientUnits="userSpaceOnUse" x1="20" y1="0" x2="180" y2="0">
          <stop offset="0" stopColor={C.accent2} />
          <stop offset="1" stopColor={C.accent} />
        </linearGradient>
      </defs>
      {ticks}
      <text x="100" y="94" textAnchor="middle" fontSize="36" fontWeight="800" fill={C.text} fontFamily="system-ui, -apple-system, sans-serif">{valor.toFixed(1)}</text>
      <text x="100" y="111" textAnchor="middle" fontSize="12" fontWeight="600" fill={C.faint} fontFamily="system-ui, -apple-system, sans-serif">de {max}</text>
    </svg>
  );
}

const tooltipModerno = { background: C.panel, border: `1px solid ${C.cardBorder}`, borderRadius: 12, color: C.text, boxShadow: C.cardShadow, fontSize: 12, padding: '8px 12px' };
// Tons dos graficos: verde suave pra receita, dourado quente pra despesa.
const CHART_RECEITA = '#4FC79B';
const CHART_DESPESA = '#ECB24A';
// Paleta da pizza (rosca) de despesas: azuis, verde, dourado, tons modernos.
const PIZZA = ['#2F6BF0', '#4FC79B', '#ECB24A', '#7AA6F5', '#5BC8C2', '#C88BEA', '#F2A65A', '#9FB4D8'];

// Pilula de crescimento: seta + % comparando com o mês anterior.
function Delta({ atual, anterior, boaSubida = true }) {
  if (!(anterior > 0) && !(atual > 0)) return <span style={{ fontSize: 11, color: C.faint }}>—</span>;
  const pct = anterior > 0 ? ((atual - anterior) / anterior) * 100 : 100;
  const subiu = pct >= 0;
  const bom = subiu === boaSubida;
  const cor = Math.abs(pct) < 0.05 ? C.faint : bom ? C.green : C.red;
  return (
    <span style={{ fontSize: 11, fontWeight: 800, color: cor, whiteSpace: 'nowrap' }}>
      {subiu ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}
import { brl, num, todayISO, ymOf, weekday, fmtDate, mesLabel, addDays, FONTES_RECEITA, FONTES_NAO_OPERACIONAL, CUSTO_VARIAVEL, DESPESA_OPERACIONAL, DESPESA_NAO_OPERACIONAL, CATEGORIAS_DESPESA, CATEGORIAS_PRODUTO, DIAS, MESES } from '../lib/util';

export default function Relatorios({ diario, receitas, despesas, mes, setMes }) {
  const mesesDisp = [...new Set([...receitas, ...despesas].map((d) => ymOf(d.data)))].sort().reverse();
  const opts = mesesDisp.length ? mesesDisp : [ymOf(todayISO())];
  const recMes = receitas.filter((r) => ymOf(r.data) === mes);
  const despMes = despesas.filter((d) => ymOf(d.data) === mes);
  // O lucro OPERACIONAL usa só a operação: exclui investimento, empréstimo/dívida
  // e aporte (movem caixa, mas não são resultado da operação). Dentro do
  // operacional, subtrai TODAS as despesas (inclusive categoria em branco).
  const recOp = recMes.filter((r) => !FONTES_NAO_OPERACIONAL.includes(r.categoria));
  const despOpAll = despMes.filter((d) => !DESPESA_NAO_OPERACIONAL.includes(d.categoria));
  const totalRec = recOp.reduce((s, r) => s + num(r.valor), 0);
  const custoVar = despOpAll.filter((d) => CUSTO_VARIAVEL.includes(d.categoria)).reduce((s, d) => s + num(d.valor), 0);
  const despOp = despOpAll.filter((d) => DESPESA_OPERACIONAL.includes(d.categoria)).reduce((s, d) => s + num(d.valor), 0);
  const totalDespMes = despOpAll.reduce((s, d) => s + num(d.valor), 0);
  const despOutras = Math.round((totalDespMes - custoVar - despOp) * 100) / 100;
  const lucro = totalRec - totalDespMes;
  // Fora do lucro (só movimenta o caixa): aporte/empréstimo recebido, investimento
  // e pagamento de dívida/empréstimo.
  const entradaNaoOp = recMes.filter((r) => FONTES_NAO_OPERACIONAL.includes(r.categoria)).reduce((s, r) => s + num(r.valor), 0);
  const investimento = despMes.filter((d) => d.categoria === 'Investimento').reduce((s, d) => s + num(d.valor), 0);
  const dividaPaga = despMes.filter((d) => d.categoria === 'Empréstimo/Dívida').reduce((s, d) => s + num(d.valor), 0);
  // O que de fato sobrou no caixa depois de TUDO: lucro da operação + o que
  // entrou de aporte/empréstimo − o que saiu de investimento e pagamento de dívida.
  const resultadoFinal = Math.round((lucro + entradaNaoOp - investimento - dividaPaga) * 100) / 100;
  const margem = totalRec ? (lucro / totalRec) * 100 : 0;

  const evolucao = useMemo(() => {
    const map = {};
    receitas.forEach((r) => { const m = ymOf(r.data); (map[m] = map[m] || { rec: 0, desp: 0 }).rec += num(r.valor); });
    despesas.forEach((d) => { const m = ymOf(d.data); (map[m] = map[m] || { rec: 0, desp: 0 }).desp += num(d.valor); });
    return Object.entries(map).sort().slice(-6).map(([m, v]) => ({ mes: MESES[parseInt(m.slice(5)) - 1] || m, receita: v.rec, despesa: v.desp, lucro: v.rec - v.desp }));
  }, [receitas, despesas]);

  const porCategoria = useMemo(() => {
    const map = {};
    despMes.forEach((d) => { map[d.categoria] = (map[d.categoria] || 0) + num(d.valor); });
    return Object.entries(map).map(([cat, val]) => ({ cat, val })).sort((a, b) => b.val - a.val);
  }, [despMes]);

  const diarioMes = diario.filter((d) => ymOf(d.data) === mes);
  const notas = diarioMes.map((d) => num(d.nota)).filter((n) => n > 0);
  const notaMedia = notas.length ? (notas.reduce((a, b) => a + b, 0) / notas.length) : 0;
  const fiadoMes = diarioMes.reduce((s, d) => s + num(d.fiado), 0);
  const maxCat = porCategoria[0]?.val || 1;

  // Mês anterior, pra comparar crescimento.
  const prevMes = useMemo(() => {
    const y = parseInt(mes.slice(0, 4)), m = parseInt(mes.slice(5));
    const dt = new Date(y, m - 2, 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  }, [mes]);
  const resumoDe = (ym) => {
    const r = receitas.filter((x) => ymOf(x.data) === ym && !FONTES_NAO_OPERACIONAL.includes(x.categoria)).reduce((s, x) => s + num(x.valor), 0);
    const dd = despesas.filter((x) => ymOf(x.data) === ym && !DESPESA_NAO_OPERACIONAL.includes(x.categoria));
    const totalDD = dd.reduce((s, x) => s + num(x.valor), 0);
    return { rec: r, desp: totalDD, lucro: r - totalDD };
  };
  const prev = useMemo(() => resumoDe(prevMes), [prevMes, receitas, despesas]);

  // Padrão por dia da semana (Dom..Sáb): total de receita e despesa no mês.
  const porDiaSemana = useMemo(() => {
    const base = DIAS.map((d) => ({ dia: d, receita: 0, despesa: 0 }));
    recMes.forEach((r) => { const wd = new Date(r.data + 'T12:00:00').getDay(); if (base[wd]) base[wd].receita += num(r.valor); });
    despMes.forEach((d) => { const wd = new Date(d.data + 'T12:00:00').getDay(); if (base[wd]) base[wd].despesa += num(d.valor); });
    return base;
  }, [recMes, despMes]);
  const melhorDiaVenda = porDiaSemana.reduce((a, b) => (b.receita > a.receita ? b : a), porDiaSemana[0]);
  const temPadraoSemana = porDiaSemana.some((d) => d.receita > 0 || d.despesa > 0);

  // Pizza de despesas por categoria (com %).
  const totalDesp = porCategoria.reduce((s, c) => s + c.val, 0);
  const pizza = porCategoria.map((c, i) => ({ ...c, cor: PIZZA[i % PIZZA.length], pct: totalDesp ? (c.val / totalDesp) * 100 : 0 }));

  return (
    <div>
      <PageTitle sub="Resultado do mês">Relatórios</PageTitle>
      <div style={{ marginBottom: 14 }}><Label>Mês do relatório</Label><Select value={mes} onChange={setMes} options={opts} /></div>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: C.muted, fontWeight: 700, marginBottom: 4 }}>Crescimento</div>
        <div style={{ fontSize: 12, color: C.faint, marginBottom: 12 }}>Comparado com {mesLabel(prevMes)}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[['Receita', totalRec, prev.rec, C.green, true], ['Despesa', totalDespMes, prev.desp, C.amber, false], ['Lucro', lucro, prev.lucro, lucro >= 0 ? C.accent : C.red, true]].map(([nome, atual, ant, cor, boa]) => (
            <div key={nome} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: C.panel2, borderRadius: 12, padding: '11px 14px' }}>
              <span style={{ fontSize: 13, color: C.muted, fontWeight: 600, flexShrink: 0 }}>{nome}</span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, minWidth: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: cor, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{brl(atual)}</span>
                <span style={{ minWidth: 48, textAlign: 'right', flexShrink: 0 }}><Delta atual={atual} anterior={ant} boaSubida={boa} /></span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', color: C.accent, fontWeight: 700, marginBottom: 12 }}>DRE — {mesLabel(mes)}</div>
        {[['Receita bruta', totalRec, C.green, false], ['(–) Custo variável', custoVar, C.amber, false], ['(–) Despesas operacionais', despOp, C.amber, false], ...(despOutras > 0.005 ? [['(–) Outras despesas', despOutras, C.amber, false]] : []), ['(=) Lucro operacional', lucro, lucro >= 0 ? C.accent : C.red, true]].map(([nome, val, cor, bold]) => (
          <div key={nome} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderTop: bold ? `1px solid ${C.line}` : 'none' }}>
            <span style={{ fontWeight: bold ? 800 : 500, color: bold ? C.text : C.muted }}>{nome}</span>
            <span style={{ fontWeight: bold ? 800 : 600, color: cor, fontVariantNumeric: 'tabular-nums' }}>{brl(val)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
          <span style={{ color: C.muted }}>Margem operacional</span>
          <span style={{ fontWeight: 800, color: margem >= 0 ? C.accent : C.red }}>{margem.toFixed(1)}%</span>
        </div>
      </Card>

      {(entradaNaoOp > 0.005 || investimento > 0.005 || dividaPaga > 0.005) && (
        <Card style={{ marginBottom: 14, background: C.panel2 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: C.muted, fontWeight: 700, marginBottom: 4 }}>Fora do lucro (não é operação)</div>
          <div style={{ fontSize: 12, color: C.faint, marginBottom: 10, lineHeight: 1.45 }}>Movimenta o caixa, mas <b style={{ color: C.text }}>não</b> entra no lucro operacional acima — pra o resultado da operação ficar limpo.</div>
          {[['Empréstimo/aporte que entrou', entradaNaoOp, C.green], ['Investimento (equipamento/reforma)', investimento, C.amber], ['Empréstimo/dívida que você pagou', dividaPaga, C.amber]].filter(([, v]) => v > 0.005).map(([nome, val, cor]) => (
            <div key={nome} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: `1px solid ${C.line}`, fontSize: 14 }}>
              <span style={{ color: C.muted, minWidth: 0 }}>{nome}</span>
              <span style={{ fontWeight: 700, color: cor, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl(val)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, paddingTop: 10, marginTop: 6, borderTop: `2px solid ${C.line}` }}>
            <span style={{ fontWeight: 800, color: C.text }}>Resultado do mês (o que sobrou)</span>
            <span style={{ fontWeight: 900, fontSize: 18, color: resultadoFinal >= 0 ? C.accent : C.red, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl(resultadoFinal)}</span>
          </div>
          <div style={{ fontSize: 11, color: C.faint, marginTop: 6, lineHeight: 1.45 }}>
            Lucro operacional {brl(lucro)}{entradaNaoOp > 0.005 ? ` + aporte ${brl(entradaNaoOp)}` : ''}{investimento > 0.005 ? ` − investimento ${brl(investimento)}` : ''}{dividaPaga > 0.005 ? ` − dívida ${brl(dividaPaga)}` : ''} = o que <b style={{ color: C.text }}>de fato sobrou no caixa</b> depois de tudo.
          </div>
        </Card>
      )}

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Evolução (receita × despesa)</div>
        {evolucao.length === 0 ? <Empty>Sem dados suficientes.</Empty> : (
          <>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolucao} margin={{ top: 8, right: 4, left: -14, bottom: 0 }} barGap={5} barCategoryGap="26%">
                <defs>
                  <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_RECEITA} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={CHART_RECEITA} stopOpacity={0.5} />
                  </linearGradient>
                  <linearGradient id="gDesp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_DESPESA} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={CHART_DESPESA} stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 7" stroke={C.hair} vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: C.muted, fontSize: 12 }} axisLine={false} tickLine={false} dy={6} />
                <YAxis tick={{ fill: C.faint, fontSize: 11 }} axisLine={false} tickLine={false} width={46} tickFormatter={(v) => 'R$' + (v / 1000).toFixed(0) + 'k'} />
                <Tooltip cursor={{ fill: 'rgba(120,150,200,0.10)', radius: 8 }} formatter={(v) => brl(v)} contentStyle={tooltipModerno} labelStyle={{ color: C.muted, fontWeight: 700, marginBottom: 2 }} />
                <Bar dataKey="receita" fill="url(#gRec)" radius={[6, 6, 0, 0]} maxBarSize={26} />
                <Bar dataKey="despesa" fill="url(#gDesp)" radius={[6, 6, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 10, fontSize: 12, color: C.muted }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: CHART_RECEITA }} />Receita</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: CHART_DESPESA }} />Despesa</span>
          </div>
          </>
        )}
      </Card>

      {evolucao.length > 1 && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Lucro por mês</div>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolucao} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="gLucro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.accent} stopOpacity={0.32} />
                    <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 7" stroke={C.hair} vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: C.muted, fontSize: 12 }} axisLine={false} tickLine={false} dy={6} />
                <YAxis tick={{ fill: C.faint, fontSize: 11 }} axisLine={false} tickLine={false} width={46} tickFormatter={(v) => (v / 1000).toFixed(0) + 'k'} />
                <Tooltip formatter={(v) => brl(v)} contentStyle={tooltipModerno} labelStyle={{ color: C.muted, fontWeight: 700, marginBottom: 2 }} />
                <AreaRecharts type="monotone" dataKey="lucro" stroke={C.accent} strokeWidth={3} fill="url(#gLucro)" dot={{ fill: C.accent, r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {temPadraoSemana && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>Padrão por dia da semana</div>
          <div style={{ fontSize: 12, color: C.faint, marginBottom: 12 }}>Total de {mesLabel(mes)} — que dia vende e gasta mais</div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porDiaSemana} margin={{ top: 8, right: 4, left: -14, bottom: 0 }} barGap={3} barCategoryGap="22%">
                <defs>
                  <linearGradient id="gRecDia" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_RECEITA} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={CHART_RECEITA} stopOpacity={0.5} />
                  </linearGradient>
                  <linearGradient id="gDespDia" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_DESPESA} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={CHART_DESPESA} stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 7" stroke={C.hair} vertical={false} />
                <XAxis dataKey="dia" tick={{ fill: C.muted, fontSize: 12 }} axisLine={false} tickLine={false} dy={6} />
                <YAxis tick={{ fill: C.faint, fontSize: 11 }} axisLine={false} tickLine={false} width={46} tickFormatter={(v) => 'R$' + (v / 1000).toFixed(0) + 'k'} />
                <Tooltip cursor={{ fill: 'rgba(120,150,200,0.10)', radius: 8 }} formatter={(v) => brl(v)} contentStyle={tooltipModerno} labelStyle={{ color: C.muted, fontWeight: 700, marginBottom: 2 }} />
                <Bar dataKey="receita" fill="url(#gRecDia)" radius={[6, 6, 0, 0]} maxBarSize={22} />
                <Bar dataKey="despesa" fill="url(#gDespDia)" radius={[6, 6, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 10, fontSize: 12, color: C.muted, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: CHART_RECEITA }} />Receita</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: CHART_DESPESA }} />Despesa</span>
          </div>
          {melhorDiaVenda && melhorDiaVenda.receita > 0 && (
            <div style={{ fontSize: 13, color: C.text, marginTop: 12, background: C.panel2, borderRadius: 10, padding: '10px 12px' }}>
              Seu melhor dia de venda é <b style={{ color: C.green }}>{melhorDiaVenda.dia}</b> — {brl(melhorDiaVenda.receita)} no mês.
            </div>
          )}
        </Card>
      )}

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Para onde foi o dinheiro</div>
        {pizza.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 16 }}>
            <div style={{ position: 'relative', width: 172, height: 172, flexShrink: 0, margin: '0 auto' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pizza} dataKey="val" nameKey="cat" cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={2} stroke="none">
                    {pizza.map((p) => <Cell key={p.cat} fill={p.cor} />)}
                  </Pie>
                  <Tooltip formatter={(v) => brl(v)} contentStyle={tooltipModerno} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div style={{ fontSize: 11, color: C.faint, fontWeight: 600 }}>Total</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{brl(totalDesp)}</div>
              </div>
            </div>
            <div style={{ flex: '1 1 160px', minWidth: 0 }}>
              {pizza.map((p) => (
                <div key={p.cat} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: p.cor, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.cat}</span>
                  <span style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>{p.pct.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {porCategoria.length === 0 ? <Empty>Sem despesas neste mês.</Empty> :
          porCategoria.map(({ cat, val }) => (
            <div key={cat} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: C.text }}>{cat}</span>
                <span style={{ color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{brl(val)}</span>
              </div>
              <div style={{ height: 7, background: C.panel2, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: (val / maxCat * 100) + '%', height: '100%', background: CUSTO_VARIAVEL.includes(cat) ? C.amber : C.accent, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: C.muted }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: C.amber, borderRadius: 3, marginRight: 5 }} />Custo variável</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: C.accent, borderRadius: 3, marginRight: 5 }} />Despesa operacional</span>
        </div>
      </Card>

      {diarioMes.length > 0 && (
        <>
          {notas.length > 0 && (
            <Card style={{ marginBottom: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: C.muted, fontWeight: 700, marginBottom: 6 }}>Nota média do mês</div>
              <Medidor valor={notaMedia} />
              <div style={{ fontSize: 14, fontWeight: 700, color: C.accent, marginTop: 2 }}>
                {notaMedia >= 8 ? 'Ótima' : notaMedia >= 6 ? 'Boa' : notaMedia >= 4 ? 'Regular' : 'Precisa melhorar'}
                <span style={{ color: C.faint, fontWeight: 500 }}> · {notas.length} dia(s) avaliado(s)</span>
              </div>
            </Card>
          )}
          <KPI titulo="Pedidos fiados no mês" valor={fiadoMes} cor={C.accent2} />
        </>
      )}
    </div>
  );
}

