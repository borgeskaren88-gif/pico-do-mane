'use client';
import React, { useState, useMemo } from 'react';
import { C, Card } from './ui';
import { num, brl, todayISO, fmtDate, MESES } from '../lib/util';

const pad = (n) => String(n).padStart(2, '0');
const DIAS_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

// Calendário de fluxo de caixa: cruza as contas a pagar (abertas) com os dias de
// vencimento, pintando cada dia pela soma a pagar e resumindo por semana — pra
// ver de relance as semanas em que o dinheiro aperta.
export default function CalendarioFluxo({ contas }) {
  const hoje = todayISO();
  const [ref, setRef] = useState(hoje.slice(0, 7)); // 'YYYY-MM'

  const porDia = useMemo(() => {
    const m = {};
    for (const c of contas) {
      if (!c.vencimento) continue;
      m[c.vencimento] = (m[c.vencimento] || 0) + num(c.quantidade) * num(c.valorUnit);
    }
    return m;
  }, [contas]);

  const [ano, mes] = ref.split('-').map(Number); // mes 1-12
  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay(); // 0=Dom
  const diasNoMes = new Date(ano, mes, 0).getDate();

  const celulas = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let d = 1; d <= diasNoMes; d++) celulas.push(d);
  while (celulas.length % 7 !== 0) celulas.push(null);
  const semanas = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));

  const isoDe = (d) => `${ano}-${pad(mes)}-${pad(d)}`;
  const totalDia = (d) => (d ? (porDia[isoDe(d)] || 0) : 0);
  const maxDia = Math.max(1, ...celulas.map(totalDia));
  const totalSemana = (sem) => sem.reduce((s, d) => s + totalDia(d), 0);
  const maxSemana = Math.max(1, ...semanas.map(totalSemana));
  const totalMes = celulas.reduce((s, d) => s + totalDia(d), 0);

  const mudarMes = (delta) => {
    let a = ano, m = mes + delta;
    if (m < 1) { m = 12; a--; } else if (m > 12) { m = 1; a++; }
    setRef(`${a}-${pad(m)}`);
  };

  const compacto = (n) => (n >= 1000 ? (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k' : String(Math.round(n)));
  const corDia = (t) => (t <= 0 ? 'transparent' : `rgba(233,118,92,${(0.16 + 0.55 * (t / maxDia)).toFixed(2)})`);
  const btn = { background: 'transparent', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, fontWeight: 800, lineHeight: 1 };

  return (
    <Card style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 17, fontWeight: 800 }}>📅 Fluxo de caixa</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => mudarMes(-1)} style={btn} aria-label="Mês anterior">‹</button>
          <div style={{ minWidth: 96, textAlign: 'center', fontWeight: 700, fontSize: 14 }}>{MESES[mes - 1]}/{ano}</div>
          <button onClick={() => mudarMes(1)} style={btn} aria-label="Próximo mês">›</button>
        </div>
      </div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
        A pagar no mês: <b style={{ color: totalMes > 0 ? C.red : C.faint }}>{brl(totalMes)}</b> · quanto mais escuro o dia, mais pesa.
      </div>

      {/* Cabeçalho dos dias da semana */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {DIAS_CURTO.map((d) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, color: C.faint, textTransform: 'uppercase', letterSpacing: '.03em', fontWeight: 700 }}>{d}</div>
        ))}
      </div>

      {/* Grade do mês */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {celulas.map((d, i) => {
          if (!d) return <div key={i} />;
          const t = totalDia(d);
          const iso = isoDe(d);
          const ehHoje = iso === hoje;
          const vencido = t > 0 && iso < hoje;
          return (
            <div key={i} style={{
              aspectRatio: '1 / 1', borderRadius: 8, background: corDia(t),
              border: ehHoje ? `2px solid ${C.accent}` : vencido ? `1px solid ${C.red}` : `1px solid ${C.line}44`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 2, minWidth: 0,
            }}>
              <div style={{ fontSize: 11, color: ehHoje ? C.accent : C.muted, fontWeight: ehHoje ? 800 : 500, lineHeight: 1 }}>{d}</div>
              {t > 0 && <div style={{ fontSize: 9, fontWeight: 800, color: C.text, marginTop: 2, whiteSpace: 'nowrap' }}>{compacto(t)}</div>}
            </div>
          );
        })}
      </div>

      {/* Resumo por semana */}
      {totalMes > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em', color: C.muted, fontWeight: 700, marginBottom: 8 }}>Por semana</div>
          {semanas.map((sem, i) => {
            const t = totalSemana(sem);
            if (t <= 0) return null;
            const dias = sem.filter(Boolean);
            const ini = dias[0], fim = dias[dias.length - 1];
            const ratio = t / maxSemana;
            const cor = ratio > 0.66 ? C.red : ratio > 0.33 ? C.amber : C.green;
            return (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: C.muted }}>{pad(ini)}–{pad(fim)}/{pad(mes)}</span>
                  <b style={{ color: cor, fontVariantNumeric: 'tabular-nums' }}>{brl(t)}</b>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: `${C.line}55`, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(6, ratio * 100)}%`, height: '100%', background: cor, borderRadius: 999 }} />
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 12, color: C.faint, marginTop: 6, lineHeight: 1.4 }}>
            🟥 semana pesada · 🟧 média · 🟩 leve. As barras comparam as semanas entre si.
          </div>
        </div>
      )}

      {totalMes === 0 && (
        <div style={{ fontSize: 13, color: C.faint, textAlign: 'center', padding: '12px 0 2px' }}>Nenhuma conta a vencer neste mês. 🎉</div>
      )}
    </Card>
  );
}
