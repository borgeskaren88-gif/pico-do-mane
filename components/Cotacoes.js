'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, KPI, Field, TextInput, NumInput, Select, Area, Empty, Resumo, SecTitle, PageTitle, inputStyle, Sugestoes } from './ui';
import { brl, num, todayISO, ymOf, weekday, fmtDate, mesLabel, addDays, uid, limparNome, FONTES_RECEITA, CUSTO_VARIAVEL, DESPESA_OPERACIONAL, CATEGORIAS_DESPESA, CATEGORIAS_PRODUTO, DIAS, MESES } from '../lib/util';
import MicBtn from './MicBtn';
import { EMBALAGENS, melhorCompra, precoUnitario, descreveEmbalagem } from '../lib/cotacao';

export default function Cotacoes({ dados, onChange, estoque = [], compras = [] }) {
  // Embalagem + quantas unidades vêm: sem isso, "caixa de 12 a R$ 95" parece
  // mais cara que "unidade a R$ 8,50" — quando é o contrário.
  const vazio = { data: todayISO(), produto: '', fornecedor: '', preco: '', categoria: '', embalagem: 'un', conteudo: '', prazoPag: '', minPedido: '', prazoEntrega: '' };
  const [form, setForm] = useState(vazio);
  const sugestoesProdutos = useMemo(() => [
    ...estoque.map((e) => e && e.nome),
    ...(Array.isArray(dados) ? dados : []).map((c) => c && c.produto),
    ...(Array.isArray(compras) ? compras : []).map((c) => c && c.produto),
  ].filter(Boolean), [estoque, dados, compras]);
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
    setForm({
      data: d.data || todayISO(), produto: d.produto || '', fornecedor: d.fornecedor || '', preco: d.preco || '',
      categoria: d.categoria || '', embalagem: d.embalagem || 'un', conteudo: String(d.conteudo ?? ''),
      prazoPag: String(d.prazoPag ?? ''), minPedido: String(d.minPedido ?? ''), prazoEntrega: String(d.prazoEntrega ?? ''),
    });
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
      // Compara por PREÇO POR UNIDADE, não pelo preço da embalagem.
      const precos = grp.registros.map(precoUnitario).filter((p) => p > 0);
      const menor = precos.length ? Math.min(...precos) : 0;
      const maior = precos.length ? Math.max(...precos) : 0;
      const melhor = grp.registros.find((r) => precoUnitario(r) === menor);
      const variacao = menor ? ((maior - menor) / menor) * 100 : 0;
      const veredito = melhorCompra(dados, grp.nome);
      return { ...grp, menor, maior, variacao, melhorFornecedor: limparNome(melhor?.fornecedor), veredito };
    }).filter((grp) => grp.nome.toLowerCase().includes(busca.toLowerCase())).sort((a, b) => b.variacao - a.variacao);
  }, [dados, busca]);

  return (
    <div>
      <PageTitle sub="Compare preços entre fornecedores">Cotações</PageTitle>
      <Resumo items={[
        { t: 'Produtos', v: grupos.length },
        { t: 'Preços cadastrados', v: dados.length },
      ]} />

      <Card style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{editId ? 'Editar cotação' : 'Comparação de fornecedores'}</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>{editId ? 'Ajuste os dados e salve. Corrija o nome (ex.: 750ml), o preço, o fornecedor ou a data.' : 'Cadastre cada preço que você vê. O painel calcula sozinho o menor, o maior, a variação % e o melhor fornecedor por produto.'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Field label="Produto">
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}><TextInput value={form.produto} onChange={set('produto')} placeholder="Comece a digitar — sugere o que já existe" list="cotacoes-produtos" /></div>
              <MicBtn value={form.produto} onChange={set('produto')} />
              <Sugestoes id="cotacoes-produtos" itens={sugestoesProdutos} />
            </div>
          </Field>
          <Field label="Preço (R$)"><NumInput value={form.preco} onChange={set('preco')} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Fornecedor">
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}><TextInput value={form.fornecedor} onChange={set('fornecedor')} placeholder="Ambev, Komprão…" /></div>
              <MicBtn value={form.fornecedor} onChange={set('fornecedor')} />
            </div>
          </Field>
          <Field label="Data"><TextInput type="date" value={form.data} onChange={set('data')} /></Field>
        </div>
        {/* Sem a embalagem não dá pra comparar: o preço de uma caixa de 12 não
            se compara com o de uma unidade.

            MESMA pergunta, MESMA ordem e MESMO exemplo da tela de Compras. O
            campo sempre foi o mesmo (conteudo); só o rótulo divergia — aqui
            perguntava "vêm quantas unidades" (o total) e lá "cada um tem" (o
            de dentro). Parecem opostos, e ela respondeu 30 nos dois lugares
            quando um deles queria 1 barril. Duas perguntas diferentes pra um
            campo só é pedir pra errar. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Cada um tem"><NumInput value={form.conteudo} onChange={set('conteudo')} placeholder="ex: 30" /></Field>
          <Field label="De quê"><Select value={form.embalagem} onChange={set('embalagem')} options={EMBALAGENS} /></Field>
        </div>
        <div style={{ fontSize: 11, color: C.faint, margin: '-6px 0 12px', lineHeight: 1.45 }}>
          O que vem <b>dentro</b> de cada embalagem: barril de <b>30 L</b>, caixa de <b>12 un</b>, pacote de <b>2 kg</b>.
          Unidade avulsa pode deixar em branco. É o que faz a comparação ser honesta: caixa de 12 a R$ 95 sai a <b>R$ 7,92</b> a unidade.
        </div>

        {/* Do FORNECEDOR, não do produto: digita uma vez e vale pras próximas. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Prazo pra pagar (dias)"><NumInput value={form.prazoPag} onChange={set('prazoPag')} placeholder="0 = à vista" /></Field>
          {/* Prazo de ENTREGA: é ele que decide quando repor. Pedir com 1 dia
              de antecedência pra quem leva 5 é o mesmo que não pedir. */}
          <Field label="Demora quantos dias pra entregar"><NumInput value={form.prazoEntrega} onChange={set('prazoEntrega')} placeholder="ex: 3" /></Field>
          <Field label="Pedido mínimo (R$)"><NumInput value={form.minPedido} onChange={set('minPedido')} placeholder="em branco = sem mínimo" /></Field>
        </div>
        <div style={{ fontSize: 11, color: C.faint, margin: '-6px 0 12px', lineHeight: 1.45 }}>
          Esses dois são do <b>fornecedor</b>, não do produto — preenche uma vez e passa a valer pras próximas cotações dele.
        </div>

        <Field label="Categoria"><Select value={form.categoria} onChange={set('categoria')} options={CATEGORIAS_PRODUTO} /></Field>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn onClick={salvar}>{editId ? 'Salvar alteração' : 'Adicionar preço'}</Btn>
          {editId && <Btn kind="ghost" onClick={cancelar}>Cancelar</Btn>}
        </div>
      </Card>

      <div style={{ marginBottom: 8 }}><TextInput value={busca} onChange={setBusca} placeholder="Buscar produto…" /></div>
      <div style={{ fontSize: 12, color: C.faint, marginBottom: 12, lineHeight: 1.4 }}>Toque em <b style={{ color: C.accent }}>Editar</b> num preço para corrigir nome, valor, fornecedor ou data.</div>

      {grupos.length === 0 ? <Empty>Nenhum produto cadastrado ainda.<br />Comece adicionando um preço.</Empty> :
        grupos.map((grp) => (
          <Card key={grp.nome} style={{ marginBottom: 10, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{grp.nome}{grp.categoria && <span style={{ fontSize: 12, color: C.faint, fontWeight: 400 }}> · {grp.categoria}</span>}</div>
              {grp.variacao > 0 && <div style={{ fontSize: 12, color: grp.variacao > 10 ? C.red : C.amber, fontWeight: 700 }}>▲ {grp.variacao.toFixed(1)}%</div>}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap', fontVariantNumeric: 'tabular-nums' }}>
              <div><div style={{ fontSize: 11, color: C.muted }}>Menor por unidade</div><div style={{ color: C.green, fontWeight: 700 }}>{brl(grp.menor)}</div></div>
              <div><div style={{ fontSize: 11, color: C.muted }}>Maior por unidade</div><div style={{ color: C.red, fontWeight: 700 }}>{brl(grp.maior)}</div></div>
              <div><div style={{ fontSize: 11, color: C.muted }}>Melhor fornecedor</div><div style={{ color: C.accent, fontWeight: 700 }}>{grp.melhorFornecedor}</div></div>
            </div>

            {/* O veredito: o que fazer com esses números. */}
            {grp.veredito && (
              <div style={{
                marginTop: 10, borderRadius: 12, padding: '10px 12px', lineHeight: 1.5, fontSize: 12.5,
                background: `color-mix(in srgb, ${grp.veredito.nivel === 'destaque' ? C.green : C.accent} 12%, transparent)`,
                border: `1px solid color-mix(in srgb, ${grp.veredito.nivel === 'destaque' ? C.green : C.accent} 40%, transparent)`,
                color: C.text,
              }}>
                <b style={{ color: grp.veredito.nivel === 'destaque' ? C.green : C.accent }}>Melhor compra: </b>
                {grp.veredito.texto}
              </div>
            )}
            <div style={{ marginTop: 10, borderTop: `1px solid ${C.line}`, paddingTop: 8 }}>
              {grp.registros.sort((a, b) => precoUnitario(a) - precoUnitario(b)).map((r) => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 0', color: C.muted }}>
                  <span style={{ minWidth: 0 }}>
                    {limparNome(r.fornecedor)} <span style={{ color: C.faint }}>· {fmtDate(r.data)}</span>
                    <span style={{ display: 'block', fontSize: 11, color: C.faint }}>{descreveEmbalagem(r)}{num(r.prazoPag) > 0 ? ` · ${num(r.prazoPag)} dias pra pagar` : ''}{num(r.minPedido) > 0 ? ` · mín. ${brl(num(r.minPedido))}` : ''}{num(r.prazoEntrega) > 0 ? ` · entrega em ${num(r.prazoEntrega)}d` : ''}</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <b style={{ color: precoUnitario(r) === grp.menor ? C.green : C.text, fontVariantNumeric: 'tabular-nums' }}>{brl(precoUnitario(r))}<span style={{ fontSize: 10.5, color: C.faint, fontWeight: 400 }}>/un</span></b>
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

