'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { C, Card, Btn, KPI, Empty, SecTitle, PageTitle } from './ui';
import { brl, num, fmtDate, fiadoDaVenda } from '../lib/util';

const norm = (s) => (s || '').trim().toLowerCase();

export default function Fiados({ onMudou, clientes = [] }) {
  const [vendas, setVendas] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [verPagos, setVerPagos] = useState(false);
  const [itensAbertos, setItensAbertos] = useState({}); // { [vendaId]: true } — mostra os itens
  const [abertoCliente, setAbertoCliente] = useState({}); // { [chave]: true } — abre o histórico do cliente

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/vendas', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) { setVendas(Array.isArray(j.vendas) ? j.vendas : []); setErro(''); }
      else setErro(j.erro || 'Erro ao carregar.');
    } catch { setErro('Sem conexão.'); }
    finally { setCarregado(true); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const acao = async (payload) => {
    setBusy(true);
    try {
      const r = await fetch('/api/vendas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!j.ok) { setErro(j.erro || 'Erro.'); return; }
      await carregar();
      if (onMudou) onMudou();
    } catch { setErro('Sem conexão.'); }
    finally { setBusy(false); }
  };
  const receber = (id) => acao({ acao: 'receber', id });
  const excluir = (id) => { if (typeof window !== 'undefined' && !window.confirm('Excluir este fiado? Não vai mais aparecer nem contar em lugar nenhum.')) return; acao({ acao: 'excluir', id }); };
  const toggleItens = (id) => setItensAbertos((m) => ({ ...m, [id]: !m[id] }));

  const limiteDe = (nome) => { const c = clientes.find((x) => norm(x.nome) === norm(nome)); return c ? num(c.limite) : 0; };
  const rotulo = (nome, mesa) => (nome && nome.trim()) || `Mesa ${mesa}`;

  const fiados = vendas.filter((v) => fiadoDaVenda(v) > 0.005);
  const abertos = fiados.filter((v) => !v.pago);
  const pagos = fiados.filter((v) => v.pago).sort((a, b) => (b.pagoEm || '').localeCompare(a.pagoEm || ''));
  const totalDevido = abertos.reduce((s, v) => s + fiadoDaVenda(v), 0);

  // Agrupa os fiados em aberto por cliente (nome), com as compras por data.
  const grupos = useMemo(() => {
    const map = new Map();
    for (const v of abertos) {
      const k = norm(v.nome) || `mesa:${v.mesa}:${v.id}`;
      let g = map.get(k);
      if (!g) { g = { chave: k, nome: rotulo(v.nome, v.mesa), total: 0, vendas: [] }; map.set(k, g); }
      g.total += fiadoDaVenda(v);
      g.vendas.push(v);
    }
    for (const g of map.values()) {
      g.vendas.sort((a, b) => (b.fechadaEm || b.data || '').localeCompare(a.fechadaEm || a.data || ''));
      g.limite = limiteDe(g.nome);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [vendas, clientes]);

  const itensDe = (v) => (Array.isArray(v.itens) ? v.itens : []);

  return (
    <div>
      <PageTitle sub="Quem está devendo (contas fechadas no fiado)">Fiados</PageTitle>

      <KPI titulo="Total a receber" valor={brl(totalDevido)} cor={totalDevido > 0 ? C.amber : C.faint} sub={`${grupos.length} cliente(s) · ${abertos.length} fiado(s)`} />

      {erro && <div style={{ fontSize: 13, color: C.red, margin: '10px 0' }}>{erro}</div>}

      <div style={{ marginTop: 16 }}>
        <SecTitle>Em aberto ({grupos.length})</SecTitle>
        {!carregado ? <Empty>Carregando…</Empty> :
          grupos.length === 0 ? <Empty>Ninguém devendo.<br />Contas fechadas no fiado aparecem aqui pra você cobrar.</Empty> :
            grupos.map((g) => {
              const pct = g.limite > 0 ? Math.min(1, g.total / g.limite) : 0;
              const noLimite = g.limite > 0 && g.total >= g.limite - 0.005;
              const cor = noLimite ? C.red : C.amber;
              return (
                <Card key={g.chave} style={{ marginBottom: 10, padding: 14 }}>
                  {/* Clicar no nome abre/fecha o histórico (datas + consumo) do cliente. */}
                  <button onClick={() => setAbertoCliente((m) => ({ ...m, [g.chave]: !m[g.chave] }))} style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, textAlign: 'left' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, minWidth: 0, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: C.accent, fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{abertoCliente[g.chave] ? '▾' : '▸'}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.nome}</span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: cor, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl(g.total)}</div>
                  </button>
                  {/* Gráfico do limite: o quanto está chegando no teto de fiado. */}
                  {g.limite > 0 ? (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ height: 8, background: C.panel2, borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: (pct * 100) + '%', height: '100%', background: cor, borderRadius: 999 }} />
                      </div>
                      <div style={{ fontSize: 11, marginTop: 4, color: noLimite ? C.red : C.faint, fontWeight: noLimite ? 700 : 400 }}>
                        {Math.round(pct * 100)}% de {brl(g.limite)}{noLimite ? ' · no limite' : ` · falta ${brl(Math.max(0, g.limite - g.total))}`}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: C.faint, marginTop: 6 }}>sem limite cadastrado</div>
                  )}

                  {/* Histórico (datas + consumo): fica escondido e abre ao clicar no nome. */}
                  {!abertoCliente[g.chave] ? (
                    <div style={{ fontSize: 12, color: C.faint, marginTop: 10 }}>{g.vendas.length} fiado(s) · toque no nome pra ver as datas e o que consumiu</div>
                  ) : (
                  <div style={{ marginTop: 12, borderTop: `1px solid ${C.line}`, paddingTop: 4 }}>
                    {g.vendas.map((v) => {
                      const aberto = itensAbertos[v.id];
                      const itens = itensDe(v);
                      return (
                        <div key={v.id} style={{ borderTop: `1px solid ${C.line}`, paddingTop: 9, marginTop: 9 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>{fmtDate(v.data)} · mesa {v.mesa}</div>
                              {itens.length > 0 && (
                                <button onClick={() => toggleItens(v.id)} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '2px 0' }}>
                                  {aberto ? 'ocultar itens' : `ver itens (${itens.length})`}
                                </button>
                              )}
                            </div>
                            <div style={{ fontWeight: 800, color: C.amber, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl(fiadoDaVenda(v))}</div>
                          </div>
                          {aberto && itens.length > 0 && (
                            <div style={{ marginTop: 6, marginLeft: 2, padding: '8px 10px', background: C.panel2, borderRadius: 8 }}>
                              {itens.map((it, i) => (
                                <div key={it.id || i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, padding: '2px 0' }}>
                                  <span style={{ color: C.text, minWidth: 0 }}>{it.qtd}× {it.nome}</span>
                                  <span style={{ color: C.muted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl((Number(it.qtd) || 0) * num(it.preco))}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
                            <Btn kind="ok" small onClick={() => receber(v.id)} disabled={busy}>Recebi</Btn>
                            <Btn kind="danger" small onClick={() => excluir(v.id)} disabled={busy}>Excluir</Btn>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  )}
                </Card>
              );
            })}
      </div>

      {pagos.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <button onClick={() => setVerPagos((x) => !x)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: 0 }}>
            {verPagos ? '▾' : '▸'} Já recebidos ({pagos.length})
          </button>
          {verPagos && (
            <div style={{ marginTop: 10 }}>
              {pagos.slice(0, 40).map((v) => (
                <Card key={v.id} style={{ marginBottom: 6, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.faint }}>{rotulo(v.nome, v.mesa)}</div>
                      <div style={{ fontSize: 12, color: C.faint }}>Recebido {v.pagoEm ? fmtDate(v.pagoEm) : ''} · compra {fmtDate(v.data)}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: C.green, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl(fiadoDaVenda(v))}</div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
