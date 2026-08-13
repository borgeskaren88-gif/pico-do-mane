'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { C, Card, Btn, NumInput, Select, Empty, SecTitle, PageTitle } from './ui';
import { num, fmtDate } from '../lib/util';
import { MOTIVOS_SAIDA } from '../lib/estoque';

// Estoque na visão da COZINHA: ver o que tem, o que está acabando, e fazer as
// ações físicas que são dela (deu entrada de mercadoria, quebrou, contou). O
// cadastro dos itens e as fichas técnicas continuam só com a dona. O que está
// acabando pode ir com um toque pra lista de pedidos (via onRepor).
export default function EstoqueCozinha({ onRepor }) {
  const [itens, setItens] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [acao, setAcao] = useState(null); // { id, tipo }
  const [acaoQtd, setAcaoQtd] = useState('');
  const [acaoMotivo, setAcaoMotivo] = useState(MOTIVOS_SAIDA[0]);
  const [busy, setBusy] = useState(false);
  const [verMov, setVerMov] = useState(null);
  const [reposto, setReposto] = useState('');

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/estoque', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) setItens(Array.isArray(j.itens) ? j.itens : []);
    } catch { /* ignora */ }
    finally { setCarregado(true); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const abaixoDoMin = useMemo(() => itens.filter((it) => num(it.minimo) > 0 && num(it.saldo) <= num(it.minimo)), [itens]);
  const grupos = useMemo(() => {
    const map = new Map();
    for (const it of itens) { const cat = it.categoria || 'Outros'; if (!map.has(cat)) map.set(cat, []); map.get(cat).push(it); }
    return [...map.entries()].map(([cat, is]) => ({ cat, itens: is.sort((a, b) => (a.nome || '').localeCompare(b.nome || '')) }));
  }, [itens]);

  const abrirAcao = (id, tipo) => { setAcao({ id, tipo }); setAcaoQtd(''); setAcaoMotivo(MOTIVOS_SAIDA[0]); };
  const confirmarAcao = async () => {
    if (String(acaoQtd).trim() === '' || busy) return;
    const q = num(acaoQtd);
    if (acao.tipo !== 'contagem' && !(q > 0)) return;
    setBusy(true);
    try {
      const r = await fetch('/api/estoque', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'mov', id: acao.id, tipo: acao.tipo, qtd: q, motivo: acao.tipo === 'saida' ? acaoMotivo : undefined }) });
      const j = await r.json();
      if (j.ok && Array.isArray(j.itens)) setItens(j.itens);
    } catch { /* ignora */ }
    setBusy(false); setAcao(null); setAcaoQtd('');
  };

  const reporNaLista = (lista) => {
    if (!onRepor) return;
    const add = onRepor(lista.map((it) => ({ nome: it.nome, categoria: it.categoria || '' })));
    setReposto(add === 0 ? 'Já estavam na lista de pedidos.' : `${add} item(ns) na lista de pedidos.`);
    setTimeout(() => setReposto(''), 3000);
  };

  const rotuloAcao = { entrada: 'Entrada', saida: 'Saída', contagem: 'Contagem' };

  return (
    <div>
      <PageTitle sub="O que tem, o que está acabando — e dá pra ajustar">Estoque</PageTitle>

      {reposto && <Card style={{ marginBottom: 12, borderColor: C.green }}><div style={{ fontSize: 14, color: C.green, fontWeight: 700 }}>{reposto}</div></Card>}

      {abaixoDoMin.length > 0 && (
        <Card style={{ marginBottom: 14, borderColor: C.red }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.red }}>Acabando ({abaixoDoMin.length})</div>
            {onRepor && <Btn small onClick={() => reporNaLista(abaixoDoMin)}>Jogar na lista de pedidos</Btn>}
          </div>
          {abaixoDoMin.map((it) => (
            <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderTop: `1px solid ${C.hair}`, padding: '7px 0', fontSize: 14 }}>
              <span>{it.nome}</span>
              <span style={{ color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{num(it.saldo)} / mín. {num(it.minimo)} {it.unidade}</span>
            </div>
          ))}
        </Card>
      )}

      <SecTitle>Itens ({itens.length})</SecTitle>
      {!carregado ? <Empty>Carregando…</Empty> : itens.length === 0 ? (
        <Empty>A dona ainda não cadastrou itens no estoque.</Empty>
      ) : grupos.map((g) => (
        <div key={g.cat} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em', color: C.accent, fontWeight: 700, margin: '0 0 8px 2px' }}>{g.cat}</div>
          {g.itens.map((it) => {
            const saldo = num(it.saldo), minimo = num(it.minimo);
            const baixo = minimo > 0 && saldo <= minimo;
            const aberto = verMov === it.id;
            return (
              <Card key={it.id} style={{ marginBottom: 8, padding: 14, borderColor: baixo ? C.red : C.cardBorder }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{it.nome}</div>
                    <div style={{ fontSize: 12, color: C.faint, marginTop: 3 }}>{minimo > 0 ? `mín. ${minimo} ${it.unidade}` : `unidade: ${it.unidade}`}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: baixo ? C.red : C.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{saldo}</div>
                    <div style={{ fontSize: 11, color: C.faint }}>{it.unidade}{baixo ? ' · acabando' : ''}</div>
                  </div>
                </div>

                {acao && acao.id === it.id ? (
                  <div style={{ marginTop: 12, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 8 }}>
                      {rotuloAcao[acao.tipo]}{acao.tipo === 'contagem' ? ' — quanto tem AGORA?' : acao.tipo === 'entrada' ? ' — quanto entrou?' : ' — quanto saiu?'}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ width: 110 }}><NumInput value={acaoQtd} onChange={setAcaoQtd} placeholder={acao.tipo === 'contagem' ? String(saldo) : '0'} /></div>
                      {acao.tipo === 'saida' && <div style={{ flex: 1, minWidth: 150 }}><Select value={acaoMotivo} onChange={setAcaoMotivo} options={MOTIVOS_SAIDA} /></div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <Btn small onClick={confirmarAcao}>Confirmar</Btn>
                      <Btn kind="ghost" small onClick={() => { setAcao(null); setAcaoQtd(''); }}>Cancelar</Btn>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                    <Btn kind="ok" small onClick={() => abrirAcao(it.id, 'entrada')}>+ Entrada</Btn>
                    <Btn kind="danger" small onClick={() => abrirAcao(it.id, 'saida')}>− Saída</Btn>
                    <Btn kind="ghost" small onClick={() => abrirAcao(it.id, 'contagem')}>Contar</Btn>
                    {(it.movimentos || []).length > 0 && (
                      <button onClick={() => setVerMov(aberto ? null : it.id)} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '7px 6px', marginLeft: 'auto' }}>{aberto ? 'ocultar' : 'histórico'}</button>
                    )}
                  </div>
                )}

                {aberto && (
                  <div style={{ marginTop: 10, borderTop: `1px solid ${C.hair}`, paddingTop: 8 }}>
                    {(it.movimentos || []).slice(0, 12).map((m) => (
                      <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: C.muted, padding: '3px 0' }}>
                        <span>{fmtDate(m.data)} · {m.motivo}</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', color: (m.tipo === 'saida' || m.tipo === 'venda') ? C.red : m.tipo === 'contagem' ? C.muted : C.green }}>
                          {(m.tipo === 'saida' || m.tipo === 'venda') ? '−' : m.tipo === 'contagem' ? '=' : '+'}{m.tipo === 'contagem' ? m.saldoDepois : num(m.qtd)} → {m.saldoDepois}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ))}
    </div>
  );
}
