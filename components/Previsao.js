'use client';
import React, { useMemo, useState } from 'react';
import { C, Empty, PageTitle } from './ui';
import { num, weekday, todayISO, addDays, limparNome, DIAS } from '../lib/util';
import { qtdNaUnidadeDoItem } from '../lib/estoque';

const norm = (s) => limparNome(s).toLowerCase();
const FDS = 'Fim de semana (Sex + Sáb + Dom)';
const CURTO = { Domingo: 'Dom', 'Segunda-Feira': 'Seg', 'Terça-Feira': 'Ter', 'Quarta-Feira': 'Qua', 'Quinta-Feira': 'Qui', 'Sexta-Feira': 'Sex', 'Sábado': 'Sáb' };
const K = 8; // usa os últimos 8 dias daquele dia da semana

// Previsão de demanda: cruza o histórico de vendas (por dia da semana) com o
// cardápio, prevê quanto de cada item, mostra uma faixa (mín–máx) honesta e
// traduz em quanto preparar/comprar de cada ingrediente (via fichas + estoque).
export default function Previsao({ vendas = [], cardapio = [], fichas = [], estoque = [] }) {
  const amanha = weekday(addDays(todayISO(), 1));
  const [alvo, setAlvo] = useState(amanha || 'Sexta-Feira');

  const nomeCardapio = useMemo(() => new Map(cardapio.map((c) => [c.id, c.nome])), [cardapio]);
  const fichaPorCardapio = useMemo(() => new Map(fichas.filter((f) => f && f.cardapioId).map((f) => [f.cardapioId, Array.isArray(f.itens) ? f.itens : []])), [fichas]);
  const estoquePorId = useMemo(() => new Map(estoque.map((e) => [e.id, e])), [estoque]);

  const hist = useMemo(() => {
    const datasPorWd = {};
    const qtd = new Map();
    const nome = new Map();
    const keys = new Set();
    for (const v of vendas) {
      const d = v.data; if (!d) continue;
      const wd = weekday(d); if (!wd) continue;
      (datasPorWd[wd] = datasPorWd[wd] || new Set()).add(d);
      for (const it of (v.itens || [])) {
        const key = it.cardapioId ? 'id:' + it.cardapioId : 'nm:' + norm(it.nome);
        keys.add(key);
        qtd.set(key + '__' + d, (qtd.get(key + '__' + d) || 0) + num(it.qtd));
        const nomeBom = (it.cardapioId && nomeCardapio.get(it.cardapioId)) || it.nome || '';
        if (nomeBom && nomeBom.length >= (nome.get(key) || '').length) nome.set(key, nomeBom);
      }
    }
    return { datasPorWd, qtd, nome, keys: [...keys] };
  }, [vendas, nomeCardapio]);

  const wdsAlvo = alvo === FDS ? ['Sexta-Feira', 'Sábado', 'Domingo'] : [alvo];

  const previsoes = useMemo(() => {
    const amostras = (key, wd) => {
      const datas = [...(hist.datasPorWd[wd] || [])].sort().reverse().slice(0, K);
      return datas.map((d) => hist.qtd.get(key + '__' + d) || 0);
    };
    const arr = [];
    for (const key of hist.keys) {
      let esperado = 0, low = 0, high = 0, nMax = 0, temAmostra = false;
      for (const wd of wdsAlvo) {
        const am = amostras(key, wd);
        if (!am.length) continue;
        temAmostra = true;
        const mean = am.reduce((a, b) => a + b, 0) / am.length;
        const std = Math.sqrt(am.reduce((a, b) => a + (b - mean) ** 2, 0) / am.length);
        esperado += mean; low += Math.max(0, mean - std); high += mean + std; nMax = Math.max(nMax, am.length);
      }
      if (!temAmostra || esperado < 0.5) continue;
      const cid = key.startsWith('id:') ? key.slice(3) : null;
      arr.push({ key, cid, nome: hist.nome.get(key) || '?', esperado, low, high, n: nMax });
    }
    return arr.sort((a, b) => b.esperado - a.esperado);
  }, [hist, alvo]); // eslint-disable-line react-hooks/exhaustive-deps

  const preparo = useMemo(() => {
    const need = new Map();
    for (const p of previsoes) {
      if (!p.cid) continue;
      const ficha = fichaPorCardapio.get(p.cid);
      if (!ficha || !ficha.length) continue;
      for (const ing of ficha) {
        const it = estoquePorId.get(ing.estoqueId);
        if (!it) continue;
        const usoPorUn = qtdNaUnidadeDoItem(ing.qtd, ing.unidade, it);
        if (!(usoPorUn > 0)) continue;
        const g = need.get(it.id) || { nome: it.nome, unidade: it.unidade, precisa: 0 };
        g.precisa += usoPorUn * p.esperado;
        need.set(it.id, g);
      }
    }
    return [...need.entries()].map(([id, g]) => {
      const it = estoquePorId.get(id);
      const saldo = num(it?.saldo);
      const falta = Math.max(0, g.precisa - saldo);
      return { id, nome: g.nome, unidade: g.unidade, precisa: g.precisa, saldo, falta };
    }).filter((x) => x.precisa > 0).sort((a, b) => b.falta - a.falta || b.precisa - a.precisa);
  }, [previsoes, fichaPorCardapio, estoquePorId]);

  const fmt = (x) => { const r = Math.round(x * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ','); };
  const diasBase = useMemo(() => { const s = new Set(); for (const wd of wdsAlvo) for (const d of (hist.datasPorWd[wd] || [])) s.add(d); return s.size; }, [hist, alvo]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalEsperado = previsoes.reduce((s, p) => s + p.esperado, 0);
  const maxEsp = previsoes[0]?.esperado || 1;
  const faltamCompras = preparo.filter((x) => x.falta > 0.001);
  const nomeAlvo = alvo === FDS ? 'Fim de semana' : alvo.replace('-Feira', '');

  return (
    <div>
      <style>{`
        .prev-pills{display:flex;gap:8px;overflow-x:auto;padding:2px 0 6px;-webkit-overflow-scrolling:touch}
        .prev-pill{flex:0 0 auto;border:1px solid ${C.line};background:${C.panel};color:${C.muted};border-radius:999px;padding:8px 15px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all .15s}
        .prev-pill.on{background:${C.accent};color:#06101F;border-color:${C.accent}}
        .prev-hero{border-radius:18px;padding:18px 20px;margin:12px 0 18px;background:${C.panel};background:linear-gradient(135deg,color-mix(in srgb,${C.accent} 16%,transparent),color-mix(in srgb,${C.accent} 4%,transparent));border:1px solid color-mix(in srgb,${C.accent} 45%,transparent);position:relative;overflow:hidden}
        .prev-row{border:1px solid ${C.cardBorder};background:${C.panel};border-radius:14px;padding:12px 14px;margin-bottom:8px}
        .prev-track{height:7px;border-radius:999px;background:${C.panel2};overflow:hidden;margin-top:9px}
        .prev-fill{height:100%;border-radius:999px;transition:width .4s ease}
        .prev-tag{font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;display:inline-flex;align-items:center;gap:4px}
      `}</style>

      <PageTitle sub="Baseado no seu histórico de vendas por dia da semana">Previsão de demanda</PageTitle>

      {/* Seletor de dia em pílulas (mais rápido no toque). */}
      <div className="prev-pills">
        <button className={`prev-pill${alvo === FDS ? ' on' : ''}`} onClick={() => setAlvo(FDS)}>⭐ Fim de semana</button>
        {DIAS.map((d) => <button key={d} className={`prev-pill${alvo === d ? ' on' : ''}`} onClick={() => setAlvo(d)}>{CURTO[d]}</button>)}
      </div>

      {previsoes.length === 0 ? (
        <Empty>Ainda não há histórico desse dia.<br />Conforme você for fechando comandas, a previsão vai ficando boa.</Empty>
      ) : (
        <>
          {/* Destaque do total esperado. */}
          <div className="prev-hero">
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: C.accent }}>{nomeAlvo}</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 40, fontWeight: 900, color: C.text, lineHeight: 1 }}>{fmt(totalEsperado)}</div>
              <div style={{ fontSize: 13, color: C.muted, paddingBottom: 4 }}>itens esperados<br />no período</div>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: C.muted }}>
              <span><b style={{ color: C.text }}>{previsoes.length}</b> produtos</span>
              <span><b style={{ color: C.text }}>{diasBase}</b> dia(s) de base</span>
              {faltamCompras.length > 0 && <span style={{ color: C.amber, fontWeight: 700 }}>⚠️ {faltamCompras.length} pode faltar</span>}
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: C.faint, margin: '0 2px 10px' }}>Quanto deve sair</div>
          <div style={{ marginBottom: 20 }}>
            {previsoes.slice(0, 40).map((p) => (
              <div key={p.key} className="prev-row">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</span>
                  <span style={{ flexShrink: 0 }}><b style={{ fontSize: 20, fontWeight: 800, color: C.accent }}>{fmt(p.esperado)}</b><span style={{ fontSize: 11, color: C.faint }}> un</span></span>
                </div>
                <div className="prev-track"><div className="prev-fill" style={{ width: Math.max(4, (p.esperado / maxEsp) * 100) + '%', background: C.accent }} /></div>
                <div style={{ fontSize: 11, color: C.faint, marginTop: 5 }}>faixa {fmt(p.low)}–{fmt(p.high)} · {p.n} dia(s) de base</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: C.faint, margin: '0 2px 10px' }}>Preparo e compras</div>
          {preparo.length === 0 ? (
            <Empty>Monte as fichas técnicas dos pratos pra ver os ingredientes necessários.</Empty>
          ) : (
            preparo.slice(0, 40).map((x) => {
              const pct = x.precisa > 0 ? Math.min(100, (x.saldo / x.precisa) * 100) : 100;
              const falta = x.falta > 0.001;
              return (
                <div key={x.id} className="prev-row" style={{ borderColor: falta ? `color-mix(in srgb, ${C.red} 55%, transparent)` : C.cardBorder }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.nome}</span>
                    <span className="prev-tag" style={{ background: `color-mix(in srgb, ${falta ? C.red : C.green} 16%, transparent)`, color: falta ? C.red : C.green, flexShrink: 0 }}>
                      {falta ? `falta ${fmt(x.falta)} ${x.unidade}` : 'ok ✓'}
                    </span>
                  </div>
                  <div className="prev-track"><div className="prev-fill" style={{ width: Math.max(3, pct) + '%', background: falta ? C.red : C.green }} /></div>
                  <div style={{ fontSize: 11, color: C.faint, marginTop: 5 }}>precisa ~{fmt(x.precisa)} {x.unidade} · tem {fmt(x.saldo)} {x.unidade}</div>
                </div>
              );
            })
          )}

          <div style={{ fontSize: 12, color: C.faint, marginTop: 16, lineHeight: 1.5 }}>
            A faixa mín–máx é a variação normal do seu histórico. Dias de evento, jogo ou promoção fogem disso — use a previsão como base e ajuste pelo seu faro.
          </div>
        </>
      )}
    </div>
  );
}
