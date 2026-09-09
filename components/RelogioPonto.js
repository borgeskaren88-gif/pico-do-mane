'use client';
import React from 'react';
import { C } from './ui';

// Relógio de horas do ponto: um anel que vai enchendo conforme a pessoa
// trabalha. Fica VERMELHO enquanto falta hora pra fechar a jornada do mês e
// VERDE quando ela já bateu (ou passou) o que era esperado. É pra bater o olho
// e saber, sem ler número nenhum, quem está devendo e quem está em haver.
//
// O anel é um "C" aberto embaixo (270°), igual a um relógio de corrida.

const GIRO = 270; // quanto do círculo o anel ocupa
const INICIO = 135; // começa embaixo à esquerda e sobe pela esquerda

const ponto = (a, r) => {
  const rad = (a * Math.PI) / 180;
  return [50 + r * Math.cos(rad), 50 + r * Math.sin(rad)];
};
// Traço do anel de `INICIO` até a fração `f` (0..1) do giro.
const arco = (f, r) => {
  const fim = INICIO + GIRO * Math.max(0, Math.min(1, f));
  const [x1, y1] = ponto(INICIO, r);
  const [x2, y2] = ponto(fim, r);
  const grande = GIRO * f > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${grande} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

const fmtH = (h) => {
  const t = Math.round(Math.abs(h) * 60);
  const hh = Math.floor(t / 60), mm = t % 60;
  return mm > 0 ? `${hh}h${String(mm).padStart(2, '0')}` : `${hh}h`;
};

export default function RelogioPonto({ horas = 0, esperado = null, tamanho = 190, nome = '' }) {
  const temMeta = esperado != null && esperado > 0.02;
  const saldo = temMeta ? horas - esperado : 0;
  const emDia = temMeta && Math.abs(saldo) < 0.02;
  // Verde assim que alcança o esperado; vermelho enquanto falta.
  const cor = !temMeta ? C.accent : (saldo >= -0.02 ? C.green : C.red);
  const fracao = temMeta ? Math.min(1, horas / esperado) : (horas > 0 ? 1 : 0);
  const passou = temMeta && saldo > 0.02;

  const r = 40;
  const grossura = 9;
  const id = `rp-${Math.round(tamanho)}-${temMeta ? (saldo >= -0.02 ? 'v' : 'r') : 'n'}`;

  const recado = !temMeta ? 'sem jornada configurada'
    : emDia ? 'fechou em dia'
      : passou ? `+${fmtH(saldo)} a mais` : `faltam ${fmtH(-saldo)}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: tamanho, height: tamanho }}>
        <svg viewBox="0 0 100 100" width={tamanho} height={tamanho} style={{ display: 'block' }} aria-hidden="true">
          <defs>
            <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor={cor} stopOpacity="0.55" />
              <stop offset="1" stopColor={cor} stopOpacity="1" />
            </linearGradient>
          </defs>
          {/* trilho cinza: o mês inteiro */}
          <path d={arco(1, r)} fill="none" stroke={C.line} strokeWidth={grossura} strokeLinecap="round" />
          {/* o quanto já foi trabalhado */}
          {fracao > 0.004 && (
            <path d={arco(fracao, r)} fill="none" stroke={`url(#${id})`} strokeWidth={grossura} strokeLinecap="round" />
          )}
        </svg>
        {/* miolo: as horas trabalhadas e o recado */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 16%' }}>
          {nome ? <div style={{ fontSize: Math.max(10, tamanho * 0.062), color: C.faint, fontWeight: 700, marginBottom: 2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</div> : null}
          <div style={{ fontSize: Math.max(11, tamanho * 0.058), color: C.muted, letterSpacing: '.04em' }}>trabalhou</div>
          <div style={{ fontSize: Math.max(19, tamanho * 0.175), fontWeight: 900, color: C.text, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>{fmtH(horas)}</div>
          <div style={{ fontSize: Math.max(10, tamanho * 0.058), fontWeight: 800, color: cor, marginTop: 4, lineHeight: 1.25 }}>{recado}</div>
        </div>
      </div>
      {/* embaixo, os dois números que a conta usa */}
      {temMeta && (
        <div style={{ display: 'flex', gap: 22, justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: C.faint, letterSpacing: '.1em', fontWeight: 700 }}>BATEU</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{fmtH(horas)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: C.faint, letterSpacing: '.1em', fontWeight: 700 }}>ESPERADO</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{fmtH(esperado)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
