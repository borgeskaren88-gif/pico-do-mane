'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { C, Card, Btn, Field, TextInput, NumInput, Empty } from './ui';
import { num } from '../lib/util';

// Dar cortesia ou registrar consumo da casa de um PRODUTO do cardápio (ex.:
// narguilé, um drink). O sistema baixa os ingredientes da ficha técnica sozinho.
// Não vira venda nem toca no caixa/DRE.
const MOTIVOS = [['Cortesia', 'Cortesia'], ['Consumo da casa', 'Consumo da casa']];

export default function CortesiaConsumo({ onFeito }) {
  const [cardapio, setCardapio] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [busca, setBusca] = useState('');
  const [selId, setSelId] = useState('');
  const [qtd, setQtd] = useState('1');
  const [motivo, setMotivo] = useState('Cortesia');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/comandas', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) setCardapio(Array.isArray(j.cardapio) ? j.cardapio : []);
    } catch { /* offline */ }
    finally { setCarregado(true); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const filtro = busca.trim().toLowerCase();
  const lista = filtro ? cardapio.filter((i) => (i.nome || '').toLowerCase().includes(filtro)) : cardapio;
  const sel = cardapio.find((i) => i.id === selId) || null;

  const registrar = async () => {
    if (!selId) { setErro('Escolha o produto.'); return; }
    if (!(num(qtd) > 0)) { setErro('Diga a quantidade.'); return; }
    setBusy(true); setErro(''); setMsg('');
    try {
      const r = await fetch('/api/comandas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'cortesia', cardapioId: selId, qtd: num(qtd), motivo }) });
      const j = await r.json();
      if (!j.ok) setErro(j.erro || 'Não consegui registrar.');
      else { setMsg(`${motivo}: ${num(qtd)}× ${sel?.nome || ''}. Ingredientes baixados do estoque. 🎁`); setSelId(''); setBusca(''); setQtd('1'); if (onFeito) onFeito(); }
    } catch { setErro('Sem conexão.'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <Card style={{ marginBottom: 14, background: C.panel2 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Cortesia / Consumo da casa</div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>Deu um produto de graça (cortesia) ou a casa consumiu? Escolha o produto do cardápio (narguilé, drink…) e o sistema baixa os ingredientes da ficha sozinho. Não mexe no caixa nem no DRE.</div>
      </Card>

      {msg && <Card style={{ marginBottom: 12, borderColor: C.green }}><div style={{ color: C.green, fontSize: 14, fontWeight: 700 }}>✓ {msg}</div></Card>}
      {erro && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{erro}</div>}

      <Field label="O que foi?">
        <div style={{ display: 'flex', gap: 6 }}>
          {MOTIVOS.map(([v, rot]) => (
            <button key={v} onClick={() => setMotivo(v)} style={{ flex: 1, border: `1px solid ${motivo === v ? C.accent : C.line}`, background: motivo === v ? C.accent : 'transparent', color: motivo === v ? '#06101F' : C.muted, borderRadius: 9, padding: '9px 8px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{rot}</button>
          ))}
        </div>
      </Field>

      <Field label="Qual produto?">
        <TextInput value={busca} onChange={setBusca} placeholder="Buscar (ex.: Narguilé)" />
      </Field>
      {!carregado ? <Empty>Carregando…</Empty> : (
        <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {lista.length === 0 ? <Empty>Nenhum produto encontrado.</Empty> : lista.slice(0, 60).map((i) => (
            <button key={i.id} onClick={() => { setSelId(i.id); setErro(''); }} style={{
              textAlign: 'left', border: `1px solid ${selId === i.id ? C.accent : C.line}`,
              background: selId === i.id ? C.accent : C.panel, color: selId === i.id ? '#06101F' : C.text,
              borderRadius: 10, padding: '10px 12px', cursor: 'pointer', fontSize: 14, fontWeight: 700,
            }}>{i.nome}</button>
          ))}
        </div>
      )}

      {sel && (
        <Card style={{ borderColor: C.accent }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>{sel.nome}</div>
          <Field label="Quantas?"><NumInput value={qtd} onChange={setQtd} /></Field>
          <Btn onClick={registrar} disabled={busy}>{busy ? 'Registrando…' : `Registrar ${motivo.toLowerCase()}`}</Btn>
        </Card>
      )}
    </div>
  );
}
