'use client';
import React, { useMemo } from 'react';
import { C, Card, SecTitle, PageTitle } from './ui';
import { brl, num, fmtDate, limparNome, fiadoDaVenda } from '../lib/util';

const chaveTxt = (s) => (s || '').trim().toLowerCase();

// Agrupa por uma chave e devolve só os grupos com mais de um item (duplicados).
function duplicados(arr, keyFn) {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    if (k == null) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return [...m.values()].filter((g) => g.length > 1);
}

export default function Auditoria({ receitas = [], despesas = [], compras = [], vendas = [] }) {
  const dupReceitas = useMemo(() => duplicados(
    receitas.filter((r) => num(r.valor) > 0),
    (r) => `${r.data}|${num(r.valor).toFixed(2)}|${chaveTxt(r.categoria)}|${chaveTxt(r.descricao)}`
  ), [receitas]);

  const dupDespesas = useMemo(() => duplicados(
    despesas.filter((d) => num(d.valor) > 0),
    (d) => `${d.data}|${num(d.valor).toFixed(2)}|${chaveTxt(d.categoria)}|${chaveTxt(d.descricao)}`
  ), [despesas]);

  const dupCompras = useMemo(() => duplicados(
    compras,
    (c) => `${c.data}|${chaveTxt(limparNome(c.produto))}|${chaveTxt(limparNome(c.fornecedor))}|${num(c.valorUnit).toFixed(2)}|${num(c.quantidade)}`
  ), [compras]);

  // Dias com receita digitada à mão E vendas de comanda — risco de contar dobrado.
  const overlapCaixa = useMemo(() => {
    const diasVenda = new Set(vendas.map((v) => v.data).filter(Boolean));
    const porDia = {};
    for (const r of receitas) {
      if ((r.categoria || '') === 'Recebimento Atrasado') continue;
      if (r.origem === 'comanda') continue;
      if (!diasVenda.has(r.data)) continue;
      (porDia[r.data] = porDia[r.data] || { data: r.data, receitas: [], manual: 0 }).receitas.push(r);
      porDia[r.data].manual += num(r.valor);
    }
    return Object.values(porDia).map((d) => ({
      ...d,
      vendasDia: vendas.filter((v) => v.data === d.data).reduce((s, v) => s + ((Number(v.total) || 0) - fiadoDaVenda(v)), 0),
    })).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  }, [receitas, vendas]);

  const totalProblemas = dupReceitas.length + dupDespesas.length + dupCompras.length + overlapCaixa.length;

  const Grupo = ({ g, tipo }) => (
    <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 9, marginTop: 9 }}>
      <div style={{ fontSize: 12, color: C.amber, fontWeight: 700, marginBottom: 4 }}>{g.length}× repetido</div>
      {g.map((x, i) => (
        <div key={x.id || i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, padding: '2px 0' }}>
          <span style={{ color: C.text, minWidth: 0 }}>
            {fmtDate(x.data)} · {tipo === 'compra' ? `${limparNome(x.produto)} (${limparNome(x.fornecedor) || 'sem fornecedor'})` : (x.descricao || x.categoria || '—')}
          </span>
          <span style={{ color: C.muted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
            {tipo === 'compra' ? brl(num(x.quantidade) * num(x.valorUnit)) : brl(num(x.valor))}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <PageTitle sub="Procura lançamentos repetidos ou contados dobrado">Auditoria</PageTitle>

      {totalProblemas === 0 ? (
        <Card style={{ borderColor: C.green }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.green }}>Tudo certo por aqui</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Não encontrei lançamentos duplicados nem sobreposição de caixa com as comandas.</div>
        </Card>
      ) : (
        <Card style={{ marginBottom: 14, borderColor: C.amber }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.amber }}>{totalProblemas} ponto(s) pra conferir</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>São <b>possíveis</b> duplicados — confira e, se for repetição, exclua na aba correspondente (Receitas, Despesas, Compras).</div>
        </Card>
      )}

      {overlapCaixa.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <SecTitle>Caixa manual + comandas ({overlapCaixa.length})</SecTitle>
          <Card style={{ marginBottom: 14, padding: 14 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Nesses dias você tem receita digitada à mão E vendas de comanda. Se o valor manual já inclui o que passou pelas comandas, está contando dobrado.</div>
            {overlapCaixa.map((d) => (
              <div key={d.data} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, borderTop: `1px solid ${C.line}`, paddingTop: 8, marginTop: 8 }}>
                <span style={{ color: C.text }}>{fmtDate(d.data)}</span>
                <span style={{ color: C.muted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>manual {brl(d.manual)} · comandas {brl(d.vendasDia)}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {dupReceitas.length > 0 && (
        <div>
          <SecTitle>Receitas repetidas ({dupReceitas.length})</SecTitle>
          <Card style={{ marginBottom: 14, padding: 14 }}>{dupReceitas.map((g, i) => <Grupo key={i} g={g} tipo="receita" />)}</Card>
        </div>
      )}

      {dupDespesas.length > 0 && (
        <div>
          <SecTitle>Despesas repetidas ({dupDespesas.length})</SecTitle>
          <Card style={{ marginBottom: 14, padding: 14 }}>{dupDespesas.map((g, i) => <Grupo key={i} g={g} tipo="despesa" />)}</Card>
        </div>
      )}

      {dupCompras.length > 0 && (
        <div>
          <SecTitle>Compras repetidas ({dupCompras.length})</SecTitle>
          <Card style={{ marginBottom: 14, padding: 14 }}>{dupCompras.map((g, i) => <Grupo key={i} g={g} tipo="compra" />)}</Card>
        </div>
      )}
    </div>
  );
}
