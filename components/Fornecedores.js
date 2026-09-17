'use client';
import React, { useMemo, useState } from 'react';
import { C, Card, Empty, PageTitle } from './ui';
import { brl, num, ymOf, addDays, diaOperacional, limparNome, fmtDate } from '../lib/util';

// Quanto cada fornecedor levou do bar.
//
// A compra sempre soube de quem veio, mas o número ficava espalhado por linha:
// dava pra ver "Ambev R$ 500" numa compra e "Ambev R$ 480" noutra, e nunca o
// total. Aqui é o somatório — que é o número com o qual se negocia.
//
// Só olha COMPRAS (o que tem fornecedor). Aluguel, energia e salário são
// despesas e aparecem no DRE, não aqui.
const PERIODOS = [
  ['mes', 'este mês'],
  ['90', 'últimos 90 dias'],
  ['ano', 'este ano'],
  ['tudo', 'tudo'],
];

export default function Fornecedores({ compras = [] }) {
  const [periodo, setPeriodo] = useState('ano');
  const [aberto, setAberto] = useState('');

  const { linhas, total } = useMemo(() => {
    const hoje = diaOperacional();
    const dentro = (d) => {
      const data = String(d || '');
      if (!data) return false;
      if (periodo === 'mes') return ymOf(data) === ymOf(hoje);
      if (periodo === '90') return data >= addDays(hoje, -90) && data <= hoje;
      if (periodo === 'ano') return data.slice(0, 4) === hoje.slice(0, 4);
      return true;
    };

    const m = new Map();
    let soma = 0;
    for (const c of compras) {
      if (!c || !dentro(c.data)) continue;
      const nome = limparNome(c.fornecedor) || 'Sem fornecedor';
      const valor = num(c.quantidade) * num(c.valorUnit);
      if (!m.has(nome)) m.set(nome, { nome, total: 0, n: 0, ultima: '', aberto: 0, produtos: new Map() });
      const f = m.get(nome);
      f.total += valor;
      f.n += 1;
      if ((c.data || '') > f.ultima) f.ultima = c.data || '';
      if (c.pago !== 'Sim') f.aberto += valor;
      const prod = limparNome(c.produto) || '—';
      f.produtos.set(prod, (f.produtos.get(prod) || 0) + valor);
      soma += valor;
    }
    const arr = [...m.values()].map((f) => ({
      ...f,
      total: Math.round(f.total * 100) / 100,
      aberto: Math.round(f.aberto * 100) / 100,
      itens: [...f.produtos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
    })).sort((a, b) => b.total - a.total);
    return { linhas: arr, total: Math.round(soma * 100) / 100 };
  }, [compras, periodo]);

  const maior = linhas[0]?.total || 0;

  return (
    <div>
      <PageTitle sub="Quanto cada um levou — e é com o maior que vale sentar pra negociar">Fornecedores</PageTitle>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {PERIODOS.map(([v, rot]) => (
          <button key={v} onClick={() => setPeriodo(v)} style={{
            borderRadius: 999, padding: '7px 13px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
            border: `1px solid ${periodo === v ? C.accent : C.line}`,
            background: periodo === v ? C.accent : 'transparent',
            color: periodo === v ? '#06101F' : C.muted,
          }}>{rot}</button>
        ))}
      </div>

      {linhas.length === 0 ? (
        <Empty>Nenhuma compra com fornecedor nesse período.</Empty>
      ) : (
        <>
          <Card style={{ marginBottom: 12, background: C.panel2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: C.muted }}>
                <b style={{ color: C.text }}>{linhas.length}</b> fornecedor(es) · {linhas.reduce((s, f) => s + f.n, 0)} compra(s)
              </span>
              <span style={{ fontSize: 19, fontWeight: 900, color: C.red, fontVariantNumeric: 'tabular-nums' }}>{brl(total)}</span>
            </div>
            {linhas.length > 1 && (
              <div style={{ fontSize: 11.5, color: C.faint, marginTop: 6, lineHeight: 1.5 }}>
                <b style={{ color: C.text }}>{linhas[0].nome}</b> leva {Math.round((linhas[0].total / total) * 100)}% do que tu gasta.
                {' '}É com quem vale sentar pra negociar.
              </div>
            )}
          </Card>

          {linhas.map((f) => {
            const abre = aberto === f.nome;
            const pct = maior > 0 ? Math.round((f.total / maior) * 100) : 0;
            return (
              <Card key={f.nome} style={{ marginBottom: 8, padding: 0, overflow: 'hidden' }}>
                <button onClick={() => setAberto(abre ? '' : f.nome)} style={{ width: '100%', background: 'none', border: 'none', padding: '12px 14px', cursor: 'pointer', textAlign: 'left', display: 'block' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ minWidth: 0, fontSize: 14.5, fontWeight: 800, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nome}</span>
                    <span style={{ flexShrink: 0, fontSize: 15, fontWeight: 900, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{brl(f.total)}</span>
                  </div>
                  {/* Barrinha comparando com o maior: dá pra ver o tamanho de
                      cada um sem ler número por número. */}
                  <div style={{ height: 4, background: C.panel2, borderRadius: 999, overflow: 'hidden', margin: '8px 0 6px' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: C.accent, borderRadius: 999 }} />
                  </div>
                  <div style={{ fontSize: 11.5, color: C.faint, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span>{f.n} compra(s)</span>
                    {f.ultima ? <span>· última {fmtDate(f.ultima)}</span> : null}
                    {f.aberto > 0.005 ? <span style={{ color: C.amber, fontWeight: 800 }}>· {brl(f.aberto)} em aberto</span> : null}
                    <span style={{ marginLeft: 'auto', color: C.accent, fontWeight: 800 }}>{abre ? 'ocultar' : 'o que compro dele'}</span>
                  </div>
                </button>
                {abre && (
                  <div style={{ padding: '0 14px 12px' }}>
                    {f.itens.map(([prod, valor]) => (
                      <div key={prod} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, borderTop: `1px solid ${C.hair}`, padding: '6px 0', fontSize: 13 }}>
                        <span style={{ minWidth: 0, color: C.muted }}>{prod}</span>
                        <span style={{ flexShrink: 0, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{brl(valor)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
