'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { C, Card, Btn, KPI, Field, TextInput, NumInput, Select, Area, Empty, Resumo, SecTitle, inputStyle } from './ui';
import { brl, num, todayISO, ymOf, weekday, fmtDate, mesLabel, addDays, agruparContasAbertas, FONTES_RECEITA, CUSTO_VARIAVEL, DESPESA_OPERACIONAL, CATEGORIAS_DESPESA, CATEGORIAS_PRODUTO, DIAS, MESES } from '../lib/util';

const MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const LETRAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']; // domingo a sábado

export default function Hoje({ diario, receitas, despesas, compras, garrafas, tarefas = [], setTab }) {
  const [mostrarValores, setMostrarValores] = useState(true);
  const oculto = (texto) => (mostrarValores ? texto : 'R$ ••••');
  // Próximos eventos do Google Agenda (só aparece se conectado).
  const [agenda, setAgenda] = useState(null);
  const [vista, setVista] = useState('semana'); // 'dia' | 'semana' | 'mes'
  const [diaSel, setDiaSel] = useState(todayISO()); // dia escolhido na faixa/calendário
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/google/eventos', { cache: 'no-store' });
        const j = await r.json();
        setAgenda(j.ok && j.conectado ? (j.eventos || []) : null);
      } catch { setAgenda(null); }
    })();
  }, []);
  const hoje = todayISO();
  const mes = ymOf(hoje);
  const rec = receitas.filter((r) => ymOf(r.data) === mes).reduce((s, r) => s + num(r.valor), 0);
  const desp = despesas.filter((d) => ymOf(d.data) === mes).reduce((s, d) => s + num(d.valor), 0);
  const lucro = rec - desp;
  const margem = rec ? (lucro / rec) * 100 : 0;
  const jaTem = diario.some((d) => d.data === hoje);
  const abertas = compras.filter((c) => c.pago !== 'Sim');
  const totalPagar = abertas.reduce((s, c) => s + num(c.quantidade) * num(c.valorUnit), 0);
  // Agrupa por nota/boleto pra contar "boletos", não itens soltos (igual à aba
  // Contas a Pagar) — uma nota com vários produtos é um boleto só.
  const gruposAbertos = agruparContasAbertas(abertas);
  const vencidas = gruposAbertos.filter((g) => g.vencimento && g.vencimento < hoje);
  const garrafasEmUso = garrafas.filter((g) => g.dataAbertura && !g.dataTermino);

  // Saudação conforme a hora: manhã (5–11), tarde (12–17), noite (demais).
  const horaAgora = new Date().getHours();
  const saudacao = (horaAgora >= 5 && horaAgora < 12) ? 'Bom dia' : (horaAgora >= 12 && horaAgora < 18) ? 'Boa tarde' : 'Boa noite';

  // Avisos do dia
  const boletosHoje = gruposAbertos.filter((g) => g.vencimento === hoje);
  const totalBoletosHoje = boletosHoje.reduce((s, g) => s + g.total, 0);
  const totalVencidas = vencidas.reduce((s, g) => s + g.total, 0);
  const tarefasHoje = tarefas.filter((t) => !t.feito && t.data === hoje);
  const tarefasAtrasadas = tarefas.filter((t) => !t.feito && t.data && t.data < hoje);
  const temAviso = boletosHoje.length || vencidas.length || tarefasHoje.length || tarefasAtrasadas.length;
  const avisoUrgente = boletosHoje.length || vencidas.length;

  // Agrupa os eventos da agenda por dia.
  const agendaGrupos = useMemo(() => {
    if (!agenda || !agenda.length) return [];
    const m = new Map();
    for (const ev of agenda) {
      const d = (ev.inicio || '').slice(0, 10);
      if (!d) continue;
      if (!m.has(d)) m.set(d, []);
      m.get(d).push(ev);
    }
    return [...m.entries()];
  }, [agenda]);
  const rotuloDia = (d) => (d === hoje ? 'Hoje' : d === addDays(hoje, 1) ? 'Amanhã' : `${weekday(d)}, ${fmtDate(d)}`);

  // Semana do calendário (domingo a sábado) que contém hoje.
  const diaSemHoje = new Date(hoje + 'T12:00:00').getDay();
  const iniSemana = addDays(hoje, -diaSemHoje);
  const diasSemana = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(iniSemana, i)), [iniSemana]);

  // Eventos indexados por dia (pra mostrar os do dia escolhido).
  const porDia = useMemo(() => new Map(agendaGrupos), [agendaGrupos]);
  // Dias com algum compromisso (pra marcar o pontinho na faixa/calendário).
  const diasComEvento = useMemo(() => {
    const s = new Set();
    for (const ev of (agenda || [])) { const d = (ev.inicio || '').slice(0, 10); if (d) s.add(d); }
    return s;
  }, [agenda]);
  // Rótulo "Mês Ano" do dia selecionado (ex.: Agosto 2026).
  const cabMes = (() => { const [y, m] = diaSel.split('-'); return `${MESES_LONGOS[Number(m) - 1]} ${y}`; })();

  // Células do calendário do mês: nulls pra alinhar o 1º dia no dia da semana certo.
  const celulasMes = useMemo(() => {
    const [ano, mn] = mes.split('-').map(Number);
    const offset = new Date(ano, mn - 1, 1).getDay();
    const total = new Date(ano, mn, 0).getDate();
    const cs = [];
    for (let i = 0; i < offset; i++) cs.push(null);
    for (let d = 1; d <= total; d++) cs.push(`${mes}-${String(d).padStart(2, '0')}`);
    return cs;
  }, [mes]);

  // Cor semântica de cada compromisso: boleto (âmbar), tarefa (azul),
  // compromisso com hora (verde) e dia todo (cinza).
  const ehBoleto = (ev) => ev.tarefa && /^\s*boleto/i.test(ev.titulo || '');
  const corEvento = (ev) => (ehBoleto(ev) ? C.amber : ev.tarefa ? C.accent : ev.diaTodo ? C.muted : C.green);
  const etiquetaEvento = (ev) => (ehBoleto(ev) ? 'A pagar' : ev.tarefa ? 'Tarefa' : ev.diaTodo ? 'Dia todo' : ev.inicio.slice(11, 16));

  // Lista de compromissos de um dia, em cartões coloridos com barra lateral.
  const listaDoDia = (dia) => {
    const evs = porDia.get(dia) || [];
    if (!evs.length) return <div style={{ fontSize: 13, color: C.faint, textAlign: 'center', padding: '14px 0 4px' }}>Nada agendado para {dia === hoje ? 'hoje' : 'este dia'}.</div>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {evs.map((ev) => {
          const cor = corEvento(ev);
          return (
            <div key={ev.id} style={{ display: 'flex', gap: 12, alignItems: 'center', background: cor + '22', borderRadius: 12, padding: '11px 14px' }}>
              <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: cor, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{ev.titulo}</span>
              <span style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: cor, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{etiquetaEvento(ev)}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, color: C.muted }}>{weekday(todayISO())}, {fmtDate(todayISO())}</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 2 }}>{saudacao}, Karen</div>
          <div style={{ fontSize: 12, color: C.accent, letterSpacing: '.14em', textTransform: 'uppercase', marginTop: 2, fontWeight: 700 }}>CEO</div>
          <div style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>Seu resumo de {mesLabel(mes)}.</div>
        </div>
        <button onClick={() => setMostrarValores((v) => !v)}
          title={mostrarValores ? 'Ocultar valores' : 'Mostrar valores'}
          style={{ flexShrink: 0, background: 'transparent', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          {mostrarValores ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>

      {temAviso ? (
        <Card style={{ marginBottom: 12, borderColor: avisoUrgente ? C.red : C.amber, background: C.raised }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: avisoUrgente ? C.red : C.amber, fontWeight: 700, marginBottom: 10 }}>Avisos de hoje</div>
          {boletosHoje.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '5px 0' }}>
              <div style={{ fontSize: 14 }}><b>{boletosHoje.length} boleto{boletosHoje.length > 1 ? 's' : ''}</b> vence{boletosHoje.length > 1 ? 'm' : ''} hoje — <b style={{ color: C.red }}>{oculto(brl(totalBoletosHoje))}</b></div>
              <Btn kind="ghost" small onClick={() => setTab('pagar')}>Ver</Btn>
            </div>
          )}
          {vencidas.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '5px 0' }}>
              <div style={{ fontSize: 14 }}><b>{vencidas.length} conta{vencidas.length > 1 ? 's' : ''}</b> vencida{vencidas.length > 1 ? 's' : ''} — <b style={{ color: C.red }}>{oculto(brl(totalVencidas))}</b></div>
              <Btn kind="ghost" small onClick={() => setTab('pagar')}>Ver</Btn>
            </div>
          )}
          {tarefasHoje.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '5px 0' }}>
              <div style={{ fontSize: 14 }}><b>{tarefasHoje.length} tarefa{tarefasHoje.length > 1 ? 's' : ''}</b> para hoje</div>
              <Btn kind="ghost" small onClick={() => setTab('diario')}>Ver</Btn>
            </div>
          )}
          {tarefasAtrasadas.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '5px 0' }}>
              <div style={{ fontSize: 14 }}><b>{tarefasAtrasadas.length} tarefa{tarefasAtrasadas.length > 1 ? 's' : ''}</b> atrasada{tarefasAtrasadas.length > 1 ? 's' : ''}</div>
              <Btn kind="ghost" small onClick={() => setTab('diario')}>Ver</Btn>
            </div>
          )}
        </Card>
      ) : null}

      {agendaGrupos.length > 0 && (
        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.text, letterSpacing: '-.02em' }}>{vista === 'dia' ? 'Hoje' : cabMes}</div>
            <div style={{ display: 'inline-flex', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 2, gap: 2 }}>
              {[['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês']].map(([v, rot]) => (
                <button key={v} onClick={() => { setVista(v); setDiaSel(hoje); }} style={{
                  border: 'none', cursor: 'pointer', borderRadius: 8, padding: '5px 11px', fontSize: 12, fontWeight: 700,
                  background: vista === v ? C.accent : 'transparent', color: vista === v ? '#06101F' : C.muted,
                }}>{rot}</button>
              ))}
            </div>
          </div>

          {vista === 'semana' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 6 }}>
              {diasSemana.map((d, i) => {
                const sel = d === diaSel, ehHoje = d === hoje, temEv = diasComEvento.has(d);
                return (
                  <button key={d} onClick={() => setDiaSel(d)} style={{
                    border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 0',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.faint }}>{LETRAS_SEMANA[i]}</span>
                    <span style={{
                      width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%',
                      background: sel ? C.accent : 'transparent', color: sel ? '#06101F' : C.text,
                      border: !sel && ehHoje ? `1.5px solid ${C.accent}` : '1.5px solid transparent', boxSizing: 'border-box',
                      fontSize: 15, fontWeight: sel || ehHoje ? 800 : 600, fontVariantNumeric: 'tabular-nums',
                    }}>{Number(d.slice(8))}</span>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: temEv && !sel ? C.accent : 'transparent' }} />
                  </button>
                );
              })}
            </div>
          )}

          {vista === 'mes' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 6 }}>
              {LETRAS_SEMANA.map((w, i) => (
                <div key={'h' + i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: C.faint, paddingBottom: 4 }}>{w}</div>
              ))}
              {celulasMes.map((d, i) => {
                if (!d) return <div key={'c' + i} />;
                const sel = d === diaSel, ehHoje = d === hoje, passado = d < hoje, temEv = diasComEvento.has(d);
                return (
                  <button key={'c' + i} onClick={() => setDiaSel(d)} style={{
                    border: 'none', cursor: 'pointer', position: 'relative', height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10,
                    background: sel ? C.accent : 'transparent', color: sel ? '#06101F' : (passado ? C.faint : C.text),
                    boxShadow: !sel && ehHoje ? `inset 0 0 0 1.5px ${C.accent}` : 'none',
                    fontSize: 13, fontWeight: sel || ehHoje ? 800 : 600, fontVariantNumeric: 'tabular-nums',
                  }}>
                    {Number(d.slice(8))}
                    {temEv && !sel && <span style={{ position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: '50%', background: C.accent }} />}
                  </button>
                );
              })}
            </div>
          )}

          {vista !== 'dia' && (
            <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 8, paddingTop: 4, marginBottom: 2 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginTop: 8, textTransform: 'uppercase', letterSpacing: '.07em' }}>
                {diaSel === hoje ? 'Hoje' : diaSel === addDays(hoje, 1) ? 'Amanhã' : `${weekday(diaSel)}, ${fmtDate(diaSel)}`}
              </div>
            </div>
          )}
          {listaDoDia(vista === 'dia' ? hoje : diaSel)}
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <KPI titulo="Receita do mês" valor={oculto(brl(rec))} cor={C.green} />
        <KPI titulo="Despesas do mês" valor={oculto(brl(desp))} cor={C.red} />
        <KPI titulo="Lucro operacional" valor={oculto(brl(lucro))} cor={lucro >= 0 ? C.accent : C.red} />
        <KPI titulo="Margem" valor={mostrarValores ? margem.toFixed(1) + '%' : '••••'} cor={margem >= 0 ? C.accent : C.red} />
      </div>

      {abertas.length > 0 && (
        <Card style={{ marginBottom: 12, borderColor: vencidas.length ? C.red : C.line }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.muted, fontWeight: 600 }}>Contas a pagar em aberto</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.red, marginTop: 4 }}>{oculto(brl(totalPagar))}</div>
              <div style={{ fontSize: 12, color: vencidas.length ? C.red : C.faint, marginTop: 2 }}>{gruposAbertos.length} conta(s){vencidas.length ? ` · ${vencidas.length} vencida(s)` : ''}</div>
            </div>
            <Btn kind="ghost" small onClick={() => setTab('pagar')}>Ver</Btn>
          </div>
        </Card>
      )}

      {garrafasEmUso.length > 0 && (
        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.muted, fontWeight: 600 }}>Garrafas abertas agora</div>
              <div style={{ fontSize: 15, color: C.text, marginTop: 4 }}>{garrafasEmUso.map((g) => g.produto).join(', ')}</div>
            </div>
            <Btn kind="ghost" small onClick={() => setTab('garrafas')}>Ver</Btn>
          </div>
        </Card>
      )}

      <Card style={{ marginBottom: 12, background: jaTem ? C.panel : C.raised, borderColor: jaTem ? C.line : C.accent }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{jaTem ? 'Log de hoje registrado' : 'Você ainda não fechou o dia de hoje'}</div>
        <div style={{ fontSize: 13, color: C.muted, margin: '6px 0 12px' }}>{jaTem ? 'Bom trabalho. Você pode editar quando quiser no Log Operacional.' : 'Registre o caixa, o clima, o que funcionou e a prioridade de amanhã.'}</div>
        <Btn kind={jaTem ? 'ghost' : 'primary'} small onClick={() => setTab('diario')}>{jaTem ? 'Ver log' : 'Registrar o dia'}</Btn>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Btn kind="ghost" onClick={() => setTab('receitas')}>+ Receita</Btn>
        <Btn kind="ghost" onClick={() => setTab('compras')}>+ Compra</Btn>
      </div>
    </div>
  );
}

