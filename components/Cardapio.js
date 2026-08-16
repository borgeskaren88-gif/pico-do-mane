'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, Field, TextInput, NumInput, Select, Empty, SecTitle, PageTitle, inputStyle } from './ui';
import { brl, num, uid, limparNome } from '../lib/util';
import { UNIDADES } from '../lib/estoque';

export const CATEGORIAS_CARDAPIO = ['Chopp / Cerveja', 'Drinks / Doses', 'Porções', 'Não alcoólicos', 'Sobremesas', 'Tabacaria', 'Outros'];

const itemVazio = () => ({ nome: '', preco: '', categoria: '', sabores: [] });

export default function Cardapio({ dados = [], onChange, estoque = [] }) {
  const [novo, setNovo] = useState(itemVazio());
  const [editId, setEditId] = useState(null);
  const set = (k) => (v) => setNovo((f) => ({ ...f, [k]: v }));

  const estoqueOrdenado = useMemo(() => [...estoque].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' })), [estoque]);
  // Sabores/variações do item (ex.: caipirinha de morango, maracujá…). Cada
  // sabor aponta pra UMA fruta do estoque, com quantidade. A base (cachaça,
  // açúcar) fica na ficha técnica normal do item.
  const addSabor = () => setNovo((f) => ({ ...f, sabores: [...(f.sabores || []), { nome: '', estoqueId: '', qtd: '', unidade: '' }] }));
  const setSabor = (i, patch) => setNovo((f) => ({ ...f, sabores: (f.sabores || []).map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const removerSabor = (i) => setNovo((f) => ({ ...f, sabores: (f.sabores || []).filter((_, j) => j !== i) }));

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
    const saboresLimpos = (novo.sabores || [])
      .map((s) => ({ nome: limparNome(s.nome), estoqueId: String(s.estoqueId || ''), qtd: String(s.qtd || ''), unidade: String(s.unidade || '') }))
      .filter((s) => s.nome && s.estoqueId && num(s.qtd) > 0);
    const limpo = { nome: limparNome(novo.nome), preco: novo.preco || '0', categoria: novo.categoria, sabores: saboresLimpos };
    if (editId) onChange(dados.map((i) => (i.id === editId ? { ...i, ...limpo } : i)));
    else onChange([{ id: uid(), ...limpo, ativo: true }, ...dados]);
    setNovo(itemVazio()); setEditId(null);
  };
  const editar = (it) => { setNovo({ nome: it.nome || '', preco: it.preco || '', categoria: it.categoria || '', sabores: Array.isArray(it.sabores) ? it.sabores.map((s) => ({ ...s })) : [] }); setEditId(it.id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
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

        {/* Sabores / variações (opcional) */}
        <div style={{ marginTop: 4, marginBottom: 12, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Sabores / variações (opcional)</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.45 }}>
            Pra itens com sabores (caipirinha de limão, maracujá, morango…). O garçom escolhe o sabor na venda e o estoque baixa a <b style={{ color: C.text }}>fruta certa</b>. A base (cachaça/vodka, açúcar) fica na ficha técnica normal.
          </div>
          {(novo.sabores || []).map((s, i) => (
            <div key={i} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, marginBottom: 8 }}>
              <Field label="Nome do sabor"><TextInput value={s.nome} onChange={(v) => setSabor(i, { nome: v })} placeholder="Ex.: Morango" /></Field>
              <Field label="Fruta (do estoque)">
                <select value={s.estoqueId} onChange={(e) => setSabor(i, { estoqueId: e.target.value })} style={{ ...inputStyle, appearance: 'none' }}>
                  <option value="">Selecione…</option>
                  {estoqueOrdenado.map((it) => <option key={it.id} value={it.id}>{it.nome} ({it.unidade})</option>)}
                </select>
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Quantidade"><NumInput value={s.qtd} onChange={(v) => setSabor(i, { qtd: v })} /></Field>
                <Field label="Unidade"><Select value={s.unidade} onChange={(v) => setSabor(i, { unidade: v })} options={UNIDADES} /></Field>
              </div>
              <button onClick={() => removerSabor(i)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '4px 0' }}>Remover sabor</button>
            </div>
          ))}
          <Btn kind="ghost" small onClick={addSabor}>+ Adicionar sabor</Btn>
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
                    {Array.isArray(it.sabores) && it.sabores.length > 0 && <div style={{ fontSize: 11, color: C.accent, fontWeight: 700 }}>{it.sabores.length} sabor(es): {it.sabores.map((s) => s.nome).join(', ')}</div>}
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
