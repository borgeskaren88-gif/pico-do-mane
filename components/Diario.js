'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { C, Card, Btn, KPI, Field, TextInput, NumInput, Select, Empty, Resumo, SecTitle, PageTitle, inputStyle } from './ui';
import { brl, num, todayISO, ymOf, weekday, fmtDate, mesLabel, addDays, uid, FONTES_RECEITA, CUSTO_VARIAVEL, DESPESA_OPERACIONAL, CATEGORIAS_DESPESA, CATEGORIAS_PRODUTO, DIAS, MESES } from '../lib/util';
import CalendarioPedidos from './CalendarioPedidos';
import Visitantes from './Visitantes';
import AreaVoz from './AreaVoz';
import MicBtn from './MicBtn';

const diarioVazio = () => ({
  data: todayISO(), clima: '', evento: '', receita: '', nPedidos: '', fiado: '',
  caixaFechou: '', diferenca: '', comprasEmerg: '', estoqueCritico: '',
  relato: '', prioridade: '', nota: '',
});
// Junta os campos antigos (problema/decisão/aprendizado) num texto só, pra
// migrar registros já salvos para o novo campo "relato" sem perder nada.
const migrarRelato = (d) => {
  if (d.relato) return d.relato;
  return [
    d.problema && `Problema: ${d.problema}`,
    d.decisao && `Melhor decisão: ${d.decisao}`,
    d.aprendizado && `Aprendizado: ${d.aprendizado}`,
  ].filter(Boolean).join('\n');
};
const FONTE_ATRASADO = 'Recebimento Atrasado';
const atrVazio = () => ({ data: todayISO(), valor: '', descricao: '' });
export default function Diario({ dados, onChange, receitas = [], onReceitas, visitantes = [], onVisitantes, onRepor, pessoasPorDia = {}, pedidosPorDia = {}, fiadosPorDia = {} }) {
  const [abaLog, setAbaLog] = useState('fechamento'); // 'fechamento' | 'atrasados'
  const [form, setForm] = useState(diarioVazio());
  const [atrForm, setAtrForm] = useState(atrVazio());
  const setAtr = (k) => (v) => setAtrForm((f) => ({ ...f, [k]: v }));
  const [editId, setEditId] = useState(null);
  const [faltou, setFaltou] = useState('');
  const [msgFaltou, setMsgFaltou] = useState('');
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  // Preenche sozinho o nº de pedidos e de fiados com as comandas do dia quando a
  // data muda (igual a receita). Só ao registrar um dia novo (não ao editar um
  // dia salvo), e só quando há comandas naquele dia — dá pra ajustar na mão.
  useEffect(() => {
    if (editId) return;
    const ped = pedidosPorDia[form.data] || 0;
    const fia = fiadosPorDia[form.data] || 0;
    if (ped > 0 || fia > 0) setForm((f) => ({ ...f, nPedidos: ped > 0 ? String(ped) : f.nPedidos, fiado: fia > 0 ? String(fia) : f.fiado }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.data, pedidosPorDia, fiadosPorDia, editId]);

  // Caixa do dia = receitas da data SEM o "Recebimento Atrasado" (esse fica à
  // parte, pra não inflar o caixa do dia). Para dias antigos sem nada lançado em
  // Receitas, mantém o valor que já estava salvo no diário.
  const ehAtrasado = (r) => (r.categoria || '') === FONTE_ATRASADO;
  const receitasDoDia = (data) => receitas.filter((r) => r.data === data);
  const caixaDoDia = (data) => receitasDoDia(data).filter((r) => !ehAtrasado(r)).reduce((s, r) => s + num(r.valor), 0);
  const atrasadoDoDia = (data) => receitasDoDia(data).filter(ehAtrasado).reduce((s, r) => s + num(r.valor), 0);
  const receitaExibida = (d) => { const c = caixaDoDia(d.data); return c > 0 ? c : num(d.receita); };

  const recForm = receitasDoDia(form.data);
  const caixaForm = caixaDoDia(form.data);
  const atrasadoForm = atrasadoDoDia(form.data);
  const porFonteForm = recForm.filter((r) => !ehAtrasado(r)).reduce((m, r) => { const k = r.categoria || 'Outros'; m[k] = (m[k] || 0) + num(r.valor); return m; }, {});
  const receitaForm = caixaForm > 0 ? caixaForm : num(form.receita);
  const ticket = receitaForm && num(form.nPedidos) ? receitaForm / num(form.nPedidos) : 0;

  // Recebimentos atrasados (todas as datas), pra aba própria.
  const atrasados = receitas.filter(ehAtrasado).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  const addAtrasado = () => {
    if (!onReceitas || !atrForm.data || num(atrForm.valor) <= 0) return;
    onReceitas([{ id: uid(), data: atrForm.data, categoria: FONTE_ATRASADO, descricao: atrForm.descricao.trim(), valor: atrForm.valor, obs: '' }, ...receitas]);
    setAtrForm(atrVazio());
  };
  const excluirAtrasado = (id) => onReceitas && onReceitas(receitas.filter((r) => r.id !== id));

  const salvar = () => {
    if (!form.data) return;
    const recCalc = caixaDoDia(form.data);
    const registro = { ...form, receita: recCalc > 0 ? recCalc.toFixed(2).replace('.', ',') : form.receita };
    if (editId) onChange(dados.map((d) => d.id === editId ? { ...registro, id: editId } : d));
    else onChange([{ ...registro, id: uid() }, ...dados]);
    setForm(diarioVazio()); setEditId(null);
  };
  const editar = (d) => { setForm({ ...diarioVazio(), ...d, relato: migrarRelato(d) }); setEditId(d.id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const excluir = (id) => onChange(dados.filter((d) => d.id !== id));

  // Estoque crítico → Lista de Compras: manda os itens que faltaram direto para
  // a lista de reposição (separados por vírgula).
  const addFaltou = () => {
    const nomes = faltou.split(',').map((s) => s.trim()).filter(Boolean);
    if (!nomes.length || !onRepor) return;
    const itens = nomes.map((n) => ({ id: uid(), nome: n, quantidade: '', categoria: '', comprado: false, criadoEm: Date.now() }));
    const add = onRepor(itens);
    setMsgFaltou(add === 0 ? 'já estavam na lista' : `${add} item(ns) adicionado(s) à Lista de Compras`);
    setFaltou('');
    setTimeout(() => setMsgFaltou(''), 4000);
  };
  const ordenado = [...dados].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  const notas = dados.map((d) => num(d.nota)).filter((n) => n > 0);
  const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : 0;
  const receitaTotal = dados.reduce((s, d) => s + receitaExibida(d) + atrasadoDoDia(d.data), 0);

  return (
    <div>
      <PageTitle sub="Checklist do bar e fechamento do dia">Log Operacional</PageTitle>

      <div style={{ marginBottom: 18, maxWidth: 440 }}>
        <CalendarioPedidos dados={dados} />
      </div>

      <Resumo items={[
        { t: 'Dias registrados', v: dados.length },
        { t: 'Nota média', v: media ? media.toFixed(1) : '—', c: C.accent },
        { t: 'Receita lançada', v: 'R$ ' + Math.round(receitaTotal).toLocaleString('pt-BR'), c: C.green },
      ]} />

      <div style={{ display: 'flex', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: 3, gap: 3, marginBottom: 18 }}>
        {[['fechamento', 'Fechamento'], ['atrasados', 'Recebimentos atrasados']].map(([v, rot]) => (
          <button key={v} onClick={() => setAbaLog(v)} style={{
            flex: 1, border: 'none', cursor: 'pointer', borderRadius: 9, padding: '9px 8px', fontSize: 13.5, fontWeight: 700,
            background: abaLog === v ? C.accent : 'transparent', color: abaLog === v ? '#06101F' : C.muted,
          }}>{rot}</button>
        ))}
      </div>

      {abaLog === 'fechamento' && (<>
      <Card style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>{editId ? 'Editar dia' : 'Fechamento do dia'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Data"><TextInput type="date" value={form.data} onChange={set('data')} /></Field>
          <Field label="Dia da semana"><TextInput value={weekday(form.data)} onChange={() => { }} /></Field>
        </div>
        <Field label="Caixa do dia (puxado das Receitas)">
          <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '11px 12px' }}>
            <div style={{ fontSize: 19, fontWeight: 800, color: caixaForm > 0 ? C.green : C.faint, fontVariantNumeric: 'tabular-nums' }}>{brl(caixaForm)}</div>
            {caixaForm > 0
              ? <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{Object.entries(porFonteForm).map(([f, v]) => `${f}: ${brl(v)}`).join(' · ')}</div>
              : <div style={{ fontSize: 12, color: C.faint, marginTop: 4 }}>Nada de caixa lançado em Receitas nesse dia. Lance na aba <b>Receitas</b> que aparece aqui automaticamente.</div>}
            {atrasadoForm > 0 && (
              <div style={{ fontSize: 12, color: C.amber, marginTop: 8, borderTop: `1px solid ${C.line}`, paddingTop: 8, fontWeight: 600 }}>
                + {brl(atrasadoForm)} de recebimento atrasado nesse dia — <span style={{ color: C.muted, fontWeight: 400 }}>não entra no caixa do dia.</span>
              </div>
            )}
          </div>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Nº de pedidos"><NumInput value={form.nPedidos} onChange={set('nPedidos')} /></Field>
          <Field label="Nº de pedidos fiados"><NumInput value={form.fiado} onChange={set('fiado')} placeholder="0" /></Field>
        </div>
        {!editId && ((pedidosPorDia[form.data] || 0) > 0 || (fiadosPorDia[form.data] || 0) > 0) && <div style={{ fontSize: 12, color: C.faint, margin: '-4px 0 12px' }}>Preenchido automaticamente pelas comandas do dia — dá pra ajustar.</div>}
        {num(pessoasPorDia[form.data]) > 0 && <div style={{ fontSize: 13, color: C.accent2, margin: '-4px 0 12px', fontWeight: 600 }}>Pessoas nas mesas nesse dia: {num(pessoasPorDia[form.data])} <span style={{ color: C.faint, fontWeight: 400 }}>(somado das comandas)</span></div>}
        {ticket > 0 && <div style={{ fontSize: 13, color: C.accent, margin: '-4px 0 12px', fontWeight: 600 }}>Ticket médio: {brl(ticket)}</div>}
        <Field label="Relatório do dia"><AreaVoz value={form.relato} onChange={set('relato')} placeholder="Relato livre do dia: movimento, o que funcionou, o que faltou, clientes, equipe, imprevistos…" rows={6} /></Field>
        <Field label="Prioridade de amanhã"><AreaVoz value={form.prioridade} onChange={set('prioridade')} placeholder="Foco nº 1 do próximo dia" /></Field>

        <details style={{ margin: '2px 0 16px' }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, color: C.muted, fontWeight: 600, padding: '4px 0' }}>+ Mais detalhes (opcional)</summary>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Clima"><TextInput value={form.clima} onChange={set('clima')} placeholder="Sol, muito frio…" /></Field>
              <Field label="Evento"><TextInput value={form.evento} onChange={set('evento')} placeholder="Copa, ao vivo…" /></Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Caixa fechou certo?"><Select value={form.caixaFechou} onChange={set('caixaFechou')} options={['Sim', 'Não']} /></Field>
              <Field label="Diferença de caixa (R$)"><NumInput value={form.diferenca} onChange={set('diferenca')} /></Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Compras emergenciais?"><Select value={form.comprasEmerg} onChange={set('comprasEmerg')} options={['Sim', 'Não']} /></Field>
              <Field label="Estoque crítico?"><Select value={form.estoqueCritico} onChange={set('estoqueCritico')} options={['Sim', 'Não']} /></Field>
            </div>
            <Field label="Nota do dia (1-10)"><NumInput value={form.nota} onChange={set('nota')} /></Field>
            {form.estoqueCritico === 'Sim' && onRepor && (
              <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>O que faltou? Já jogo na Lista de Compras.</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}><TextInput value={faltou} onChange={setFaltou} placeholder="Gelo, limão, gin… (separe por vírgula)" /></div>
                  <MicBtn value={faltou} onChange={setFaltou} />
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
                  <Btn small onClick={addFaltou}>Adicionar à lista</Btn>
                  {msgFaltou && <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>{msgFaltou}</span>}
                </div>
              </div>
            )}
          </div>
        </details>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn onClick={salvar}>{editId ? 'Salvar alterações' : 'Registrar dia'}</Btn>
          {editId && <Btn kind="ghost" onClick={() => { setForm(diarioVazio()); setEditId(null); }}>Cancelar</Btn>}
        </div>
      </Card>

      {onVisitantes && <Visitantes dados={visitantes} onChange={onVisitantes} />}

      <SecTitle>Histórico ({dados.length})</SecTitle>
      {ordenado.length === 0 ? <Empty>Nenhum dia registrado ainda.<br />Comece fechando o caixa de hoje.</Empty> :
        ordenado.map((d) => (
          <Card key={d.id} style={{ marginBottom: 10, padding: 14 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{fmtDate(d.data)} · {weekday(d.data)}</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{d.clima && <span>{d.clima} · </span>}{d.evento || 'Sem evento'}</div>
              <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap', fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ color: C.green, fontWeight: 700 }}>{brl(receitaExibida(d))}</span>
                {atrasadoDoDia(d.data) > 0 && <span style={{ color: C.amber, fontSize: 13 }}>+ {brl(atrasadoDoDia(d.data))} atrasado</span>}
                {num(d.nPedidos) > 0 && <span style={{ color: C.muted, fontSize: 13 }}>{d.nPedidos} pedidos · tkt {brl(receitaExibida(d) / num(d.nPedidos))}</span>}
                {num(pessoasPorDia[d.data]) > 0 && <span style={{ color: C.accent2, fontSize: 13 }}>{num(pessoasPorDia[d.data])} pessoas</span>}
                {num(d.fiado) > 0 && <span style={{ color: C.amber, fontSize: 13 }}>{d.fiado} fiado{num(d.fiado) > 1 ? 's' : ''}</span>}
                {d.nota && <span style={{ color: C.accent, fontSize: 13 }}>Nota {d.nota}</span>}
              </div>
              {migrarRelato(d) && <div style={{ fontSize: 13, color: C.muted, marginTop: 8, whiteSpace: 'pre-wrap' }}><b style={{ color: C.faint }}>Relatório:</b> {migrarRelato(d)}</div>}
              {d.prioridade && <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}><b style={{ color: C.faint }}>Amanhã:</b> {d.prioridade}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Btn kind="ghost" small onClick={() => editar(d)}>Editar</Btn>
              <Btn kind="danger" small onClick={() => excluir(d.id)}>Excluir</Btn>
            </div>
          </Card>
        ))}
      </>)}

      {abaLog === 'atrasados' && (<>
        <Card style={{ marginBottom: 14, background: C.panel2 }}>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
            Valores que <b style={{ color: C.text }}>caíram depois</b> (ex.: um fiado antigo que te pagaram hoje). Entram como receita do mês, mas <b style={{ color: C.text }}>não</b> contam no caixa do dia em que você recebeu.
          </div>
        </Card>

        <Card style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>Lançar recebimento atrasado</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Data que recebeu"><TextInput type="date" value={atrForm.data} onChange={setAtr('data')} /></Field>
            <Field label="Valor (R$)"><NumInput value={atrForm.valor} onChange={setAtr('valor')} /></Field>
          </div>
          <Field label="Referência"><TextInput value={atrForm.descricao} onChange={setAtr('descricao')} placeholder="Ex.: Fiado do João — venda de 12/07" /></Field>
          <Btn onClick={addAtrasado}>Lançar recebimento</Btn>
          {!onReceitas && <div style={{ fontSize: 12, color: C.amber, marginTop: 8 }}>Indisponível neste modo.</div>}
        </Card>

        <SecTitle>Recebimentos atrasados ({atrasados.length})</SecTitle>
        {atrasados.length === 0 ? <Empty>Nenhum recebimento atrasado lançado.</Empty> :
          atrasados.map((r) => (
            <Card key={r.id} style={{ marginBottom: 8, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: C.amber, fontVariantNumeric: 'tabular-nums' }}>{brl(num(r.valor))}</div>
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>Recebido {fmtDate(r.data)}{r.descricao ? ` · ${r.descricao}` : ''}</div>
                </div>
                <Btn kind="danger" small onClick={() => excluirAtrasado(r.id)}>×</Btn>
              </div>
            </Card>
          ))}
      </>)}
    </div>
  );
}

