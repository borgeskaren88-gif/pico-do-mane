'use client';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { C, Card, Btn, Field, Label, inputStyle, Empty } from './ui';
import { todayISO } from '../lib/util';

// Datas em YYYY-MM-DD, andando pra trás a partir de hoje (fuso do Brasil no todayISO).
const isoMaisDias = (iso, d) => { const dt = new Date(iso + 'T12:00:00'); dt.setDate(dt.getDate() + d); return dt.toISOString().slice(0, 10); };
const DIAS_CURTO = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const diaLetra = (iso) => DIAS_CURTO[new Date(iso + 'T12:00:00').getDay()];

// Sequência (streak): dias seguidos até hoje (ou ontem, se hoje ainda não marcou).
function streakDe(habitoId, checkins) {
  const feito = (dia) => !!checkins[`${habitoId}|${dia}`];
  const hoje = todayISO();
  let cursor = feito(hoje) ? hoje : isoMaisDias(hoje, -1);
  let s = 0;
  while (feito(cursor)) { s += 1; cursor = isoMaisDias(cursor, -1); }
  return s;
}

export default function Habitos({ usuario }) {
  const [habitos, setHabitos] = useState([]);
  const [checkins, setCheckins] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [nome, setNome] = useState('');
  const [emoji, setEmoji] = useState('');
  const [salvando, setSalvando] = useState(false);

  const aplicar = (j) => { if (j && j.ok) { setHabitos(j.habitos || []); setCheckins(j.checkins || {}); } };

  const carregar = useCallback(async () => {
    setCarregando(true); setErro('');
    try {
      const r = await fetch('/api/casa', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) aplicar(j); else setErro(j.erro || 'Erro ao carregar.');
    } catch { setErro('Não consegui conectar.'); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const acao = async (payload) => {
    try {
      const r = await fetch('/api/casa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (j.ok) aplicar(j); else setErro(j.erro || 'Erro.');
      return j;
    } catch { setErro('Sem conexão.'); return { ok: false }; }
  };

  const adicionar = async (e) => {
    e.preventDefault();
    if (!nome.trim() || salvando) return;
    setSalvando(true);
    await acao({ acao: 'habitoAdd', nome: nome.trim(), emoji: emoji.trim() });
    setNome(''); setEmoji(''); setSalvando(false);
  };
  const apagar = (id) => { if (window.confirm('Apagar este hábito?')) acao({ acao: 'habitoDel', id }); };
  const marcar = (habitoId, dia, feito) => acao({ acao: 'checkin', habitoId, data: dia, feito });

  const hoje = todayISO();
  const ultimos7 = useMemo(() => Array.from({ length: 7 }, (_, i) => isoMaisDias(hoje, -(6 - i))), [hoje]);

  // Agrupa por pessoa: primeiro os seus, depois os da outra pessoa.
  const grupos = useMemo(() => {
    const porPessoa = new Map();
    for (const h of habitos) { if (!porPessoa.has(h.usuario)) porPessoa.set(h.usuario, []); porPessoa.get(h.usuario).push(h); }
    const nomes = [...porPessoa.keys()].sort((a, b) => (a === usuario.nome ? -1 : b === usuario.nome ? 1 : a.localeCompare(b)));
    return nomes.map((n) => ({ pessoa: n, eu: n === usuario.nome, itens: porPessoa.get(n) }));
  }, [habitos, usuario.nome]);

  return (
    <div>
      {/* Adicionar hábito (entra pra você) */}
      <Card style={{ marginBottom: 16 }}>
        <Label>Novo hábito seu</Label>
        <form onSubmit={adicionar} style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🏃" maxLength={2}
              style={{ ...inputStyle, width: 54, textAlign: 'center', flexShrink: 0, fontSize: 18 }} />
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Beber 2L de água, Academia, Ler 10min" style={inputStyle} />
          </div>
          <button type="submit" disabled={salvando} style={{ marginTop: 10, width: '100%', background: C.accent, color: '#06101F', border: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 15, fontWeight: 700, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.7 : 1 }}>
            {salvando ? 'Adicionando…' : '+ Adicionar hábito'}
          </button>
        </form>
      </Card>

      {erro && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{erro}</div>}

      {carregando ? <Empty>Carregando…</Empty> : habitos.length === 0 ? (
        <Empty>Nenhum hábito ainda.<br />Crie o primeiro ali em cima pra começar a rotina. 💪</Empty>
      ) : grupos.map((g) => (
        <div key={g.pessoa} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: g.eu ? C.accent : C.muted, margin: '0 0 8px 2px' }}>
            {g.eu ? 'Seus hábitos' : `Hábitos de ${g.pessoa}`}
          </div>
          {g.itens.map((h) => {
            const s = streakDe(h.id, checkins);
            const feitoHoje = !!checkins[`${h.id}|${hoje}`];
            return (
              <Card key={h.id} style={{ marginBottom: 8, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 22, width: 30, textAlign: 'center', flexShrink: 0 }}>{h.emoji || '✅'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{h.nome}</div>
                    <div style={{ fontSize: 12, color: s > 0 ? C.amber : C.faint, marginTop: 2, fontWeight: 600 }}>
                      {s > 0 ? `🔥 ${s} dia${s > 1 ? 's' : ''} seguidos` : 'Sem sequência ainda'}
                    </div>
                  </div>
                  {g.eu && (
                    <button onClick={() => marcar(h.id, hoje, !feitoHoje)} title={feitoHoje ? 'Feito hoje' : 'Marcar hoje'}
                      style={{ width: 46, height: 46, borderRadius: 12, flexShrink: 0, cursor: 'pointer', border: `2px solid ${feitoHoje ? C.green : C.line}`, background: feitoHoje ? C.green : 'transparent', color: feitoHoje ? '#052014' : C.faint, fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {feitoHoje ? '✓' : '+'}
                    </button>
                  )}
                </div>

                {/* Últimos 7 dias */}
                <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'space-between' }}>
                  {ultimos7.map((dia) => {
                    const feito = !!checkins[`${h.id}|${dia}`];
                    const ehHoje = dia === hoje;
                    return (
                      <button key={dia} disabled={!g.eu} onClick={() => g.eu && marcar(h.id, dia, !feito)}
                        style={{ flex: 1, cursor: g.eu ? 'pointer' : 'default', border: 'none', background: 'none', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10, color: C.faint }}>{diaLetra(dia)}</span>
                        <span style={{ width: '100%', maxWidth: 34, aspectRatio: '1', borderRadius: 8, background: feito ? C.green : C.panel2, border: `1px solid ${ehHoje ? C.accent : C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#052014', fontSize: 13, fontWeight: 800 }}>
                          {feito ? '✓' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {g.eu && (
                  <div style={{ textAlign: 'right', marginTop: 8 }}>
                    <button onClick={() => apagar(h.id)} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>apagar</button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ))}
    </div>
  );
}
