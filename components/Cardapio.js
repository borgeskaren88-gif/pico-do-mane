'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, Field, TextInput, NumInput, Select, Empty, SecTitle, PageTitle, inputStyle } from './ui';
import { brl, num, uid, limparNome } from '../lib/util';
import { UNIDADES, qtdNaUnidadeDoItem, conversaoDaReceita } from '../lib/estoque';

export const CATEGORIAS_CARDAPIO = ['Chopp / Cerveja', 'Drinks / Doses', 'Carta de Vinhos', 'Porções', 'Café & Tapiocas', 'Não alcoólicos', 'Sobremesas', 'Tabacaria', 'Combos', 'Outros'];

const itemVazio = () => ({ nome: '', preco: '', categoria: '', sabores: [], saboresTotal: '', adicionais: [] });

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

  // Adicionais pagos (ex.: açaí + granola, leite condensado…). Cada um tem o
  // seu preço e, se quiser, o item do estoque que baixa junto.
  const addAdicional = () => setNovo((f) => ({ ...f, adicionais: [...(f.adicionais || []), { nome: '', preco: '3', estoqueId: '', qtd: '', unidade: '' }] }));
  const setAdicional = (i, patch) => setNovo((f) => ({ ...f, adicionais: (f.adicionais || []).map((a, j) => (j === i ? { ...a, ...patch } : a)) }));
  const removerAdicional = (i) => setNovo((f) => ({ ...f, adicionais: (f.adicionais || []).filter((_, j) => j !== i) }));

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
    const nomeLimpo = limparNome(novo.nome);
    // Avisa se já existe um item com esse nome (evita duplicar sem querer, ex.: narguilé).
    if (!editId && dados.some((i) => (i.nome || '').trim().toLowerCase() === nomeLimpo.toLowerCase())) {
      if (typeof window !== 'undefined' && !window.confirm(`Já existe um item chamado "${nomeLimpo}" no cardápio. Quer mesmo criar outro igual?`)) return;
    }
    const saboresLimpos = (novo.sabores || [])
      .map((s) => ({ nome: limparNome(s.nome), estoqueId: String(s.estoqueId || ''), qtd: String(s.qtd || ''), unidade: String(s.unidade || '') }))
      .filter((s) => s.nome && s.estoqueId && num(s.qtd) > 0);
    // Total de escolhas por sabor (combo): >0 = o garçom distribui N unidades
    // entre os sabores (ex.: 5 energéticos = 3 Tropical + 2 Melancia). Vazio/0 =
    // escolhe 1 sabor só (ex.: caipirinha).
    const total = Math.max(0, Math.floor(num(novo.saboresTotal)));
    const adicionaisLimpos = (novo.adicionais || [])
      .map((a) => ({ nome: limparNome(a.nome), preco: String(a.preco || '0'), estoqueId: String(a.estoqueId || ''), qtd: String(a.qtd || ''), unidade: String(a.unidade || '') }))
      .filter((a) => a.nome);
    const limpo = { nome: nomeLimpo, preco: novo.preco || '0', categoria: novo.categoria, sabores: saboresLimpos, saboresTotal: saboresLimpos.length ? total : 0, adicionais: adicionaisLimpos };
    if (editId) onChange(dados.map((i) => (i.id === editId ? { ...i, ...limpo } : i)));
    else onChange([{ id: uid(), ...limpo, ativo: true }, ...dados]);
    setNovo(itemVazio()); setEditId(null);
  };
  const editar = (it) => { setNovo({ nome: it.nome || '', preco: it.preco || '', categoria: it.categoria || '', sabores: Array.isArray(it.sabores) ? it.sabores.map((s) => ({ ...s })) : [], saboresTotal: it.saboresTotal ? String(it.saboresTotal) : '', adicionais: Array.isArray(it.adicionais) ? it.adicionais.map((a) => ({ ...a })) : [] }); setEditId(it.id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
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
          <Field label="Cliente escolhe quantas no total? (combo)">
            <NumInput value={novo.saboresTotal} onChange={set('saboresTotal')} placeholder="Ex.: 5 — deixe vazio p/ escolher 1 sabor só" />
          </Field>
          {num(novo.saboresTotal) > 0
            ? <div style={{ fontSize: 12, color: C.accent, marginBottom: 10, lineHeight: 1.45 }}>Modo combo: na venda o garçom distribui <b>{Math.floor(num(novo.saboresTotal))}</b> unidades entre os sabores (ex.: 3 + 2). Em cada sabor abaixo, ponha a quantidade de <b>1 unidade</b> (ex.: 1 lata).</div>
            : <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.45 }}>Vazio = o garçom escolhe <b>1 sabor</b> por item (ex.: caipirinha).</div>}
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

              {/* O QUE ESSA QUANTIDADE SIGNIFICA — em dinheiro e em quantos
                  saem da embalagem.
                  ============================================================
                  "Uma caixa de essência vem 50 g, aí não sei quanto vai
                  exatamente."

                  Ela não tem como saber, e não deveria precisar: ninguém pesa
                  essência no meio do salão. O que ela SABE (ou consegue
                  observar numa noite) é quantos narguilés saem de uma caixa.

                  Então a tela passa a mostrar as duas leituras do mesmo número.
                  Ela digita uma grama qualquer, lê "a caixa rende 4" e "R$ 2,19
                  cada", e vai ajustando até bater com o que acontece no bar. O
                  palpite vira um botão de sintonia, em vez de um chute cego que
                  só aparece errado três meses depois, no CMV. */}
              {(() => {
                const it = estoque.find((x) => x && x.id === s.estoqueId);
                if (!it || !(num(s.qtd) > 0) || !s.unidade) return null;
                const conv = conversaoDaReceita(s.unidade, it);
                if (!conv.ok) {
                  return (
                    <div style={{ fontSize: 11.5, color: C.amber, lineHeight: 1.45, marginTop: -4, marginBottom: 6 }}>
                      Não dá pra converter <b>{s.unidade}</b> para <b>{it.unidade}</b> ({it.nome}).
                      {' '}Preenche o conteúdo de cada {it.unidade} em {s.unidade} no Estoque — senão a conta vira chute.
                    </div>
                  );
                }
                const naUnidade = qtdNaUnidadeDoItem(num(s.qtd), s.unidade, it);
                const custo = naUnidade * num(it.custo);
                const rende = naUnidade > 0 ? 1 / naUnidade : 0;
                const fmt = (v, casas = 2) => Number(v.toFixed(casas)).toLocaleString('pt-BR', { maximumFractionDigits: casas });
                return (
                  <div style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.5, marginTop: -4, marginBottom: 6 }}>
                    {fmt(num(s.qtd), 3)} {s.unidade} = <b style={{ color: C.muted }}>{fmt(naUnidade, 3)} {it.unidade}</b>
                    {num(it.custo) > 0
                      ? <> · <b style={{ color: C.green }}>{brl(custo)}</b> {num(novo.saboresTotal) > 0 ? 'por unidade' : 'por venda'}</>
                      : <> · <b style={{ color: C.amber }}>sem custo cadastrado</b> — o CMV ignora este sabor</>}
                    {rende > 0 && rende < 1000 && (num(novo.saboresTotal) > 0
                      // NO COMBO, "rende" precisa dizer rende O QUÊ.
                      //
                      // A dose de um narguilé é dividida em pedaços (2 metades,
                      // 4 quartos) pra o cliente poder misturar sabores. Aí
                      // "1 cx rende 8" é verdade e engana: são 8 PEDAÇOS, que
                      // dão 4 narguilés. O número que ela quer conferir é o
                      // segundo — é o que ela vê a caixa render no bar.
                      ? <> · 1 {it.unidade} rende <b style={{ color: C.muted }}>{fmt(rende, 1)}</b> unidade(s) = <b style={{ color: C.muted }}>{fmt(rende / Math.max(1, Math.floor(num(novo.saboresTotal))), 1)}</b> venda(s) inteira(s)</>
                      : <> · 1 {it.unidade} rende <b style={{ color: C.muted }}>{fmt(rende, 1)}</b></>
                    )}
                  </div>
                );
              })()}

              <button onClick={() => removerSabor(i)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '4px 0' }}>Remover sabor</button>
            </div>
          ))}
          <Btn kind="ghost" small onClick={addSabor}>+ Adicionar sabor</Btn>
        </div>

        {/* Adicionais pagos (opcional) */}
        <div style={{ marginTop: 4, marginBottom: 12, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Adicionais pagos (opcional)</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.45 }}>
            Pra item que a pessoa incrementa (açaí + granola, leite condensado, morango…). Na venda o garçom marca os que ela quis e o <b style={{ color: C.text }}>preço soma sozinho</b>. Se ligar o adicional a um item do estoque, ele também <b style={{ color: C.text }}>baixa junto</b>.
          </div>
          {(novo.adicionais || []).map((a, i) => (
            <div key={i} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, marginBottom: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 10 }}>
                <Field label="Nome do adicional"><TextInput value={a.nome} onChange={(v) => setAdicional(i, { nome: v })} placeholder="Ex.: Granola" /></Field>
                <Field label="Preço (R$)"><NumInput value={a.preco} onChange={(v) => setAdicional(i, { preco: v })} /></Field>
              </div>
              <Field label="Baixa do estoque (opcional)">
                <select value={a.estoqueId} onChange={(e) => setAdicional(i, { estoqueId: e.target.value })} style={{ ...inputStyle, appearance: 'none' }}>
                  <option value="">Não baixa do estoque</option>
                  {estoqueOrdenado.map((it) => <option key={it.id} value={it.id}>{it.nome} ({it.unidade})</option>)}
                </select>
              </Field>
              {a.estoqueId && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="Quantidade"><NumInput value={a.qtd} onChange={(v) => setAdicional(i, { qtd: v })} /></Field>
                  <Field label="Unidade"><Select value={a.unidade} onChange={(v) => setAdicional(i, { unidade: v })} options={UNIDADES} /></Field>
                </div>
              )}
              <button onClick={() => removerAdicional(i)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '4px 0' }}>Remover adicional</button>
            </div>
          ))}
          <Btn kind="ghost" small onClick={addAdicional}>+ Adicionar adicional</Btn>
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
