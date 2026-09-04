'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { C, Card, Btn, KPI, Empty } from './ui';
import { brl, num, todayISO, ymOf, weekday, fmtDate, mesLabel, addDays, agruparContasAbertas, FONTES_NAO_OPERACIONAL, DESPESA_NAO_OPERACIONAL } from '../lib/util';

const TAB = { fontVariantNumeric: 'tabular-nums' };

export default function Hoje({ diario, receitas, despesas, compras, garrafas, tarefas = [], estoque = [], vendas = [], setTab, darci = null }) {
  const [mostrarValores, setMostrarValores] = useState(true);
  const oculto = (texto) => (mostrarValores ? texto : 'R$ ••••');
  const [caixaAberto, setCaixaAberto] = useState(null);
  useEffect(() => {
    const carregar = async () => {
      try { const r = await fetch('/api/caixa', { cache: 'no-store' }); const j = await r.json(); setCaixaAberto(j.ok && j.aberto ? j.aberto : null); } catch { /* ignora */ }
    };
    carregar(); const t = setInterval(carregar, 60000); return () => clearInterval(t);
  }, []);
  const papelRot = (x) => (x === 'garcom' ? 'Atendimento' : x === 'dona' ? 'Karen' : 'alguém');
  const dataHoraBR = (iso) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
  const caixaHoras = caixaAberto?.abertoEm ? (Date.now() - new Date(caixaAberto.abertoEm).getTime()) / 3600000 : 0;
  const caixaAlerta = !!caixaAberto && caixaHoras >= 24;

  const [salaoAgora, setSalaoAgora] = useState({ mesas: 0, pessoas: 0 });
  useEffect(() => {
    const carregar = async () => {
      try { const r = await fetch('/api/comandas', { cache: 'no-store' }); const j = await r.json(); if (j.ok) { const cs = j.comandas || []; setSalaoAgora({ mesas: cs.length, pessoas: cs.reduce((s, c) => s + (Number(c.pessoas) || 0), 0) }); } } catch { /* ignora */ }
    };
    carregar(); const t = setInterval(carregar, 20000); return () => clearInterval(t);
  }, []);

  const hoje = todayISO();
  const mes = ymOf(hoje);
  const rec = receitas.filter((r) => ymOf(r.data) === mes && !FONTES_NAO_OPERACIONAL.includes(r.categoria)).reduce((s, r) => s + num(r.valor), 0);
  const desp = despesas.filter((d) => ymOf(d.data) === mes && !DESPESA_NAO_OPERACIONAL.includes(d.categoria)).reduce((s, d) => s + num(d.valor), 0);
  const lucro = rec - desp;
  const entradaNaoOp = receitas.filter((r) => ymOf(r.data) === mes && FONTES_NAO_OPERACIONAL.includes(r.categoria)).reduce((s, r) => s + num(r.valor), 0);
  const investimento = despesas.filter((d) => ymOf(d.data) === mes && d.categoria === 'Investimento').reduce((s, d) => s + num(d.valor), 0);
  const dividaPaga = despesas.filter((d) => ymOf(d.data) === mes && d.categoria === 'Empréstimo/Dívida').reduce((s, d) => s + num(d.valor), 0);
  const resultadoFinal = Math.round((lucro + entradaNaoOp - investimento - dividaPaga) * 100) / 100;
  const temForaOperacao = entradaNaoOp > 0.005 || investimento > 0.005 || dividaPaga > 0.005;
  const margem = rec ? (lucro / rec) * 100 : 0;
  const jaTem = diario.some((d) => d.data === hoje);
  const abertas = compras.filter((c) => c.pago !== 'Sim');
  const totalPagar = abertas.reduce((s, c) => s + num(c.quantidade) * num(c.valorUnit), 0);
  const gruposAbertos = agruparContasAbertas(abertas);
  const vencidas = gruposAbertos.filter((g) => g.vencimento && g.vencimento < hoje);
  const garrafasEmUso = garrafas.filter((g) => g.dataAbertura && !g.dataTermino);

  const horaAgora = new Date().getHours();
  const saudacao = (horaAgora >= 5 && horaAgora < 12) ? 'Bom dia' : (horaAgora >= 12 && horaAgora < 18) ? 'Boa tarde' : 'Boa noite';

  const boletosHoje = gruposAbertos.filter((g) => g.vencimento === hoje);
  const totalBoletosHoje = boletosHoje.reduce((s, g) => s + g.total, 0);
  const totalVencidas = vencidas.reduce((s, g) => s + g.total, 0);
  const tarefasHoje = tarefas.filter((t) => !t.feito && t.data === hoje);
  const tarefasAtrasadas = tarefas.filter((t) => !t.feito && t.data && t.data < hoje);
  const estoqueBaixo = (estoque || []).filter((it) => { const min = num(it.minimo); return min > 0 && num(it.saldo) <= min; });
  const temAviso = boletosHoje.length || vencidas.length || tarefasHoje.length || tarefasAtrasadas.length || estoqueBaixo.length;
  const avisoUrgente = boletosHoje.length || vencidas.length;

  // Série receita × despesa dos últimos 8 dias (operacional).
  const serie = useMemo(() => {
    const dias = []; for (let i = 7; i >= 0; i--) dias.push(addDays(hoje, -i));
    const r = {}, d = {};
    for (const x of receitas) if (!FONTES_NAO_OPERACIONAL.includes(x.categoria)) r[x.data] = (r[x.data] || 0) + num(x.valor);
    for (const x of despesas) if (!DESPESA_NAO_OPERACIONAL.includes(x.categoria)) d[x.data] = (d[x.data] || 0) + num(x.valor);
    return dias.map((dia) => ({ dia: dia.slice(8, 10) + '/' + dia.slice(5, 7), rec: Math.round(r[dia] || 0), desp: Math.round(d[dia] || 0) }));
  }, [receitas, despesas, hoje]);
  const temSerie = serie.some((x) => x.rec > 0 || x.desp > 0);

  // Top produtos (últimos 7 dias) pelo que foi vendido nas comandas.
  const topProdutos = useMemo(() => {
    const lim = addDays(hoje, -7);
    const m = new Map();
    for (const v of vendas) { if (!v.data || v.data < lim) continue; for (const it of (v.itens || [])) { const nome = it.nome || '?'; m.set(nome, (m.get(nome) || 0) + (num(it.qtd) || 0)); } }
    return [...m.entries()].map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd).slice(0, 5);
  }, [vendas, hoje]);
  const maxTop = topProdutos[0]?.qtd || 1;

  const lbl = { fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: C.faint, margin: '0 2px 10px' };

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: C.faint, textTransform: 'uppercase', letterSpacing: '.06em' }}>{weekday(hoje)}, {fmtDate(hoje)}</div>
          <div style={{ fontSize: 26, fontWeight: 900, marginTop: 2 }}>Dashboard</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>{saudacao}, Karen · resumo de {mesLabel(mes)}</div>
        </div>
        {/* O Darci fica aqui, do lado do Ocultar: os dois no mesmo formato. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {darci}
          <button onClick={() => setMostrarValores((v) => !v)} title={mostrarValores ? 'Ocultar valores' : 'Mostrar valores'}
            style={{ flexShrink: 0, background: 'transparent', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {mostrarValores ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
      </div>

      {caixaAlerta && (
        <Card style={{ marginBottom: 12, borderColor: C.red }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.red, fontWeight: 700 }}>Caixa aberto há +24h</div>
              <div style={{ fontSize: 14, marginTop: 4, lineHeight: 1.4 }}>Aberto por <b>{papelRot(caixaAberto.abertoPor)}</b> em <b>{dataHoraBR(caixaAberto.abertoEm)}</b> ({Math.floor(caixaHoras)}h atrás)</div>
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
                {salaoAgora.pessoas > 0 ? <><b>{salaoAgora.pessoas}</b> pessoa{salaoAgora.pessoas === 1 ? '' : 's'} em <b>{salaoAgora.mesas}</b> mesa{salaoAgora.mesas === 1 ? '' : 's'}</> : <><b>{salaoAgora.mesas}</b> mesa{salaoAgora.mesas === 1 ? '' : 's'} aberta{salaoAgora.mesas === 1 ? '' : 's'}</>}
              </div>
            </div>
            <Btn kind="ghost" small onClick={() => setTab('salao')}>Ver</Btn>
          </div>
        </Card>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <KPI titulo="Receita do mês" valor={oculto(brl(rec))} cor={C.green} />
        <KPI titulo="Despesas do mês" valor={oculto(brl(desp))} cor={C.red} />
        <KPI titulo="Lucro operacional" valor={oculto(brl(lucro))} cor={lucro >= 0 ? C.accent : C.red} />
        <KPI titulo="Margem" valor={mostrarValores ? margem.toFixed(1) + '%' : '••••'} cor={margem >= 0 ? C.accent : C.red} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <KPI titulo="Saldo Final" valor={oculto(brl(resultadoFinal))} cor={resultadoFinal >= 0 ? C.accent : C.red} sub={temForaOperacao ? 'lucro − investimento/dívida + aportes' : 'igual ao lucro operacional'} />
      </div>

      {/* Gráfico receita × despesa */}
      {temSerie && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 800 }}>Receita × Despesa</span>
            <span style={{ display: 'flex', gap: 12, fontSize: 11, color: C.faint }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: C.green, display: 'inline-block' }} />receita</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: C.red, display: 'inline-block' }} />despesa</span>
            </span>
          </div>
          <div style={{ width: '100%', height: 170 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie} margin={{ top: 6, right: 4, left: 4, bottom: 2 }} barGap={2}>
                <CartesianGrid vertical={false} stroke={C.hair} />
                <XAxis dataKey="dia" tick={{ fontSize: 9.5, fill: C.faint }} tickLine={false} axisLine={{ stroke: C.hair }} interval={0} />
                <Tooltip cursor={{ fill: C.hair }} contentStyle={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, fontSize: 12 }} formatter={(v, n) => [brl(v), n === 'rec' ? 'Receita' : 'Despesa']} labelStyle={{ color: C.muted }} />
                <Bar dataKey="rec" fill={C.green} radius={[3, 3, 0, 0]} maxBarSize={16} isAnimationActive={false} />
                <Bar dataKey="desp" fill={C.red} radius={[3, 3, 0, 0]} maxBarSize={16} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Avisos consolidados */}
      {temAviso ? (
        <Card style={{ marginBottom: 14, borderColor: avisoUrgente ? C.red : C.amber, background: C.raised }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: avisoUrgente ? C.red : C.amber, fontWeight: 700, marginBottom: 8 }}>Avisos de hoje</div>
          {boletosHoje.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '5px 0' }}>
              <div style={{ fontSize: 14 }}><b>{boletosHoje.length} boleto{boletosHoje.length > 1 ? 's' : ''}</b> vence{boletosHoje.length > 1 ? 'm' : ''} hoje — <b style={{ color: C.red, ...TAB }}>{oculto(brl(totalBoletosHoje))}</b></div>
              <Btn kind="ghost" small onClick={() => setTab('pagar')}>Ver</Btn>
            </div>
          )}
          {vencidas.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '5px 0' }}>
              <div style={{ fontSize: 14 }}><b>{vencidas.length} conta{vencidas.length > 1 ? 's' : ''}</b> vencida{vencidas.length > 1 ? 's' : ''} — <b style={{ color: C.red, ...TAB }}>{oculto(brl(totalVencidas))}</b></div>
              <Btn kind="ghost" small onClick={() => setTab('pagar')}>Ver</Btn>
            </div>
          )}
          {estoqueBaixo.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '5px 0' }}>
              <div style={{ fontSize: 14, minWidth: 0 }}><b>{estoqueBaixo.length} item{estoqueBaixo.length > 1 ? 's' : ''}</b> no estoque mínimo <span style={{ color: C.faint }}>· {estoqueBaixo.slice(0, 3).map((it) => it.nome).join(', ')}{estoqueBaixo.length > 3 ? '…' : ''}</span></div>
              <Btn kind="ghost" small onClick={() => setTab('abastecimento')}>Ver</Btn>
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

      {/* Top produtos */}
      {topProdutos.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <div style={lbl}>Mais vendidos · 7 dias</div>
          {topProdutos.map((p) => (
            <div key={p.nome} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0' }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</span>
              <span style={{ flex: '0 0 90px', height: 5, borderRadius: 999, background: `color-mix(in srgb, ${C.accent} 14%, transparent)`, overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: Math.max(6, (p.qtd / maxTop) * 100) + '%', background: C.accent, borderRadius: 999 }} /></span>
              <b style={{ flex: '0 0 34px', textAlign: 'right', fontSize: 15, fontWeight: 800, ...TAB }}>{p.qtd}</b>
            </div>
          ))}
        </Card>
      )}

      {abertas.length > 0 && (
        <Card style={{ marginBottom: 12, borderColor: vencidas.length ? C.red : C.line }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.faint, fontWeight: 800 }}>Contas a pagar em aberto</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.red, marginTop: 6, ...TAB }}>{oculto(brl(totalPagar))}</div>
              <div style={{ fontSize: 12, color: vencidas.length ? C.red : C.faint, marginTop: 2 }}>{gruposAbertos.length} conta(s){vencidas.length ? ` · ${vencidas.length} vencida(s)` : ''}</div>
            </div>
            <Btn kind="ghost" small onClick={() => setTab('pagar')}>Ver</Btn>
          </div>
        </Card>
      )}

      {garrafasEmUso.length > 0 && (
        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.faint, fontWeight: 800 }}>Garrafas abertas agora</div>
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
