'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { C, Card, Btn, KPI, Field, TextInput, NumInput, Select, Area, Empty, Resumo, SecTitle, inputStyle } from './ui';
import { brl, num, todayISO, ymOf, weekday, fmtDate, mesLabel, addDays, agruparContasAbertas, FONTES_RECEITA, FONTES_NAO_OPERACIONAL, CUSTO_VARIAVEL, DESPESA_OPERACIONAL, DESPESA_NAO_OPERACIONAL, CATEGORIAS_DESPESA, CATEGORIAS_PRODUTO, DIAS, MESES } from '../lib/util';

export default function Hoje({ diario, receitas, despesas, compras, garrafas, tarefas = [], setTab }) {
  const [mostrarValores, setMostrarValores] = useState(true);
  const oculto = (texto) => (mostrarValores ? texto : 'R$ ••••');
  // Caixa aberto: pra avisar se ficou aberto mais de 24h (e quem abriu).
  const [caixaAberto, setCaixaAberto] = useState(null);
  useEffect(() => {
    const carregar = async () => {
      try {
        const r = await fetch('/api/caixa', { cache: 'no-store' });
        const j = await r.json();
        setCaixaAberto(j.ok && j.aberto ? j.aberto : null);
      } catch { /* ignora */ }
    };
    carregar();
    const t = setInterval(carregar, 60000);
    return () => clearInterval(t);
  }, []);
  const papelRot = (x) => (x === 'garcom' ? 'Atendimento' : x === 'dona' ? 'Karen' : 'alguém');
  const dataHoraBR = (iso) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
  const caixaHoras = caixaAberto?.abertoEm ? (Date.now() - new Date(caixaAberto.abertoEm).getTime()) / 3600000 : 0;
  const caixaAlerta = !!caixaAberto && caixaHoras >= 24;

  // Movimento ao vivo: mesas abertas agora e nº de pessoas nelas.
  const [salaoAgora, setSalaoAgora] = useState({ mesas: 0, pessoas: 0 });
  useEffect(() => {
    const carregar = async () => {
      try {
        const r = await fetch('/api/comandas', { cache: 'no-store' });
        const j = await r.json();
        if (j.ok) { const cs = j.comandas || []; setSalaoAgora({ mesas: cs.length, pessoas: cs.reduce((s, c) => s + (Number(c.pessoas) || 0), 0) }); }
      } catch { /* ignora */ }
    };
    carregar();
    const t = setInterval(carregar, 20000);
    return () => clearInterval(t);
  }, []);
  const hoje = todayISO();
  const mes = ymOf(hoje);
  // Lucro OPERACIONAL: exclui investimento e empréstimo/dívida/aporte (movem
  // caixa, mas não são resultado da operação).
  const rec = receitas.filter((r) => ymOf(r.data) === mes && !FONTES_NAO_OPERACIONAL.includes(r.categoria)).reduce((s, r) => s + num(r.valor), 0);
  const desp = despesas.filter((d) => ymOf(d.data) === mes && !DESPESA_NAO_OPERACIONAL.includes(d.categoria)).reduce((s, d) => s + num(d.valor), 0);
  const lucro = rec - desp;
  // Fora da operação (movem o caixa, não entram no lucro) + o que de fato sobrou
  // no mês: lucro + aporte/empréstimo que entrou − investimento − dívida paga.
  const entradaNaoOp = receitas.filter((r) => ymOf(r.data) === mes && FONTES_NAO_OPERACIONAL.includes(r.categoria)).reduce((s, r) => s + num(r.valor), 0);
  const investimento = despesas.filter((d) => ymOf(d.data) === mes && d.categoria === 'Investimento').reduce((s, d) => s + num(d.valor), 0);
  const dividaPaga = despesas.filter((d) => ymOf(d.data) === mes && d.categoria === 'Empréstimo/Dívida').reduce((s, d) => s + num(d.valor), 0);
  const resultadoFinal = Math.round((lucro + entradaNaoOp - investimento - dividaPaga) * 100) / 100;
  const temForaOperacao = entradaNaoOp > 0.005 || investimento > 0.005 || dividaPaga > 0.005;
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

      {caixaAlerta && (
        <Card style={{ marginBottom: 12, borderColor: C.red }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.red, fontWeight: 700 }}>Caixa aberto há +24h</div>
              <div style={{ fontSize: 14, marginTop: 4, lineHeight: 1.4 }}>
                Aberto por <b>{papelRot(caixaAberto.abertoPor)}</b> em <b>{dataHoraBR(caixaAberto.abertoEm)}</b> ({Math.floor(caixaHoras)}h atrás)
              </div>
            </div>
            <Btn kind="ghost" small onClick={() => setTab('caixa')}>Ver</Btn>
          </div>
        </Card>
      )}

      {salaoAgora.mesas > 0 && (
        <Card style={{ marginBottom: 12, borderColor: C.accent2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.accent2, fontWeight: 700 }}>Movimento agora</div>
              <div style={{ fontSize: 16, marginTop: 4 }}>
                {salaoAgora.pessoas > 0
                  ? <><b>{salaoAgora.pessoas}</b> pessoa{salaoAgora.pessoas === 1 ? '' : 's'} em <b>{salaoAgora.mesas}</b> mesa{salaoAgora.mesas === 1 ? '' : 's'}</>
                  : <><b>{salaoAgora.mesas}</b> mesa{salaoAgora.mesas === 1 ? '' : 's'} aberta{salaoAgora.mesas === 1 ? '' : 's'}</>}
              </div>
            </div>
            <Btn kind="ghost" small onClick={() => setTab('salao')}>Ver</Btn>
          </div>
        </Card>
      )}

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


      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <KPI titulo="Receita do mês" valor={oculto(brl(rec))} cor={C.green} />
        <KPI titulo="Despesas do mês" valor={oculto(brl(desp))} cor={C.red} />
        <KPI titulo="Lucro operacional" valor={oculto(brl(lucro))} cor={lucro >= 0 ? C.accent : C.red} />
        <KPI titulo="Margem" valor={mostrarValores ? margem.toFixed(1) + '%' : '••••'} cor={margem >= 0 ? C.accent : C.red} />
      </div>

      {/* O que de fato sobrou no caixa (lucro − investimento/dívida + aportes) */}
      <div style={{ marginBottom: 12 }}>
        <KPI titulo="Saldo Final" valor={oculto(brl(resultadoFinal))} cor={resultadoFinal >= 0 ? C.accent : C.red}
          sub={temForaOperacao ? 'lucro operacional − investimento/dívida + aportes' : 'igual ao lucro (sem investimento/dívida no mês)'} />
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

