'use client';
import React, { useMemo, useState } from 'react';
import { C, Card, KPI, Empty, PageTitle, Select } from './ui';
import { brl, num, ymOf, todayISO, mesLabel, FONTES_NAO_OPERACIONAL, DESPESA_NAO_OPERACIONAL } from '../lib/util';
import { custoDaFicha, custoDosSabores } from '../lib/estoque';

const norm = (s) => (s || '').trim().toLowerCase();

// Raio-X do mês: resultado financeiro + saúde do cardápio (margem) + o que saiu
// sem vender (perdas/cortesias) + pontos de atenção. Só leitura — junta o que já
// existe pra a dona ver, num lugar só, onde está perdendo dinheiro.
export default function RaioX({ receitas = [], despesas = [], cardapio = [], fichas = [], estoque = [] }) {
  const [mes, setMes] = useState(ymOf(todayISO()));
  const meses = useMemo(() => {
    const s = new Set([ymOf(todayISO())]);
    for (const r of receitas) if (r.data) s.add(ymOf(r.data));
    for (const d of despesas) if (d.data) s.add(ymOf(d.data));
    return [...s].filter(Boolean).sort().reverse();
  }, [receitas, despesas]);

  // Financeiro do mês (operacional exclui investimento/empréstimo/aporte).
  const recMes = receitas.filter((r) => ymOf(r.data) === mes && !FONTES_NAO_OPERACIONAL.includes(r.categoria));
  const despMes = despesas.filter((d) => ymOf(d.data) === mes && !DESPESA_NAO_OPERACIONAL.includes(d.categoria));
  const receita = recMes.reduce((s, r) => s + num(r.valor), 0);
  const despesa = despMes.reduce((s, d) => s + num(d.valor), 0);
  const lucro = Math.round((receita - despesa) * 100) / 100;
  const investimento = despesas.filter((d) => ymOf(d.data) === mes && d.categoria === 'Investimento').reduce((s, d) => s + num(d.valor), 0);
  const dividaPaga = despesas.filter((d) => ymOf(d.data) === mes && d.categoria === 'Empréstimo/Dívida').reduce((s, d) => s + num(d.valor), 0);
  const aporte = receitas.filter((r) => ymOf(r.data) === mes && FONTES_NAO_OPERACIONAL.includes(r.categoria)).reduce((s, r) => s + num(r.valor), 0);
  const saldoFinal = Math.round((lucro + aporte - investimento - dividaPaga) * 100) / 100;

  // Saúde do cardápio (margem por item, via custo da ficha).
  const fichaPorId = useMemo(() => new Map(fichas.filter((f) => f && f.cardapioId).map((f) => [f.cardapioId, Array.isArray(f.itens) ? f.itens : []])), [fichas]);
  const margens = useMemo(() => {
    const arr = [];
    for (const c of cardapio) {
      if (c.ativo === false) continue;
      const ficha = fichaPorId.get(c.id);
      if (!ficha || !ficha.length) continue;
      const preco = num(c.preco);
      const base = custoDaFicha(ficha, estoque);
      const sab = custoDosSabores(c.sabores, estoque);
      const lucroItem = Math.round((preco - base.custo - sab.medio) * 100) / 100;
      arr.push({ nome: c.nome, margem: preco > 0 ? (lucroItem / preco) * 100 : 0, lucro: lucroItem });
    }
    return arr;
  }, [cardapio, fichaPorId, estoque]);
  const margemMedia = margens.length ? margens.reduce((s, m) => s + m.margem, 0) / margens.length : 0;
  const noPrejuizo = margens.filter((m) => m.lucro < -0.005).sort((a, b) => a.lucro - b.lucro);

  // Saiu sem vender (custo): perdas/desperdício, cortesias, consumo da casa,
  // a partir dos movimentos de saída do estoque no mês.
  const outfl = useMemo(() => {
    const cat = { perda: 0, cortesia: 0, consumo: 0 };
    for (const it of estoque) {
      const custo = num(it.custo);
      if (!(custo > 0)) continue;
      for (const mv of (it.movimentos || [])) {
        if (mv.tipo !== 'saida' || ymOf(mv.data) !== mes) continue;
        const m = norm(mv.motivo);
        const val = num(mv.qtd) * custo;
        if (m.includes('desperd') || m.includes('vencid') || m.includes('perda') || m.includes('quebra')) cat.perda += val;
        else if (m.includes('cortesia')) cat.cortesia += val;
        else if (m.includes('consumo')) cat.consumo += val;
      }
    }
    return { perda: Math.round(cat.perda * 100) / 100, cortesia: Math.round(cat.cortesia * 100) / 100, consumo: Math.round(cat.consumo * 100) / 100 };
  }, [estoque, mes]);

  // Pontos de atenção (o que fazer).
  const alertas = [];
  if (receita > 0 && despesa > receita) alertas.push({ cor: C.red, txt: `Despesas (${brl(despesa)}) maiores que a receita (${brl(receita)}) este mês.` });
  if (noPrejuizo.length > 0) alertas.push({ cor: C.red, txt: `${noPrejuizo.length} item(ns) do cardápio vendidos abaixo do custo — reveja preço ou receita em Estoque → Margem.` });
  if (margens.length > 0 && margemMedia < 40) alertas.push({ cor: C.amber, txt: `Margem média do cardápio baixa (${margemMedia.toFixed(0)}%). Num bar costuma ser saudável acima de 60–70%.` });
  if (receita > 0 && outfl.perda > receita * 0.03) alertas.push({ cor: C.amber, txt: `Perdas/desperdício de ${brl(outfl.perda)} (${((outfl.perda / receita) * 100).toFixed(1)}% da receita) — vale investigar.` });
  if (receita > 0 && (outfl.cortesia + outfl.consumo) > receita * 0.05) alertas.push({ cor: C.amber, txt: `Cortesias + consumo da casa somam ${brl(outfl.cortesia + outfl.consumo)} este mês.` });

  const temDados = receita > 0 || despesa > 0 || margens.length > 0;

  return (
    <div>
      <PageTitle sub="Resultado, cardápio, perdas e o que ajustar — num lugar só">Raio-X do mês</PageTitle>

      <div style={{ marginBottom: 14, maxWidth: 240 }}>
        <Select value={mes} onChange={setMes} options={meses} />
        <div style={{ fontSize: 12, color: C.faint, marginTop: 4 }}>{mesLabel(mes)}</div>
      </div>

      {!temDados ? <Empty>Sem dados neste mês ainda.<br />Lance receitas/despesas e monte as fichas pra ver o raio-x.</Empty> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <KPI titulo="Receita" valor={brl(receita)} cor={C.green} />
            <KPI titulo="Despesa" valor={brl(despesa)} cor={C.red} />
            <KPI titulo="Lucro operacional" valor={brl(lucro)} cor={lucro >= 0 ? C.accent : C.red} />
            <KPI titulo="Saldo final" valor={brl(saldoFinal)} cor={saldoFinal >= 0 ? C.accent : C.red} sub="depois de invest./dívida" />
          </div>

          <Card style={{ marginBottom: 12, padding: 14 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.muted, fontWeight: 700, marginBottom: 10 }}>Saúde do cardápio</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14 }}><span style={{ color: C.muted }}>Margem média</span><b style={{ color: margens.length && margemMedia < 40 ? C.amber : C.green }}>{margens.length ? margemMedia.toFixed(0) + '%' : '—'}</b></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14 }}><span style={{ color: C.muted }}>Itens no prejuízo</span><b style={{ color: noPrejuizo.length ? C.red : C.green }}>{noPrejuizo.length}</b></div>
            {noPrejuizo.slice(0, 5).map((m) => (
              <div key={m.nome} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '3px 0', fontSize: 12 }}><span style={{ color: C.faint, minWidth: 0 }}>{m.nome}</span><span style={{ color: C.red, flexShrink: 0 }}>{brl(m.lucro)}</span></div>
            ))}
            {margens.length === 0 && <div style={{ fontSize: 12, color: C.faint }}>Monte as fichas técnicas pra calcular a margem.</div>}
          </Card>

          <Card style={{ marginBottom: 12, padding: 14 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.muted, fontWeight: 700, marginBottom: 10 }}>Saiu sem vender (custo)</div>
            {[['Perdas / desperdício / vencidos', outfl.perda, C.red], ['Cortesias', outfl.cortesia, C.amber], ['Consumo da casa', outfl.consumo, C.amber]].map(([nome, val, cor]) => (
              <div key={nome} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14 }}><span style={{ color: C.muted }}>{nome}</span><b style={{ color: val > 0 ? cor : C.faint }}>{brl(val)}</b></div>
            ))}
            <div style={{ fontSize: 11, color: C.faint, marginTop: 6, lineHeight: 1.4 }}>Valor pelo custo dos ingredientes que saíram do estoque por esses motivos no mês.</div>
          </Card>

          <Card style={{ padding: 14, borderColor: alertas.some((a) => a.cor === C.red) ? C.red : C.cardBorder }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.muted, fontWeight: 700, marginBottom: 10 }}>Pontos de atenção</div>
            {alertas.length === 0 ? (
              <div style={{ fontSize: 14, color: C.green, fontWeight: 700 }}>✓ Nada gritante este mês. Continue de olho na margem e nas perdas.</div>
            ) : alertas.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', fontSize: 13, lineHeight: 1.45, color: C.text }}>
                <span style={{ color: a.cor, fontWeight: 800, flexShrink: 0 }}>•</span><span>{a.txt}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
