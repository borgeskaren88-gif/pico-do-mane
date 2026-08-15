'use client';
import React, { useState, useEffect } from 'react';
import { C, Card, Btn, Field, TextInput, NumInput, Empty } from './ui';
import { num } from '../lib/util';

// Registro de perda/quebra pela linha de frente (garçom). Ele escolhe o item,
// diz quanto se perdeu e o motivo — baixa do estoque na hora, SEM ver custos nem
// mexer no caixa. A dona vê tudo no histórico do item.
const MOTIVOS = ['Quebrou', 'Congelou', 'Estragou', 'Venceu'];

export default function PerdaGarcom() {
  const [itens, setItens] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [busca, setBusca] = useState('');
  const [selId, setSelId] = useState('');
  const [qtd, setQtd] = useState('');
  const [motivo, setMotivo] = useState('Quebrou');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  const carregar = async () => {
    try {
      const r = await fetch('/api/comandas', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) setItens(Array.isArray(j.estoqueItens) ? j.estoqueItens : []);
    } catch { /* offline: mostra vazio */ }
    finally { setCarregado(true); }
  };
  useEffect(() => { carregar(); }, []);

  const sel = itens.find((i) => i.id === selId) || null;
  const filtro = busca.trim().toLowerCase();
  const lista = filtro ? itens.filter((i) => (i.nome || '').toLowerCase().includes(filtro)) : itens;

  const registrar = async () => {
    if (!selId || !(num(qtd) > 0)) { setErro('Escolha o item e diga quanto se perdeu.'); return; }
    setBusy(true); setErro(''); setMsg('');
    try {
      const r = await fetch('/api/comandas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'perda', itemId: selId, qtd: num(qtd), motivo }) });
      const j = await r.json();
      if (!j.ok) { setErro(j.erro || 'Não consegui registrar.'); return; }
      setMsg(`Baixa registrada: ${num(qtd)} ${sel?.unidade || ''} de ${sel?.nome || ''} (${motivo}).`);
      setSelId(''); setQtd(''); setBusca(''); setMotivo('Quebrou');
    } catch { setErro('Sem conexão.'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <Card style={{ marginBottom: 14, background: C.panel2 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Registrar perda / quebra</div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>Quebrou uma cerveja? Congelou, estragou, venceu? Escolha o item e diga quanto se perdeu. Baixa do estoque na hora — não mexe no caixa.</div>
      </Card>

      {msg && <Card style={{ marginBottom: 12, borderColor: C.green }}><div style={{ color: C.green, fontSize: 14, fontWeight: 700 }}>✓ {msg}</div></Card>}
      {erro && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{erro}</div>}

      <Field label="Qual item?">
        <TextInput value={busca} onChange={setBusca} placeholder="Buscar (ex.: Heineken)" />
      </Field>
      {!carregado ? <Empty>Carregando…</Empty> : (
        <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {lista.length === 0 ? <Empty>Nenhum item encontrado.</Empty> : lista.slice(0, 60).map((i) => (
            <button key={i.id} onClick={() => { setSelId(i.id); setErro(''); }} style={{
              textAlign: 'left', border: `1px solid ${selId === i.id ? C.accent : C.line}`,
              background: selId === i.id ? C.accent : C.panel, color: selId === i.id ? '#06101F' : C.text,
              borderRadius: 10, padding: '10px 12px', cursor: 'pointer', fontSize: 14, fontWeight: 700,
              display: 'flex', justifyContent: 'space-between', gap: 8,
            }}>
              <span style={{ minWidth: 0 }}>{i.nome}</span>
              <span style={{ opacity: 0.7, fontSize: 12, flexShrink: 0 }}>{i.unidade}</span>
            </button>
          ))}
        </div>
      )}

      {sel && (
        <Card style={{ borderColor: C.accent }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>{sel.nome}</div>
          <Field label={`Quanto se perdeu? (em ${sel.unidade})`}>
            <NumInput value={qtd} onChange={setQtd} />
          </Field>
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
        </Card>
      )}
    </div>
  );
}
