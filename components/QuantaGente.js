'use client';
import React, { useMemo, useState, useEffect } from 'react';
import { C, Card, SecTitle } from './ui';
import { brl, ymOf, todayISO } from '../lib/util';
import { cargaPorHora, ondeAperta, custoDoReforco } from '../lib/escala';
import { valorHoraDoMes } from '../lib/ponto';

// "NO SÁBADO UMA PESSOA SOZINHA NÃO DÁ CONTA."
//
// O gráfico de movimento logo acima diz a que horas o bar enche. Isso não
// responde a pergunta dela: encher é bom. A pergunta é quanto salão cada
// pessoa está segurando sozinha — e pra isso o movimento tem que cruzar com
// quem estava de plantão, que o ponto sabe.
//
// A tela é feita pra terminar numa frase que ela possa conferir com a própria
// memória ("sábado das 20h às 23h"), e num número que decida ("custa R$ X por
// mês"). Grade colorida sem essas duas coisas é enfeite: ela já SABE que
// sábado aperta, o que falta é o tamanho e o preço.
const hh = (h) => `${String(h).padStart(2, '0')}h`;
const CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
// Da virada do dia operacional até a madrugada. Hora de bar fechado só faria
// a grade crescer com coluna vazia.
const HORAS = [16, 17, 18, 19, 20, 21, 22, 23, 0, 1];

