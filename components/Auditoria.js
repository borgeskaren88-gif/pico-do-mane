'use client';
import React, { useMemo, useState } from 'react';
import { C, Card, Btn, SecTitle, PageTitle } from './ui';
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

export default function Auditoria({ receitas = [], despesas = [], compras = [], vendas = [], onMudou }) {
  const [aberto, setAberto] = useState({});
  const [busy, setBusy] = useState(false);
  const excluirVenda = async (id) => {
    if (typeof window !== 'undefined' && !window.confirm('Excluir esta venda de comanda? (use para tirar vendas de teste)')) return;
    setBusy(true);
    try {
      const r = await fetch('/api/vendas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'excluir', id }) });
      const j = await r.json();
      if (j.ok && onMudou) onMudou();
    } catch { /* ignora */ }
    finally { setBusy(false); }
  };
  const hora = (iso) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
  const dupReceitas = useMemo(() => duplicados(
    receitas.filter((r) => num(r.valor) > 0),
    (r) => `${r.data}|${num(r.valor).toFixed(2)}|${chaveTxt(r.categoria)}|${chaveTxt(r.descricao)}`
  ), [receitas]);

  const dupDespesas = useMemo(() => duplicados(
    despesas.filter((d) => num(d.valor) > 0),
    (d) => `${d.data}|${num(d.valor).toFixed(2)}|${chaveTxt(d.categoria)}|${chaveTxt(d.descricao)}`
  ), [despesas]);

  // Itens de compra repetidos (mesma nota, mesmo produto/valor/qtd/vencimento).
  // Ignora boletos parcelados (formaPagto "Prazo"), que têm vencimentos diferentes
  // e NÃO são duplicata.
  const dupCompras = useMemo(() => duplicados(
    compras.filter((c) => chaveTxt(c.formaPagto) !== 'prazo'),
    (c) => `${c.data}|${chaveTxt(limparNome(c.produto))}|${chaveTxt(limparNome(c.fornecedor))}|${num(c.valorUnit).toFixed(2)}|${num(c.quantidade)}|${(c.nota || '').trim()}|${c.vencimento || ''}`
  ), [compras]);

  // Vendas de comanda registradas, por dia. As comandas são OPERACIONAIS e não
  // entram no faturamento (o caixa oficial é lançado à mão). Esta lista serve só
  // pra revisar/excluir vendas de teste — não é um problema de duplicidade.
  const diasComVendas = useMemo(() => {
    const porDia = {};
    for (const v of vendas) {
      if (!v.data) continue;
      (porDia[v.data] = porDia[v.data] || { data: v.data, vendasDia: 0 }).vendasDia += (Number(v.total) || 0);
    }
    return Object.values(porDia).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  }, [vendas]);

  // Soma quanto foi vendido de cada produto num dia (junta os itens de todas as
  // comandas fechadas do dia). Responde "quanto vendi de cada coisa".
  const produtosDoDia = (vd) => {
    const m = new Map();
    for (const v of vd) for (const it of (v.itens || [])) {
      const nome = it.nome || '—';
      const q = Number(it.qtd) || 0;
      if (q <= 0) continue;
      const cur = m.get(nome) || { nome, qtd: 0, total: 0 };
      cur.qtd += q; cur.total += q * (Number(it.preco) || 0); m.set(nome, cur);
    }
    return [...m.values()].sort((a, b) => b.qtd - a.qtd);
  };

  const totalProblemas = dupReceitas.length + dupDespesas.length + dupCompras.length;

  const Grupo = ({ g, tipo }) => (
    <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 9, marginTop: 9 }}>
      <div style={{ fontSize: 12, color: C.amber, fontWeight: 700, marginBottom: 4 }}>{g.length}× repetido</div>
      {g.map((x, i) => (
        <div key={x.id || i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, padding: '2px 0' }}>
          <span style={{ color: C.text, minWidth: 0 }}>
            {fmtDate(x.data)} · {tipo === 'compra' ? `${limparNome(x.produto)}${x.nota ? ` · Nota ${x.nota}` : ''} (${limparNome(x.fornecedor) || 'sem fornecedor'})` : (x.descricao || x.categoria || '—')}
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
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Não encontrei lançamentos duplicados nas receitas, despesas ou compras.</div>
        </Card>
      ) : (
        <Card style={{ marginBottom: 14, borderColor: C.amber }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.amber }}>{totalProblemas} ponto(s) pra conferir</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>São <b>possíveis</b> duplicados — confira e, se for repetição, exclua na aba correspondente (Receitas, Despesas, Compras).</div>
        </Card>
      )}

      {diasComVendas.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <SecTitle>Vendas de comanda ({diasComVendas.length} dia(s))</SecTitle>
          <Card style={{ marginBottom: 14, padding: 14 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>As comandas são só operacionais — <b>não</b> entram no seu faturamento (o caixa oficial é o que você lança à mão). Esta lista é só pra conferir. Se alguma venda foi teste, toque em “ver vendas” e exclua.</div>
            {diasComVendas.map((d) => {
              const vd = vendas.filter((v) => v.data === d.data).sort((a, b) => (a.fechadaEm || '').localeCompare(b.fechadaEm || ''));
              return (
                <div key={d.data} style={{ borderTop: `1px solid ${C.line}`, paddingTop: 8, marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <button onClick={() => setAberto((m) => ({ ...m, [d.data]: !m[d.data] }))} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: 0, textAlign: 'left' }}>
                      {aberto[d.data] ? '▾' : '▸'} {fmtDate(d.data)} · ver vendas ({vd.length})
                    </button>
                    <span style={{ color: C.muted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>comandas {brl(d.vendasDia)}</span>
                  </div>
                  {aberto[d.data] && (() => {
                    const prods = produtosDoDia(vd);
                    const totalItens = prods.reduce((s, p) => s + p.qtd, 0);
                    if (!prods.length) return null;
                    return (
                      <div style={{ marginTop: 8, marginLeft: 14, padding: 10, background: C.panel2, borderRadius: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: C.accent, marginBottom: 6 }}>Produtos vendidos ({totalItens} no total)</div>
                        {prods.map((p) => (
                          <div key={p.nome} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, padding: '3px 0' }}>
                            <span style={{ minWidth: 0, color: C.text }}><b style={{ fontVariantNumeric: 'tabular-nums' }}>{p.qtd}×</b> {p.nome}</span>
                            <span style={{ color: C.muted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl(p.total)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  {aberto[d.data] && vd.map((v) => (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, paddingLeft: 14, marginTop: 6 }}>
                      <span style={{ flex: 1, minWidth: 0, color: C.text }}>Mesa {v.mesa} · {v.pagamento || '—'}{hora(v.fechadaEm) ? ` · ${hora(v.fechadaEm)}` : ''}</span>
                      <span style={{ color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{brl(Number(v.total) || 0)}</span>
                      <Btn kind="danger" small onClick={() => excluirVenda(v.id)} disabled={busy}>Excluir</Btn>
                    </div>
                  ))}
                </div>
              );
            })}
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
          <SecTitle>Itens de compra repetidos ({dupCompras.length})</SecTitle>
          <Card style={{ marginBottom: 14, padding: 14 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>Mesmo item lançado 2× na mesma nota. Não mexe no seu caixa (a despesa está certa), mas bagunça o histórico de preços — vale apagar o repetido na aba Compras/Cotações. Parcelas de boleto não entram aqui.</div>
            {dupCompras.map((g, i) => <Grupo key={i} g={g} tipo="compra" />)}
          </Card>
        </div>
      )}
    </div>
  );
}
