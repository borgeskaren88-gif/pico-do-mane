'use client';
import React, { useState, useMemo } from 'react';
import { C, Card } from './ui';
import { num, todayISO, fmtDate, MESES } from '../lib/util';

const pad = (n) => String(n).padStart(2, '0');
const DIAS_CURTO = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

// Calendário de pedidos: pinta cada dia pela quantidade de pedidos daquele dia
// (puxada do Diário), pra ver de relance os melhores dias — quanto mais azul
// forte, mais pedidos. Destaca o melhor dia do mês.
export default function CalendarioPedidos({ dados }) {
  const hoje = todayISO();
  const [ref, setRef] = useState(hoje.slice(0, 7)); // 'YYYY-MM'

  const porDia = useMemo(() => {
    const m = {};
    for (const d of dados) {
      if (!d.data) continue;
      const p = num(d.nPedidos);
      if (p > 0) m[d.data] = p;
    }
    return m;
  }, [dados]);

  const [ano, mes] = ref.split('-').map(Number);
  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay();
  const diasNoMes = new Date(ano, mes, 0).getDate();

  const celulas = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let d = 1; d <= diasNoMes; d++) celulas.push(d);
  while (celulas.length % 7 !== 0) celulas.push(null);

  const isoDe = (d) => `${ano}-${pad(mes)}-${pad(d)}`;
  const pedidosDe = (d) => (d ? (porDia[isoDe(d)] || 0) : 0);
  const maxDia = Math.max(1, ...celulas.map(pedidosDe));
  const totalMes = celulas.reduce((s, d) => s + pedidosDe(d), 0);
  const diasComReg = celulas.filter((d) => pedidosDe(d) > 0).length;

  // Melhor dia do mês (mais pedidos)
  let melhorDia = 0, melhorPed = 0;
  for (const d of celulas) { if (pedidosDe(d) > melhorPed) { melhorPed = pedidosDe(d); melhorDia = d; } }

  const mudarMes = (delta) => {
    let a = ano, m = mes + delta;
    if (m < 1) { m = 12; a--; } else if (m > 12) { m = 1; a++; }
    setRef(`${a}-${pad(m)}`);
  };

  // Azul mais forte = mais pedidos (melhores dias). Usa a cor de acento do tema.
  const corDia = (t) => (t <= 0 ? 'transparent' : `color-mix(in srgb, ${C.accent} ${Math.round(16 + 60 * (t / maxDia))}%, transparent)`);
  const btn = { background: 'transparent', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 8, width: 28, height: 28, cursor: 'pointer', fontSize: 15, fontWeight: 800, lineHeight: 1 };

  return (
    <Card style={{ padding: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>Pedidos por dia</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <button onClick={() => mudarMes(-1)} style={btn} aria-label="Mês anterior">‹</button>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{MESES[mes - 1]}/{ano}</div>
        <button onClick={() => mudarMes(1)} style={btn} aria-label="Próximo mês">›</button>
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
        Quanto mais azul, mais pedidos.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
        {DIAS_CURTO.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 9, color: C.faint, fontWeight: 700 }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {celulas.map((d, i) => {
          if (!d) return <div key={i} />;
          const t = pedidosDe(d);
          const iso = isoDe(d);
          const ehHoje = iso === hoje;
          const ehMelhor = d === melhorDia && melhorPed > 0;
          return (
            <div key={i} style={{
              aspectRatio: '1 / 1', borderRadius: 6, background: corDia(t),
              border: ehMelhor ? `2px solid ${C.accent}` : ehHoje ? `2px solid ${C.accent2}` : `1px solid ${C.hair}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 0, padding: 1,
            }}>
              <div style={{ fontSize: 8, color: ehHoje ? C.accent : C.faint, fontWeight: ehHoje ? 800 : 500, lineHeight: 1 }}>{d}</div>
              {t > 0 && <div style={{ fontSize: 11, fontWeight: 800, color: C.text, lineHeight: 1.1 }}>{t}</div>}
            </div>
          );
        })}
      </div>

      {melhorPed > 0 ? (
        <div style={{ fontSize: 12, color: C.muted, marginTop: 10, lineHeight: 1.4 }}>
          Melhor dia: <b style={{ color: C.accent }}>{fmtDate(isoDe(melhorDia))}</b> com <b style={{ color: C.text }}>{melhorPed} pedidos</b>.
          <span style={{ color: C.faint }}> {diasComReg} dia(s) · {totalMes} pedidos no mês.</span>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: C.faint, marginTop: 10, textAlign: 'center' }}>Sem pedidos registrados neste mês.</div>
      )}
    </Card>
  );
}
