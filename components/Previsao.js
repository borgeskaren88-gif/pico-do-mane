'use client';
import React, { useMemo, useState } from 'react';
import { C, Card, KPI, Empty, PageTitle, SecTitle, Select } from './ui';
import { num, weekday, todayISO, addDays, limparNome, DIAS } from '../lib/util';
import { qtdNaUnidadeDoItem } from '../lib/estoque';

const norm = (s) => limparNome(s).toLowerCase();
const FDS = 'Fim de semana (Sex + Sáb + Dom)';
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

  // Histórico: por dia da semana, quais datas tiveram venda; e quanto de cada
  // item foi vendido em cada data.
  const hist = useMemo(() => {
    const datasPorWd = {};
    const qtd = new Map(); // `${key}__${data}` -> quantidade
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

  // Previsão por item: soma, pelos dias-alvo, a média (com faixa) das últimas
  // ocorrências daquele dia da semana.
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

  // Preparo / compras: ingredientes necessários pra atender a previsão, vs saldo.
  const preparo = useMemo(() => {
    const need = new Map(); // estoqueId -> { nome, unidade, precisa }
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
  const diasBase = useMemo(() => { let s = new Set(); for (const wd of wdsAlvo) for (const d of (hist.datasPorWd[wd] || [])) s.add(d); return s.size; }, [hist, alvo]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalEsperado = previsoes.reduce((s, p) => s + p.esperado, 0);
  const faltamCompras = preparo.filter((x) => x.falta > 0.001);

  const opcoes = [FDS, ...DIAS];

  return (
    <div>
      <PageTitle sub="Baseado no seu histórico de vendas por dia da semana">Previsão de demanda</PageTitle>

      <Card style={{ marginBottom: 14, background: C.panel2 }}>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
          Escolha o dia e o app prevê <b style={{ color: C.text }}>quanto sai de cada item</b>, com uma <b style={{ color: C.text }}>faixa (mín–máx)</b>, e já monta a <b style={{ color: C.text }}>lista de preparo/compra</b>. Não é bola de cristal — é a média do seu histórico. Quanto mais dias registrados, mais certeira.
        </div>
      </Card>

      <div style={{ marginBottom: 14, maxWidth: 320 }}>
        <Select value={alvo} onChange={setAlvo} options={opcoes} />
        <div style={{ fontSize: 12, color: C.faint, marginTop: 4 }}>{diasBase > 0 ? `Baseado em ${diasBase} dia(s) parecido(s) do histórico` : 'Sem histórico desse dia ainda'}</div>
      </div>

      {previsoes.length === 0 ? (
        <Empty>Ainda não há histórico suficiente desse dia.<br />Conforme você for fechando comandas, a previsão vai ficando boa.</Empty>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <KPI titulo="Itens previstos" valor={String(previsoes.length)} />
            <KPI titulo="Total esperado" valor={fmt(totalEsperado)} sub="unidades no período" cor={C.accent} />
          </div>

          <SecTitle>Quanto deve sair</SecTitle>
          <div style={{ marginBottom: 16 }}>
            {previsoes.slice(0, 40).map((p) => (
              <Card key={p.key} style={{ marginBottom: 8, padding: '11px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{p.nome}</div>
                    <div style={{ fontSize: 12, color: C.faint }}>faixa {fmt(p.low)}–{fmt(p.high)} · {p.n} dia(s) de base</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: C.accent, lineHeight: 1 }}>{fmt(p.esperado)}</div>
                    <div style={{ fontSize: 10, color: C.faint }}>esperado</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <SecTitle>Preparo e compras pra dar conta</SecTitle>
          {preparo.length === 0 ? (
            <Empty>Monte as fichas técnicas dos pratos pra ver os ingredientes necessários.</Empty>
          ) : (
            <>
              {faltamCompras.length > 0 && (
                <div style={{ fontSize: 13, color: C.amber, margin: '4px 0 10px', fontWeight: 600 }}>⚠️ {faltamCompras.length} ingrediente(s) podem faltar pra essa previsão — veja abaixo.</div>
              )}
              {preparo.slice(0, 40).map((x) => (
                <Card key={x.id} style={{ marginBottom: 6, padding: '10px 14px', borderColor: x.falta > 0.001 ? C.red : C.cardBorder }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{x.nome}</div>
                      <div style={{ fontSize: 12, color: C.faint }}>precisa ~{fmt(x.precisa)} {x.unidade} · tem {fmt(x.saldo)} {x.unidade}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {x.falta > 0.001 ? (
                        <><div style={{ fontSize: 16, fontWeight: 800, color: C.red, lineHeight: 1 }}>falta {fmt(x.falta)}</div><div style={{ fontSize: 10, color: C.faint }}>{x.unidade}</div></>
                      ) : (
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>ok ✓</div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </>
          )}

          <div style={{ fontSize: 12, color: C.faint, marginTop: 14, lineHeight: 1.5 }}>
            A faixa mín–máx é a variação normal do seu histórico. Dias de evento, jogo ou promoção fogem disso — use a previsão como base e ajuste pelo seu faro.
          </div>
        </>
      )}
    </div>
  );
}
