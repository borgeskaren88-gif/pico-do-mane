'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, Field, Select, NumInput, Empty, SecTitle, PageTitle, inputStyle } from './ui';
import { num, uid } from '../lib/util';
import { UNIDADES, podeProduzir } from '../lib/estoque';

// Editor das fichas técnicas: liga cada item do CARDÁPIO aos ingredientes do
// ESTOQUE (com quantidade e unidade). É isso que faz a venda de um prato baixar
// os insumos sozinha. `fichas` é uma lista de { cardapioId, itens:[{estoqueId,
// qtd, unidade}] }.
export default function FichasTecnicas({ cardapio = [], estoque = [], fichas = [], onFichas }) {
  const [abertoId, setAbertoId] = useState(null); // cardapioId com a ficha em edição
  const [ing, setIng] = useState({ estoqueId: '', qtd: '', unidade: '' });

  const fichaDe = (cardapioId) => (fichas.find((f) => f.cardapioId === cardapioId)?.itens) || [];
  const estoqueById = useMemo(() => new Map(estoque.map((e) => [e.id, e])), [estoque]);

  // Salva a lista de ingredientes de um item do cardápio.
  const setFicha = (cardapioId, itens) => {
    const outras = fichas.filter((f) => f.cardapioId !== cardapioId);
    const nova = itens.length ? [...outras, { cardapioId, itens }] : outras;
    onFichas(nova);
  };

  const addIngrediente = (cardapioId) => {
    if (!ing.estoqueId || !(num(ing.qtd) > 0)) return;
    const it = estoqueById.get(ing.estoqueId);
    const unidade = ing.unidade || (it ? it.unidade : 'un');
    const atual = fichaDe(cardapioId);
    // Se o ingrediente já está na ficha, substitui a quantidade.
    const semEle = atual.filter((x) => x.estoqueId !== ing.estoqueId);
    setFicha(cardapioId, [...semEle, { estoqueId: ing.estoqueId, qtd: String(ing.qtd), unidade }]);
    setIng({ estoqueId: '', qtd: '', unidade: '' });
  };
  const removerIngrediente = (cardapioId, estoqueId) => {
    setFicha(cardapioId, fichaDe(cardapioId).filter((x) => x.estoqueId !== estoqueId));
  };

  const abrir = (id) => { setAbertoId(id === abertoId ? null : id); setIng({ estoqueId: '', qtd: '', unidade: '' }); };

  const comFicha = cardapio.filter((c) => fichaDe(c.id).length > 0).length;
  const opcoesEstoque = estoque.map((e) => e.nome);
  const nomeEstoquePorId = (id) => estoqueById.get(id)?.nome || '(item removido)';

  return (
    <div>
      <PageTitle sub="A receita de cada prato — é isso que faz a venda baixar os insumos sozinha">Fichas Técnicas</PageTitle>

      <Card style={{ marginBottom: 14, background: C.panel2 }}>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
          Para cada item do cardápio, diga os ingredientes do <b style={{ color: C.text }}>estoque</b> e quanto usa (ex.: Favorita = 300 g de carne + 200 g de batata). Quando a comanda com esse item fechar, o estoque baixa automático. Compra em kg e receita em g? O app converte sozinho.
        </div>
      </Card>

      {estoque.length === 0 && (
        <Card style={{ marginBottom: 14, borderColor: C.amber }}>
          <div style={{ fontSize: 14, color: C.amber, fontWeight: 700 }}>Cadastre primeiro os ingredientes na aba Estoque</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>As fichas usam os itens do seu estoque (carne, batata, cebola…). Sem eles, não há o que escolher aqui.</div>
        </Card>
      )}

      <SecTitle>Itens do cardápio ({comFicha}/{cardapio.length} com ficha)</SecTitle>
      {cardapio.length === 0 ? (
        <Empty>Seu cardápio está vazio.<br />Cadastre os itens em Central de Operações → Cardápio primeiro.</Empty>
      ) : cardapio.map((c) => {
        const itens = fichaDe(c.id);
        const aberto = abertoId === c.id;
        const rende = itens.length ? podeProduzir(itens, estoque) : null;
        return (
          <Card key={c.id} style={{ marginBottom: 8, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{c.nome}</div>
                <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>
                  {itens.length === 0 ? 'Sem ficha ainda' : `${itens.length} ingrediente(s)`}
                  {rende != null && itens.length > 0 && <span style={{ color: rende > 0 ? C.green : C.red }}> · rende ~{rende}</span>}
                </div>
              </div>
              <Btn kind="ghost" small onClick={() => abrir(c.id)}>{aberto ? 'Fechar' : itens.length ? 'Editar' : 'Criar ficha'}</Btn>
            </div>

            {/* Ingredientes já na ficha */}
            {itens.length > 0 && (
              <div style={{ marginTop: 10, borderTop: `1px solid ${C.hair}`, paddingTop: 8 }}>
                {itens.map((x) => (
                  <div key={x.estoqueId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 14 }}>
                    <span>{nomeEstoquePorId(x.estoqueId)}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <b style={{ fontVariantNumeric: 'tabular-nums' }}>{num(x.qtd)} {x.unidade}</b>
                      {aberto && <button onClick={() => removerIngrediente(c.id, x.estoqueId)} title="Remover" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>×</button>}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Adicionar ingrediente */}
            {aberto && estoque.length > 0 && (
              <div style={{ marginTop: 12, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em', color: C.muted, fontWeight: 700, marginBottom: 8 }}>Adicionar ingrediente</div>
                <Field label="Ingrediente (do estoque)">
                  <select value={ing.estoqueId} onChange={(e) => {
                    const it = estoque.find((x) => x.id === e.target.value);
                    setIng((f) => ({ ...f, estoqueId: e.target.value, unidade: f.unidade || (it ? it.unidade : '') }));
                  }} style={{ ...inputStyle, appearance: 'none' }}>
                    <option value="">Selecione…</option>
                    {estoque.map((e) => <option key={e.id} value={e.id}>{e.nome} ({e.unidade})</option>)}
                  </select>
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="Quantidade por unidade"><NumInput value={ing.qtd} onChange={(v) => setIng((f) => ({ ...f, qtd: v }))} /></Field>
                  <Field label="Unidade"><Select value={ing.unidade} onChange={(v) => setIng((f) => ({ ...f, unidade: v }))} options={UNIDADES} /></Field>
                </div>
                <Btn small onClick={() => addIngrediente(c.id)}>+ Adicionar à ficha</Btn>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
