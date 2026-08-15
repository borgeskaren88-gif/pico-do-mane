'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { C, Card, Btn, Field, TextInput, Empty, SecTitle } from './ui';

const norm = (s) => (s || '').trim().toLowerCase();
const horaBR = (iso) => { try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }); } catch { return ''; } };
const hojeBR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

// Ponto da cozinha (por pessoa): escreve o nome, bate Entrada ao chegar e Saída
// ao sair. A dona vê as horas no painel dela.
export default function PontoCozinha() {
  const [registros, setRegistros] = useState([]);
  const [nome, setNome] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [carregado, setCarregado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/ponto', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) setRegistros(Array.isArray(j.registros) ? j.registros : []);
    } catch { /* offline */ }
    finally { setCarregado(true); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const hoje = hojeBR();
  const doDia = registros.filter((r) => r.data === hoje);
  const abertoDoNome = nome.trim() ? registros.find((r) => !r.saida && norm(r.nome) === norm(nome)) : null;
  const trabalhandoAgora = registros.filter((r) => !r.saida);
  const nomesRecentes = [...new Set(registros.map((r) => r.nome).filter(Boolean))].slice(0, 6);

  const bater = async (acao) => {
    const n = nome.trim();
    if (!n) { setErro('Escreva seu nome primeiro.'); return; }
    setBusy(true); setErro(''); setMsg('');
    try {
      const r = await fetch('/api/ponto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao, nome: n }) });
      const j = await r.json();
      if (!j.ok) { setErro(j.erro || 'Não consegui registrar.'); }
      else { setMsg(acao === 'entrada' ? `Entrada registrada — bom trabalho, ${n}! 👋` : `Saída registrada. Até logo, ${n}! 👋`); setNome(''); await carregar(); }
    } catch { setErro('Sem conexão.'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <Card style={{ marginBottom: 14, background: C.panel2 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Ponto</div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>Ao chegar, escreva seu nome e toque em <b style={{ color: C.text }}>Entrada</b>. Ao ir embora, toque em <b style={{ color: C.text }}>Saída</b>.</div>
      </Card>

      {msg && <Card style={{ marginBottom: 12, borderColor: C.green }}><div style={{ color: C.green, fontSize: 14, fontWeight: 700 }}>{msg}</div></Card>}
      {erro && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{erro}</div>}

      <Card style={{ marginBottom: 14 }}>
        <Field label="Seu nome"><TextInput value={nome} onChange={setNome} placeholder="Ex.: Maria" /></Field>
        {nomesRecentes.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {nomesRecentes.map((n) => (
              <button key={n} onClick={() => { setNome(n); setErro(''); }} style={{ border: `1px solid ${C.line}`, background: 'transparent', color: C.muted, borderRadius: 999, padding: '6px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{n}</button>
            ))}
          </div>
        )}
        {abertoDoNome ? (
          <>
            <div style={{ fontSize: 13, color: C.amber, fontWeight: 700, marginBottom: 8 }}>Entrada às {horaBR(abertoDoNome.entrada)} — em trabalho.</div>
            <Btn kind="danger" onClick={() => bater('saida')} disabled={busy}>{busy ? '…' : 'Registrar Saída'}</Btn>
          </>
        ) : (
          <Btn kind="ok" onClick={() => bater('entrada')} disabled={busy}>{busy ? '…' : 'Registrar Entrada'}</Btn>
        )}
      </Card>

      {trabalhandoAgora.length > 0 && (
        <Card style={{ marginBottom: 14, borderColor: C.green }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Trabalhando agora ({trabalhandoAgora.length})</div>
          {trabalhandoAgora.map((r) => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14, padding: '4px 0' }}>
              <span style={{ fontWeight: 700 }}>{r.nome}</span>
              <span style={{ color: C.muted }}>desde {horaBR(r.entrada)}</span>
            </div>
          ))}
        </Card>
      )}

      <SecTitle>Pontos de hoje ({doDia.length})</SecTitle>
      {!carregado ? <Empty>Carregando…</Empty> : doDia.length === 0 ? <Empty>Nenhum ponto batido hoje ainda.</Empty> : doDia.map((r) => (
        <Card key={r.id} style={{ marginBottom: 8, padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700 }}>{r.nome}</span>
            <span style={{ fontSize: 13, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{horaBR(r.entrada)} → {r.saida ? horaBR(r.saida) : 'em trabalho'}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}
