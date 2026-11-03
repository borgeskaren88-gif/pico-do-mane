'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, Field, NumInput, TextInput, Empty, PageTitle, SecTitle } from './ui';
import { brl, num, todayISO, fmtDate, mesLabel, uid } from '../lib/util';
import { saldoDoBar, historicoConferencias, porMes } from '../lib/saldo';

// "NO FINAL DAS CONTAS EU NÃO SEI QUANTO EU DEVERIA TER EM CAIXA."
//
// O Dashboard conta o MÊS — e tem que contar: é como ela sabe se este mês está
// indo bem. Mas o dinheiro não zera na virada. Os R$ 300 que sobraram em
// outubro continuaram na gaveta no dia 1º de novembro.
//
// Esta tela é o número que atravessa os meses, e ela pediu assim: sem mexer no
// Dashboard.
export default function SaldoDoBar({ receitas = [], despesas = [], conferencias = [], onConferencias }) {
  const hoje = todayISO();
  const conta = useMemo(() => saldoDoBar({ receitas, despesas, conferencias, hoje }), [receitas, despesas, conferencias, hoje]);
  const historico = useMemo(() => historicoConferencias(conferencias), [conferencias]);
  const meses = useMemo(() => porMes({ receitas, despesas, conferencias, hoje }), [receitas, despesas, conferencias, hoje]);

  const [conferindo, setConferindo] = useState(false);
  const [contado, setContado] = useState('');
  const [dataConf, setDataConf] = useState(hoje);
  const [recem, setRecem] = useState(null); // a conferência recém-salva, pra mostrar a diferença

  const diferencaAgora = contado.trim() ? Math.round((num(contado) - conta.esperado) * 100) / 100 : null;

  const salvar = () => {
    if (!onConferencias || !contado.trim()) return;
    const nova = {
      id: uid(),
      data: dataConf || hoje,
      valor: num(contado),
      // Guarda o que o app esperava NAQUELE momento. Sem isso, o histórico
      // perde a diferença: recalcular depois daria outro número, porque a
      // âncora mudou.
      esperado: conta.esperado,
      criadoEm: new Date().toISOString(),
    };
    onConferencias([nova, ...(Array.isArray(conferencias) ? conferencias : [])]);
    setRecem({ ...nova, diferenca: Math.round((nova.valor - nova.esperado) * 100) / 100 });
    setConferindo(false);
    setContado('');
    setDataConf(hoje);
  };

  const apagar = (id) => {
    if (!onConferencias) return;
    if (typeof window !== 'undefined' && !window.confirm('Apagar esta conferência? O saldo volta a contar da anterior.')) return;
    onConferencias((Array.isArray(conferencias) ? conferencias : []).filter((c) => c.id !== id));
    setRecem(null);
  };

  return (
    <div>
      <PageTitle sub="O dinheiro que atravessa os meses — a conta que o Dashboard zera toda virada">Quanto eu deveria ter</PageTitle>

      {/* O NÚMERO, antes de qualquer explicação. */}
      <Card style={{ marginBottom: 14, borderColor: conta.semAncora ? C.amber : C.accent }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: C.muted, fontWeight: 800 }}>
          Deveria ter hoje
        </div>
        <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.05, marginTop: 7, color: conta.esperado >= 0 ? C.accent : C.red, fontVariantNumeric: 'tabular-nums' }}>
          {brl(conta.esperado)}
        </div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
          Somando a gaveta <b style={{ color: C.text }}>e</b> o que está no banco. Na hora de conferir, conta os dois juntos.
        </div>

        {/* DE ONDE VEM O NÚMERO. Ela já me disse uma vez que não confia em conta
            que não mostra o caminho — e tem razão. */}
        <div style={{ marginTop: 13, borderTop: `1px solid ${C.hair}`, paddingTop: 11 }}>
          {conta.ancora ? (
            <Linha rotulo={`Tu contou em ${fmtDate(conta.ancora.data)}`} valor={brl(conta.base)} />
          ) : (
            <Linha rotulo="Ponto de partida" valor="ainda não tem" cor={C.amber} />
          )}
          <Linha rotulo={conta.desde ? `Entrou depois de ${fmtDate(conta.desde)}` : 'Tudo que entrou, no app'} valor={`+ ${brl(conta.entrou)}`} cor={C.green} />
          <Linha rotulo={conta.desde ? `Saiu depois de ${fmtDate(conta.desde)}` : 'Tudo que saiu, no app'} valor={`− ${brl(conta.saiu)}`} cor={C.red} />
          <Linha rotulo="Deveria ter hoje" valor={brl(conta.esperado)} forte />
        </div>
      </Card>

      {conta.semAncora && (
        <Card style={{ marginBottom: 14, borderColor: C.amber }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: C.amber, marginBottom: 6 }}>Esse número ainda é um chute</div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
            Sem um ponto de partida, ele soma tudo o que está lançado no app desde sempre — e tudo o que ficou
            de fora, antes de tu começar a usar ou num dia de correria, está faltando aí.
            <br /><br />
            <b style={{ color: C.text }}>Conta hoje quanto tu tem</b> (gaveta + banco) e toca em “Contei o dinheiro”.
            A partir daí o número passa a ser de verdade, e cada conferência nova conserta o que tiver desandado.
          </div>
        </Card>
      )}

      {/* O RESULTADO DA ÚLTIMA CONFERÊNCIA, logo depois de salvar. */}
      {recem && (
        <Card style={{ marginBottom: 14, borderColor: Math.abs(recem.diferenca) < 0.005 ? C.green : C.amber }}>
          {Math.abs(recem.diferenca) < 0.005 ? (
            <div style={{ fontSize: 14, color: C.green, fontWeight: 800 }}>Bateu certinho. O app e a gaveta contam a mesma história.</div>
          ) : (
            <>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.amber }}>
                {recem.diferenca < 0 ? `Faltam ${brl(Math.abs(recem.diferenca))}` : `Sobram ${brl(recem.diferenca)}`}
              </div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 1.55 }}>
                {recem.diferenca < 0
                  ? 'Tem menos dinheiro do que o app esperava. Quase sempre é despesa paga e não lançada — ou compra feita no dinheiro da gaveta.'
                  : 'Tem mais dinheiro do que o app esperava. Quase sempre é venda recebida e não lançada.'}
                <br />A partir de agora a conta parte deste valor, então o erro não se arrasta.
              </div>
            </>
          )}
          <div style={{ marginTop: 10 }}><Btn kind="ghost" small onClick={() => setRecem(null)}>Entendi</Btn></div>
        </Card>
      )}

      {/* CONFERIR. */}
      <Card style={{ marginBottom: 18 }}>
        {!conferindo ? (
          <>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 5 }}>Contei o dinheiro</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
              Conta o que tem na gaveta mais o que tem na conta do banco, e põe aqui. O app compara com o que
              esperava e te diz a diferença.
            </div>
            <Btn onClick={() => { setConferindo(true); setDataConf(hoje); }}>Conferir agora</Btn>
          </>
        ) : (
          <>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Quanto tu tem de verdade?</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Contei (R$)"><NumInput value={contado} onChange={setContado} /></Field>
              <Field label="No dia"><TextInput type="date" value={dataConf} onChange={setDataConf} /></Field>
            </div>
            {diferencaAgora != null && (
              <div style={{ fontSize: 13.5, marginBottom: 12, color: Math.abs(diferencaAgora) < 0.005 ? C.green : C.amber, fontWeight: 700 }}>
                {Math.abs(diferencaAgora) < 0.005
                  ? 'Bate com o que o app esperava.'
                  : `${diferencaAgora < 0 ? 'Faltam' : 'Sobram'} ${brl(Math.abs(diferencaAgora))} em relação aos ${brl(conta.esperado)} esperados.`}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={salvar}>Salvar a conferência</Btn>
              <Btn kind="ghost" onClick={() => { setConferindo(false); setContado(''); }}>Cancelar</Btn>
            </div>
          </>
        )}
      </Card>

      {/* A LINHA DO TEMPO QUE O DASHBOARD ZERA. */}
      {meses.length > 0 && (
        <>
          <SecTitle>Mês a mês, sem zerar</SecTitle>
          <Card style={{ marginBottom: 18, padding: 0, overflow: 'hidden' }}>
            {meses.map((m, i) => (
              <div key={m.mes} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderTop: i ? `1px solid ${C.hair}` : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{mesLabel(m.mes)}</div>
                  <div style={{ fontSize: 11.5, color: C.faint, fontWeight: 700, marginTop: 2 }}>
                    entrou {brl(m.entrou)} · saiu {brl(m.saiu)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: m.acumulado >= 0 ? C.text : C.red }}>{brl(m.acumulado)}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: m.doMes >= 0 ? C.green : C.red, marginTop: 2 }}>
                    {m.doMes >= 0 ? '+' : '−'} {brl(Math.abs(m.doMes))} no mês
                  </div>
                </div>
              </div>
            ))}
          </Card>
          <div style={{ fontSize: 11.5, color: C.faint, margin: '-10px 0 18px', lineHeight: 1.5 }}>
            O número da direita é o que sobrou ACUMULADO no fim de cada mês — é ele que o Dashboard zera na virada,
            e de propósito: lá tu quer saber como está ESTE mês.
          </div>
        </>
      )}

      <SecTitle>Conferências que tu já fez</SecTitle>
      {historico.length === 0 ? (
        <Empty>Nenhuma conferência ainda.<br /><span style={{ fontSize: 12.5 }}>A primeira é a que faz o número virar verdade.</span></Empty>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {historico.map((c, i) => (
            <div key={c.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderTop: i ? `1px solid ${C.hair}` : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{fmtDate(c.data)}</div>
                <div style={{ fontSize: 11.5, color: C.faint, fontWeight: 700, marginTop: 2 }}>
                  contou {brl(c.valor)} · app esperava {brl(c.esperado)}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: Math.abs(c.diferenca) < 0.005 ? C.green : C.amber }}>
                  {Math.abs(c.diferenca) < 0.005 ? 'bateu' : `${c.diferenca < 0 ? 'faltou' : 'sobrou'} ${brl(Math.abs(c.diferenca))}`}
                </div>
                {onConferencias && (
                  <button onClick={() => apagar(c.id)} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: '4px 0 0' }}>apagar</button>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}

      <div style={{ fontSize: 11.5, color: C.faint, marginTop: 14, lineHeight: 1.6 }}>
        Aqui entra <b style={{ color: C.muted }}>tudo que mexeu no dinheiro</b> — inclusive empréstimo que entrou,
        equipamento comprado e lucro que tu tirou pra ti. É diferente do relatório, que mede só o resultado da
        operação. A pergunta aqui não é “o bar deu lucro?”, é “quanto tem na mão?”.
        <br />
        Venda no cartão conta no dia da venda, mas o dinheiro cai uns dias depois — então pode faltar um pouco
        no dia em que tu conferir. Conferindo sempre mais ou menos no mesmo ponto do mês, essa diferença fica
        estável e tu aprende o tamanho dela.
      </div>
    </div>
  );
}

function Linha({ rotulo, valor, cor, forte }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, padding: '5px 0' }}>
      <span style={{ fontSize: 13, color: forte ? C.text : C.muted, fontWeight: forte ? 800 : 400, minWidth: 0 }}>{rotulo}</span>
      <span style={{ fontSize: forte ? 15 : 13.5, fontWeight: 800, color: cor || C.text, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{valor}</span>
    </div>
  );
}
