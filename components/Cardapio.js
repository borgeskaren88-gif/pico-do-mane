'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, Field, TextInput, NumInput, Select, Empty, SecTitle, PageTitle } from './ui';
import { brl, num, uid, limparNome } from '../lib/util';

export const CATEGORIAS_CARDAPIO = ['Chopp / Cerveja', 'Drinks / Doses', 'Porções', 'Não alcoólicos', 'Sobremesas', 'Outros'];

const itemVazio = () => ({ nome: '', preco: '', categoria: '' });

export default function Cardapio({ dados = [], onChange }) {
  const [novo, setNovo] = useState(itemVazio());
  const [editId, setEditId] = useState(null);
  const set = (k) => (v) => setNovo((f) => ({ ...f, [k]: v }));

  // Agrupa por categoria, na ordem do cardápio; "sem categoria" por último.
  const grupos = useMemo(() => {
    const ordem = [...CATEGORIAS_CARDAPIO, ''];
    const map = new Map();
    for (const it of dados) {
      const cat = it.categoria || '';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(it);
    }
    return [...map.entries()]
      .sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0]))
      .map(([cat, itens]) => ({ cat: cat || 'Sem categoria', itens: itens.sort((x, y) => (x.nome || '').localeCompare(y.nome || '')) }));
  }, [dados]);

  const salvar = () => {
    if (!novo.nome.trim()) return;
    const limpo = { nome: limparNome(novo.nome), preco: novo.preco || '0', categoria: novo.categoria };
    if (editId) onChange(dados.map((i) => (i.id === editId ? { ...i, ...limpo } : i)));
    else onChange([{ id: uid(), ...limpo, ativo: true }, ...dados]);
    setNovo(itemVazio()); setEditId(null);
  };
  const editar = (it) => { setNovo({ nome: it.nome || '', preco: it.preco || '', categoria: it.categoria || '' }); setEditId(it.id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const cancelar = () => { setNovo(itemVazio()); setEditId(null); };
  const excluir = (id) => { if (id === editId) cancelar(); onChange(dados.filter((i) => i.id !== id)); };
  const alternarAtivo = (it) => onChange(dados.map((i) => (i.id === it.id ? { ...i, ativo: i.ativo === false ? true : false } : i)));

  const ativos = dados.filter((i) => i.ativo !== false).length;

  return (
    <div>
      <PageTitle sub="Os itens que o garçom lança nas comandas">Cardápio</PageTitle>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>{editId ? 'Editar item' : 'Adicionar item'}</div>
        <Field label="Item"><TextInput value={novo.nome} onChange={set('nome')} placeholder="Chopp 300ml, Porção de frango…" /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
          <Field label="Preço (R$)"><NumInput value={novo.preco} onChange={set('preco')} /></Field>
          <Field label="Categoria"><Select value={novo.categoria} onChange={set('categoria')} options={CATEGORIAS_CARDAPIO} /></Field>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn onClick={salvar}>{editId ? 'Salvar' : 'Adicionar'}</Btn>
          {editId && <Btn kind="ghost" onClick={cancelar}>Cancelar</Btn>}
        </div>
      </Card>

      <SecTitle>Itens do cardápio ({ativos})</SecTitle>
      {dados.length === 0 ? <Empty>Cardápio vazio.<br />Cadastre os itens que você vende — eles é que o garçom vai lançar nas comandas.</Empty> :
        grupos.map((g) => (
          <Card key={g.cat} style={{ marginBottom: 10, padding: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4, color: C.accent }}>{g.cat}</div>
            {g.itens.map((it) => {
              const pausado = it.ativo === false;
              return (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: `1px solid ${C.line}`, paddingTop: 9, marginTop: 9, opacity: pausado ? 0.55 : 1 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, textDecoration: pausado ? 'line-through' : 'none' }}>{it.nome}</div>
                    {pausado && <div style={{ fontSize: 11, color: C.faint }}>pausado (não aparece pro garçom)</div>}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.green, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl(num(it.preco))}</div>
                  <button onClick={() => alternarAtivo(it)} title={pausado ? 'Reativar' : 'Pausar'} style={{ background: 'none', border: 'none', color: pausado ? C.green : C.faint, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 4 }}>{pausado ? 'Reativar' : 'Pausar'}</button>
                  <button onClick={() => editar(it)} title="Editar" style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 4 }}>Editar</button>
                  <button onClick={() => excluir(it.id)} title="Excluir" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 4px' }}>×</button>
                </div>
              );
            })}
          </Card>
        ))}
    </div>
  );
}
