'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { C, Card, Btn, Empty, SecTitle, PageTitle, KPI } from './ui';
import { fmtDate, todayISO } from '../lib/util';

const norm = (s) => (s || '').trim().toLowerCase();
const horaBR = (iso) => { try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }); } catch { return ''; } };
const horasDe = (r) => (r.entrada && r.saida ? Math.max(0, (new Date(r.saida) - new Date(r.entrada)) / 3600000) : 0);
const fmtHoras = (h) => { const t = Math.round(h * 60); const hh = Math.floor(t / 60), mm = t % 60; return `${hh}h${mm > 0 ? ` ${mm}min` : ''}`; };

// Ponto na visão da DONA: horas trabalhadas por pessoa no mês, com os turnos de
// cada uma. Pode apagar um registro errado. Os pontos são batidos pela cozinha.
export default function PontoDona() {
  const [registros, setRegistros] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [aberto, setAberto] = useState('');
  const [busy, setBusy] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/ponto', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) setRegistros(Array.isArray(j.registros) ? j.registros : []);
    } catch { /* offline */ }
    finally { setCarregado(true); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const excluir = async (id) => {
    if (typeof window !== 'undefined' && !window.confirm('Apagar este registro de ponto?')) return;
    setBusy(true);
    try { await fetch('/api/ponto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'excluir', id }) }); await carregar(); }
    catch { /* ignora */ }
    finally { setBusy(false); }
  };

  const ym = todayISO().slice(0, 7);
  const pessoas = useMemo(() => {
    const doMes = registros.filter((r) => (r.data || '').slice(0, 7) === ym);
    const map = new Map();
    for (const r of doMes) {
      const k = norm(r.nome);
      if (!map.has(k)) map.set(k, { nome: r.nome, horas: 0, turnos: [] });
      const g = map.get(k);
      g.horas += horasDe(r);
      g.turnos.push(r);
    }
    for (const g of map.values()) g.turnos.sort((a, b) => (b.entrada || '').localeCompare(a.entrada || ''));
    return [...map.values()].sort((a, b) => b.horas - a.horas);
  }, [registros, ym]);

  const totalHoras = pessoas.reduce((s, p) => s + p.horas, 0);
  const trabalhandoAgora = registros.filter((r) => !r.saida);

  return (
    <div>
      <PageTitle sub="Horas da equipe neste mês — a cozinha bate o ponto, você acompanha aqui">Ponto</PageTitle>

      <KPI titulo="Horas no mês" valor={fmtHoras(totalHoras)} cor={C.accent} sub={`${pessoas.length} pessoa(s)`} />

      {trabalhandoAgora.length > 0 && (
        <Card style={{ margin: '14px 0', borderColor: C.green }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: C.green }}>Trabalhando agora ({trabalhandoAgora.length})</div>
          {trabalhandoAgora.map((r) => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14, padding: '4px 0' }}>
              <span style={{ fontWeight: 700 }}>{r.nome}</span>
              <span style={{ color: C.muted }}>desde {fmtDate(r.data)} {horaBR(r.entrada)}</span>
            </div>
          ))}
        </Card>
      )}

      <SecTitle>Por pessoa (este mês)</SecTitle>
      {!carregado ? <Empty>Carregando…</Empty> : pessoas.length === 0 ? (
        <Empty>Nenhum ponto batido este mês.<br />A cozinha registra na aba Ponto do login dela.</Empty>
      ) : pessoas.map((p) => {
        const ab = aberto === norm(p.nome);
        return (
          <div key={p.nome} style={{ marginBottom: 10 }}>
            <button onClick={() => setAberto(ab ? '' : norm(p.nome))} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: C.panel, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '13px 14px', cursor: 'pointer', textAlign: 'left', boxShadow: C.cardShadow }}>
              <span style={{ color: C.accent, fontSize: 12, fontWeight: 800, width: 12, flexShrink: 0 }}>{ab ? '▾' : '▸'}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{p.nome}</span>
                <span style={{ fontSize: 12, color: C.faint, display: 'block' }}>{p.turnos.length} turno(s)</span>
              </span>
              <span style={{ fontSize: 16, fontWeight: 800, color: C.accent, flexShrink: 0 }}>{fmtHoras(p.horas)}</span>
            </button>
            {ab && (
              <div style={{ marginTop: 8 }}>
                {p.turnos.map((r) => (
                  <Card key={r.id} style={{ marginBottom: 6, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13 }}>
                        <b>{fmtDate(r.data)}</b> · {horaBR(r.entrada)} → {r.saida ? horaBR(r.saida) : 'em trabalho'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <b style={{ fontSize: 13, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{r.saida ? fmtHoras(horasDe(r)) : '—'}</b>
                        <button onClick={() => excluir(r.id)} disabled={busy} title="Apagar" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>×</button>
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
