'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { C, Card, Btn, KPI, Field, TextInput, NumInput, Select, Area, Empty, Resumo, SecTitle, inputStyle } from './ui';
import { brl, num, todayISO, ymOf, weekday, fmtDate, mesLabel, addDays, agruparContasAbertas, FONTES_RECEITA, CUSTO_VARIAVEL, DESPESA_OPERACIONAL, CATEGORIAS_DESPESA, CATEGORIAS_PRODUTO, DIAS, MESES } from '../lib/util';

export default function Hoje({ diario, receitas, despesas, compras, garrafas, tarefas = [], setTab }) {
  const [mostrarValores, setMostrarValores] = useState(true);
  const oculto = (texto) => (mostrarValores ? texto : 'R$ ••••');
  // Próximos eventos do Google Agenda (só aparece se conectado).
  const [agenda, setAgenda] = useState(null);
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.accent, fontWeight: 700 }}>Sua agenda</div>
            <span style={{ fontSize: 11, color: C.faint }}>Google Agenda</span>
          </div>
          {agendaGrupos.map(([d, evs]) => (
            <div key={d} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, marginBottom: 3 }}>{rotuloDia(d)}</div>
              {evs.map((ev) => (
                <div key={ev.id} style={{ display: 'flex', gap: 10, fontSize: 14, padding: '3px 0' }}>
                  <span style={{ color: C.accent, fontWeight: 700, minWidth: 64, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{ev.diaTodo ? 'dia todo' : ev.inicio.slice(11, 16)}</span>
                  <span style={{ color: C.text, minWidth: 0 }}>{ev.titulo}</span>
                </div>
              ))}
            </div>
          ))}
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

