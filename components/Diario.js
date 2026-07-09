'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, KPI, Field, TextInput, NumInput, Select, Area, Empty, Resumo, SecTitle, inputStyle } from './ui';
import { brl, num, todayISO, ymOf, weekday, fmtDate, mesLabel, addDays, uid, FONTES_RECEITA, CUSTO_VARIAVEL, DESPESA_OPERACIONAL, CATEGORIAS_DESPESA, CATEGORIAS_PRODUTO, DIAS, MESES } from '../lib/util';

const diarioVazio = () => ({
  data: todayISO(), clima: '', evento: '', receita: '', nPedidos: '', fiado: '',
  caixaFechou: '', diferenca: '', comprasEmerg: '', estoqueCritico: '',
  problema: '', decisao: '', aprendizado: '', prioridade: '', nota: '',
});
export default function Diario({ dados, onChange, tarefas = [], onTarefas }) {
  const [form, setForm] = useState(diarioVazio());
  const [editId, setEditId] = useState(null);
  const [novaTarefa, setNovaTarefa] = useState('');
  const [verConcluidas, setVerConcluidas] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const tarefasAbertas = tarefas.filter((t) => !t.feito);
  const tarefasFeitas = tarefas.filter((t) => t.feito);
  const addTarefa = () => {
    const txt = novaTarefa.trim();
    if (!txt || !onTarefas) return;
    onTarefas([{ id: uid(), texto: txt, feito: false, criadoEm: Date.now() }, ...tarefas]);
    setNovaTarefa('');
  };
  const toggleTarefa = (id) => onTarefas(tarefas.map((t) => t.id === id ? { ...t, feito: !t.feito, feitoEm: !t.feito ? Date.now() : null } : t));
  const removerTarefa = (id) => onTarefas(tarefas.filter((t) => t.id !== id));
  const limparConcluidas = () => onTarefas(tarefas.filter((t) => !t.feito));
  const ticket = num(form.receita) && num(form.nPedidos) ? num(form.receita) / num(form.nPedidos) : 0;
  const salvar = () => {
    if (!form.data) return;
    if (editId) onChange(dados.map((d) => d.id === editId ? { ...form, id: editId } : d));
    else onChange([{ ...form, id: uid() }, ...dados]);
    setForm(diarioVazio()); setEditId(null);
  };
  const editar = (d) => { setForm(d); setEditId(d.id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const excluir = (id) => onChange(dados.filter((d) => d.id !== id));
  const ordenado = [...dados].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  const notas = dados.map((d) => num(d.nota)).filter((n) => n > 0);
  const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : 0;
  const receitaTotal = dados.reduce((s, d) => s + num(d.receita), 0);

  return (
    <div>
      {onTarefas && (
        <Card style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>✓ Checklist do bar</div>
            {tarefasAbertas.length > 0 && <div style={{ fontSize: 13, color: C.muted }}>{tarefasAbertas.length} pendente{tarefasAbertas.length > 1 ? 's' : ''}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: tarefasAbertas.length || tarefasFeitas.length ? 12 : 0 }}>
            <input value={novaTarefa} onChange={(e) => setNovaTarefa(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addTarefa(); }}
              placeholder="Nova tarefa… (ex: comprar gelo)" style={{ ...inputStyle, flex: 1 }} />
            <Btn small onClick={addTarefa}>Adicionar</Btn>
          </div>

          {tarefasAbertas.length === 0 && tarefasFeitas.length === 0 && (
            <div style={{ fontSize: 13, color: C.faint, textAlign: 'center', padding: '10px 0 2px' }}>Nenhuma tarefa. Anote o que precisa fazer no bar.</div>
          )}

          {tarefasAbertas.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: `1px solid ${C.line}` }}>
              <button onClick={() => toggleTarefa(t.id)} aria-label="Concluir" style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${C.line}`, background: 'transparent', cursor: 'pointer', flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 14, color: C.text }}>{t.texto}</div>
              <button onClick={() => removerTarefa(t.id)} aria-label="Excluir" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
            </div>
          ))}

          {tarefasFeitas.length > 0 && (
            <div style={{ marginTop: 12, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={() => setVerConcluidas((v) => !v)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 }}>
                  {verConcluidas ? '▾' : '▸'} Concluídas ({tarefasFeitas.length})
                </button>
                <button onClick={limparConcluidas} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0 }}>limpar concluídas</button>
              </div>
              {verConcluidas && tarefasFeitas.map((t) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                  <button onClick={() => toggleTarefa(t.id)} aria-label="Reabrir" style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${C.green}`, background: C.green, color: '#052014', cursor: 'pointer', flexShrink: 0, fontWeight: 900, fontSize: 13, lineHeight: 1 }}>✓</button>
                  <div style={{ flex: 1, fontSize: 14, color: C.faint, textDecoration: 'line-through' }}>{t.texto}</div>
                  <button onClick={() => removerTarefa(t.id)} aria-label="Excluir" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Resumo items={[
        { t: 'Dias registrados', v: dados.length },
        { t: 'Nota média', v: media ? media.toFixed(1) : '—', c: C.accent },
        { t: 'Receita lançada', v: brl(receitaTotal), c: C.green },
      ]} />

      <Card style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>{editId ? 'Editar dia' : 'Fechamento do dia'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Data"><TextInput type="date" value={form.data} onChange={set('data')} /></Field>
          <Field label="Dia da semana"><TextInput value={weekday(form.data)} onChange={() => { }} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Clima"><TextInput value={form.clima} onChange={set('clima')} placeholder="Sol, muito frio…" /></Field>
          <Field label="Evento"><TextInput value={form.evento} onChange={set('evento')} placeholder="Copa, ao vivo…" /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Receita do dia (R$)"><NumInput value={form.receita} onChange={set('receita')} /></Field>
          <Field label="Nº de pedidos"><NumInput value={form.nPedidos} onChange={set('nPedidos')} /></Field>
        </div>
        {ticket > 0 && <div style={{ fontSize: 13, color: C.accent, margin: '-4px 0 12px', fontWeight: 600 }}>Ticket médio: {brl(ticket)}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Nº de pedidos fiados"><NumInput value={form.fiado} onChange={set('fiado')} placeholder="0" /></Field>
          <Field label="Caixa fechou certo?"><Select value={form.caixaFechou} onChange={set('caixaFechou')} options={['Sim', 'Não']} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Diferença de caixa (R$)"><NumInput value={form.diferenca} onChange={set('diferenca')} /></Field>
          <Field label="Nota do dia (1-10)"><NumInput value={form.nota} onChange={set('nota')} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Compras emergenciais?"><Select value={form.comprasEmerg} onChange={set('comprasEmerg')} options={['Sim', 'Não']} /></Field>
          <Field label="Estoque crítico?"><Select value={form.estoqueCritico} onChange={set('estoqueCritico')} options={['Sim', 'Não']} /></Field>
        </div>
        <Field label="Problema do dia"><Area value={form.problema} onChange={set('problema')} placeholder="O que travou?" /></Field>
        <Field label="Melhor decisão"><Area value={form.decisao} onChange={set('decisao')} placeholder="O que você fez de certo?" /></Field>
        <Field label="Aprendizado"><Area value={form.aprendizado} onChange={set('aprendizado')} placeholder="O que fica pra próxima?" /></Field>
        <Field label="Prioridade de amanhã"><Area value={form.prioridade} onChange={set('prioridade')} placeholder="Foco nº 1 do próximo dia" /></Field>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn onClick={salvar}>{editId ? 'Salvar alterações' : 'Registrar dia'}</Btn>
          {editId && <Btn kind="ghost" onClick={() => { setForm(diarioVazio()); setEditId(null); }}>Cancelar</Btn>}
        </div>
      </Card>

      <SecTitle>Histórico ({dados.length})</SecTitle>
      {ordenado.length === 0 ? <Empty>Nenhum dia registrado ainda.<br />Comece fechando o caixa de hoje.</Empty> :
        ordenado.map((d) => (
          <Card key={d.id} style={{ marginBottom: 10, padding: 14 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{fmtDate(d.data)} · {weekday(d.data)}</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{d.clima && <span>{d.clima} · </span>}{d.evento || 'Sem evento'}</div>
              <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap', fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ color: C.green, fontWeight: 700 }}>{brl(num(d.receita))}</span>
                {num(d.nPedidos) > 0 && <span style={{ color: C.muted, fontSize: 13 }}>{d.nPedidos} pedidos · tkt {brl(num(d.receita) / num(d.nPedidos))}</span>}
                {num(d.fiado) > 0 && <span style={{ color: C.amber, fontSize: 13 }}>{d.fiado} fiado{num(d.fiado) > 1 ? 's' : ''}</span>}
                {d.nota && <span style={{ color: C.accent, fontSize: 13 }}>Nota {d.nota}</span>}
              </div>
              {d.problema && <div style={{ fontSize: 13, color: C.muted, marginTop: 8 }}><b style={{ color: C.faint }}>Problema:</b> {d.problema}</div>}
              {d.prioridade && <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}><b style={{ color: C.faint }}>Amanhã:</b> {d.prioridade}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Btn kind="ghost" small onClick={() => editar(d)}>Editar</Btn>
              <Btn kind="danger" small onClick={() => excluir(d.id)}>Excluir</Btn>
            </div>
          </Card>
        ))}
    </div>
  );
}

