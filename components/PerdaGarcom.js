'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { C, Card, Btn, Field, TextInput, NumInput, Empty } from './ui';
import { num } from '../lib/util';

// Baixas feitas pela linha de frente (garçom), SEM ver custos e sem tocar no
// caixa. Dois modos:
//  - Perda / Quebra: baixa um item do estoque cru (quebrou, congelou…).
//  - Cortesia: escolhe um produto do CARDÁPIO e o sistema baixa os ingredientes
//    da ficha técnica sozinho (igual a uma venda, só que de graça).
const MOTIVOS = ['Quebrou', 'Congelou', 'Estragou', 'Venceu'];

export default function PerdaGarcom() {
  const [modo, setModo] = useState('perda'); // 'perda' | 'cortesia'
  const [itens, setItens] = useState([]);      // itens do estoque (perda)
  const [cardapio, setCardapio] = useState([]); // produtos do cardápio (cortesia)
  const [carregado, setCarregado] = useState(false);
  const [busca, setBusca] = useState('');
  const [selId, setSelId] = useState('');
  const [qtd, setQtd] = useState('');
  const [motivo, setMotivo] = useState('Quebrou');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/comandas', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) { setItens(Array.isArray(j.estoqueItens) ? j.estoqueItens : []); setCardapio(Array.isArray(j.cardapio) ? j.cardapio : []); }
    } catch { /* offline */ }
    finally { setCarregado(true); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const trocarModo = (m) => { setModo(m); setSelId(''); setBusca(''); setErro(''); setMsg(''); setQtd(m === 'cortesia' ? '1' : ''); };

  const lista = modo === 'perda' ? itens : cardapio;
  const filtro = busca.trim().toLowerCase();
  const filtrada = filtro ? lista.filter((i) => (i.nome || '').toLowerCase().includes(filtro)) : lista;
  const sel = lista.find((i) => i.id === selId) || null;

  const registrar = async () => {
    if (!selId) { setErro(modo === 'perda' ? 'Escolha o item.' : 'Escolha o produto.'); return; }
    if (!(num(qtd) > 0)) { setErro('Diga a quantidade.'); return; }
    setBusy(true); setErro(''); setMsg('');
    try {
      const body = modo === 'perda'
        ? { acao: 'perda', itemId: selId, qtd: num(qtd), motivo }
        : { acao: 'cortesia', cardapioId: selId, qtd: num(qtd) };
      const r = await fetch('/api/comandas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!j.ok) { setErro(j.erro || 'Não consegui registrar.'); }
      else {
        setMsg(modo === 'perda'
          ? `Baixa registrada: ${num(qtd)} ${sel?.unidade || ''} de ${sel?.nome || ''} (${motivo}).`
          : `Cortesia registrada: ${num(qtd)}× ${sel?.nome || ''}. Ingredientes baixados do estoque. 🎁`);
        setSelId(''); setBusca(''); setQtd(modo === 'cortesia' ? '1' : '');
      }
    } catch { setErro('Sem conexão.'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: 3, gap: 3, marginBottom: 14 }}>
        {[['perda', 'Perda / Quebra'], ['cortesia', 'Cortesia']].map(([v, rot]) => (
          <button key={v} onClick={() => trocarModo(v)} style={{
            flex: 1, border: 'none', cursor: 'pointer', borderRadius: 9, padding: '9px 8px', fontSize: 14, fontWeight: 700,
            background: modo === v ? C.accent : 'transparent', color: modo === v ? '#06101F' : C.muted,
          }}>{rot}</button>
        ))}
      </div>

      <Card style={{ marginBottom: 14, background: C.panel2 }}>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
          {modo === 'perda'
            ? 'Quebrou, congelou, estragou ou venceu? Escolha o item do estoque e diga quanto saiu. Baixa na hora — não mexe no caixa.'
            : 'A dona liberou uma cortesia? Escolha o produto do cardápio (narguilé, drink…) e o sistema baixa os ingredientes da ficha sozinho. Não mexe no caixa.'}
        </div>
      </Card>

      {msg && <Card style={{ marginBottom: 12, borderColor: C.green }}><div style={{ color: C.green, fontSize: 14, fontWeight: 700 }}>✓ {msg}</div></Card>}
      {erro && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{erro}</div>}

      <Field label={modo === 'perda' ? 'Qual item?' : 'Qual produto?'}>
        <TextInput value={busca} onChange={setBusca} placeholder={modo === 'perda' ? 'Buscar (ex.: Heineken)' : 'Buscar (ex.: Narguilé)'} />
      </Field>
      {!carregado ? <Empty>Carregando…</Empty> : (
        <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtrada.length === 0 ? <Empty>Nenhum {modo === 'perda' ? 'item' : 'produto'} encontrado.</Empty> : filtrada.slice(0, 60).map((i) => (
            <button key={i.id} onClick={() => { setSelId(i.id); setErro(''); }} style={{
              textAlign: 'left', border: `1px solid ${selId === i.id ? C.accent : C.line}`,
              background: selId === i.id ? C.accent : C.panel, color: selId === i.id ? '#06101F' : C.text,
              borderRadius: 10, padding: '10px 12px', cursor: 'pointer', fontSize: 14, fontWeight: 700,
              display: 'flex', justifyContent: 'space-between', gap: 8,
            }}>
              <span style={{ minWidth: 0 }}>{i.nome}</span>
              {modo === 'perda' && <span style={{ opacity: 0.7, fontSize: 12, flexShrink: 0 }}>{i.unidade}</span>}
            </button>
          ))}
        </div>
      )}

      {sel && (
        <Card style={{ borderColor: C.accent }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>{sel.nome}</div>
          {modo === 'perda' ? (
            <>
              <Field label={`Quanto saiu? (em ${sel.unidade})`}><NumInput value={qtd} onChange={setQtd} /></Field>
              <Field label="O que aconteceu?">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {MOTIVOS.map((m) => (
                    <button key={m} onClick={() => setMotivo(m)} style={{
                      border: `1px solid ${motivo === m ? C.accent : C.line}`, background: motivo === m ? C.accent : 'transparent',
                      color: motivo === m ? '#06101F' : C.muted, borderRadius: 999, padding: '7px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}>{m}</button>
                  ))}
                </div>
              </Field>
              <Btn kind="danger" onClick={registrar} disabled={busy}>{busy ? 'Registrando…' : 'Registrar baixa'}</Btn>
            </>
          ) : (
            <>
              <Field label="Quantas cortesias?"><NumInput value={qtd} onChange={setQtd} /></Field>
              <Btn onClick={registrar} disabled={busy}>{busy ? 'Registrando…' : 'Registrar cortesia'}</Btn>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
