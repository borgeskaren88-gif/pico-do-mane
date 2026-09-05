'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { C, Card, Btn, KPI, Empty, SecTitle, PageTitle } from './ui';
import { brl, num, fmtDate, uid, diaOperacional, fiadoDaVenda, abertoDaVenda } from '../lib/util';

const norm = (s) => (s || '').trim().toLowerCase();

const FONTE_ATRASADO = 'Recebimento Atrasado';

export default function Fiados({ onMudou, clientes = [], receitas = null, onReceitas = null }) {
  const [vendas, setVendas] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [verPagos, setVerPagos] = useState(false);
  const [itensAbertos, setItensAbertos] = useState({}); // { [vendaId]: true } — mostra os itens
  const [abertoCliente, setAbertoCliente] = useState({}); // { [chave]: true } — abre o histórico do cliente
  const [pagarAberto, setPagarAberto] = useState({}); // { [chave]: true } — abre o campo "receber valor"
  const [valorPago, setValorPago] = useState({}); // { [chave]: 'texto do valor' }
  const [caixaAberto, setCaixaAberto] = useState(null); // null=ainda não sei, true/false
  const [ultima, setUltima] = useState(null); // última baixa: { ref, nome, valor } — pra desfazer

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

  // Saber se há caixa aberto — pra avisar antes de dar baixa (o fiado recebido só
  // entra no caixa do dia se o caixa estiver aberto na hora).
  const verCaixa = useCallback(async () => {
    try { const r = await fetch('/api/caixa', { cache: 'no-store' }); const j = await r.json(); if (j.ok) setCaixaAberto(!!j.aberto); } catch { /* ignora */ }
  }, []);
  useEffect(() => { verCaixa(); }, [verCaixa]);

  // Se não há caixa aberto, avisa e deixa a dona escolher receber assim mesmo.
  // Retorna true se pode seguir.
  const confirmaSemCaixa = () => {
    if (caixaAberto) return true;
    if (typeof window === 'undefined') return true;
    return window.confirm('Não há caixa aberto agora. Se receber assim, o valor NÃO vai entrar no caixa do dia.\n\nO ideal é abrir o caixa antes (aba Caixa) e depois dar baixa no fiado.\n\nReceber mesmo assim?');
  };

  const acao = async (payload) => {
    setBusy(true);
    try {
      const r = await fetch('/api/vendas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!j.ok) { setErro(j.erro || 'Erro.'); return j; }
      await carregar();
      verCaixa();
      if (onMudou) onMudou();
      return j;
    } catch { setErro('Sem conexão.'); return null; }
    finally { setBusy(false); }
  };
  // Toda baixa de fiado já entra em Receitas como "Recebimento Atrasado", na
  // data de hoje (dia operacional: madrugada conta como a noite anterior). A
  // etiqueta (ref) liga o lançamento à baixa, pra o Desfazer levar os dois.
  const lancarReceita = (ref, nome, valor) => {
    if (!onReceitas || !Array.isArray(receitas) || !(valor > 0.005)) return;
    onReceitas([{
      id: uid(), data: diaOperacional(), categoria: FONTE_ATRASADO,
      descricao: `Fiado recebido — ${nome}`, valor: Math.round(valor * 100) / 100, obs: '', refFiado: ref,
    }, ...receitas]);
  };

  const desfazerUltima = async () => {
    if (!ultima) return;
    const alvo = ultima;
    setBusy(true);
    try {
      const r = await fetch('/api/vendas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'desfazer', ref: alvo.ref }) });
      const j = await r.json();
      if (!j.ok) { setErro(j.erro || 'Não consegui desfazer.'); return; }
      // Tira também o lançamento que essa baixa criou em Receitas.
      if (onReceitas && Array.isArray(receitas)) onReceitas(receitas.filter((x) => x && x.refFiado !== alvo.ref));
      setUltima(null);
      await carregar();
      verCaixa();
      if (onMudou) onMudou();
    } catch { setErro('Sem conexão.'); }
    finally { setBusy(false); }
  };

  const receber = async (id) => {
    if (!confirmaSemCaixa()) return;
    const v = vendas.find((x) => x.id === id);
    const nome = v ? rotulo(v.nome, v.mesa) : 'cliente';
    const valor = v ? abertoDaVenda(v) : 0;
    const ref = uid();
    const j = await acao({ acao: 'receber', id, ref });
    if (j && j.ok) { lancarReceita(ref, nome, num(j.aplicado) || valor); setUltima({ ref, nome, valor: num(j.aplicado) || valor }); }
  };
  const excluir = (id) => { if (typeof window !== 'undefined' && !window.confirm('Excluir este fiado? Não vai mais aparecer nem contar em lugar nenhum.')) return; acao({ acao: 'excluir', id }); };
  const toggleItens = (id) => setItensAbertos((m) => ({ ...m, [id]: !m[id] }));

  // Recebe um VALOR do cliente e abate dos fiados dele (do mais antigo pro mais
  // novo). Se o valor cobre tudo, quita todos; senão deixa o resto em aberto.
  const receberValor = async (g) => {
    const valor = num(valorPago[g.chave]);
    if (!(valor > 0)) { setErro('Digite quanto o cliente pagou.'); return; }
    if (valor > g.total + 0.005 && typeof window !== 'undefined' &&
        !window.confirm(`O valor (${brl(valor)}) é maior que a dívida (${brl(g.total)}). Vou quitar tudo e o resto (${brl(valor - g.total)}) fica como troco. Continuar?`)) return;
    if (!confirmaSemCaixa()) return;
    const ref = uid();
    const j = await acao({ acao: 'receberValor', ids: g.vendas.map((v) => v.id), valor, ref });
    if (j && j.ok) {
      const entrou = num(j.aplicado) || valor;
      lancarReceita(ref, g.nome, entrou);
      setUltima({ ref, nome: g.nome, valor: entrou });
    }
    setValorPago((m) => ({ ...m, [g.chave]: '' }));
    setPagarAberto((m) => ({ ...m, [g.chave]: false }));
  };

  const limiteDe = (nome) => { const c = clientes.find((x) => norm(x.nome) === norm(nome)); return c ? num(c.limite) : 0; };
  const rotulo = (nome, mesa) => (nome && nome.trim()) || `Mesa ${mesa}`;

  const fiados = vendas.filter((v) => fiadoDaVenda(v) > 0.005);
  const abertos = fiados.filter((v) => !v.pago);
  const pagos = fiados.filter((v) => v.pago).sort((a, b) => (b.pagoEm || '').localeCompare(a.pagoEm || ''));
  const totalDevido = abertos.reduce((s, v) => s + abertoDaVenda(v), 0);

  // Agrupa os fiados em aberto por cliente (nome), com as compras por data.
  const grupos = useMemo(() => {
    const map = new Map();
    for (const v of abertos) {
      const k = norm(v.nome) || `mesa:${v.mesa}:${v.id}`;
      let g = map.get(k);
      if (!g) { g = { chave: k, nome: rotulo(v.nome, v.mesa), total: 0, vendas: [] }; map.set(k, g); }
      g.total += abertoDaVenda(v);
      g.vendas.push(v);
    }
    for (const g of map.values()) {
      g.vendas.sort((a, b) => (b.fechadaEm || b.data || '').localeCompare(a.fechadaEm || a.data || ''));
      g.limite = limiteDe(g.nome);
    }
    return [...map.values()].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));
  }, [vendas, clientes]);

  const itensDe = (v) => (Array.isArray(v.itens) ? v.itens : []);

  return (
    <div>
      <PageTitle sub="Quem está devendo (contas fechadas no fiado)">Fiados</PageTitle>

      <KPI titulo="Total a receber" valor={brl(totalDevido)} cor={totalDevido > 0 ? C.amber : C.faint} sub={`${grupos.length} cliente(s) · ${abertos.length} fiado(s)`} />

      {ultima && (
        <div style={{ background: C.panel2, border: `1px solid ${C.green}`, borderRadius: 10, padding: '11px 14px', marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: C.text, lineHeight: 1.45, flex: 1, minWidth: 180 }}>
            Recebi <b>{brl(ultima.valor)}</b> de <b>{ultima.nome}</b> — já lancei em Receitas como <b>Recebimento Atrasado</b>.
          </span>
          <Btn kind="ghost" small onClick={desfazerUltima} disabled={busy}>Desfazer</Btn>
          <button onClick={() => setUltima(null)} aria-label="Fechar aviso" style={{ background: 'none', border: 'none', color: C.faint, fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: '0 2px' }}>×</button>
        </div>
      )}

      {caixaAberto === false && grupos.length > 0 && (
        <div style={{ background: C.panel2, border: `1px solid ${C.amber}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: C.text, marginTop: 12, lineHeight: 1.45 }}>
          <b style={{ color: C.amber }}>Caixa fechado.</b> Pra o dinheiro recebido entrar no caixa do dia, abra o caixa (aba Caixa) antes de dar baixa no fiado.
        </div>
      )}

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

                  {/* Receber um valor e abater da conta do cliente (sem ir compra por compra). */}
                  <div style={{ marginTop: 12 }}>
                    {!pagarAberto[g.chave] ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Btn kind="ok" small onClick={() => setPagarAberto((m) => ({ ...m, [g.chave]: true }))} disabled={busy}>Receber valor</Btn>
                      </div>
                    ) : (
                      <div style={{ background: C.panel2, borderRadius: 10, padding: 10 }}>
                        <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Quanto {g.nome} pagou agora? (abate do total de {brl(g.total)})</div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="text" inputMode="decimal" placeholder="R$ 0,00" autoFocus
                            value={valorPago[g.chave] || ''}
                            onChange={(e) => setValorPago((m) => ({ ...m, [g.chave]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') receberValor(g); }}
                            style={{ flex: 1, minWidth: 0, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: '9px 12px', color: C.text, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}
                          />
                          <Btn kind="ok" small onClick={() => receberValor(g)} disabled={busy}>Pagar</Btn>
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                          <button onClick={() => setValorPago((m) => ({ ...m, [g.chave]: String(g.total).replace('.', ',') }))} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}>quitar tudo ({brl(g.total)})</button>
                          <button onClick={() => { setPagarAberto((m) => ({ ...m, [g.chave]: false })); setValorPago((m) => ({ ...m, [g.chave]: '' })); }} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}>cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>

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
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontWeight: 800, color: C.amber, fontVariantNumeric: 'tabular-nums' }}>{brl(abertoDaVenda(v))}</div>
                              {num(v.abatido) > 0.005 && <div style={{ fontSize: 11, color: C.green, fontVariantNumeric: 'tabular-nums' }}>já pagou {brl(num(v.abatido))}</div>}
                            </div>
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
