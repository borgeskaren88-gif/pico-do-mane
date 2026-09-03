'use client';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { C, Card, Label, inputStyle, Icone } from './ui';
import { CORES_HABITO, brl, num } from '../lib/util';

export default function Carteira({ usuario }) {
  const [cartoes, setCartoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [abrir, setAbrir] = useState(false);
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState(CORES_HABITO[0]);
  const [limite, setLimite] = useState('');
  const [venc, setVenc] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState('');
  const [fatEdit, setFatEdit] = useState('');

  const aplicar = (j) => { if (j && j.ok) setCartoes(j.cartoes || []); };
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
    await acao({ acao: 'cartaoAdd', nome: nome.trim(), cor, limite, vencimento: venc });
    setNome(''); setLimite(''); setVenc(''); setSalvando(false); setAbrir(false);
  };
  const apagar = (id) => { if (window.confirm('Apagar este cartão?')) acao({ acao: 'cartaoDel', id }); };
  const salvarFatura = async (id) => { await acao({ acao: 'cartaoFatura', id, fatura: fatEdit }); setEditando(''); setFatEdit(''); };

  const meus = useMemo(() => cartoes.filter((c) => c.usuario === usuario.nome), [cartoes, usuario.nome]);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 2px 8px' }}>
        <Label>Sua carteira</Label>
        <button onClick={() => setAbrir((v) => !v)} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>{abrir ? 'fechar' : '+ cartão'}</button>
      </div>

      {erro && <div style={{ color: C.red, fontSize: 13, marginBottom: 10 }}>{erro}</div>}

      {abrir && (
        <Card style={{ marginBottom: 12 }}>
          <form onSubmit={adicionar}>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cartão (ex.: Nubank)" style={inputStyle} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input inputMode="decimal" value={limite} onChange={(e) => setLimite(e.target.value)} placeholder="Limite (R$)" style={inputStyle} />
              <input inputMode="numeric" value={venc} onChange={(e) => setVenc(e.target.value)} placeholder="Vence dia" style={{ ...inputStyle, width: 96, flexShrink: 0 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
              {CORES_HABITO.map((c) => (
                <button type="button" key={c} onClick={() => setCor(c)} style={{ width: 28, height: 28, borderRadius: 999, cursor: 'pointer', background: c, border: 'none', boxShadow: cor === c ? `0 0 0 3px ${C.text}` : '0 0 0 2px rgba(255,255,255,0.15)' }} />
              ))}
            </div>
            <button type="submit" disabled={salvando} style={{ width: '100%', background: C.accent, color: C.onAccent, border: 'none', borderRadius: 10, padding: '11px', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: salvando ? 0.7 : 1 }}>
              {salvando ? 'Salvando…' : 'Adicionar cartão'}
            </button>
          </form>
        </Card>
      )}

      {carregando ? null : meus.length === 0 ? (
        !abrir && <div style={{ color: C.faint, fontSize: 13, padding: '2px 2px 6px' }}>Adicione seus cartões pra controlar limite e fatura.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {meus.map((c) => {
            const lim = Number(c.limite) || 0;
            const fat = Number(c.fatura) || 0;
            const pct = lim > 0 ? Math.min(100, Math.round((fat / lim) * 100)) : 0;
            const estourou = lim > 0 && fat > lim;
            return (
              <div key={c.id} style={{ borderRadius: 16, padding: 16, color: '#FFFFFF', background: `linear-gradient(135deg, ${c.cor} 0%, #2A1D16 130%)`, boxShadow: '0 10px 28px rgba(0,0,0,0.28)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 800 }}>{c.nome}</div>
                    {c.vencimento ? <div style={{ fontSize: 12, opacity: 0.85 }}>Vence dia {c.vencimento}</div> : null}
                  </div>
                  <div style={{ width: 34, height: 24, borderRadius: 5, background: 'rgba(255,255,255,0.35)' }} />
                </div>

                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div>
                    <div style={{ fontSize: 11, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '.06em' }}>Fatura atual</div>
                    <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{brl(fat)}</div>
                  </div>
                  {lim > 0 && <div style={{ textAlign: 'right', fontSize: 12, opacity: 0.9 }}>de {brl(lim)}<br /><b>{pct}%</b> usado</div>}
                </div>

                {lim > 0 && (
                  <div style={{ height: 8, background: 'rgba(255,255,255,0.25)', borderRadius: 999, overflow: 'hidden', marginTop: 8 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: estourou ? '#FF6B57' : 'rgba(255,255,255,0.95)', borderRadius: 999 }} />
                  </div>
                )}
                {estourou && <div style={{ fontSize: 12, marginTop: 6, fontWeight: 700, color: '#FFD9D2' }}>Passou do limite!</div>}

                {editando === c.id ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <input inputMode="decimal" autoFocus value={fatEdit} onChange={(e) => setFatEdit(e.target.value)} placeholder="Nova fatura (R$)"
                      style={{ ...inputStyle, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.35)', color: '#fff' }} />
                    <button onClick={() => salvarFatura(c.id)} style={{ background: 'rgba(255,255,255,0.9)', color: '#2A1D16', border: 'none', borderRadius: 10, padding: '0 14px', fontWeight: 700, cursor: 'pointer' }}>ok</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                    <button onClick={() => { setEditando(c.id); setFatEdit(String(fat || '')); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: 0, textDecoration: 'underline', opacity: 0.95 }}>atualizar fatura</button>
                    <button onClick={() => apagar(c.id)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, padding: 0, opacity: 0.8 }}>apagar</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
