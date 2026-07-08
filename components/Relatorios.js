'use client';
import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { C, Card, Btn, KPI, Field, TextInput, NumInput, Select, Area, Empty, Resumo, SecTitle, inputStyle, Label } from './ui';
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
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolucao} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: C.muted, fontSize: 12 }} axisLine={{ stroke: C.line }} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => 'R$' + (v / 1000).toFixed(0) + 'k'} />
                <Tooltip formatter={(v) => brl(v)} contentStyle={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, color: C.text }} labelStyle={{ color: C.text }} />
                <Bar dataKey="receita" fill={C.green} radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesa" fill={C.red} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {evolucao.length > 1 && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Lucro por mês</div>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucao} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: C.muted, fontSize: 12 }} axisLine={{ stroke: C.line }} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => (v / 1000).toFixed(0) + 'k'} />
                <Tooltip formatter={(v) => brl(v)} contentStyle={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, color: C.text }} />
                <Line type="monotone" dataKey="lucro" stroke={C.accent} strokeWidth={3} dot={{ fill: C.accent, r: 4 }} />
              </LineChart>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <KPI titulo="Nota média do mês" valor={notaMedia.toFixed(1)} cor={C.accent} sub={`${diarioMes.length} dias`} />
          <KPI titulo="Pedidos fiados no mês" valor={fiadoMes} cor={C.accent2} />
        </div>
      )}
    </div>
  );
}

