'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { C, Card, Btn, Field, TextInput, Empty, SecTitle, PageTitle } from './ui';
import { brl, num } from '../lib/util';

const CATS = ['Chopp / Cerveja', 'Drinks / Doses', 'Porções', 'Não alcoólicos', 'Sobremesas', 'Outros'];

export default function Comandas({ papel = 'dona' }) {
  const [comandas, setComandas] = useState([]);
  const [cardapio, setCardapio] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState('');
  const [selId, setSelId] = useState(null);
  const [mesaNova, setMesaNova] = useState('');
  const [busy, setBusy] = useState(false);
  const editandoRef = useRef(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/comandas', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) { setComandas(j.comandas || []); setCardapio(j.cardapio || []); setErro(''); }
      else setErro(j.erro || 'Erro ao carregar.');
    } catch { setErro('Sem conexão.'); }
    finally { setCarregado(true); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  // Atualiza sozinho de tempos em tempos, pra um garçom ver as mesas do outro.
  // Não recarrega enquanto está mexendo numa comanda, pra não atrapalhar.
  useEffect(() => {
    const t = setInterval(() => { if (!editandoRef.current) carregar(); }, 12000);
    const onFoco = () => { if (!editandoRef.current) carregar(); };
    window.addEventListener('focus', onFoco);
    return () => { clearInterval(t); window.removeEventListener('focus', onFoco); };
  }, [carregar]);

  const acao = async (payload, { manterSel = true } = {}) => {
    setBusy(true);
    try {
      const r = await fetch('/api/comandas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!j.ok) { setErro(j.erro || 'Erro.'); return null; }
      if (j.comanda) {
        setComandas((cs) => {
          const outras = cs.filter((c) => c.id !== j.comanda.id);
          return [...outras, j.comanda].sort((a, b) => Number(a.mesa) - Number(b.mesa));
        });
        if (manterSel) setSelId(j.comanda.id);
      } else {
        await carregar();
      }
      setErro('');
      return j;
    } catch { setErro('Sem conexão.'); return null; }
    finally { setBusy(false); }
  };

  const abrirMesa = async () => {
    const mesa = mesaNova.trim();
    if (!mesa) return;
    const j = await acao({ acao: 'abrir', mesa });
    if (j?.comanda) { setMesaNova(''); setSelId(j.comanda.id); }
  };
  const addItem = (cardapioId) => acao({ acao: 'add', comandaId: selId, cardapioId });
  const setQtd = (itemId, qtd) => acao({ acao: 'setQtd', comandaId: selId, itemId, qtd });
  const remover = (itemId) => acao({ acao: 'remover', comandaId: selId, itemId });
  const cancelar = async (id) => {
    if (typeof window !== 'undefined' && !window.confirm('Cancelar esta comanda? Todo o consumo lançado será apagado.')) return;
    await acao({ acao: 'cancelar', comandaId: id }, { manterSel: false });
    setSelId(null);
  };

  const totalDe = (c) => (c.itens || []).reduce((s, it) => s + (Number(it.qtd) || 0) * (Number(it.preco) || 0), 0);
  const sel = comandas.find((c) => c.id === selId) || null;
  useEffect(() => { editandoRef.current = !!selId; }, [selId]);

  const cardapioGrupos = useMemo(() => {
    const ordem = [...CATS, ''];
    const map = new Map();
    for (const it of cardapio) { const cat = it.categoria || ''; if (!map.has(cat)) map.set(cat, []); map.get(cat).push(it); }
    return [...map.entries()].sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0]))
      .map(([cat, itens]) => ({ cat: cat || 'Outros', itens: itens.sort((x, y) => (x.nome || '').localeCompare(y.nome || '')) }));
  }, [cardapio]);

  // ---- Detalhe de uma comanda ----
  if (sel) {
    const total = totalDe(sel);
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <button onClick={() => setSelId(null)} style={{ background: 'none', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: '7px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>‹ Mesas</button>
          <div style={{ fontSize: 20, fontWeight: 900 }}>Mesa {sel.mesa}</div>
        </div>

        <Card style={{ marginBottom: 14, padding: 14 }}>
          {sel.itens.length === 0 ? <Empty>Nada lançado ainda.<br />Toque nos itens do cardápio abaixo.</Empty> :
            sel.itens.map((it) => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: `1px solid ${C.line}`, paddingTop: 9, marginTop: 9 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{it.nome}</div>
                  <div style={{ fontSize: 12, color: C.faint }}>{brl(num(it.preco))} cada</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => setQtd(it.id, (Number(it.qtd) || 0) - 1)} disabled={busy} style={estBtn}>–</button>
                  <span style={{ minWidth: 22, textAlign: 'center', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{it.qtd}</span>
                  <button onClick={() => setQtd(it.id, (Number(it.qtd) || 0) + 1)} disabled={busy} style={estBtn}>+</button>
                </div>
                <div style={{ width: 78, textAlign: 'right', fontWeight: 800, color: C.green, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl((Number(it.qtd) || 0) * num(it.preco))}</div>
                <button onClick={() => remover(it.id)} disabled={busy} title="Remover" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 4px' }}>×</button>
              </div>
            ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTop: `2px solid ${C.line}` }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.muted }}>Total da mesa</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{brl(total)}</span>
          </div>
        </Card>

        <SecTitle>Cardápio</SecTitle>
        {cardapio.length === 0 ? <Empty>Cardápio vazio. Cadastre os itens na aba Cardápio.</Empty> :
          cardapioGrupos.map((g) => (
            <Card key={g.cat} style={{ marginBottom: 10, padding: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4, color: C.accent }}>{g.cat}</div>
              {g.itens.map((it) => (
                <button key={it.id} onClick={() => addItem(it.id)} disabled={busy}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, borderTop: `1px solid ${C.line}`, paddingTop: 9, marginTop: 9, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: C.accent, color: '#fff', fontSize: 18, fontWeight: 800, lineHeight: '24px', textAlign: 'center' }}>+</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: C.text }}>{it.nome}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.green, fontVariantNumeric: 'tabular-nums' }}>{brl(num(it.preco))}</span>
                </button>
              ))}
            </Card>
          ))}

        {papel === 'dona' && (
          <div style={{ marginTop: 8 }}>
            <Btn kind="danger" small onClick={() => cancelar(sel.id)}>Cancelar comanda</Btn>
          </div>
        )}
      </div>
    );
  }

  // ---- Painel de mesas ----
  return (
    <div>
      <PageTitle sub="Mesas abertas agora">Comandas</PageTitle>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Abrir mesa</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <TextInput value={mesaNova} onChange={setMesaNova} inputMode="numeric" placeholder="Número da mesa (ex.: 7)" />
          </div>
          <Btn onClick={abrirMesa} disabled={busy || !mesaNova.trim()}>Abrir</Btn>
        </div>
      </Card>

      {erro && <div style={{ fontSize: 13, color: C.red, marginBottom: 10 }}>{erro}</div>}

      <SecTitle>Mesas abertas ({comandas.length})</SecTitle>
      {!carregado ? <Empty>Carregando…</Empty> :
        comandas.length === 0 ? <Empty>Nenhuma mesa aberta.<br />Abra uma mesa acima pra começar a lançar.</Empty> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {comandas.map((c) => {
              const total = totalDe(c);
              const nItens = (c.itens || []).reduce((s, it) => s + (Number(it.qtd) || 0), 0);
              return (
                <button key={c.id} onClick={() => setSelId(c.id)}
                  style={{ textAlign: 'left', cursor: 'pointer', background: C.panel, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow, borderRadius: 16, padding: 14 }}>
                  <div style={{ fontSize: 12, color: C.faint, fontWeight: 600 }}>Mesa</div>
                  <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1, color: C.text }}>{c.mesa}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.green, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>{brl(total)}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{nItens} item{nItens === 1 ? '' : 's'}</div>
                </button>
              );
            })}
          </div>
        )}
    </div>
  );
}

const estBtn = { width: 30, height: 30, borderRadius: 8, border: `1px solid var(--c-line)`, background: 'transparent', color: 'var(--c-text)', fontSize: 18, fontWeight: 800, cursor: 'pointer', lineHeight: 1 };
