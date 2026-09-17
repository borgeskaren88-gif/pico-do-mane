'use client';
import React, { useMemo, useState, useEffect } from 'react';
import { C, Card, Empty, SecTitle } from './ui';
import { brl } from '../lib/util';
import { vendasDoPeriodo, porHora, porDiaSemana, faixasDoDia, leituraDoHorario, ordemDaNoite, comAbertura } from '../lib/movimento';

// Quando o bar vende: por hora do dia e por dia da semana.
//
// Barra desenhada com div mesmo, sem biblioteca de gráfico: são poucos valores,
// e assim ela lê o número junto da barra em vez de passar o dedo pra descobrir.
//
// A tela explica em português qual conta está fazendo. Sem isso, um pico às 23h
// parece verdade quando é só a hora em que as contas fecharam.
const PERIODOS = [[30, '30 dias'], [90, '90 dias'], [180, '6 meses']];
const hh = (h) => `${String(h).padStart(2, '0')}h`;

const VISOES = [
  ['cheio', 'bar cheio'],
  ['abertura', 'quando chegam'],
  ['fechamento', 'quando a conta fecha'],
];

const EXPLICA = {
  cheio: 'Conta cada mesa em todas as horas em que ela ficou sentada. Uma mesa que chegou às 19h e pagou às 23h aparece nas 19h, 20h, 21h, 22h e 23h, e o valor dela é dividido por essas horas. É a visão que mais se parece com olhar pro salão e ver se está cheio.',
  abertura: 'Conta cada mesa uma vez só, na hora em que ela sentou. Serve pra saber a que horas o pessoal chega — e, com isso, a que horas tudo precisa estar pronto.',
  fechamento: 'Conta cada mesa uma vez só, na hora em que a conta foi paga. Cuidado com esta: uma mesa das 19h às 23h conta inteira às 23h, então esta visão sempre empurra o movimento pra mais tarde do que ele foi de verdade.',
};

function Barra({ pct, cor, alt = 8 }) {
  return (
    <div style={{ height: alt, background: C.panel2, borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%`, height: '100%', background: cor, borderRadius: 999 }} />
    </div>
  );
}

export default function Movimento({ vendas = [] }) {
  const [dias, setDias] = useState(90);
  const [base, setBase] = useState('cheio'); // 'cheio' | 'abertura' | 'fechamento'
  const [metrica, setMetrica] = useState('dinheiro'); // 'dinheiro' | 'mesas'

  const recorte = useMemo(() => vendasDoPeriodo(vendas, dias), [vendas, dias]);
  const temHoraDeChegada = useMemo(() => comAbertura(recorte), [recorte]);
  const { horas, usadas, fora } = useMemo(() => porHora(recorte, base), [recorte, base]);
  const semana = useMemo(() => porDiaSemana(recorte), [recorte]);
  const faixas = useMemo(() => faixasDoDia(horas), [horas]);

  // Comanda antiga não guardou a hora de chegada. Enquanto nenhuma tiver,
  // as visões boas ficam vazias — então a tela cai sozinha na do fechamento,
  // que é torta mas é a única que existe. Assim que aparecerem comandas novas,
  // ela volta pra visão boa sozinha.
  useEffect(() => {
    if (recorte.length && temHoraDeChegada === 0 && base !== 'fechamento') setBase('fechamento');
  }, [recorte.length, temHoraDeChegada, base]);

  const valorDe = (x) => (metrica === 'dinheiro' ? x.total : x.mesas);
  const mostra = (v) => (metrica === 'dinheiro' ? brl(v) : `${v} mesa(s)`);

  const naOrdem = ordemDaNoite(horas);
  const horasComAlgo = naOrdem.filter((h) => h.total > 0 || h.mesas > 0);
  const maxHora = Math.max(...horas.map(valorDe), 0);
  const melhorDia = [...semana].filter((d) => d.aberturas > 0).sort((a, b) => b.media - a.media)[0];
  const piorDia = [...semana].filter((d) => d.aberturas > 0).sort((a, b) => a.media - b.media)[0];
  const maxSemana = Math.max(...semana.map((d) => d.media), 0);
  const leitura = leituraDoHorario(horas, base);

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
          {VISOES.map(([v, rot]) => (
            <button key={v} onClick={() => setBase(v)} style={pilula(base === v)}>{rot}</button>
          ))}
        </div>

        {/* O que esta visão está contando, em português. É a parte que impede
            de ler um pico torto como se fosse verdade. */}
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.55, marginBottom: 10 }}>
          {EXPLICA[base]}
        </div>

        {base !== 'fechamento' && fora > 0 && (
          <div style={{ fontSize: 11.5, color: C.amber, marginBottom: 10, lineHeight: 1.5 }}>
            ⚠️ {fora} de {recorte.length} comandas são antigas e não guardaram a hora em que a mesa abriu, então ficaram
            de fora desta conta — este gráfico está feito com {usadas}. Comanda nova já guarda as duas horas, então isso
            se resolve sozinho com o tempo.
          </div>
        )}

        {base === 'fechamento' && temHoraDeChegada > 0 && (
          <div style={{ fontSize: 11.5, color: C.amber, marginBottom: 10, lineHeight: 1.5 }}>
            ⚠️ Esta visão joga o movimento pra mais tarde do que ele é. Já tem {temHoraDeChegada} comanda(s) com a hora
            de chegada guardada — olha em <b>bar cheio</b>, que é a conta certa.
          </div>
        )}

        {horasComAlgo.length === 0 ? (
          <Empty>
            Nenhuma comanda deste período guardou a hora em que a mesa abriu.
            <br />Isso só existe nas comandas fechadas de agora em diante — por enquanto, olha em &quot;quando a conta fecha&quot;.
          </Empty>
        ) : (
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

            {leitura && (
              <div style={{ marginTop: 12, fontSize: 12.5, color: C.text, lineHeight: 1.55, background: `color-mix(in srgb, ${C.accent} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${C.accent} 35%, transparent)`, borderRadius: 12, padding: '10px 12px' }}>
                <b style={{ color: C.accent }}>Leitura: </b>{leitura}
              </div>
            )}
          </>
        )}
      </Card>

      <div style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.5 }}>
        Tudo aqui vem das <b>comandas fechadas</b>. Venda que não passou por comanda (ou comanda que ficou aberta) não entra.
        No gráfico por hora, a madrugada aparece no fim — num bar ela é o fim da noite, não o começo do dia.
      </div>
    </div>
  );
}
