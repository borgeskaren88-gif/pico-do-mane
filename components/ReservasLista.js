'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { C, Card, Empty } from './ui';
import { todayISO, addDays, fmtDate, weekday } from '../lib/util';

// A tela de reservas de quem trabalha no salão e na cozinha: só leitura, do
// jeito que interessa pra eles — por dia, na ordem da noite, com quantas
// pessoas e o recado que a Mari deixou.
//
// Quem anota é a Mari (ou a Karen). Aqui ninguém mexe: é pra saber o que vem.
export default function ReservasLista({ titulo = 'Mesas reservadas', sub = 'O que já está marcado. Quem anota é a Mari.' }) {
  const [reservas, setReservas] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/reservas', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) { setReservas(Array.isArray(j.reservas) ? j.reservas : []); setErro(''); }
      else setErro(j.erro || 'Erro ao carregar.');
    } catch { setErro('Sem conexão.'); }
    finally { setCarregado(true); }
  }, []);
  useEffect(() => {
    carregar();
    const aoVoltar = () => { if (!document.hidden) carregar(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [carregar]);

  const hoje = todayISO();
  // Só o que ainda vem (de hoje em diante) — o que já passou não ajuda ninguém.
  const dias = useMemo(() => {
    const m = new Map();
    for (const r of reservas) {
      if (!r || !r.data || r.data < hoje) continue;
      if (!m.has(r.data)) m.set(r.data, []);
      m.get(r.data).push(r);
    }
    for (const lista of m.values()) lista.sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [reservas, hoje]);

  const nomeDoDia = (d) => (d === hoje ? 'HOJE' : d === addDays(hoje, 1) ? 'AMANHÃ' : `${weekday(d).replace('-feira', '').toUpperCase()} · ${fmtDate(d)}`);

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 900, color: C.text }}>{titulo}</div>
      <div style={{ fontSize: 13, color: C.muted, marginTop: 3, marginBottom: 14, lineHeight: 1.45 }}>{sub}</div>

      {erro && <div style={{ fontSize: 13, color: C.red, marginBottom: 10 }}>{erro}</div>}

      {!carregado ? <Empty>Carregando…</Empty> : dias.length === 0 ? (
        <Empty>Nenhuma mesa reservada por enquanto.<br />Quando marcarem, aparece aqui.</Empty>
      ) : dias.map(([dia, lista]) => {
        const pessoas = lista.reduce((s, r) => s + (Number(r.pessoas) || 1), 0);
        const ehHoje = dia === hoje;
        return (
          <Card key={dia} style={{
            marginBottom: 10, padding: 14,
            borderColor: ehHoje ? C.green : C.cardBorder,
            background: ehHoje ? `color-mix(in srgb, ${C.green} 8%, ${C.panel})` : undefined,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 900, color: ehHoje ? C.green : C.accent, letterSpacing: '.05em' }}>{nomeDoDia(dia)}</span>
              <span style={{ fontSize: 12, color: C.faint, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {lista.length} {lista.length === 1 ? 'mesa' : 'mesas'} · {pessoas} pessoas
              </span>
            </div>
            {lista.map((r) => (
              <div key={r.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', borderTop: `1px solid ${C.hair}`, padding: '10px 0 9px' }}>
                <span style={{ fontSize: 16, fontWeight: 900, color: C.text, fontVariantNumeric: 'tabular-nums', flexShrink: 0, minWidth: 52 }}>{r.hora || '—'}</span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: C.text, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{r.nome}</span>
                  <span style={{ display: 'block', fontSize: 13, color: C.muted, marginTop: 2 }}>
                    {Number(r.pessoas) || 1} {(Number(r.pessoas) || 1) === 1 ? 'pessoa' : 'pessoas'}
                  </span>
                  {r.obs ? (
                    <span style={{ display: 'block', fontSize: 13, color: C.amber, marginTop: 5, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{r.obs}</span>
                  ) : null}
                </span>
              </div>
            ))}
          </Card>
        );
      })}
    </div>
  );
}
