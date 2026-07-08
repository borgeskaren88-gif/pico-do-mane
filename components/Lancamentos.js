'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, KPI, Field, TextInput, NumInput, Select, Area, Empty, Resumo, SecTitle, inputStyle } from './ui';
import { brl, num, todayISO, ymOf, weekday, fmtDate, mesLabel, addDays, uid, FONTES_RECEITA, CUSTO_VARIAVEL, DESPESA_OPERACIONAL, CATEGORIAS_DESPESA, CATEGORIAS_PRODUTO, DIAS, MESES } from '../lib/util';

export default function Lancamentos({ tipo, dados, onChange }) {
  const isReceita = tipo === 'receita';
  const catOptions = isReceita ? FONTES_RECEITA : CATEGORIAS_DESPESA;
  const catLabel = isReceita ? 'Fonte de receita' : 'Categoria da despesa';
  const cor = isReceita ? C.green : C.red;
  const vazio = { data: todayISO(), categoria: '', descricao: '', valor: '', obs: '' };
  const [form, setForm] = useState(vazio);
  const [editId, setEditId] = useState(null);
  const [filtroMes, setFiltroMes] = useState(ymOf(todayISO()));
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const salvar = () => {
    if (!form.data || !form.categoria) return;
    if (editId) onChange(dados.map((d) => d.id === editId ? { ...form, id: editId } : d));
    else onChange([{ ...form, id: uid() }, ...dados]);
    setForm(vazio); setEditId(null);
  };
  const editar = (d) => { setForm(d); setEditId(d.id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const excluir = (id) => onChange(dados.filter((d) => d.id !== id));
  const mesesDisponiveis = [...new Set(dados.map((d) => ymOf(d.data)))].sort().reverse();
  const filtrados = dados.filter((d) => ymOf(d.data) === filtroMes).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  const total = filtrados.reduce((s, d) => s + num(d.valor), 0);
  const totalGeral = dados.reduce((s, d) => s + num(d.valor), 0);

  return (
    <div>
      <Resumo items={[
        { t: isReceita ? 'Receitas lançadas' : 'Despesas lançadas', v: dados.length },
        { t: 'Total acumulado', v: brl(totalGeral), c: cor },
      ]} />

      <Card style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>{editId ? 'Editar' : 'Novo'} lançamento — {isReceita ? 'Receita' : 'Despesa'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Data"><TextInput type="date" value={form.data} onChange={set('data')} /></Field>
          <Field label="Valor (R$)"><NumInput value={form.valor} onChange={set('valor')} /></Field>
        </div>
        <Field label={catLabel}><Select value={form.categoria} onChange={set('categoria')} options={catOptions} /></Field>
        <Field label="Descrição"><TextInput value={form.descricao} onChange={set('descricao')} placeholder={isReceita ? 'Sexta-feira, Sábado…' : 'Fornecedor / item…'} /></Field>
        <Field label="Observação"><TextInput value={form.obs} onChange={set('obs')} placeholder="Opcional" /></Field>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn onClick={salvar}>{editId ? 'Salvar' : 'Lançar'}</Btn>
          {editId && <Btn kind="ghost" onClick={() => { setForm(vazio); setEditId(null); }}>Cancelar</Btn>}
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <Select value={filtroMes} onChange={setFiltroMes} options={mesesDisponiveis.length ? mesesDisponiveis : [ymOf(todayISO())]} placeholder="Mês" />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Total do mês</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: cor, fontVariantNumeric: 'tabular-nums' }}>{brl(total)}</div>
        </div>
      </div>

      {filtrados.length === 0 ? <Empty>Nenhum lançamento neste mês.</Empty> :
        filtrados.map((d) => (
          <Card key={d.id} style={{ marginBottom: 8, padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{d.categoria}</div>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{fmtDate(d.data)}{d.descricao ? ' · ' + d.descricao : ''}</div>
                {d.obs && <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{d.obs}</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 800, color: cor, fontVariantNumeric: 'tabular-nums' }}>{brl(num(d.valor))}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                  <Btn kind="ghost" small onClick={() => editar(d)}>Editar</Btn>
                  <Btn kind="danger" small onClick={() => excluir(d.id)}>×</Btn>
                </div>
              </div>
            </div>
          </Card>
        ))}
    </div>
  );
}

