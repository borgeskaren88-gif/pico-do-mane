'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, KPI, Field, TextInput, NumInput, Select, Area, Empty, Resumo, SecTitle, inputStyle } from './ui';
import { brl, num, todayISO, ymOf, weekday, fmtDate, mesLabel, addDays, FONTES_RECEITA, CUSTO_VARIAVEL, DESPESA_OPERACIONAL, CATEGORIAS_DESPESA, CATEGORIAS_PRODUTO, DIAS, MESES } from '../lib/util';

export default function ContasPagar({ dados, onChange }) {
  const hoje = todayISO();
  const abertas = dados.filter((d) => d.pago !== 'Sim').sort((a, b) => (a.vencimento || '9999').localeCompare(b.vencimento || '9999'));
  const total = abertas.reduce((s, d) => s + num(d.quantidade) * num(d.valorUnit), 0);
  const vencidas = abertas.filter((d) => d.vencimento && d.vencimento < hoje);
  const proximas = abertas.filter((d) => d.vencimento && d.vencimento >= hoje && d.vencimento <= addDays(hoje, 7));
  const totalVenc = vencidas.reduce((s, d) => s + num(d.quantidade) * num(d.valorUnit), 0);
  const pagar = (d) => onChange(dados.map((x) => x.id === d.id ? { ...x, pago: 'Sim', dataPagamento: hoje } : x));

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <KPI titulo="Total em aberto" valor={brl(total)} cor={C.red} sub={`${abertas.length} conta(s)`} />
        <KPI titulo="Vencidas" valor={brl(totalVenc)} cor={vencidas.length ? C.red : C.faint} sub={`${vencidas.length} vencida(s)`} />
      </div>

      {proximas.length > 0 && (
        <Card style={{ marginBottom: 14, borderColor: C.amber }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.amber, fontWeight: 700 }}>Vencem nos próximos 7 dias</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{proximas.length} conta(s) chegando. Programe o caixa.</div>
        </Card>
      )}

      {abertas.length === 0 ? <Empty>Nenhuma conta em aberto. 🎉<br />Tudo pago por aqui.</Empty> :
        abertas.map((d) => {
          const tot = num(d.quantidade) * num(d.valorUnit);
          const vencida = d.vencimento && d.vencimento < hoje;
          const proxima = d.vencimento && d.vencimento >= hoje && d.vencimento <= addDays(hoje, 7);
          const cor = vencida ? C.red : proxima ? C.amber : C.line;
          return (
            <Card key={d.id} style={{ marginBottom: 8, padding: '12px 14px', borderColor: cor }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{d.fornecedor}</div>
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{d.produto}</div>
                  <div style={{ fontSize: 12, marginTop: 3, color: vencida ? C.red : proxima ? C.amber : C.faint, fontWeight: vencida || proxima ? 700 : 400 }}>
                    {d.vencimento ? `Vence ${fmtDate(d.vencimento)}${vencida ? ' · VENCIDA' : ''}` : 'Sem vencimento'} · {d.formaPagto}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{brl(tot)}</div>
                  <div style={{ marginTop: 8 }}><Btn kind="ok" small onClick={() => pagar(d)}>Marcar pago</Btn></div>
                </div>
              </div>
            </Card>
          );
        })}
    </div>
  );
}

