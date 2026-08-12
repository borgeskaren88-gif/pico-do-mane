'use client';
import React, { useState, useMemo, useEffect } from 'react';
import {
  AreaChart, Area as AreaRecharts, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { C, Card, Btn, Field, TextInput, NumInput, Select, Empty, Resumo, SecTitle, PageTitle } from './ui';
import { brl, num, todayISO, ymOf, mesLabel, uid } from '../lib/util';

const CANAIS = ['Meta Ads', 'Google Ads', 'Instagram', 'Google (avaliações)', 'TripAdvisor', 'Outro'];
const REPUT = ['Google (avaliações)', 'TripAdvisor']; // canais de reputação (nota + avaliações)
const vazio = () => ({ mes: ymOf(todayISO()), canal: 'Meta Ads', investido: '', alcance: '', cliques: '', seguidores: '', nota: '', avaliacoes: '', obs: '' });
const int = (n) => Math.round(n).toLocaleString('pt-BR');

const tooltipModerno = { background: C.panel, border: `1px solid ${C.cardBorder}`, borderRadius: 12, color: C.text, boxShadow: C.cardShadow, fontSize: 12, padding: '8px 12px' };

// Soma/subtrai N meses de um 'YYYY-MM'.
const addMeses = (ym, n) => {
  const total = (parseInt(ym.slice(0, 4)) * 12) + (parseInt(ym.slice(5)) - 1) + n;
  const y = Math.floor(total / 12), m = ((total % 12) + 12) % 12;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
};
const mesesEntre = (a, b) => (parseInt(b.slice(0, 4)) - parseInt(a.slice(0, 4))) * 12 + (parseInt(b.slice(5)) - parseInt(a.slice(5)));

// Previsão de quando bate a meta, no ritmo médio de crescimento da série.
function previsao(serie, campo, meta) {
  if (!meta || meta <= 0 || serie.length < 2) return null;
  const atual = num(serie[serie.length - 1][campo]);
  if (atual >= meta) return null;
  const primeiro = num(serie[0][campo]);
  const span = mesesEntre(serie[0].mes, serie[serie.length - 1].mes) || (serie.length - 1);
  const ganhoMes = span > 0 ? (atual - primeiro) / span : 0;
  if (ganhoMes <= 0) return { texto: 'Sem crescimento no período — no ritmo atual a meta não é alcançada. Vale reforçar.', alerta: true };
  const faltam = Math.ceil((meta - atual) / ganhoMes);
  if (faltam > 60) return { texto: `No ritmo atual (~${int(Math.round(ganhoMes))}/mês) leva mais de 5 anos. Vale acelerar.`, alerta: true };
  const alvo = addMeses(ymOf(todayISO()), faltam);
  return { texto: `No seu ritmo (~${int(Math.round(ganhoMes))}/mês), você chega lá por volta de ${mesLabel(alvo)}.`, alerta: false };
}

// Barra horizontal simples (mesmo estilo do resto do app).
function Barra({ label, valor, max, cor, texto }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, marginBottom: 3 }}>
        <span style={{ color: C.muted }}>{label}</span>
        <b style={{ color: cor, fontVariantNumeric: 'tabular-nums' }}>{texto}</b>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: `${C.hair}`, overflow: 'hidden' }}>
        <div style={{ width: `${max > 0 ? Math.max(3, (valor / max) * 100) : 0}%`, height: '100%', background: cor, borderRadius: 999 }} />
      </div>
    </div>
  );
}

// Barra de progresso rumo a uma meta (verde quando bate).
function MetaBar({ label, atual, meta }) {
  const pct = meta > 0 ? Math.min(100, (atual / meta) * 100) : 0;
  const batida = meta > 0 && atual >= meta;
  const cor = batida ? C.green : C.accent;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, marginBottom: 4 }}>
        <span style={{ color: C.muted }}>{label}</span>
        <b style={{ color: cor, fontVariantNumeric: 'tabular-nums' }}>{int(atual)} / {int(meta)} · {Math.round(pct)}%{batida ? ' — batida!' : ''}</b>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: `${C.hair}`, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: cor, borderRadius: 999 }} />
      </div>
    </div>
  );
}

