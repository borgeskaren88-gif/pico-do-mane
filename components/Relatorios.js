'use client';
import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, AreaChart, Area as AreaRecharts, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
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
import { brl, num, todayISO, ymOf, weekday, fmtDate, mesLabel, addDays, FONTES_RECEITA, CUSTO_VARIAVEL, DESPESA_OPERACIONAL, CATEGORIAS_DESPESA, CATEGORIAS_PRODUTO, DIAS, MESES } from '../lib/util';

export default function Relatorios({ diario, receitas, despesas, mes, setMes }) {
  const mesesDisp = [...new Set([...receitas, ...despesas].map((d) => ymOf(d.data)))].sort().reverse();
  const opts = mesesDisp.length ? mesesDisp : [ymOf(todayISO())];
  const recMes = receitas.filter((r) => ymOf(r.data) === mes);
  const despMes = despesas.filter((d) => ymOf(d.data) === mes);
  const totalRec = recMes.reduce((s, r) => s + num(r.valor), 0);
  const custoVar = despMes.filter((d) => CUSTO_VARIAVEL.includes(d.categoria)).reduce((s, d) => s + num(d.valor), 0);
  const despOp = despMes.filter((d) => DESPESA_OPERACIONAL.includes(d.categoria)).reduce((s, d) => s + num(d.valor), 0);
  const lucro = totalRec - custoVar - despOp;
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

  return (
    <div>
      <PageTitle sub="Resultado do mês">Relatórios</PageTitle>
      <div style={{ marginBottom: 14 }}><Label>Mês do relatório</Label><Select value={mes} onChange={setMes} options={opts} /></div>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', color: C.accent, fontWeight: 700, marginBottom: 12 }}>DRE — {mesLabel(mes)}</div>
        {[['Receita bruta', totalRec, C.green, false], ['(–) Custo variável', custoVar, C.red, false], ['(–) Despesas operacionais', despOp, C.red, false], ['(=) Lucro operacional', lucro, lucro >= 0 ? C.accent : C.red, true]].map(([nome, val, cor, bold]) => (
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

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Para onde foi o dinheiro</div>
        {porCategoria.length === 0 ? <Empty>Sem despesas neste mês.</Empty> :
          porCategoria.map(({ cat, val }) => (
            <div key={cat} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: C.text }}>{cat}</span>
                <span style={{ color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{brl(val)}</span>
              </div>
              <div style={{ height: 7, background: C.panel2, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: (val / maxCat * 100) + '%', height: '100%', background: CUSTO_VARIAVEL.includes(cat) ? C.red : C.accent, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: C.muted }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: C.red, borderRadius: 3, marginRight: 5 }} />Custo variável</span>
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