export default function QuantaGente({ vendas = [] }) {
  const [ponto, setPonto] = useState(null);
  const [erro, setErro] = useState('');
  const [dias, setDias] = useState(90);

  useEffect(() => {
    let vivo = true;
    fetch('/api/ponto')
      .then((r) => r.json())
      .then((j) => { if (!vivo) return; if (j && j.ok) setPonto(j); else setErro(j?.erro || 'Não deu pra ler o ponto.'); })
      .catch(() => { if (vivo) setErro('Não deu pra ler o ponto.'); });
    return () => { vivo = false; };
  }, []);

  const carga = useMemo(
    () => cargaPorHora({ vendas, pontos: (ponto && ponto.registros) || [], dias }),
    [vendas, ponto, dias],
  );
  const aperto = useMemo(() => ondeAperta(carga), [carga]);
  const custo = useMemo(() => {
    const j = ponto && ponto.jornadas && ponto.jornadas.garcom;
    if (!j || !aperto) return null;
    return custoDoReforco({ faixa: aperto, valorHora: valorHoraDoMes(j, ymOf(todayISO())) });
  }, [ponto, aperto]);

  // O pior valor da grade manda na cor, pra escala ser dela e não de um manual
  // que não conhece o bar.
  const teto = useMemo(() => {
    let max = 0;
    for (const d of carga.dias) for (const h of d.horas) if (h.porPessoa != null && h.porPessoa > max) max = h.porPessoa;
    return max;
  }, [carga]);

  const corDe = (v) => {
    if (v == null) return 'transparent';
    const f = teto > 0 ? v / teto : 0;
    const cor = f > 0.75 ? C.red : f > 0.5 ? C.amber : C.green;
    return `color-mix(in srgb, ${cor} ${Math.round(18 + f * 55)}%, transparent)`;
  };

  return (
    <Card style={{ marginBottom: 14 }}>
      <SecTitle>Quanta gente o salão precisa</SecTitle>
      <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, marginBottom: 12 }}>
        Quantas mesas cada pessoa do salão segurou <b style={{ color: C.text }}>ao mesmo tempo</b>, por dia e hora.
        Não existe número de manual pra isso — o que vale é comparar as tuas horas entre si.
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {[[30, '30 dias'], [90, '90 dias'], [180, '6 meses']].map(([v, rot]) => (
          <button key={v} onClick={() => setDias(v)} style={{
            borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
            border: `1px solid ${dias === v ? C.accent : C.line}`,
            background: dias === v ? C.accent : 'transparent',
            color: dias === v ? '#06101F' : C.muted,
          }}>{rot}</button>
        ))}
      </div>

      {/* SEM DADO, SEM GRADE. Pintar uma grade vazia de verde faria parecer que
          está tudo tranquilo justamente quando não se sabe de nada. */}
      {erro ? (
        <div style={{ fontSize: 12.5, color: C.amber, lineHeight: 1.6 }}>{erro}</div>
      ) : !ponto ? (
        <div style={{ fontSize: 12.5, color: C.faint }}>Lendo o ponto…</div>
      ) : carga.diasAnalisados === 0 ? (
        <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.65, background: C.panel2, borderRadius: 12, padding: '12px 14px' }}>
          <b style={{ color: C.amber }}>Ainda não dá pra fazer esta conta.</b>
          <div style={{ marginTop: 6, color: C.muted }}>
            Ela cruza o movimento das comandas com quem estava de plantão — e pra isso{' '}
            <b style={{ color: C.text }}>o pessoal do salão precisa bater ponto</b>.
            {carga.diasSemPonto > 0 && <> Dos dias com venda no período, {carga.diasSemPonto} não têm ponto do salão.</>}
            {' '}Assim que tiver umas semanas de ponto batido, esta tela se acende sozinha.
          </div>
        </div>
      ) : (
        <>
          {/* O QUE ESTA CONTA NÃO ESTÁ VENDO — antes da conclusão, não depois.
              Ela viu "O aperto é domingo" em negrito e, lá no rodapé em letra
              clara, que 208 comandas tinham ficado de fora. Quem lê decide
              pelo negrito. */}
          {!carga.confiavel && (
            <div style={{ borderRadius: 12, padding: '12px 14px', marginBottom: 12, background: `color-mix(in srgb, ${C.red} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${C.red} 42%, transparent)` }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: C.red }}>Esta conta está vendo pouco do teu salão</div>
              <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.65, marginTop: 5 }}>
                Dos {carga.comandasNosDias} atendimentos desses dias, só <b>{carga.comandasVistas}</b> guardaram a hora
                em que a mesa sentou — os outros {carga.comandasSemHoraNosDias} não entram, porque sem essa hora não dá
                pra saber quantas mesas estavam abertas juntas.
                <div style={{ marginTop: 6 }}>
                  Então <b>usa o que está abaixo como pista, não como decisão</b>. Conforme as comandas novas forem
                  abrindo pelo app, isto se corrige sozinho.
                </div>
              </div>
            </div>
          )}

          {carga.diasDaSemanaComDado === 1 && (
            <div style={{ borderRadius: 12, padding: '11px 13px', marginBottom: 12, background: C.panel2, border: `1px solid ${C.hair}`, fontSize: 12.5, color: C.text, lineHeight: 1.6 }}>
              <b style={{ color: C.amber }}>Só um dia da semana tem ponto batido no período.</b> Com um dia só não há
              com o que comparar — o que aparece abaixo é esse dia, não o pior dia da tua semana.
            </div>
          )}

          {/* A RESPOSTA, ANTES DA GRADE. */}
          {aperto && (
            <div style={{ borderRadius: 12, padding: '12px 14px', marginBottom: 14, background: `color-mix(in srgb, ${C.amber} 13%, transparent)`, border: `1px solid color-mix(in srgb, ${C.amber} 42%, transparent)` }}>
              <div style={{ fontSize: 'clamp(14px, 3vw, 15.5px)', fontWeight: 800, lineHeight: 1.45 }}>
                O aperto é <span style={{ color: C.amber }}>{aperto.dia}, das {hh(aperto.de)} às {hh((aperto.ate + 1) % 24)}</span>
              </div>
              <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.65, marginTop: 6 }}>
                Nessas horas cada pessoa do salão segurou <b>{aperto.porPessoa} mesas</b> ao mesmo tempo —{' '}
                <b>{aperto.vezesAMedia}×</b> a tua média, que é {aperto.media}. No pico chegou a {aperto.mesasNoPico} mesas
                abertas com {aperto.pessoas} pessoa(s) em campo.
              </div>
              {custo ? (
                <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.65, marginTop: 8, paddingTop: 8, borderTop: `1px solid color-mix(in srgb, ${C.amber} 35%, transparent)` }}>
                  Cobrir só essas <b>{aperto.horas}h</b> com mais uma pessoa custa <b>{brl(custo.porDia)}</b> por {aperto.dia} —{' '}
                  <b>{brl(custo.porMes)}</b> no mês.
                  {custo.vendaPraEmpatar != null && (
                    <> Pra empatar, teria que entrar <b>{brl(custo.vendaPraEmpatar)}</b> a mais de venda no mês.</>
                  )}
                  {/* Honestidade: garçom não gera venda, ele evita perder. */}
                  <div style={{ fontSize: 11.5, color: C.faint, marginTop: 5 }}>
                    Ninguém garante que o reforço se paga — garçom não vende sozinho, ele evita a mesa que desiste e
                    espera. O que dá pra afirmar é o custo; se vale, quem olha o salão no {aperto.dia} é que sabe.
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 11.5, color: C.faint, marginTop: 8 }}>
                  Pra eu dizer quanto custa cobrir essas horas, falta o salário do Atendimento em <b>Ponto</b>.
                </div>
              )}
            </div>
          )}

          {/* A GRADE */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 11.5, minWidth: 420 }}>
              <thead>
                <tr>
                  <th />
                  {HORAS.map((h) => <th key={h} style={{ color: C.faint, fontWeight: 800, padding: '0 2px' }}>{hh(h)}</th>)}
                </tr>
              </thead>
              <tbody>
                {carga.dias.filter((d) => d.dias > 0).map((d) => (
                  <tr key={d.idx}>
                    <td style={{ color: C.muted, fontWeight: 800, paddingRight: 6, whiteSpace: 'nowrap' }}>{CURTO[d.idx]}</td>
                    {HORAS.map((hora) => {
                      const c = d.horas[hora];
                      return (
                        <td key={hora} title={c.porPessoa == null ? 'ninguém de plantão' : `${c.mesas} mesa(s) · ${c.pessoas} pessoa(s)`}
                          style={{
                            background: corDe(c.porPessoa), borderRadius: 6, textAlign: 'center',
                            padding: '5px 3px', minWidth: 30, fontVariantNumeric: 'tabular-nums',
                            color: c.porPessoa == null ? C.faint : C.text, fontWeight: c.porPessoa != null ? 700 : 400,
                          }}>
                          {c.porPessoa == null ? '–' : c.porPessoa}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.55, marginTop: 10 }}>
            Mesas por pessoa do salão. Quadrado vazio é hora sem ninguém batendo ponto — não é hora tranquila,
            é hora que não dá pra julgar. Conta com {carga.diasAnalisados} dia(s) que tinham venda e ponto.
            {carga.comandasSemHoraNosDias > 0 && (
              <> {carga.comandasSemHoraNosDias} atendimento(s) desses dias não guardaram a hora em que a mesa sentou e ficaram de fora.</>
            )}
            {carga.turnosSemSetor > 0 && (
              <> {carga.turnosSemSetor} turno(s) antigo(s) não dizem se eram do salão ou da cozinha, e também ficaram de fora.</>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
