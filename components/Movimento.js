'use client';
import React, { useMemo, useState } from 'react';
import { C, Card, Empty, SecTitle } from './ui';
import { brl, num } from '../lib/util';
import { vendasDoPeriodo, porHora, porDiaSemana, faixasDoDia, leituraDoHorario } from '../lib/movimento';

// Quando o bar vende: por hora do dia e por dia da semana.
//
// Barra desenhada com div mesmo, sem biblioteca de gráfico: são poucos valores,
// e assim ela lê o número junto da barra em vez de passar o dedo pra descobrir.
const PERIODOS = [[30, '30 dias'], [90, '90 dias'], [180, '6 meses']];
const hh = (h) => `${String(h).padStart(2, '0')}h`;

function Barra({ pct, cor, alt = 8 }) {
  return (
    <div style={{ height: alt, background: C.panel2, borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%`, height: '100%', background: cor, borderRadius: 999 }} />
    </div>
  );
}

export default function Movimento({ vendas = [] }) {
  const [dias, setDias] = useState(90);
  const [base, setBase] = useState('abertura'); // 'abertura' (chegam) | 'fechamento' (vão embora)
  const [metrica, setMetrica] = useState('dinheiro'); // 'dinheiro' | 'mesas'

  const recorte = useMemo(() => vendasDoPeriodo(vendas, dias), [vendas, dias]);
  const { horas, semAbertura } = useMemo(() => porHora(recorte, base), [recorte, base]);
  const semana = useMemo(() => porDiaSemana(recorte), [recorte]);
  const faixas = useMemo(() => faixasDoDia(horas), [horas]);

  const valorDe = (x) => (metrica === 'dinheiro' ? x.total : x.mesas);
  const mostra = (v) => (metrica === 'dinheiro' ? brl(v) : `${v} mesa(s)`);

  const horasComAlgo = horas.filter((h) => h.total > 0 || h.mesas > 0);
  const maxHora = Math.max(...horas.map(valorDe), 0);
  const melhorDia = [...semana].filter((d) => d.aberturas > 0).sort((a, b) => b.media - a.media)[0];
  const piorDia = [...semana].filter((d) => d.aberturas > 0).sort((a, b) => a.media - b.media)[0];
  const maxSemana = Math.max(...semana.map((d) => d.media), 0);

  const pilula = (ativo) => ({
    borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
    border: `1px solid ${ativo ? C.accent : C.line}`,
    background: ativo ? C.accent : 'transparent',
    color: ativo ? '#06101F' : C.muted,
  });

  if (!recorte.length) {
    return <Empty>Ainda não tem comanda fechada nesse período.<br />Conforme o salão for fechando as contas, isso aqui se enche sozinho.</Empty>;
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {PERIODOS.map(([v, rot]) => (
          <button key={v} onClick={() => setDias(v)} style={pilula(dias === v)}>{rot}</button>
        ))}
        <span style={{ width: 10 }} />
        {[['dinheiro', 'em dinheiro'], ['mesas', 'em mesas']].map(([v, rot]) => (
          <button key={v} onClick={() => setMetrica(v)} style={pilula(metrica === v)}>{rot}</button>
        ))}
      </div>

      {/* ---------- por dia da semana ---------- */}
      <SecTitle>Faturamento por dia da semana</SecTitle>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
          Média <b style={{ color: C.text }}>por dia aberto</b> — não o total. Se tu abriu oito sábados e quatro terças,
          somar faria o sábado ganhar só por ter acontecido mais vezes.
        </div>
        {semana.map((d) => {
          const pct = maxSemana > 0 ? (d.media / maxSemana) * 100 : 0;
          const cor = d.aberturas === 0 ? C.line : d.idx === (melhorDia?.idx) ? C.green : d.idx === (piorDia?.idx) ? C.amber : C.accent;
          return (
            <div key={d.idx} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: d.aberturas ? C.text : C.faint, textTransform: 'capitalize' }}>{d.nome}</span>
                <span style={{ fontSize: 12.5, color: C.muted, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                  {d.aberturas === 0 ? <span style={{ color: C.faint }}>fechado</span> : (
                    <>
                      <b style={{ color: cor }}>{brl(d.media)}</b>
                      <span style={{ color: C.faint }}> por dia · {d.aberturas} dia(s) · ticket {brl(d.ticket)}</span>
                    </>
                  )}
                </span>
              </div>
              <Barra pct={pct} cor={cor} />
            </div>
          );
        })}
        {melhorDia && piorDia && melhorDia.idx !== piorDia.idx && piorDia.media > 0 && (
          <div style={{ marginTop: 12, fontSize: 12.5, color: C.text, lineHeight: 1.55, background: `color-mix(in srgb, ${C.accent} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${C.accent} 35%, transparent)`, borderRadius: 12, padding: '10px 12px' }}>
            <b style={{ color: C.accent }}>Leitura: </b>
            <b style={{ textTransform: 'capitalize' }}>{melhorDia.nome}</b> é teu melhor dia ({brl(melhorDia.media)} em média) e{' '}
            <b>{piorDia.nome}</b> o mais fraco ({brl(piorDia.media)}).
            {melhorDia.media / piorDia.media >= 3
              ? ` ${melhorDia.nome} rende ${Math.round(melhorDia.media / piorDia.media)} vezes o que ${piorDia.nome} rende — vale pensar se ${piorDia.nome} compensa abrir, ou se pede promoção.`
              : ' A diferença entre eles não é grande — o bar é parelho na semana.'}
          </div>
        )}
      </Card>

      {/* ---------- por hora ---------- */}
      <SecTitle>Movimento por horário</SecTitle>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {[['abertura', 'quando chegam'], ['fechamento', 'quando vão embora']].map(([v, rot]) => (
            <button key={v} onClick={() => setBase(v)} style={pilula(base === v)}>{rot}</button>
          ))}
        </div>

        {base === 'abertura' && semAbertura > 0 && (
          <div style={{ fontSize: 11.5, color: C.amber, marginBottom: 10, lineHeight: 1.5 }}>
            ⚠️ {semAbertura} de {recorte.length} comandas são antigas e não guardaram a hora de abertura — nessas vale a
            hora em que a conta fechou, o que joga o número pra mais tarde. As novas já guardam as duas, então isso se
            corrige sozinho com o tempo.
          </div>
        )}

        {horasComAlgo.length === 0 ? <Empty>Sem horário registrado ainda.</Empty> : (
          <>
            {horasComAlgo.map((h) => {
              const pct = maxHora > 0 ? (valorDe(h) / maxHora) * 100 : 0;
              const ehPico = valorDe(h) === maxHora && maxHora > 0;
              return (
                <div key={h.hora} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                  <span style={{ width: 34, flexShrink: 0, fontSize: 12, fontWeight: 700, color: ehPico ? C.green : C.muted, fontVariantNumeric: 'tabular-nums' }}>{hh(h.hora)}</span>
                  <span style={{ flex: 1, minWidth: 0 }}><Barra pct={pct} cor={ehPico ? C.green : C.accent} alt={10} /></span>
                  <span style={{ width: 92, flexShrink: 0, textAlign: 'right', fontSize: 12, fontWeight: ehPico ? 800 : 600, color: ehPico ? C.green : C.muted, fontVariantNumeric: 'tabular-nums' }}>
                    {mostra(valorDe(h))}
                  </span>
                </div>
              );
            })}

            <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.hair}` }}>
              <div style={{ fontSize: 11, color: C.faint, fontWeight: 800, letterSpacing: '.06em', marginBottom: 7 }}>POR FAIXA</div>
              {faixas.filter((f) => f.mesas > 0).map((f) => (
                <div key={f.rotulo} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, padding: '3px 0', color: C.muted }}>
                  <span>{f.rotulo}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}><b style={{ color: C.text }}>{brl(f.total)}</b> · {f.mesas} mesa(s)</span>
                </div>
              ))}
            </div>

            {leituraDoHorario(horas) && (
              <div style={{ marginTop: 12, fontSize: 12.5, color: C.text, lineHeight: 1.55, background: `color-mix(in srgb, ${C.accent} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${C.accent} 35%, transparent)`, borderRadius: 12, padding: '10px 12px' }}>
                <b style={{ color: C.accent }}>Leitura: </b>{leituraDoHorario(horas)}
              </div>
            )}
          </>
        )}
      </Card>

      <div style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.5 }}>
        Tudo aqui vem das <b>comandas fechadas</b>. Venda que não passou por comanda (ou comanda que ficou aberta) não entra.
      </div>
    </div>
  );
}
