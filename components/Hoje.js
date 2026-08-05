'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { C, Card, Btn, KPI, Field, TextInput, NumInput, Select, Area, Empty, Resumo, SecTitle, inputStyle } from './ui';
import { brl, num, todayISO, ymOf, weekday, fmtDate, mesLabel, addDays, agruparContasAbertas, FONTES_RECEITA, CUSTO_VARIAVEL, DESPESA_OPERACIONAL, CATEGORIAS_DESPESA, CATEGORIAS_PRODUTO, DIAS, MESES } from '../lib/util';

export default function Hoje({ diario, receitas, despesas, compras, garrafas, tarefas = [], setTab }) {
  const [mostrarValores, setMostrarValores] = useState(true);
  const oculto = (texto) => (mostrarValores ? texto : 'R$ ••••');
  // Próximos eventos do Google Agenda (só aparece se conectado).
  const [agenda, setAgenda] = useState(null);
  const [vista, setVista] = useState('semana'); // 'dia' | 'semana' | 'mes'
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

  // Filtro da vista escolhida (dia / semana / mês). A semana é a semana do
  // calendário (domingo a sábado) que contém hoje.
  const diaSemHoje = new Date(hoje + 'T12:00:00').getDay();
  const iniSemana = addDays(hoje, -diaSemHoje);
  const fimSemana = addDays(iniSemana, 6);
  const dentroDaVista = (d) => (vista === 'dia' ? d === hoje : vista === 'semana' ? (d >= iniSemana && d <= fimSemana) : ymOf(d) === mes);
  const gruposVista = agendaGrupos.filter(([d]) => dentroDaVista(d));

  // Dias do mês com algum compromisso (pra marcar o quadradinho no calendário).
  const diasComEvento = useMemo(() => {
    const s = new Set();
    for (const ev of (agenda || [])) { const d = (ev.inicio || '').slice(0, 10); if (d) s.add(d); }
    return s;
  }, [agenda]);
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text, letterSpacing: '-.01em' }}>Agenda</div>
            <span style={{ fontSize: 11, color: C.faint, fontWeight: 600, letterSpacing: '.02em' }}>Google Agenda</span>
          </div>

          <div style={{ display: 'inline-flex', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 2, gap: 2, marginBottom: 16 }}>
            {[['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês']].map(([v, rot]) => (
              <button key={v} onClick={() => setVista(v)} style={{
                border: 'none', cursor: 'pointer', borderRadius: 8, padding: '5px 14px', fontSize: 12.5, fontWeight: 700,
                background: vista === v ? C.accent : 'transparent', color: vista === v ? '#06101F' : C.muted,
              }}>{rot}</button>
            ))}
          </div>

          {vista === 'mes' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: gruposVista.length ? 18 : 4 }}>
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((w, i) => (
                <div key={'h' + i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: C.faint, paddingBottom: 4 }}>{w}</div>
              ))}
              {celulasMes.map((d, i) => {
                if (!d) return <div key={'c' + i} />;
                const ehHoje = d === hoje, passado = d < hoje, temEv = diasComEvento.has(d);
                return (
                  <div key={'c' + i} style={{
                    position: 'relative', height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9,
                    background: ehHoje ? C.accent : 'transparent', color: ehHoje ? '#06101F' : (passado ? C.faint : C.text),
                    fontSize: 13, fontWeight: ehHoje ? 800 : 600, fontVariantNumeric: 'tabular-nums',
                  }}>
                    {Number(d.slice(8))}
                    {temEv && !ehHoje && <span style={{ position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: '50%', background: C.accent }} />}
                  </div>
                );
              })}
            </div>
          )}

          {gruposVista.length === 0 ? (
            <div style={{ fontSize: 13, color: C.faint, textAlign: 'center', padding: '6px 0 2px' }}>
              {vista === 'dia' ? 'Nada na agenda para hoje.' : vista === 'semana' ? 'Nada na agenda para esta semana.' : 'Nada na agenda para este mês.'}
            </div>
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {gruposVista.map(([d, evs]) => {
              const ehHoje = d === hoje;
              return (
                <div key={d}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.09em', fontWeight: 700, color: ehHoje ? C.accent : C.muted, whiteSpace: 'nowrap' }}>{rotuloDia(d)}</span>
                    <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${C.line}, transparent)` }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {evs.map((ev, i) => (
                      <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: i === 0 ? 'none' : `1px solid ${C.line}55` }}>
                        <span style={{ width: 16, flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          {ev.tarefa
                            ? <span title="Tarefa" style={{ width: 13, height: 13, borderRadius: 4, border: `1.5px solid ${C.accent}`, boxSizing: 'border-box' }} />
                            : ev.diaTodo
                              ? <span style={{ width: 8, height: 8, borderRadius: '50%', border: `1.5px solid ${C.accent2}`, boxSizing: 'border-box' }} />
                              : <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent }} />}
                        </span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: C.text, fontWeight: 500, lineHeight: 1.35 }}>{ev.titulo}</span>
                        <span style={{ flexShrink: 0, fontSize: 12.5, color: C.faint, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {ev.tarefa ? 'tarefa' : ev.diaTodo ? 'dia todo' : ev.inicio.slice(11, 16)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          )}
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

