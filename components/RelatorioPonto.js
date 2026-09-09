'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { C, Card, Btn, Empty, SecTitle } from './ui';
import { fmtDate, todayISO } from '../lib/util';

const norm = (s) => (s || '').trim().toLowerCase();
const horaBR = (iso) => { try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }); } catch { return ''; } };
const horasDe = (r) => (r.entrada && r.saida ? Math.max(0, (new Date(r.saida) - new Date(r.entrada)) / 3600000) : 0);
const fmtHoras = (h) => { const t = Math.round(Math.abs(h) * 60); const hh = Math.floor(t / 60), mm = t % 60; return `${hh}h${mm > 0 ? String(mm).padStart(2, '0') : ''}`; };
const SETORES = { cozinha: 'Cozinha', garcom: 'Atendimento', dona: 'Dona' };
const MES_NOME = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotuloMes = (ym) => `${MES_NOME[Number(ym.slice(5, 7)) - 1] || ''}/${ym.slice(0, 4)}`;

// Ponto de cada funcionário, mês a mês — pra fechar pagamento e conferir com a
// pessoa. Tem mês próprio (o histórico do ponto não é o mesmo das Finanças) e
// abre turno por turno, com dia, entrada, saída e o total de horas.
export default function RelatorioPonto({ mesInicial }) {
  const [registros, setRegistros] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [mes, setMes] = useState(mesInicial || todayISO().slice(0, 7));
  const [aberto, setAberto] = useState('');
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/ponto', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) setRegistros(Array.isArray(j.registros) ? j.registros : []);
    } catch { /* sem conexão: mostra vazio */ }
    finally { setCarregado(true); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  // Os meses que existem no ponto (não os das Finanças) — assim dá pra voltar
  // em qualquer mês em que alguém bateu ponto.
  const meses = useMemo(() => {
    const s = new Set(registros.map((r) => (r.data || '').slice(0, 7)).filter(Boolean));
    s.add(todayISO().slice(0, 7));
    return [...s].sort().reverse();
  }, [registros]);

  const pessoas = useMemo(() => {
    const doMes = registros.filter((r) => (r.data || '').slice(0, 7) === mes);
    const map = new Map();
    for (const r of doMes) {
      const k = norm(r.nome);
      if (!k) continue;
      if (!map.has(k)) map.set(k, { nome: r.nome, papel: r.papel || '', horas: 0, turnos: [], dias: new Set(), abertos: 0 });
      const g = map.get(k);
      if (!g.papel && r.papel) g.papel = r.papel;
      if (r.saida) g.horas += horasDe(r); else g.abertos += 1;
      g.dias.add(r.data);
      g.turnos.push(r);
    }
    for (const g of map.values()) g.turnos.sort((a, b) => (a.entrada || '').localeCompare(b.entrada || ''));
    return [...map.values()].sort((a, b) => b.horas - a.horas);
  }, [registros, mes]);

  const totalHoras = pessoas.reduce((s, p) => s + p.horas, 0);

  const copiar = async () => {
    const linhas = [`Ponto — ${rotuloMes(mes)} · Pico do Mané`, ''];
    for (const p of pessoas) {
      linhas.push(`${p.nome}${p.papel ? ` (${SETORES[p.papel] || p.papel})` : ''}: ${fmtHoras(p.horas)} em ${p.dias.size} dia(s), ${p.turnos.length} turno(s)`);
    }
    linhas.push('', `Total: ${fmtHoras(totalHoras)}`);
    try {
      await navigator.clipboard.writeText(linhas.join('\n'));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch { /* sem permissão de área de transferência */ }
  };

  return (
    <div style={{ marginTop: 22 }}>
      <SecTitle>Ponto da equipe</SecTitle>

      <div style={{ display: 'flex', gap: 7, overflowX: 'auto', padding: '2px 0 10px' }}>
        {meses.map((m) => (
          <button key={m} onClick={() => { setMes(m); setAberto(''); }} style={{
            flexShrink: 0, border: `1px solid ${m === mes ? C.accent : C.line}`, cursor: 'pointer',
            background: m === mes ? C.accent : 'transparent', color: m === mes ? '#06101F' : C.muted,
            borderRadius: 999, padding: '6px 14px', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
          }}>{rotuloMes(m)}</button>
        ))}
      </div>

      {!carregado ? <Empty>Carregando o ponto…</Empty>
        : pessoas.length === 0 ? <Empty>Ninguém bateu ponto em {rotuloMes(mes)}.</Empty> : (
          <>
            {pessoas.map((p) => {
              const abertoAqui = aberto === norm(p.nome);
              return (
                <Card key={p.nome} style={{ marginBottom: 8, padding: 14 }}>
                  <button onClick={() => setAberto(abertoAqui ? '' : norm(p.nome))} style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>
                        <span style={{ color: C.accent, fontSize: 12, marginRight: 6 }}>{abertoAqui ? '▾' : '▸'}</span>{p.nome}
                      </span>
                      <span style={{ display: 'block', fontSize: 12, color: C.faint, marginTop: 3 }}>
                        {p.papel ? `${SETORES[p.papel] || p.papel} · ` : ''}{p.dias.size} dia(s) · {p.turnos.length} turno(s)
                        {p.abertos > 0 ? ` · ${p.abertos} sem saída registrada` : ''}
                      </span>
                    </span>
                    <span style={{ fontSize: 17, fontWeight: 800, color: C.accent, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{fmtHoras(p.horas)}</span>
                  </button>

                  {abertoAqui && (
                    <div style={{ marginTop: 10, borderTop: `1px solid ${C.line}`, paddingTop: 8 }}>
                      {p.turnos.map((r) => (
                        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', fontSize: 13, borderTop: `1px solid ${C.hair}` }}>
                          <span style={{ color: C.muted }}>
                            {fmtDate(r.data)} · {horaBR(r.entrada)}{r.saida ? `–${horaBR(r.saida)}` : ' · em aberto'}
                            {r.manual ? <span style={{ color: C.faint }}> · lançado à mão</span> : null}
                          </span>
                          <b style={{ color: r.saida ? C.text : C.amber, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{r.saida ? fmtHoras(horasDe(r)) : '—'}</b>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}

            <Card style={{ marginTop: 4, background: C.panel2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>
                Total do mês <span style={{ color: C.faint, fontWeight: 500 }}>· {pessoas.length} pessoa(s)</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <b style={{ fontSize: 18, color: C.accent, fontVariantNumeric: 'tabular-nums' }}>{fmtHoras(totalHoras)}</b>
                <Btn kind="ghost" small onClick={copiar}>{copiado ? 'copiado!' : 'copiar resumo'}</Btn>
              </span>
            </Card>

            <div style={{ fontSize: 12, color: C.faint, lineHeight: 1.5, marginTop: 10 }}>
              As horas contam só os turnos com <b style={{ color: C.muted }}>entrada e saída</b> batidas. Turno esquecido em aberto aparece como “sem saída registrada” e não entra na soma — dá pra corrigir na aba Ponto.
            </div>
          </>
        )}
    </div>
  );
}