// Gráfico de linha (área) da evolução de um número mês a mês — mesmo azul do resto.
function CurvaCard({ titulo, data, sufixo }) {
  if (data.length < 2) return null;
  const id = 'gCurva-' + sufixo;
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>{titulo}</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Evolução mês a mês</div>
      <div style={{ height: 190 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.accent} stopOpacity={0.32} />
                <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 7" stroke={C.hair} vertical={false} />
            <XAxis dataKey="mes" tick={{ fill: C.muted, fontSize: 12 }} axisLine={false} tickLine={false} dy={6} />
            <YAxis tick={{ fill: C.faint, fontSize: 11 }} axisLine={false} tickLine={false} width={46} tickFormatter={(v) => (v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : v)} />
            <Tooltip formatter={(v) => [int(v), titulo]} contentStyle={tooltipModerno} labelStyle={{ color: C.muted, fontWeight: 700, marginBottom: 2 }} />
            <AreaRecharts type="monotone" dataKey="val" stroke={C.accent} strokeWidth={3} fill={`url(#${id})`} dot={{ fill: C.accent, r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export default function Marketing({ dados, onChange, receitas = [] }) {
  const [form, setForm] = useState(vazio());
  const [editId, setEditId] = useState(null);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  // As metas ficam guardadas num registro especial (tipo: 'metas') dentro do
  // próprio array; 'regs' são os lançamentos reais, sem esse registro.
  const regs = useMemo(() => dados.filter((d) => d.tipo !== 'metas'), [dados]);
  const metasRec = dados.find((d) => d.tipo === 'metas');
  const [metaForm, setMetaForm] = useState({ seguidores: '', avaliacoes: '' });
  useEffect(() => {
    setMetaForm({ seguidores: metasRec?.seguidores || '', avaliacoes: metasRec?.avaliacoes || '' });
  }, [metasRec?.id]);
  const setMeta = (k) => (v) => setMetaForm((f) => ({ ...f, [k]: v }));
  const salvarMetas = () => {
    const payload = { seguidores: metaForm.seguidores, avaliacoes: metaForm.avaliacoes };
    if (metasRec) onChange(dados.map((d) => (d.tipo === 'metas' ? { ...d, ...payload } : d)));
    else onChange([{ id: uid(), tipo: 'metas', ...payload }, ...dados]);
  };

  const salvar = () => {
    if (!form.mes || !form.canal) return;
    if (editId) onChange(dados.map((d) => (d.id === editId ? { ...form, id: editId } : d)));
    else onChange([{ ...form, id: uid() }, ...dados]);
    setForm(vazio()); setEditId(null);
  };
  const editar = (d) => { setForm({ ...vazio(), ...d }); setEditId(d.id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const excluir = (id) => { if (id === editId) { setForm(vazio()); setEditId(null); } onChange(dados.filter((d) => d.id !== id)); };

  const receitaMes = (m) => receitas.filter((r) => ymOf(r.data) === m).reduce((s, r) => s + num(r.valor), 0);

  const an = useMemo(() => {
    const meses = [...new Set(regs.map((d) => d.mes).filter(Boolean))].sort();
    const investidoMes = (m) => regs.filter((d) => d.mes === m).reduce((s, d) => s + num(d.investido), 0);
    const porCanal = {};
    for (const d of regs) porCanal[d.canal] = (porCanal[d.canal] || 0) + num(d.investido);
    const investidoTotal = regs.reduce((s, d) => s + num(d.investido), 0);
    const receitaComInv = meses.filter((m) => investidoMes(m) > 0).reduce((s, m) => s + receitaMes(m), 0);
    const roasGeral = investidoTotal > 0 ? receitaComInv / investidoTotal : 0;

    const rep = regs.filter((d) => REPUT.includes(d.canal) && (num(d.nota) > 0 || num(d.avaliacoes) > 0)).sort((a, b) => a.mes.localeCompare(b.mes));
    const repAtual = rep.length ? rep[rep.length - 1] : null;
    const avaliacoesAtual = repAtual ? num(repAtual.avaliacoes) : 0;
    const notaAtual = repAtual ? num(repAtual.nota) : 0;
    const insta = regs.filter((d) => d.canal === 'Instagram' && num(d.seguidores) > 0).sort((a, b) => a.mes.localeCompare(b.mes));
    const seguidoresAtual = insta.length ? num(insta[insta.length - 1].seguidores) : 0;

    // Série de reputação do canal mais recente (pra comparar mês a mês o mesmo canal).
    const repCanal = repAtual ? repAtual.canal : null;
    const repSerie = repCanal ? rep.filter((d) => d.canal === repCanal) : [];
    const segDelta = insta.length >= 2 ? num(insta[insta.length - 1].seguidores) - num(insta[insta.length - 2].seguidores) : null;
    const avalDelta = repSerie.length >= 2 ? num(repSerie[repSerie.length - 1].avaliacoes) - num(repSerie[repSerie.length - 2].avaliacoes) : null;

    // Análise automática em texto: se escreve sozinha conforme os lançamentos.
    const linhas = [];
    if (insta.length >= 2) {
      const a = num(insta[insta.length - 1].seguidores), p = num(insta[insta.length - 2].seguidores), d = a - p;
      linhas.push(d >= 0
        ? `No Instagram você ganhou ${int(d)} seguidor${d === 1 ? '' : 'es'} em ${mesLabel(insta[insta.length - 1].mes)}, chegando a ${int(a)}.`
        : `No Instagram você perdeu ${int(-d)} seguidor${-d === 1 ? '' : 'es'} em ${mesLabel(insta[insta.length - 1].mes)} (de ${int(p)} para ${int(a)}). Vale reforçar os posts.`);
    } else if (insta.length === 1) {
      linhas.push(`Instagram: marco inicial de ${int(num(insta[0].seguidores))} seguidores registrado.`);
    }
    if (repSerie.length >= 2) {
      const a = num(repSerie[repSerie.length - 1].avaliacoes), p = num(repSerie[repSerie.length - 2].avaliacoes), d = a - p;
      const nome = repCanal.replace(' (avaliações)', '');
      linhas.push(d >= 0
        ? `${nome}: +${int(d)} avaliaç${d === 1 ? 'ão' : 'ões'} em ${mesLabel(repSerie[repSerie.length - 1].mes)}, total de ${int(a)}.`
        : `${nome}: o total de avaliações caiu de ${int(p)} para ${int(a)}.`);
    } else if (repSerie.length === 1) {
      linhas.push(`${repCanal.replace(' (avaliações)', '')}: marco inicial de ${int(num(repSerie[0].avaliacoes))} avaliações registrado.`);
    }
    if (insta.length >= 3) {
      let melhor = null;
      for (let i = 1; i < insta.length; i++) {
        const d = num(insta[i].seguidores) - num(insta[i - 1].seguidores);
        if (!melhor || d > melhor.d) melhor = { d, mes: insta[i].mes };
      }
      if (melhor && melhor.d > 0) linhas.push(`Seu melhor mês de crescimento no Instagram foi ${mesLabel(melhor.mes)} (+${int(melhor.d)}).`);
    }
    if (insta.length <= 1 && repSerie.length <= 1 && linhas.length > 0) {
      linhas.push('Lance esses números de novo no próximo mês pra o app calcular o quanto você cresceu.');
    }

    return { meses, investidoMes, porCanal, investidoTotal, roasGeral, rep, repSerie, repCanal, avaliacoesAtual, notaAtual, insta, seguidoresAtual, segDelta, avalDelta, linhas };
  }, [regs, receitas]);

  // Comparativo "este mês vs. anterior" — cada métrica com o mês do próprio dado.
  const cmpRows = useMemo(() => {
    const ult2 = (arr, campo) => {
      if (!arr.length) return null;
      const a = arr[arr.length - 1], p = arr.length >= 2 ? arr[arr.length - 2] : null;
      return { atual: num(a[campo]), mesAtual: a.mes, prev: p ? num(p[campo]) : null, mesPrev: p ? p.mes : null };
    };
    const mesesInv = an.meses.filter((m) => an.investidoMes(m) > 0);
    const invRow = mesesInv.length ? {
      atual: an.investidoMes(mesesInv[mesesInv.length - 1]), mesAtual: mesesInv[mesesInv.length - 1],
      prev: mesesInv.length >= 2 ? an.investidoMes(mesesInv[mesesInv.length - 2]) : null,
      mesPrev: mesesInv.length >= 2 ? mesesInv[mesesInv.length - 2] : null,
    } : null;
    const rows = [];
    const seg = ult2(an.insta, 'seguidores'); if (seg) rows.push({ label: 'Seguidores', ...seg, fmt: int, tipo: 'cresc' });
    const aval = ult2(an.repSerie, 'avaliacoes'); if (aval) rows.push({ label: 'Avaliações', ...aval, fmt: int, tipo: 'cresc' });
    if (invRow) rows.push({ label: 'Investido', ...invRow, fmt: brl, tipo: 'neutro' });
    return rows.filter((r) => r.prev !== null);
  }, [an]);

  const segChart = useMemo(() => an.insta.map((d) => ({ mes: mesLabel(d.mes), val: num(d.seguidores) })), [an.insta]);
  const avalChart = useMemo(() => an.repSerie.map((d) => ({ mes: mesLabel(d.mes), val: num(d.avaliacoes) })), [an.repSerie]);

  const maxInvRec = Math.max(1, ...an.meses.map((m) => Math.max(an.investidoMes(m), receitaMes(m))));
  const maxCanal = Math.max(1, ...Object.values(an.porCanal));
  const maxSeg = Math.max(1, ...an.insta.map((d) => num(d.seguidores)));
  const maxAval = Math.max(1, ...an.rep.map((d) => num(d.avaliacoes)));

  // Sub do KPI: variação vs. mês anterior (verde sobe, vermelho cai).
  const deltaSub = (d) => {
    if (d === null || d === undefined) return null;
    if (d === 0) return <span style={{ color: C.faint }}>estável</span>;
    return <span style={{ color: d > 0 ? C.green : C.red, fontWeight: 700 }}>{d > 0 ? '+' : ''}{int(d)} no mês</span>;
  };
  const temAds = an.investidoTotal > 0;
  const resumoItems = [
    { t: 'Seguidores', v: an.seguidoresAtual ? int(an.seguidoresAtual) : '—', c: C.accent, s: deltaSub(an.segDelta) },
    { t: 'Avaliações', v: an.avaliacoesAtual ? int(an.avaliacoesAtual) : '—', c: C.accent, s: deltaSub(an.avalDelta) },
    ...(temAds ? [
      { t: 'Investido total', v: brl(an.investidoTotal), c: C.red },
      { t: 'Receita ÷ investido', v: an.roasGeral ? an.roasGeral.toFixed(1) + 'x' : '—', c: an.roasGeral >= 1 ? C.green : C.amber },
    ] : []),
  ];

  const metaSegV = metasRec ? num(metasRec.seguidores) : 0;
  const metaAvalV = metasRec ? num(metasRec.avaliacoes) : 0;
  const temMeta = metaSegV > 0 || metaAvalV > 0;
  const prevSeg = metaSegV > 0 ? previsao(an.insta, 'seguidores', metaSegV) : null;
  const prevAval = metaAvalV > 0 ? previsao(an.repSerie, 'avaliacoes', metaAvalV) : null;

  const c = form.canal;
  const mostra = (campo) => {
    if (REPUT.includes(c)) return ['nota', 'avaliacoes'].includes(campo);
    if (c === 'Instagram') return ['investido', 'alcance', 'seguidores'].includes(campo);
    return ['investido', 'alcance', 'cliques'].includes(campo); // Meta Ads / Google Ads / Outro
  };

  return (
    <div>
      <PageTitle sub="Crescimento e retorno dos canais">Marketing</PageTitle>

      <Resumo items={resumoItems} />

      {cmpRows.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Este mês vs. anterior</div>
          {cmpRows.map((r) => {
            const d = r.atual - r.prev;
            const subiu = d > 0;
            const cor = r.tipo === 'neutro' ? C.muted : (subiu ? C.green : (d < 0 ? C.red : C.faint));
            const seta = d === 0 ? '' : (subiu ? '▲' : '▼');
            return (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, padding: '7px 0', borderTop: `1px solid ${C.line}` }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{r.label}</div>
                  <div style={{ fontSize: 11, color: C.faint }}>{mesLabel(r.mesPrev)} → {mesLabel(r.mesAtual)}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{r.fmt(r.atual)}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: cor, fontVariantNumeric: 'tabular-nums' }}>
                    {d === 0 ? 'estável' : `${seta} ${r.fmt(Math.abs(d))}`}
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: temMeta ? 12 : 8 }}>Metas</div>
        {metaSegV > 0 && <MetaBar label="Seguidores" atual={an.seguidoresAtual} meta={metaSegV} />}
        {prevSeg && <div style={{ fontSize: 12, color: prevSeg.alerta ? C.amber : C.muted, marginTop: -6, marginBottom: 12, lineHeight: 1.4 }}>Seguidores: {prevSeg.texto}</div>}
        {metaAvalV > 0 && <MetaBar label="Avaliações" atual={an.avaliacoesAtual} meta={metaAvalV} />}
        {prevAval && <div style={{ fontSize: 12, color: prevAval.alerta ? C.amber : C.muted, marginTop: -6, marginBottom: 12, lineHeight: 1.4 }}>Avaliações: {prevAval.texto}</div>}
        {!temMeta && <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>Defina um objetivo (ex.: chegar a 30 mil seguidores) pra acompanhar seu progresso mês a mês.</div>}
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 13, color: C.muted, fontWeight: 600, padding: '4px 0' }}>{temMeta ? 'Editar metas' : 'Definir metas'}</summary>
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Meta de seguidores"><NumInput value={metaForm.seguidores} onChange={setMeta('seguidores')} /></Field>
              <Field label="Meta de avaliações"><NumInput value={metaForm.avaliacoes} onChange={setMeta('avaliacoes')} /></Field>
            </div>
            <div style={{ fontSize: 12, color: C.faint, marginBottom: 10 }}>Deixe em branco (ou 0) para não acompanhar aquela meta.</div>
            <Btn onClick={salvarMetas}>Salvar metas</Btn>
          </div>
        </details>
      </Card>

      {regs.length === 0 ? (
        <Empty>Ainda sem dados de marketing.<br />Cadastre os números de cada canal por mês pra ver os gráficos de crescimento.</Empty>
      ) : (
        <>
          {an.linhas.length > 0 && (
            <Card style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Como está o crescimento</div>
              {an.linhas.map((l, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13.5, color: C.text, lineHeight: 1.5, marginBottom: 6 }}>
                  <span style={{ color: C.accent, flexShrink: 0 }}>•</span><span>{l}</span>
                </div>
              ))}
            </Card>
          )}

          <CurvaCard titulo="Instagram — curva de seguidores" data={segChart} sufixo="seg" />
          <CurvaCard titulo="Avaliações — curva de crescimento" data={avalChart} sufixo="aval" />

          {an.investidoTotal > 0 && (
            <Card style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Investimento × Receita por mês</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>O "retorno" é a receita do mês dividida pelo que você investiu — uma referência do peso do anúncio, não atribuição exata.</div>
              {an.meses.map((m) => {
                const inv = an.investidoMes(m), rec = receitaMes(m), roas = inv > 0 ? rec / inv : 0;
                return (
                  <div key={m} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                      <b style={{ fontSize: 14 }}>{mesLabel(m)}</b>
                      {inv > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: roas >= 1 ? C.green : C.amber }}>receita = {roas.toFixed(1)}× o investido</span>}
                    </div>
                    <Barra label="Investido" valor={inv} max={maxInvRec} cor={C.red} texto={brl(inv)} />
                    <Barra label="Receita" valor={rec} max={maxInvRec} cor={C.green} texto={brl(rec)} />
                  </div>
                );
              })}
            </Card>
          )}

          {Object.keys(an.porCanal).filter((k) => an.porCanal[k] > 0).length > 0 && (
            <Card style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Investido por canal</div>
              {Object.entries(an.porCanal).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([canal, v]) => (
                <Barra key={canal} label={canal} valor={v} max={maxCanal} cor={C.accent} texto={brl(v)} />
              ))}
            </Card>
          )}

          {an.rep.length > 0 && (
            <Card style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Reputação — avaliações</div>
              {an.rep.map((d, i) => {
                const aval = num(d.avaliacoes), nota = num(d.nota);
                const texto = [aval > 0 ? `${int(aval)} avaliações` : '', nota > 0 ? `${nota.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}/5` : ''].filter(Boolean).join(' · ');
                const larg = aval > 0 ? Math.max(3, (aval / maxAval) * 100) : (nota / 5) * 100;
                const prev = an.rep.slice(0, i).reverse().find((x) => x.canal === d.canal);
                const dd = prev && aval > 0 ? aval - num(prev.avaliacoes) : null;
                return (
                  <div key={d.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, marginBottom: 3 }}>
                      <span style={{ color: C.muted }}>{d.canal.replace(' (avaliações)', '')} · {mesLabel(d.mes)}</span>
                      <b style={{ color: C.accent }}>{texto}{dd !== null && dd !== 0 && <span style={{ color: dd > 0 ? C.green : C.red, fontWeight: 700, fontSize: 12, marginLeft: 6 }}>{dd > 0 ? '+' : ''}{int(dd)}</span>}</b>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: `${C.hair}`, overflow: 'hidden' }}>
                      <div style={{ width: `${larg}%`, height: '100%', background: C.green, borderRadius: 999 }} />
                    </div>
                  </div>
                );
              })}
            </Card>
          )}

          {an.insta.length > 0 && (
            <Card style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Instagram — seguidores</div>
              {an.insta.map((d, i) => {
                const v = num(d.seguidores);
                const dd = i > 0 ? v - num(an.insta[i - 1].seguidores) : null;
                return (
                  <div key={d.id} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, marginBottom: 3 }}>
                      <span style={{ color: C.muted }}>{mesLabel(d.mes)}</span>
                      <b style={{ color: C.accent, fontVariantNumeric: 'tabular-nums' }}>{int(v)}{dd !== null && dd !== 0 && <span style={{ color: dd > 0 ? C.green : C.red, fontWeight: 700, fontSize: 12, marginLeft: 6 }}>{dd > 0 ? '+' : ''}{int(dd)}</span>}</b>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: `${C.hair}`, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(3, (v / maxSeg) * 100)}%`, height: '100%', background: C.accent, borderRadius: 999 }} />
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
        </>
      )}

      <Card style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>{editId ? 'Editar registro' : 'Novo registro'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Mês"><TextInput type="month" value={form.mes} onChange={set('mes')} /></Field>
          <Field label="Canal"><Select value={form.canal} onChange={set('canal')} options={CANAIS} /></Field>
        </div>
        {mostra('investido') && <Field label="Investido (R$)"><NumInput value={form.investido} onChange={set('investido')} /></Field>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {mostra('alcance') && <Field label="Alcance / impressões"><NumInput value={form.alcance} onChange={set('alcance')} /></Field>}
          {mostra('cliques') && <Field label="Cliques"><NumInput value={form.cliques} onChange={set('cliques')} /></Field>}
          {mostra('seguidores') && <Field label="Seguidores (total)"><NumInput value={form.seguidores} onChange={set('seguidores')} /></Field>}
          {mostra('nota') && <Field label="Nota (0-5)"><NumInput value={form.nota} onChange={set('nota')} /></Field>}
          {mostra('avaliacoes') && <Field label="Nº de avaliações"><NumInput value={form.avaliacoes} onChange={set('avaliacoes')} /></Field>}
        </div>
        <Field label="Observação"><TextInput value={form.obs} onChange={set('obs')} placeholder="Campanha, promoção…" /></Field>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn onClick={salvar}>{editId ? 'Salvar' : 'Registrar'}</Btn>
          {editId && <Btn kind="ghost" onClick={() => { setForm(vazio()); setEditId(null); }}>Cancelar</Btn>}
        </div>
      </Card>

      {regs.length > 0 && (
        <>
          <SecTitle>Registros ({regs.length})</SecTitle>
          {[...regs].sort((a, b) => (b.mes || '').localeCompare(a.mes || '')).map((d) => (
            <Card key={d.id} style={{ marginBottom: 8, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{d.canal} <span style={{ fontSize: 12, color: C.faint, fontWeight: 400 }}>· {mesLabel(d.mes)}</span></div>
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap', fontVariantNumeric: 'tabular-nums' }}>
                    {num(d.investido) > 0 && <span>{brl(num(d.investido))}</span>}
                    {num(d.alcance) > 0 && <span>{int(num(d.alcance))} alcance</span>}
                    {num(d.cliques) > 0 && <span>{int(num(d.cliques))} cliques</span>}
                    {num(d.seguidores) > 0 && <span>{int(num(d.seguidores))} seg.</span>}
                    {num(d.nota) > 0 && <span>nota {num(d.nota).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</span>}
                    {num(d.avaliacoes) > 0 && <span>{int(num(d.avaliacoes))} aval.</span>}
                  </div>
                  {d.obs && <div style={{ fontSize: 12, color: C.faint, marginTop: 3 }}>{d.obs}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'flex-start' }}>
                  <Btn kind="ghost" small onClick={() => editar(d)}>Editar</Btn>
                  <Btn kind="danger" small onClick={() => excluir(d.id)}>×</Btn>
                </div>
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
