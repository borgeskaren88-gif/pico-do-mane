'use client';
import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, Cell, LabelList, ResponsiveContainer } from 'recharts';
import { C, Empty, PageTitle } from './ui';
import { num, weekday, todayISO, addDays, limparNome, DIAS } from '../lib/util';
import { qtdNaUnidadeDoItem } from '../lib/estoque';

const norm = (s) => limparNome(s).toLowerCase();
const FDS = 'Fim de semana (Sex + Sáb + Dom)';
const CURTO = { Domingo: 'Dom', 'Segunda-Feira': 'Seg', 'Terça-Feira': 'Ter', 'Quarta-Feira': 'Qua', 'Quinta-Feira': 'Qui', 'Sexta-Feira': 'Sex', 'Sábado': 'Sáb' };
const PALETA = ['#6C8CFF', '#7BD389', '#F0A93B', '#E5799A', '#9B8CFF', '#4FC3C7', '#F2C14E', '#5AB1E0'];
const K = 8;

// Card de KPI (estilo painel analítico): ícone + rótulo + número grande.
function Stat({ icon, label, valor, sub, cor }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: 14, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${cor} 16%, transparent)`, fontSize: 15 }}>{icon}</span>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color: C.text, lineHeight: 1 }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>{sub}</div>}
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
  const faltamCompras = preparo.filter((x) => x.falta > 0.001);
  const nomeAlvo = alvo === FDS ? 'Fim de semana' : alvo.replace('-Feira', '');

  const top = previsoes.slice(0, 8);
  const chartData = top.map((p, i) => ({ nome: p.nome, curto: p.nome.length > 9 ? p.nome.slice(0, 8) + '…' : p.nome, esperado: Math.round(p.esperado * 10) / 10, cor: PALETA[i % PALETA.length] }));

  return (
    <div>
      <style>{`
        .prev-pills{display:flex;gap:8px;overflow-x:auto;padding:2px 0 6px;-webkit-overflow-scrolling:touch}
        .prev-pill{flex:0 0 auto;border:1px solid ${C.line};background:${C.panel};color:${C.muted};border-radius:999px;padding:8px 15px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all .15s}
        .prev-pill.on{background:${C.accent};color:#06101F;border-color:${C.accent}}
        .prev-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:16px}
        .prev-card{background:${C.panel};border:1px solid ${C.cardBorder};border-radius:16px;padding:16px}
        .prev-track{height:7px;border-radius:999px;background:${C.panel2};overflow:hidden;margin-top:9px}
        .prev-fill{height:100%;border-radius:999px;transition:width .4s ease}
        .prev-tag{font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;flex-shrink:0}
        .prev-leg{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid ${C.hair};font-size:13px}
        .prev-sec{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:${C.faint};margin:0 2px 10px}
      `}</style>

      <PageTitle sub="Baseado no seu histórico de vendas por dia da semana">Previsão de demanda</PageTitle>

      <div className="prev-pills">
        <button className={`prev-pill${alvo === FDS ? ' on' : ''}`} onClick={() => setAlvo(FDS)}>⭐ Fim de semana</button>
        {DIAS.map((d) => <button key={d} className={`prev-pill${alvo === d ? ' on' : ''}`} onClick={() => setAlvo(d)}>{CURTO[d]}</button>)}
      </div>

      {previsoes.length === 0 ? (
        <Empty>Ainda não há histórico desse dia.<br />Conforme você for fechando comandas, a previsão vai ficando boa.</Empty>
      ) : (
        <>
          {/* KPIs analíticos */}
          <div className="prev-grid" style={{ marginTop: 12 }}>
            <Stat icon="📈" label={nomeAlvo} valor={fmt(totalEsperado)} sub="itens esperados no período" cor={C.accent} />
            <Stat icon="🍽️" label="Produtos" valor={String(previsoes.length)} sub="com previsão" cor="#7BD389" />
            <Stat icon="🗓️" label="Base" valor={String(diasBase)} sub="dias parecidos" cor="#9B8CFF" />
            <Stat icon="⚠️" label="Podem faltar" valor={String(faltamCompras.length)} sub={faltamCompras.length ? 'ingredientes' : 'tudo ok'} cor={faltamCompras.length ? C.red : C.green} />
          </div>

          {/* Gráfico dos mais pedidos */}
          <div className="prev-card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 2 }}>Top do {nomeAlvo.toLowerCase()}</div>
            <div style={{ fontSize: 12, color: C.faint, marginBottom: 12 }}>Os itens que mais devem sair (esperado)</div>
            <div style={{ width: '100%', height: 210 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 22, right: 6, left: 6, bottom: 4 }}>
                  <XAxis dataKey="curto" tick={{ fontSize: 10, fill: C.faint }} tickLine={false} axisLine={false} interval={0} />
                  <Bar dataKey="esperado" radius={[8, 8, 0, 0]} maxBarSize={46} isAnimationActive={false}>
                    {chartData.map((d, i) => <Cell key={i} fill={d.cor} />)}
                    <LabelList dataKey="esperado" position="top" style={{ fontSize: 12, fontWeight: 700, fill: C.text }} formatter={(v) => fmt(v)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Legenda com faixa */}
            <div style={{ marginTop: 6 }}>
              {top.map((p, i) => (
                <div key={p.key} className="prev-leg">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: PALETA[i % PALETA.length], flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</span>
                  </span>
                  <span style={{ flexShrink: 0, color: C.muted }}><b style={{ color: C.text }}>{fmt(p.esperado)}</b> <span style={{ fontSize: 11, color: C.faint }}>({fmt(p.low)}–{fmt(p.high)})</span></span>
                </div>
              ))}
            </div>
            {previsoes.length > top.length && <div style={{ fontSize: 11, color: C.faint, marginTop: 8 }}>+{previsoes.length - top.length} outros itens com previsão menor.</div>}
          </div>

          {/* Preparo com barra de progresso */}
          <div className="prev-sec">Preparo e compras</div>
          {preparo.length === 0 ? (
            <Empty>Monte as fichas técnicas dos pratos pra ver os ingredientes necessários.</Empty>
          ) : (
            preparo.slice(0, 40).map((x) => {
              const pct = x.precisa > 0 ? Math.min(100, (x.saldo / x.precisa) * 100) : 100;
              const falta = x.falta > 0.001;
              return (
                <div key={x.id} className="prev-card" style={{ padding: '12px 14px', marginBottom: 8, borderColor: falta ? `color-mix(in srgb, ${C.red} 55%, transparent)` : C.cardBorder }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.nome}</span>
                    <span className="prev-tag" style={{ background: `color-mix(in srgb, ${falta ? C.red : C.green} 16%, transparent)`, color: falta ? C.red : C.green }}>{falta ? `falta ${fmt(x.falta)} ${x.unidade}` : 'ok ✓'}</span>
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
