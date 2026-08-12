'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, Field, TextInput, NumInput, Empty, SecTitle, PageTitle } from './ui';
import { brl, num, uid, limparNome, fiadoDaVenda } from '../lib/util';

const vazio = () => ({ nome: '', telefone: '', limite: '', bloquear: false });
const norm = (s) => (s || '').trim().toLowerCase();

export default function Clientes({ dados = [], onChange, vendas = [] }) {
  const [novo, setNovo] = useState(vazio());
  const [editId, setEditId] = useState(null);
  const set = (k) => (v) => setNovo((f) => ({ ...f, [k]: v }));

  // Fiado em aberto por cliente (soma dos fiados não recebidos, casando pelo nome).
  const fiadoPorNome = useMemo(() => {
    const m = {};
    for (const v of vendas) {
      if (v.pago) continue;
      const f = fiadoDaVenda(v);
      if (f <= 0.005) continue;
      const k = norm(v.nome);
      if (!k) continue;
      m[k] = (m[k] || 0) + f;
    }
    return m;
  }, [vendas]);
  const emAberto = (nome) => fiadoPorNome[norm(nome)] || 0;

  const salvar = () => {
    if (!novo.nome.trim()) return;
    const limpo = { nome: limparNome(novo.nome), telefone: novo.telefone.trim(), limite: novo.limite, bloquear: !!novo.bloquear };
    if (editId) onChange(dados.map((c) => (c.id === editId ? { ...c, ...limpo } : c)));
    else onChange([{ id: uid(), ...limpo }, ...dados]);
    setNovo(vazio()); setEditId(null);
  };
  const editar = (c) => { setNovo({ nome: c.nome || '', telefone: c.telefone || '', limite: c.limite || '', bloquear: !!c.bloquear }); setEditId(c.id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const cancelar = () => { setNovo(vazio()); setEditId(null); };
  const excluir = (id) => { if (typeof window !== 'undefined' && !window.confirm('Excluir este cliente?')) return; if (id === editId) cancelar(); onChange(dados.filter((c) => c.id !== id)); };

  const ordenados = [...dados].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  return (
    <div>
      <PageTitle sub="Cadastro e limite de fiado por cliente">Clientes</PageTitle>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>{editId ? 'Editar cliente' : 'Novo cliente'}</div>
        <Field label="Nome"><TextInput value={novo.nome} onChange={set('nome')} placeholder="Ex.: João do balcão" /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Telefone (opcional)"><TextInput value={novo.telefone} onChange={set('telefone')} inputMode="tel" placeholder="(00) 00000-0000" /></Field>
          <Field label="Limite de fiado (R$)"><NumInput value={novo.limite} onChange={set('limite')} placeholder="sem limite" /></Field>
        </div>
        <button onClick={() => set('bloquear')(!novo.bloquear)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0 12px', color: C.text }}>
          <span style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, border: `2px solid ${novo.bloquear ? C.accent : C.line}`, background: novo.bloquear ? C.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {novo.bloquear && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#06101F" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 6.5" /></svg>}
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, textAlign: 'left' }}>Bloquear novos fiados ao atingir o limite</span>
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn onClick={salvar}>{editId ? 'Salvar' : 'Adicionar'}</Btn>
          {editId && <Btn kind="ghost" onClick={cancelar}>Cancelar</Btn>}
        </div>
      </Card>

      <SecTitle>Clientes ({dados.length})</SecTitle>
      {dados.length === 0 ? <Empty>Nenhum cliente cadastrado.<br />Cadastre clientes pra controlar o fiado de cada um.</Empty> :
        ordenados.map((c) => {
          const lim = num(c.limite);
          const aberto = emAberto(c.nome);
          const pct = lim > 0 ? Math.min(1, aberto / lim) : 0;
          const noLimite = lim > 0 && aberto >= lim - 0.005;
          return (
            <Card key={c.id} style={{ marginBottom: 10, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{c.nome}</div>
                  <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>
                    {c.telefone ? c.telefone + ' · ' : ''}{lim > 0 ? <>limite {brl(lim)}{c.bloquear ? ' · bloqueia' : ''}</> : 'sem limite de fiado'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => editar(c)} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 4 }}>Editar</button>
                  <button onClick={() => excluir(c.id)} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 4px' }}>×</button>
                </div>
              </div>
              {aberto > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: noLimite ? C.red : C.amber, fontWeight: 700 }}>Fiado em aberto: {brl(aberto)}{noLimite ? (c.bloquear ? ' · no limite (bloqueado)' : ' · no limite') : ''}</span>
                    {lim > 0 && <span style={{ color: C.faint }}>de {brl(lim)}</span>}
                  </div>
                  {lim > 0 && (
                    <div style={{ height: 7, background: C.panel2, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: (pct * 100) + '%', height: '100%', background: noLimite ? C.red : C.amber, borderRadius: 4 }} />
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
    </div>
  );
}
