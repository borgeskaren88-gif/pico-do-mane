'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { C, Card } from './ui';
import { alertas, analisarBar, faz, lerVisto, marcarVisto } from '../lib/darci';
import { todayISO, addDays } from '../lib/util';

// O topo do Dashboard, num cartão só.
//
// Antes eram três blocos empilhados brigando entre si — mesas reservadas, os
// avisos do Darci e o "o que mudou" —, cada um com sua borda colorida, e o
// balão do Darci ainda abria por cima do título. Muita tinta pra ler antes de
// chegar no que ela veio ver.
//
// Aqui é um cartão, três faixas separadas por um fio fino, e uma informação por
// linha: bolinha da urgência, o assunto à esquerda, o número à direita. Detalhe
// só quando ela toca. O que não cabe vira "ver as outras N".
const QUANTAS = 3;

// As props do Darci chegam soltas (receitas, despesas, vendas…), não dentro de
// um objeto `dados` — é assim que o painel as passa. O `...dados` recolhe todas
// e deixa de fora só o que é função.
export default function ResumoDoDia({ onPerguntar, onAbrir, onAnotar, ...dados }) {
  const [reservas, setReservas] = useState([]);
  const [desdeMs, setDesdeMs] = useState(0);
  const [tudo, setTudo] = useState(false);
  const [abertoId, setAbertoId] = useState('');
  const [verMudou, setVerMudou] = useState(false);

  useEffect(() => { setDesdeMs(lerVisto()); }, []);

  const carregarReservas = useCallback(async () => {
    try {
      const r = await fetch('/api/reservas', { cache: 'no-store' });
      const j = await r.json();
      setReservas(j.ok && Array.isArray(j.reservas) ? j.reservas : []);
    } catch { /* sem conexão: some a faixa das reservas */ }
  }, []);
  useEffect(() => {
    carregarReservas();
    const aoVoltar = () => { if (!document.hidden) carregarReservas(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [carregarReservas]);

  const n = useMemo(
    () => analisarBar({ ...dados, desdeMs }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [desdeMs, dados.vendas, dados.estoque, dados.receitas, dados.despesas, dados.compras, dados.tarefas, dados.clientes, dados.fichas, dados.cardapio],
  );
  const avisos = useMemo(() => alertas(n), [n]);
  const novidades = n.novidades || [];

  const hoje = todayISO();
  const proximas = useMemo(
    () => reservas.filter((r) => r && r.data >= hoje).sort((a, b) => `${a.data} ${a.hora || ''}`.localeCompare(`${b.data} ${b.hora || ''}`)),
    [reservas, hoje],
  );
  const jaVi = () => { const agora = Date.now(); marcarVisto(agora); setDesdeMs(agora); };

  if (!avisos.length && !proximas.length && !novidades.length) return null;

  const mostrados = tudo ? avisos : avisos.slice(0, QUANTAS);
  const sobram = avisos.length - mostrados.length;
  const corDe = (nivel) => (nivel === 'urgente' ? C.red : nivel === 'atencao' ? C.amber : C.accent2);
  const urgentes = avisos.filter((a) => a.nivel === 'urgente').length;
  const quando = (r) => (r.data === hoje ? 'Hoje' : r.data === addDays(hoje, 1) ? 'Amanhã' : `${r.data.slice(8, 10)}/${r.data.slice(5, 7)}`);

  return (
    <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
      {/* ---- o que precisa de atenção ---- */}
      {avisos.length > 0 && (
        <div style={{ padding: '12px 14px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '.09em', color: C.faint }}>PRA OLHAR AGORA</span>
            {urgentes > 0 && (
              <span style={{ fontSize: 11, fontWeight: 900, color: C.red }}>
                {urgentes} {urgentes === 1 ? 'urgente' : 'urgentes'}
              </span>
            )}
          </div>

          {mostrados.map((av) => {
            const cor = corDe(av.nivel);
            const aberto = abertoId === av.id;
            return (
              <div key={av.id}>
                <button
                  onClick={() => setAbertoId(aberto ? '' : av.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                    background: 'none', border: 'none', padding: '9px 0', cursor: 'pointer',
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: cor, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {av.titulo}
                  </span>
                  {av.valor ? (
                    <span style={{ flexShrink: 0, fontSize: 14, fontWeight: 800, color: cor, fontVariantNumeric: 'tabular-nums' }}>{av.valor}</span>
                  ) : null}
                </button>
                {aberto && (
                  <div style={{ paddingLeft: 17, paddingBottom: 10, marginTop: -4 }}>
                    <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>{av.detalhe}</div>
                    {onPerguntar && (
                      <button onClick={() => onPerguntar(av.pergunta)} style={{ background: 'none', border: 'none', color: C.accent, fontSize: 12, fontWeight: 800, padding: '6px 0 0', cursor: 'pointer' }}>
                        o Darci me explica
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {(sobram > 0 || tudo) && (
            <button onClick={() => setTudo((v) => !v)} style={{ background: 'none', border: 'none', color: C.accent, fontSize: 12, fontWeight: 800, padding: '6px 0 0', cursor: 'pointer' }}>
              {tudo ? 'mostrar menos' : `ver ${sobram === 1 ? 'a outra' : `as outras ${sobram}`}`}
            </button>
          )}
        </div>
      )}

      {/* ---- mesa reservada ---- */}
      {proximas.length > 0 && (
        <div style={{ padding: '10px 14px', borderTop: `1px solid ${C.hair}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, flexShrink: 0 }} aria-hidden="true">📅</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.muted, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <b style={{ color: C.text }}>{quando(proximas[0])}{proximas[0].hora ? ` ${proximas[0].hora}` : ''}</b>
            {' · '}{proximas[0].nome} · {Number(proximas[0].pessoas) || 1} {(Number(proximas[0].pessoas) || 1) === 1 ? 'pessoa' : 'pessoas'}
          </span>
          {proximas.length > 1 && (
            <span style={{ flexShrink: 0, fontSize: 11.5, color: C.faint, fontWeight: 700 }}>+{proximas.length - 1}</span>
          )}
        </div>
      )}

      {/* ---- o que mudou desde a última vez ---- */}
      {novidades.length > 0 && (
        <div style={{ borderTop: `1px solid ${C.hair}` }}>
          <button onClick={() => setVerMudou((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '10px 14px', cursor: 'pointer' }}>
            <span style={{ color: C.faint, fontSize: 11, fontWeight: 900 }}>{verMudou ? '▾' : '▸'}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: C.muted }}>O que mudou</span>
            <span style={{ flexShrink: 0, fontSize: 11.5, color: C.faint }}>desde {faz(desdeMs)}</span>
          </button>
          {verMudou && (
            <div style={{ padding: '0 14px 12px 31px' }}>
              {novidades.map((linha, i) => (
                <div key={i} style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5, marginBottom: 4 }}>· {linha}</div>
              ))}
              <button onClick={jaVi} style={{ background: 'none', border: 'none', color: C.faint, fontSize: 12, fontWeight: 800, padding: '4px 0 0', cursor: 'pointer' }}>já vi</button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
