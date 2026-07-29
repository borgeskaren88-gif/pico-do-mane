'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, Field, TextInput, NumInput, Select, Empty, Resumo, SecTitle, PageTitle } from './ui';
import { brl, num, todayISO, ymOf, mesLabel, uid } from '../lib/util';

const CANAIS = ['Meta Ads', 'Google Ads', 'Instagram', 'TripAdvisor', 'Outro'];
const vazio = () => ({ mes: ymOf(todayISO()), canal: 'Meta Ads', investido: '', alcance: '', cliques: '', seguidores: '', nota: '', avaliacoes: '', obs: '' });
const int = (n) => Math.round(n).toLocaleString('pt-BR');

// Barra horizontal simples (mesmo estilo do resto do app).
function Barra({ label, valor, max, cor, texto }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, marginBottom: 3 }}>
        <span style={{ color: C.muted }}>{label}</span>
        <b style={{ color: cor, fontVariantNumeric: 'tabular-nums' }}>{texto}</b>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: `${C.line}55`, overflow: 'hidden' }}>
        <div style={{ width: `${max > 0 ? Math.max(3, (valor / max) * 100) : 0}%`, height: '100%', background: cor, borderRadius: 999 }} />
      </div>
    </div>
  );
}

export default function Marketing({ dados, onChange, receitas = [] }) {
  const [form, setForm] = useState(vazio());
  const [editId, setEditId] = useState(null);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

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
    const meses = [...new Set(dados.map((d) => d.mes).filter(Boolean))].sort();
    const investidoMes = (m) => dados.filter((d) => d.mes === m).reduce((s, d) => s + num(d.investido), 0);
    const porCanal = {};
    for (const d of dados) porCanal[d.canal] = (porCanal[d.canal] || 0) + num(d.investido);
    const investidoTotal = dados.reduce((s, d) => s + num(d.investido), 0);
    const receitaComInv = meses.filter((m) => investidoMes(m) > 0).reduce((s, m) => s + receitaMes(m), 0);
    const roasGeral = investidoTotal > 0 ? receitaComInv / investidoTotal : 0;

    const ta = dados.filter((d) => d.canal === 'TripAdvisor' && (num(d.nota) > 0 || num(d.avaliacoes) > 0)).sort((a, b) => a.mes.localeCompare(b.mes));
    const notaAtual = ta.length ? num(ta[ta.length - 1].nota) : 0;
    const insta = dados.filter((d) => d.canal === 'Instagram' && num(d.seguidores) > 0).sort((a, b) => a.mes.localeCompare(b.mes));
    const seguidoresAtual = insta.length ? num(insta[insta.length - 1].seguidores) : 0;

    return { meses, investidoMes, porCanal, investidoTotal, roasGeral, ta, notaAtual, insta, seguidoresAtual };
  }, [dados, receitas]);

  const maxInvRec = Math.max(1, ...an.meses.map((m) => Math.max(an.investidoMes(m), receitaMes(m))));
  const maxCanal = Math.max(1, ...Object.values(an.porCanal));
  const maxSeg = Math.max(1, ...an.insta.map((d) => num(d.seguidores)));

  const c = form.canal;
  const mostra = (campo) => {
    if (c === 'TripAdvisor') return ['nota', 'avaliacoes'].includes(campo);
    if (c === 'Instagram') return ['investido', 'alcance', 'seguidores'].includes(campo);
    return ['investido', 'alcance', 'cliques'].includes(campo); // Meta/Google/Outro
  };

  return (
    <div>
      <PageTitle sub="Crescimento e retorno dos canais">Marketing</PageTitle>

      <Resumo items={[
        { t: 'Investido total', v: brl(an.investidoTotal), c: C.red },
        { t: 'Receita ÷ investido', v: an.roasGeral ? an.roasGeral.toFixed(1) + 'x' : '—', c: an.roasGeral >= 1 ? C.green : C.amber },
        { t: 'Nota TripAdvisor', v: an.notaAtual ? an.notaAtual.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—', c: C.accent },
        { t: 'Seguidores', v: an.seguidoresAtual ? int(an.seguidoresAtual) : '—', c: C.accent },
      ]} />

      {dados.length === 0 ? (
        <Empty>Ainda sem dados de marketing.<br />Cadastre os números de cada canal por mês pra ver os gráficos de crescimento.</Empty>
      ) : (
        <>
          {an.meses.some((m) => an.investidoMes(m) > 0 || receitaMes(m) > 0) && (
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

          {an.ta.length > 0 && (
            <Card style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Reputação — TripAdvisor</div>
              {an.ta.map((d) => (
                <div key={d.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, marginBottom: 3 }}>
                    <span style={{ color: C.muted }}>{mesLabel(d.mes)}</span>
                    <b style={{ color: C.accent }}>{num(d.nota).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} / 5 {num(d.avaliacoes) > 0 ? `· ${int(num(d.avaliacoes))} avaliações` : ''}</b>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: `${C.line}55`, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, (num(d.nota) / 5) * 100)}%`, height: '100%', background: C.green, borderRadius: 999 }} />
                  </div>
                </div>
              ))}
            </Card>
          )}

          {an.insta.length > 0 && (
            <Card style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Instagram — seguidores</div>
              {an.insta.map((d) => (
                <Barra key={d.id} label={mesLabel(d.mes)} valor={num(d.seguidores)} max={maxSeg} cor={C.accent} texto={int(num(d.seguidores))} />
              ))}
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

      {dados.length > 0 && (
        <>
          <SecTitle>Registros ({dados.length})</SecTitle>
          {[...dados].sort((a, b) => (b.mes || '').localeCompare(a.mes || '')).map((d) => (
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
