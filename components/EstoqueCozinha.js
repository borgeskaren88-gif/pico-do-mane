'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { C, Card, Btn, TextInput, NumInput, QtdInput, Select, Empty, SecTitle, PageTitle } from './ui';
import { num, fmtDate, CATEGORIAS_PRODUTO, numQtd } from '../lib/util';
import { MOTIVOS_SAIDA } from '../lib/estoque';

// Estoque na visão da COZINHA: ver o que tem e fazer as ações físicas que são
// dela (deu entrada de mercadoria, quebrou/perdeu, contou). O cadastro dos itens,
// os mínimos/lista de pedidos e as fichas técnicas continuam só com a dona.
export default function EstoqueCozinha() {
  const [itens, setItens] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [acao, setAcao] = useState(null); // { id, tipo }
  const [acaoQtd, setAcaoQtd] = useState('');
  const [acaoMotivo, setAcaoMotivo] = useState(MOTIVOS_SAIDA[0]);
  const [busy, setBusy] = useState(false);
  const [verMov, setVerMov] = useState(null);
  const [busca, setBusca] = useState('');
  const [catAberta, setCatAberta] = useState({}); // { [categoria]: true } — categoria expandida
  const toggleCat = (cat) => setCatAberta((m) => ({ ...m, [cat]: !m[cat] }));

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/estoque', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) setItens(Array.isArray(j.itens) ? j.itens : []);
    } catch { /* ignora */ }
    finally { setCarregado(true); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  // Agrupa por categoria (Bebidas, Cozinha…) em ordem fixa, com os itens em
  // ordem alfabética. A busca filtra pelo nome do item.
  const grupos = useMemo(() => {
    const filtro = busca.trim().toLowerCase();
    const ordem = [...CATEGORIAS_PRODUTO, ''];
    const map = new Map();
    for (const it of itens) {
      if (filtro && !(it.nome || '').toLowerCase().includes(filtro)) continue;
      const cat = it.categoria || '';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(it);
    }
    return [...map.entries()].sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0]))
      .map(([cat, is]) => ({ cat: cat || 'Outros', itens: is.sort((a, b) => (a.nome || '').localeCompare(b.nome || '')) }));
  }, [itens, busca]);

  const abrirAcao = (id, tipo) => { setAcao({ id, tipo }); setAcaoQtd(''); setAcaoMotivo(MOTIVOS_SAIDA[0]); };
  const confirmarAcao = async () => {
    if (String(acaoQtd).trim() === '' || busy) return;
    const q = numQtd(acaoQtd);
    if (acao.tipo !== 'contagem' && !(q > 0)) return;
    setBusy(true);
    try {
      const r = await fetch('/api/estoque', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'mov', id: acao.id, tipo: acao.tipo, qtd: q, motivo: acao.tipo === 'saida' ? acaoMotivo : undefined }) });
      const j = await r.json();
      if (j.ok && Array.isArray(j.itens)) setItens(j.itens);
    } catch { /* ignora */ }
    setBusy(false); setAcao(null); setAcaoQtd('');
  };

  const rotuloAcao = { entrada: 'Entrada', saida: 'Saída', contagem: 'Contagem' };

  return (
    <div>
      <PageTitle sub="O que tem — e dá pra ajustar (contar, entrada, saída)">Estoque</PageTitle>

      <div style={{ marginBottom: 14 }}>
        <TextInput value={busca} onChange={setBusca} placeholder="Buscar item (ex.: Aperol)" />
      </div>

      <SecTitle>Itens ({itens.length})</SecTitle>
      {!carregado ? <Empty>Carregando…</Empty> : itens.length === 0 ? (
        <Empty>A dona ainda não cadastrou itens no estoque.</Empty>
      ) : grupos.length === 0 ? (
        <Empty>Nenhum item encontrado.</Empty>
      ) : grupos.map((g) => {
        const buscando = busca.trim().length > 0;
        const abertaCat = buscando || !!catAberta[g.cat];
        return (
        <div key={g.cat} style={{ marginBottom: abertaCat ? 14 : 8 }}>
          <button onClick={() => toggleCat(g.cat)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: C.panel, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '11px 14px', cursor: 'pointer', textAlign: 'left', boxShadow: C.cardShadow, marginBottom: abertaCat ? 8 : 0 }}>
            <span style={{ color: C.accent, fontSize: 12, fontWeight: 800, width: 12, flexShrink: 0 }}>{abertaCat ? '▾' : '▸'}</span>
            <span style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '.06em', color: C.accent, fontWeight: 800, flex: 1, minWidth: 0 }}>{g.cat}</span>
            <span style={{ fontSize: 12, color: C.faint, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{g.itens.length}</span>
          </button>
          {abertaCat && <div>
          {g.itens.map((it) => {
            const saldo = num(it.saldo);
            const aberto = verMov === it.id;
            return (
              <Card key={it.id} style={{ marginBottom: 8, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{it.nome}</div>
                    <div style={{ fontSize: 12, color: C.faint, marginTop: 3 }}>unidade: {it.unidade}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{saldo}</div>
                    <div style={{ fontSize: 11, color: C.faint }}>{it.unidade}</div>
                  </div>
                </div>

                {acao && acao.id === it.id ? (
                  <div style={{ marginTop: 12, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 8 }}>
                      {rotuloAcao[acao.tipo]}{acao.tipo === 'contagem' ? ' — quanto tem AGORA?' : acao.tipo === 'entrada' ? ' — quanto entrou?' : ' — quanto saiu?'}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ width: 170 }}><QtdInput value={acaoQtd} onChange={setAcaoQtd} placeholder={acao.tipo === 'contagem' ? String(saldo) : '0'} /></div>
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
          </div>}
        </div>
        );
      })}
    </div>
  );
}
