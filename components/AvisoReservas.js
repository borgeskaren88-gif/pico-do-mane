'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { C } from './ui';
import { todayISO, addDays } from '../lib/util';

// O lembrete de mesa reservada, no alto da tela de QUEM ENTRA — dona, cozinha,
// atendimento e a própria pessoa das reservas. É a primeira coisa que se vê no
// login: hoje tem mesa guardada, e pra quantas pessoas.
//
// Mostra hoje e amanhã: a cozinha precisa do dia anterior pra comprar e
// preparar. Some sozinho quando não tem nada marcado.
const horaAgora = () => { try { return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }); } catch { return ''; } };

export default function AvisoReservas({ compacto = false }) {
  const [reservas, setReservas] = useState([]);
  const [carregado, setCarregado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/reservas', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) setReservas(Array.isArray(j.reservas) ? j.reservas : []);
    } catch { /* sem conexão: não mostra nada */ }
    finally { setCarregado(true); }
  }, []);
  useEffect(() => {
    carregar();
    // Volta a olhar quando a pessoa volta pro app — reserva nova entra sozinha.
    const aoVoltar = () => { if (!document.hidden) carregar(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [carregar]);

  const hoje = todayISO();
  const amanha = addDays(hoje, 1);
  const doDia = reservas.filter((r) => r.data === hoje);
  const doAmanha = reservas.filter((r) => r.data === amanha);
  // Mesa marcada pra daqui a alguns dias também precisa aparecer — senão a
  // reserva do dia 20 só existe pra quem a anotou, até o dia 19.
  const proximas = reservas
    .filter((r) => r.data > amanha)
    .sort((a, b) => `${a.data} ${a.hora || ''}`.localeCompare(`${b.data} ${b.hora || ''}`))
    .slice(0, 3);
  if (!carregado || (!doDia.length && !doAmanha.length && !proximas.length)) return null;

  const agora = horaAgora();
  const pessoasDe = (lista) => lista.reduce((s, r) => s + (Number(r.pessoas) || 1), 0);

  const Linha = ({ r, passou }) => (
    <div style={{ display: 'flex', gap: 9, alignItems: 'baseline', padding: '4px 0', opacity: passou ? 0.5 : 1 }}>
      <span style={{ fontSize: 13, fontWeight: 900, color: C.accent, fontVariantNumeric: 'tabular-nums', flexShrink: 0, minWidth: 42 }}>
        {r.hora || '—'}
      </span>
      <span style={{ minWidth: 0, fontSize: 13.5, color: C.text, lineHeight: 1.4 }}>
        <b>{r.nome}</b>
        <span style={{ color: C.muted }}> · {Number(r.pessoas) || 1} {(Number(r.pessoas) || 1) === 1 ? 'pessoa' : 'pessoas'}</span>
        {r.obs ? <span style={{ display: 'block', fontSize: 12, color: C.faint, lineHeight: 1.4 }}>{r.obs}</span> : null}
      </span>
    </div>
  );

  return (
    <div style={{
      background: `color-mix(in srgb, ${C.accent} 10%, ${C.panel})`,
      border: `1px solid color-mix(in srgb, ${C.accent} 45%, transparent)`,
      borderRadius: 14, padding: compacto ? '10px 12px' : '12px 14px', marginBottom: 12,
    }}>
      {doDia.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 900, color: C.accent, letterSpacing: '.05em', marginBottom: 6 }}>
            HOJE TEM MESA RESERVADA · {doDia.length} {doDia.length === 1 ? 'reserva' : 'reservas'} · {pessoasDe(doDia)} pessoas
          </div>
          {doDia.map((r) => <Linha key={r.id} r={r} passou={!!(r.hora && agora && r.hora < agora)} />)}
        </>
      )}
      {doAmanha.length > 0 && (
        <div style={doDia.length ? { marginTop: 9, paddingTop: 8, borderTop: `1px solid ${C.hair}` } : undefined}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: C.muted, letterSpacing: '.04em', marginBottom: 4 }}>
            AMANHÃ · {doAmanha.length} {doAmanha.length === 1 ? 'reserva' : 'reservas'} · {pessoasDe(doAmanha)} pessoas
          </div>
          {doAmanha.map((r) => <Linha key={r.id} r={r} />)}
        </div>
      )}
      {proximas.length > 0 && (
        <div style={(doDia.length || doAmanha.length) ? { marginTop: 9, paddingTop: 8, borderTop: `1px solid ${C.hair}` } : undefined}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: C.muted, letterSpacing: '.04em', marginBottom: 4 }}>
            {(doDia.length || doAmanha.length) ? 'DEPOIS' : 'PRÓXIMAS MESAS RESERVADAS'}
          </div>
          {proximas.map((r) => (
            <div key={r.id} style={{ display: 'flex', gap: 9, alignItems: 'baseline', padding: '3px 0' }}>
              <span style={{ fontSize: 12.5, fontWeight: 900, color: C.muted, fontVariantNumeric: 'tabular-nums', flexShrink: 0, minWidth: 78 }}>
                {r.data.slice(8, 10)}/{r.data.slice(5, 7)}{r.hora ? ` ${r.hora}` : ''}
              </span>
              <span style={{ minWidth: 0, fontSize: 13, color: C.muted, lineHeight: 1.4 }}>
                <b style={{ color: C.text }}>{r.nome}</b> · {Number(r.pessoas) || 1} {(Number(r.pessoas) || 1) === 1 ? 'pessoa' : 'pessoas'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
