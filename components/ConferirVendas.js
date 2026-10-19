'use client';
import React, { useMemo, useState } from 'react';
import { C, Card, Empty } from './ui';
import { brl, todayISO } from '../lib/util';
import { conferirVendas } from '../lib/conferir-vendas';

// "AS VENDAS ESTÃO TODAS PASSANDO PELO APP?"
//
// Ela não tinha como saber, e eu também não — só ela vê o bar. Mas a
// mercadoria comprada não mente: ela paga, lança, a nota existe. Então o
// sistema compara o que as vendas dizem ter consumido com o que ela comprou.
//
// Fica em Conferência, junto da outra conferência — e não no relatório do mês.
// Isto é manutenção de dado, não resultado: se virar card de todo mês, ou vira
// paisagem, ou assusta sem motivo num mês de compra grande.

const CORES = { bate: C.green, rodagem: C.green, folga: C.amber, buraco: C.red };

export default function ConferirVendas({ compras = [], vendas = [], fichas = [], estoque = [], cardapio = [] }) {
  const [aberto, setAberto] = useState(false);
  const r = useMemo(
    () => conferirVendas({ compras, vendas, fichas, estoque, cardapio, hoje: todayISO(), meses: 3 }),
    [compras, vendas, fichas, estoque, cardapio],
  );
  if (!r) return null;

  const cor = CORES[r.estado] || C.faint;
  const periodo = r.porMes.length ? `${r.porMes[0].rotulo} a ${r.porMes[r.porMes.length - 1].rotulo}` : '';

  const titulo = r.estado === 'sem-compras' ? 'Sem compra de mercadoria lançada nestes meses'
    : r.estado === 'sem-cmv' ? 'Sem venda com ficha técnica nestes meses'
      : r.estado === 'rodagem' ? 'O sistema entrou em uso no meio do período'
        : r.estado === 'bate' ? 'As vendas explicam o que tu comprou'
          : r.estado === 'folga' ? 'Sobra mercadoria que as vendas não explicam'
            : 'Tem muita mercadoria que as vendas não explicam';

  return (
    <Card style={{ marginBottom: 14, borderColor: r.estado === 'buraco' ? C.red : C.cardBorder }}>
      <button onClick={() => setAberto((v) => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
        <span style={{ color: C.accent, fontSize: 12, fontWeight: 800, width: 12, flexShrink: 0 }}>{aberto ? '▾' : '▸'}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>As vendas batem com o que tu compra?</span>
          <span style={{ fontSize: 12, color: cor, display: 'block', marginTop: 1, fontWeight: 700 }}>
            {r.pct != null ? `${r.pct.toFixed(0)}% — ${titulo.toLowerCase()}` : titulo}
          </span>
        </span>
      </button>

      {aberto && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.hair}` }}>
          <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, marginBottom: 14 }}>
            Mercadoria comprada não mente: tu paga, lança, a nota existe. Então dá pra perguntar se o que as vendas
            dizem ter consumido chega perto do que tu comprou. É <b style={{ color: C.text }}>em dinheiro</b> — em
            quantidade não fecharia, porque tu compra batata em quilo e vende em porção. E é de{' '}
            <b style={{ color: C.text }}>{periodo}</b>: num mês só, uma compra grande no dia 28 derruba a conta sem nada
            estar errado.
          </div>

          {r.pct == null ? <Empty>{titulo}</Empty> : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 8, marginBottom: 12 }}>
                {[['Tu comprou', brl(r.comprado), C.text], ['As vendas explicam', brl(r.explicado), cor], ['Não explicado', brl(r.diferenca), r.diferenca > 0 ? cor : C.faint]].map(([rot, v, c]) => (
                  <div key={rot} style={{ background: C.panel2, borderRadius: 11, padding: '9px 11px', minWidth: 0 }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: C.faint, fontWeight: 800 }}>{rot}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: c, marginTop: 3, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', height: 12, borderRadius: 7, overflow: 'hidden', background: C.panel2, marginBottom: 6 }}>
                <div style={{ width: `${Math.min(100, r.pct)}%`, background: cor }} />
              </div>
              <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.6, marginBottom: 12 }}>
                De cada R$ 100 de mercadoria que entrou, as vendas explicam{' '}
                <b style={{ color: cor }}>R$ {r.pct.toFixed(0)}</b>.
              </div>

              {/* A LEITURA. Ficha incompleta derruba este número sozinha, sem
                  nenhuma venda ter sumido — mandar ela procurar venda perdida
                  quando o que falta é cadastro seria procurar ladrão onde tem
                  ficha pela metade. Por isso a cobertura decide a ordem. */}
              {r.estado === 'rodagem' ? (
                /* A MÉDIA É PASSADO. Um período que começou sem o app e
                   terminou saudável não pode ser lido pelo número de três
                   meses — ele acusa justamente quem acabou de adotar o
                   sistema, e isso ensina a ignorar o sistema. */
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.65, background: `color-mix(in srgb, ${C.green} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${C.green} 40%, transparent)`, borderRadius: 12, padding: '11px 13px' }}>
                  <b style={{ color: C.green }}>Isso é rodagem, não vazamento.</b>{' '}
                  {r.mesesSemVenda.length > 0 && <>Em {r.mesesSemVenda.join(' e ')} não há <b>nenhuma</b> venda lançada —
                  o app ainda não estava em uso, e a compra daquele mês ficou sem par. </>}
                  No último mês fechado (<b>{r.ultimo.rotulo}</b>) as vendas explicam{' '}
                  <b style={{ color: C.green }}>{r.ultimo.pct.toFixed(0)}%</b> do que entrou, que é saudável.
                  <div style={{ fontSize: 11.5, color: C.faint, marginTop: 8, lineHeight: 1.55 }}>
                    Acima de 100% não é erro: é mês em que saiu estoque comprado antes. O número dos três meses vai
                    subir sozinho conforme os meses antigos saem da janela. Vale olhar isto de novo daqui a um mês —
                    aí sim ele diz se tem venda escapando.
                  </div>
                </div>
              ) : r.estado === 'bate' ? (
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.65, background: `color-mix(in srgb, ${C.green} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${C.green} 40%, transparent)`, borderRadius: 12, padding: '11px 13px' }}>
                  Está saudável. A diferença que sobra é o normal de estoque que sobe e desce, nota que atrasa e ficha
                  que arredonda. <b>Pode confiar nos números do relatório.</b>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.65, background: `color-mix(in srgb, ${cor} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${cor} 40%, transparent)`, borderRadius: 12, padding: '11px 13px' }}>
                  <b style={{ color: cor }}>{brl(r.diferenca)}</b> de mercadoria entrou e as vendas não explicam.
                  Em ordem do mais provável:
                  {r.culpaProvavel === 'ficha' ? (
                    <>
                      <div style={{ marginTop: 8 }}>
                        <b>1. Ficha técnica faltando.</b> Só {r.cobertura.toFixed(0)}% do que tu vendeu tem ficha pra
                        custear — <b>o resto some desta conta sozinho</b>, sem nenhuma venda ter se perdido. Monta as
                        fichas que faltam antes de desconfiar de qualquer outra coisa.
                      </div>
                      <div style={{ marginTop: 6 }}><b>2.</b> Venda que não passou pelo app (comanda no papel, venda direto no caixa).</div>
                      <div style={{ marginTop: 6 }}><b>3.</b> Perda, cortesia ou consumo da casa sem lançar.</div>
                    </>
                  ) : (
                    <>
                      <div style={{ marginTop: 8 }}>
                        <b>1. Venda que não passou pelo app.</b> {r.cobertura != null && <>{r.cobertura.toFixed(0)}% do que
                        foi vendido tem ficha, então o CMV está bem calculado — o que falta é venda.</>} Comanda no
                        papel, venda direto no caixa, mesa fechada sem lançar.
                      </div>
                      <div style={{ marginTop: 6 }}><b>2.</b> Perda, cortesia ou consumo da casa sem lançar.</div>
                      <div style={{ marginTop: 6 }}><b>3.</b> Estoque subindo de verdade — tu encheu a câmara nestes meses.</div>
                    </>
                  )}
                  <div style={{ fontSize: 11.5, color: C.faint, marginTop: 9, lineHeight: 1.5 }}>
                    Se for venda fora do app, isto é bem maior que parece: ela não entra no CMV, nem no resultado do
                    mês, nem na conta do teto do MEI — que passaria a dizer que tu está longe do limite justamente
                    quando não está.
                  </div>
                </div>
              )}

              <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
                {r.porMes.map((m) => (
                  <div key={m.mes} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 0', fontSize: 12.5 }}>
                    <span style={{ color: C.muted }}>{m.rotulo}</span>
                    <span style={{ color: C.faint, fontVariantNumeric: 'tabular-nums' }}>
                      comprou {brl(m.comprado)} · vendas explicam {brl(m.explicado)}
                      {m.pct != null && (
                        <b style={{ color: m.explicado <= 0 ? C.faint : m.pct >= 75 ? C.green : m.pct >= 45 ? C.amber : C.red, marginLeft: 8 }}>
                          {m.explicado <= 0 ? 'sem venda lançada' : `${m.pct.toFixed(0)}%`}
                        </b>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
