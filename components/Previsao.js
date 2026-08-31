'use client';
import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, CartesianGrid, LabelList, ResponsiveContainer } from 'recharts';
import { C, Empty, PageTitle } from './ui';
import { num, weekday, todayISO, addDays, limparNome, DIAS } from '../lib/util';
import { qtdNaUnidadeDoItem } from '../lib/estoque';

const norm = (s) => limparNome(s).toLowerCase();
const FDS = 'Fim de semana (Sex + Sáb + Dom)';
const CURTO = { Domingo: 'Dom', 'Segunda-Feira': 'Seg', 'Terça-Feira': 'Ter', 'Quarta-Feira': 'Qua', 'Quinta-Feira': 'Qui', 'Sexta-Feira': 'Sex', 'Sábado': 'Sáb' };
const K = 8;
const TAB = { fontVariantNumeric: 'tabular-nums' };

// Tile de KPI, estilo terminal financeiro: rótulo micro, número tabular grande.
function Stat({ label, valor, sub, forte }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '13px 15px', minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: C.faint, textTransform: 'uppercase', letterSpacing: '.09em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ fontSize: 25, fontWeight: 800, color: forte || C.text, lineHeight: 1.1, marginTop: 8, ...TAB }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

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
  const top = previsoes.slice(0, 8);
  const chartData = top.map((p) => ({ curto: p.nome.length > 8 ? p.nome.slice(0, 7) + '…' : p.nome, esperado: Math.round(p.esperado * 10) / 10 }));

  return (
    <div>
      <style>{`
        .pv-pills{display:flex;gap:7px;overflow-x:auto;padding:2px 0 8px;-webkit-overflow-scrolling:touch}
        .pv-pill{flex:0 0 auto;border:1px solid ${C.line};background:transparent;color:${C.muted};border-radius:8px;padding:7px 13px;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all .15s}
        .pv-pill.on{background:${C.accent};color:#06101F;border-color:${C.accent}}
        .pv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px;margin-bottom:14px}
        .pv-card{background:${C.panel};border:1px solid ${C.cardBorder};border-radius:14px;padding:16px}
        .pv-row{display:flex;align-items:center;gap:12px;padding:11px 2px;border-top:1px solid ${C.hair}}
        .pv-lbl{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:${C.faint};margin:0 2px 9px}
        .pv-mini{flex:0 0 64px;height:5px;border-radius:999px;background:color-mix(in srgb,${C.accent} 14%,transparent);overflow:hidden}
        .pv-mini > i{display:block;height:100%;border-radius:999px;background:${C.accent}}
        .pv-track{height:5px;border-radius:999px;background:${C.panel2};overflow:hidden;margin-top:9px}
        .pv-fill{height:100%;border-radius:999px}
      `}</style>

      <PageTitle sub="Baseado no seu histórico de vendas por dia da semana">Previsão de demanda</PageTitle>

      <div className="pv-pills">
        <button className={`pv-pill${alvo === FDS ? ' on' : ''}`} onClick={() => setAlvo(FDS)}>Fim de semana</button>
        {DIAS.map((d) => <button key={d} className={`pv-pill${alvo === d ? ' on' : ''}`} onClick={() => setAlvo(d)}>{CURTO[d]}</button>)}
      </div>

      {previsoes.length === 0 ? (
        <Empty>Ainda não há histórico desse dia.<br />Conforme você for fechando comandas, a previsão vai ficando boa.</Empty>
      ) : (
        <>
          <div className="pv-grid" style={{ marginTop: 12 }}>
            <Stat label={nomeAlvo} valor={fmt(totalEsperado)} sub="itens esperados" forte={C.accent} />
            <Stat label="Produtos" valor={String(previsoes.length)} sub="com previsão" />
            <Stat label="Dias de base" valor={String(diasBase)} sub="no histórico" />
            <Stat label="Podem faltar" valor={String(faltamCompras.length)} sub={faltamCompras.length ? 'ingredientes' : 'nada'} forte={faltamCompras.length ? C.red : C.green} />
          </div>

          <div className="pv-card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>Top do {nomeAlvo.toLowerCase()}</span>
              <span style={{ fontSize: 11, color: C.faint, ...TAB }}>{diasBase} dia(s) de base</span>
            </div>
            <div style={{ fontSize: 12, color: C.faint, marginBottom: 10 }}>Quanto deve sair de cada item</div>
            <div style={{ width: '100%', height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 4, left: 4, bottom: 2 }}>
                  <defs>
                    <linearGradient id="pvBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.accent} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={C.accent} stopOpacity={0.15} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={C.hair} />
                  <XAxis dataKey="curto" tick={{ fontSize: 9.5, fill: C.faint }} tickLine={false} axisLine={{ stroke: C.hair }} interval={0} />
                  <Bar dataKey="esperado" fill="url(#pvBar)" radius={[3, 3, 0, 0]} maxBarSize={30} isAnimationActive={false}>
                    <LabelList dataKey="esperado" position="top" style={{ fontSize: 11, fontWeight: 800, fill: C.text }} formatter={(v) => fmt(v)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Watchlist: tabela densa, número tabular + mini-barra proporcional. */}
          <div className="pv-card" style={{ marginBottom: 14, paddingTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 2px 2px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: C.faint }}>
              <span>Item</span><span>Esperado · faixa</span>
            </div>
            {previsoes.slice(0, 40).map((p) => (
              <div key={p.key} className="pv-row">
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</span>
                <span className="pv-mini"><i style={{ width: Math.max(6, (p.esperado / maxEsp) * 100) + '%' }} /></span>
                <span style={{ flexShrink: 0, textAlign: 'right', minWidth: 96 }}>
                  <b style={{ fontSize: 15, fontWeight: 800, color: C.text, ...TAB }}>{fmt(p.esperado)}</b>
                  <span style={{ fontSize: 11, color: C.faint, ...TAB }}> {fmt(p.low)}–{fmt(p.high)}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="pv-lbl">Preparo e compras</div>
          {preparo.length === 0 ? (
            <Empty>Monte as fichas técnicas dos pratos pra ver os ingredientes necessários.</Empty>
          ) : (
            preparo.slice(0, 40).map((x) => {
              const pct = x.precisa > 0 ? Math.min(100, (x.saldo / x.precisa) * 100) : 100;
              const falta = x.falta > 0.001;
              return (
                <div key={x.id} className="pv-card" style={{ padding: '12px 14px', marginBottom: 8, borderColor: falta ? `color-mix(in srgb, ${C.red} 50%, transparent)` : C.cardBorder }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.nome}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: falta ? C.red : C.green, flexShrink: 0, ...TAB }}>{falta ? `falta ${fmt(x.falta)} ${x.unidade}` : 'ok'}</span>
                  </div>
                  <div className="pv-track"><div className="pv-fill" style={{ width: Math.max(3, pct) + '%', background: falta ? C.red : C.green }} /></div>
                  <div style={{ fontSize: 11, color: C.faint, marginTop: 5, ...TAB }}>precisa ~{fmt(x.precisa)} {x.unidade} · tem {fmt(x.saldo)} {x.unidade}</div>
                </div>
              );
            })
          )}

          <div style={{ fontSize: 12, color: C.faint, marginTop: 14, lineHeight: 1.5 }}>
            A faixa mín–máx é a variação normal do seu histórico. Dias de evento, jogo ou promoção fogem disso — use como base e ajuste pelo seu faro.
          </div>
        </>
      )}
    </div>
  );
}
