'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, KPI, Field, TextInput, NumInput, Select, Area, Empty, Resumo, SecTitle, inputStyle } from './ui';
import { brl, num, todayISO, ymOf, weekday, fmtDate, mesLabel, addDays, uid, daysBetween, FONTES_RECEITA, CUSTO_VARIAVEL, DESPESA_OPERACIONAL, CATEGORIAS_DESPESA, CATEGORIAS_PRODUTO, DIAS, MESES } from '../lib/util';

const garrafaVazia = () => ({ produto: '', volume: '1000', dose: '50', dataAbertura: todayISO(), dataTermino: '', drinks: '', obs: '' });
export default function Garrafas({ dados, onChange }) {
  const [form, setForm] = useState(garrafaVazia());
  const [editId, setEditId] = useState(null);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const dosesTeoricas = (g) => num(g.dose) ? Math.round(num(g.volume) / num(g.dose)) : 0;
  const dias = (g) => (g.dataAbertura && g.dataTermino) ? daysBetween(g.dataAbertura, g.dataTermino) : 0;
  const dosesDia = (g) => dias(g) > 0 ? dosesTeoricas(g) / dias(g) : 0;

  const salvar = () => {
    if (!form.produto) return;
    if (editId) onChange(dados.map((d) => d.id === editId ? { ...form, id: editId } : d));
    else onChange([{ ...form, id: uid() }, ...dados]);
    setForm(garrafaVazia()); setEditId(null);
  };
  const editar = (d) => { setForm(d); setEditId(d.id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const excluir = (id) => onChange(dados.filter((d) => d.id !== id));
  const finalizar = (d) => onChange(dados.map((x) => x.id === d.id ? { ...x, dataTermino: todayISO() } : x));

  const emUso = dados.filter((g) => g.dataAbertura && !g.dataTermino);
  const finalizadas = dados.filter((g) => g.dataTermino).sort((a, b) => (b.dataTermino || '').localeCompare(a.dataTermino || ''));
  const previewDoses = dosesTeoricas(form);
  const previewDias = dias(form);
  const previewMedia = dosesDia(form);

  const linhaGarrafa = (g, aberta) => (
    <Card key={g.id} style={{ marginBottom: 8, padding: 14, borderColor: aberta ? C.accent : C.line }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{g.produto} {aberta && <span style={{ fontSize: 12, color: C.accent }}>· aberta</span>}</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>
            {num(g.volume)}ml · dose {num(g.dose)}ml · <b style={{ color: C.text }}>{dosesTeoricas(g)} doses</b>
          </div>
          <div style={{ fontSize: 12, color: C.faint, marginTop: 3 }}>
            Aberta {fmtDate(g.dataAbertura)}{g.dataTermino ? ` · encerrada ${fmtDate(g.dataTermino)}` : ''}
            {dias(g) > 0 && ` · durou ${dias(g)} dia(s) · ${dosesDia(g).toFixed(2)} doses/dia`}
          </div>
          {g.drinks && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}><b style={{ color: C.faint }}>Drinks:</b> {g.drinks}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {aberta && <Btn kind="ok" small onClick={() => finalizar(g)}>Encerrar hoje</Btn>}
        <Btn kind="ghost" small onClick={() => editar(g)}>Editar</Btn>
        <Btn kind="danger" small onClick={() => excluir(g.id)}>Excluir</Btn>
      </div>
    </Card>
  );

  return (
    <div>
      <Resumo items={[
        { t: 'Garrafas cadastradas', v: dados.length },
        { t: 'Abertas agora', v: emUso.length, c: emUso.length ? C.accent : C.faint },
      ]} />

      <Card style={{ marginBottom: 14, background: C.panel2 }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: C.accent, fontWeight: 700, marginBottom: 8 }}>Controle de garrafas e doses</div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
          Dose padrão de destilados: <b style={{ color: C.text }}>50 ml</b>. Uma garrafa de 1L rende <b style={{ color: C.text }}>20 doses</b>. Registre quando abrir e quando terminar para ver quanto tempo durou e a média de doses por dia.
        </div>
      </Card>

      <Card style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>{editId ? 'Editar garrafa' : 'Nova garrafa'}</div>
        <Field label="Produto"><TextInput value={form.produto} onChange={set('produto')} placeholder="Gin Kalvelage, RedLabel…" /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Volume da garrafa (ml)"><NumInput value={form.volume} onChange={set('volume')} /></Field>
          <Field label="Dose padrão (ml)"><NumInput value={form.dose} onChange={set('dose')} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Data de abertura"><TextInput type="date" value={form.dataAbertura} onChange={set('dataAbertura')} /></Field>
          <Field label="Data de término"><TextInput type="date" value={form.dataTermino} onChange={set('dataTermino')} /></Field>
        </div>
        <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 13, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <span style={{ color: C.muted }}>Doses teóricas: <b style={{ color: C.text }}>{previewDoses}</b></span>
          {previewDias > 0 && <span style={{ color: C.muted }}>Duração: <b style={{ color: C.text }}>{previewDias} dia(s)</b></span>}
          {previewMedia > 0 && <span style={{ color: C.muted }}>Média: <b style={{ color: C.accent }}>{previewMedia.toFixed(2)} doses/dia</b></span>}
        </div>
        <Field label="Drinks que usam"><TextInput value={form.drinks} onChange={set('drinks')} placeholder="Gin Tônica, Melancita…" /></Field>
        <Field label="Observação"><TextInput value={form.obs} onChange={set('obs')} placeholder="Opcional" /></Field>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn onClick={salvar}>{editId ? 'Salvar garrafa' : 'Registrar garrafa'}</Btn>
          {editId && <Btn kind="ghost" onClick={() => { setForm(garrafaVazia()); setEditId(null); }}>Cancelar</Btn>}
        </div>
      </Card>

      {emUso.length > 0 && (<><SecTitle>Abertas agora ({emUso.length})</SecTitle>{emUso.map((g) => linhaGarrafa(g, true))}</>)}
      <SecTitle>Encerradas ({finalizadas.length})</SecTitle>
      {finalizadas.length === 0 ? <Empty>Nenhuma garrafa encerrada ainda.</Empty> : finalizadas.map((g) => linhaGarrafa(g, false))}
    </div>
  );
}

