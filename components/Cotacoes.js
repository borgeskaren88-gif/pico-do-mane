'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, KPI, Field, TextInput, NumInput, Select, Area, Empty, Resumo, SecTitle, inputStyle } from './ui';
import { brl, num, todayISO, ymOf, weekday, fmtDate, mesLabel, addDays, uid, limparNome, FONTES_RECEITA, CUSTO_VARIAVEL, DESPESA_OPERACIONAL, CATEGORIAS_DESPESA, CATEGORIAS_PRODUTO, DIAS, MESES } from '../lib/util';

export default function Cotacoes({ dados, onChange }) {
  const vazio = { data: todayISO(), produto: '', fornecedor: '', preco: '', categoria: '' };
  const [form, setForm] = useState(vazio);
  const [editId, setEditId] = useState(null);
  const [busca, setBusca] = useState('');
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const salvar = () => {
    if (!form.produto || !form.fornecedor || !form.preco) return;
    const limpo = { ...form, produto: limparNome(form.produto), fornecedor: limparNome(form.fornecedor) };
    if (editId) {
      onChange(dados.map((d) => (d.id === editId ? { ...limpo, id: editId } : d)));
      setForm(vazio); setEditId(null);
    } else {
      onChange([{ ...limpo, id: uid() }, ...dados]);
      setForm({ ...vazio, produto: form.produto, categoria: form.categoria });
    }
  };
  const editar = (d) => {
    setForm({ data: d.data || todayISO(), produto: d.produto || '', fornecedor: d.fornecedor || '', preco: d.preco || '', categoria: d.categoria || '' });
    setEditId(d.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const cancelar = () => { setForm(vazio); setEditId(null); };
  const excluir = (id) => { if (id === editId) cancelar(); onChange(dados.filter((d) => d.id !== id)); };

  const grupos = useMemo(() => {
    const g = {};
    dados.forEach((d) => {
      const key = limparNome(d.produto).toLowerCase();
      if (!g[key]) g[key] = { nome: limparNome(d.produto), categoria: d.categoria, registros: [] };
      g[key].registros.push(d);
    });
    return Object.values(g).map((grp) => {
      const precos = grp.registros.map((r) => num(r.preco));
      const menor = Math.min(...precos), maior = Math.max(...precos);
      const melhor = grp.registros.find((r) => num(r.preco) === menor);
      const variacao = menor ? ((maior - menor) / menor) * 100 : 0;
      return { ...grp, menor, maior, variacao, melhorFornecedor: limparNome(melhor?.fornecedor) };
    }).filter((grp) => grp.nome.toLowerCase().includes(busca.toLowerCase())).sort((a, b) => b.variacao - a.variacao);
  }, [dados, busca]);

  return (
    <div>
      <Resumo items={[
        { t: 'Produtos', v: grupos.length },
        { t: 'Preços cadastrados', v: dados.length },
      ]} />

      <Card style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{editId ? '✏️ Editar cotação' : 'Comparação de fornecedores'}</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>{editId ? 'Ajuste os dados e salve. Corrija o nome (ex.: 750ml), o preço, o fornecedor ou a data.' : 'Cadastre cada preço que você vê. O painel calcula sozinho o menor, o maior, a variação % e o melhor fornecedor por produto.'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Field label="Produto"><TextInput value={form.produto} onChange={set('produto')} placeholder="Original 600ml…" /></Field>
          <Field label="Preço (R$)"><NumInput value={form.preco} onChange={set('preco')} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Fornecedor"><TextInput value={form.fornecedor} onChange={set('fornecedor')} placeholder="Ambev, Komprão…" /></Field>
          <Field label="Data"><TextInput type="date" value={form.data} onChange={set('data')} /></Field>
        </div>
        <Field label="Categoria"><Select value={form.categoria} onChange={set('categoria')} options={CATEGORIAS_PRODUTO} /></Field>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn onClick={salvar}>{editId ? 'Salvar alteração' : 'Adicionar preço'}</Btn>
          {editId && <Btn kind="ghost" onClick={cancelar}>Cancelar</Btn>}
        </div>
      </Card>

      <div style={{ marginBottom: 8 }}><TextInput value={busca} onChange={setBusca} placeholder="🔎 Buscar produto…" /></div>
      <div style={{ fontSize: 12, color: C.faint, marginBottom: 12, lineHeight: 1.4 }}>💡 Toque em <b style={{ color: C.accent }}>Editar</b> num preço para corrigir nome, valor, fornecedor ou data.</div>

      {grupos.length === 0 ? <Empty>Nenhum produto cadastrado ainda.<br />Comece adicionando um preço.</Empty> :
        grupos.map((grp) => (
          <Card key={grp.nome} style={{ marginBottom: 10, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{grp.nome}{grp.categoria && <span style={{ fontSize: 12, color: C.faint, fontWeight: 400 }}> · {grp.categoria}</span>}</div>
              {grp.variacao > 0 && <div style={{ fontSize: 12, color: grp.variacao > 10 ? C.red : C.amber, fontWeight: 700 }}>▲ {grp.variacao.toFixed(1)}%</div>}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap', fontVariantNumeric: 'tabular-nums' }}>
              <div><div style={{ fontSize: 11, color: C.muted }}>Menor</div><div style={{ color: C.green, fontWeight: 700 }}>{brl(grp.menor)}</div></div>
              <div><div style={{ fontSize: 11, color: C.muted }}>Maior</div><div style={{ color: C.red, fontWeight: 700 }}>{brl(grp.maior)}</div></div>
              <div><div style={{ fontSize: 11, color: C.muted }}>Melhor fornecedor</div><div style={{ color: C.accent, fontWeight: 700 }}>{grp.melhorFornecedor}</div></div>
            </div>
            <div style={{ marginTop: 10, borderTop: `1px solid ${C.line}`, paddingTop: 8 }}>
              {grp.registros.sort((a, b) => num(a.preco) - num(b.preco)).map((r) => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '3px 0', color: C.muted }}>
                  <span>{limparNome(r.fornecedor)} <span style={{ color: C.faint }}>· {fmtDate(r.data)}</span></span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <b style={{ color: num(r.preco) === grp.menor ? C.green : C.text, fontVariantNumeric: 'tabular-nums' }}>{brl(num(r.preco))}</b>
                    <button onClick={() => editar(r)} style={{ background: editId === r.id ? C.accent : 'transparent', color: editId === r.id ? '#06101F' : C.accent, border: `1px solid ${C.accent}`, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '4px 10px' }}>Editar</button>
                    <button onClick={() => excluir(r.id)} title="Excluir" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 4px' }}>×</button>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ))}
    </div>
  );
}

